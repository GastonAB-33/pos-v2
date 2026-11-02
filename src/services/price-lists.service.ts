import { dbTables } from "@/lib/database/tables";
import { supabase } from "@/lib/supabase/client";
import { dataProvider } from "@/services/config/data-provider";
import {
  TenantCrudService,
  type CreateEntityInput,
  type UpdateEntityInput,
} from "@/services/base/tenant-crud.service";
import type { PriceList, PriceListItem } from "@/types/entities";

const priceListsCrud = new TenantCrudService<PriceList>(dbTables.price_lists);
const priceListItemsCrud = new TenantCrudService<PriceListItem>(dbTables.price_list_items);

export type CreatePriceListInput = CreateEntityInput<PriceList>;
export type UpdatePriceListInput = UpdateEntityInput<PriceList>;

const roundAmount = (value: number) => Number(value.toFixed(2));

export const priceListsService = {
  getAllByTenant: (tenantId: string) => priceListsCrud.getAllByTenant(tenantId),

  getActiveByTenant: async (tenantId: string) => {
    if (dataProvider === "supabase") {
      const { data, error } = await supabase
        .from(dbTables.price_lists)
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true);

      if (error) throw error;
      return (data ?? []) as PriceList[];
    }

    const all = await priceListsCrud.getAllByTenant(tenantId);
    return all.filter((priceList) => priceList.is_active);
  },

  getById: (tenantId: string, id: string) => priceListsCrud.getById(tenantId, id),
  create: (tenantId: string, input: CreatePriceListInput) => priceListsCrud.create(tenantId, input),
  update: (tenantId: string, id: string, input: UpdatePriceListInput) =>
    priceListsCrud.update(tenantId, id, input),
  delete: (tenantId: string, id: string) => priceListsCrud.delete(tenantId, id),

  toggleActive: async (tenantId: string, id: string) => {
    const priceList = await priceListsCrud.getById(tenantId, id);
    if (!priceList) return null;

    return priceListsCrud.update(tenantId, id, {
      is_active: !priceList.is_active,
    });
  },

  getItemsByPriceList: async (tenantId: string, priceListId: string) => {
    if (dataProvider === "supabase") {
      const { data, error } = await supabase
        .from(dbTables.price_list_items)
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("price_list_id", priceListId);

      if (error) throw error;
      return (data ?? []) as PriceListItem[];
    }

    const allItems = await priceListItemsCrud.getAllByTenant(tenantId);
    return allItems.filter((item) => item.price_list_id === priceListId);
  },

  setProductFixedPrice: async (
    tenantId: string,
    priceListId: string,
    productId: string,
    fixedPrice: number
  ) => {
    const normalized = roundAmount(Math.max(0, fixedPrice));

    if (dataProvider === "supabase") {
      const { data: existing, error } = await supabase
        .from(dbTables.price_list_items)
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("price_list_id", priceListId)
        .eq("product_id", productId)
        .maybeSingle();

      if (error) throw error;

      if (existing) {
        return priceListItemsCrud.update(tenantId, existing.id, {
          fixed_price: normalized,
        });
      }

      return priceListItemsCrud.create(tenantId, {
        price_list_id: priceListId,
        product_id: productId,
        fixed_price: normalized,
      });
    }

    const existingItems = await priceListsService.getItemsByPriceList(tenantId, priceListId);
    const existing = existingItems.find((item) => item.product_id === productId);

    if (existing) {
      return priceListItemsCrud.update(tenantId, existing.id, {
        fixed_price: normalized,
      });
    }

    return priceListItemsCrud.create(tenantId, {
      price_list_id: priceListId,
      product_id: productId,
      fixed_price: normalized,
    });
  },

  removeProductFixedPrice: async (tenantId: string, priceListId: string, productId: string) => {
    if (dataProvider === "supabase") {
      const { data: existing, error } = await supabase
        .from(dbTables.price_list_items)
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("price_list_id", priceListId)
        .eq("product_id", productId)
        .maybeSingle();

      if (error) throw error;
      if (!existing) return false;

      return priceListItemsCrud.delete(tenantId, existing.id);
    }

    const existingItems = await priceListsService.getItemsByPriceList(tenantId, priceListId);
    const existing = existingItems.find((item) => item.product_id === productId);

    if (!existing) return false;

    return priceListItemsCrud.delete(tenantId, existing.id);
  },

  resolveProductPrice: async (
    tenantId: string,
    priceListId: string,
    productId: string,
    basePrice: number
  ) => {
    const priceList = await priceListsCrud.getById(tenantId, priceListId);
    if (!priceList) return roundAmount(basePrice);

    if (priceList.price_mode === "percentage") {
      const adjustment = priceList.percentage_adjustment ?? 0;
      return roundAmount(basePrice * (1 + adjustment / 100));
    }

    if (dataProvider === "supabase") {
      const { data, error } = await supabase
        .from(dbTables.price_list_items)
        .select("fixed_price")
        .eq("tenant_id", tenantId)
        .eq("price_list_id", priceListId)
        .eq("product_id", productId)
        .maybeSingle();

      if (!error && data && typeof data.fixed_price === "number") {
        return roundAmount(data.fixed_price);
      }
      return roundAmount(basePrice);
    }

    const items = await priceListsService.getItemsByPriceList(tenantId, priceListId);
    const fixedItem = items.find((item) => item.product_id === productId);

    return roundAmount(fixedItem?.fixed_price ?? basePrice);
  },
};
