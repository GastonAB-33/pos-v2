import { useCallback, useEffect, useMemo, useState } from "react";
import { auditService } from "@/services/audit.service";
import { cashService } from "@/services/cash.service";
import { productsService } from "@/services/products.service";
import { purchasesService } from "@/services/purchases.service";
import { stockService } from "@/services/stock.service";
import { suppliersService } from "@/services/suppliers.service";
import type { Product, ProductBarcode, Purchase, PurchaseItem, Supplier } from "@/types/entities";
import type { ProductFormModalValues } from "@/modules/productos/types/product.types";
import type { PurchaseCheckoutValues } from "@/modules/compras/schemas/purchase-checkout.schema";
import type { SupplierFormValues } from "@/modules/proveedores/schemas/supplier-form.schema";
import { toSupplierServiceInput } from "@/modules/proveedores/utils/supplier-input";

interface PurchaseCartItem {
  product_id: string;
  name: string;
  sale_mode: Product["sale_mode"];
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
const normalizeText = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const normalizeBarcode = (value: string | null | undefined): string =>
  (value ?? "").replace(/\s+/g, "").trim();

const similarityScore = (left: string, right: string): number => {
  const leftTokens = new Set(normalizeText(left).split(" ").filter(Boolean));
  const rightTokens = new Set(normalizeText(right).split(" ").filter(Boolean));
  if (!leftTokens.size || !rightTokens.size) return 0;

  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union > 0 ? intersection / union : 0;
};

const toProductCreateInput = (values: ProductFormModalValues) => ({
  code: values.codigoProducto || `PRD-${Date.now().toString().slice(-6)}`,
  name: values.nombre,
  image_url: values.imagenUrl?.trim() || null,
  brand: null,
  supplier: null,
  is_favorite: values.favorito,
  description: null,
  price: roundAmount(values.precioFinal),
  cost_price: roundAmount(values.precioCosto),
  stock_current: roundQty(values.stock),
  stock_min: null,
  stock_max: null,
  category: values.categoria || "General",
  subcategory: values.subcategoria?.trim() || null,
  sale_mode: values.saleMode,
  currency_code: "ARS",
  price_without_vat: roundAmount(values.precioSinIva),
  vat_percent: roundAmount(values.porcentajeIva),
  profit_percent: roundAmount(values.porcentajeGanancia),
  is_active: values.estadoActivo,
});

export const usePurchasesModule = (tenantId: string | null, userId: string | null) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [productBarcodes, setProductBarcodes] = useState<ProductBarcode[]>([]);
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
      const [allProducts, allProductBarcodes, allSuppliers, allPurchases, allPurchaseItems] = await Promise.all([
        productsService.getAllByTenant(tenantId),
        productsService.getBarcodesByTenant(tenantId),
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

      setProducts(allProducts);
      setProductBarcodes(allProductBarcodes);
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
    const activeProducts = products.filter((product) => product.is_active);
    if (!term) return activeProducts;

    return activeProducts.filter((product) =>
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
                sale_mode: product.sale_mode,
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
          sale_mode: product.sale_mode,
          quantity: 1,
          unit_cost: product.cost_price,
          stock_current: product.stock_current,
        },
      ];
    });
  };

  const setItemQuantity = (productId: string, quantity: number) => {
    const normalized = roundQty(quantity);
    if (!Number.isFinite(normalized)) return;

    setCart((prev) =>
      prev.map((item) => (item.product_id === productId ? { ...item, quantity: normalized } : item))
    );
  };

  const setItemUnitCost = (productId: string, unitCost: number) => {
    const normalized = roundAmount(unitCost);
    if (!Number.isFinite(normalized)) return;

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
      const openCashSession =
        userId != null
          ? (await cashService.getOpenSessionByUser(tenantId, userId)) ??
            (await cashService.getOpenSession(tenantId))
          : await cashService.getOpenSession(tenantId);

      if (!openCashSession) {
        setFeedback({
          type: "error",
          message: "Debes tener una caja abierta para registrar el pago al proveedor",
        });
        return null;
      }

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

        const currentProduct = await productsService.getById(tenantId, item.product_id);
        const currentStock = currentProduct?.stock_current ?? item.stock_current;
        await productsService.updateStock(
          tenantId,
          item.product_id,
          roundQty(currentStock + item.quantity)
        );
      }

      const cashMovement = await cashService.createMovement(tenantId, {
        cash_session_id: openCashSession.id,
        movement_type: "expense",
        amount: summary.total,
        currency_code: "ARS",
        reference_type: "purchase_payment",
        reference_id: purchase.id,
        notes: `Pago a proveedor - ${purchase.purchase_number}`,
        created_by: userId,
      });

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
          cash_session_id: openCashSession.id,
          cash_movement_id: cashMovement.id,
        },
      });

      setFeedback({
        type: "success",
        message: `Compra ${purchase.purchase_number} registrada y pagada en caja`,
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

  const categoryOptions = useMemo(
    () => [...new Set(products.map((product) => product.category).filter(Boolean))].sort(),
    [products]
  );

  const subcategoryOptions = useMemo(
    () => [...new Set(products.map((product) => product.subcategory).filter(Boolean) as string[])].sort(),
    [products]
  );

  const findPotentialDuplicateProducts = (values: ProductFormModalValues): Product[] => {
    const barcode = normalizeBarcode(values.codigoBarras);
    const byId = new Map(products.map((product) => [product.id, product]));

    if (barcode) {
      const barcodeMatch = productBarcodes.find((row) => normalizeBarcode(row.barcode) === barcode);
      const product = barcodeMatch ? byId.get(barcodeMatch.product_id) : null;
      if (product) return [product];
    }

    const normalizedName = normalizeText(values.nombre);
    if (!normalizedName) return [];

    return products
      .map((product) => ({
        product,
        score:
          normalizeText(product.name).includes(normalizedName) ||
          normalizedName.includes(normalizeText(product.name))
            ? 1
            : similarityScore(values.nombre, product.name),
      }))
      .filter((item) => item.score >= 0.45)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((item) => item.product);
  };

  const createProductAndAddToCart = async (values: ProductFormModalValues): Promise<Product | null> => {
    if (!tenantId) return null;

    setIsSubmitting(true);
    try {
      let created = await productsService.create(tenantId, toProductCreateInput(values));

      if (values.imagenFile) {
        const imageUrl = await productsService.uploadProductImage(tenantId, created.id, values.imagenFile);
        created = await productsService.update(tenantId, created.id, { image_url: imageUrl }) ?? {
          ...created,
          image_url: imageUrl,
        };
      }

      await productsService.setPrimaryBarcode(tenantId, created.id, values.codigoBarras ?? "");

      setProducts((current) => [created, ...current.filter((product) => product.id !== created.id)]);
      if (values.codigoBarras?.trim()) {
        const refreshedBarcodes = await productsService.getBarcodesByTenant(tenantId);
        setProductBarcodes(refreshedBarcodes);
      }
      addProductToCart(created);

      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "compras",
        action: "create_product_from_purchase",
        entity_type: "product",
        entity_id: created.id,
        description: `Producto creado desde compras: ${created.name}`,
        metadata: {
          code: created.code,
          barcode: normalizeBarcode(values.codigoBarras),
          sale_mode: created.sale_mode,
        },
      });

      setFeedback({ type: "success", message: "Producto creado y agregado a la compra" });
      return created;
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : "No se pudo crear el producto";
      setFeedback({ type: "error", message });
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const createSupplier = async (values: SupplierFormValues): Promise<Supplier | null> => {
    if (!tenantId) return null;

    setIsSubmitting(true);
    try {
      const created = await suppliersService.create(tenantId, toSupplierServiceInput(values));
      setSuppliers((current) =>
        [created, ...current.filter((supplier) => supplier.id !== created.id)].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
      setFeedback({ type: "success", message: `Proveedor ${created.name} creado` });
      return created;
    } catch {
      setFeedback({ type: "error", message: "No se pudo crear el proveedor" });
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    products: filteredProducts,
    allProducts: products,
    categoryOptions,
    subcategoryOptions,
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
    findPotentialDuplicateProducts,
    createProductAndAddToCart,
    createSupplier,
  };
};
