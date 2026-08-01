import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { auditService } from "@/services/audit.service";
import { bankAccountsService } from "@/services/bank-accounts.service";
import { currentAccountsService } from "@/services/current-accounts.service";
import { cashService } from "@/services/cash.service";
import { customersService } from "@/services/customers.service";
import { useOffline } from "@/features/offline/hooks/useOffline";
import { offlineService } from "@/services/offline.service";
import { arcaInvoicesService } from "@/services/arca/arca-invoices.service";
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
  getPaymentMethodPosConfig,
  normalizePaymentMethodCode,
  paymentMethodsService,
} from "@/services/payment-methods.service";
import { posCustomerProfilesService } from "@/services/pos-customer-profiles.service";
import { priceListsService } from "@/services/price-lists.service";
import { productsService } from "@/services/products.service";
import { buildPromotionBarcode, promotionsService, type PromotionWithDetails } from "@/services/promotions.service";
import { receiptsService } from "@/services/receipts.service";
import { salesService } from "@/services/sales.service";
import { settingsService } from "@/services/settings.service";
import { stockService } from "@/services/stock.service";
import type { ArcaSettings, BankAccount, BarcodeScaleSettings, Customer, InstallmentPlan, Invoice, InvoiceDocumentType, MercadoPagoSettings, OriginBank, PaymentMethod, PaymentMethodType, PosSettings, PriceList, Product, ProductBarcode, Receipt, Sale } from "@/types/entities";
import type { PosCheckoutValues } from "@/modules/pos/schemas/pos-checkout.schema";

interface PosCartItem {
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
}

interface PosCartItemComputed extends PosCartItem {
  line_subtotal: number;
  promotion_discount_total: number;
  product_promotion_discount_total: number;
  cart_promotion_discount_total: number;
  line_total: number;
  applied_promotion_name: string | null;
  applied_promotion_snapshot: Record<string, unknown> | null;
}

interface PosCheckoutSummary {
  subtotal: number;
  surchargeTotal: number;
  discountTotal: number;
  paymentAdjustment: number;
  total: number;
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
}

const roundQty = (value: number): number => Number(value.toFixed(3));
const roundAmount = (value: number): number => Number(value.toFixed(2));
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

const getBackendErrorMessage = (error: unknown): string | null => {
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
  weight_start: 7,
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
  paymentMethod: PaymentMethod | null
): PosCheckoutSummary => {
  if (!paymentMethod) {
    return {
      subtotal,
      surchargeTotal: 0,
      discountTotal: 0,
      paymentAdjustment: 0,
      total: subtotal,
    };
  }

  const surchargeTotal = roundAmount(subtotal * (paymentMethod.surcharge_percent / 100));
  const discountTotal = roundAmount(subtotal * (paymentMethod.discount_percent / 100));
  const paymentAdjustment = roundAmount(surchargeTotal - discountTotal);
  const total = roundAmount(subtotal + paymentAdjustment);

  return {
    subtotal,
    surchargeTotal,
    discountTotal,
    paymentAdjustment,
    total,
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
const buildQuickProductCode = (name: string): string => {
  const base = name
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);

  return `${base || "POS"}-${Date.now().toString().slice(-6)}`;
};

export const usePosSale = (tenantId: string | null) => {
  const { isOnline, refreshPending } = useOffline();
  const [products, setProducts] = useState<Product[]>([]);
  const [productBarcodes, setProductBarcodes] = useState<ProductBarcode[]>([]);
  const [primaryBarcodes, setPrimaryBarcodes] = useState<Record<string, string>>({});
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [originBanks, setOriginBanks] = useState<OriginBank[]>([]);
  const [installmentPlans, setInstallmentPlans] = useState<InstallmentPlan[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [promotions, setPromotions] = useState<PromotionWithDetails[]>([]);
  const [posSettings, setPosSettings] = useState<PosSettings>(defaultPosSettings);
  const [scaleSettings, setScaleSettings] = useState<BarcodeScaleSettings>(defaultBarcodeScaleSettings);
  const [mercadoPagoSettings, setMercadoPagoSettings] = useState<MercadoPagoSettings>(
    defaultMercadoPagoSettings
  );
  const [arcaSettings, setArcaSettings] = useState<ArcaSettings>(defaultArcaSettings);
  const [requireOpenSessionForSale, setRequireOpenSessionForSale] = useState(false);
  const [defaultInvoiceDocumentType, setDefaultInvoiceDocumentType] =
    useState<InvoiceDocumentType>("B");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [cartState, setCartState] = useState<PosCartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMercadoPagoLoading, setIsMercadoPagoLoading] = useState(false);
  const [feedback, setFeedback] = useState<PosFeedback | null>(null);
  const [generatedReceipt, setGeneratedReceipt] = useState<Receipt | null>(null);
  const [generatedInvoice, setGeneratedInvoice] = useState<Invoice | null>(null);
  const [mercadoPagoIntent, setMercadoPagoIntent] = useState<MercadoPagoPaymentIntent | null>(null);
  const cartRef = useRef<PosCartItem[]>([]);

  useEffect(() => {
    cartRef.current = cartState;
  }, [cartState]);

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

  const loadPosData = useCallback(async () => {
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

    setIsLoading(true);
    try {
      await offlineService.hydrate();
      if (!isOnline) {
        const snapshot = offlineService.getPosSnapshot(tenantId);
        if (!snapshot) {
          setFeedback({ type: "error", message: "No hay una copia local del POS para este comercio. Conectate una vez para prepararlo." });
          return;
        }
        applyOfflineSnapshot(snapshot);
        setFeedback({ type: "success", message: "POS listo sin conexion con datos guardados localmente." });
        return;
      }

      await Promise.allSettled([
        originBanksService.ensureDefaults(tenantId),
        installmentPlansService.ensureDefaults(tenantId),
      ]);

      const [
        allProductsResult,
        allProductBarcodesResult,
        allCustomersResult,
        allActivePaymentMethodsResult,
        allActiveBankAccountsResult,
        allActiveOriginBanksResult,
        allActiveInstallmentPlansResult,
        allPriceListsResult,
        allActivePromotionsResult,
        tenantSettingsResult,
      ] = await Promise.allSettled([
        productsService.getAllByTenant(tenantId),
        productsService.getBarcodesByTenant(tenantId),
        customersService.getAllByTenant(tenantId),
        paymentMethodsService.getActiveByTenant(tenantId),
        bankAccountsService.getActiveByTenant(tenantId),
        originBanksService.getActiveByTenant(tenantId),
        installmentPlansService.getActiveByTenant(tenantId),
        priceListsService.getAllByTenant(tenantId),
        promotionsService.getActiveByTenantWithDetails(tenantId),
        settingsService.getByTenant(tenantId),
      ]);

      const allProducts =
        allProductsResult.status === "fulfilled" ? allProductsResult.value : [];
      const allProductBarcodes =
        allProductBarcodesResult.status === "fulfilled" ? allProductBarcodesResult.value : [];
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
      const allPriceLists =
        allPriceListsResult.status === "fulfilled" ? allPriceListsResult.value : [];
      const allActivePromotions =
        allActivePromotionsResult.status === "fulfilled" ? allActivePromotionsResult.value : [];
      const tenantSettings =
        tenantSettingsResult.status === "fulfilled" ? tenantSettingsResult.value : null;

      const hasPartialErrors =
        allProductsResult.status === "rejected" ||
        allProductBarcodesResult.status === "rejected" ||
        allCustomersResult.status === "rejected" ||
        allActivePaymentMethodsResult.status === "rejected" ||
        allActiveBankAccountsResult.status === "rejected" ||
        allActiveOriginBanksResult.status === "rejected" ||
        allActiveInstallmentPlansResult.status === "rejected" ||
        allPriceListsResult.status === "rejected" ||
        allActivePromotionsResult.status === "rejected" ||
        tenantSettingsResult.status === "rejected";

      const activeCustomers = allCustomers.filter((customer) => customer.is_active);
      const resolvedPosSettings = tenantSettings?.pos ?? defaultPosSettings;
      const resolvedMercadoPagoSettings = {
        ...defaultMercadoPagoSettings,
        ...(tenantSettings?.sistema?.mercado_pago ?? {}),
      };
      const resolvedArcaSettings = {
        ...defaultArcaSettings,
        ...(tenantSettings?.facturacion?.arca ?? {}),
      };

      const activeProducts = allProducts.filter((product) => product.is_active !== false);
      const primaryBarcodeMap = allProductBarcodes.reduce<Record<string, string>>((acc, row) => {
        if (!row.is_primary) return acc;
        acc[row.product_id] = row.barcode;
        return acc;
      }, {});

      setProducts(activeProducts);
      setProductBarcodes(allProductBarcodes);
      setPrimaryBarcodes(primaryBarcodeMap);
      setCustomers(activeCustomers);
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
    void loadPosData();
  }, [loadPosData]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== "pos-v2-mock-db") return;
      if (!tenantId) return;
      void loadPosData();
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

  const recalculateCartPricesForCustomer = useCallback(
    async (customerId: string | null) => {
      const cartSnapshot = cartRef.current;
      if (!cartSnapshot.length) return;

      const resolvedItems = await Promise.all(
        cartSnapshot.map(async (item) => {
          const product = products.find((candidate) => candidate.id === item.product_id);
          if (!product) return item;

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
    void recalculateCartPricesForCustomer(selectedCustomerId || null);
  }, [recalculateCartPricesForCustomer, selectedCustomerId]);

  const promotionsResolution = useMemo(
    () =>
      promotionsService.resolveApplicablePromotions(
        cartState.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
        new Date(),
        promotions
      ),
    [cartState, promotions]
  );

  const cart = useMemo<PosCartItemComputed[]>(() => {
    const resolutionByProductId = new Map(
      promotionsResolution.items.map((item) => [item.product_id, item])
    );

    const itemsWithProductPromotions = cartState.map((item) => {
      const resolved = resolutionByProductId.get(item.product_id);
      return {
        ...item,
        line_subtotal: resolved?.line_subtotal ?? roundAmount(item.quantity * item.unit_price),
        promotion_discount_total: resolved?.discount_total ?? 0,
        product_promotion_discount_total: resolved?.discount_total ?? 0,
        cart_promotion_discount_total: 0,
        line_total: resolved?.line_total ?? roundAmount(item.quantity * item.unit_price),
        applied_promotion_name: resolved?.applied_promotion?.name ?? null,
        applied_promotion_snapshot: resolved?.applied_promotion
          ? ({ ...resolved.applied_promotion } as Record<string, unknown>)
          : null,
      };
    });

    if (promotionsResolution.cart_discount_total <= 0 || !itemsWithProductPromotions.length) {
      return itemsWithProductPromotions;
    }

    const subtotalAfterProductPromotions = roundAmount(
      itemsWithProductPromotions.reduce((acc, item) => acc + item.line_total, 0)
    );

    if (subtotalAfterProductPromotions <= 0) {
      return itemsWithProductPromotions;
    }

    const allocated = itemsWithProductPromotions.map((item) => ({
      ...item,
      cart_promotion_discount_total: 0,
    }));

    let accumulated = 0;
    for (let index = 0; index < allocated.length; index += 1) {
      const item = allocated[index];

      const isLast = index === allocated.length - 1;
      const proportional = isLast
        ? roundAmount(promotionsResolution.cart_discount_total - accumulated)
        : roundAmount(
            promotionsResolution.cart_discount_total * (item.line_total / subtotalAfterProductPromotions)
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
  }, [cartState, promotionsResolution]);

  const subtotalBeforePromotions = promotionsResolution.subtotal_before_promotions;
  const promotionDiscountTotal = promotionsResolution.product_discount_total;
  const cartPromotionDiscountTotal = promotionsResolution.cart_discount_total;
  const totalPromotionDiscount = promotionsResolution.total_discount;
  const subtotal = promotionsResolution.subtotal_after_promotions;

  const addProductToCart = async (
    product: Product,
    quantity: number,
    options?: {
      overrideUnitPrice?: number | null;
      parsedScale?: ParsedScaleBarcode | null;
    }
  ): Promise<boolean> => {
    const normalizedQty = roundQty(quantity);

    if (!Number.isFinite(normalizedQty) || normalizedQty <= 0) {
      setFeedback({ type: "error", message: "La cantidad debe ser mayor a 0" });
      return false;
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

    setCartState((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);

      if (existing) {
        const nextUnitPrice =
          forcedUnitPrice != null
            ? roundAmount(
                (existing.quantity * existing.unit_price + normalizedQty * forcedUnitPrice) / nextQty
              )
            : pricing.unitPrice;

        return prev.map((item) =>
          item.product_id === product.id
            ? {
                ...item,
                quantity: nextQty,
                unit_price: nextUnitPrice,
                base_unit_price: roundAmount(product.price),
                stock_available: product.stock_current,
                price_list_id: pricing.priceListId,
                price_list_name: pricing.priceListName,
                price_list_is_active: pricing.priceListIsActive,
                is_scale_item: item.is_scale_item || Boolean(options?.parsedScale),
                scale_weight:
                  options?.parsedScale?.weight != null
                    ? roundQty((item.scale_weight ?? 0) + options.parsedScale.weight)
                    : item.scale_weight,
                scale_total_price:
                  options?.parsedScale?.totalPrice != null
                    ? roundAmount((item.scale_total_price ?? 0) + options.parsedScale.totalPrice)
                    : item.scale_total_price,
                scale_barcode: options?.parsedScale?.raw ?? item.scale_barcode,
                is_manual_item: item.is_manual_item,
              }
            : item
        );
      }

      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          category: product.category,
          sale_mode: product.sale_mode,
          quantity: normalizedQty,
          unit_price: forcedUnitPrice ?? pricing.unitPrice,
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
        },
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
    setCartState((prev) => [
      ...prev,
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
    ]);

    return true;
  }, []);

  const createProductFromPosAndAddToCart = useCallback(
    async (input: PosQuickProductInput): Promise<boolean> => {
      if (!tenantId) return false;

      const quantity = roundQty(input.quantity);
      const unitPrice = roundAmount(input.unitPrice);
      const name = input.name.trim();
      const category = input.category.trim() || "General";
      const stock = roundQty(Math.max(input.stock, quantity));

      if (!name || quantity <= 0 || unitPrice <= 0) {
        setFeedback({ type: "error", message: "Completa nombre, cantidad y precio" });
        return false;
      }

      setIsSubmitting(true);
      try {
        const priceWithoutVat = roundAmount(unitPrice / 1.21);
        const created = await productsService.create(tenantId, {
          code: input.code.trim() || buildQuickProductCode(name),
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
          profit_percent:
            input.costPrice > 0
              ? roundAmount(((priceWithoutVat - input.costPrice) / input.costPrice) * 100)
              : 0,
          is_active: true,
        });

        if (input.barcode.trim()) {
          await productsService.setPrimaryBarcode(tenantId, created.id, input.barcode.trim());
        }

        setProducts((current) =>
          [...current.filter((product) => product.id !== created.id), created].sort((a, b) =>
            a.name.localeCompare(b.name)
          )
        );
        if (input.barcode.trim()) {
          setPrimaryBarcodes((current) => ({ ...current, [created.id]: input.barcode.trim() }));
          setProductBarcodes((current) => [
            ...current.filter((barcode) => barcode.product_id !== created.id || !barcode.is_primary),
            {
              id: `local-barcode-${created.id}`,
              tenant_id: tenantId,
              product_id: created.id,
              barcode: input.barcode.trim(),
              is_primary: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ]);
        }

        await auditService.createSafe(tenantId, {
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

        return addProductToCart(created, quantity);
      } catch (error) {
        const message = error instanceof Error && error.message ? error.message : "No se pudo crear el producto";
        setFeedback({ type: "error", message });
        return false;
      } finally {
        setIsSubmitting(false);
      }
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
      if (promotion.scope !== "bundle" || !promotion.items?.length) {
        const message = `La promocion ${promotion.name} no es un combo escaneable`;
        setFeedback({ type: "error", message });
        return { ok: false, barcode: rawBarcode, promotion, error: message };
      }

      for (const promoItem of promotion.items) {
        const product = products.find((candidate) => candidate.id === promoItem.product_id);
        if (!product || !product.is_active) {
          const message = `Producto no disponible en promo ${promotion.name}`;
          setFeedback({ type: "error", message });
          return { ok: false, barcode: rawBarcode, promotion, error: message };
        }
      }

      for (const promoItem of promotion.items) {
        const product = products.find((candidate) => candidate.id === promoItem.product_id);
        if (!product) continue;
        const added = await addProductToCart(product, promoItem.quantity);
        if (!added) {
          return { ok: false, barcode: rawBarcode, promotion, error: "No se pudo agregar promo" };
        }
      }

      setFeedback({ type: "success", message: `Promo agregada: ${promotion.name}` });
      return { ok: true, barcode: rawBarcode, promotion, parsedScale: null };
    },
    [products]
  );

  const normalizePluCode = (value: string): string => value.replace(/^0+/, "");

  const findProductByPluCode = useCallback(
    (pluCode: string): Product | null => {
      const normalizedInput = normalizePluCode(pluCode);
      const byCode =
        products.find(
          (product) =>
            product.code === pluCode || normalizePluCode(product.code) === normalizedInput
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

      const barcodeRow =
        productBarcodes.find(
          (row) => normalizeBarcodeValue(row.barcode) === normalizedBarcode && row.is_primary
        ) ??
        productBarcodes.find((row) => normalizeBarcodeValue(row.barcode) === normalizedBarcode) ??
        null;

      if (!barcodeRow) return null;
      return products.find((candidate) => candidate.id === barcodeRow.product_id) ?? null;
    },
    [productBarcodes, products]
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

        const hasAssignedPriceList = Boolean(
          getCustomerPriceList(selectedCustomerId || null)
        );
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

        const overrideUnitPrice =
          !hasAssignedPriceList &&
          parsedScale.totalPrice != null &&
          parsedScale.totalPrice > 0 &&
          parsedScale.mode === "weight" &&
          detectedWeight > 0
            ? roundAmount(parsedScale.totalPrice / detectedWeight)
            : null;

        const added = await addProductToCart(scaleProduct, detectedWeight, {
          overrideUnitPrice,
          parsedScale,
        });
        if (!added) {
          return {
            ok: false,
            barcode,
            product: scaleProduct,
            parsedScale,
            error: "No se pudo agregar producto de balanza",
          };
        }

        return { ok: true, barcode, product: scaleProduct, parsedScale };
      }

      try {
        let product = findProductByUnitBarcode(barcode);
        if (!product && isOnline) {
          product = await productsService.getByBarcode(tenantId, barcode);
        }

        if (!product || !product.is_active) {
          const promotion = findPromotionByBarcode(barcode);
          if (promotion) {
            return addPromotionToCart(promotion, barcode);
          }

          const message = `No se encontro producto para el codigo ${barcode}`;
          setFeedback({ type: "error", message });
          return { ok: false, barcode, error: message };
        }

        const scanQuantity = Math.max(0.001, posSettings.barcode_scan_quantity || 1);
        const added = await addProductToCart(product, scanQuantity);
        if (!added) {
          return { ok: false, barcode, product, parsedScale: null, error: "No se pudo agregar al carrito" };
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
    if (!Number.isFinite(normalizedQty)) {
      setFeedback({ type: "error", message: "La cantidad debe ser mayor a 0" });
      return;
    }

    if (normalizedQty <= 0) {
      setFeedback({ type: "error", message: "La cantidad debe ser mayor a 0" });
      return;
    }

    setCartState((prev) => {
      const target = prev.find((item) => item.product_id === productId);
      if (!target) return prev;

      if (!posSettings.allow_negative_stock && normalizedQty > target.stock_available) {
        setFeedback({
          type: "error",
          message: `Stock insuficiente para ${target.name}`,
        });
        return prev;
      }

      return prev.map((item) =>
        item.product_id === productId
          ? {
              ...item,
              quantity: normalizedQty,
            }
          : item
      );
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
            }
          : item
      );
    });
  };

  const increaseQuantity = (productId: string) => {
    const item = cartState.find((row) => row.product_id === productId);
    if (!item) return;
    const step = item.sale_mode === "weight" ? 0.1 : 1;
    setCartItemQuantity(productId, item.quantity + step);
  };

  const decreaseQuantity = (productId: string) => {
    const item = cartState.find((row) => row.product_id === productId);
    if (!item) return;
    const step = item.sale_mode === "weight" ? 0.1 : 1;
    setCartItemQuantity(productId, item.quantity - step);
  };

  const removeFromCart = (productId: string) => {
    setCartState((prev) => prev.filter((item) => item.product_id !== productId));
  };

  const clearCart = () => setCartState([]);

  const setSelectedCustomer = useCallback((customerId: string) => {
    const normalized = customerId.trim();
    setSelectedCustomerId(normalized);
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
      calculateSummaryByMethod(subtotal, getPaymentMethodById(paymentMethodId)),
    [getPaymentMethodById, subtotal]
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

    if (!cart.length) {
      setFeedback({ type: "error", message: "No hay items en el carrito" });
      return null;
    }

    const paymentMethod = getPaymentMethodById(values.paymentMethodId);
    if (!paymentMethod || !paymentMethod.is_active) {
      setFeedback({ type: "error", message: "Medio de pago invalido o inactivo" });
      return null;
    }

    const paymentDetails =
      values.paymentDetails && typeof values.paymentDetails === "object"
        ? (values.paymentDetails as Record<string, unknown>)
        : null;
    const paymentMethodCode = normalizePaymentMethodCode(paymentMethod.code);
    const paymentMethodConfig = getPaymentMethodPosConfig(paymentMethod);
    const isMercadoPagoMethod = paymentMethodCode === "mercado_pago";
    const isCurrentAccountMethod = paymentMethodCode === "current_account";
    const isMercadoPagoManual =
      isMercadoPagoMethod && !mercadoPagoSettings.enabled;

    if (isCurrentAccountMethod && !values.customerId) {
      setFeedback({ type: "error", message: "Cliente obligatorio para cuenta corriente" });
      return null;
    }

    if (isMercadoPagoMethod) {
      if (isMercadoPagoManual) {
        const operationId =
          typeof paymentDetails?.operation_id === "string"
            ? paymentDetails.operation_id.trim()
            : "";
        if (paymentMethodConfig.ask_operation_number && !operationId) {
          setFeedback({
            type: "error",
            message: "Completa el ID de operacion para Mercado Pago manual",
          });
          return null;
        }
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

    if (!posSettings.allow_sale_without_customer && !values.customerId?.trim()) {
      setFeedback({ type: "error", message: "La configuracion requiere cliente para vender" });
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
    const requiresCashMovementRegistration = !isCurrentAccountMethod;

    if (isCurrentAccountMethod && normalizedCustomerId) {
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
        const projectedBalance = roundAmount(selectedCustomerForSale.current_balance + summary.total);
        if (projectedBalance > currentAccountProfile.limit) {
          setFeedback({
            type: "error",
            message: "El importe supera el limite de cuenta corriente del cliente",
          });
          return null;
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

    if ((requireOpenSessionForSale || requiresOpenCashSessionForSale) && !openSession) {
      setFeedback({
        type: "error",
        message: "Debes abrir caja antes de registrar movimientos contables",
      });
      return null;
    }

    if (!isOnline) {
      setIsSubmitting(true);
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

        await auditService.createSafe(tenantId, {
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
        refreshPending();
        return null;
      } catch {
        setFeedback({
          type: "error",
          message: "No se pudo guardar la venta offline",
        });
        return null;
      } finally {
        setIsSubmitting(false);
      }
    }

    setIsSubmitting(true);
    setGeneratedReceipt(null);
    setGeneratedInvoice(null);

    try {
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
        notes: values.notes?.trim() || null,
        current_account_id: null,
        arca_document_id: null,
        mercado_pago_preference_id:
          isMercadoPagoMethod ? (mercadoPagoIntent?.reference ?? null) : null,
      });
      const updatedStockByProductId = new Map<string, number>();

      for (const item of cart) {
        await salesService.createItem(tenantId, {
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
            cart_promotion_snapshot: promotionsResolution.applied_cart_promotion
              ? ({ ...promotionsResolution.applied_cart_promotion } as Record<string, unknown>)
              : null,
            cart_promotion_discount_allocated: item.cart_promotion_discount_total,
            is_manual_sale_item: item.is_manual_item,
          },
        });

        if (item.is_manual_item) {
          continue;
        }

        await stockService.create(tenantId, {
          product_id: item.product_id,
          movement_type: "sale",
          quantity: item.quantity,
          reference_type: "sale",
          reference_id: sale.id,
          notes: `Venta ${sale.sale_number}`,
          created_by: resolvedCreatedBy,
        });

        const nextStock = posSettings.allow_negative_stock
          ? roundQty(item.stock_available - item.quantity)
          : roundQty(Math.max(0, item.stock_available - item.quantity));
        await productsService.updateStock(tenantId, item.product_id, nextStock);
        updatedStockByProductId.set(item.product_id, nextStock);
      }

      const paymentCapturedAt = new Date().toISOString();
      const manualMercadoPagoOperationId =
        isMercadoPagoManual && typeof paymentDetails?.operation_id === "string"
          ? paymentDetails.operation_id.trim() || null
          : null;

      await salesService.createPayment(tenantId, {
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
        await auditService.createSafe(tenantId, {
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

      if (isCurrentAccountMethod) {
        await currentAccountsService.createMovement(tenantId, {
          customer_id: values.customerId!,
          sale_id: sale.id,
          type: "debt",
          amount: summary.total,
          notes: `Venta ${sale.sale_number}`,
          created_by: resolvedCreatedBy,
        });
      }

      if (requiresCashMovementRegistration && openSession) {
        await cashService.createMovement(tenantId, {
          cash_session_id: openSession.id,
          movement_type: "sale_payment",
          amount: summary.total,
          currency_code: "ARS",
          reference_type: paymentMethod.code,
          reference_id: sale.id,
          notes: `Cobro venta ${sale.sale_number} - ${paymentMethod.name}`,
          created_by: resolvedCreatedBy,
        });
      }

      const receipt = await receiptsService.create(tenantId, {
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
        notes: values.notes?.trim() || null,
        created_by: resolvedCreatedBy,
      });

      let generatedInvoiceFromSale: Invoice | null = null;
      const postSaleMessages: string[] = [];

      if (values.issueInvoice) {
        if (!sale.customer_id) {
          postSaleMessages.push("Sin cliente: no se emitio factura fiscal.");
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
              const customerValidation = arcaInvoicesService.validateCustomerTaxData(
                generatedInvoiceFromSale.customer_snapshot
              );
              if (!customerValidation.valid) {
                postSaleMessages.push(
                  `Factura interna generada. No se envio a ARCA: ${customerValidation.errors.join(
                    ". "
                  )}`
                );
                await auditService.createSafe(tenantId, {
                  user_id: resolvedCreatedBy,
                  module: "facturacion",
                  action: "arca_validation_error",
                  entity_type: "invoice",
                  entity_id: generatedInvoiceFromSale.id,
                  description: `Validacion ARCA fallida desde POS: ${generatedInvoiceFromSale.document_number}`,
                  metadata: {
                    errors: customerValidation.errors,
                    mode: arcaOperationalStatus.mode,
                  },
                });
              } else {
                const pendingInvoice = await invoicesService.updateArcaStatus(
                  tenantId,
                  generatedInvoiceFromSale.id,
                  {
                    arca_status: "pending",
                    arca_reference: generatedInvoiceFromSale.arca_reference,
                    arca_message: `Factura enviada a ARCA (${arcaOperationalStatus.mode}) desde POS. Procesando...`,
                  }
                );

                await auditService.createSafe(tenantId, {
                  user_id: resolvedCreatedBy,
                  module: "facturacion",
                  action: "arca_send",
                  entity_type: "invoice",
                  entity_id: pendingInvoice.id,
                  description: `Envio ARCA desde POS: ${pendingInvoice.document_number}`,
                  metadata: {
                    previous_arca_status: generatedInvoiceFromSale.arca_status,
                    next_arca_status: "pending",
                    mode: arcaOperationalStatus.mode,
                  },
                });

                const sendResult = await arcaInvoicesService.sendInvoice(pendingInvoice, {
                  settings: arcaSettings,
                });
                const statusResult = await arcaInvoicesService.checkInvoiceStatus(
                  sendResult.reference ?? `ARCA-MOCK-${Date.now()}`,
                  {
                    forcedStatus:
                      sendResult.status === "accepted" || sendResult.status === "rejected"
                        ? sendResult.status
                        : undefined,
                    settings: arcaSettings,
                    tenantId,
                  }
                );

                const finalArcaStatus: Invoice["arca_status"] =
                  statusResult.status === "accepted" || statusResult.status === "rejected"
                    ? statusResult.status
                    : sendResult.status === "accepted" || sendResult.status === "rejected"
                      ? sendResult.status
                      : "pending";

                generatedInvoiceFromSale = await invoicesService.updateArcaStatus(
                  tenantId,
                  pendingInvoice.id,
                  {
                    arca_status: finalArcaStatus,
                    arca_reference: sendResult.reference,
                    arca_message:
                      finalArcaStatus === "accepted"
                        ? "Factura aprobada por ARCA"
                        : finalArcaStatus === "rejected"
                          ? "Factura rechazada por ARCA"
                          : "Factura enviada a ARCA. Estado pendiente",
                  }
                );

                await auditService.createSafe(tenantId, {
                  user_id: resolvedCreatedBy,
                  module: "facturacion",
                  action: "arca_status_change",
                  entity_type: "invoice",
                  entity_id: generatedInvoiceFromSale.id,
                  description: `Estado ARCA actualizado desde POS: ${generatedInvoiceFromSale.arca_status}`,
                  metadata: {
                    arca_reference: generatedInvoiceFromSale.arca_reference,
                    arca_response: sendResult.rawResponse,
                    arca_status_check: statusResult.rawResponse,
                    mode: arcaOperationalStatus.mode,
                  },
                });

                postSaleMessages.push(
                  generatedInvoiceFromSale.arca_status === "accepted"
                    ? "Factura aprobada por ARCA."
                    : generatedInvoiceFromSale.arca_status === "rejected"
                      ? "Factura rechazada por ARCA."
                      : "Factura enviada a ARCA. Pendiente."
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
                description: `Envio ARCA bloqueado desde POS: ${generatedInvoiceFromSale.document_number}`,
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
      await auditService.createSafe(tenantId, {
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
            : "Venta registrada correctamente",
      });

      setMercadoPagoIntent(null);
      clearCart();
      setSelectedCustomerId("");
      if (updatedStockByProductId.size) {
        setProducts((previous) =>
          previous.map((product) => {
            const updatedStock = updatedStockByProductId.get(product.id);
            return updatedStock == null ? product : { ...product, stock_current: updatedStock };
          })
        );
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
      setIsSubmitting(false);
    }
  };

  return {
    products,
    favoriteProducts,
    primaryBarcodes,
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
    selectedCustomerId,
    selectedCustomer,
    appliedPriceList,
    cart,
    subtotal,
    subtotalBeforePromotions,
    promotionDiscountTotal,
    cartPromotionDiscountTotal,
    isLoading,
    isSubmitting,
    isMercadoPagoLoading,
    feedback,
    clearFeedback,
    reload: loadPosData,
    addProductToCart,
    addManualProductToCart,
    createProductFromPosAndAddToCart,
    addProductByBarcode,
    setSelectedCustomer,
    setCartItemQuantity,
    updateCartItem,
    increaseQuantity,
    decreaseQuantity,
    removeFromCart,
    clearCart,
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
