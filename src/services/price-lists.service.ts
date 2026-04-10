import { dbTables } from "@/lib/database/tables";
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

    const items = await priceListsService.getItemsByPriceList(tenantId, priceListId);
    const fixedItem = items.find((item) => item.product_id === productId);

    return roundAmount(fixedItem?.fixed_price ?? basePrice);
  },
};
