import { dbTables } from "@/lib/database/tables";
import {
  TenantCrudService,
  type CreateEntityInput,
  type UpdateEntityInput,
} from "@/services/base/tenant-crud.service";
import type { Promotion } from "@/types/entities";

const crud = new TenantCrudService<Promotion>(dbTables.promotions);

export type CreatePromotionInput = CreateEntityInput<Promotion>;
export type UpdatePromotionInput = UpdateEntityInput<Promotion>;

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

  getActiveByTenant: async (tenantId: string) => {
    const all = await crud.getAllByTenant(tenantId);
    return all.filter((promotion) => promotion.is_active);
  },

  getById: (tenantId: string, id: string) => crud.getById(tenantId, id),
  create: (tenantId: string, input: CreatePromotionInput) =>
    crud.create(tenantId, { ...input, code: normalizeCode(input.code) }),
  update: (tenantId: string, id: string, input: UpdatePromotionInput) =>
    crud.update(tenantId, id, {
      ...input,
      code: typeof input.code === "string" ? normalizeCode(input.code) : input.code,
    }),
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
    promotions: Promotion[] = []
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
    let bestCartPromotion: Promotion | null = null;
    let cartDiscount = 0;

    const subtotalAfterProductPromotions = roundAmount(subtotalBefore - productDiscountTotal);

    for (const promotion of activeCartPromotions) {
      const discount = calculateCartPromotionDiscount(promotion, subtotalAfterProductPromotions);
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
