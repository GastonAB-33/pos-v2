import { useCallback, useEffect, useMemo, useState } from "react";
import { auditService } from "@/services/audit.service";
import { cashService } from "@/services/cash.service";
import { productsService } from "@/services/products.service";
import { useProductsStore } from "@/features/products/store/products.store";
import { purchasesService } from "@/services/purchases.service";
import { stockService } from "@/services/stock.service";
import { suppliersService } from "@/services/suppliers.service";
import type { Product, ProductBarcode, Purchase, PurchaseItem, Supplier } from "@/types/entities";
import type { ProductFormModalValues } from "@/modules/productos/types/product.types";
import type { PurchaseCheckoutValues } from "@/modules/compras/schemas/purchase-checkout.schema";
import type { SupplierFormValues } from "@/modules/proveedores/schemas/supplier-form.schema";
import type { PurchaseReturnPayload } from "@/modules/compras/components/PurchaseReturnModal";
import type { PurchaseCartItemView, PurchaseSummary } from "@/modules/compras/components/PurchaseCart";
import { toSupplierServiceInput } from "@/modules/proveedores/utils/supplier-input";

type FeedbackType = "success" | "error";

interface PurchaseFeedback {
  type: FeedbackType;
  message: string;
}

const roundAmount = (value: number): number => Number(value.toFixed(2));
const roundQty = (value: number): number => Number(value.toFixed(3));
const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});
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
  const [cart, setCart] = useState<PurchaseCartItemView[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<PurchaseFeedback | null>(null);

  const clearFeedback = () => setFeedback(null);

  const loadData = useCallback(async () => {
    if (!tenantId) {
      setProducts([]);
      setProductBarcodes([]);
      setSuppliers([]);
      setPurchases([]);
      setCart([]);
      return;
    }

    const cachedStore = useProductsStore.getState();
    if (cachedStore.loadedTenantId === tenantId && cachedStore.products.length > 0) {
      setProducts(cachedStore.products);
      setProductBarcodes(cachedStore.allBarcodes);
    } else {
      setIsLoading(true);
    }

    try {
      const [allProducts, allProductBarcodes, allSuppliers, allPurchases, allPurchaseItems] =
        await Promise.all([
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
          vat_percent: product.vat_percent ?? 21,
          bonified_quantity: 0,
          stock_current: product.stock_current,
        },
      ];
    });
  };

  const setItemQuantity = (productId: string, quantity: number) => {
    const normalized = roundQty(quantity);
    if (!Number.isFinite(normalized) || normalized < 0) return;

    setCart((prev) =>
      prev.map((item) => (item.product_id === productId ? { ...item, quantity: normalized } : item))
    );
  };

  const setItemUnitCost = (productId: string, unitCost: number) => {
    const normalized = roundAmount(unitCost);
    if (!Number.isFinite(normalized) || normalized < 0) return;

    setCart((prev) =>
      prev.map((item) => (item.product_id === productId ? { ...item, unit_cost: normalized } : item))
    );
  };

  const setItemVatPercent = (productId: string, vatPercent: number) => {
    const normalized = Number(vatPercent);
    if (!Number.isFinite(normalized) || normalized < 0) return;

    setCart((prev) =>
      prev.map((item) =>
        item.product_id === productId ? { ...item, vat_percent: normalized } : item
      )
    );
  };

  const setItemBonifiedQuantity = (productId: string, bonifiedQty: number) => {
    const normalized = roundQty(bonifiedQty);
    if (!Number.isFinite(normalized) || normalized < 0) return;

    setCart((prev) =>
      prev.map((item) =>
        item.product_id === productId ? { ...item, bonified_quantity: normalized } : item
      )
    );
  };

  const removeItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product_id !== productId));
  };

  const clearCart = () => setCart([]);

  const summary: PurchaseSummary = useMemo(() => {
    let subtotal = 0;
    let vatTotal = 0;
    let totalUnits = 0;

    for (const item of cart) {
      const lineNet = item.quantity * item.unit_cost;
      const lineVat = lineNet * ((item.vat_percent || 0) / 100);
      subtotal += lineNet;
      vatTotal += lineVat;
      totalUnits += item.quantity + (item.bonified_quantity || 0);
    }

    subtotal = roundAmount(subtotal);
    vatTotal = roundAmount(vatTotal);
    const total = roundAmount(subtotal + vatTotal);
    totalUnits = roundQty(totalUnits);

    return { subtotal, vatTotal, total, totalUnits };
  }, [cart]);

  const confirmPurchase = async (values: PurchaseCheckoutValues): Promise<Purchase | null> => {
    if (!tenantId) return null;

    if (!cart.length) {
      setFeedback({ type: "error", message: "No se puede registrar una compra sin ítems" });
      return null;
    }

    const hasInvalid = cart.some(
      (item) => (item.quantity <= 0 && (item.bonified_quantity || 0) <= 0) || item.unit_cost < 0
    );
    if (hasInvalid) {
      setFeedback({ type: "error", message: "Revisar cantidades y costos del carrito" });
      return null;
    }

    setIsSubmitting(true);
    try {
      const affectsCash = values.paymentMethod === "cash";
      let openCashSession = null;

      if (affectsCash) {
        openCashSession =
          userId != null
            ? (await cashService.getOpenSessionByUser(tenantId, userId)) ??
              (await cashService.getOpenSession(tenantId))
            : await cashService.getOpenSession(tenantId);

        if (!openCashSession) {
          setFeedback({
            type: "error",
            message: "Debes tener una caja abierta para registrar el pago en efectivo al proveedor",
          });
          return null;
        }
      }

      const purchase = await purchasesService.create(tenantId, {
        supplier_id: values.supplierId,
        purchase_number: `CP-${Date.now()}`,
        document_type: values.documentType,
        document_number: values.documentNumber?.trim() || null,
        issue_date: values.issueDate,
        payment_method: values.paymentMethod,
        status: "confirmed",
        subtotal: summary.subtotal,
        vat_total: summary.vatTotal,
        total: summary.total,
        notes: values.notes?.trim() || null,
        created_by: userId,
        items: [],
        supplier: null,
      });

      for (const item of cart) {
        const lineNet = roundAmount(item.quantity * item.unit_cost);
        const vatAmount = roundAmount(lineNet * ((item.vat_percent || 0) / 100));
        const lineTotal = roundAmount(lineNet + vatAmount);
        const totalIncomingQty = roundQty(item.quantity + (item.bonified_quantity || 0));

        await purchasesService.createItem(tenantId, {
          purchase_id: purchase.id,
          product_id: item.product_id,
          product_name_snapshot: item.name,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          vat_percent: item.vat_percent,
          vat_amount: vatAmount,
          bonified_quantity: item.bonified_quantity || 0,
          line_total: lineTotal,
        });

        await stockService.create(tenantId, {
          product_id: item.product_id,
          movement_type: "purchase",
          quantity: totalIncomingQty,
          reference_type: "purchase",
          reference_id: purchase.id,
          notes: `Compra ${purchase.purchase_number}${
            item.bonified_quantity ? ` (inc. ${item.bonified_quantity} bonif.)` : ""
          }`,
          created_by: userId,
        });

        const currentProduct = await productsService.getById(tenantId, item.product_id);
        const currentStock = currentProduct?.stock_current ?? item.stock_current;
        const newStock = roundQty(currentStock + totalIncomingQty);

        await productsService.update(tenantId, item.product_id, {
          stock_current: newStock,
          cost_price: item.unit_cost > 0 ? item.unit_cost : currentProduct?.cost_price,
          vat_percent: item.vat_percent,
        });
      }

      let cashMovementId: string | null = null;
      if (affectsCash && openCashSession && summary.total > 0) {
        const cashMovement = await cashService.createMovement(tenantId, {
          cash_session_id: openCashSession.id,
          movement_type: "expense",
          amount: summary.total,
          currency_code: "ARS",
          reference_type: "purchase_payment",
          reference_id: purchase.id,
          notes: `Pago compra ${purchase.purchase_number} - ${values.documentType} ${
            values.documentNumber || ""
          }`.trim(),
          created_by: userId,
        });
        cashMovementId = cashMovement.id;
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
          document_type: values.documentType,
          document_number: values.documentNumber,
          item_count: cart.length,
          total: purchase.total,
          vat_total: summary.vatTotal,
          total_units: summary.totalUnits,
          payment_method: values.paymentMethod,
          cash_session_id: openCashSession?.id ?? null,
          cash_movement_id: cashMovementId,
        },
      });

      setFeedback({
        type: "success",
        message: `Compra ${purchase.purchase_number} registrada correctamente${
          affectsCash ? " y debitada de la caja diaria" : ""
        }`,
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

  const createPurchaseReturn = async (payload: PurchaseReturnPayload): Promise<boolean> => {
    if (!tenantId) return false;

    const purchase = purchases.find((p) => p.id === payload.purchaseId);
    if (!purchase) {
      setFeedback({ type: "error", message: "Compra no encontrada" });
      return false;
    }

    setIsSubmitting(true);
    try {
      let openCashSession = null;
      if (payload.refundToCash && payload.totalRefund > 0) {
        openCashSession =
          userId != null
            ? (await cashService.getOpenSessionByUser(tenantId, userId)) ??
              (await cashService.getOpenSession(tenantId))
            : await cashService.getOpenSession(tenantId);

        if (!openCashSession) {
          setFeedback({
            type: "error",
            message: "Debes tener una caja abierta para registrar el reintegro de dinero",
          });
          return false;
        }
      }

      const purchaseItems = await purchasesService.getItemsByPurchaseId(tenantId, purchase.id);

      for (const returnedItem of payload.items) {
        const itemRecord = purchaseItems.find((i) => i.product_id === returnedItem.productId);
        if (itemRecord) {
          const updatedReturnedQty = roundQty(
            (itemRecord.returned_quantity || 0) + returnedItem.returnQuantity
          );
          await purchasesService.updateItem(tenantId, itemRecord.id, {
            returned_quantity: updatedReturnedQty,
          });
        }

        await stockService.create(tenantId, {
          product_id: returnedItem.productId,
          movement_type: "adjustment",
          quantity: -returnedItem.returnQuantity,
          reference_type: "purchase_return",
          reference_id: purchase.id,
          notes: `Devolución compra ${purchase.purchase_number}: ${payload.reason}`,
          created_by: userId,
        });

        const product = await productsService.getById(tenantId, returnedItem.productId);
        if (product) {
          const nextStock = roundQty(product.stock_current - returnedItem.returnQuantity);
          await productsService.updateStock(tenantId, product.id, nextStock);
        }
      }

      let cashMovementId: string | null = null;
      if (payload.refundToCash && openCashSession && payload.totalRefund > 0) {
        const movement = await cashService.createMovement(tenantId, {
          cash_session_id: openCashSession.id,
          movement_type: "income",
          amount: payload.totalRefund,
          currency_code: "ARS",
          reference_type: "purchase_refund",
          reference_id: purchase.id,
          notes: `Reintegro devolución compra ${purchase.purchase_number}: ${payload.reason}`,
          created_by: userId,
        });
        cashMovementId = movement.id;
      }

      const newReturnedTotal = roundAmount((purchase.returned_total || 0) + payload.totalRefund);
      const isFullyReturned = newReturnedTotal >= purchase.total;

      const appendNotes = [
        purchase.notes,
        `[Devolución ${new Date().toLocaleDateString("es-AR")}]: ${payload.reason} (-${payload.totalRefund})`,
      ]
        .filter(Boolean)
        .join(" | ");

      await purchasesService.update(tenantId, purchase.id, {
        status: isFullyReturned ? "returned" : "partial_return",
        returned_total: newReturnedTotal,
        notes: appendNotes,
      });

      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "compras",
        action: "purchase_return",
        entity_type: "purchase",
        entity_id: purchase.id,
        description: `Devolución registrada en compra ${purchase.purchase_number}: ${currency.format(
          payload.totalRefund
        )}`,
        metadata: {
          purchase_id: purchase.id,
          reason: payload.reason,
          refund_to_cash: payload.refundToCash,
          total_refund: payload.totalRefund,
          cash_session_id: openCashSession?.id ?? null,
          cash_movement_id: cashMovementId,
          items: payload.items,
        },
      });

      setFeedback({
        type: "success",
        message: `Devolución de ${currency.format(payload.totalRefund)} confirmada${
          payload.refundToCash ? " y acreditada en la caja diaria" : ""
        }`,
      });
      await loadData();
      return true;
    } catch {
      setFeedback({ type: "error", message: "No se pudo procesar la devolución" });
      return false;
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
    () =>
      [...new Set(products.map((product) => product.subcategory).filter(Boolean) as string[])].sort(),
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

  const addProductByBarcode = async (
    rawBarcode: string
  ): Promise<{ ok: boolean; product?: Product; error?: string }> => {
    if (!tenantId) return { ok: false, error: "No hay un comercio activo" };

    const barcode = normalizeBarcode(rawBarcode);
    if (!barcode) return { ok: false, error: "Ingresa un código de barras" };

    const barcodeRow =
      productBarcodes.find(
        (row) => normalizeBarcode(row.barcode) === barcode && row.is_primary
      ) ?? productBarcodes.find((row) => normalizeBarcode(row.barcode) === barcode);

    let product = barcodeRow
      ? products.find((candidate) => candidate.id === barcodeRow.product_id) ?? null
      : products.find((candidate) => normalizeBarcode(candidate.code) === barcode) ?? null;

    if (!product) {
      try {
        product = await productsService.getByBarcode(tenantId, barcode);
      } catch {
        return { ok: false, error: "No se pudo consultar el código de barras" };
      }
    }

    if (!product || !product.is_active) {
      return { ok: false, error: `No se encontró un producto activo para ${barcode}` };
    }

    addProductToCart(product);
    return { ok: true, product };
  };

  const createProductAndAddToCart = async (
    values: ProductFormModalValues
  ): Promise<Product | null> => {
    if (!tenantId) return null;

    setIsSubmitting(true);
    try {
      let created = await productsService.create(tenantId, toProductCreateInput(values));

      if (values.imagenFile) {
        const imageUrl = await productsService.uploadProductImage(
          tenantId,
          created.id,
          values.imagenFile
        );
        created = (await productsService.update(tenantId, created.id, { image_url: imageUrl })) ?? {
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
    addProductByBarcode,
    setItemQuantity,
    setItemUnitCost,
    setItemVatPercent,
    setItemBonifiedQuantity,
    removeItem,
    clearCart,
    confirmPurchase,
    createPurchaseReturn,
    findPotentialDuplicateProducts,
    createProductAndAddToCart,
    createSupplier,
  };
};

