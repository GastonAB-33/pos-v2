import { useCallback, useEffect, useMemo, useState } from "react";
import { auditService } from "@/services/audit.service";
import { productsService } from "@/services/products.service";
import { promotionsService } from "@/services/promotions.service";
import type { Product, Promotion } from "@/types/entities";
import type { PromotionFormValues } from "@/modules/promociones/schemas/promotion-form.schema";

type FeedbackType = "success" | "error";

interface CrudFeedback {
  type: FeedbackType;
  message: string;
}

const normalizeText = (value?: string) => (value?.trim() ? value.trim() : null);
const normalizeCode = (value: string) => value.trim().toLowerCase().replace(/\s+/g, "_");
const normalizeOptionalNumber = (value: number | "" | undefined) =>
  value === "" || value === undefined ? null : Number(value);

const toIsoOrNull = (value?: string) => {
  if (!value?.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const toServiceInput = (values: PromotionFormValues, options?: { isActive?: boolean }) => ({
  name: values.name.trim(),
  code: normalizeCode(values.code),
  description: normalizeText(values.description),
  type: values.type,
  scope: values.scope,
  product_id: values.scope === "product" ? normalizeText(values.productId) : null,
  min_quantity: normalizeOptionalNumber(values.minQuantity),
  discount_percent:
    values.type === "percentage_discount" ? normalizeOptionalNumber(values.discountPercent) : null,
  discount_amount:
    values.type === "fixed_discount" ? normalizeOptionalNumber(values.discountAmount) : null,
  combo_price: values.type === "combo_price" ? normalizeOptionalNumber(values.comboPrice) : null,
  starts_at: toIsoOrNull(values.startsAt),
  ends_at: toIsoOrNull(values.endsAt),
  is_active: options?.isActive ?? true,
});

export const usePromotionsCrud = (tenantId: string | null, userId: string | null) => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<CrudFeedback | null>(null);

  const clearFeedback = () => setFeedback(null);

  const loadData = useCallback(async () => {
    if (!tenantId) {
      setPromotions([]);
      setProducts([]);
      return;
    }

    setIsLoading(true);
    try {
      const [allPromotions, allProducts] = await Promise.all([
        promotionsService.getAllByTenant(tenantId),
        productsService.getAllByTenant(tenantId),
      ]);

      setPromotions(allPromotions);
      setProducts(allProducts.filter((product) => product.is_active));
    } catch {
      setFeedback({ type: "error", message: "No se pudieron cargar las promociones" });
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const createPromotion = async (values: PromotionFormValues) => {
    if (!tenantId) return;

    setIsSubmitting(true);
    try {
      const created = await promotionsService.create(tenantId, toServiceInput(values));
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "promociones",
        action: "create",
        entity_type: "promotion",
        entity_id: created.id,
        description: `Promocion creada: ${created.name}`,
        metadata: {
          code: created.code,
          type: created.type,
          scope: created.scope,
          product_id: created.product_id,
          is_active: created.is_active,
        },
      });
      setFeedback({ type: "success", message: "Promocion creada" });
      await loadData();
    } catch {
      setFeedback({ type: "error", message: "No se pudo crear la promocion" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updatePromotion = async (id: string, values: PromotionFormValues) => {
    if (!tenantId) return;

    const existing = promotions.find((promotion) => promotion.id === id);
    if (!existing) return;

    setIsSubmitting(true);
    try {
      const updated = await promotionsService.update(
        tenantId,
        id,
        toServiceInput(values, { isActive: existing.is_active })
      );
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "promociones",
        action: "update",
        entity_type: "promotion",
        entity_id: updated?.id ?? id,
        description: `Promocion actualizada: ${values.name.trim()}`,
        metadata: {
          code: normalizeCode(values.code),
          type: values.type,
          scope: values.scope,
          product_id: values.scope === "product" ? normalizeText(values.productId) : null,
        },
      });
      setFeedback({ type: "success", message: "Promocion actualizada" });
      await loadData();
    } catch {
      setFeedback({ type: "error", message: "No se pudo actualizar la promocion" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const deletePromotion = async (id: string) => {
    if (!tenantId) return;
    const target = promotions.find((promotion) => promotion.id === id);

    setIsSubmitting(true);
    try {
      await promotionsService.delete(tenantId, id);
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "promociones",
        action: "delete",
        entity_type: "promotion",
        entity_id: id,
        description: `Promocion eliminada${target ? `: ${target.name}` : ""}`,
        metadata: target
          ? {
              code: target.code,
              type: target.type,
              scope: target.scope,
            }
          : null,
      });
      setFeedback({ type: "success", message: "Promocion eliminada" });
      await loadData();
    } catch {
      setFeedback({ type: "error", message: "No se pudo eliminar la promocion" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePromotionActive = async (id: string) => {
    if (!tenantId) return;
    const target = promotions.find((promotion) => promotion.id === id);

    setIsSubmitting(true);
    try {
      const updated = await promotionsService.toggleActive(tenantId, id);
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "promociones",
        action: "toggle_active",
        entity_type: "promotion",
        entity_id: updated?.id ?? id,
        description: `Promocion ${updated?.is_active ? "activada" : "desactivada"}${updated ? `: ${updated.name}` : ""}`,
        metadata: {
          previous_is_active: target?.is_active ?? null,
          next_is_active: updated?.is_active ?? null,
        },
      });
      setFeedback({ type: "success", message: "Estado de promocion actualizado" });
      await loadData();
    } catch {
      setFeedback({ type: "error", message: "No se pudo actualizar el estado" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPromotions = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = [...promotions].sort((a, b) => a.name.localeCompare(b.name));

    if (!term) return base;

    return base.filter((promotion) =>
      [
        promotion.name,
        promotion.code,
        promotion.type,
        promotion.scope,
        promotion.description ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [promotions, search]);

  return {
    promotions: filteredPromotions,
    products,
    search,
    setSearch,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload: loadData,
    createPromotion,
    updatePromotion,
    deletePromotion,
    togglePromotionActive,
  };
};
