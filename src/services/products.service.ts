import { dbTables } from "@/lib/database/tables";
import { supabase } from "@/lib/supabase/client";
import {
  TenantCrudService,
  type CreateEntityInput,
  type UpdateEntityInput,
} from "@/services/base/tenant-crud.service";
import { isMockDataProvider } from "@/services/config/data-provider";
import type { Product, ProductBarcode } from "@/types/entities";

const crud = new TenantCrudService<Product>(dbTables.products);
const barcodeCrud = new TenantCrudService<ProductBarcode>(dbTables.product_barcodes);

export type CreateProductInput = CreateEntityInput<Product>;
export type UpdateProductInput = UpdateEntityInput<Product>;
export type CreateProductBarcodeInput = CreateEntityInput<ProductBarcode>;

const normalizeBarcode = (value: string) => value.trim().replace(/\s+/g, "");
const productImagesBucket =
  (import.meta.env.VITE_SUPABASE_PRODUCT_IMAGES_BUCKET as string | undefined)?.trim() ||
  "product-images";

const fileToDataUrl = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("No se pudo leer la imagen seleccionada"));
    };
    reader.onerror = () => reject(new Error("No se pudo leer la imagen seleccionada"));
    reader.readAsDataURL(file);
  });
};

const extractStoragePathFromPublicUrl = (publicUrl: string): string | null => {
  const marker = `/storage/v1/object/public/${productImagesBucket}/`;
  const markerIndex = publicUrl.indexOf(marker);
  if (markerIndex < 0) return null;

  const pathWithParams = publicUrl.slice(markerIndex + marker.length);
  const [path] = pathWithParams.split("?");
  return decodeURIComponent(path ?? "");
};

export const productsService = {
  getAllByTenant: (tenantId: string) => crud.getAllByTenant(tenantId),
  getById: (tenantId: string, id: string) => crud.getById(tenantId, id),
  create: (tenantId: string, input: CreateProductInput) => crud.create(tenantId, input),
  update: (tenantId: string, id: string, input: UpdateProductInput) => crud.update(tenantId, id, input),
  updateStock: async (tenantId: string, id: string, stockCurrent: number) =>
    crud.update(tenantId, id, {
      stock_current: stockCurrent,
      stock: stockCurrent,
    } as UpdateProductInput & { stock: number }),
  delete: (tenantId: string, id: string) => crud.delete(tenantId, id),
  getBarcodesByTenant: (tenantId: string) => barcodeCrud.getAllByTenant(tenantId),

  getByBarcode: async (tenantId: string, rawBarcode: string): Promise<Product | null> => {
    const barcode = normalizeBarcode(rawBarcode);
    if (!barcode) return null;

    const allBarcodes = await barcodeCrud.getAllByTenant(tenantId);
    const matches = allBarcodes.filter((item) => normalizeBarcode(item.barcode) === barcode);
    if (!matches.length) return null;

    const preferred = matches.find((item) => item.is_primary) ?? matches[0];
    return crud.getById(tenantId, preferred.product_id);
  },

  getPrimaryBarcodesMapByTenant: async (tenantId: string): Promise<Record<string, string>> => {
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

  uploadProductImage: async (tenantId: string, productId: string, file: File): Promise<string> => {
    if (isMockDataProvider) {
      return fileToDataUrl(file);
    }

    const normalizedExt = (file.name.split(".").pop() ?? "jpg").toLowerCase();
    const extension = ["jpg", "jpeg", "png", "webp"].includes(normalizedExt) ? normalizedExt : "jpg";
    const path = `${tenantId}/${productId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${extension}`;

    const { error } = await supabase.storage.from(productImagesBucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/jpeg",
    });

    if (error) {
      throw new Error(`No se pudo subir la imagen: ${error.message}`);
    }

    const { data } = supabase.storage.from(productImagesBucket).getPublicUrl(path);
    return data.publicUrl;
  },

  deleteProductImageByUrl: async (publicUrl: string | null | undefined): Promise<void> => {
    if (!publicUrl || isMockDataProvider) return;

    const path = extractStoragePathFromPublicUrl(publicUrl);
    if (!path) return;

    const { error } = await supabase.storage.from(productImagesBucket).remove([path]);
    if (error) {
      throw new Error(`No se pudo eliminar la imagen anterior: ${error.message}`);
    }
  },
};
