import { useCallback, useEffect, useMemo, useState } from "react";
import { auditService } from "@/services/audit.service";
import { priceListsService } from "@/services/price-lists.service";
import { productsService } from "@/services/products.service";
import type { PriceList, PriceListItem, Product } from "@/types/entities";
import type { PriceListFormValues } from "@/modules/listas-precios/schemas/price-list-form.schema";

type FeedbackType = "success" | "error";

interface CrudFeedback {
  type: FeedbackType;
  message: string;
}

const normalizeText = (value?: string) => (value?.trim() ? value.trim() : null);
const normalizeCode = (code: string) => code.trim().toLowerCase().replace(/\s+/g, "_");

export const usePriceListsModule = (tenantId: string | null, userId: string | null) => {
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedPriceListId, setSelectedPriceListId] = useState<string | null>(null);
  const [priceListItems, setPriceListItems] = useState<PriceListItem[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<CrudFeedback | null>(null);

  const clearFeedback = () => setFeedback(null);

  const loadBaseData = useCallback(async () => {
    if (!tenantId) {
      setPriceLists([]);
      setProducts([]);
      setPriceListItems([]);
      setSelectedPriceListId(null);
      return;
    }

    setIsLoading(true);

    try {
      const [lists, allProducts] = await Promise.all([
        priceListsService.getAllByTenant(tenantId),
        productsService.getAllByTenant(tenantId),
      ]);

      const sortedLists = [...lists].sort((a, b) => a.name.localeCompare(b.name));
      setPriceLists(sortedLists);
      setProducts(allProducts.filter((product) => product.is_active));

      setSelectedPriceListId((current) => {
        if (current && sortedLists.some((list) => list.id === current)) {
          return current;
        }

        return sortedLists[0]?.id ?? null;
      });
    } catch {
      setFeedback({ type: "error", message: "No se pudieron cargar las listas de precios" });
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  const loadItems = useCallback(async () => {
    if (!tenantId || !selectedPriceListId) {
      setPriceListItems([]);
      return;
    }

    try {
      const items = await priceListsService.getItemsByPriceList(tenantId, selectedPriceListId);
      setPriceListItems(items);
    } catch {
      setFeedback({ type: "error", message: "No se pudieron cargar los items de la lista" });
    }
  }, [tenantId, selectedPriceListId]);

  useEffect(() => {
    void loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const createPriceList = async (values: PriceListFormValues) => {
    if (!tenantId) return;

    setIsSubmitting(true);

    try {
      const created = await priceListsService.create(tenantId, {
        name: values.name.trim(),
        code: normalizeCode(values.code),
        description: normalizeText(values.description),
        is_active: true,
        price_mode: values.priceMode,
        percentage_adjustment: values.priceMode === "percentage" ? Number(values.percentageAdjustment) : null,
      });
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "listas_precios",
        action: "create",
        entity_type: "price_list",
        entity_id: created.id,
        description: `Lista de precios creada: ${created.name}`,
        metadata: {
          code: created.code,
          price_mode: created.price_mode,
          percentage_adjustment: created.percentage_adjustment,
        },
      });

      setFeedback({ type: "success", message: "Lista de precios creada" });
      await loadBaseData();
    } catch {
      setFeedback({ type: "error", message: "No se pudo crear la lista de precios" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updatePriceList = async (id: string, values: PriceListFormValues) => {
    if (!tenantId) return;

    setIsSubmitting(true);

    try {
      const updated = await priceListsService.update(tenantId, id, {
        name: values.name.trim(),
        code: normalizeCode(values.code),
        description: normalizeText(values.description),
        price_mode: values.priceMode,
        percentage_adjustment: values.priceMode === "percentage" ? Number(values.percentageAdjustment) : null,
      });
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "listas_precios",
        action: "update",
        entity_type: "price_list",
        entity_id: updated?.id ?? id,
        description: `Lista de precios actualizada: ${values.name.trim()}`,
        metadata: {
          code: normalizeCode(values.code),
          price_mode: values.priceMode,
          percentage_adjustment:
            values.priceMode === "percentage" ? Number(values.percentageAdjustment) : null,
        },
      });

      setFeedback({ type: "success", message: "Lista de precios actualizada" });
      await loadBaseData();
      await loadItems();
    } catch {
      setFeedback({ type: "error", message: "No se pudo actualizar la lista de precios" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const deletePriceList = async (id: string) => {
    if (!tenantId) return;
    const target = priceLists.find((list) => list.id === id);

    setIsSubmitting(true);

    try {
      await priceListsService.delete(tenantId, id);
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "listas_precios",
        action: "delete",
        entity_type: "price_list",
        entity_id: id,
        description: `Lista de precios eliminada${target ? `: ${target.name}` : ""}`,
        metadata: target
          ? {
              code: target.code,
              price_mode: target.price_mode,
            }
          : null,
      });
      setFeedback({ type: "success", message: "Lista de precios eliminada" });
      await loadBaseData();
      await loadItems();
    } catch {
      setFeedback({ type: "error", message: "No se pudo eliminar la lista de precios" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePriceListActive = async (id: string) => {
    if (!tenantId) return;
    const target = priceLists.find((list) => list.id === id);

    setIsSubmitting(true);

    try {
      const updated = await priceListsService.toggleActive(tenantId, id);
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "listas_precios",
        action: "toggle_active",
        entity_type: "price_list",
        entity_id: updated?.id ?? id,
        description: `Lista de precios ${updated?.is_active ? "activada" : "desactivada"}${updated ? `: ${updated.name}` : ""}`,
        metadata: {
          previous_is_active: target?.is_active ?? null,
          next_is_active: updated?.is_active ?? null,
        },
      });
      setFeedback({ type: "success", message: "Estado de lista actualizado" });
      await loadBaseData();
    } catch {
      setFeedback({ type: "error", message: "No se pudo cambiar estado de la lista" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const setProductFixedPrice = async (productId: string, fixedPrice: number) => {
    if (!tenantId || !selectedPriceListId) return;

    setIsSubmitting(true);

    try {
      await priceListsService.setProductFixedPrice(tenantId, selectedPriceListId, productId, fixedPrice);
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "listas_precios",
        action: "set_fixed_price",
        entity_type: "price_list_item",
        entity_id: null,
        description: "Precio fijo configurado en lista de precios",
        metadata: {
          price_list_id: selectedPriceListId,
          product_id: productId,
          fixed_price: fixedPrice,
        },
      });
      setFeedback({ type: "success", message: "Precio fijo guardado" });
      await loadItems();
    } catch {
      setFeedback({ type: "error", message: "No se pudo guardar el precio fijo" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeProductFixedPrice = async (productId: string) => {
    if (!tenantId || !selectedPriceListId) return;

    setIsSubmitting(true);

    try {
      await priceListsService.removeProductFixedPrice(tenantId, selectedPriceListId, productId);
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "listas_precios",
        action: "remove_fixed_price",
        entity_type: "price_list_item",
        entity_id: null,
        description: "Precio fijo eliminado de lista de precios",
        metadata: {
          price_list_id: selectedPriceListId,
          product_id: productId,
        },
      });
      setFeedback({ type: "success", message: "Precio fijo eliminado" });
      await loadItems();
    } catch {
      setFeedback({ type: "error", message: "No se pudo eliminar el precio fijo" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPriceLists = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return priceLists;

    return priceLists.filter((priceList) =>
      [priceList.name, priceList.code, priceList.description ?? "", priceList.price_mode]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [priceLists, search]);

  const selectedPriceList = useMemo(
    () => priceLists.find((priceList) => priceList.id === selectedPriceListId) ?? null,
    [priceLists, selectedPriceListId]
  );

  const itemByProductId = useMemo(
    () => new Map(priceListItems.map((item) => [item.product_id, item])),
    [priceListItems]
  );

  return {
    priceLists: filteredPriceLists,
    allPriceLists: priceLists,
    products,
    selectedPriceList,
    selectedPriceListId,
    setSelectedPriceListId,
    itemByProductId,
    search,
    setSearch,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload: loadBaseData,
    createPriceList,
    updatePriceList,
    deletePriceList,
    togglePriceListActive,
    setProductFixedPrice,
    removeProductFixedPrice,
  };
};
