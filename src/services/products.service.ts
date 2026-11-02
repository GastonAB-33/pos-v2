import { dbTables } from "@/lib/database/tables";
import { supabase } from "@/lib/supabase/client";
import { dataProvider } from "@/services/config/data-provider";
import {
  TenantCrudService,
  type CreateEntityInput,
  type UpdateEntityInput,
} from "@/services/base/tenant-crud.service";
import type { Product, ProductBarcode } from "@/types/entities";

const crud = new TenantCrudService<Product>(dbTables.products);
const barcodeCrud = new TenantCrudService<ProductBarcode>(dbTables.product_barcodes);

export type CreateProductInput = CreateEntityInput<Product>;
export type UpdateProductInput = UpdateEntityInput<Product>;
export type CreateProductBarcodeInput = CreateEntityInput<ProductBarcode>;

const normalizeBarcode = (value: string) => value.trim().replace(/\s+/g, "");

export const productsService = {
  getAllByTenant: (tenantId: string) => crud.getAllByTenant(tenantId),
  getById: (tenantId: string, id: string) => crud.getById(tenantId, id),
  create: (tenantId: string, input: CreateProductInput) => crud.create(tenantId, input),
  update: (tenantId: string, id: string, input: UpdateProductInput) => crud.update(tenantId, id, input),
  delete: (tenantId: string, id: string) => crud.delete(tenantId, id),
  getBarcodesByTenant: (tenantId: string) => barcodeCrud.getAllByTenant(tenantId),

  getByBarcode: async (tenantId: string, rawBarcode: string): Promise<Product | null> => {
    const barcode = normalizeBarcode(rawBarcode);
    if (!barcode) return null;

    if (dataProvider === "supabase") {
      const { data, error } = await supabase
        .from(dbTables.product_barcodes)
        .select("product_id, is_primary")
        .eq("tenant_id", tenantId)
        .eq("barcode", barcode);

      if (error) throw error;
      if (!data || data.length === 0) return null;

      const preferred = data.find((item) => item.is_primary) ?? data[0];
      return crud.getById(tenantId, preferred.product_id);
    }

    const allBarcodes = await barcodeCrud.getAllByTenant(tenantId);
    const matches = allBarcodes.filter((item) => normalizeBarcode(item.barcode) === barcode);
    if (!matches.length) return null;

    const preferred = matches.find((item) => item.is_primary) ?? matches[0];
    return crud.getById(tenantId, preferred.product_id);
  },

  getPrimaryBarcodesMapByTenant: async (tenantId: string): Promise<Record<string, string>> => {
    if (dataProvider === "supabase") {
      const { data, error } = await supabase
        .from(dbTables.product_barcodes)
        .select("product_id, barcode")
        .eq("tenant_id", tenantId)
        .eq("is_primary", true);

      if (error) throw error;
      const primaryMap: Record<string, string> = {};
      for (const item of data ?? []) {
        primaryMap[item.product_id] = item.barcode;
      }
      return primaryMap;
    }

    const allBarcodes = await barcodeCrud.getAllByTenant(tenantId);
    const primaryMap: Record<string, string> = {};

    for (const barcode of allBarcodes) {
      if (!barcode.is_primary) continue;
      primaryMap[barcode.product_id] = barcode.barcode;
    }

    return primaryMap;
  },

  setPrimaryBarcode: async (
    tenantId: string,
    productId: string,
    rawBarcode: string
  ): Promise<ProductBarcode | null> => {
    const barcode = normalizeBarcode(rawBarcode);

    if (dataProvider === "supabase") {
      if (!barcode) {
        const { data: primaryRows, error: fetchErr } = await supabase
          .from(dbTables.product_barcodes)
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("product_id", productId)
          .eq("is_primary", true);

        if (fetchErr) throw fetchErr;
        if (primaryRows?.length) {
          await Promise.all(primaryRows.map((row) => barcodeCrud.delete(tenantId, row.id)));
        }
        return null;
      }

      const { data: duplicateMatches, error: dupErr } = await supabase
        .from(dbTables.product_barcodes)
        .select("id, product_id")
        .eq("tenant_id", tenantId)
        .eq("barcode", barcode)
        .neq("product_id", productId)
        .limit(1);

      if (dupErr) throw dupErr;
      if (duplicateMatches && duplicateMatches.length > 0) {
        throw new Error("El codigo de barras ya esta asignado a otro producto");
      }

      const { data: currentProductBarcodesData, error: curErr } = await supabase
        .from(dbTables.product_barcodes)
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("product_id", productId);

      if (curErr) throw curErr;
      const currentProductBarcodes = (currentProductBarcodesData ?? []) as ProductBarcode[];

      const existing = currentProductBarcodes.find(
        (item) => normalizeBarcode(item.barcode) === barcode
      );

      await Promise.all(
        currentProductBarcodes
          .filter((item) => item.id !== existing?.id && item.is_primary)
          .map((item) => barcodeCrud.update(tenantId, item.id, { is_primary: false }))
      );

      if (existing) {
        const updated = await barcodeCrud.update(tenantId, existing.id, {
          barcode,
          is_primary: true,
        });
        return updated;
      }

      return barcodeCrud.create(tenantId, {
        product_id: productId,
        barcode,
        is_primary: true,
      } satisfies CreateProductBarcodeInput);
    }

    const allBarcodes = await barcodeCrud.getAllByTenant(tenantId);
    const currentProductBarcodes = allBarcodes.filter((item) => item.product_id === productId);

    if (!barcode) {
      const primaryRows = currentProductBarcodes.filter((item) => item.is_primary);
      await Promise.all(primaryRows.map((row) => barcodeCrud.delete(tenantId, row.id)));
      return null;
    }

    const duplicated = allBarcodes.find(
      (item) => item.product_id !== productId && normalizeBarcode(item.barcode) === barcode
    );

    if (duplicated) {
      throw new Error("El codigo de barras ya esta asignado a otro producto");
    }

    const existing = currentProductBarcodes.find(
      (item) => normalizeBarcode(item.barcode) === barcode
    );

    await Promise.all(
      currentProductBarcodes
        .filter((item) => item.id !== existing?.id && item.is_primary)
        .map((item) => barcodeCrud.update(tenantId, item.id, { is_primary: false }))
    );

    if (existing) {
      const updated = await barcodeCrud.update(tenantId, existing.id, {
        barcode,
        is_primary: true,
      });
      return updated;
    }

    return barcodeCrud.create(tenantId, {
      product_id: productId,
      barcode,
      is_primary: true,
    } satisfies CreateProductBarcodeInput);
  },
};
