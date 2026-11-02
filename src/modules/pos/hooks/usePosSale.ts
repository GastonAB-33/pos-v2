import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { auditService } from "@/services/audit.service";
import { bankAccountsService } from "@/services/bank-accounts.service";
import { currentAccountsService } from "@/services/current-accounts.service";
import { employeeCurrentAccountsService } from "@/services/employee-current-accounts.service";
import { employeesService } from "@/services/employees.service";
import { cashService } from "@/services/cash.service";
import { customersService } from "@/services/customers.service";
import { useOffline } from "@/features/offline/hooks/useOffline";
import { offlineService } from "@/services/offline.service";
import { arcaInvoicesService } from "@/services/arca/arca-invoices.service";
import { arcaService } from "@/services/arca.service";
import { parseScaleBarcode, type ParsedScaleBarcode } from "@/services/barcode/scale-barcode.service";
import { invoicesService } from "@/services/invoices.service";
import { installmentPlansService } from "@/services/installment-plans.service";
import {
  mercadoPagoPaymentsService,
  type MercadoPagoOperationalStatus,
  type MercadoPagoPaymentIntent,
} from "@/services/mercadopago/mercadopago-payments.service";
import { originBanksService } from "@/services/origin-banks.service";
import {
  normalizePaymentMethodCode,
  paymentMethodsService,
} from "@/services/payment-methods.service";
import { posCustomerProfilesService } from "@/services/pos-customer-profiles.service";
import { priceListsService } from "@/services/price-lists.service";
import { productsService } from "@/services/products.service";
import { useProductsStore } from "@/features/products/store/products.store";
import { storageKeys } from "@/utils/local-storage";
import { buildPromotionBarcode, calculateProductPromotionDiscount, promotionsService, type PromotionWithDetails } from "@/services/promotions.service";
import { receiptsService } from "@/services/receipts.service";
import { salesService } from "@/services/sales.service";
import { bankAccountMovementsService } from "@/services/bank-account-movements.service";
import { settingsService } from "@/services/settings.service";
import { stockService } from "@/services/stock.service";
import type { ArcaSettings, BankAccount, BarcodeScaleSettings, Customer, Employee, InstallmentPlan, Invoice, InvoiceDocumentType,
  PaymentMethodInvoiceRules, MercadoPagoSettings, OriginBank, PaymentMethod, PaymentMethodType, PosSettings, PriceList, Product, ProductBarcode, Receipt, Sale } from "@/types/entities";
import type { PosCheckoutValues } from "@/modules/pos/schemas/pos-checkout.schema";
import {
  parseReturnableConfig,
  parseCustomerPackageDebts,
  serializeCustomerPackageDebts,
  type ReturnableConfig,
  type ReturnableCartStatus,
} from "@/utils/returnable-packages";

export interface CartManualDiscount {
  type: "percent" | "amount";
  value: number;
  reason: string;
}

export interface PosCartItem {
  product_id: string;
  name: string;
  category: string;
  sale_mode: "unit" | "weight";
  quantity: number;
  unit_price: number;
  base_unit_price: number;
  stock_available: number;
  price_list_id: string | null;
  price_list_name: string | null;
  price_list_is_active: boolean | null;
  is_scale_item: boolean;
  scale_weight: number | null;
  scale_total_price: number | null;
  scale_barcode: string | null;
  is_manual_item: boolean;
  is_price_overridden?: boolean;
  is_debt_payment_item?: boolean;
  debt_customer_id?: string | null;
  debt_customer_name?: string | null;
  returnable_config?: ReturnableConfig | null;
  returnable_status?: ReturnableCartStatus;
  is_returnable_package_item?: boolean;
  is_package_refund_item?: boolean;
  package_refund_name?: string | null;
  parent_product_id?: string | null;
  code?: string | null;
  barcode?: string | null;
  manual_discount?: {
    type: "percent" | "amount";
    value: number;
    reason: string;
  } | null;
  manual_promotion?: {
    id: string;
    name: string;
    code: string;
    discount_amount: number;
  } | null;
  is_promo_item?: boolean;
  promo_id?: string | null;
  promo_code?: string | null;
  promo_items?: PosPromoSubItem[];
}

export interface PosPromoSubItem {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
}

export interface PosCartItemComputed extends PosCartItem {
  line_subtotal: number;
  promotion_discount_total: number;
  product_promotion_discount_total: number;
  cart_promotion_discount_total: number;
  line_total: number;
  applied_promotion_name: string | null;
  applied_promotion_snapshot: Record<string, unknown> | null;
}

import { calculatePosRounding } from "@/utils/pos-rounding";

export interface PosCheckoutSummary {
  subtotal: number;
  surchargeTotal: number;
  discountTotal: number;
  paymentAdjustment: number;
  total: number;
  rawTotal: number;
  roundingAdjustment: number;
}

type FeedbackType = "success" | "error";

interface PosFeedback {
  type: FeedbackType;
  message: string;
}

interface BarcodeScanResult {
  ok: boolean;
  barcode: string;
  product?: Product;
  promotion?: PromotionWithDetails;
  parsedScale?: ParsedScaleBarcode | null;
  error?: string;
}

export interface PosQuickProductInput {
  name: string;
  category: string;
  saleMode: "unit" | "weight";
  quantity: number;
  unitPrice: number;
  costPrice: number;
  stock: number;
  code: string;
  barcode: string;
  favorite: boolean;
}

export interface PosCartItemEditInput {
  productId: string;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  saleMode?: "unit" | "weight";
  code?: string;
  barcode?: string;
}

export interface PosSaleTab {
  id: string;
  label: string;
  cart: PosCartItem[];
  selectedCustomerId: string;
  cartManualDiscount?: CartManualDiscount | null;
  roundingEnabled?: boolean;
}

const roundQty = (value: number): number => Number(value.toFixed(3));
const roundAmount = (value: number): number => Number(value.toFixed(2));
const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});
const buildSaleNumber = (): string => {
  const randomSuffix = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `VTA-${Date.now()}-${randomSuffix}`;
};

interface BackendErrorLike {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}

export const getBackendErrorMessage = (error: unknown): string | null => {
  if (!error || typeof error !== "object") return null;
  const backendError = error as BackendErrorLike;
  const message = backendError.message?.trim() ?? "";
  const details = backendError.details?.trim() ?? "";
  const hint = backendError.hint?.trim() ?? "";

  const parts = [message, details, hint].filter(Boolean);
  if (!parts.length) return null;
  return parts.join(" | ");
};

const defaultPosSettings: PosSettings = {
  default_customer_id: null,
  default_payment_method_id: null,
  auto_print_receipt: false,
  allow_sale_without_customer: true,
  allow_negative_stock: false,
  barcode_scan_quantity: 1,
  cart_behavior: "merge_same_product",
};

const defaultBarcodeScaleSettings: BarcodeScaleSettings = {
  scale_parser_enabled: false,
  scale_mode: "total_price",
  scale_prefix: "20",
  code_length: 13,
  plu_start: 3,
  plu_length: 4,
  weight_start: 8,
  weight_length: 5,
  weight_decimals: 3,
  amount_start: 7,
  amount_length: 6,
  amount_decimals: 2,
  ean13_enabled: true,
};

const defaultMercadoPagoSettings: MercadoPagoSettings = {
  enabled: true,
  mode: "mock",
  access_token: "",
  public_key: "",
  force_unavailable: false,
};

const defaultArcaSettings: ArcaSettings = {
  enabled: false,
  mode: "mock",
  cuit_emisor: "",
  punto_venta: 1,
  certificado_alias: "",
  fiscal_environment: "homologacion",
  force_unavailable: false,
  allow_internal_fallback: true,
};

const calculateSummaryByMethod = (
  subtotal: number,
  paymentMethod: PaymentMethod | null,
  posSettings?: PosSettings | null,
  discountsEnabled: boolean = true,
  roundingEnabled: boolean = true
): PosCheckoutSummary => {
  if (subtotal < 0) {
    return {
      subtotal,
      surchargeTotal: 0,
      discountTotal: 0,
      paymentAdjustment: 0,
      rawTotal: subtotal,
      roundingAdjustment: 0,
      total: subtotal,
    };
  }

  const isRoundingActive = Boolean(roundingEnabled && (posSettings?.rounding_enabled ?? true));

  if (!paymentMethod) {
    const rounding = calculatePosRounding(subtotal, {
      enabled: isRoundingActive,
      rule: posSettings?.rounding_rule || "integer",
      mode: posSettings?.rounding_mode,
      target: posSettings?.rounding_target,
      isCashPayment: true,
    });

    return {
      subtotal,
      surchargeTotal: 0,
      discountTotal: 0,
      paymentAdjustment: 0,
      rawTotal: subtotal,
      roundingAdjustment: rounding.adjustmentAmount,
      total: rounding.roundedAmount,
    };
  }

  const surchargeTotal = roundAmount(subtotal * (paymentMethod.surcharge_percent / 100));
  const discountTotal = discountsEnabled
    ? roundAmount(subtotal * (paymentMethod.discount_percent / 100))
    : 0;
  const paymentAdjustment = roundAmount(surchargeTotal - discountTotal);
  const rawTotal = roundAmount(subtotal + paymentAdjustment);

  const isCash = normalizePaymentMethodCode(paymentMethod.code) === "cash";
  const isCreditCard =
    normalizePaymentMethodCode(paymentMethod.code) === "card_credit" ||
    paymentMethod.type === "card_credit";

  // En tarjeta de crédito no se aplica redondeo ya que sería un sobreprecio adicional sobre el interés
  const shouldApplyRounding = isRoundingActive && !isCreditCard;

  const rounding = calculatePosRounding(rawTotal, {
    enabled: shouldApplyRounding,
    rule: posSettings?.rounding_rule || "integer",
    mode: posSettings?.rounding_mode,
    target: posSettings?.rounding_target,
    isCashPayment: isCash,
  });

  return {
    subtotal,
    surchargeTotal,
    discountTotal,
    paymentAdjustment,
    rawTotal,
    roundingAdjustment: rounding.adjustmentAmount,
    total: rounding.roundedAmount,
  };
};

const paymentMethodPriority = (method: PaymentMethod): number => {
  const code = normalizePaymentMethodCode(method.code);
  if (code === "cash") return 0;
  if (code === "card_debit") return 1;
  if (code === "card_credit") return 2;
  if (code === "transfer") return 3;
  if (code === "mercado_pago") return 4;
  if (code === "cheque") return 5;
  if (code === "current_account") return 6;
  return 7;
};

const normalizeBarcodeValue = (value: string): string => value.trim().replace(/\s+/g, "");

export const usePosSale = (tenantId: string | null) => {
  const { isOnline, refreshPending } = useOffline();
  const [products, setProducts] = useState<Product[]>([]);
  const [productBarcodes, setProductBarcodes] = useState<ProductBarcode[]>([]);
  const [primaryBarcodes, setPrimaryBarcodes] = useState<Record<string, string>>({});

  const actualPrimaryBarcodes = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const row of productBarcodes) {
      if (row.barcode && row.product_id) {
        if (row.is_primary || !map[row.product_id]) {
          map[row.product_id] = row.barcode;
        }
      }
    }
    return map;
  }, [productBarcodes]);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [originBanks, setOriginBanks] = useState<OriginBank[]>([]);
  const [installmentPlans, setInstallmentPlans] = useState<InstallmentPlan[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [promotions, setPromotions] = useState<PromotionWithDetails[]>([]);

  // Generación reactiva de artículos virtuales para promociones activas
  const promoVirtualProducts = useMemo<Product[]>(() => {
    const productsMap = new Map<string, Product>();
    for (const p of products) {
      productsMap.set(p.id, p);
    }

    return promotions
      .filter((promo) => promo.is_active)
      .map((promo) => {
        let items = promo.items ?? [];
        if (!items.length && promo.product_id) {
          items = [
            {
              id: `promo-item-${promo.id}`,
              tenant_id: promo.tenant_id,
              promotion_id: promo.id,
              product_id: promo.product_id,
              quantity: promo.min_quantity ?? 1,
              created_at: promo.created_at,
              updated_at: promo.updated_at,
            },
          ];
        }
        if (!items.length) return null;

        let regularTotal = 0;
        let maxCombos = Infinity;

        for (const it of items) {
          const prod = productsMap.get(it.product_id);
          const pPrice = prod?.price ?? 0;
          const pStock = prod?.stock_current ?? 0;
          regularTotal += pPrice * it.quantity;

          const availableFromProd = it.quantity > 0 ? Math.floor(pStock / it.quantity) : 0;
          if (availableFromProd < maxCombos) {
            maxCombos = availableFromProd;
          }
        }

        if (!Number.isFinite(maxCombos) || maxCombos < 0) {
          maxCombos = 0;
        }

        let finalPrice = regularTotal;
        if (promo.combo_price != null && promo.combo_price > 0) {
          finalPrice = promo.combo_price;
        } else if (promo.type === "percentage_discount" && promo.discount_percent) {
          finalPrice = Math.max(0, regularTotal * (1 - promo.discount_percent / 100));
        } else if (promo.type === "fixed_discount" && promo.discount_amount) {
          finalPrice = Math.max(0, regularTotal - promo.discount_amount);
        }

        const promoName = promo.name.toUpperCase().startsWith("PROMO")
          ? promo.name
          : `PROMO: ${promo.name}`;

        const promoProd: Product = {
          id: `promo-${promo.id}`,
          tenant_id: promo.tenant_id,
          code: promo.code,
          name: promoName,
          brand: "Promoción",
          supplier: null,
          category: "Promociones",
          subcategory: promo.scope === "bundle" ? "Packs y Combos" : "Descuentos",
          description: promo.description || `Promoción ${promo.name}`,
          sale_mode: "unit",
          price: roundAmount(finalPrice),
          cost_price: 0,
          stock_current: maxCombos,
          stock_min: null,
          stock_max: null,
          currency_code: "ARS",
          price_without_vat: roundAmount(finalPrice / 1.21),
          vat_percent: 21,
          profit_percent: 0,
          is_active: true,
          is_favorite: false,
          image_url: null,
          created_at: promo.created_at,
          updated_at: promo.updated_at,
        };

        return promoProd;
      })
      .filter((p): p is Product => p !== null);
  }, [promotions, products]);

  // Catálogo completo que incluye productos regulares y promociones virtuales
  const catalogProducts = useMemo<Product[]>(() => {
    return [...products, ...promoVirtualProducts];
  }, [products, promoVirtualProducts]);

  const effectivePrimaryBarcodes = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = { ...actualPrimaryBarcodes, ...primaryBarcodes };
    for (const promo of promotions) {
      if (promo.is_active) {
        const barcode = promo.barcodes?.[0]?.barcode || buildPromotionBarcode(promo.code);
        map[`promo-${promo.id}`] = barcode;
      }
    }
    return map;
  }, [actualPrimaryBarcodes, primaryBarcodes, promotions]);

  const [posSettings, setPosSettings] = useState<PosSettings>(defaultPosSettings);
  const [scaleSettings, setScaleSettings] = useState<BarcodeScaleSettings>(defaultBarcodeScaleSettings);
  const [mercadoPagoSettings, setMercadoPagoSettings] = useState<MercadoPagoSettings>(
    defaultMercadoPagoSettings
  );
  const [arcaSettings, setArcaSettings] = useState<ArcaSettings>(defaultArcaSettings);
  const [requireOpenSessionForSale, setRequireOpenSessionForSale] = useState(false);
  const [paymentMethodInvoiceRules, setPaymentMethodInvoiceRules] = useState<PaymentMethodInvoiceRules | null>(null);
  const [defaultInvoiceDocumentType, setDefaultInvoiceDocumentType] =
    useState<InvoiceDocumentType>("B");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId]
  );
  const [cartState, setCartState] = useState<PosCartItem[]>([]);
  const [cartManualDiscount, setCartManualDiscount] = useState<CartManualDiscount | null>(null);
  const [discountsEnabled, setDiscountsEnabled] = useState(true);
  const [roundingEnabled, setRoundingEnabled] = useState<boolean>(true);
  const [lastAddedProductId, setLastAddedProductId] = useState<string | null>(null);
  const [saleTabs, setSaleTabs] = useState<PosSaleTab[]>([
    { id: "sale-1", label: "Venta 1", cart: [], selectedCustomerId: "" },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>("sale-1");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMercadoPagoLoading, setIsMercadoPagoLoading] = useState(false);
  const [feedback, setFeedback] = useState<PosFeedback | null>(null);
  const [generatedReceipt, setGeneratedReceipt] = useState<Receipt | null>(null);
  const [generatedInvoice, setGeneratedInvoice] = useState<Invoice | null>(null);
  const [mercadoPagoIntent, setMercadoPagoIntent] = useState<MercadoPagoPaymentIntent | null>(null);
  const cartRef = useRef<PosCartItem[]>([]);
  const isConfirmingSaleRef = useRef(false);

  const toggleDiscounts = useCallback(() => {
    setDiscountsEnabled((prev) => !prev);
  }, []);

  const toggleRounding = useCallback(() => {
    setRoundingEnabled((prev) => !prev);
  }, []);

  useEffect(() => {
    if (posSettings?.rounding_enabled !== undefined) {
      setRoundingEnabled(posSettings.rounding_enabled);
    }
  }, [posSettings?.rounding_enabled]);

  useEffect(() => {
    cartRef.current = cartState;
    setSaleTabs((prevTabs) =>
      prevTabs.map((tab) =>
        tab.id === activeTabId
          ? {
              ...tab,
              cart: cartState,
              cartManualDiscount,
              roundingEnabled,
            }
          : tab
      )
    );
  }, [cartState, activeTabId, cartManualDiscount, roundingEnabled]);

  // Si el carrito queda vacío (0 ítems), asegurar que no quede ningún descuento manual residual
  useEffect(() => {
    if (cartState.length === 0 && cartManualDiscount !== null) {
      setCartManualDiscount(null);
    }
  }, [cartState.length, cartManualDiscount]);

  const switchSaleTab = useCallback(
    (tabId: string) => {
      setSaleTabs((currentTabs) => {
        const target = currentTabs.find((t) => t.id === tabId);
        if (!target) return currentTabs;
        setActiveTabId(tabId);
        setCartState(target.cart);
        setSelectedCustomerId(target.selectedCustomerId);
        setCartManualDiscount(target.cartManualDiscount ?? null);
        setRoundingEnabled(target.roundingEnabled ?? (posSettings?.rounding_enabled ?? true));
        return currentTabs;
      });
    },
    [posSettings?.rounding_enabled]
  );

  const createNewSaleTab = useCallback(() => {
    setSaleTabs((currentTabs) => {
      const existingNumbers = currentTabs
        .map((t) => {
          const match = t.label.match(/\d+/);
          return match ? Number(match[0]) : 0;
        })
        .filter((n) => n > 0);
      const nextNumber =
        existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : currentTabs.length + 1;

      const defaultRounding = posSettings?.rounding_enabled ?? true;
      const newTab: PosSaleTab = {
        id: `sale-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: `Venta ${nextNumber}`,
        cart: [],
        selectedCustomerId: "",
        cartManualDiscount: null,
        roundingEnabled: defaultRounding,
      };

      setActiveTabId(newTab.id);
      setCartState([]);
      setSelectedCustomerId("");
      setCartManualDiscount(null);
      setRoundingEnabled(defaultRounding);
      return [...currentTabs, newTab];
    });
  }, [posSettings?.rounding_enabled]);

  const closeSaleTab = useCallback(
    (tabId: string) => {
      const defaultRounding = posSettings?.rounding_enabled ?? true;
      setSaleTabs((currentTabs) => {
        if (currentTabs.length <= 1) {
          const resetTab: PosSaleTab = {
            id: `sale-${Date.now()}`,
            label: "Venta 1",
            cart: [],
            selectedCustomerId: "",
            cartManualDiscount: null,
            roundingEnabled: defaultRounding,
          };
          setActiveTabId(resetTab.id);
          setCartState([]);
          setSelectedCustomerId("");
          setCartManualDiscount(null);
          setRoundingEnabled(defaultRounding);
          return [resetTab];
        }

        const remaining = currentTabs.filter((t) => t.id !== tabId);
        if (activeTabId === tabId) {
          const nextActive = remaining[remaining.length - 1];
          setActiveTabId(nextActive.id);
          setCartState(nextActive.cart);
          setSelectedCustomerId(nextActive.selectedCustomerId);
          setCartManualDiscount(nextActive.cartManualDiscount ?? null);
          setRoundingEnabled(nextActive.roundingEnabled ?? defaultRounding);
        }
        return remaining;
      });
    },
    [activeTabId, posSettings?.rounding_enabled]
  );

  const clearFeedback = useCallback(() => {
    setFeedback(null);
  }, []);

  const clearGeneratedReceipt = useCallback(() => {
    setGeneratedReceipt(null);
    setGeneratedInvoice(null);
  }, []);

  const applyOfflineSnapshot = useCallback((snapshot: NonNullable<ReturnType<typeof offlineService.getPosSnapshot>>) => {
    setProducts(snapshot.products);
    setProductBarcodes(snapshot.product_barcodes);
    setPrimaryBarcodes(
      snapshot.product_barcodes.reduce<Record<string, string>>((acc, row) => {
        if (row.is_primary) acc[row.product_id] = row.barcode;
        return acc;
      }, {})
    );
    setCustomers(snapshot.customers);
    setPaymentMethods(snapshot.payment_methods);
    setBankAccounts(snapshot.bank_accounts);
    setOriginBanks(snapshot.origin_banks);
    setInstallmentPlans(snapshot.installment_plans);
    setPriceLists(snapshot.price_lists);
    setPromotions(snapshot.promotions);
    setPosSettings(snapshot.pos_settings);
    setScaleSettings(snapshot.scale_settings);
    setMercadoPagoSettings(snapshot.mercado_pago_settings);
    setArcaSettings(snapshot.arca_settings);
    setRequireOpenSessionForSale(snapshot.require_open_session_for_sale);
    setDefaultInvoiceDocumentType(snapshot.default_invoice_document_type);
  }, []);

  const loadPosData = useCallback(
    async (force = false) => {
      if (!tenantId) {
        setProducts([]);
        setProductBarcodes([]);
        setPrimaryBarcodes({});
        setCustomers([]);
        setPaymentMethods([]);
        setBankAccounts([]);
        setOriginBanks([]);
        setInstallmentPlans([]);
        setPriceLists([]);
        setPromotions([]);
        setPosSettings(defaultPosSettings);
        setScaleSettings(defaultBarcodeScaleSettings);
        setMercadoPagoSettings(defaultMercadoPagoSettings);
        setArcaSettings(defaultArcaSettings);
        setRequireOpenSessionForSale(false);
        setDefaultInvoiceDocumentType("B");
        setSelectedCustomerId("");
        setCartState([]);
        setMercadoPagoIntent(null);
        return;
      }

      // 1. Hidratar instantáneamente con caché persistente en memoria si existe
      const cachedStore = useProductsStore.getState();
      let hasCachedCatalog =
        cachedStore.loadedTenantId === tenantId && cachedStore.products.length > 0;

      if (hasCachedCatalog) {
        setProducts(cachedStore.products.filter((product) => product.is_active !== false));
        setProductBarcodes(cachedStore.allBarcodes);
        setPrimaryBarcodes(cachedStore.primaryBarcodes);
        setPriceLists(cachedStore.priceLists);
      } else {
        // Intentar cargar snapshot offline local si existe para este tenant antes de bloquear
        await offlineService.hydrate();
        const snapshot = offlineService.getPosSnapshot(tenantId);
        if (snapshot && snapshot.products.length > 0) {
          applyOfflineSnapshot(snapshot);
          useProductsStore.setState({
            products: snapshot.products,
            allBarcodes: snapshot.product_barcodes,
            primaryBarcodes: snapshot.product_barcodes.reduce<Record<string, string>>((acc, row) => {
              if (row.is_primary) acc[row.product_id] = row.barcode;
              return acc;
            }, {}),
            priceLists: snapshot.price_lists,
            loadedTenantId: tenantId,
            lastLoadedAt: Date.now(),
          });
          hasCachedCatalog = true;
        } else {
          setIsLoading(true);
        }
      }

      try {
        await offlineService.hydrate();
        if (!isOnline) {
          const snapshot = offlineService.getPosSnapshot(tenantId);
          if (!snapshot) {
            setFeedback({
              type: "error",
              message:
                "No hay una copia local del POS para este comercio. Conectate una vez para prepararlo.",
            });
            return;
          }
          applyOfflineSnapshot(snapshot);
          setFeedback({
            type: "success",
            message: "POS listo sin conexion con datos guardados localmente.",
          });
          return;
        }

        await Promise.allSettled([
          originBanksService.ensureDefaults(tenantId),
          installmentPlansService.ensureDefaults(tenantId),
        ]);

        const shouldFetchCatalog = force || !hasCachedCatalog;

        const [
          allProductsResult,
          allProductBarcodesResult,
          allPriceListsResult,
          allCustomersResult,
          allActivePaymentMethodsResult,
          allActiveBankAccountsResult,
          allActiveOriginBanksResult,
          allActiveInstallmentPlansResult,
          allActivePromotionsResult,
          tenantSettingsResult,
          allEmployeesResult,
        ] = await Promise.allSettled([
          shouldFetchCatalog
            ? productsService.getAllByTenant(tenantId)
            : Promise.resolve(useProductsStore.getState().products),
          shouldFetchCatalog
            ? productsService.getBarcodesByTenant(tenantId)
            : Promise.resolve(useProductsStore.getState().allBarcodes),
          shouldFetchCatalog
            ? priceListsService.getAllByTenant(tenantId)
            : Promise.resolve(useProductsStore.getState().priceLists),
          customersService.getAllByTenant(tenantId),
          paymentMethodsService.getActiveByTenant(tenantId),
          bankAccountsService.getActiveByTenant(tenantId),
          originBanksService.getActiveByTenant(tenantId),
          installmentPlansService.getActiveByTenant(tenantId),
          promotionsService.getActiveByTenantWithDetails(tenantId),
          settingsService.getByTenant(tenantId),
          employeesService.getAllByTenant(tenantId),
        ]);

        const allProducts =
          allProductsResult.status === "fulfilled"
            ? allProductsResult.value
            : useProductsStore.getState().products;
        const allProductBarcodes =
          allProductBarcodesResult.status === "fulfilled"
            ? allProductBarcodesResult.value
            : useProductsStore.getState().allBarcodes;
        const allPriceLists =
          allPriceListsResult.status === "fulfilled"
            ? allPriceListsResult.value
            : useProductsStore.getState().priceLists;
        const allCustomers =
          allCustomersResult.status === "fulfilled" ? allCustomersResult.value : [];
        const allActivePaymentMethods =
          allActivePaymentMethodsResult.status === "fulfilled"
            ? allActivePaymentMethodsResult.value
            : [];
        const allActiveBankAccounts =
          allActiveBankAccountsResult.status === "fulfilled"
            ? allActiveBankAccountsResult.value
            : [];
        const allActiveOriginBanks =
          allActiveOriginBanksResult.status === "fulfilled"
            ? allActiveOriginBanksResult.value
            : [];
        const allActiveInstallmentPlans =
          allActiveInstallmentPlansResult.status === "fulfilled"
            ? allActiveInstallmentPlansResult.value
            : [];
        const allActivePromotions =
          allActivePromotionsResult.status === "fulfilled"
            ? allActivePromotionsResult.value
            : [];
        const tenantSettings =
          tenantSettingsResult.status === "fulfilled" ? tenantSettingsResult.value : null;
        const allEmployees =
          allEmployeesResult.status === "fulfilled" ? allEmployeesResult.value : [];

        const hasPartialErrors =
          (shouldFetchCatalog && allProductsResult.status === "rejected") ||
          (shouldFetchCatalog && allProductBarcodesResult.status === "rejected") ||
          (shouldFetchCatalog && allPriceListsResult.status === "rejected") ||
          allCustomersResult.status === "rejected" ||
          allActivePaymentMethodsResult.status === "rejected" ||
          allActiveBankAccountsResult.status === "rejected" ||
          allActiveOriginBanksResult.status === "rejected" ||
          allActiveInstallmentPlansResult.status === "rejected" ||
          allActivePromotionsResult.status === "rejected" ||
          tenantSettingsResult.status === "rejected";

        const activeCustomers = allCustomers.filter((customer) => customer.is_active);
        const allowNegativeStock = Boolean(
          tenantSettings?.stock?.allow_negative_stock ?? tenantSettings?.pos?.allow_negative_stock
        );
        const resolvedPosSettings: PosSettings = {
          ...(tenantSettings?.pos ?? defaultPosSettings),
          allow_negative_stock: allowNegativeStock,
        };
        const resolvedMercadoPagoSettings = {
          ...defaultMercadoPagoSettings,
          ...(tenantSettings?.sistema?.mercado_pago ?? {}),
        };
        const cleanArcaCuit = (
          tenantSettings?.facturacion?.arca?.cuit_emisor ||
          tenantSettings?.facturacion?.issuer_cuit ||
          ""
        ).replace(/\D/g, "");
        const localCrt =
          typeof window !== "undefined" && cleanArcaCuit
            ? localStorage.getItem(`arca_saved_crt_${cleanArcaCuit}`)
            : null;
        const localKey =
          typeof window !== "undefined" && cleanArcaCuit
            ? localStorage.getItem(`arca_saved_key_${cleanArcaCuit}`)
            : null;

        const resolvedArcaSettings = {
          ...defaultArcaSettings,
          ...(tenantSettings?.facturacion?.arca ?? {}),
          certificate_crt:
            tenantSettings?.facturacion?.arca?.certificate_crt || localCrt,
          certificate_key:
            tenantSettings?.facturacion?.arca?.certificate_key || localKey,
        };

        const activeProducts = allProducts.filter((product) => product.is_active !== false);
        const validProductBarcodes = allProductBarcodes.filter((row) => Boolean(row.barcode && row.product_id));
        const primaryBarcodeMap: Record<string, string> = {};
        for (const row of validProductBarcodes) {
          if (row.is_primary || !primaryBarcodeMap[row.product_id]) {
            primaryBarcodeMap[row.product_id] = row.barcode;
          }
        }
        for (const product of activeProducts) {
          if (!primaryBarcodeMap[product.id] && product.code) {
            primaryBarcodeMap[product.id] = product.code;
          }
        }

        setProducts(activeProducts);
        setProductBarcodes(validProductBarcodes);
        setPrimaryBarcodes(primaryBarcodeMap);
        setPriceLists(allPriceLists);

        if (allProducts.length > 0 && shouldFetchCatalog) {
          useProductsStore.setState({
            products: allProducts,
            allBarcodes: validProductBarcodes,
            primaryBarcodes: primaryBarcodeMap,
            priceLists: allPriceLists,
            loadedTenantId: tenantId,
            lastLoadedAt: Date.now(),
          });
        }

      setCustomers(activeCustomers);
      setEmployees(allEmployees.filter((emp) => emp.is_active));
      setPaymentMethods(
        [...allActivePaymentMethods].sort((a, b) => {
          const priorityDiff = paymentMethodPriority(a) - paymentMethodPriority(b);
          if (priorityDiff !== 0) return priorityDiff;
          return a.name.localeCompare(b.name);
        })
      );
      setBankAccounts(
        [...allActiveBankAccounts].sort((a, b) => a.bank_name.localeCompare(b.bank_name))
      );
      setOriginBanks(
        [...allActiveOriginBanks].sort((a, b) => a.name.localeCompare(b.name))
      );
      setInstallmentPlans(
        [...allActiveInstallmentPlans].sort((a, b) => {
          if (a.installments !== b.installments) return a.installments - b.installments;
          return a.name.localeCompare(b.name);
        })
      );
      setPriceLists([...allPriceLists].sort((a, b) => a.name.localeCompare(b.name)));
      setPromotions(allActivePromotions);
      setPosSettings(resolvedPosSettings);
      setScaleSettings(tenantSettings?.codigos_balanza ?? defaultBarcodeScaleSettings);
      setMercadoPagoSettings(resolvedMercadoPagoSettings);
      setArcaSettings(resolvedArcaSettings);
      setRequireOpenSessionForSale(tenantSettings?.caja?.require_open_session_for_sale ?? false);
      setDefaultInvoiceDocumentType(tenantSettings?.facturacion?.default_document_type ?? "B");
      setPaymentMethodInvoiceRules(tenantSettings?.facturacion?.payment_method_rules ?? null);
      setSelectedCustomerId((current) =>
        current && activeCustomers.some((customer) => customer.id === current)
          ? current
          : ""
      );

      offlineService.savePosSnapshot({
        tenant_id: tenantId,
        saved_at: new Date().toISOString(),
        products: activeProducts,
        product_barcodes: allProductBarcodes,
        customers: activeCustomers,
        payment_methods: [...allActivePaymentMethods].sort((a, b) => paymentMethodPriority(a) - paymentMethodPriority(b)),
        bank_accounts: [...allActiveBankAccounts].sort((a, b) => a.bank_name.localeCompare(b.bank_name)),
        origin_banks: [...allActiveOriginBanks].sort((a, b) => a.name.localeCompare(b.name)),
        installment_plans: [...allActiveInstallmentPlans].sort((a, b) => a.installments - b.installments || a.name.localeCompare(b.name)),
        price_lists: [...allPriceLists].sort((a, b) => a.name.localeCompare(b.name)),
        promotions: allActivePromotions,
        pos_settings: resolvedPosSettings,
        scale_settings: tenantSettings?.codigos_balanza ?? defaultBarcodeScaleSettings,
        // Los cobros online se bloquean sin conexion; no persistimos credenciales en el dispositivo.
        mercado_pago_settings: { ...resolvedMercadoPagoSettings, access_token: "" },
        arca_settings: resolvedArcaSettings,
        require_open_session_for_sale: tenantSettings?.caja?.require_open_session_for_sale ?? false,
        default_invoice_document_type: tenantSettings?.facturacion?.default_document_type ?? "B",
        open_cash_session: offlineService.getPosSnapshot(tenantId)?.open_cash_session ?? null,
      });

      if (hasPartialErrors) {
        setFeedback({
          type: "error",
          message: "Algunos datos del POS no cargaron por completo. Recarga para reintentar.",
        });
      }
    } catch {
      setFeedback({ type: "error", message: "No se pudieron cargar datos del POS" });
    } finally {
      setIsLoading(false);
    }
  }, [applyOfflineSnapshot, isOnline, tenantId]);

  useEffect(() => {
    void loadPosData(false);
  }, [loadPosData]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== "pos-v2-mock-db" && event.key !== storageKeys.productsCatalog) return;
      if (!tenantId) return;

      if (event.key === storageKeys.productsCatalog) {
        const updatedStore = useProductsStore.getState();
        if (updatedStore.loadedTenantId === tenantId && updatedStore.products.length > 0) {
          setProducts(updatedStore.products.filter((product) => product.is_active !== false));
          setProductBarcodes(updatedStore.allBarcodes);
          setPrimaryBarcodes(updatedStore.primaryBarcodes);
          setPriceLists(updatedStore.priceLists);
        }
        return;
      }

      void loadPosData(false);
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [loadPosData, tenantId]);

  const getCustomerPriceList = useCallback(
    (customerId: string | null) => {
      if (!customerId) return null;
      const customer = customers.find((item) => item.id === customerId);
      if (!customer?.price_list_id) return null;
      return priceLists.find((item) => item.id === customer.price_list_id) ?? null;
    },
    [customers, priceLists]
  );

  const resolvePricingForProduct = useCallback(
    async (product: Product, customerId: string | null) => {
      const assignedPriceList = getCustomerPriceList(customerId);

      if (!tenantId || !assignedPriceList) {
        return {
          unitPrice: roundAmount(product.price),
          priceListId: null,
          priceListName: null,
          priceListIsActive: null,
        };
      }

      const resolvedPrice = await priceListsService.resolveProductPrice(
        tenantId,
        assignedPriceList.id,
        product.id,
        product.price
      );

      return {
        unitPrice: roundAmount(resolvedPrice),
        priceListId: assignedPriceList.id,
        priceListName: assignedPriceList.name,
        priceListIsActive: assignedPriceList.is_active,
      };
    },
    [getCustomerPriceList, tenantId]
  );

  const previousCustomerIdRef = useRef<string | null>(null);

  const recalculateCartPricesForCustomer = useCallback(
    async (customerId: string | null) => {
      const cartSnapshot = cartRef.current;
      if (!cartSnapshot.length) return;

      const resolvedItems = await Promise.all(
        cartSnapshot.map(async (item) => {
          const product = products.find((candidate) => candidate.id === item.product_id);
          if (!product) return item;

          // Si el usuario modificó manualmente el precio del producto, nunca sobreescribirlo
          if (item.is_price_overridden) {
            return {
              ...item,
              stock_available: product.stock_current,
            };
          }

          const pricing = await resolvePricingForProduct(product, customerId);
          const hasCustomerPriceList = Boolean(pricing.priceListId);
          const scaleUnitPrice =
            item.is_scale_item &&
            !hasCustomerPriceList &&
            item.scale_weight != null &&
            item.scale_weight > 0 &&
            item.scale_total_price != null &&
            item.scale_total_price > 0
              ? roundAmount(item.scale_total_price / item.scale_weight)
              : null;

          return {
            ...item,
            unit_price: scaleUnitPrice ?? pricing.unitPrice,
            base_unit_price: roundAmount(product.price),
            stock_available: product.stock_current,
            price_list_id: pricing.priceListId,
            price_list_name: pricing.priceListName,
            price_list_is_active: pricing.priceListIsActive,
          };
        })
      );

      const snapshotKey = cartSnapshot.map((item) => item.product_id).join("|");
      setCartState((current) => {
        const currentKey = current.map((item) => item.product_id).join("|");
        if (currentKey !== snapshotKey) return current;
        return resolvedItems;
      });
    },
    [products, resolvePricingForProduct]
  );

  useEffect(() => {
    const currentId = selectedCustomerId || null;
    if (previousCustomerIdRef.current !== currentId) {
      previousCustomerIdRef.current = currentId;
      void recalculateCartPricesForCustomer(currentId);
    }
  }, [recalculateCartPricesForCustomer, selectedCustomerId]);

  const promotionsResolution = useMemo(
    () => {
      if (!discountsEnabled) {
        const eligibleItems = cartState.filter(
          (item) => !item.is_debt_payment_item && !item.is_promo_item && !item.is_package_refund_item && item.unit_price >= 0
        );
        const subtotal = roundAmount(
          eligibleItems.reduce((acc, item) => acc + item.quantity * item.unit_price, 0)
        );
        return {
          items: eligibleItems.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            line_subtotal: roundAmount(item.quantity * item.unit_price),
            line_total: roundAmount(item.quantity * item.unit_price),
            discount_total: 0,
            applied_promotion: null,
          })),
          product_discount_total: 0,
          cart_discount_total: 0,
          total_discount: 0,
          subtotal_before_promotions: subtotal,
          subtotal_after_promotions: subtotal,
          applied_cart_promotion: null,
        };
      }

      return promotionsService.resolveApplicablePromotions(
        cartState
          .filter((item) => !item.is_debt_payment_item && !item.is_promo_item && !item.is_package_refund_item && item.unit_price >= 0)
          .map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
          })),
        new Date(),
        promotions
      );
    },
    [cartState, discountsEnabled, promotions]
  );

  const cart = useMemo<PosCartItemComputed[]>(() => {
    const resolutionByProductId = new Map(
      promotionsResolution.items.map((item) => [item.product_id, item])
    );

    const itemsWithProductPromotions = cartState.map((item) => {
      if (item.is_debt_payment_item || item.is_package_refund_item || item.unit_price < 0) {
        return {
          ...item,
          line_subtotal: roundAmount(item.quantity * item.unit_price),
          promotion_discount_total: 0,
          product_promotion_discount_total: 0,
          cart_promotion_discount_total: 0,
          line_total: roundAmount(item.quantity * item.unit_price),
          applied_promotion_name: null,
          applied_promotion_snapshot: null,
        };
      }

      // Los cobros de envase se agregan como ítems independientes en el carrito
      const returnableSurcharge = 0;

      const grossLine = roundAmount(item.quantity * item.unit_price);

      // 0. Si es un ítem de promoción virtual (pack o combo)
      if (item.is_promo_item) {
        const lineTotal = roundAmount(grossLine + returnableSurcharge);
        const regularLineSubtotal = roundAmount(
          (item.base_unit_price > 0 ? item.base_unit_price : item.unit_price) * item.quantity +
            returnableSurcharge
        );
        const promoSavings = roundAmount(Math.max(0, regularLineSubtotal - lineTotal));

        return {
          ...item,
          line_subtotal: regularLineSubtotal,
          promotion_discount_total: promoSavings,
          product_promotion_discount_total: promoSavings,
          cart_promotion_discount_total: 0,
          line_total: lineTotal,
          applied_promotion_name: item.name,
          applied_promotion_snapshot: {
            kind: "promo_item",
            promo_id: item.promo_id,
            promo_code: item.promo_code,
            promo_items: item.promo_items,
            savings: promoSavings,
          },
        };
      }

      // 1. Si tiene descuento manual específico en este ítem
      if (item.manual_discount && item.manual_discount.value > 0) {
        const discountAmt =
          item.manual_discount.type === "percent"
            ? roundAmount(grossLine * (item.manual_discount.value / 100))
            : roundAmount(Math.min(grossLine, item.manual_discount.value));
        const lineTotal = roundAmount(Math.max(0, grossLine - discountAmt) + returnableSurcharge);

        return {
          ...item,
          line_subtotal: roundAmount(grossLine + returnableSurcharge),
          promotion_discount_total: discountAmt,
          product_promotion_discount_total: discountAmt,
          cart_promotion_discount_total: 0,
          line_total: lineTotal,
          applied_promotion_name: item.manual_discount.reason ? `Desc: ${item.manual_discount.reason}` : "Desc. manual",
          applied_promotion_snapshot: {
            kind: "manual_discount",
            discount_type: item.manual_discount.type,
            discount_value: item.manual_discount.value,
            discount_reason: item.manual_discount.reason,
          },
        };
      }

      // 2. Si tiene promoción manual vinculada desde el módulo promociones
      if (item.manual_promotion) {
        const foundPromo = promotions.find((p) => p.id === item.manual_promotion?.id);
        const promoDiscount = foundPromo
          ? calculateProductPromotionDiscount(foundPromo, item.quantity, item.unit_price)
          : item.manual_promotion.discount_amount;
        const discountAmt = roundAmount(Math.min(grossLine, promoDiscount));
        const lineTotal = roundAmount(Math.max(0, grossLine - discountAmt) + returnableSurcharge);

        return {
          ...item,
          line_subtotal: roundAmount(grossLine + returnableSurcharge),
          promotion_discount_total: discountAmt,
          product_promotion_discount_total: discountAmt,
          cart_promotion_discount_total: 0,
          line_total: lineTotal,
          applied_promotion_name: item.manual_promotion.name,
          applied_promotion_snapshot: {
            type: "manual_promotion",
            ...item.manual_promotion,
          },
        };
      }

      // 3. Resolución automática estándar
      const resolved = resolutionByProductId.get(item.product_id);
      const baseSubtotal = resolved?.line_subtotal ?? grossLine;
      const baseLineTotal = resolved?.line_total ?? grossLine;

      return {
        ...item,
        line_subtotal: roundAmount(baseSubtotal + returnableSurcharge),
        promotion_discount_total: resolved?.discount_total ?? 0,
        product_promotion_discount_total: resolved?.discount_total ?? 0,
        cart_promotion_discount_total: 0,
        line_total: roundAmount(baseLineTotal + returnableSurcharge),
        applied_promotion_name: resolved?.applied_promotion?.name ?? null,
        applied_promotion_snapshot: resolved?.applied_promotion
          ? ({ ...resolved.applied_promotion } as Record<string, unknown>)
          : null,
      };
    });

    const isEmployeeDiscount = cartManualDiscount?.reason === "Descuento Empleado";
    const excludedCategories = (posSettings.employee_discount_excluded_categories || []).map((c) =>
      c.trim().toLowerCase()
    );

    const isItemEligible = (item: PosCartItemComputed) => {
      if (item.is_debt_payment_item || item.is_package_refund_item || item.unit_price < 0) return false;
      if (isEmployeeDiscount && item.category) {
        const cat = item.category.trim().toLowerCase();
        if (excludedCategories.includes(cat)) return false;
      }
      return true;
    };

    const eligibleItems = itemsWithProductPromotions.filter(isItemEligible);
    const subtotalAfterProductPromotions = roundAmount(
      eligibleItems.reduce((acc, item) => acc + item.line_total, 0)
    );

    // Descuento manual a nivel carrito si fue asignado
    let manualCartDiscountVal = 0;
    if (cartManualDiscount && cartManualDiscount.value > 0 && subtotalAfterProductPromotions > 0) {
      if (cartManualDiscount.type === "percent") {
        manualCartDiscountVal = roundAmount(subtotalAfterProductPromotions * (cartManualDiscount.value / 100));
      } else {
        manualCartDiscountVal = roundAmount(Math.min(subtotalAfterProductPromotions, cartManualDiscount.value));
      }
    }

    const totalCartDiscountToDistribute = roundAmount(
      promotionsResolution.cart_discount_total + manualCartDiscountVal
    );

    if (totalCartDiscountToDistribute <= 0 || !itemsWithProductPromotions.length) {
      return itemsWithProductPromotions;
    }

    if (subtotalAfterProductPromotions <= 0) {
      return itemsWithProductPromotions;
    }

    const allocated = itemsWithProductPromotions.map((item) => ({
      ...item,
      cart_promotion_discount_total: 0,
    }));

    let accumulated = 0;
    const eligibleIndices = allocated
      .map((item, idx) => (isItemEligible(item) ? idx : -1))
      .filter((idx) => idx !== -1);

    for (let i = 0; i < eligibleIndices.length; i += 1) {
      const index = eligibleIndices[i];
      const item = allocated[index];

      const isLast = i === eligibleIndices.length - 1;
      const proportional = isLast
        ? roundAmount(totalCartDiscountToDistribute - accumulated)
        : roundAmount(
            totalCartDiscountToDistribute * (item.line_total / subtotalAfterProductPromotions)
          );

      const itemCartDiscount = roundAmount(Math.min(item.line_total, Math.max(0, proportional)));
      accumulated = roundAmount(accumulated + itemCartDiscount);

      item.cart_promotion_discount_total = itemCartDiscount;
      item.promotion_discount_total = roundAmount(
        item.product_promotion_discount_total + item.cart_promotion_discount_total
      );
      item.line_total = roundAmount(item.line_total - itemCartDiscount);
    }

    return allocated;
  }, [cartManualDiscount, cartState, promotions, promotionsResolution, posSettings.employee_discount_excluded_categories]);

  const debtPaymentTotal = useMemo(
    () =>
      roundAmount(
        cartState
          .filter((item) => item.is_debt_payment_item)
          .reduce((acc, item) => acc + item.unit_price * item.quantity, 0)
      ),
    [cartState]
  );

  const hasOwedReturnables = useMemo(
    () => cart.some((i) => i.returnable_config?.enabled && i.returnable_status === "owe"),
    [cart]
  );

  const owedReturnablesCount = useMemo(
    () =>
      cart
        .filter((i) => i.returnable_config?.enabled && i.returnable_status === "owe")
        .reduce((sum, i) => sum + i.quantity, 0),
    [cart]
  );

  const subtotalBeforePromotions = useMemo(
    () =>
      roundAmount(
        cartState.reduce((acc, item) => acc + item.unit_price * item.quantity, 0)
      ),
    [cartState]
  );

  const promotionDiscountTotal = useMemo(
    () => roundAmount(cart.reduce((acc, item) => acc + item.product_promotion_discount_total, 0)),
    [cart]
  );

  const cartPromotionDiscountTotal = useMemo(
    () => roundAmount(cart.reduce((acc, item) => acc + item.cart_promotion_discount_total, 0)),
    [cart]
  );

  const manualCartDiscountTotal = useMemo(() => {
    if (!cartManualDiscount || cartManualDiscount.value <= 0) return 0;
    const isEmployeeDiscount = cartManualDiscount.reason === "Descuento Empleado";
    const excludedCategories = (posSettings.employee_discount_excluded_categories || []).map((c) =>
      c.trim().toLowerCase()
    );

    const eligibleSubtotal = roundAmount(
      cart
        .filter((item) => {
          if (item.is_debt_payment_item) return false;
          if (isEmployeeDiscount && item.category) {
            const cat = item.category.trim().toLowerCase();
            if (excludedCategories.includes(cat)) return false;
          }
          return true;
        })
        .reduce((acc, item) => acc + item.line_subtotal - item.product_promotion_discount_total, 0)
    );
    if (eligibleSubtotal <= 0) return 0;
    if (cartManualDiscount.type === "percent") {
      return roundAmount(eligibleSubtotal * (cartManualDiscount.value / 100));
    }
    return roundAmount(Math.min(eligibleSubtotal, cartManualDiscount.value));
  }, [cart, cartManualDiscount, posSettings.employee_discount_excluded_categories]);

  const totalPromotionDiscount = useMemo(
    () => roundAmount(promotionDiscountTotal + cartPromotionDiscountTotal),
    [cartPromotionDiscountTotal, promotionDiscountTotal]
  );

  const subtotal = useMemo(
    () => roundAmount(subtotalBeforePromotions - totalPromotionDiscount),
    [subtotalBeforePromotions, totalPromotionDiscount]
  );

  const addProductToCart = async (
    product: Product,
    quantity: number,
    options?: {
      overrideUnitPrice?: number | null;
      parsedScale?: ParsedScaleBarcode | null;
    }
  ): Promise<boolean> => {
    const normalizedQty = roundQty(quantity);

    if (!Number.isFinite(normalizedQty) || normalizedQty < 0) {
      setFeedback({ type: "error", message: "La cantidad no es válida" });
      return false;
    }

    if (product.sale_mode !== "weight" && normalizedQty <= 0) {
      setFeedback({ type: "error", message: "La cantidad debe ser mayor a 0" });
      return false;
    }

    // Manejo de productos virtuales de promociones (packs y combos unificados)
    if (product.id.startsWith("promo-")) {
      const promoId = product.id.replace("promo-", "");
      const promo = promotions.find((p) => p.id === promoId);
      if (!promo) {
        setFeedback({ type: "error", message: "Promoción no encontrada" });
        return false;
      }

      let promoItems = promo.items ?? [];
      if (!promoItems.length && promo.product_id) {
        promoItems = [
          {
            id: `promo-item-${promo.id}`,
            tenant_id: promo.tenant_id,
            promotion_id: promo.id,
            product_id: promo.product_id,
            quantity: promo.min_quantity ?? 1,
            created_at: promo.created_at,
            updated_at: promo.updated_at,
          },
        ];
      }

      const productsMap = new Map<string, Product>();
      for (const p of products) {
        productsMap.set(p.id, p);
      }

      const existingInCart = cartRef.current.find((it) => it.product_id === product.id);
      const nextPromoQty = roundQty((existingInCart?.quantity ?? 0) + normalizedQty);

      if (!posSettings.allow_negative_stock) {
        for (const it of promoItems) {
          const subProd = productsMap.get(it.product_id);
          const neededQty = nextPromoQty * it.quantity;
          if (subProd && subProd.stock_current < neededQty) {
            setFeedback({
              type: "error",
              message: `Stock insuficiente de "${subProd.name}" para ${nextPromoQty}x ${product.name} (Disponible: ${subProd.stock_current}, Requerido: ${neededQty})`,
            });
            return false;
          }
        }
      }

      const subItems: PosPromoSubItem[] = promoItems.map((it) => {
        const subProd = productsMap.get(it.product_id);
        return {
          product_id: it.product_id,
          name: subProd?.name ?? "Artículo",
          quantity: it.quantity,
          unit_price: subProd?.price ?? 0,
        };
      });

      const regularTotal = roundAmount(
        subItems.reduce((sum, it) => sum + it.unit_price * it.quantity, 0)
      );

      setLastAddedProductId(product.id);
      setCartState((prev) => {
        const existing = prev.find((item) => item.product_id === product.id);
        if (existing) {
          const updatedItem: PosCartItem = {
            ...existing,
            quantity: nextPromoQty,
            stock_available: product.stock_current,
            is_promo_item: true,
            promo_id: promo.id,
            promo_code: promo.code,
            promo_items: subItems,
          };
          return [updatedItem, ...prev.filter((it) => it.product_id !== product.id)];
        }

        const newItem: PosCartItem = {
          product_id: product.id,
          name: product.name,
          category: "Promociones",
          sale_mode: "unit",
          quantity: normalizedQty,
          unit_price: product.price,
          base_unit_price: regularTotal > 0 ? regularTotal : product.price,
          stock_available: product.stock_current,
          price_list_id: null,
          price_list_name: null,
          price_list_is_active: null,
          is_scale_item: false,
          scale_weight: null,
          scale_total_price: null,
          scale_barcode: null,
          is_manual_item: false,
          returnable_config: null,
          returnable_status: "exchange",
          code: promo.code,
          barcode: promo.barcodes?.[0]?.barcode || buildPromotionBarcode(promo.code),
          is_promo_item: true,
          promo_id: promo.id,
          promo_code: promo.code,
          promo_items: subItems,
        };

        return [newItem, ...prev];
      });

      return true;
    }

    const existingItem = cartRef.current.find((item) => item.product_id === product.id);
    const nextQty = roundQty((existingItem?.quantity ?? 0) + normalizedQty);

    if (!posSettings.allow_negative_stock && nextQty > product.stock_current) {
      setFeedback({
        type: "error",
        message: `Stock insuficiente para ${product.name}`,
      });
      return false;
    }

    const pricing = await resolvePricingForProduct(product, selectedCustomerId || null);
    const forcedUnitPrice =
      options?.overrideUnitPrice != null && options.overrideUnitPrice > 0
        ? roundAmount(options.overrideUnitPrice)
        : null;

    setLastAddedProductId(product.id);
    setCartState((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);

      if (existing) {
        const isPriceOverridden = Boolean(existing.is_price_overridden);
        const nextUnitPrice =
          forcedUnitPrice != null
            ? roundAmount(
                (existing.quantity * existing.unit_price + normalizedQty * forcedUnitPrice) / nextQty
              )
            : isPriceOverridden
            ? existing.unit_price
            : pricing.unitPrice;

        const updatedItem = {
          ...existing,
          quantity: nextQty,
          unit_price: nextUnitPrice,
          is_price_overridden: isPriceOverridden || forcedUnitPrice != null,
          base_unit_price: roundAmount(product.price),
          stock_available: product.stock_current,
          price_list_id: pricing.priceListId,
          price_list_name: pricing.priceListName,
          price_list_is_active: pricing.priceListIsActive,
          is_scale_item: existing.is_scale_item || Boolean(options?.parsedScale),
          scale_weight:
            options?.parsedScale?.weight != null
              ? roundQty((existing.scale_weight ?? 0) + options.parsedScale.weight)
              : existing.scale_weight,
          scale_total_price:
            options?.parsedScale?.totalPrice != null
              ? roundAmount((existing.scale_total_price ?? 0) + options.parsedScale.totalPrice)
              : existing.scale_total_price,
          scale_barcode: options?.parsedScale?.raw ?? existing.scale_barcode,
          is_manual_item: existing.is_manual_item,
          returnable_config: existing.returnable_config ?? parseReturnableConfig(product.description),
          returnable_status: existing.returnable_status ?? "exchange",
        };

        // El producto recién escaneado se mueve arriba de todo para visibilidad inmediata
        const packageId = `returnable-pkg-${product.id}`;
        const rest = prev.filter((item) => item.product_id !== product.id);
        const mappedRest = rest.map((item) =>
          item.product_id === packageId
            ? { ...item, quantity: updatedItem.quantity }
            : item
        );
        return [updatedItem, ...mappedRest];
      }

      const returnableConfig = parseReturnableConfig(product.description);

      return [
        {
          product_id: product.id,
          name: product.name,
          category: product.category,
          sale_mode: product.sale_mode,
          quantity: normalizedQty,
          unit_price: forcedUnitPrice ?? pricing.unitPrice,
          is_price_overridden: forcedUnitPrice != null,
          base_unit_price: roundAmount(product.price),
          stock_available: product.stock_current,
          price_list_id: pricing.priceListId,
          price_list_name: pricing.priceListName,
          price_list_is_active: pricing.priceListIsActive,
          is_scale_item: Boolean(options?.parsedScale),
          scale_weight: options?.parsedScale?.weight ?? null,
          scale_total_price: options?.parsedScale?.totalPrice ?? null,
          scale_barcode: options?.parsedScale?.raw ?? null,
          is_manual_item: false,
          returnable_config: returnableConfig,
          returnable_status: "exchange",
        },
        ...prev,
      ];
    });

    return true;
  };

  const addManualProductToCart = useCallback((input: PosQuickProductInput): boolean => {
    const quantity = roundQty(input.quantity);
    const unitPrice = roundAmount(input.unitPrice);
    const name = input.name.trim();
    const category = input.category.trim() || "Venta manual";

    if (!name) {
      setFeedback({ type: "error", message: "Ingresa el nombre del producto" });
      return false;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setFeedback({ type: "error", message: "La cantidad debe ser mayor a 0" });
      return false;
    }

    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      setFeedback({ type: "error", message: "El precio debe ser mayor a 0" });
      return false;
    }

    const manualId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setLastAddedProductId(manualId);
    setCartState((prev) => [
      {
        product_id: manualId,
        name,
        category,
        sale_mode: input.saleMode,
        quantity,
        unit_price: unitPrice,
        base_unit_price: unitPrice,
        stock_available: Number.MAX_SAFE_INTEGER,
        price_list_id: null,
        price_list_name: null,
        price_list_is_active: null,
        is_scale_item: false,
        scale_weight: null,
        scale_total_price: null,
        scale_barcode: null,
        is_manual_item: true,
      },
      ...prev,
    ]);

    return true;
  }, []);

  const addDebtPaymentToCart = useCallback(
    (input: {
      customer: Customer;
      amount: number;
      notes?: string;
    }): boolean => {
      const amount = roundAmount(input.amount);
      if (!input.customer) {
        setFeedback({ type: "error", message: "Selecciona un cliente para cobrar deuda" });
        return false;
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        setFeedback({ type: "error", message: "El monto debe ser mayor a 0" });
        return false;
      }

      const customer = input.customer;
      const debtItem: PosCartItem = {
        product_id: `debt-${customer.id}`,
        name: `Cobro Cta. Cte. - ${customer.full_name}`,
        category: "Cuenta Corriente",
        sale_mode: "unit",
        quantity: 1,
        unit_price: amount,
        base_unit_price: amount,
        stock_available: Number.MAX_SAFE_INTEGER,
        price_list_id: null,
        price_list_name: null,
        price_list_is_active: null,
        is_scale_item: false,
        scale_weight: null,
        scale_total_price: null,
        scale_barcode: null,
        is_manual_item: true,
        is_debt_payment_item: true,
        debt_customer_id: customer.id,
        debt_customer_name: customer.full_name,
      };

      if (selectedCustomerId !== customer.id) {
        setSelectedCustomerId(customer.id);
      }

      setLastAddedProductId(debtItem.product_id);
      setCartState((prev) => [
        debtItem,
        ...prev.filter((i) => !i.is_debt_payment_item),
      ]);

      setFeedback({
        type: "success",
        message: `Cobro de cuenta corriente (${currency.format(amount)}) agregado al carrito`,
      });
      return true;
    },
    [selectedCustomerId]
  );

  const removeDebtPaymentFromCart = useCallback(() => {
    setCartState((prev) => prev.filter((i) => !i.is_debt_payment_item));
  }, []);

  const addPackageRefundToCart = useCallback(
    (input: {
      packageName: string;
      quantity: number;
      unitPrice: number;
      notes?: string;
      customer?: Customer | null;
    }): boolean => {
      const quantity = Math.max(1, Math.round(input.quantity));
      const unitPrice = roundAmount(Math.abs(input.unitPrice));
      if (!input.packageName.trim()) {
        setFeedback({ type: "error", message: "Selecciona el envase a devolver" });
        return false;
      }
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        setFeedback({ type: "error", message: "El valor del envase debe ser mayor a 0" });
        return false;
      }

      const negativeUnitPrice = -unitPrice;
      const refundId = `package-refund-${Date.now()}`;

      const refundItem: PosCartItem = {
        product_id: refundId,
        name: `Devolución de envase: ${input.packageName.trim()}`,
        category: "Envases",
        sale_mode: "unit",
        quantity,
        unit_price: negativeUnitPrice,
        base_unit_price: negativeUnitPrice,
        stock_available: Number.MAX_SAFE_INTEGER,
        price_list_id: null,
        price_list_name: null,
        price_list_is_active: null,
        is_scale_item: false,
        scale_weight: null,
        scale_total_price: null,
        scale_barcode: null,
        is_manual_item: true,
        is_price_overridden: true,
        is_returnable_package_item: true,
        is_package_refund_item: true,
        package_refund_name: input.packageName.trim(),
        code: "DEV-ENVASE",
      };

      if (input.customer && selectedCustomerId !== input.customer.id) {
        setSelectedCustomerId(input.customer.id);
      }

      setLastAddedProductId(refundItem.product_id);
      setCartState((prev) => [...prev, refundItem]);

      setFeedback({
        type: "success",
        message: `Devolución de envase (${input.packageName}) agregada al carrito con valor en negativo`,
      });
      return true;
    },
    [selectedCustomerId]
  );

  const cycleReturnableStatus = useCallback(
    (productId: string) => {
      setCartState((prev) => {
        const targetIndex = prev.findIndex((item) => item.product_id === productId);
        if (targetIndex === -1) return prev;
        const targetItem = prev[targetIndex];
        if (!targetItem.returnable_config?.enabled) return prev;

        const currentStatus = targetItem.returnable_status ?? "exchange";
        let nextStatus: ReturnableCartStatus = "exchange";

        if (currentStatus === "exchange") {
          nextStatus = "charge";
        } else if (currentStatus === "charge") {
          nextStatus = "owe";
        } else {
          nextStatus = "exchange";
        }

        const packageId = `returnable-pkg-${productId}`;
        // Filtrar cualquier ítem de cobro de envase previo para este producto padre
        const withoutOldPkg = prev.filter((item) => item.product_id !== packageId);

        const updatedTarget: PosCartItem = {
          ...targetItem,
          returnable_status: nextStatus,
        };

        if (nextStatus === "charge") {
          const pkgItem: PosCartItem = {
            product_id: packageId,
            name: `Envase: ${targetItem.returnable_config.packageName}`,
            category: "Envases",
            sale_mode: "unit",
            quantity: targetItem.quantity,
            unit_price: targetItem.returnable_config.packagePrice,
            base_unit_price: targetItem.returnable_config.packagePrice,
            stock_available: Number.MAX_SAFE_INTEGER,
            price_list_id: null,
            price_list_name: null,
            price_list_is_active: null,
            is_scale_item: false,
            scale_weight: null,
            scale_total_price: null,
            scale_barcode: null,
            is_manual_item: true,
            is_returnable_package_item: true,
            parent_product_id: productId,
          };

          const result: PosCartItem[] = [];
          for (const item of withoutOldPkg) {
            if (item.product_id === productId) {
              result.push(updatedTarget);
              result.push(pkgItem);
            } else {
              result.push(item);
            }
          }
          return result;
        }

        return withoutOldPkg.map((item) =>
          item.product_id === productId ? updatedTarget : item
        );
      });
    },
    []
  );

  const createProductFromPosAndAddToCart = useCallback(
    async (input: PosQuickProductInput): Promise<boolean> => {
      if (!tenantId) return false;

      const quantity = roundQty(input.quantity);
      const unitPrice = roundAmount(input.unitPrice);
      const name = input.name.trim();
      const category = input.category.trim();
      const stock = roundQty(Math.max(input.stock, quantity));

      if (!name || !category || quantity <= 0 || unitPrice <= 0) {
        setFeedback({
          type: "error",
          message: !category
            ? "Debes establecer una categoría para el producto"
            : "Completa nombre, cantidad y precio",
        });
        return false;
      }

      const priceWithoutVat = roundAmount(unitPrice / 1.21);
      const profitPercent =
        input.costPrice > 0
          ? roundAmount(((priceWithoutVat - input.costPrice) / input.costPrice) * 100)
          : 0;

      // 1. CREACIÓN OPTIMISTA INMEDIATA (0ms de espera)
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const barcodeClean = input.barcode.trim();
      const code = input.code.trim() || null;

      const optimisticProduct: Product = {
        id: tempId,
        tenant_id: tenantId,
        code,
        name,
        image_url: null,
        brand: null,
        supplier: null,
        is_favorite: input.favorite,
        description: null,
        price: unitPrice,
        cost_price: roundAmount(input.costPrice),
        stock_current: stock,
        stock_min: null,
        stock_max: null,
        category,
        subcategory: null,
        sale_mode: input.saleMode,
        currency_code: "ARS",
        price_without_vat: priceWithoutVat,
        vat_percent: 21,
        profit_percent: profitPercent,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Impacto instantáneo en memoria local y carrito
      setProducts((current) =>
        [...current.filter((p) => p.id !== tempId), optimisticProduct].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
      useProductsStore.getState().upsertProduct(optimisticProduct);

      if (barcodeClean) {
        setPrimaryBarcodes((current) => ({ ...current, [tempId]: barcodeClean }));
        setProductBarcodes((current) => [
          ...current.filter((b) => b.product_id !== tempId),
          {
            id: `local-barcode-${tempId}`,
            tenant_id: tenantId,
            product_id: tempId,
            barcode: barcodeClean,
            is_primary: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);
        useProductsStore.getState().patchPrimaryBarcode(tempId, barcodeClean);
      }

      // Sumar al carrito en el acto (el modal se cierra inmediatamente)
      void addProductToCart(optimisticProduct, quantity);

      // 2. PERSISTENCIA EN SUPABASE EN SEGUNDO PLANO (Background Sync)
      void (async () => {
        try {
          const created = await productsService.create(tenantId, {
            code,
            name,
            image_url: null,
            brand: null,
            supplier: null,
            is_favorite: input.favorite,
            description: null,
            price: unitPrice,
            cost_price: roundAmount(input.costPrice),
            stock_current: stock,
            stock_min: null,
            stock_max: null,
            category,
            subcategory: null,
            sale_mode: input.saleMode,
            currency_code: "ARS",
            price_without_vat: priceWithoutVat,
            vat_percent: 21,
            profit_percent: profitPercent,
            is_active: true,
          });

          if (barcodeClean) {
            await productsService.setPrimaryBarcode(tenantId, created.id, barcodeClean);
          }

          // Reemplazar tempId por created.id en memoria y en el carrito sin molestar al usuario
          setProducts((current) =>
            [...current.filter((p) => p.id !== tempId && p.id !== created.id), created].sort((a, b) =>
              a.name.localeCompare(b.name)
            )
          );
          useProductsStore.getState().upsertProduct(created);

          // Actualizar ID en el carrito si aún está cargado
          setCartState((prev) =>
            prev.map((item) =>
              item.product_id === tempId ? { ...item, product_id: created.id } : item
            )
          );

          if (barcodeClean) {
            setPrimaryBarcodes((current) => {
              const next = { ...current, [created.id]: barcodeClean };
              delete next[tempId];
              return next;
            });
            setProductBarcodes((current) => [
              ...current.filter((b) => b.product_id !== tempId && b.product_id !== created.id),
              {
                id: `barcode-${created.id}`,
                tenant_id: tenantId,
                product_id: created.id,
                barcode: barcodeClean,
                is_primary: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ]);
            useProductsStore.getState().patchPrimaryBarcode(created.id, barcodeClean);
          }

          void auditService.createSafe(tenantId, {
            user_id: null,
            module: "pos",
            action: "quick_product_create",
            entity_type: "product",
            entity_id: created.id,
            description: `Producto creado desde POS: ${created.name}`,
            metadata: {
              code: created.code,
              category: created.category,
              price: created.price,
              stock_current: created.stock_current,
            },
          });
        } catch (error) {
          const message =
            error instanceof Error && error.message
              ? error.message
              : "No se pudo sincronizar el nuevo producto con el servidor";
          setFeedback({ type: "error", message });
        }
      })();

      return true;
    },
    [addProductToCart, tenantId]
  );

  const findPromotionByBarcode = useCallback(
    (rawBarcode: string): PromotionWithDetails | null => {
      const barcode = normalizeBarcodeValue(rawBarcode).toLowerCase();
      if (!barcode) return null;

      return (
        promotions.find((promotion) => {
          if (normalizeBarcodeValue(promotion.code).toLowerCase() === barcode) return true;
          if (normalizeBarcodeValue(buildPromotionBarcode(promotion.code)).toLowerCase() === barcode) {
            return true;
          }
          return (promotion.barcodes ?? []).some(
            (row) => normalizeBarcodeValue(row.barcode).toLowerCase() === barcode
          );
        }) ?? null
      );
    },
    [promotions]
  );

  const addPromotionToCart = useCallback(
    async (promotion: PromotionWithDetails, rawBarcode: string): Promise<BarcodeScanResult> => {
      const virtualProduct = promoVirtualProducts.find((p) => p.id === `promo-${promotion.id}`);
      if (!virtualProduct) {
        const message = `Promoción "${promotion.name}" no disponible en el catálogo`;
        setFeedback({ type: "error", message });
        return { ok: false, barcode: rawBarcode, promotion, error: message };
      }

      const scanQuantity = Math.max(0.001, posSettings.barcode_scan_quantity || 1);
      const added = await addProductToCart(virtualProduct, scanQuantity);
      if (!added) {
        return {
          ok: false,
          barcode: rawBarcode,
          promotion,
          error: "No se pudo agregar la promoción al carrito (verificar stock)",
        };
      }

      return { ok: true, barcode: rawBarcode, promotion, parsedScale: null };
    },
    [promoVirtualProducts, addProductToCart, posSettings.barcode_scan_quantity]
  );

  const normalizePluCode = (value: string): string => value.replace(/^0+/, "");

  const findProductByPluCode = useCallback(
    (pluCode: string): Product | null => {
      const normalizedInput = normalizePluCode(pluCode);
      const byCode =
        products.find(
          (product) =>
            Boolean(product.code) &&
            (product.code === pluCode || normalizePluCode(product.code as string) === normalizedInput)
        ) ?? null;
      if (byCode) return byCode;

      const barcodeRow =
        productBarcodes.find(
          (row) =>
            row.barcode === pluCode ||
            normalizePluCode(row.barcode) === normalizedInput
        ) ?? null;
      if (!barcodeRow) return null;

      return products.find((product) => product.id === barcodeRow.product_id) ?? null;
    },
    [productBarcodes, products]
  );

  const findProductByUnitBarcode = useCallback(
    (barcode: string): Product | null => {
      const normalizedBarcode = normalizeBarcodeValue(barcode);
      if (!normalizedBarcode) return null;
      const strippedBarcode = normalizedBarcode.replace(/^0+/, "");

      // 1. Coincidencia directa en productBarcodes (con o sin is_primary)
      let barcodeRow =
        productBarcodes.find(
          (row) => normalizeBarcodeValue(row.barcode) === normalizedBarcode && row.is_primary
        ) ??
        productBarcodes.find(
          (row) => normalizeBarcodeValue(row.barcode) === normalizedBarcode
        ) ??
        null;

      // Si no coincide directo, intentar quitando ceros a la izquierda (ej: EAN-13 / UPC discrepancias)
      if (!barcodeRow && strippedBarcode) {
        barcodeRow =
          productBarcodes.find(
            (row) => normalizeBarcodeValue(row.barcode).replace(/^0+/, "") === strippedBarcode
          ) ?? null;
      }

      if (barcodeRow) {
        const candidate = products.find((product) => product.id === barcodeRow.product_id);
        if (candidate) return candidate;
      }

      // 2. Coincidencia por mapa de primaryBarcodes
      for (const [productId, pBarcode] of Object.entries(primaryBarcodes)) {
        if (!pBarcode) continue;
        const normPBarcode = normalizeBarcodeValue(pBarcode);
        if (
          normPBarcode === normalizedBarcode ||
          (strippedBarcode && normPBarcode.replace(/^0+/, "") === strippedBarcode)
        ) {
          const candidate = products.find((p) => p.id === productId);
          if (candidate) return candidate;
        }
      }

      // 3. Fallback: coincidencia por código de producto directo (exacto o quitando ceros a la izquierda)
      return (
        products.find((product) => {
          if (!product.code) return false;
          const normCode = normalizeBarcodeValue(product.code as string);
          if (normCode === normalizedBarcode) return true;
          if (strippedBarcode && normCode.replace(/^0+/, "") === strippedBarcode) return true;
          return false;
        }) ?? null
      );
    },
    [productBarcodes, primaryBarcodes, products]
  );

  const addProductByBarcode = useCallback(
    async (rawBarcode: string): Promise<BarcodeScanResult> => {
      const barcode = normalizeBarcodeValue(rawBarcode);
      if (!tenantId || !barcode) {
        return { ok: false, barcode, error: "Codigo de barras invalido" };
      }

      const parsedScale = parseScaleBarcode(barcode, scaleSettings);
      if (parsedScale) {
        const scaleProduct = findProductByPluCode(parsedScale.productCode);
        if (!scaleProduct || !scaleProduct.is_active) {
          const message = `No se encontro producto para PLU ${parsedScale.productCode}`;
          setFeedback({ type: "error", message });
          return { ok: false, barcode, parsedScale, error: message };
        }

        const pricing = await resolvePricingForProduct(scaleProduct, selectedCustomerId || null);
        const pricePerWeightUnit = pricing.unitPrice > 0 ? pricing.unitPrice : scaleProduct.price;

        const detectedWeight =
          parsedScale.weight != null && parsedScale.weight > 0
            ? parsedScale.weight
            : parsedScale.mode === "total_price" &&
                parsedScale.totalPrice != null &&
                parsedScale.totalPrice > 0 &&
                pricePerWeightUnit > 0
              ? roundQty(parsedScale.totalPrice / pricePerWeightUnit)
              : Math.max(0.001, posSettings.barcode_scan_quantity || 1);

        // En modo peso, el precio unitario SIEMPRE debe ser el configurado en el sistema/lista de precios
        const overrideUnitPrice = null;

        const added = await addProductToCart(scaleProduct, detectedWeight, {
          overrideUnitPrice,
          parsedScale,
        });
        if (!added) {
          const message = "No se pudo agregar producto de balanza";
          setFeedback({ type: "error", message });
          return {
            ok: false,
            barcode,
            product: scaleProduct,
            parsedScale,
            error: message,
          };
        }

        return { ok: true, barcode, product: scaleProduct, parsedScale };
      }

      try {
        let product = findProductByUnitBarcode(barcode);
        if (!product && isOnline) {
          product = await productsService.getByBarcode(tenantId, barcode);
        }

        // Respaldo de seguridad en memoria antes de rechazar
        if (!product) {
          const stripped = barcode.replace(/^0+/, "");
          product =
            products.find((p) => {
              if (p.is_active === false) return false;
              const pCode = p.code ? normalizeBarcodeValue(p.code) : "";
              const pPrimary = primaryBarcodes[p.id] ? normalizeBarcodeValue(primaryBarcodes[p.id]) : "";
              return (
                pCode === barcode ||
                pPrimary === barcode ||
                (stripped && (pCode.replace(/^0+/, "") === stripped || pPrimary.replace(/^0+/, "") === stripped))
              );
            }) ?? null;
        }

        if (!product || !product.is_active) {
          const promotion = findPromotionByBarcode(barcode);
          if (promotion) {
            return addPromotionToCart(promotion, barcode);
          }

          const message = `No se encontró producto para el código ${barcode}`;
          setFeedback({ type: "error", message });
          return { ok: false, barcode, error: message };
        }

        const scanQuantity = Math.max(0.001, posSettings.barcode_scan_quantity || 1);
        const added = await addProductToCart(product, scanQuantity);
        if (!added) {
          const message = "No se pudo agregar al carrito";
          setFeedback({ type: "error", message });
          return { ok: false, barcode, product, parsedScale: null, error: message };
        }

        return { ok: true, barcode, product, parsedScale: null };
      } catch {
        const fallbackProduct = findProductByUnitBarcode(barcode);
        if (fallbackProduct && fallbackProduct.is_active) {
          const scanQuantity = Math.max(0.001, posSettings.barcode_scan_quantity || 1);
          const added = await addProductToCart(fallbackProduct, scanQuantity);
          if (added) {
            return { ok: true, barcode, product: fallbackProduct, parsedScale: null };
          }
        }

        const fallbackPromotion = findPromotionByBarcode(barcode);
        if (fallbackPromotion) {
          return addPromotionToCart(fallbackPromotion, barcode);
        }

        const message = "Error al leer codigo de barras";
        setFeedback({ type: "error", message });
        return { ok: false, barcode, parsedScale: null, error: message };
      }
    },
    [
      addProductToCart,
      addPromotionToCart,
      findPromotionByBarcode,
      findProductByPluCode,
      findProductByUnitBarcode,
      getCustomerPriceList,
      isOnline,
      posSettings.allow_negative_stock,
      posSettings.barcode_scan_quantity,
      productBarcodes,
      products,
      scaleSettings,
      selectedCustomerId,
      tenantId,
    ]
  );

  const setCartItemQuantity = (productId: string, nextQuantity: number) => {
    const normalizedQty = roundQty(nextQuantity);
    if (!Number.isFinite(normalizedQty) || normalizedQty < 0) {
      setFeedback({ type: "error", message: "La cantidad no es válida" });
      return;
    }

    const target = cartState.find((item) => item.product_id === productId);
    if (target?.sale_mode !== "weight" && normalizedQty <= 0) {
      setFeedback({ type: "error", message: "La cantidad debe ser mayor a 0" });
      return;
    }

    setCartState((prev) => {
      const item = prev.find((row) => row.product_id === productId);
      if (!item) return prev;

      if (!posSettings.allow_negative_stock && normalizedQty > item.stock_available) {
        setFeedback({
          type: "error",
          message: `Stock insuficiente para ${item.name}`,
        });
        return prev;
      }

      const packageId = `returnable-pkg-${productId}`;
      return prev.map((item) => {
        if (item.product_id === productId) {
          return {
            ...item,
            quantity: normalizedQty,
          };
        }
        if (item.product_id === packageId || item.parent_product_id === productId) {
          return {
            ...item,
            quantity: normalizedQty,
          };
        }
        return item;
      });
    });
  };

  const updateCartItem = (input: PosCartItemEditInput) => {
    const normalizedQty = roundQty(input.quantity);
    const normalizedPrice = roundAmount(input.unitPrice);
    const name = input.name.trim();
    const category = input.category.trim() || "General";

    if (!name) {
      setFeedback({ type: "error", message: "El producto necesita nombre" });
      return;
    }

    if (!Number.isFinite(normalizedQty) || normalizedQty <= 0) {
      setFeedback({ type: "error", message: "La cantidad debe ser mayor a 0" });
      return;
    }

    if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
      setFeedback({ type: "error", message: "El precio debe ser mayor a 0" });
      return;
    }

    setCartState((prev) => {
      const target = prev.find((item) => item.product_id === input.productId);
      if (!target) return prev;

      if (
        !target.is_manual_item &&
        !posSettings.allow_negative_stock &&
        normalizedQty > target.stock_available
      ) {
        setFeedback({
          type: "error",
          message: `Stock insuficiente para ${target.name}`,
        });
        return prev;
      }

      return prev.map((item) =>
        item.product_id === input.productId
          ? {
              ...item,
              name,
              category,
              quantity: normalizedQty,
              unit_price: normalizedPrice,
              base_unit_price: item.is_manual_item ? normalizedPrice : item.base_unit_price,
              is_price_overridden: true,
              sale_mode: input.saleMode ?? target.sale_mode,
              ...(input.code !== undefined ? { code: input.code } : {}),
              ...(input.barcode !== undefined ? { barcode: input.barcode } : {}),
            }
          : item
      );
    });

    if (input.barcode !== undefined) {
      setPrimaryBarcodes((prev) => ({
        ...prev,
        [input.productId]: input.barcode || "",
      }));
    }
  };

  const increaseQuantity = (productId: string) => {
    const item = cartState.find((row) => row.product_id === productId);
    if (!item || item.is_debt_payment_item) return;
    const step = item.sale_mode === "weight" ? 0.05 : 1;
    setCartItemQuantity(productId, roundQty(item.quantity + step));
  };

  const decreaseQuantity = (productId: string) => {
    const item = cartState.find((row) => row.product_id === productId);
    if (!item || item.is_debt_payment_item) return;
    const step = item.sale_mode === "weight" ? 0.05 : 1;
    const nextQty = roundQty(item.quantity - step);
    if (nextQty <= 0) {
      if (item.sale_mode === "weight") {
        setCartItemQuantity(productId, 0);
      } else {
        removeFromCart(productId);
      }
      return;
    }
    setCartItemQuantity(productId, nextQty);
  };

  const removeFromCart = (productId: string) => {
    setCartState((prev) => {
      const target = prev.find((item) => item.product_id === productId);
      const packageId = `returnable-pkg-${productId}`;

      let next = prev.filter(
        (item) => item.product_id !== productId && item.product_id !== packageId && item.parent_product_id !== productId
      );

      // Si el ítem eliminado era un cobro de envase vinculado a un producto padre,
      // revertir el estado del producto padre a "exchange" (Trajo envase)
      if (target?.is_returnable_package_item && target.parent_product_id) {
        next = next.map((item) =>
          item.product_id === target.parent_product_id
            ? { ...item, returnable_status: "exchange" as const }
            : item
        );
      }

      if (next.length === 0) {
        setCartManualDiscount(null);
        setRoundingEnabled(posSettings?.rounding_enabled ?? true);
      }
      return next;
    });
    setLastAddedProductId((prev) => (prev === productId ? null : prev));
  };

  const clearCart = () => {
    setCartState([]);
    setCartManualDiscount(null);
    setDiscountsEnabled(true);
    setRoundingEnabled(posSettings?.rounding_enabled ?? true);
    setLastAddedProductId(null);
  };

  const applyCartDiscount = useCallback((discount: CartManualDiscount | null) => {
    setCartManualDiscount(discount);
    if (discount) {
      setFeedback({
        type: "success",
        message: `Descuento ${discount.type === "percent" ? `${discount.value}%` : currency.format(discount.value)} aplicado al carrito`,
      });
    } else {
      setFeedback({
        type: "success",
        message: "Descuento del carrito removido",
      });
    }
  }, []);

  const applyItemDiscount = useCallback(
    (
      productId: string,
      discount: { type: "percent" | "amount"; value: number; reason: string } | null
    ) => {
      setCartState((prev) =>
        prev.map((item) => {
          if (item.product_id !== productId) return item;
          return {
            ...item,
            manual_discount: discount,
            manual_promotion: null,
          };
        })
      );
      if (discount) {
        setFeedback({
          type: "success",
          message: "Descuento aplicado al producto",
        });
      } else {
        setFeedback({
          type: "success",
          message: "Descuento del producto removido",
        });
      }
    },
    []
  );

  const applyItemPromotion = useCallback(
    (productId: string, promo: PromotionWithDetails | null) => {
      setCartState((prev) =>
        prev.map((item) => {
          if (item.product_id !== productId) return item;
          if (!promo) {
            return {
              ...item,
              manual_promotion: null,
            };
          }
          return {
            ...item,
            manual_promotion: {
              id: promo.id,
              name: promo.name,
              code: promo.code,
              discount_amount: promo.discount_amount ?? 0,
            },
            manual_discount: null,
          };
        })
      );
      if (promo) {
        setFeedback({
          type: "success",
          message: `Promoción "${promo.name}" vinculada al producto`,
        });
      } else {
        setFeedback({
          type: "success",
          message: "Promoción removida del producto",
        });
      }
    },
    []
  );

  const setSelectedCustomer = useCallback((customerId: string) => {
    const normalized = customerId.trim();
    setSelectedCustomerId(normalized);
    if (normalized) {
      setSelectedEmployeeId(null);
      setCartManualDiscount((current) => (current?.reason === "Descuento Empleado" ? null : current));
    }
    setSaleTabs((prevTabs) =>
      prevTabs.map((tab) => (tab.id === activeTabId ? { ...tab, selectedCustomerId: normalized } : tab))
    );
  }, [activeTabId]);

  const selectEmployee = useCallback(
    (employee: Employee | null) => {
      if (!employee) {
        setSelectedEmployeeId(null);
        setCartManualDiscount((current) => (current?.reason === "Descuento Empleado" ? null : current));
        return;
      }

      setSelectedCustomerId("");
      setSelectedEmployeeId(employee.id);
      setSaleTabs((prevTabs) =>
        prevTabs.map((tab) => (tab.id === activeTabId ? { ...tab, selectedCustomerId: "" } : tab))
      );

      const discountPercent = employee.discount_percent ?? (posSettings.employee_discount_percent ?? 10);
      if (discountPercent > 0) {
        setCartManualDiscount({
          type: "percent",
          value: discountPercent,
          reason: "Descuento Empleado",
        });
      }
    },
    [activeTabId, posSettings.employee_discount_percent]
  );

  const upsertCustomer = useCallback((customer: Customer) => {
    setCustomers((prev) => {
      const exists = prev.some((c) => c.id === customer.id);
      if (exists) {
        return prev.map((c) => (c.id === customer.id ? customer : c));
      }
      return [customer, ...prev];
    });
  }, []);

  const createOriginBank = useCallback(
    async (name: string) => {
      if (!tenantId) return null;
      const created = await originBanksService.createOrFindByName(tenantId, name);
      if (!created) return null;

      setOriginBanks((current) => {
        const deduped = current.filter((row) => row.id !== created.id);
        return [...deduped, created].sort((a, b) => a.name.localeCompare(b.name));
      });

      return created;
    },
    [tenantId]
  );

  const clearMercadoPagoIntent = useCallback(() => {
    setMercadoPagoIntent(null);
  }, []);

  const getPaymentMethodById = useCallback(
    (paymentMethodId: string | null | undefined) =>
      paymentMethods.find((method) => method.id === paymentMethodId) ?? null,
    [paymentMethods]
  );

  const getCheckoutSummary = useCallback(
    (paymentMethodId: string | null | undefined): PosCheckoutSummary =>
      calculateSummaryByMethod(
        subtotal,
        getPaymentMethodById(paymentMethodId),
        posSettings,
        discountsEnabled,
        roundingEnabled
      ),
    [discountsEnabled, getPaymentMethodById, posSettings, roundingEnabled, subtotal]
  );

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );

  const appliedPriceList = useMemo(() => {
    if (!selectedCustomer?.price_list_id) return null;
    return priceLists.find((priceList) => priceList.id === selectedCustomer.price_list_id) ?? null;
  }, [priceLists, selectedCustomer]);

  const favoriteProducts = useMemo(
    () => products.filter((product) => product.is_active !== false && product.is_favorite),
    [products]
  );

  const arcaOperationalStatus = useMemo(
    () =>
      arcaInvoicesService.getOperationalStatus({
        settings: arcaSettings,
        isOnline,
      }),
    [arcaSettings, isOnline]
  );

  const arcaEnabledForPos = arcaSettings.enabled;
  const isArcaConnected = arcaOperationalStatus.available;

  const mercadoPagoStatus = useMemo<MercadoPagoOperationalStatus>(
    () =>
      mercadoPagoPaymentsService.getOperationalStatus({
        settings: mercadoPagoSettings,
        isOnline,
      }),
    [isOnline, mercadoPagoSettings]
  );

  const startMercadoPagoPayment = async (input: {
    paymentMethodId: string;
    amount: number;
    currencyCode: string;
    customerId: string | null;
  }) => {
    if (!tenantId) return null;

    const paymentMethod = getPaymentMethodById(input.paymentMethodId);
    if (!paymentMethod || normalizePaymentMethodCode(paymentMethod.code) !== "mercado_pago") {
      setFeedback({ type: "error", message: "Selecciona Mercado Pago para iniciar el cobro" });
      return null;
    }

    if (!mercadoPagoStatus.can_start_payment) {
      setFeedback({
        type: "error",
        message: mercadoPagoStatus.reason ?? "Mercado Pago no disponible en este momento",
      });
      return null;
    }

    setIsMercadoPagoLoading(true);
    try {
      const intent = await mercadoPagoPaymentsService.createPaymentIntent({
        tenantId,
        amount: input.amount,
        currencyCode: input.currencyCode,
        customerId: input.customerId,
        description: "Cobro POS",
        settings: mercadoPagoSettings,
      });
      setMercadoPagoIntent(intent);

      await auditService.createSafe(tenantId, {
        user_id: null,
        module: "pos",
        action: "mp_payment_started",
        entity_type: "sale_payment",
        entity_id: intent.id,
        description: `Cobro Mercado Pago iniciado: ${intent.reference}`,
        metadata: {
          amount: intent.amount,
          currency_code: intent.currency_code,
          status: intent.status,
          mode: mercadoPagoStatus.mode,
        },
      });

      setFeedback({ type: "success", message: `Cobro MP iniciado (${intent.reference})` });
      return intent;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo iniciar cobro con Mercado Pago";
      setFeedback({ type: "error", message });
      return null;
    } finally {
      setIsMercadoPagoLoading(false);
    }
  };

  const refreshMercadoPagoPayment = async () => {
    if (!tenantId || !mercadoPagoIntent) return null;

    setIsMercadoPagoLoading(true);
    try {
      const updated = await mercadoPagoPaymentsService.getPaymentStatus(
        tenantId,
        mercadoPagoIntent.id,
        {
          settings: mercadoPagoSettings,
        }
      );
      setMercadoPagoIntent(updated);
      return updated;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo consultar estado de Mercado Pago";
      setFeedback({ type: "error", message });
      return null;
    } finally {
      setIsMercadoPagoLoading(false);
    }
  };

  const setMercadoPagoMockStatus = async (
    nextStatus: "approved" | "rejected" | "cancelled"
  ) => {
    if (!tenantId || !mercadoPagoIntent) return null;

    setIsMercadoPagoLoading(true);
    try {
      const updated =
        nextStatus === "approved"
          ? await mercadoPagoPaymentsService.simulateApproval(tenantId, mercadoPagoIntent.id, {
              settings: mercadoPagoSettings,
            })
          : nextStatus === "rejected"
            ? await mercadoPagoPaymentsService.simulateRejection(tenantId, mercadoPagoIntent.id, {
                settings: mercadoPagoSettings,
              })
            : await mercadoPagoPaymentsService.cancelPayment(tenantId, mercadoPagoIntent.id, {
                settings: mercadoPagoSettings,
              });

      setMercadoPagoIntent(updated);

      await auditService.createSafe(tenantId, {
        user_id: null,
        module: "pos",
        action: `mp_payment_${nextStatus}`,
        entity_type: "sale_payment",
        entity_id: updated.id,
        description: `Cobro Mercado Pago ${nextStatus}: ${updated.reference}`,
        metadata: {
          reference: updated.reference,
          status: updated.status,
          mode: mercadoPagoStatus.mode,
        },
      });

      const label =
        nextStatus === "approved"
          ? "Cobro Mercado Pago aprobado"
          : nextStatus === "rejected"
            ? "Cobro Mercado Pago rechazado"
            : "Cobro Mercado Pago cancelado";
      setFeedback({ type: nextStatus === "approved" ? "success" : "error", message: label });
      return updated;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo actualizar estado de Mercado Pago";
      setFeedback({ type: "error", message });
      return null;
    } finally {
      setIsMercadoPagoLoading(false);
    }
  };

  const buildOfflineReceipt = (
    saleNumber: string,
    paymentMethod: PaymentMethod,
    values: PosCheckoutValues,
    summary: PosCheckoutSummary,
    createdBy: string | null
  ): Receipt => {
    const now = new Date().toISOString();
    const localId = `rcpt-off-${Date.now()}`;
    const normalizedCustomerId = values.customerId?.trim() ?? "";
    const customerName =
      normalizedCustomerId
        ? customers.find((customer) => customer.id === normalizedCustomerId)?.full_name ?? null
        : null;

    return {
      id: localId,
      tenant_id: tenantId ?? "tenant-offline",
      sale_id: `sale-off-${Date.now()}`,
      sale_number: saleNumber,
      receipt_number: `TCK-OFF-${Date.now()}`,
      issued_at: now,
      customer_name: customerName,
      payment_method: normalizePaymentMethodCode(paymentMethod.code) as PaymentMethodType,
      items: cart.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit_price: roundAmount(item.quantity > 0 ? item.line_total / item.quantity : item.unit_price),
        subtotal: item.line_total,
      })),
      total: summary.total,
      notes: values.notes?.trim() || "Venta offline pendiente de sincronizacion",
      created_by: createdBy,
      created_at: now,
      updated_at: now,
    };
  };

  const confirmSale = async (
    values: PosCheckoutValues,
    createdBy: string | null,
    options?: {
      openCashSessionId?: string | null;
    }
  ): Promise<Sale | null> => {
    if (!tenantId) return null;

    if (isConfirmingSaleRef.current || isSubmitting) {
      return null;
    }

    if (!cart.length) {
      setFeedback({ type: "error", message: "No hay items en el carrito" });
      return null;
    }

    isConfirmingSaleRef.current = true;
    setIsSubmitting(true);

    try {
      const hasZeroQuantity = cart.some((item) => item.quantity <= 0);
    if (hasZeroQuantity) {
      setFeedback({
        type: "error",
        message: "Hay productos con cantidad o peso en 0 g en el carrito",
      });
      return null;
    }

    const isSplit = Boolean(
      values.isSplitPayment && values.payments && values.payments.length > 0
    );
    const splitPayments = isSplit ? values.payments! : [];

    const paymentMethod = isSplit
      ? getPaymentMethodById(splitPayments[0].paymentMethodId) ||
        getPaymentMethodById(values.paymentMethodId)
      : getPaymentMethodById(values.paymentMethodId);

    if (!paymentMethod || !paymentMethod.is_active) {
      setFeedback({ type: "error", message: "Medio de pago invalido o inactivo" });
      return null;
    }

    if (isSplit) {
      const invalidSplit = splitPayments.find((p) => {
        const m = getPaymentMethodById(p.paymentMethodId);
        return !m || !m.is_active || p.amount <= 0;
      });
      if (invalidSplit) {
        setFeedback({
          type: "error",
          message: "Hay medios de pago inválidos o con monto en 0 en el pago combinado",
        });
        return null;
      }
    }

    const paymentDetails =
      values.paymentDetails && typeof values.paymentDetails === "object"
        ? (values.paymentDetails as Record<string, unknown>)
        : null;
    const paymentMethodCode = normalizePaymentMethodCode(paymentMethod.code);
    const isMercadoPagoMethod = paymentMethodCode === "mercado_pago";
    const isCurrentAccountMethod = paymentMethodCode === "current_account";
    const hasCurrentAccount = isSplit
      ? splitPayments.some(
          (p) =>
            normalizePaymentMethodCode(getPaymentMethodById(p.paymentMethodId)?.code) ===
            "current_account"
        )
      : isCurrentAccountMethod;
    const isMercadoPagoManual =
      isMercadoPagoMethod && !mercadoPagoSettings.enabled;

    if (hasCurrentAccount && !values.customerId && !values.employeeId) {
      setFeedback({ type: "error", message: "Cliente o empleado obligatorio para cuenta corriente" });
      return null;
    }

    if (isMercadoPagoMethod) {
      if (isMercadoPagoManual) {
        // ID de operacion es opcional para MP manual
      } else {
        if (!mercadoPagoStatus.available) {
          setFeedback({
            type: "error",
            message:
              mercadoPagoStatus.reason ??
              "Mercado Pago no disponible. Verifica la conexion e intenta nuevamente.",
          });
          return null;
        }

        if (!mercadoPagoIntent) {
          setFeedback({ type: "error", message: "Debes iniciar el cobro de Mercado Pago antes de vender" });
          return null;
        }

        if (mercadoPagoIntent.status !== "approved") {
          const statusLabel: Record<string, string> = {
            pending: "pendiente",
            rejected: "rechazado",
            cancelled: "cancelado",
            expired: "expirado",
            approved: "aprobado",
          };
          setFeedback({
            type: "error",
            message: `Cobro Mercado Pago ${statusLabel[mercadoPagoIntent.status] ?? mercadoPagoIntent.status}. La venta no fue confirmada.`,
          });
          return null;
        }
      }
    }

    if (!posSettings.allow_sale_without_customer && !values.customerId?.trim() && !values.employeeId?.trim()) {
      setFeedback({ type: "error", message: "La configuracion requiere cliente o empleado para vender" });
      return null;
    }

    const stockConflict = posSettings.allow_negative_stock
      ? null
      : cart.find((item) => !item.is_manual_item && item.quantity > item.stock_available);
    if (stockConflict) {
      setFeedback({
        type: "error",
        message: `Stock insuficiente para ${stockConflict.name}`,
      });
      return null;
    }

    const summary = getCheckoutSummary(paymentMethod.id);
    const saleNumber = buildSaleNumber();
    const normalizedCustomerId = values.customerId?.trim() ?? "";
    const selectedCustomerForSale = normalizedCustomerId
      ? customers.find((customer) => customer.id === normalizedCustomerId) ?? null
      : null;
    const requiresOpenCashSessionForSale = true;
    const currentAccountDebtAmount = isSplit
      ? splitPayments
          .filter(
            (p) =>
              normalizePaymentMethodCode(getPaymentMethodById(p.paymentMethodId)?.code) ===
              "current_account"
          )
          .reduce((acc, p) => acc + p.amount, 0)
      : isCurrentAccountMethod
      ? summary.total
      : 0;

    const splitCashAmount = isSplit
      ? splitPayments
          .filter((p) => {
            const m = getPaymentMethodById(p.paymentMethodId);
            return m?.affects_cash || normalizePaymentMethodCode(m?.code) === "cash";
          })
          .reduce((acc, p) => acc + p.amount, 0)
      : isCurrentAccountMethod
      ? 0
      : summary.total;
    const isCashRefund = summary.total < 0;
    const requiresCashMovementRegistration = splitCashAmount > 0;

    if (currentAccountDebtAmount > 0 && normalizedCustomerId) {
      const legacyCurrentAccountProfile = posCustomerProfilesService.getProfile(
        tenantId,
        normalizedCustomerId
      );
      const currentAccountProfile = {
        enabled:
          selectedCustomerForSale?.current_account_enabled ??
          legacyCurrentAccountProfile.enabled,
        limit:
          selectedCustomerForSale?.current_account_limit ??
          legacyCurrentAccountProfile.limit,
      };

      if (!currentAccountProfile.enabled) {
        setFeedback({
          type: "error",
          message: "La cuenta corriente esta deshabilitada para este cliente",
        });
        return null;
      }

      if (currentAccountProfile.limit != null && selectedCustomerForSale) {
        const projectedBalance = roundAmount(
          selectedCustomerForSale.current_balance + currentAccountDebtAmount
        );
        if (projectedBalance > currentAccountProfile.limit) {
          setFeedback({
            type: "error",
            message: "El importe supera el limite de cuenta corriente del cliente",
          });
          return null;
        }
      }
    }

    const normalizedEmployeeId = values.employeeId?.trim() ?? "";
    if (currentAccountDebtAmount > 0 && normalizedEmployeeId) {
      const selectedEmployeeForSale = employees.find((e) => e.id === normalizedEmployeeId);
      if (selectedEmployeeForSale) {
        if (!selectedEmployeeForSale.current_account_enabled) {
          setFeedback({
            type: "error",
            message: `La cuenta corriente está deshabilitada para el empleado ${selectedEmployeeForSale.full_name}`,
          });
          return null;
        }

        if (
          selectedEmployeeForSale.current_account_limit != null &&
          selectedEmployeeForSale.current_account_limit > 0
        ) {
          const projectedBalance = roundAmount(
            (selectedEmployeeForSale.current_balance ?? 0) + currentAccountDebtAmount
          );
          if (projectedBalance > selectedEmployeeForSale.current_account_limit) {
            setFeedback({
              type: "error",
              message: `El importe supera el límite de cuenta corriente del empleado (${selectedEmployeeForSale.full_name})`,
            });
            return null;
          }
        }
      }
    }

    if (isMercadoPagoMethod && !isMercadoPagoManual && !isOnline) {
      setFeedback({
        type: "error",
        message: "Sin conexion: no se puede cobrar con Mercado Pago",
      });
      return null;
    }

    if (!createdBy) {
      setFeedback({
        type: "error",
        message: "No se pudo identificar el usuario responsable del movimiento",
      });
      return null;
    }

    const resolvedCreatedBy: string = createdBy;

    let openSession: { id: string } | null = options?.openCashSessionId
      ? { id: options.openCashSessionId }
      : null;
    if (requireOpenSessionForSale || requiresOpenCashSessionForSale) {
      if (!openSession) {
        try {
          openSession = await cashService.getOpenSession(tenantId);
        } catch {
          setFeedback({
            type: "error",
            message: "No se pudo validar la caja abierta del comercio",
          });
          return null;
        }
      }
    }

    if (isCashRefund && !openSession) {
      setFeedback({
        type: "error",
        message: "Debes tener una sesión de caja física abierta para reintegrar dinero en efectivo",
      });
      return null;
    }

    if ((requireOpenSessionForSale || requiresOpenCashSessionForSale) && !openSession) {
      setFeedback({
        type: "error",
        message: "Debes abrir caja antes de registrar movimientos contables",
      });
      return null;
    }

    if (!isOnline) {
      setGeneratedReceipt(null);
      setGeneratedInvoice(null);

      try {
        const pendingSale = offlineService.savePendingSale({
          tenant_id: tenantId,
          created_by: resolvedCreatedBy,
          sale_number: saleNumber,
          customer_id: values.customerId?.trim() || null,
          currency_code: "ARS",
          notes: values.notes?.trim() || null,
          allow_negative_stock: posSettings.allow_negative_stock,
          payment_method: {
            id: paymentMethod.id,
            code: paymentMethod.code,
            name: paymentMethod.name,
            type: paymentMethodCode as PaymentMethodType,
            affects_cash: paymentMethod.affects_cash,
            surcharge_percent: paymentMethod.surcharge_percent,
            discount_percent: paymentMethod.discount_percent,
          },
          payment_details: paymentDetails,
          totals: {
            subtotal_before_promotions: subtotalBeforePromotions,
            product_promotion_discount_total: promotionDiscountTotal,
            cart_promotion_discount_total: cartPromotionDiscountTotal,
            subtotal_after_promotions: summary.subtotal,
            surcharge_total: summary.surchargeTotal,
            payment_discount_total: summary.discountTotal,
            payment_adjustment: summary.paymentAdjustment,
            total: summary.total,
          },
          items: cart.map((item) => ({
            product_id: item.product_id,
            name: item.name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            line_total: item.line_total,
            discount_total: item.promotion_discount_total,
            metadata: {
              pricing_snapshot: {
                base_unit_price: item.base_unit_price,
                applied_price_list_id: item.price_list_id,
                applied_price_list_name: item.price_list_name,
              },
              promotion_snapshot: item.applied_promotion_snapshot,
              cart_promotion_snapshot: promotionsResolution.applied_cart_promotion
                ? ({ ...promotionsResolution.applied_cart_promotion } as Record<string, unknown>)
                : null,
              cart_promotion_discount_allocated: item.cart_promotion_discount_total,
              is_manual_sale_item: item.is_manual_item,
            },
          })),
        });

        if (requiresCashMovementRegistration && openSession) {
          offlineService.savePendingCashMovement({
            tenant_id: tenantId,
            created_by: resolvedCreatedBy,
            cash_session_id: openSession.id,
            movement_type: "sale_payment",
            amount: summary.total,
            currency_code: "ARS",
            reference_type: paymentMethod.code,
            reference_id: null,
            source_local_sale_id: pendingSale.local_id,
            notes: `Cobro venta pendiente ${saleNumber} - ${paymentMethod.name}`,
          });
        }

        setGeneratedReceipt(
          buildOfflineReceipt(saleNumber, paymentMethod, values, summary, resolvedCreatedBy)
        );

        void auditService.createSafe(tenantId, {
          user_id: resolvedCreatedBy,
          module: "pos",
          action: "sale_pending_sync",
          entity_type: "pending_sale",
          entity_id: pendingSale.local_id,
          description: `Venta guardada offline: ${saleNumber}`,
          metadata: {
            customer_id: pendingSale.customer_id,
            payment_method_code: paymentMethod.code,
            total: summary.total,
            status: pendingSale.status,
          },
        });

        setFeedback({
          type: "success",
          message: "Venta registrada correctamente",
        });

        clearCart();
        setSelectedCustomerId("");
        setSelectedEmployeeId(null);
        refreshPending();
        return null;
      } catch {
        setFeedback({
          type: "error",
          message: "No se pudo guardar la venta offline",
        });
        return null;
      }
    }

    setGeneratedReceipt(null);
    setGeneratedInvoice(null);

    const employeeForSale = values.employeeId ? employees.find((e) => e.id === values.employeeId) : null;
    const notesWithEmployee = employeeForSale
      ? `[Empleado: ${employeeForSale.full_name}] ${values.notes?.trim() || ""}`.trim()
      : values.notes?.trim() || null;

    const sale = await salesService.create(tenantId, {
        sale_number: saleNumber,
        customer_id: values.customerId?.trim() || null,
        cash_session_id: openSession?.id ?? null,
        status: "completed",
        subtotal: summary.subtotal,
        discount_total: roundAmount(totalPromotionDiscount + summary.discountTotal),
        tax_total: 0,
        total: summary.total,
        currency_code: "ARS",
        notes: notesWithEmployee,
        current_account_id: null,
        arca_document_id: null,
        mercado_pago_preference_id:
          isMercadoPagoMethod ? (mercadoPagoIntent?.reference ?? null) : null,
      });

      const updatedStockByProductId = new Map<string, number>();
      for (const item of cart) {
        if (
          !item.is_manual_item &&
          !item.product_id.startsWith("manual-") &&
          !item.product_id.startsWith("temp-") &&
          !item.is_debt_payment_item &&
          !item.product_id.startsWith("debt-") &&
          !item.is_returnable_package_item &&
          !item.product_id.startsWith("returnable-pkg-") &&
          !item.is_package_refund_item &&
          !item.product_id.startsWith("package-refund-")
        ) {
          if (item.is_promo_item && item.promo_items?.length) {
            // Descontar stock correspondiente de cada artículo interno del pack o combo
            for (const sub of item.promo_items) {
              const currentStock = updatedStockByProductId.has(sub.product_id)
                ? updatedStockByProductId.get(sub.product_id)!
                : (products.find((p) => p.id === sub.product_id)?.stock_current ?? 0);
              const deductQty = roundQty(item.quantity * sub.quantity);
              const nextStock = posSettings.allow_negative_stock
                ? roundQty(currentStock - deductQty)
                : roundQty(Math.max(0, currentStock - deductQty));
              updatedStockByProductId.set(sub.product_id, nextStock);
            }
          } else if (!item.product_id.startsWith("promo-")) {
            const currentStock = updatedStockByProductId.has(item.product_id)
              ? updatedStockByProductId.get(item.product_id)!
              : item.stock_available;
            const nextStock = posSettings.allow_negative_stock
              ? roundQty(currentStock - item.quantity)
              : roundQty(Math.max(0, currentStock - item.quantity));
            updatedStockByProductId.set(item.product_id, nextStock);
          }
        }
      }

      // 1. Ítems de la venta y movimientos de stock (en paralelo)
      const itemsAndStockPromise = Promise.all(
        cart.map(async (item) => {
          const itemPromise = salesService.createItem(tenantId, {
            sale_id: sale.id,
            product_id: item.product_id,
            product_name_snapshot: item.name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_total: item.promotion_discount_total,
            tax_total: 0,
            line_total: item.line_total,
            metadata: {
              pricing_snapshot: {
                base_unit_price: item.base_unit_price,
                applied_price_list_id: item.price_list_id,
                applied_price_list_name: item.price_list_name,
              },
              promotion_snapshot: item.applied_promotion_snapshot,
              is_promo_item: Boolean(item.is_promo_item),
              promo_id: item.promo_id ?? null,
              promo_code: item.promo_code ?? null,
              promo_items: item.promo_items ?? null,
              cart_promotion_snapshot: promotionsResolution.applied_cart_promotion
                ? ({ ...promotionsResolution.applied_cart_promotion } as Record<string, unknown>)
                : null,
              cart_promotion_discount_allocated: item.cart_promotion_discount_total,
              is_manual_sale_item: item.is_manual_item,
              is_debt_payment_item: item.is_debt_payment_item ?? false,
              debt_customer_id: item.debt_customer_id ?? null,
              returnable: item.returnable_config
                ? {
                    package_name: item.returnable_config.packageName,
                    package_price: item.returnable_config.packagePrice,
                    status: item.returnable_status ?? "exchange",
                  }
                : null,
            },
          });

          if (
            item.is_manual_item ||
            item.product_id.startsWith("manual-") ||
            item.product_id.startsWith("temp-") ||
            item.is_debt_payment_item ||
            item.product_id.startsWith("debt-") ||
            item.is_returnable_package_item ||
            item.product_id.startsWith("returnable-pkg-") ||
            item.is_package_refund_item ||
            item.product_id.startsWith("package-refund-")
          ) {
            return itemPromise;
          }

          // Si es un ítem de promoción virtual (pack o combo), registrar movimientos por cada componente
          if (item.is_promo_item && item.promo_items?.length) {
            const promoStockPromise = Promise.all(
              item.promo_items.map(async (sub) => {
                const deductQty = roundQty(item.quantity * sub.quantity);
                try {
                  await stockService.create(tenantId, {
                    product_id: sub.product_id,
                    movement_type: "sale",
                    quantity: deductQty,
                    reference_type: "sale",
                    reference_id: sale.id,
                    notes: `Venta ${sale.sale_number} (PROMO: ${item.name})`,
                    created_by: resolvedCreatedBy,
                  });
                } catch (stockError) {
                  console.warn(
                    `[POS] No se pudo asentar movimiento de stock para sub-artículo ${sub.product_id} (${sub.name}) de promo:`,
                    stockError
                  );
                }

                const nextStock = updatedStockByProductId.get(sub.product_id);
                if (nextStock !== undefined) {
                  try {
                    await productsService.updateStock(tenantId, sub.product_id, nextStock);
                  } catch (stockUpdateError) {
                    console.warn(
                      `[POS] No se pudo actualizar stock acumulado para sub-artículo ${sub.product_id}:`,
                      stockUpdateError
                    );
                  }
                }
              })
            );
            return Promise.all([itemPromise, promoStockPromise]);
          }
          const stockPromise = (async () => {
            try {
              return await stockService.create(tenantId, {
                product_id: item.product_id,
                movement_type: "sale",
                quantity: item.quantity,
                reference_type: "sale",
                reference_id: sale.id,
                notes: `Venta ${sale.sale_number}`,
                created_by: resolvedCreatedBy,
              });
            } catch (stockError) {
              console.warn(
                `[POS] No se pudo asentar movimiento de stock para producto ${item.product_id} (${item.name}):`,
                stockError
              );
              return null;
            }
          })();

          const nextStock = updatedStockByProductId.get(item.product_id) ?? item.stock_available;
          const updateStockPromise = (async () => {
            try {
              return await productsService.updateStock(tenantId, item.product_id, nextStock);
            } catch (stockUpdateError) {
              console.warn(
                `[POS] No se pudo actualizar stock acumulado para producto ${item.product_id} (${item.name}):`,
                stockUpdateError
              );
              return null;
            }
          })();

          return Promise.all([itemPromise, stockPromise, updateStockPromise]);
        })
      );

      // 2. Envases adeudados ("owe")
      const returnablesPromise = (async () => {
        const oweReturnableItems = cart.filter(
          (i) => i.returnable_config?.enabled && i.returnable_status === "owe"
        );

        const targetCustomer =
          (values.customerId ? customers.find((c) => c.id === values.customerId) : null) ||
          selectedCustomer;

        if (oweReturnableItems.length > 0 && targetCustomer) {
          try {
            const currentDebts = parseCustomerPackageDebts(targetCustomer.observations);
            for (const item of oweReturnableItems) {
              const pkgName = item.returnable_config!.packageName;
              currentDebts[pkgName] = (currentDebts[pkgName] ?? 0) + item.quantity;
            }
            const updatedObservations = serializeCustomerPackageDebts(
              targetCustomer.observations,
              currentDebts
            );
            await customersService.update(tenantId, targetCustomer.id, {
              observations: updatedObservations,
            });
            setCustomers((prevCustomers) =>
              prevCustomers.map((c) =>
                c.id === targetCustomer.id
                  ? { ...c, observations: updatedObservations }
                  : c
              )
            );
          } catch (err) {
            console.error("Error al registrar deuda de envases en cliente", err);
          }
        }
      })();

      // 3. Pagos y movimientos financieros (efectivo / bancos / cuenta corriente)
      const paymentCapturedAt = new Date().toISOString();
      const manualMercadoPagoOperationId =
        isMercadoPagoManual && typeof paymentDetails?.operation_id === "string"
          ? paymentDetails.operation_id.trim() || null
          : null;

      const paymentsPromise = (async () => {
        if (isSplit) {
          await Promise.all(
            splitPayments.map(async (p) => {
              const pMethod = getPaymentMethodById(p.paymentMethodId)!;
              const pCode = normalizePaymentMethodCode(pMethod.code);
              const pDetails =
                p.paymentDetails && typeof p.paymentDetails === "object"
                  ? (p.paymentDetails as Record<string, unknown>)
                  : null;
              const pIsCurrentAccount = pCode === "current_account";

              const paymentPromise = salesService.createPayment(tenantId, {
                sale_id: sale.id,
                payment_method_code: pMethod.code,
                provider: pCode === "mercado_pago" ? "mercado_pago" : "internal",
                provider_code: pCode === "mercado_pago" ? "mercado_pago_manual" : "internal",
                amount: p.amount,
                currency_code: "ARS",
                status: pIsCurrentAccount ? "pending" : "approved",
                provider_status: pIsCurrentAccount ? "pending" : "approved",
                provider_reference: null,
                provider_metadata: null,
                external_reference: null,
                metadata: {
                  payment_method_snapshot: {
                    id: pMethod.id,
                    name: pMethod.name,
                    code: pMethod.code,
                    type: pCode as PaymentMethodType,
                    affects_cash: pMethod.affects_cash,
                    surcharge_percent: pMethod.surcharge_percent,
                    discount_percent: pMethod.discount_percent,
                  },
                  payment_details: pDetails,
                  payment_captured_at: paymentCapturedAt,
                },
              });

              const currentAccountPromise =
                pIsCurrentAccount && values.employeeId
                  ? employeeCurrentAccountsService.createMovement(tenantId, {
                      employee_id: values.employeeId,
                      sale_id: sale.id,
                      type: "debt",
                      amount: p.amount,
                      category: "product_purchase",
                      notes: `Venta POS #${sale.sale_number} (Parcial cta. cte. empleado)`,
                      created_by: resolvedCreatedBy,
                    })
                  : pIsCurrentAccount && values.customerId
                  ? currentAccountsService.createMovement(tenantId, {
                      customer_id: values.customerId,
                      sale_id: sale.id,
                      type: "debt",
                      amount: p.amount,
                      notes: `Venta ${sale.sale_number} (Parcial cta. cte.)`,
                      created_by: resolvedCreatedBy,
                    })
                  : Promise.resolve();

              const cashMovementPromise =
                (pMethod.affects_cash || pCode === "cash") && openSession
                  ? cashService.createMovement(tenantId, {
                      cash_session_id: openSession.id,
                      movement_type: "sale_payment",
                      amount: p.amount,
                      currency_code: "ARS",
                      reference_type: pMethod.code,
                      reference_id: sale.id,
                      notes: `Cobro venta ${sale.sale_number} - ${pMethod.name} (Parcial: $${p.amount.toFixed(2)})`,
                      created_by: resolvedCreatedBy,
                    })
                  : Promise.resolve();

              const destAccountId =
                typeof pDetails?.destination_account_id === "string" && pDetails.destination_account_id
                  ? pDetails.destination_account_id
                  : null;
              const bankMovementPromise = destAccountId
                ? bankAccountMovementsService
                    .createMovement(tenantId, {
                      bank_account_id: destAccountId,
                      type: "income",
                      origin_type: "pos_sale",
                      concept: `Cobro Venta #${sale.sale_number} - ${pMethod.name}`,
                      amount: p.amount,
                      reference_id: sale.id,
                      voucher_number:
                        (typeof pDetails?.voucher_number === "string" && pDetails.voucher_number) ||
                        (typeof pDetails?.operation_id === "string" && pDetails.operation_id) ||
                        null,
                      notes: `Cobro POS en ${pMethod.name}`,
                      created_by: resolvedCreatedBy,
                    })
                    .catch((bankErr) => {
                      console.error("Error al registrar ingreso en cuenta bancaria:", bankErr);
                    })
                : Promise.resolve();

              return Promise.all([
                paymentPromise,
                currentAccountPromise,
                cashMovementPromise,
                bankMovementPromise,
              ]);
            })
          );

          void auditService.createSafe(tenantId, {
            user_id: resolvedCreatedBy,
            module: "pos",
            action: "sale_payment_split",
            entity_type: "sale_payment",
            entity_id: sale.id,
            description: `Pago combinado registrado (${splitPayments.length} métodos) en venta ${sale.sale_number}`,
            metadata: {
              sale_id: sale.id,
              split_payments: splitPayments,
              captured_at: paymentCapturedAt,
            },
          });
        } else {
          const singlePaymentPromise = salesService.createPayment(tenantId, {
            sale_id: sale.id,
            payment_method_code: paymentMethod.code,
            provider: isMercadoPagoMethod ? "mercado_pago" : "internal",
            provider_code:
              isMercadoPagoMethod
                ? isMercadoPagoManual
                  ? "mercado_pago_manual"
                  : "mercado_pago"
                : "internal",
            amount: summary.total,
            currency_code: "ARS",
            status: isCurrentAccountMethod ? "pending" : "approved",
            provider_status:
              isMercadoPagoMethod
                ? isMercadoPagoManual
                  ? "approved"
                  : (mercadoPagoIntent?.status ?? "pending")
                : isCurrentAccountMethod
                  ? "pending"
                  : "approved",
            provider_reference:
              isMercadoPagoMethod
                ? isMercadoPagoManual
                  ? manualMercadoPagoOperationId
                  : (mercadoPagoIntent?.reference ?? null)
                : null,
            provider_metadata:
              isMercadoPagoMethod
                ? isMercadoPagoManual
                  ? ({
                      operation_id: manualMercadoPagoOperationId,
                      mode: "manual",
                    } as Record<string, unknown>)
                  : ({
                      payment_intent_id: mercadoPagoIntent?.id ?? null,
                      status: mercadoPagoIntent?.status ?? "pending",
                      expires_at: mercadoPagoIntent?.expires_at ?? null,
                      mode: mercadoPagoStatus.mode,
                    } as Record<string, unknown>)
                : null,
            external_reference:
              isMercadoPagoMethod
                ? isMercadoPagoManual
                  ? manualMercadoPagoOperationId
                  : (mercadoPagoIntent?.reference ?? null)
                : null,
            metadata: {
              payment_method_snapshot: {
                id: paymentMethod.id,
                name: paymentMethod.name,
                code: paymentMethod.code,
                type: paymentMethodCode as PaymentMethodType,
                affects_cash: paymentMethod.affects_cash,
                surcharge_percent: paymentMethod.surcharge_percent,
                discount_percent: paymentMethod.discount_percent,
              },
              totals_snapshot: {
                subtotal_before_promotions: subtotalBeforePromotions,
                promotion_discount_total: promotionDiscountTotal,
                cart_promotion_discount_total: cartPromotionDiscountTotal,
                subtotal_after_promotions: summary.subtotal,
                surcharge_total: summary.surchargeTotal,
                payment_discount_total: summary.discountTotal,
                payment_adjustment: summary.paymentAdjustment,
                total: summary.total,
              },
              payment_details: paymentDetails,
              payment_captured_at: paymentCapturedAt,
              provider_snapshot:
                isMercadoPagoMethod
                  ? isMercadoPagoManual
                    ? {
                        provider: "mercado_pago_manual",
                        operation_id: manualMercadoPagoOperationId,
                        provider_reference: manualMercadoPagoOperationId,
                        provider_status: "approved",
                        mode: "manual",
                      }
                    : {
                        provider: "mercado_pago",
                        payment_intent_id: mercadoPagoIntent?.id ?? null,
                        provider_reference: mercadoPagoIntent?.reference ?? null,
                        provider_status: mercadoPagoIntent?.status ?? "pending",
                        mode: mercadoPagoStatus.mode,
                      }
                  : null,
              cart_promotion_snapshot: promotionsResolution.applied_cart_promotion
                ? ({ ...promotionsResolution.applied_cart_promotion } as Record<string, unknown>)
                : null,
            },
          });

          const singleDestAccountId =
            typeof paymentDetails?.destination_account_id === "string" && paymentDetails.destination_account_id
              ? paymentDetails.destination_account_id
              : null;
          const singleBankMovementPromise = singleDestAccountId
            ? bankAccountMovementsService
                .createMovement(tenantId, {
                  bank_account_id: singleDestAccountId,
                  type: "income",
                  origin_type: "pos_sale",
                  concept: `Cobro Venta #${sale.sale_number} - ${paymentMethod.name}`,
                  amount: summary.total,
                  reference_id: sale.id,
                  voucher_number:
                    (typeof paymentDetails?.voucher_number === "string" && paymentDetails.voucher_number) ||
                    (typeof paymentDetails?.operation_id === "string" && paymentDetails.operation_id) ||
                    null,
                  notes: `Cobro POS en ${paymentMethod.name}`,
                  created_by: resolvedCreatedBy,
                })
                .catch((bankErr) => {
                  console.error("Error al registrar ingreso en cuenta bancaria:", bankErr);
                })
            : Promise.resolve();

          const paymentAuditAction =
            paymentMethod.code === "card_credit"
              ? "sale_payment_credit_card"
              : paymentMethod.code === "card_debit"
                ? "sale_payment_debit_card"
                : paymentMethod.code === "transfer"
                  ? "sale_payment_transfer"
                  : paymentMethod.code === "cheque"
                    ? "sale_payment_cheque"
                  : isMercadoPagoManual
                    ? "sale_payment_mercado_pago_manual"
                    : null;

          if (paymentAuditAction) {
            void auditService.createSafe(tenantId, {
              user_id: resolvedCreatedBy,
              module: "pos",
              action: paymentAuditAction,
              entity_type: "sale_payment",
              entity_id: sale.id,
              description: `Pago registrado (${paymentMethod.name}) en venta ${sale.sale_number}`,
              metadata: {
                sale_id: sale.id,
                payment_method_code: paymentMethod.code,
                payment_details: paymentDetails,
                captured_at: paymentCapturedAt,
              },
            });
          }

          const singleCurrentAccountPromise =
            isCurrentAccountMethod && values.employeeId
              ? employeeCurrentAccountsService.createMovement(tenantId, {
                  employee_id: values.employeeId,
                  sale_id: sale.id,
                  type: "debt",
                  amount: summary.total,
                  category: "product_purchase",
                  notes: `Venta POS #${sale.sale_number} (Cta. Cte. Empleado)`,
                  created_by: resolvedCreatedBy,
                })
              : isCurrentAccountMethod && values.customerId
              ? currentAccountsService.createMovement(tenantId, {
                  customer_id: values.customerId!,
                  sale_id: sale.id,
                  type: "debt",
                  amount: summary.total,
                  notes: `Venta ${sale.sale_number}`,
                  created_by: resolvedCreatedBy,
                })
              : Promise.resolve();

          const singleCashMovementPromise = isCashRefund
            ? openSession
              ? cashService.createMovement(tenantId, {
                  cash_session_id: openSession.id,
                  movement_type: "expense",
                  amount: Math.abs(summary.total),
                  currency_code: "ARS",
                  reference_type: "cash",
                  reference_id: sale.id,
                  notes: `Reintegro por devolución de envases - Venta #${sale.sale_number}${
                    selectedCustomerForSale ? ` (${selectedCustomerForSale.full_name})` : ""
                  }`,
                  created_by: resolvedCreatedBy,
                })
              : Promise.resolve()
            : requiresCashMovementRegistration && openSession
            ? cashService.createMovement(tenantId, {
                cash_session_id: openSession.id,
                movement_type: "sale_payment",
                amount: summary.total,
                currency_code: "ARS",
                reference_type: paymentMethod.code,
                reference_id: sale.id,
                notes: `Cobro venta ${sale.sale_number} - ${paymentMethod.name}`,
                created_by: resolvedCreatedBy,
              })
            : Promise.resolve();

          if (isCashRefund) {
            void auditService.createSafe(tenantId, {
              user_id: resolvedCreatedBy,
              module: "pos",
              action: "package_voucher_cash_refund",
              entity_type: "sale",
              entity_id: sale.id,
              description: `Egreso de caja por reintegro de envases: ${currency.format(Math.abs(summary.total))} en Venta #${sale.sale_number}`,
              metadata: {
                sale_id: sale.id,
                total_refund: Math.abs(summary.total),
                cash_session_id: openSession?.id ?? null,
                customer_id: selectedCustomerForSale?.id ?? null,
              },
            });
          }

          await Promise.all([
            singlePaymentPromise,
            singleBankMovementPromise,
            singleCurrentAccountPromise,
            singleCashMovementPromise,
          ]);
        }
      })();

      // 4. Cancelación de deudas en cuenta corriente (en paralelo)
      const debtPaymentItems = cart.filter((item) => item.is_debt_payment_item);
      const debtItemsPromise = Promise.all(
        debtPaymentItems.map(async (debtItem) => {
          const targetCustomerId = debtItem.debt_customer_id || values.customerId;
          if (targetCustomerId) {
            try {
              await currentAccountsService.createMovement(tenantId, {
                customer_id: targetCustomerId,
                sale_id: sale.id,
                type: "payment",
                amount: roundAmount(debtItem.line_total),
                notes: `Cancelación de deuda en Venta #${sale.sale_number} (${debtItem.name})`,
                created_by: resolvedCreatedBy,
              });
            } catch (debtErr) {
              console.error("Error al registrar cancelación de deuda en cuenta corriente:", debtErr);
            }
          }
        })
      );

      // 5. Creación del comprobante / ticket
      const oweItems = cart.filter(
        (i) => i.returnable_config?.enabled && i.returnable_status === "owe"
      );
      const oweNotes =
        oweItems.length > 0
          ? `Envases adeudados: ${oweItems
              .map((i) => `${i.quantity}x ${i.returnable_config?.packageName || "Envase"}`)
              .join(", ")}`
          : null;

      const receiptPayload = {
        sale_id: sale.id,
        sale_number: sale.sale_number,
        receipt_number: `TCK-${Date.now()}`,
        issued_at: new Date().toISOString(),
        customer_name: selectedCustomerForSale?.full_name ?? null,
        payment_method: paymentMethodCode as PaymentMethodType,
        items: cart.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unit_price: roundAmount(item.line_total / item.quantity),
          subtotal: item.line_total,
        })),
        total: summary.total,
        notes: [
          isSplit
            ? `Pago combinado: ${splitPayments
                .map((p) => {
                  const m = getPaymentMethodById(p.paymentMethodId);
                  return `${m?.name || "Medio"}: $${p.amount.toFixed(2)}`;
                })
                .join(" + ")}`
            : null,
          summary.roundingAdjustment !== 0
            ? `Redondeo comercial: ${summary.roundingAdjustment > 0 ? "+" : ""}$${summary.roundingAdjustment.toFixed(2)}`
            : null,
          oweNotes,
          values.notes?.trim() || null,
        ]
          .filter(Boolean)
          .join(" | ") || null,
        created_by: resolvedCreatedBy,
      };

      const receiptPromise = receiptsService.create(tenantId, receiptPayload).catch((err) => {
        console.error("Error al persistir recibo en base de datos:", err);
        return {
          id: `rcpt-${Date.now()}`,
          tenant_id: tenantId,
          ...receiptPayload,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as Receipt;
      });

      // Ejecutar todas las mutaciones secundarias en paralelo
      const [, , , , receipt] = await Promise.all([
        itemsAndStockPromise,
        returnablesPromise,
        paymentsPromise,
        debtItemsPromise,
        receiptPromise,
      ]);

      let generatedInvoiceFromSale: Invoice | null = null;
      const postSaleMessages: string[] = [];

      if (values.issueInvoice) {
        if (!sale.customer_id && defaultInvoiceDocumentType === "A") {
          postSaleMessages.push("Para Factura A se requiere cliente con CUIT registrado.");
        } else {
          try {
            generatedInvoiceFromSale = await invoicesService.createFromSale(tenantId, {
              sale_id: sale.id,
              document_type: defaultInvoiceDocumentType,
              notes: `Generada desde POS para ${sale.sale_number}`,
            });

            await auditService.createSafe(tenantId, {
              user_id: resolvedCreatedBy,
              module: "facturacion",
              action: "generate_from_sale",
              entity_type: "invoice",
              entity_id: generatedInvoiceFromSale.id,
              description: `Factura generada desde POS: ${generatedInvoiceFromSale.document_number}`,
              metadata: {
                sale_id: sale.id,
                document_type: generatedInvoiceFromSale.document_type,
                total: generatedInvoiceFromSale.total,
              },
            });

            if (arcaEnabledForPos && arcaOperationalStatus.available) {
              const pendingInvoice = await invoicesService.updateArcaStatus(
                tenantId,
                generatedInvoiceFromSale.id,
                {
                  arca_status: "pending",
                  arca_reference: generatedInvoiceFromSale.arca_reference,
                  arca_message: `Enviando a ARCA (${arcaOperationalStatus.mode})...`,
                }
              );

              await auditService.createSafe(tenantId, {
                user_id: resolvedCreatedBy,
                module: "facturacion",
                action: "arca_send",
                entity_type: "invoice",
                entity_id: pendingInvoice.id,
                description: `Envío ARCA desde POS: ${pendingInvoice.document_number}`,
                metadata: {
                  previous_arca_status: generatedInvoiceFromSale.arca_status,
                  next_arca_status: "pending",
                  mode: arcaOperationalStatus.mode,
                },
              });

              const currentSeq =
                parseInt(pendingInvoice.document_number.split("-").pop() || "1", 10) || 1;

              const arcaResult = await arcaService.authorizeInvoice(
                arcaSettings,
                {
                  tenantId,
                  documentType: generatedInvoiceFromSale.document_type,
                  puntoVenta: arcaSettings.punto_venta,
                  cuitEmisor: arcaSettings.cuit_emisor || "",
                  receiverDocType: generatedInvoiceFromSale.customer_snapshot?.document_type ?? "dni",
                  receiverDocNumber: generatedInvoiceFromSale.customer_snapshot?.document_number ?? "0",
                  subtotal: generatedInvoiceFromSale.subtotal,
                  taxTotal: generatedInvoiceFromSale.tax_total,
                  total: generatedInvoiceFromSale.total,
                  items: generatedInvoiceFromSale.items_snapshot.map((item) => ({
                    name: item.product_name,
                    quantity: item.quantity,
                    unitPrice: item.unit_price,
                    subtotal: item.subtotal,
                  })),
                },
                currentSeq
              );

              if (arcaResult.success) {
                generatedInvoiceFromSale = await invoicesService.updateArcaStatus(
                  tenantId,
                  pendingInvoice.id,
                  {
                    arca_status: "accepted",
                    arca_reference: arcaResult.cae ?? null,
                    arca_message: "Comprobante autorizado por ARCA",
                    cae: arcaResult.cae ?? null,
                    cae_due_date: arcaResult.caeDueDate ?? null,
                    qr_data_url: arcaResult.qrUrl ?? null,
                    document_number:
                      arcaResult.formattedDocumentNumber ?? pendingInvoice.document_number,
                  }
                );

                await auditService.createSafe(tenantId, {
                  user_id: resolvedCreatedBy,
                  module: "facturacion",
                  action: "arca_authorized",
                  entity_type: "invoice",
                  entity_id: generatedInvoiceFromSale.id,
                  description: `Factura autorizada por ARCA: ${generatedInvoiceFromSale.document_number} (CAE: ${arcaResult.cae})`,
                  metadata: {
                    cae: arcaResult.cae,
                    cae_due_date: arcaResult.caeDueDate,
                    voucher_number: arcaResult.voucherNumber,
                    qr_url: arcaResult.qrUrl,
                    mode: arcaOperationalStatus.mode,
                  },
                });

                postSaleMessages.push(
                  `Factura ${generatedInvoiceFromSale.document_number} autorizada por ARCA (CAE: ${arcaResult.cae}).`
                );
              } else {
                const isFallback = arcaSettings.allow_internal_fallback;
                generatedInvoiceFromSale = await invoicesService.updateArcaStatus(
                  tenantId,
                  pendingInvoice.id,
                  {
                    arca_status: isFallback ? "not_sent" : "rejected",
                    arca_message: arcaResult.errorMessage ?? "No se pudo autorizar con ARCA",
                  }
                );

                await auditService.createSafe(tenantId, {
                  user_id: resolvedCreatedBy,
                  module: "facturacion",
                  action: isFallback ? "arca_fallback_contingency" : "arca_rejected",
                  entity_type: "invoice",
                  entity_id: generatedInvoiceFromSale.id,
                  description: `ARCA no autorizado (${isFallback ? "Contingencia" : "Rechazado"}): ${arcaResult.errorMessage}`,
                  metadata: {
                    error: arcaResult.errorMessage,
                    mode: arcaOperationalStatus.mode,
                    fallback: isFallback,
                  },
                });

                postSaleMessages.push(
                  isFallback
                    ? `Factura generada en contingencia interna (ARCA: ${arcaResult.errorMessage || "ARCA no disponible"}).`
                    : `ARCA rechazó el comprobante: ${arcaResult.errorMessage || "Error al autorizar"}.`
                );
              }
            } else if (arcaEnabledForPos && !arcaOperationalStatus.available) {
              postSaleMessages.push(
                arcaSettings.allow_internal_fallback
                  ? `Factura interna generada. ARCA no disponible: ${arcaOperationalStatus.reason ?? "sin detalle"}.`
                  : `ARCA no disponible y fallback interno deshabilitado: ${arcaOperationalStatus.reason ?? "sin detalle"}.`
              );
              await auditService.createSafe(tenantId, {
                user_id: resolvedCreatedBy,
                module: "facturacion",
                action: "arca_send_blocked",
                entity_type: "invoice",
                entity_id: generatedInvoiceFromSale.id,
                description: `Envío ARCA bloqueado desde POS: ${generatedInvoiceFromSale.document_number}`,
                metadata: {
                  mode: arcaOperationalStatus.mode,
                  reason: arcaOperationalStatus.reason,
                  fallback_enabled: arcaSettings.allow_internal_fallback,
                },
              });
            } else {
              postSaleMessages.push("Factura interna generada.");
            }
          } catch (error) {
            postSaleMessages.push(
              error instanceof Error
                ? `No se pudo emitir factura: ${error.message}`
                : "No se pudo emitir factura."
            );
          }
        }
      }

      setGeneratedReceipt(receipt);
      setGeneratedInvoice(generatedInvoiceFromSale);
      void auditService.createSafe(tenantId, {
        user_id: resolvedCreatedBy,
        module: "pos",
        action: "sale_confirmed",
        entity_type: "sale",
        entity_id: sale.id,
        description: `Venta confirmada: ${sale.sale_number}`,
        metadata: {
          sale_number: sale.sale_number,
          customer_id: sale.customer_id,
          item_count: cart.length,
          payment_method_code: paymentMethod.code,
          total: sale.total,
          cash_session_id: sale.cash_session_id,
        },
      });

      setFeedback({
        type: "success",
        message:
          values.issueInvoice && generatedInvoiceFromSale
            ? "Factura emitida correctamente"
            : isSplit
              ? `Venta ${sale.sale_number} registrada correctamente con pago combinado (${splitPayments.length} métodos)`
              : "Venta registrada correctamente",
      });

      setMercadoPagoIntent(null);
      setCartManualDiscount(null);
      setSelectedEmployeeId(null);
      setRoundingEnabled(posSettings?.rounding_enabled ?? true);
      closeSaleTab(activeTabId);
      if (updatedStockByProductId.size) {
        setProducts((previous) =>
          previous.map((product) => {
            const updatedStock = updatedStockByProductId.get(product.id);
            return updatedStock == null ? product : { ...product, stock_current: updatedStock };
          })
        );
        updatedStockByProductId.forEach((stock, prodId) => {
          useProductsStore.getState().updateProductStock(prodId, stock);
        });
      }
      if (isCurrentAccountMethod && normalizedCustomerId) {
        setCustomers((previous) =>
          previous.map((customer) =>
            customer.id !== normalizedCustomerId
              ? customer
              : {
                  ...customer,
                  current_balance: roundAmount(customer.current_balance + summary.total),
                }
          )
        );
      }
      if (isCurrentAccountMethod && normalizedEmployeeId) {
        setEmployees((previous) =>
          previous.map((emp) =>
            emp.id !== normalizedEmployeeId
              ? emp
              : {
                  ...emp,
                  current_balance: roundAmount((emp.current_balance ?? 0) + summary.total),
                }
          )
        );
      }

      if (debtPaymentItems.length) {
        for (const dItem of debtPaymentItems) {
          const cId = dItem.debt_customer_id || normalizedCustomerId;
          if (cId) {
            setCustomers((previous) =>
              previous.map((cust) =>
                cust.id !== cId
                  ? cust
                  : {
                      ...cust,
                      current_balance: roundAmount(cust.current_balance - dItem.line_total),
                    }
              )
            );
          }
        }
      }

      return sale;
    } catch (error) {
      const backendError = getBackendErrorMessage(error);
      setFeedback({
        type: "error",
        message: backendError
          ? `No se pudo confirmar la venta: ${backendError}`
          : "No se pudo confirmar la venta",
      });
      return null;
    } finally {
      isConfirmingSaleRef.current = false;
      setIsSubmitting(false);
    }
  };

  return {
    products: catalogProducts,
    favoriteProducts,
    productBarcodes,
    primaryBarcodes: effectivePrimaryBarcodes,
    actualPrimaryBarcodes,
    customers,
    paymentMethods,
    bankAccounts,
    originBanks,
    installmentPlans,
    mercadoPagoSettings,
    mercadoPagoStatus,
    arcaSettings,
    arcaOperationalStatus,
    posSettings,
    requireOpenSessionForSale,
    arcaEnabledForPos,
    isArcaConnected,
    defaultInvoiceDocumentType,
    paymentMethodInvoiceRules,
    saleTabs,
    activeTabId,
    switchSaleTab,
    createNewSaleTab,
    closeSaleTab,
    selectedCustomerId,
    selectedCustomer,
    employees,
    selectedEmployeeId,
    selectedEmployee,
    selectEmployee,
    setSelectedEmployeeId,
    appliedPriceList,
    promotions,
    cart,
    cartManualDiscount,
    manualCartDiscountTotal,
    applyCartDiscount,
    applyItemDiscount,
    applyItemPromotion,
    subtotal,
    subtotalBeforePromotions,
    promotionDiscountTotal,
    cartPromotionDiscountTotal,
    discountsEnabled,
    setDiscountsEnabled,
    toggleDiscounts,
    roundingEnabled,
    setRoundingEnabled,
    toggleRounding,
    lastAddedProductId,
    isLoading,
    isSubmitting,
    isMercadoPagoLoading,
    feedback,
    clearFeedback,
    reload: loadPosData,
    addProductToCart,
    addManualProductToCart,
    addDebtPaymentToCart,
    removeDebtPaymentFromCart,
    addPackageRefundToCart,
    debtPaymentTotal,
    createProductFromPosAndAddToCart,
    addProductByBarcode,
    setSelectedCustomer,
    upsertCustomer,
    setCartItemQuantity,
    updateCartItem,
    increaseQuantity,
    decreaseQuantity,
    removeFromCart,
    clearCart,
    cycleReturnableStatus,
    hasOwedReturnables,
    owedReturnablesCount,
    createOriginBank,
    mercadoPagoIntent,
    startMercadoPagoPayment,
    refreshMercadoPagoPayment,
    approveMercadoPagoPayment: () => setMercadoPagoMockStatus("approved"),
    rejectMercadoPagoPayment: () => setMercadoPagoMockStatus("rejected"),
    cancelMercadoPagoPayment: () => setMercadoPagoMockStatus("cancelled"),
    clearMercadoPagoIntent,
    getCheckoutSummary,
    confirmSale,
    generatedReceipt,
    generatedInvoice,
    clearGeneratedReceipt,
  };
};
