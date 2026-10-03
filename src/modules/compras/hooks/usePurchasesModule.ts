import { useCallback, useEffect, useMemo, useState } from "react";
import { auditService } from "@/services/audit.service";
import { cashService } from "@/services/cash.service";
import { productsService } from "@/services/products.service";
import { useProductsStore } from "@/features/products/store/products.store";
import { bankAccountsService } from "@/services/bank-accounts.service";
import { bankAccountMovementsService } from "@/services/bank-account-movements.service";
import { generalCashService } from "@/services/general-cash.service";
import { purchasesService } from "@/services/purchases.service";
import { stockService } from "@/services/stock.service";
import { suppliersService } from "@/services/suppliers.service";
import { supplierCurrentAccountsService } from "@/services/supplier-current-accounts.service";
import { dataProvider } from "@/services/config/data-provider";
import type {
  BankAccount,
  CashSession,
  Product,
  ProductBarcode,
  Purchase,
  PurchaseItem,
  Supplier,
} from "@/types/entities";
import type { ProductFormModalValues } from "@/modules/productos/types/product.types";
import type {
  PurchaseCheckoutValues,
  PurchaseHeaderValues,
  PurchasePaymentValues,
} from "@/modules/compras/schemas/purchase-checkout.schema";
import type { SupplierFormValues } from "@/modules/proveedores/schemas/supplier-form.schema";
import type { PurchaseReturnPayload } from "@/modules/compras/components/PurchaseReturnModal";
import type { PurchaseCartItemView, PurchaseSummary } from "@/modules/compras/components/PurchaseCart";
import { toSupplierServiceInput } from "@/modules/proveedores/utils/supplier-input";
import { computePricingForward, computePricingBackward } from "@/modules/productos/utils/product-pricing";
import { matchesProductSearch } from "@/utils/search";

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

export const computeRealCost = (unitCost: number, discountPercent: number): number => {
  const discount = Math.max(0, Math.min(99.99, discountPercent || 0));
  if (discount <= 0) return roundAmount(unitCost);
  return roundAmount(unitCost / (1 - discount / 100));
};

const toProductCreateInput = (values: ProductFormModalValues) => ({
  code: values.codigoProducto?.trim() || null,
  name: values.nombre,
  image_url: values.imagenUrl?.trim() || null,
  brand: null,
  supplier: null,
  is_favorite: values.favorito,
  description: null,
  price: roundAmount(values.precioFinal),
  cost_price: roundAmount(values.precioCosto),
  cost: roundAmount(values.precioCosto),
  stock_current: roundQty(values.stock),
  stock: roundQty(values.stock),
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
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [openCashSession, setOpenCashSession] = useState<CashSession | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<PurchaseCartItemView[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<PurchaseFeedback | null>(null);
  const [purchaseVatPercent, setPurchaseVatPercent] = useState<number>(21);
  const [purchaseIibbPercent, setPurchaseIibbPercent] = useState<number>(0);
  const [purchaseIibbAmount, setPurchaseIibbAmount] = useState<number>(0);

  const clearFeedback = () => setFeedback(null);

  const loadData = useCallback(async () => {
    if (!tenantId) {
      setProducts([]);
      setProductBarcodes([]);
      setSuppliers([]);
      setPurchases([]);
      setBankAccounts([]);
      setOpenCashSession(null);
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
      const [
        allProducts,
        allProductBarcodes,
        allSuppliers,
        allPurchases,
        allPurchaseItems,
        allBankAccounts,
        activeCashSession,
      ] = await Promise.all([
        productsService.getAllByTenant(tenantId),
        productsService.getBarcodesByTenant(tenantId),
        suppliersService.getAllByTenant(tenantId),
        purchasesService.getAllByTenant(tenantId),
        purchasesService.getAllItemsByTenant(tenantId),
        bankAccountsService.getActiveByTenant(tenantId),
        userId != null
          ? cashService.getOpenSessionByUser(tenantId, userId).then((s) => s ?? cashService.getOpenSession(tenantId))
          : cashService.getOpenSession(tenantId),
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
      setBankAccounts(allBankAccounts);
      setOpenCashSession(activeCashSession);
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

  const barcodesByProductId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const b of productBarcodes) {
      const list = map.get(b.product_id) ?? [];
      list.push(b.barcode);
      map.set(b.product_id, list);
    }
    return map;
  }, [productBarcodes]);

  const filteredProducts = useMemo(() => {
    const rawSearch = search.trim();
    const activeProducts = products.filter((product) => product.is_active);
    if (!rawSearch) return activeProducts;

    return activeProducts.filter((product) =>
      matchesProductSearch(
        {
          name: product.name,
          code: product.code,
          barcodes: barcodesByProductId.get(product.id) ?? [],
          category: product.category,
          subcategory: product.subcategory,
        },
        rawSearch,
        "all"
      )
    );
  }, [barcodesByProductId, products, search]);

  const addProductToCart = (
    product: Product,
    initialQuantity?: number,
    customUnitCost?: number,
    customVatPercent?: number,
    customBonifiedQuantity?: number,
    customDiscountPercent?: number
  ) => {
    const qtyToAdd = initialQuantity && initialQuantity > 0 ? initialQuantity : 1;
    const discountPct =
      customDiscountPercent != null && customDiscountPercent >= 0
        ? Math.max(0, Math.min(100, roundAmount(customDiscountPercent)))
        : 0;

    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product_id === product.id
            ? {
                ...item,
                quantity: roundQty(item.quantity + qtyToAdd),
                unit_cost:
                  customUnitCost != null && customUnitCost >= 0
                    ? roundAmount(customUnitCost)
                    : item.unit_cost,
                vat_percent:
                  customVatPercent != null && customVatPercent >= 0
                    ? customVatPercent
                    : item.vat_percent,
                bonified_quantity:
                  customBonifiedQuantity != null && customBonifiedQuantity >= 0
                    ? roundQty(item.bonified_quantity + customBonifiedQuantity)
                    : item.bonified_quantity,
                discount_percent:
                  customDiscountPercent != null && customDiscountPercent >= 0
                    ? discountPct
                    : (item.discount_percent ?? 0),
                sale_mode: product.sale_mode,
                stock_current: product.stock_current,
              }
            : item
        );
      }

      const costPrice =
        customUnitCost != null && customUnitCost >= 0
          ? roundAmount(customUnitCost)
          : (product.cost_price ?? 0);
      const salePrice = product.price ?? 0;
      const vatPercent =
        customVatPercent != null && customVatPercent >= 0
          ? customVatPercent
          : (product.vat_percent ?? 21);
      const bonifiedQty =
        customBonifiedQuantity != null && customBonifiedQuantity >= 0
          ? roundQty(customBonifiedQuantity)
          : 0;

      // Determinar % de ganancia configurado o calcularlo hacia atrás
      const effectiveProfit = (() => {
        if (typeof product.profit_percent === "number" && product.profit_percent >= 0) {
          return product.profit_percent;
        }
        if (costPrice > 0 && salePrice > 0) {
          return computePricingBackward({
            precioCosto: costPrice,
            precioFinal: salePrice,
            porcentajeIva: vatPercent,
          }).porcentajeGanancia;
        }
        return 0;
      })();

      const realCost = computeRealCost(costPrice, discountPct);

      // Precio de venta calculado con % de ganancia e IVA aplicado sobre el precio real
      const calculatedNewSale = computePricingForward({
        precioCosto: realCost,
        porcentajeGanancia: effectiveProfit,
        porcentajeIva: vatPercent,
      }).precioFinal;

      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          sale_mode: product.sale_mode,
          quantity: qtyToAdd,
          unit_cost: costPrice,
          vat_percent: vatPercent,
          bonified_quantity: bonifiedQty,
          discount_percent: discountPct,
          stock_current: product.stock_current ?? 0,
          previous_cost: costPrice,
          current_sale_price: salePrice,
          profit_percent: effectiveProfit,
          update_sale_price: false,
          new_sale_price: calculatedNewSale || salePrice,
        },
      ];
    });
  };

  const setItemDiscountPercent = (productId: string, discountPercent: number) => {
    const normalized = Math.max(0, Math.min(99.99, roundAmount(discountPercent)));
    if (!Number.isFinite(normalized)) return;

    setCart((prev) =>
      prev.map((item) => {
        if (item.product_id !== productId) return item;
        const realCost = computeRealCost(item.unit_cost, normalized);
        const forward = computePricingForward({
          precioCosto: realCost,
          porcentajeGanancia: item.profit_percent,
          porcentajeIva: item.vat_percent || 0,
        });
        return {
          ...item,
          discount_percent: normalized,
          new_sale_price: forward.precioFinal,
        };
      })
    );
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
      prev.map((item) => {
        if (item.product_id !== productId) return item;
        const realCost = computeRealCost(normalized, item.discount_percent || 0);
        const forward = computePricingForward({
          precioCosto: realCost,
          porcentajeGanancia: item.profit_percent,
          porcentajeIva: item.vat_percent || 0,
        });
        return {
          ...item,
          unit_cost: normalized,
          new_sale_price: forward.precioFinal,
        };
      })
    );
  };

  const setItemProfitPercent = (productId: string, profitPercent: number) => {
    const normalized = Math.max(0, roundAmount(profitPercent));
    if (!Number.isFinite(normalized)) return;

    setCart((prev) =>
      prev.map((item) => {
        if (item.product_id !== productId) return item;
        const realCost = computeRealCost(item.unit_cost, item.discount_percent || 0);
        const forward = computePricingForward({
          precioCosto: realCost,
          porcentajeGanancia: normalized,
          porcentajeIva: item.vat_percent || 0,
        });
        return {
          ...item,
          profit_percent: normalized,
          new_sale_price: forward.precioFinal,
          update_sale_price: true,
        };
      })
    );
  };

  const setItemSalePrice = (productId: string, salePrice: number) => {
    const normalized = roundAmount(salePrice);
    if (!Number.isFinite(normalized) || normalized < 0) return;

    setCart((prev) =>
      prev.map((item) => {
        if (item.product_id !== productId) return item;
        const realCost = computeRealCost(item.unit_cost, item.discount_percent || 0);
        const backward = computePricingBackward({
          precioCosto: realCost,
          precioFinal: normalized,
          porcentajeIva: item.vat_percent || 0,
        });
        return {
          ...item,
          profit_percent: backward.porcentajeGanancia,
          new_sale_price: normalized,
          update_sale_price: true,
        };
      })
    );
  };

  const setItemVatPercent = (productId: string, vatPercent: number) => {
    const normalized = Number(vatPercent);
    if (!Number.isFinite(normalized) || normalized < 0) return;

    setCart((prev) =>
      prev.map((item) => {
        if (item.product_id !== productId) return item;
        const realCost = computeRealCost(item.unit_cost, item.discount_percent || 0);
        const forward = computePricingForward({
          precioCosto: realCost,
          porcentajeGanancia: item.profit_percent,
          porcentajeIva: normalized || 0,
        });
        return {
          ...item,
          vat_percent: normalized,
          new_sale_price: forward.precioFinal,
        };
      })
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

  const setItemUpdateSalePrice = (productId: string, updateSalePrice: boolean) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product_id === productId
          ? {
              ...item,
              update_sale_price: updateSalePrice,
            }
          : item
      )
    );
  };

  const removeItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product_id !== productId));
  };

  const clearCart = () => setCart([]);

  const summary: PurchaseSummary = useMemo(() => {
    let subtotal = 0;
    let totalUnits = 0;
    let totalDiscountAmount = 0;

    for (const item of cart) {
      const realCost = computeRealCost(item.unit_cost, item.discount_percent || 0);
      const unitSavings = roundAmount(realCost - item.unit_cost);
      const lineTotal = roundAmount(item.quantity * item.unit_cost);
      const lineSavings = roundAmount(item.quantity * unitSavings);

      subtotal += lineTotal;
      totalDiscountAmount += lineSavings;
      totalUnits += item.quantity + (item.bonified_quantity || 0);
    }

    subtotal = roundAmount(subtotal);
    const vatTotal = roundAmount(subtotal * ((purchaseVatPercent || 0) / 100));
    const calculatedIibb =
      purchaseIibbAmount > 0
        ? purchaseIibbAmount
        : roundAmount(subtotal * ((purchaseIibbPercent || 0) / 100));
    const iibbTotal = roundAmount(calculatedIibb);
    const total = roundAmount(subtotal + vatTotal + iibbTotal);
    totalUnits = roundQty(totalUnits);
    totalDiscountAmount = roundAmount(totalDiscountAmount);

    return {
      subtotal,
      vatPercent: purchaseVatPercent,
      vatTotal,
      iibbPercent: purchaseIibbPercent,
      iibbTotal,
      total,
      totalUnits,
      totalDiscountAmount,
    };
  }, [cart, purchaseVatPercent, purchaseIibbPercent, purchaseIibbAmount]);

  const confirmPurchase = async (
    headerOrCheckoutValues: PurchaseHeaderValues | PurchaseCheckoutValues,
    optionalPaymentValues?: PurchasePaymentValues
  ): Promise<Purchase | null> => {
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

    const headerValues: PurchaseHeaderValues = {
      supplierId: headerOrCheckoutValues.supplierId,
      documentType: headerOrCheckoutValues.documentType,
      documentNumber: headerOrCheckoutValues.documentNumber,
      issueDate: headerOrCheckoutValues.issueDate,
      vatPercent: headerOrCheckoutValues.vatPercent ?? purchaseVatPercent,
      iibbPercent: headerOrCheckoutValues.iibbPercent ?? purchaseIibbPercent,
      iibbAmount: headerOrCheckoutValues.iibbAmount ?? purchaseIibbAmount,
      notes: headerOrCheckoutValues.notes,
    };

    // Validar existencia real del proveedor para evitar violación de Foreign Key
    let targetSupplier = suppliers.find((s) => s.id === headerValues.supplierId);
    if (!targetSupplier) {
      try {
        const direct = await suppliersService.getById(tenantId, headerValues.supplierId);
        if (direct) {
          targetSupplier = direct;
          setSuppliers((prev) => [direct, ...prev.filter((s) => s.id !== direct.id)]);
        }
      } catch {
        // Fallback silencioso
      }
    }

    if (!targetSupplier) {
      setFeedback({
        type: "error",
        message:
          "El proveedor seleccionado no existe en el sistema o fue eliminado. Por favor vuelve a seleccionarlo de la lista o créalo.",
      });
      return null;
    }

    // Si el proveedor tiene un ID local de mock (creado previamente antes de sincronizar con Supabase),
    // lo persistimos en Supabase inmediatamente para obtener su UUID real y que la compra no falle por Foreign Key.
    if (dataProvider !== "mock" && targetSupplier.id.startsWith("mock-")) {
      try {
        const syncedSupplier = await suppliersService.create(tenantId, {
          name: targetSupplier.name,
          code: targetSupplier.code || "",
          phone: targetSupplier.phone ?? null,
          email: targetSupplier.email ?? null,
          address: targetSupplier.address ?? null,
          observations: targetSupplier.observations ?? null,
          tax_id: targetSupplier.tax_id ?? null,
          is_active: true,
        });
        if (syncedSupplier && !syncedSupplier.id.startsWith("mock-")) {
          headerValues.supplierId = syncedSupplier.id;
          targetSupplier = syncedSupplier;
          setSuppliers((prev) => [
            syncedSupplier,
            ...prev.filter((s) => s.id !== targetSupplier!.id && s.id !== syncedSupplier.id),
          ]);
        }
      } catch (err) {
        console.warn("[usePurchasesModule] No se pudo migrar el proveedor mock a Supabase:", err);
      }
    }

    const paymentValues: PurchasePaymentValues =
      optionalPaymentValues ?? {
        paymentMethod:
          "paymentMethod" in headerOrCheckoutValues
            ? (headerOrCheckoutValues.paymentMethod as PurchasePaymentValues["paymentMethod"])
            : "cash_daily",
        bankAccountId:
          "bankAccountId" in headerOrCheckoutValues
            ? (headerOrCheckoutValues.bankAccountId as string | undefined)
            : undefined,
        voucherNumber:
          "voucherNumber" in headerOrCheckoutValues
            ? (headerOrCheckoutValues.voucherNumber as string | undefined)
            : undefined,
        dueDate:
          "dueDate" in headerOrCheckoutValues
            ? (headerOrCheckoutValues.dueDate as string | undefined)
            : undefined,
        paymentNotes:
          "paymentNotes" in headerOrCheckoutValues
            ? (headerOrCheckoutValues.paymentNotes as string | undefined)
            : undefined,
        isSplitPayment:
          "isSplitPayment" in headerOrCheckoutValues
            ? Boolean(headerOrCheckoutValues.isSplitPayment)
            : false,
        payments:
          "payments" in headerOrCheckoutValues
            ? headerOrCheckoutValues.payments
            : undefined,
      };

    setIsSubmitting(true);
    try {
      const isSplit = Boolean(
        paymentValues.isSplitPayment &&
          paymentValues.payments &&
          paymentValues.payments.length > 0
      );

      const splitPayments = isSplit ? paymentValues.payments! : [];
      const dailyCashAmount = isSplit
        ? splitPayments
            .filter((p) => p.paymentMethod === "cash_daily")
            .reduce((acc, p) => acc + p.amount, 0)
        : paymentValues.paymentMethod === "cash_daily"
        ? summary.total
        : 0;

      const hasDailyCash = dailyCashAmount > 0;

      const generalCashAmount = isSplit
        ? splitPayments
            .filter((p) => p.paymentMethod === "cash_general")
            .reduce((acc, p) => acc + p.amount, 0)
        : paymentValues.paymentMethod === "cash_general"
        ? summary.total
        : 0;

      const hasGeneralCash = generalCashAmount > 0;
      let activeCashSession = openCashSession;

      if (hasDailyCash && !activeCashSession) {
        activeCashSession =
          userId != null
            ? (await cashService.getOpenSessionByUser(tenantId, userId)) ??
              (await cashService.getOpenSession(tenantId))
            : await cashService.getOpenSession(tenantId);
      }

      const selectedBank =
        !isSplit && paymentValues.paymentMethod === "transfer" && paymentValues.bankAccountId
          ? bankAccounts.find((b) => b.id === paymentValues.bankAccountId) ?? null
          : null;

      const methodNames: Record<string, string> = {
        cash_daily: "Caja Diaria",
        cash_general: "Caja General",
        cash: "Efectivo Directo",
        transfer: "Transferencia",
        current_account: "Cta. Cte. Proveedor",
      };

      const paymentDetailNotes = isSplit
        ? `Pago Combinado: ${splitPayments
            .map((p) => {
              const b = p.bankAccountId ? bankAccounts.find((acc) => acc.id === p.bankAccountId) : null;
              const details = [
                methodNames[p.paymentMethod] || p.paymentMethod,
                b ? `(${b.bank_name})` : null,
                p.voucherNumber ? `Comp. ${p.voucherNumber}` : null,
                `$${p.amount.toFixed(2)}`,
              ]
                .filter(Boolean)
                .join(" ");
              return details;
            })
            .join(" + ")}`
        : [
            paymentValues.paymentMethod === "cash_daily" && !activeCashSession
              ? "(Sin caja diaria abierta)"
              : null,
            paymentValues.paymentMethod === "cash_general" ? "Pago Caja General" : null,
            paymentValues.paymentMethod === "cash" ? "Pago Efectivo Directo" : null,
            paymentValues.paymentMethod === "transfer"
              ? `Transf. bancaria ${selectedBank ? `(${selectedBank.bank_name})` : ""}`
              : null,
            paymentValues.voucherNumber ? `Comp. ${paymentValues.voucherNumber}` : null,
            paymentValues.dueDate ? `Vence: ${paymentValues.dueDate}` : null,
            paymentValues.paymentNotes?.trim() || null,
          ]
            .filter(Boolean)
            .join(" - ");

      const fiscalParts = [
        headerValues.vatPercent > 0 ? `IVA ${headerValues.vatPercent}%: $${summary.vatTotal.toFixed(2)}` : null,
        (summary.iibbTotal ?? 0) > 0
          ? `Percep. IIBB${headerValues.iibbPercent > 0 ? ` ${headerValues.iibbPercent}%` : ""}: $${(summary.iibbTotal ?? 0).toFixed(2)}`
          : null,
      ].filter(Boolean);
      const fiscalNotes = fiscalParts.length > 0 ? `[Fiscal: ${fiscalParts.join(" | ")}]` : null;

      const combinedNotes =
        [fiscalNotes, headerValues.notes?.trim(), paymentDetailNotes].filter(Boolean).join(" | ") || null;

      const purchase = await purchasesService.create(tenantId, {
        supplier_id: headerValues.supplierId,
        purchase_number: `CP-${Date.now()}`,
        document_type: headerValues.documentType,
        document_number: headerValues.documentNumber?.trim() || null,
        issue_date: headerValues.issueDate,
        payment_method: isSplit ? "other" : paymentValues.paymentMethod,
        status: "confirmed",
        subtotal: summary.subtotal,
        vat_total: summary.vatTotal,
        total: summary.total,
        notes: combinedNotes,
        created_by: userId,
      });

      for (const item of cart) {
        const realCost = computeRealCost(item.unit_cost, item.discount_percent || 0);
        const lineTotal = roundAmount(item.quantity * item.unit_cost);
        const totalIncomingQty = roundQty(item.quantity + (item.bonified_quantity || 0));

        await purchasesService.createItem(tenantId, {
          purchase_id: purchase.id,
          product_id: item.product_id,
          product_name_snapshot: item.name,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          vat_percent: item.vat_percent,
          vat_amount: 0,
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

        const forward = computePricingForward({
          precioCosto: realCost,
          porcentajeGanancia: item.profit_percent,
          porcentajeIva: item.vat_percent || 0,
        });

        const productUpdatePayload: Partial<Product> = {
          stock_current: newStock,
          cost_price: realCost > 0 ? realCost : currentProduct?.cost_price,
          vat_percent: item.vat_percent,
          profit_percent: item.profit_percent,
          price: item.new_sale_price || forward.precioFinal,
          price_without_vat: forward.precioSinIva,
        };

        if (!item.update_sale_price && (currentProduct?.price || item.current_sale_price)) {
          const backward = computePricingBackward({
            precioCosto: realCost,
            precioFinal: currentProduct?.price ?? item.current_sale_price,
            porcentajeIva: item.vat_percent || 0,
          });
          productUpdatePayload.price = currentProduct?.price ?? item.current_sale_price;
          productUpdatePayload.price_without_vat = backward.precioSinIva;
          productUpdatePayload.profit_percent = backward.porcentajeGanancia;
        }

        const updated = await productsService.update(tenantId, item.product_id, {
          ...productUpdatePayload,
          stock: newStock,
          cost: productUpdatePayload.cost_price,
        } as Partial<Product>);
        if (updated) {
          useProductsStore.getState().upsertProduct(updated);
        }
      }

      let cashMovementId: string | null = null;
      if (hasDailyCash && activeCashSession && dailyCashAmount > 0) {
        const cashMovement = await cashService.createMovement(tenantId, {
          cash_session_id: activeCashSession.id,
          movement_type: "expense",
          amount: dailyCashAmount,
          currency_code: "ARS",
          reference_type: "purchase_payment",
          reference_id: purchase.id,
          notes: `Pago compra ${purchase.purchase_number} - ${headerValues.documentType} ${
            headerValues.documentNumber || ""
          }${isSplit ? ` (Parcial caja diaria: $${dailyCashAmount.toFixed(2)})` : ""}`.trim(),
          created_by: userId,
        });
        cashMovementId = cashMovement.id;
      }

      const currentAccountDebtAmount = isSplit
        ? splitPayments
            .filter((p) => p.paymentMethod === "current_account")
            .reduce((acc, p) => acc + p.amount, 0)
        : paymentValues.paymentMethod === "current_account"
        ? summary.total
        : 0;

      if (currentAccountDebtAmount > 0 && purchase.supplier_id) {
        try {
          const splitCtaCteItem = isSplit
            ? splitPayments.find((p) => p.paymentMethod === "current_account")
            : null;
          const debtDueDate = splitCtaCteItem?.dueDate || paymentValues.dueDate;
          const debtNotes = [
            `Compra a crédito #${purchase.purchase_number}${
              isSplit ? ` (Parcial cta. cte.: $${currentAccountDebtAmount.toFixed(2)})` : ""
            }`,
            headerValues.documentType
              ? `${headerValues.documentType} ${headerValues.documentNumber || ""}`.trim()
              : null,
            debtDueDate ? `Vencimiento: ${debtDueDate}` : null,
            paymentValues.paymentNotes?.trim() || null,
          ]
            .filter(Boolean)
            .join(" - ");

          await supplierCurrentAccountsService.registerDebt(tenantId, {
            supplierId: purchase.supplier_id,
            purchaseId: purchase.id,
            amount: currentAccountDebtAmount,
            notes: debtNotes,
            createdBy: userId ?? undefined,
          });
        } catch (debtError) {
          console.error("Error al registrar deuda en cuenta corriente de proveedor:", debtError);
        }
      }

      // Registrar egreso en cuenta bancaria si se pagó por transferencia desde cuenta propia
      const transferItems = isSplit
        ? splitPayments.filter(
            (p) => p.paymentMethod === "transfer" && p.bankAccountId && p.amount > 0
          )
        : paymentValues.paymentMethod === "transfer" && paymentValues.bankAccountId
        ? [
            {
              bankAccountId: paymentValues.bankAccountId,
              amount: summary.total,
              voucherNumber: paymentValues.voucherNumber,
            },
          ]
        : [];

      for (const item of transferItems) {
        if (!item.bankAccountId) continue;
        try {
          await bankAccountMovementsService.createMovement(tenantId, {
            bank_account_id: item.bankAccountId,
            type: "expense",
            origin_type: "supplier_payment",
            concept: `Pago Compra #${purchase.purchase_number}${
              headerValues.documentNumber
                ? ` - ${headerValues.documentType} ${headerValues.documentNumber}`
                : ""
            }`,
            amount: item.amount,
            reference_id: purchase.id,
            voucher_number: item.voucherNumber || null,
            notes: `Pago a proveedor desde cuenta bancaria`,
            created_by: userId,
          });
        } catch (bErr) {
          console.error("Error al registrar egreso en cuenta bancaria:", bErr);
        }
      }

      // Registrar egreso en caja general si se pagó desde caja general
      if (hasGeneralCash && generalCashAmount > 0) {
        try {
          await generalCashService.createMovement(tenantId, {
            type: "expense",
            amount: generalCashAmount,
            origin_type: "supplier_payment",
            concept: `Pago Compra #${purchase.purchase_number}${
              headerValues.documentNumber
                ? ` - ${headerValues.documentType} ${headerValues.documentNumber}`
                : ""
            }`,
            reference_id: purchase.id,
            created_by: userId,
            notes: `Pago a proveedor desde Caja General`,
          });
        } catch (gcErr) {
          console.error("Error al registrar egreso en caja general:", gcErr);
        }
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
          document_type: headerValues.documentType,
          document_number: headerValues.documentNumber,
          item_count: cart.length,
          total: purchase.total,
          vat_total: summary.vatTotal,
          total_units: summary.totalUnits,
          payment_method: isSplit ? "split" : paymentValues.paymentMethod,
          is_split_payment: isSplit,
          split_payments: isSplit ? splitPayments : undefined,
          bank_account_id: paymentValues.bankAccountId ?? null,
          cash_session_id: activeCashSession?.id ?? null,
          cash_movement_id: cashMovementId,
        },
      });

      let methodDesc = "en efectivo";
      if (isSplit) {
        methodDesc = `con pago combinado (${splitPayments.length} medios de pago)`;
      } else if (paymentValues.paymentMethod === "cash_daily") {
        methodDesc = activeCashSession ? "debitada de la caja diaria" : "en efectivo (sin caja abierta)";
      } else if (paymentValues.paymentMethod === "cash_general") {
        methodDesc = "con fondos de caja general";
      } else if (paymentValues.paymentMethod === "transfer") {
        methodDesc = `por transferencia bancaria ${selectedBank ? `(${selectedBank.bank_name})` : ""}`;
      } else if (paymentValues.paymentMethod === "current_account") {
        methodDesc = "asentada en cuenta corriente del proveedor";
      }

      setFeedback({
        type: "success",
        message: `Compra ${purchase.purchase_number} registrada correctamente (${methodDesc})`,
      });
      clearCart();
      useProductsStore.getState().loadCatalog(tenantId, true).catch(() => {});
      await loadData();
      return purchase;
    } catch (error) {
      console.error("[usePurchasesModule] confirmPurchase failed:", error);
      const raw =
        error instanceof Error && error.message
          ? error.message
          : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : String(error ?? "");
      let message = raw || "No se pudo registrar la compra";
      if (
        raw.toLowerCase().includes("purchases_supplier_id_fkey") ||
        raw.toLowerCase().includes("foreign key")
      ) {
        message =
          "Error de proveedor: El proveedor seleccionado no existe en la base de datos remota. Por favor recarga los proveedores o pulsa '+ Nuevo' para darlo de alta.";
      }
      setFeedback({ type: "error", message });
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

      if (purchase.payment_method === "current_account" && purchase.supplier_id && payload.totalRefund > 0) {
        try {
          await supplierCurrentAccountsService.registerPayment(tenantId, {
            supplierId: purchase.supplier_id,
            amount: payload.totalRefund,
            notes: `Crédito por devolución en compra #${purchase.purchase_number}: ${payload.reason}`,
            createdBy: userId ?? undefined,
          });
        } catch (returnDebtErr) {
          console.error("Error al registrar ajuste en cuenta corriente de proveedor:", returnDebtErr);
        }
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
    const code = values.codigoProducto?.trim().toUpperCase();
    const barcode = normalizeBarcode(values.codigoBarras);
    const byId = new Map(products.map((product) => [product.id, product]));

    if (code) {
      const codeMatch = products.find((p) => p.code && p.code.trim().toUpperCase() === code);
      if (codeMatch) return [codeMatch];

      const barcodeWithCode = productBarcodes.find((row) => normalizeBarcode(row.barcode).toUpperCase() === code);
      const productByBarcode = barcodeWithCode ? byId.get(barcodeWithCode.product_id) : null;
      if (productByBarcode) return [productByBarcode];
    }

    if (barcode) {
      const barcodeMatch = productBarcodes.find((row) => normalizeBarcode(row.barcode) === barcode);
      const product = barcodeMatch ? byId.get(barcodeMatch.product_id) : null;
      if (product) return [product];

      const codeWithBarcode = products.find((p) => p.code && p.code.trim().toUpperCase() === barcode.toUpperCase());
      if (codeWithBarcode) return [codeWithBarcode];
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
      : products.find((candidate) => Boolean(candidate.code) && normalizeBarcode(candidate.code) === barcode) ?? null;

    if (!product) {
      // Coincidencia quitando ceros a la izquierda (ej: 0045 -> 45)
      const numericBarcode = barcode.replace(/^0+/, "");
      if (numericBarcode) {
        product =
          products.find(
            (p) =>
              Boolean(p.code) &&
              normalizeBarcode(p.code).replace(/^0+/, "") === numericBarcode
          ) ?? null;
      }
    }

    let detectedWeight: number | undefined = undefined;

    // Reconocimiento de códigos de balanza estándar (EAN-13 que comienzan con 20..29)
    if (!product && barcode.length === 13 && /^\d{13}$/.test(barcode)) {
      const prefix = barcode.slice(0, 2);
      if (["20", "21", "22", "23", "24", "25", "26", "27", "28", "29"].includes(prefix)) {
        const candidatePlu5 = barcode.slice(2, 7);
        const candidatePlu4 = barcode.slice(2, 6);
        const normPlu5 = candidatePlu5.replace(/^0+/, "");
        const normPlu4 = candidatePlu4.replace(/^0+/, "");

        const matchedByPlu = products.find((p) => {
          if (!p.code) return false;
          const pCodeNorm = normalizeBarcode(p.code).replace(/^0+/, "");
          return (
            pCodeNorm === normPlu5 ||
            pCodeNorm === normPlu4 ||
            p.code === candidatePlu5 ||
            p.code === candidatePlu4
          );
        });

        if (matchedByPlu) {
          product = matchedByPlu;
          const weightRaw = Number(barcode.slice(7, 12));
          if (!Number.isNaN(weightRaw) && weightRaw > 0) {
            detectedWeight = Number((weightRaw / 1000).toFixed(3));
          }
        }
      }
    }

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

    addProductToCart(product, detectedWeight);
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
      useProductsStore.getState().upsertProduct(created);

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
    bankAccounts,
    openCashSession,
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
    setItemDiscountPercent,
    setItemProfitPercent,
    setItemSalePrice,
    setItemVatPercent,
    setItemBonifiedQuantity,
    setItemUpdateSalePrice,
    removeItem,
    clearCart,
    confirmPurchase,
    createPurchaseReturn,
    findPotentialDuplicateProducts,
    createProductAndAddToCart,
    createSupplier,
    purchaseVatPercent,
    setPurchaseVatPercent,
    purchaseIibbPercent,
    setPurchaseIibbPercent,
    purchaseIibbAmount,
    setPurchaseIibbAmount,
  };
};

