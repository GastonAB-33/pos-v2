import { dbTables } from "@/lib/database/tables";
import {
  TenantCrudService,
  type CreateEntityInput,
  type UpdateEntityInput,
} from "@/services/base/tenant-crud.service";
import type { Promotion, PromotionBarcode, PromotionItem } from "@/types/entities";

const crud = new TenantCrudService<Promotion>(dbTables.promotions);
const itemsCrud = new TenantCrudService<PromotionItem>(dbTables.promotion_items);
const barcodesCrud = new TenantCrudService<PromotionBarcode>(dbTables.promotion_barcodes);

export type CreatePromotionInput = CreateEntityInput<Promotion>;
export type UpdatePromotionInput = UpdateEntityInput<Promotion>;

export interface PromotionWithDetails extends Promotion {
  items?: PromotionItem[];
  barcodes?: PromotionBarcode[];
}

export interface SavePromotionDetailsInput {
  items?: Array<Pick<PromotionItem, "product_id" | "quantity">>;
  barcode?: string | null;
}

export interface PromotionResolverItem {
  product_id: string;
  quantity: number;
  unit_price: number;
}

export interface AppliedPromotionSnapshot {
  id: string;
  name: string;
  code: string;
  type: Promotion["type"];
  scope: Promotion["scope"];
}

export interface PromotionResolvedItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  line_subtotal: number;
  discount_total: number;
  line_total: number;
  applied_promotion: AppliedPromotionSnapshot | null;
}

export interface PromotionResolution {
  items: PromotionResolvedItem[];
  subtotal_before_promotions: number;
  product_discount_total: number;
  cart_discount_total: number;
  total_discount: number;
  subtotal_after_promotions: number;
  applied_cart_promotion: AppliedPromotionSnapshot | null;
}

const roundAmount = (value: number) => Number(value.toFixed(2));
const normalizeCode = (value: string) => value.trim().toLowerCase().replace(/\s+/g, "_");
const normalizeBarcode = (value: string) => value.trim().replace(/\s+/g, "");
export const buildPromotionBarcode = (code: string) =>
  `PROMO-${normalizeCode(code).replace(/_/g, "-").toUpperCase()}`;

const isMissingRelationError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string; message?: string };
  return maybeError.code === "42P01" || /does not exist/i.test(maybeError.message ?? "");
};

const safeGetItemsByTenant = async (tenantId: string): Promise<PromotionItem[]> => {
  try {
    return await itemsCrud.getAllByTenant(tenantId);
  } catch (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
};

const safeGetBarcodesByTenant = async (tenantId: string): Promise<PromotionBarcode[]> => {
  try {
    return await barcodesCrud.getAllByTenant(tenantId);
  } catch (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
};

const attachDetails = (
  promotions: Promotion[],
  items: PromotionItem[],
  barcodes: PromotionBarcode[]
): PromotionWithDetails[] =>
  promotions.map((promotion) => ({
    ...promotion,
    items: items.filter((item) => item.promotion_id === promotion.id),
    barcodes: barcodes.filter((barcode) => barcode.promotion_id === promotion.id),
  }));

const replacePromotionItems = async (
  tenantId: string,
  promotionId: string,
  items: SavePromotionDetailsInput["items"] = []
) => {
  const existingItems = (await safeGetItemsByTenant(tenantId)).filter(
    (item) => item.promotion_id === promotionId
  );
  await Promise.all(existingItems.map((item) => itemsCrud.delete(tenantId, item.id)));

  const validItems = items.filter((item) => item.product_id && item.quantity > 0);
  await Promise.all(
    validItems.map((item) =>
      itemsCrud.create(tenantId, {
        promotion_id: promotionId,
        product_id: item.product_id,
        quantity: item.quantity,
      })
    )
  );
};

const replacePromotionBarcode = async (
  tenantId: string,
  promotionId: string,
  rawBarcode: string | null | undefined
) => {
  const existingBarcodes = (await safeGetBarcodesByTenant(tenantId)).filter(
    (barcode) => barcode.promotion_id === promotionId
  );
  await Promise.all(existingBarcodes.map((barcode) => barcodesCrud.delete(tenantId, barcode.id)));

  const barcode = rawBarcode ? normalizeBarcode(rawBarcode) : "";
  if (!barcode) return;

  await barcodesCrud.create(tenantId, {
    promotion_id: promotionId,
    barcode,
    is_primary: true,
  });
};

const toDateValue = (value: string | Date): number => {
  if (value instanceof Date) return value.getTime();
  return new Date(value).getTime();
};

const isPromotionInRange = (promotion: Promotion, now: number) => {
  if (!promotion.is_active) return false;

  if (promotion.starts_at) {
    const startsAt = new Date(promotion.starts_at).getTime();
    if (!Number.isNaN(startsAt) && now < startsAt) return false;
  }

  if (promotion.ends_at) {
    const endsAt = new Date(promotion.ends_at).getTime();
    if (!Number.isNaN(endsAt) && now > endsAt) return false;
  }

  return true;
};

const toPromotionSnapshot = (promotion: Promotion): AppliedPromotionSnapshot => ({
  id: promotion.id,
  name: promotion.name,
  code: promotion.code,
  type: promotion.type,
  scope: promotion.scope,
});

const calculateProductPromotionDiscount = (
  promotion: Promotion,
  quantity: number,
  unitPrice: number
) => {
  const minQuantity = promotion.min_quantity ?? 1;
  if (quantity < minQuantity) return 0;

  if (promotion.type === "percentage_discount") {
    const percent = Math.max(0, promotion.discount_percent ?? 0);
    return roundAmount(quantity * unitPrice * (percent / 100));
  }

  if (promotion.type === "fixed_discount") {
    const fixedAmount = Math.max(0, promotion.discount_amount ?? 0);
    return roundAmount(quantity * Math.min(fixedAmount, unitPrice));
  }

  if (promotion.type === "combo_price") {
    const comboPrice = Math.max(0, promotion.combo_price ?? unitPrice);
    if (comboPrice >= unitPrice) return 0;

    const lineBase = roundAmount(quantity * unitPrice);
    const lineCombo = roundAmount(quantity * comboPrice);
    return roundAmount(Math.max(0, lineBase - lineCombo));
  }

  return 0;
};

const calculateCartPromotionDiscount = (promotion: Promotion, subtotal: number) => {
  if (promotion.type === "percentage_discount") {
    const percent = Math.max(0, promotion.discount_percent ?? 0);
    return roundAmount(subtotal * (percent / 100));
  }

  if (promotion.type === "fixed_discount") {
    const fixed = Math.max(0, promotion.discount_amount ?? 0);
    return roundAmount(Math.min(fixed, subtotal));
  }

  return 0;
};

export const promotionsService = {
  getAllByTenant: (tenantId: string) => crud.getAllByTenant(tenantId),

  getAllByTenantWithDetails: async (tenantId: string): Promise<PromotionWithDetails[]> => {
    const [promotions, items, barcodes] = await Promise.all([
      crud.getAllByTenant(tenantId),
      safeGetItemsByTenant(tenantId),
      safeGetBarcodesByTenant(tenantId),
    ]);
    return attachDetails(promotions, items, barcodes);
  },

  getActiveByTenant: async (tenantId: string) => {
    const all = await crud.getAllByTenant(tenantId);
    return all.filter((promotion) => promotion.is_active);
  },

  getActiveByTenantWithDetails: async (tenantId: string): Promise<PromotionWithDetails[]> => {
    const all = await promotionsService.getAllByTenantWithDetails(tenantId);
    return all.filter((promotion) => promotion.is_active);
  },

  getBarcodesByTenant: (tenantId: string) => safeGetBarcodesByTenant(tenantId),

  findActiveByBarcode: async (
    tenantId: string,
    rawBarcode: string
  ): Promise<PromotionWithDetails | null> => {
    const barcode = normalizeBarcode(rawBarcode).toLowerCase();
    if (!barcode) return null;

    const activePromotions = await promotionsService.getActiveByTenantWithDetails(tenantId);
    return (
      activePromotions.find((promotion) => {
        if (normalizeBarcode(promotion.code).toLowerCase() === barcode) return true;
        if (normalizeBarcode(buildPromotionBarcode(promotion.code)).toLowerCase() === barcode) {
          return true;
        }
        return (promotion.barcodes ?? []).some(
          (row) => normalizeBarcode(row.barcode).toLowerCase() === barcode
        );
      }) ?? null
    );
  },

  getById: (tenantId: string, id: string) => crud.getById(tenantId, id),
  create: (tenantId: string, input: CreatePromotionInput) =>
    crud.create(tenantId, { ...input, code: normalizeCode(input.code) }),
  createWithDetails: async (
    tenantId: string,
    input: CreatePromotionInput,
    details: SavePromotionDetailsInput = {}
  ) => {
    const created = await crud.create(tenantId, { ...input, code: normalizeCode(input.code) });
    await replacePromotionItems(tenantId, created.id, details.items);
    await replacePromotionBarcode(
      tenantId,
      created.id,
      details.barcode ?? buildPromotionBarcode(created.code)
    );
    return created;
  },
  update: (tenantId: string, id: string, input: UpdatePromotionInput) =>
    crud.update(tenantId, id, {
      ...input,
      code: typeof input.code === "string" ? normalizeCode(input.code) : input.code,
    }),
  updateWithDetails: async (
    tenantId: string,
    id: string,
    input: UpdatePromotionInput,
    details: SavePromotionDetailsInput = {}
  ) => {
    const updated = await crud.update(tenantId, id, {
      ...input,
      code: typeof input.code === "string" ? normalizeCode(input.code) : input.code,
    });
    await replacePromotionItems(tenantId, id, details.items);
    await replacePromotionBarcode(
      tenantId,
      id,
      details.barcode ?? buildPromotionBarcode(String(input.code ?? updated?.code ?? id))
    );
    return updated;
  },
  delete: (tenantId: string, id: string) => crud.delete(tenantId, id),

  toggleActive: async (tenantId: string, id: string) => {
    const promotion = await crud.getById(tenantId, id);
    if (!promotion) return null;

    return crud.update(tenantId, id, {
      is_active: !promotion.is_active,
    });
  },

  resolveApplicablePromotions: (
    cartItems: PromotionResolverItem[],
    now: string | Date,
    promotions: PromotionWithDetails[] = []
  ): PromotionResolution => {
    const nowValue = toDateValue(now);
    const activePromotions = promotions.filter((promotion) => isPromotionInRange(promotion, nowValue));

    const activeProductPromotions = activePromotions.filter(
      (promotion) => promotion.scope === "product" && promotion.product_id
    );
    const activeCartPromotions = activePromotions.filter(
      (promotion) =>
        promotion.scope === "cart" &&
        (promotion.type === "percentage_discount" || promotion.type === "fixed_discount")
    );
    const activeBundlePromotions = activePromotions.filter(
      (promotion) =>
        promotion.scope === "bundle" &&
        promotion.type === "combo_price" &&
        (promotion.items?.length ?? 0) > 0
    );

    const items = cartItems.map<PromotionResolvedItem>((item) => {
      const lineSubtotal = roundAmount(item.quantity * item.unit_price);
      const matches = activeProductPromotions.filter(
        (promotion) => promotion.product_id === item.product_id
      );

      let bestPromotion: Promotion | null = null;
      let bestDiscount = 0;

      for (const promotion of matches) {
        const discount = calculateProductPromotionDiscount(
          promotion,
          item.quantity,
          item.unit_price
        );

        if (discount > bestDiscount) {
          bestDiscount = discount;
          bestPromotion = promotion;
        }
      }

      const safeDiscount = roundAmount(Math.min(bestDiscount, lineSubtotal));
      return {
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_subtotal: lineSubtotal,
        discount_total: safeDiscount,
        line_total: roundAmount(lineSubtotal - safeDiscount),
        applied_promotion: bestPromotion ? toPromotionSnapshot(bestPromotion) : null,
      };
    });

    const subtotalBefore = roundAmount(items.reduce((acc, item) => acc + item.line_subtotal, 0));
    const productDiscountTotal = roundAmount(items.reduce((acc, item) => acc + item.discount_total, 0));
    let bestCartPromotion: PromotionWithDetails | null = null;
    let cartDiscount = 0;

    const subtotalAfterProductPromotions = roundAmount(subtotalBefore - productDiscountTotal);

    for (const promotion of activeCartPromotions) {
      const discount = calculateCartPromotionDiscount(promotion, subtotalAfterProductPromotions);
      if (discount > cartDiscount) {
        cartDiscount = discount;
        bestCartPromotion = promotion;
      }
    }

    for (const promotion of activeBundlePromotions) {
      const bundleItems = promotion.items ?? [];
      const bundleCount = Math.min(
        ...bundleItems.map((bundleItem) => {
          const cartItem = cartItems.find((item) => item.product_id === bundleItem.product_id);
          if (!cartItem || bundleItem.quantity <= 0) return 0;
          return Math.floor(cartItem.quantity / bundleItem.quantity);
        })
      );

      if (!Number.isFinite(bundleCount) || bundleCount <= 0) continue;

      const bundleBaseTotal = bundleItems.reduce((acc, bundleItem) => {
        const cartItem = cartItems.find((item) => item.product_id === bundleItem.product_id);
        return acc + (cartItem?.unit_price ?? 0) * bundleItem.quantity * bundleCount;
      }, 0);
      const bundleComboTotal = Math.max(0, promotion.combo_price ?? bundleBaseTotal) * bundleCount;
      const discount = roundAmount(Math.max(0, bundleBaseTotal - bundleComboTotal));

      if (discount > cartDiscount) {
        cartDiscount = discount;
        bestCartPromotion = promotion;
      }
    }

    const safeCartDiscount = roundAmount(Math.min(cartDiscount, subtotalAfterProductPromotions));
    const totalDiscount = roundAmount(productDiscountTotal + safeCartDiscount);
    const subtotalAfterPromotions = roundAmount(subtotalBefore - totalDiscount);

    return {
      items,
      subtotal_before_promotions: subtotalBefore,
      product_discount_total: productDiscountTotal,
      cart_discount_total: safeCartDiscount,
      total_discount: totalDiscount,
      subtotal_after_promotions: subtotalAfterPromotions,
      applied_cart_promotion: bestCartPromotion ? toPromotionSnapshot(bestCartPromotion) : null,
    };
  },
};
