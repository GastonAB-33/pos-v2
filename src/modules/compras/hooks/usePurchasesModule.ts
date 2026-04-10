import { useCallback, useEffect, useMemo, useState } from "react";
import { auditService } from "@/services/audit.service";
import { productsService } from "@/services/products.service";
import { purchasesService } from "@/services/purchases.service";
import { stockService } from "@/services/stock.service";
import { suppliersService } from "@/services/suppliers.service";
import type { Product, Purchase, PurchaseItem, Supplier } from "@/types/entities";
import type { PurchaseCheckoutValues } from "@/modules/compras/schemas/purchase-checkout.schema";

interface PurchaseCartItem {
  product_id: string;
  name: string;
  quantity: number;
  unit_cost: number;
  stock_current: number;
}

type FeedbackType = "success" | "error";

interface PurchaseFeedback {
  type: FeedbackType;
  message: string;
}

const roundAmount = (value: number): number => Number(value.toFixed(2));
const roundQty = (value: number): number => Number(value.toFixed(3));

export const usePurchasesModule = (tenantId: string | null, userId: string | null) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<PurchaseCartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<PurchaseFeedback | null>(null);

  const clearFeedback = () => setFeedback(null);

  const loadData = useCallback(async () => {
    if (!tenantId) {
      setProducts([]);
      setSuppliers([]);
      setPurchases([]);
      setCart([]);
      return;
    }

    setIsLoading(true);
    try {
      const [allProducts, allSuppliers, allPurchases, allPurchaseItems] = await Promise.all([
        productsService.getAllByTenant(tenantId),
        suppliersService.getAllByTenant(tenantId),
        purchasesService.getAllByTenant(tenantId),
        purchasesService.getAllItemsByTenant(tenantId),
      ]);

      const purchaseItemsByPurchaseId = allPurchaseItems.reduce<Map<string, PurchaseItem[]>>(
        (acc, item) => {
          const list = acc.get(item.purchase_id) ?? [];
          list.push(item);
          acc.set(item.purchase_id, list);
          return acc;
        },
        new Map<string, PurchaseItem[]>()
      );

      setProducts(allProducts.filter((product) => product.is_active));
      setSuppliers(allSuppliers.filter((supplier) => supplier.is_active));
      setPurchases(
        allPurchases
          .map((purchase) => ({
            ...purchase,
            items: purchaseItemsByPurchaseId.get(purchase.id) ?? [],
          }))
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
      );
    } catch {
      setFeedback({ type: "error", message: "No se pudieron cargar datos de compras" });
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;

    return products.filter((product) =>
      [product.name, product.code, product.category, product.subcategory ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [products, search]);

  const addProductToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product_id === product.id
            ? {
                ...item,
                quantity: roundQty(item.quantity + 1),
                stock_current: product.stock_current,
              }
            : item
        );
      }

      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          quantity: 1,
          unit_cost: product.cost_price,
          stock_current: product.stock_current,
        },
      ];
    });
  };

  const setItemQuantity = (productId: string, quantity: number) => {
    const normalized = roundQty(quantity);
    if (!Number.isFinite(normalized) || normalized <= 0) {
      setFeedback({ type: "error", message: "La cantidad debe ser mayor a 0" });
      return;
    }

    setCart((prev) =>
      prev.map((item) => (item.product_id === productId ? { ...item, quantity: normalized } : item))
    );
  };

  const setItemUnitCost = (productId: string, unitCost: number) => {
    const normalized = roundAmount(unitCost);
    if (!Number.isFinite(normalized) || normalized < 0) {
      setFeedback({ type: "error", message: "El costo unitario no puede ser negativo" });
      return;
    }

    setCart((prev) =>
      prev.map((item) => (item.product_id === productId ? { ...item, unit_cost: normalized } : item))
    );
  };

  const removeItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product_id !== productId));
  };

  const clearCart = () => setCart([]);

  const summary = useMemo(() => {
    const total = roundAmount(cart.reduce((acc, item) => acc + item.quantity * item.unit_cost, 0));
    return { total };
  }, [cart]);

  const confirmPurchase = async (values: PurchaseCheckoutValues): Promise<Purchase | null> => {
    if (!tenantId) return null;

    if (!cart.length) {
      setFeedback({ type: "error", message: "No se puede registrar una compra sin items" });
      return null;
    }

    const hasInvalid = cart.some((item) => item.quantity <= 0 || item.unit_cost < 0);
    if (hasInvalid) {
      setFeedback({ type: "error", message: "Revisar cantidades y costos del carrito" });
      return null;
    }

    setIsSubmitting(true);
    try {
      const purchase = await purchasesService.create(tenantId, {
        supplier_id: values.supplierId,
        purchase_number: `CP-${Date.now()}`,
        status: "confirmed",
        subtotal: summary.total,
        total: summary.total,
        notes: values.notes?.trim() || null,
        created_by: userId,
        items: [],
        supplier: null,
      });

      for (const item of cart) {
        const lineTotal = roundAmount(item.quantity * item.unit_cost);

        await purchasesService.createItem(tenantId, {
          purchase_id: purchase.id,
          product_id: item.product_id,
          product_name_snapshot: item.name,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          line_total: lineTotal,
        });

        await stockService.create(tenantId, {
          product_id: item.product_id,
          movement_type: "purchase",
          quantity: item.quantity,
          reference_type: "purchase",
          reference_id: purchase.id,
          notes: `Compra ${purchase.purchase_number}`,
          created_by: userId,
        });

        await productsService.update(tenantId, item.product_id, {
          stock_current: roundQty(item.stock_current + item.quantity),
        });
      }
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "compras",
        action: "confirm_purchase",
        entity_type: "purchase",
        entity_id: purchase.id,
        description: `Compra confirmada: ${purchase.purchase_number}`,
        metadata: {
          supplier_id: purchase.supplier_id,
          item_count: cart.length,
          total: purchase.total,
        },
      });

      setFeedback({
        type: "success",
        message: `Compra ${purchase.purchase_number} registrada`,
      });
      clearCart();
      await loadData();
      return purchase;
    } catch {
      setFeedback({ type: "error", message: "No se pudo registrar la compra" });
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const suppliersById = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier])),
    [suppliers]
  );

  return {
    products: filteredProducts,
    suppliers,
    purchases,
    suppliersById,
    cart,
    summary,
    search,
    setSearch,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload: loadData,
    addProductToCart,
    setItemQuantity,
    setItemUnitCost,
    removeItem,
    clearCart,
    confirmPurchase,
  };
};
