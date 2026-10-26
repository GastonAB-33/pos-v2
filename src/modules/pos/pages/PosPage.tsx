import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/utils/cn";
import { BarcodeScannerModal } from "@/components/form/BarcodeScannerModal";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { IconButton } from "@/components/ui/IconButton";
import { Banknote, Camera, CreditCard, FileText, Landmark, LockOpen, Moon, MoonStar, RefreshCw, Search, ShoppingCart, Sun, User as UserIcon, X } from "lucide-react";
import { useToast } from "@/components/ui/useToast";
import { routePaths } from "@/config/routes";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useOffline } from "@/features/offline/hooks/useOffline";
import { offlineService } from "@/services/offline.service";
import { usePwa } from "@/features/pwa/hooks/usePwa";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { PosCustomerModal, type PosCustomerModalValues } from "@/modules/pos/components/PosCustomerModal";
import { getEditableDocumentNumber } from "@/modules/configuracion/hooks/useEntityRequirements";
import { CashOpenForm } from "@/modules/caja/components/CashOpenForm";
import { serializeCloseSnapshot, type CashCloseSnapshot } from "@/modules/caja/hooks/useCashModule";
import { ReceiptTicketPanel } from "@/modules/comprobantes/components/ReceiptTicketPanel";
import { PosCart } from "@/modules/pos/components/PosCart";
import { PosCartDiscountModal } from "@/modules/pos/components/PosCartDiscountModal";
import { PosCartItemEditModal } from "@/modules/pos/components/PosCartItemEditModal";
import { PosCheckoutPanel } from "@/modules/pos/components/PosCheckoutPanel";
import { PosDebtPaymentModal } from "@/modules/pos/components/PosDebtPaymentModal";
import { PosItemPromoModal } from "@/modules/pos/components/PosItemPromoModal";
import { PosProductList } from "@/modules/pos/components/PosProductList";
import { PosQuickProductModal } from "@/modules/pos/components/PosQuickProductModal";
import { PosSmartView } from "@/modules/pos/components/PosSmartView";
import { useBarcodeScanner } from "@/modules/pos/hooks/useBarcodeScanner";
import { usePosSale, type PosCartItemComputed, getBackendErrorMessage } from "@/modules/pos/hooks/usePosSale";
import type { PosCheckoutValues } from "@/modules/pos/schemas/pos-checkout.schema";
import { useUiStore } from "@/store/ui.store";
import { useProductsStore } from "@/features/products/store/products.store";
import type { OpenCashValues } from "@/modules/caja/schemas/cash.schemas";
import { computePricingBackward, roundMoney } from "@/modules/productos/utils/product-pricing";
import { auditService } from "@/services/audit.service";
import { bankAccountsService } from "@/services/bank-accounts.service";
import { cashService } from "@/services/cash.service";
import { customersService } from "@/services/customers.service";
import { productsService, type UpdateProductInput } from "@/services/products.service";
import { invoicesService } from "@/services/invoices.service";
import { normalizePaymentMethodCode } from "@/services/payment-methods.service";
import { posCustomerProfilesService } from "@/services/pos-customer-profiles.service";
import { receiptsService } from "@/services/receipts.service";
import { salesService } from "@/services/sales.service";
import { settingsService } from "@/services/settings.service";
import { usersService } from "@/services/users.service";
import type { BankAccount, Customer, Invoice, OriginBank, PaymentMethodType, Receipt, SaleItem } from "@/types/entities";

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export interface PosReceiptPaymentSummary {
  methodCode: string;
  methodName: string;
  amount: number;
  bankAccountId?: string | null;
  bankName?: string | null;
  holderName?: string | null;
}

interface PosRecentReceiptItem {
  receipt: Receipt;
  invoice: Invoice | null;
  payments?: PosReceiptPaymentSummary[];
}

interface PosReceiptModalState {
  receipt: Receipt;
  invoice: Invoice | null;
  view: "ticket" | "invoice";
  autoPrint: boolean;
}

export const formatFriendlyReceiptNumber = (
  saleNumber?: string | null,
  receiptNumber?: string | null,
  invoice?: Invoice | null
): { display: string; fullNumber: string } => {
  if (invoice?.document_number) {
    return {
      display: `Factura ${invoice.document_type || "B"} Nº ${invoice.document_number}`,
      fullNumber: invoice.document_number,
    };
  }

  const raw = receiptNumber || saleNumber || "Comprobante";

  // Formato tipo VTA-1791997874121-4626 (extraer el sufijo legible de 4 dígitos)
  const vtaMatch = (saleNumber || raw).match(/VTA-\d+-(\d+)/i);
  if (vtaMatch) {
    return {
      display: `Ticket #${vtaMatch[1]}`,
      fullNumber: saleNumber || raw,
    };
  }

  // Formato tipo TCK-1791997874131 o TCK-OFF-1791997874131
  const tckMatch = raw.match(/TCK(?:-OFF)?-\d*(\d{4})/i);
  if (tckMatch) {
    return {
      display: `Ticket #${tckMatch[1]}`,
      fullNumber: raw,
    };
  }

  return {
    display: raw,
    fullNumber: raw,
  };
};

interface PosCustomerModalState {
  mode: "create" | "edit";
  customer: Customer | null;
  initialValues: PosCustomerModalValues;
  defaultTab?: "personal" | "fiscal" | "account";
}

interface PosCurrentAccountSnapshot {
  enabled: boolean;
  limit: number | null;
  debt: number;
  available: number | null;
}

const splitCustomerName = (fullName: string): { firstName: string; lastName: string } => {
  const normalized = fullName.trim().replace(/\s+/g, " ");
  if (!normalized) return { firstName: "", lastName: "" };

  const [firstName, ...rest] = normalized.split(" ");
  return {
    firstName,
    lastName: rest.join(" "),
  };
};

const buildCustomerCode = (name: string): string => {
  const normalized = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .map((part) => part.slice(0, 3))
    .join("");

  return `${normalized || "CLI"}-${Date.now().toString().slice(-6)}`;
};

export const PosPage = () => {
  const { tenant, tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);
  const { canRead, canWrite } = usePermissions();
  const canReadPos = canRead("pos");
  const canWritePos = canWrite("pos");
  const canWriteCustomers = canWrite("clientes");
  const canWriteProducts = canWrite("productos");
  const { success: toastSuccess, error: toastError } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    isOnline,
    isSyncing,
    lastSyncMessage,
    lastSyncError,
    syncNow,
    clearSyncError,
  } = useOffline();
  const { canInstall, isInstalled, isInstalling, installApp, isInstallSupported } = usePwa();

  const {
    products,
    favoriteProducts,
    primaryBarcodes,
    actualPrimaryBarcodes,
    customers,
    paymentMethods,
    bankAccounts,
    originBanks,
    installmentPlans,
    posSettings,
    mercadoPagoSettings,
    mercadoPagoStatus,
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
    appliedPriceList,
    cart,
    cartManualDiscount,
    manualCartDiscountTotal,
    promotions,
    applyCartDiscount,
    applyItemDiscount,
    applyItemPromotion,
    subtotalBeforePromotions,
    promotionDiscountTotal,
    cartPromotionDiscountTotal,
    discountsEnabled,
    toggleDiscounts,
    roundingEnabled,
    toggleRounding,
    lastAddedProductId,
    isLoading,
    isSubmitting,
    isMercadoPagoLoading,
    feedback,
    clearFeedback,
    reload,
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
    cycleReturnableStatus,
    hasOwedReturnables,
    owedReturnablesCount,
    createOriginBank,
    mercadoPagoIntent,
    startMercadoPagoPayment,
    refreshMercadoPagoPayment,
    approveMercadoPagoPayment,
    rejectMercadoPagoPayment,
    cancelMercadoPagoPayment,
    clearMercadoPagoIntent,
    getCheckoutSummary,
    confirmSale,
    clearCart,
    generatedReceipt,
    generatedInvoice,
    clearGeneratedReceipt,
    arcaEnabledForPos,
    arcaSettings,
    defaultInvoiceDocumentType,
    paymentMethodInvoiceRules,
  } = usePosSale(tenantId);

  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState("");
  const [visibleBarcodeValue, setVisibleBarcodeValue] = useState("");
  const [searchResetToken, setSearchResetToken] = useState(0);
  const [isReceiptsListModalOpen, setIsReceiptsListModalOpen] = useState(false);
  const [recentReceipts, setRecentReceipts] = useState<PosRecentReceiptItem[]>([]);
  const [receiptsSearchTerm, setReceiptsSearchTerm] = useState("");
  const [isLoadingReceipts, setIsLoadingReceipts] = useState(false);
  const [receiptModal, setReceiptModal] = useState<PosReceiptModalState | null>(null);
  const [printMenuReceiptId, setPrintMenuReceiptId] = useState<string | null>(null);
  const [customerModalState, setCustomerModalState] = useState<PosCustomerModalState | null>(null);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isDebtPaymentModalOpen, setIsDebtPaymentModalOpen] = useState(false);
  const [isQuickProductModalOpen, setIsQuickProductModalOpen] = useState(false);
  const [isCartDiscountModalOpen, setIsCartDiscountModalOpen] = useState(false);
  const [itemPromoModalTarget, setItemPromoModalTarget] = useState<PosCartItemComputed | null>(null);
  const [lastNotFoundBarcode, setLastNotFoundBarcode] = useState<string>("");
  const posWindowMode = useUiStore((state) => state.posWindowMode);
  const theme = useUiStore((state) => state.theme);
  const cycleTheme = useUiStore((state) => state.cycleTheme);
  const isSmartPos = posWindowMode === "smart_pos";
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [isCustomerModalSubmitting, setIsCustomerModalSubmitting] = useState(false);
  const [clientLogoUrl, setClientLogoUrl] = useState<string | null>(null);
  const [clientDisplayName, setClientDisplayName] = useState("POS");
  const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false);
  const [openCashSessionId, setOpenCashSessionId] = useState<string | null>(null);
  const [resolvedOperatorUserId, setResolvedOperatorUserId] = useState<string | null>(null);
  const [isResolvingOperatorUser, setIsResolvingOperatorUser] = useState(false);
  const [hasResolvedOperatorUser, setHasResolvedOperatorUser] = useState(false);
  const [hasResolvedCashGate, setHasResolvedCashGate] = useState(false);
  const [isCheckingCashSession, setIsCheckingCashSession] = useState(false);
  const [isOpeningCashSession, setIsOpeningCashSession] = useState(false);
  const [cashDefaultOpeningAmount, setCashDefaultOpeningAmount] = useState(0);
  const [hasLoadedCashDefaults, setHasLoadedCashDefaults] = useState(false);
  const [cashGateFeedback, setCashGateFeedback] = useState<string | null>(null);
  const [isCartHighlighted, setIsCartHighlighted] = useState(false);
  const cartHighlightTimeoutRef = useRef<number | null>(null);

  const triggerCartSuccessHighlight = useCallback(() => {
    setIsCartHighlighted(true);
    if (cartHighlightTimeoutRef.current) {
      window.clearTimeout(cartHighlightTimeoutRef.current);
    }
    cartHighlightTimeoutRef.current = window.setTimeout(() => {
      setIsCartHighlighted(false);
      cartHighlightTimeoutRef.current = null;
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (cartHighlightTimeoutRef.current) {
        window.clearTimeout(cartHighlightTimeoutRef.current);
      }
    };
  }, []);
  const scannerCaptureRef = useRef<HTMLInputElement | null>(null);
  const cartPanelId = "pos-cart-panel";
  const checkoutPanelId = "pos-checkout-panel";
  const checkoutFormId = "pos-checkout-form";
  const isCashGateResolving =
    !hasResolvedCashGate || isResolvingOperatorUser || isCheckingCashSession;
  const isCashGateBlocking =
    canWritePos && (isOpeningCashSession || !openCashSessionId);
  const shouldShowCashOpeningModal =
    canWritePos && !isCashGateResolving && !isOpeningCashSession && !openCashSessionId;

  // Resuelve el ID del medio de pago predeterminado según la configuración
  const getEffectiveDefaultPaymentMethodId = useCallback(() => {
    if (!paymentMethods.length) return "";
    const defaultId = posSettings.default_payment_method_id;
    if (defaultId && paymentMethods.some((method) => method.id === defaultId)) {
      return defaultId;
    }
    // Si no está configurado o no existe, priorizar Efectivo si existe, sino el primero
    const cashMethod = paymentMethods.find(
      (m) => normalizePaymentMethodCode(m.code) === "cash"
    );
    return cashMethod?.id ?? paymentMethods[0].id;
  }, [paymentMethods, posSettings.default_payment_method_id]);

  useEffect(() => {
    setSelectedPaymentMethodId(getEffectiveDefaultPaymentMethodId());
  }, [getEffectiveDefaultPaymentMethodId]);

  // Al abrir el modal de cobro, resetear al medio de pago predeterminado
  useEffect(() => {
    if (isCheckoutModalOpen) {
      setSelectedPaymentMethodId(getEffectiveDefaultPaymentMethodId());
    }
  }, [isCheckoutModalOpen, getEffectiveDefaultPaymentMethodId]);

  useEffect(() => {
    const selectedMethod =
      paymentMethods.find((method) => method.id === selectedPaymentMethodId) ?? null;
    if (!selectedMethod || normalizePaymentMethodCode(selectedMethod.code) !== "mercado_pago") {
      clearMercadoPagoIntent();
    }
  }, [clearMercadoPagoIntent, paymentMethods, selectedPaymentMethodId]);

  const checkoutSummary = useMemo(
    () => getCheckoutSummary(selectedPaymentMethodId || null),
    [getCheckoutSummary, selectedPaymentMethodId]
  );
  const productCategories = useMemo(
    () =>
      Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [products]
  );
  const editingCartItem = useMemo(() => {
    if (!editingCartItemId) return null;
    const cartItem = cart.find((item) => item.product_id === editingCartItemId);
    if (!cartItem) return null;
    const product = products.find((p) => p.id === cartItem.product_id);
    const barcode = actualPrimaryBarcodes[cartItem.product_id] ?? null;
    return {
      ...cartItem,
      code: product?.code ?? null,
      barcode,
    };
  }, [cart, editingCartItemId, products, actualPrimaryBarcodes]);
  const existingDebtItem = useMemo(
    () => cart.find((item) => item.is_debt_payment_item) ?? null,
    [cart]
  );
  const returnToPanelPath = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const returnTo = params.get("returnTo");

    if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
      return returnTo;
    }

    return routePaths.home;
  }, [location.search]);

  const shouldShowReturnToPanel = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return isInstalled || params.get("from") === "panel-web" || params.has("returnTo");
  }, [isInstalled, location.search]);

  const handleReturnToPanel = useCallback(() => {
    navigate(returnToPanelPath);
  }, [navigate, returnToPanelPath]);

  const currentAccountSnapshot = useMemo<PosCurrentAccountSnapshot | null>(() => {
    if (!tenantId || !selectedCustomer) return null;

    const legacyProfile = posCustomerProfilesService.getProfile(tenantId, selectedCustomer.id);
    const enabled = selectedCustomer.current_account_enabled ?? legacyProfile.enabled;
    const limit = selectedCustomer.current_account_limit ?? legacyProfile.limit;
    const debt = Number((selectedCustomer.current_balance ?? 0).toFixed(2));
    const available =
      enabled && limit != null
        ? Number((limit - debt).toFixed(2))
        : null;

    return {
      enabled,
      limit,
      debt,
      available,
    };
  }, [selectedCustomer, tenantId]);

  const loadRecentReceipts = useCallback(async () => {
    if (!tenantId) {
      setRecentReceipts([]);
      return;
    }

    setIsLoadingReceipts(true);
    try {
      const [receiptsRes, invoicesRes, salesRes, paymentsRes, banksRes] = await Promise.allSettled([
        receiptsService.getAllByTenant(tenantId),
        invoicesService.getAllByTenant(tenantId),
        salesService.getAllByTenant(tenantId),
        salesService.getAllPaymentsByTenant(tenantId),
        bankAccountsService.getAllByTenant(tenantId),
      ]);

      const receiptRows = receiptsRes.status === "fulfilled" ? receiptsRes.value : [];
      const invoiceRows = invoicesRes.status === "fulfilled" ? invoicesRes.value : [];
      const salesRows = salesRes.status === "fulfilled" ? salesRes.value : [];
      const paymentRows = paymentsRes.status === "fulfilled" ? paymentsRes.value : [];
      const allBanks = banksRes.status === "fulfilled" ? banksRes.value : bankAccounts;

      const bankMap = new Map<string, BankAccount>();
      for (const b of allBanks) {
        bankMap.set(b.id, b);
      }
      for (const b of bankAccounts) {
        if (!bankMap.has(b.id)) bankMap.set(b.id, b);
      }

      const paymentsBySaleId = new Map<string, PosReceiptPaymentSummary[]>();
      for (const p of paymentRows) {
        if (!p.sale_id) continue;
        const meta = (p.metadata ?? {}) as Record<string, unknown>;
        const methodSnapshot = meta.payment_method_snapshot as Record<string, unknown> | undefined;
        const paymentDetails = (meta.payment_details ?? {}) as Record<string, unknown>;
        const destAccountId =
          (typeof paymentDetails.destination_account_id === "string" && paymentDetails.destination_account_id) || null;
        const bank = destAccountId ? bankMap.get(destAccountId) : null;

        const methodCode = p.payment_method_code;
        let methodName = (typeof methodSnapshot?.name === "string" && methodSnapshot.name) || "";
        if (!methodName) {
          if (methodCode === "cash") methodName = "Efectivo";
          else if (methodCode === "transfer" || methodCode === "bank_transfer") methodName = "Transferencia bancaria";
          else if (methodCode === "card" || methodCode === "debit" || methodCode === "credit") methodName = "Tarjeta";
          else if (methodCode === "current_account") methodName = "Cuenta Corriente";
          else if (methodCode === "mercado_pago") methodName = "Mercado Pago";
          else methodName = methodCode;
        }

        const bankName = bank ? bank.bank_name : (typeof paymentDetails.bank_name === "string" ? paymentDetails.bank_name : null);
        const holderName = bank ? bank.holder_name : (typeof paymentDetails.holder_name === "string" ? paymentDetails.holder_name : null);

        const currentList = paymentsBySaleId.get(p.sale_id) ?? [];
        currentList.push({
          methodCode,
          methodName,
          amount: p.amount,
          bankAccountId: destAccountId,
          bankName,
          holderName,
        });
        paymentsBySaleId.set(p.sale_id, currentList);
      }

      const receiptSaleIds = new Set<string>();
      for (const r of receiptRows) {
        if (r.sale_id) receiptSaleIds.add(r.sale_id);
      }

      const syntheticReceipts: Receipt[] = [];
      for (const sale of salesRows) {
        if (!sale.id || receiptSaleIds.has(sale.id)) continue;
        if (sale.status === "cancelled") continue;
        syntheticReceipts.push({
          id: `synth-${sale.id}`,
          tenant_id: tenantId,
          sale_id: sale.id,
          sale_number: sale.sale_number,
          receipt_number: `TCK-${sale.sale_number}`,
          issued_at: sale.created_at || new Date().toISOString(),
          customer_name: sale.customer ? (sale.customer.full_name || "") : null,
          payment_method: "cash" as PaymentMethodType,
          items: (sale.items ?? []).map((it: SaleItem) => ({
            name: it.product_name_snapshot || "Producto",
            quantity: it.quantity,
            unit_price: it.unit_price,
            subtotal: it.line_total ?? it.unit_price * it.quantity,
          })),
          total: sale.total,
          notes: sale.notes,
          created_by: null,
          created_at: sale.created_at || new Date().toISOString(),
          updated_at: sale.updated_at || new Date().toISOString(),
        });
      }

      const allCombinedReceipts = [...receiptRows, ...syntheticReceipts]
        .sort((a, b) => (b.issued_at || "").localeCompare(a.issued_at || ""))
        .slice(0, 100);

      const invoiceBySaleId = new Map<string, Invoice>();
      [...invoiceRows]
        .filter((invoice) => invoice.sale_id)
        .sort((a, b) => b.issue_date.localeCompare(a.issue_date))
        .forEach((invoice) => {
          if (!invoice.sale_id || invoiceBySaleId.has(invoice.sale_id)) return;
          invoiceBySaleId.set(invoice.sale_id, invoice);
        });

      const merged: PosRecentReceiptItem[] = allCombinedReceipts.map((receipt) => {
        let payments = paymentsBySaleId.get(receipt.sale_id);
        if (!payments || payments.length === 0) {
          const rawMethod = String(receipt.payment_method || "").toLowerCase();
          let methodName = "Efectivo";
          let bankName: string | null = null;
          let holderName: string | null = null;

          if (rawMethod.includes("transfer")) {
            methodName = "Transferencia bancaria";
            for (const b of allBanks) {
              if (receipt.notes && receipt.notes.toLowerCase().includes(b.bank_name.toLowerCase())) {
                bankName = b.bank_name;
                holderName = b.holder_name;
                break;
              }
            }
          } else if (rawMethod.includes("card") || rawMethod.includes("debit") || rawMethod.includes("credit")) {
            methodName = "Tarjeta";
          } else if (rawMethod.includes("current_account")) {
            methodName = "Cuenta Corriente";
          } else if (rawMethod.includes("mercado_pago")) {
            methodName = "Mercado Pago";
          }

          payments = [
            {
              methodCode: receipt.payment_method || "cash",
              methodName,
              amount: receipt.total,
              bankName,
              holderName,
            },
          ];
        }

        return {
          receipt,
          invoice: invoiceBySaleId.get(receipt.sale_id) ?? null,
          payments,
        };
      });

      setRecentReceipts(merged);
    } catch {
      toastError("No se pudieron cargar comprobantes recientes.");
    } finally {
      setIsLoadingReceipts(false);
    }
  }, [bankAccounts, tenantId, toastError]);

  const filteredReceipts = useMemo(() => {
    const query = receiptsSearchTerm.trim().toLowerCase();
    if (!query) return recentReceipts;

    return recentReceipts.filter((item) => {
      const saleNum = (item.receipt.sale_number || "").toLowerCase();
      const rcptNum = (item.receipt.receipt_number || "").toLowerCase();
      const custName = (item.receipt.customer_name || "").toLowerCase();
      const notes = (item.receipt.notes || "").toLowerCase();
      const totalStr = item.receipt.total.toString();
      const invNum = (item.invoice?.document_number || "").toLowerCase();

      const matchesPayments = (item.payments ?? []).some((p) => {
        const mName = p.methodName.toLowerCase();
        const bName = (p.bankName || "").toLowerCase();
        const hName = (p.holderName || "").toLowerCase();
        return mName.includes(query) || bName.includes(query) || hName.includes(query);
      });

      return (
        saleNum.includes(query) ||
        rcptNum.includes(query) ||
        custName.includes(query) ||
        notes.includes(query) ||
        totalStr.includes(query) ||
        invNum.includes(query) ||
        matchesPayments
      );
    });
  }, [recentReceipts, receiptsSearchTerm]);

  const loadCashSessionGate = useCallback(async () => {
    if (!tenantId) {
      setOpenCashSessionId(null);
      setCashDefaultOpeningAmount(0);
      setHasLoadedCashDefaults(false);
      setCashGateFeedback(null);
      setHasResolvedCashGate(false);
      return;
    }

    if (!resolvedOperatorUserId) {
      if (!hasResolvedOperatorUser || isResolvingOperatorUser || isLoading) {
        setCashGateFeedback(null);
        setHasResolvedCashGate(false);
        return;
      }

      setOpenCashSessionId(null);
      setCashDefaultOpeningAmount(0);
      setCashGateFeedback(
        user
          ? "Tu sesión no está vinculada a un usuario del comercio. Inicia sesión nuevamente."
          : null
      );
      setHasResolvedCashGate(true);
      return;
    }

    if (!navigator.onLine) {
      await offlineService.hydrate();
      const cachedSession = offlineService.getPosSnapshot(tenantId)?.open_cash_session ?? null;
      setOpenCashSessionId(cachedSession?.status === "open" ? cachedSession.id : null);
      setCashGateFeedback(cachedSession?.status === "open" ? "Caja local disponible sin conexion." : "No hay una caja local abierta para operar sin conexion.");
      setHasResolvedCashGate(true);
      return;
    }

    setIsCheckingCashSession(true);
    try {
      const [tenantSettings, openSession] = await Promise.all([
        hasLoadedCashDefaults ? Promise.resolve(null) : settingsService.getByTenant(tenantId),
        cashService.getOpenSession(tenantId),
      ]);

      if (tenantSettings) {
        setCashDefaultOpeningAmount(tenantSettings.caja?.default_opening_amount ?? 0);
        setHasLoadedCashDefaults(true);
      }
      setOpenCashSessionId(openSession?.id ?? null);
      offlineService.updateCachedCashSession(tenantId, openSession);
      setCashGateFeedback(null);
      setHasResolvedCashGate(true);
    } catch {
      setOpenCashSessionId(null);
      setCashGateFeedback("No se pudo validar la caja abierta del comercio.");
      setHasResolvedCashGate(true);
    } finally {
      setIsCheckingCashSession(false);
    }
  }, [
    hasLoadedCashDefaults,
    hasResolvedOperatorUser,
    isLoading,
    isResolvingOperatorUser,
    resolvedOperatorUserId,
    tenantId,
    user,
  ]);

  const resolveOperatorUser = useCallback(async () => {
    if (!tenantId || !user?.id) {
      setResolvedOperatorUserId(null);
      setIsResolvingOperatorUser(false);
      setHasResolvedOperatorUser(true);
      return;
    }

    const cacheKey = `pos-operator-user:${tenantId}:${user.id}`;
    const cachedResolvedUserId = window.sessionStorage.getItem(cacheKey)?.trim() ?? "";
    if (cachedResolvedUserId) {
      setResolvedOperatorUserId(cachedResolvedUserId);
      setIsResolvingOperatorUser(false);
      setHasResolvedOperatorUser(true);
      return;
    }

    const persistResolvedUser = (resolvedId: string | null, useCache = true) => {
      if (useCache && resolvedId) {
        window.sessionStorage.setItem(cacheKey, resolvedId);
      } else {
        window.sessionStorage.removeItem(cacheKey);
      }
      setResolvedOperatorUserId(resolvedId);
    };

    setIsResolvingOperatorUser(true);
    setHasResolvedOperatorUser(false);
    try {
      const byId = await usersService.getById(tenantId, user.id);
      if (byId?.is_active) {
        persistResolvedUser(byId.id);
        return;
      }

      const byAuth = await usersService.getByAuthUserId(user.id);
      if (byAuth?.is_active && byAuth.tenant_id === tenantId) {
        persistResolvedUser(byAuth.id);
        return;
      }

      const lookupValue = user.email?.trim() || user.username?.trim() || "";
      if (lookupValue) {
        const byIdentity = await usersService.getByEmailOrUsername(tenantId, lookupValue);
        if (byIdentity?.is_active) {
          persistResolvedUser(byIdentity.id);
          return;
        }
      }

      const allUsers = await usersService.getAllByTenant(tenantId);
      const normalizedFullName = user.fullName?.trim().toLowerCase() ?? "";
      if (normalizedFullName) {
        const byFullName =
          allUsers.find(
            (candidate) =>
              candidate.is_active &&
              candidate.full_name.trim().toLowerCase() === normalizedFullName
          ) ?? null;
        if (byFullName) {
          persistResolvedUser(byFullName.id);
          return;
        }
      }

      const openSession = await cashService.getOpenSession(tenantId);
      if (openSession?.opened_by_user_id) {
        persistResolvedUser(openSession.opened_by_user_id, false);
        return;
      }

      persistResolvedUser(null);
    } catch {
      window.sessionStorage.removeItem(cacheKey);
      setResolvedOperatorUserId(null);
    } finally {
      setIsResolvingOperatorUser(false);
      setHasResolvedOperatorUser(true);
    }
  }, [tenantId, user?.email, user?.fullName, user?.id, user?.username]);

  useEffect(() => {
    setHasResolvedCashGate(false);
    setHasResolvedOperatorUser(false);
    setHasLoadedCashDefaults(false);
    setCashGateFeedback(null);
  }, [tenantId, user?.id]);

  useEffect(() => {
    void resolveOperatorUser();
  }, [resolveOperatorUser]);

  useEffect(() => {
    void loadCashSessionGate();
  }, [loadCashSessionGate]);

  useEffect(() => {
    const onFocus = () => {
      void loadCashSessionGate();
    };

    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
    };
  }, [loadCashSessionGate]);

  useEffect(() => {
    if (!feedback) return;

    if (feedback.type === "success") {
      toastSuccess(feedback.message);
      clearFeedback();
      return;
    }

    toastError(feedback.message);
    clearFeedback();
  }, [clearFeedback, feedback, toastError, toastSuccess]);

  useEffect(() => {
    void loadRecentReceipts();
  }, [loadRecentReceipts]);

  const isConfirmingSaleRef = useRef(false);

  const handleConfirmSale = useCallback(
    async (values: PosCheckoutValues) => {
      if (!canWritePos) return;
      if (isSubmitting || isConfirmingSaleRef.current) return;
      if (isOpeningCashSession) {
        toastError("Estamos abriendo la caja. Intenta nuevamente en unos segundos.");
        return;
      }
      if (!openCashSessionId) {
        if (isCashGateResolving) {
          toastError("Estamos validando caja y usuario. Intenta nuevamente en unos segundos.");
          return;
        }
        toastError("Debes abrir caja para registrar movimientos contables.");
        return;
      }
      if (!resolvedOperatorUserId) {
        toastError(
          "No encontramos un usuario de sistema asociado a tu sesion. Volve a iniciar sesion."
        );
        return;
      }
      isConfirmingSaleRef.current = true;
      try {
        clearFeedback();
        const sale = await confirmSale(values, resolvedOperatorUserId, { openCashSessionId });
        if (sale) {
          setIsCheckoutModalOpen(false);
          setSearchResetToken((prev) => prev + 1);
          setVisibleBarcodeValue("");
        }
      } finally {
        isConfirmingSaleRef.current = false;
      }
    },
    [
      canWritePos,
      clearFeedback,
      confirmSale,
      isCashGateResolving,
      isOpeningCashSession,
      isSubmitting,
      openCashSessionId,
      resolvedOperatorUserId,
      toastError,
    ]
  );

  const handleOpenCashFromPos = useCallback(
    async (values: OpenCashValues) => {
      if (!tenantId || !resolvedOperatorUserId) {
        setCashGateFeedback(
          "No encontramos un usuario de sistema asociado a tu sesion. Volve a iniciar sesion."
        );
        return;
      }

      setIsOpeningCashSession(true);
      try {
        const existingOpen = await cashService.getOpenSession(tenantId);
        if (existingOpen) {
          setOpenCashSessionId(existingOpen.id);
          setCashGateFeedback(null);
          setHasResolvedCashGate(true);
          return;
        }

        const openSnapshot: CashCloseSnapshot = {
          openingBillCounts: values.billCounts,
          openingCoinsAmount: values.coinsAmount,
          userNotes: values.notes?.trim() || "",
        };
        const serializedNotes = values.billCounts
          ? serializeCloseSnapshot(openSnapshot, values.notes?.trim() || null)
          : values.notes?.trim() || null;

        const createdSession = await cashService.create(tenantId, {
          branch_id: null,
          opened_by_user_id: resolvedOperatorUserId,
          closed_by_user_id: null,
          status: "open",
          opened_at: new Date().toISOString(),
          closed_at: null,
          opening_amount: values.openingAmount,
          closing_amount: null,
          expected_closing_amount: null,
          closing_difference: null,
          notes: serializedNotes,
          opening_bill_counts: (values.billCounts as Record<string, number>) ?? null,
          opening_coins_amount: values.coinsAmount ?? null,
        });

        await auditService.createSafe(tenantId, {
          user_id: resolvedOperatorUserId,
          module: "caja",
          action: "open",
          entity_type: "cash_session",
          entity_id: createdSession.id,
          description: "Apertura de caja desde POS",
          metadata: {
            opening_amount: values.openingAmount,
            notes: values.notes?.trim() || null,
            bill_counts: values.billCounts,
            coins_amount: values.coinsAmount,
          },
        });

        setOpenCashSessionId(createdSession.id);
        setCashGateFeedback(null);
        setHasResolvedCashGate(true);
        toastSuccess("Caja abierta correctamente.");

        await Promise.allSettled([reload(), loadRecentReceipts()]);
      } catch {
        setCashGateFeedback("No se pudo abrir la caja desde POS.");
        setHasResolvedCashGate(true);
        toastError("No se pudo abrir la caja.");
      } finally {
        setIsOpeningCashSession(false);
      }
    },
    [loadRecentReceipts, reload, resolvedOperatorUserId, tenantId, toastError, toastSuccess]
  );

  const focusScannerCapture = useCallback(() => {
    if (isCheckoutModalOpen) return;
    const searchInput = document.getElementById("pos-search-input") as HTMLInputElement | null;
    if (searchInput && (document.activeElement === searchInput || searchInput.value.trim() !== "")) {
      return;
    }
    const input = scannerCaptureRef.current;
    if (!input) return;
    input.focus({ preventScroll: true });
  }, [isCheckoutModalOpen]);

  const handleBarcodeScan = useCallback(
    async (barcode: string): Promise<boolean> => {
      if (!canWritePos || isSubmitting || isCashGateBlocking || isCheckoutModalOpen) return false;

      const cleanBarcode = barcode.trim();
      try {
        const result = await addProductByBarcode(cleanBarcode);
        if (!result.ok || (!result.product && !result.promotion)) {
          // Guardar el código escaneado que no fue encontrado para precargar en Producto Rápido
          setLastNotFoundBarcode(cleanBarcode);
          return false;
        }

        const scannedProduct = result.product;
        if (!scannedProduct && !result.promotion) {
          setLastNotFoundBarcode(cleanBarcode);
          return false;
        }

        // Si fue encontrado, limpiamos el último código no encontrado
        setLastNotFoundBarcode("");
        // Resaltar visualmente el carrito en verde sin alerta toast obstructiva
        triggerCartSuccessHighlight();
        return true;
      } finally {
        window.setTimeout(() => {
          focusScannerCapture();
        }, 0);
      }
    },
    [
      addProductByBarcode,
      canWritePos,
      focusScannerCapture,
      isCashGateBlocking,
      isCheckoutModalOpen,
      isSubmitting,
      triggerCartSuccessHighlight,
    ]
  );

  const onBarcodeScannerScan = useCallback(
    (barcode: string) => {
      setSearchResetToken((prev) => prev + 1);
      void handleBarcodeScan(barcode);
    },
    [handleBarcodeScan]
  );

  const handleVisibleBarcodeSubmit = useCallback(() => {
    if (isCheckoutModalOpen) return;
    const barcode = visibleBarcodeValue.trim();
    if (!barcode) return;

    void handleBarcodeScan(barcode).then((ok) => {
      if (ok) {
        setVisibleBarcodeValue("");
      }
    });
  }, [handleBarcodeScan, isCheckoutModalOpen, visibleBarcodeValue]);

  useBarcodeScanner({
    enabled: Boolean(
      tenantId &&
        canReadPos &&
        canWritePos &&
        !isCashGateBlocking &&
        !isSubmitting &&
        !isCheckoutModalOpen &&
        !customerModalState &&
        !receiptModal &&
        !isCameraScannerOpen
    ),
    onScan: onBarcodeScannerScan,
  });

  useEffect(() => {
    if (isCheckoutModalOpen) {
      scannerCaptureRef.current?.blur();
      return;
    }
    if (isCashGateBlocking) return;
    if (isSubmitting) return;
    if (customerModalState || receiptModal) return;
    if (isCameraScannerOpen) return;
    focusScannerCapture();
  }, [
    customerModalState,
    focusScannerCapture,
    isCameraScannerOpen,
    isCashGateBlocking,
    isCheckoutModalOpen,
    isSubmitting,
    receiptModal,
  ]);

  useEffect(() => {
    if (isCashGateBlocking) return;
    if (isSubmitting) return;
    if (customerModalState || receiptModal || isReceiptsListModalOpen) return;
    if (isCameraScannerOpen) return;
    focusScannerCapture();
  }, [
    customerModalState,
    focusScannerCapture,
    isCameraScannerOpen,
    isCashGateBlocking,
    isReceiptsListModalOpen,
    isSubmitting,
    receiptModal,
  ]);

  useEffect(() => {
    if (!generatedReceipt) return;

    setRecentReceipts((previous) => {
      const nextItem: PosRecentReceiptItem = {
        receipt: generatedReceipt,
        invoice: generatedInvoice ?? null,
      };

      const deduped = previous.filter((item) => item.receipt.id !== generatedReceipt.id);
      return [nextItem, ...deduped].slice(0, 100);
    });

    clearGeneratedReceipt();
    void loadRecentReceipts();
    if (!isCashGateBlocking) {
      window.setTimeout(() => {
        focusScannerCapture();
      }, 0);
    }
  }, [clearGeneratedReceipt, focusScannerCapture, generatedInvoice, generatedReceipt, isCashGateBlocking, loadRecentReceipts]);

  const closeReceiptModal = useCallback(() => {
    setReceiptModal(null);
    setPrintMenuReceiptId(null);
    setSearchResetToken((prev) => prev + 1);
    setVisibleBarcodeValue("");
    window.setTimeout(() => {
      focusScannerCapture();
    }, 0);
  }, [focusScannerCapture]);

  const openReceiptModal = useCallback(
    (item: PosRecentReceiptItem, view: "ticket" | "invoice", autoPrint = false) => {
      if (view === "invoice" && !item.invoice) return;
      setPrintMenuReceiptId(null);
      setReceiptModal({
        receipt: item.receipt,
        invoice: item.invoice,
        view,
        autoPrint,
      });
    },
    []
  );

  const buildCustomerModalInitialValues = useCallback(
    (customer: Customer | null): PosCustomerModalValues => {
      const profile =
        customer && tenantId
          ? posCustomerProfilesService.getProfile(tenantId, customer.id)
          : { enabled: false, limit: null };
      const accountEnabled = customer?.current_account_enabled ?? profile.enabled;
      const accountLimit = customer?.current_account_limit ?? profile.limit;
      const names = splitCustomerName(customer?.full_name ?? "");

      return {
        firstName: names.firstName,
        lastName: names.lastName,
        documentType: customer?.document_type ?? "dni",
        documentNumber: getEditableDocumentNumber(customer?.document_number),
        phone: customer?.phone ?? "",
        email: customer?.email ?? "",
        address: customer?.address ?? "",
        fiscalBusinessName: customer?.fiscal_business_name ?? "",
        fiscalAddress: customer?.fiscal_address ?? "",
        fiscalCondition: customer?.fiscal_condition ?? "",
        fiscalCuit: customer?.document_type === "cuit" ? getEditableDocumentNumber(customer.document_number) : "",
        currentAccountEnabled: accountEnabled,
        currentAccountLimit:
          accountLimit != null && Number.isFinite(accountLimit) ? accountLimit.toString() : "",
      };
    },
    [tenantId]
  );

  const openCustomerModal = useCallback(
    (customer: Customer | null, defaultTab?: "personal" | "fiscal" | "account") => {
      if (!canWriteCustomers) return;

      setCustomerModalState({
        mode: customer ? "edit" : "create",
        customer,
        initialValues: buildCustomerModalInitialValues(customer),
        defaultTab,
      });
    },
    [buildCustomerModalInitialValues, canWriteCustomers]
  );

  const closeCustomerModal = useCallback(() => {
    setCustomerModalState(null);
    window.setTimeout(() => {
      focusScannerCapture();
    }, 0);
  }, [focusScannerCapture]);

  const customerModalCustomerId = customerModalState?.customer?.id ?? null;

  const openCurrentAccountFromModal = useCallback(() => {
    if (!customerModalCustomerId) return;

    const searchParams = new URLSearchParams({
      clienteId: customerModalCustomerId,
      from: "pos",
    });
    const targetUrl = `${routePaths.cuentasCorrientes}?${searchParams.toString()}`;

    window.open(targetUrl, "_blank", "noopener,noreferrer");
    setCustomerModalState(null);
  }, [customerModalCustomerId]);

  const handleCustomerModalSubmit = useCallback(
    async (values: PosCustomerModalValues) => {
      if (!tenantId || !canWriteCustomers || !customerModalState) return;

      const normalizeOptional = (input?: string) => {
        const normalized = input?.trim() ?? "";
        return normalized ? normalized : null;
      };

      const fullName = `${values.firstName.trim()} ${values.lastName.trim()}`.replace(/\s+/g, " ").trim();
      const fiscalCuit = (values.fiscalCuit ?? "").trim();
      const documentType = fiscalCuit ? "cuit" : values.documentType;
      const documentNumber = fiscalCuit || (values.documentNumber ?? "").trim();
      const currentAccountLimitRaw = values.currentAccountLimit ?? "";
      const parsedLimit = Number(currentAccountLimitRaw);
      const currentAccountLimit =
        currentAccountLimitRaw.trim() && Number.isFinite(parsedLimit) && parsedLimit >= 0
          ? Number(parsedLimit.toFixed(2))
          : null;

      setIsCustomerModalSubmitting(true);
      try {
        if (customerModalState.mode === "create") {
          const created = await customersService.create(tenantId, {
            code: buildCustomerCode(fullName),
            full_name: fullName,
            document_type: documentType,
            document_number: documentNumber,
            fiscal_business_name: normalizeOptional(values.fiscalBusinessName),
            fiscal_address: normalizeOptional(values.fiscalAddress),
            fiscal_condition: normalizeOptional(values.fiscalCondition),
            price_list_id: null,
            email: normalizeOptional(values.email),
            phone: normalizeOptional(values.phone),
            address: normalizeOptional(values.address),
            observations: null,
            current_balance: 0,
            current_account_enabled: values.currentAccountEnabled,
            current_account_limit: currentAccountLimit,
            is_active: true,
          });

          posCustomerProfilesService.saveProfile(tenantId, created.id, {
            enabled: values.currentAccountEnabled,
            limit: currentAccountLimit,
          });

          await auditService.createSafe(tenantId, {
            user_id: user?.id ?? null,
            module: "clientes",
            action: "create_from_pos",
            entity_type: "customer",
            entity_id: created.id,
            description: `Cliente creado desde POS: ${created.full_name}`,
            metadata: {
              document_type: created.document_type,
              document_number: created.document_number,
              current_account_enabled: values.currentAccountEnabled,
              current_account_limit: currentAccountLimit,
            },
          });

          upsertCustomer(created);
          await reload();
          setSelectedCustomer(created.id);
          toastSuccess("Cliente creado y seleccionado");
          closeCustomerModal();
          return;
        }

        const existing = customerModalState.customer;
        if (!existing) return;

        const updated = await customersService.update(tenantId, existing.id, {
          code: existing.code,
          full_name: fullName,
          document_type: documentType,
          document_number: documentNumber,
          fiscal_business_name: normalizeOptional(values.fiscalBusinessName),
          fiscal_address: normalizeOptional(values.fiscalAddress),
          fiscal_condition: normalizeOptional(values.fiscalCondition),
          price_list_id: existing.price_list_id,
          email: normalizeOptional(values.email),
          phone: normalizeOptional(values.phone),
          address: normalizeOptional(values.address),
          observations: existing.observations,
          current_balance: existing.current_balance,
          current_account_enabled: values.currentAccountEnabled,
          current_account_limit: currentAccountLimit,
          is_active: existing.is_active,
        });

        if (updated) {
          upsertCustomer(updated);
        }

        posCustomerProfilesService.saveProfile(tenantId, existing.id, {
          enabled: values.currentAccountEnabled,
          limit: currentAccountLimit,
        });

        await auditService.createSafe(tenantId, {
          user_id: user?.id ?? null,
          module: "clientes",
          action: "update_from_pos",
          entity_type: "customer",
          entity_id: existing.id,
          description: `Cliente actualizado desde POS: ${fullName}`,
          metadata: {
            current_account_enabled: values.currentAccountEnabled,
            current_account_limit: currentAccountLimit,
          },
        });

        await reload();
        setSelectedCustomer(existing.id);
        toastSuccess("Cliente actualizado");
        closeCustomerModal();
      } catch {
        toastError("No se pudo guardar el cliente desde POS");
      } finally {
        setIsCustomerModalSubmitting(false);
      }
    },
    [
      canWriteCustomers,
      closeCustomerModal,
      customerModalState,
      reload,
      setSelectedCustomer,
      tenantId,
      toastError,
      toastSuccess,
      user?.id,
    ]
  );

  const handleCreateOriginBank = useCallback(
    async (name: string): Promise<OriginBank | null> => {
      if (!tenantId) return null;
      const created = await createOriginBank(name);
      if (!created) return null;

      await auditService.createSafe(tenantId, {
        user_id: user?.id ?? null,
        module: "pos",
        action: "create_origin_bank_from_pos",
        entity_type: "origin_bank",
        entity_id: created.id,
        description: `Banco de origen creado desde POS: ${created.name}`,
        metadata: {
          code: created.code,
          is_active: created.is_active,
        },
      });

      return created;
    },
    [createOriginBank, tenantId, user?.id]
  );

  useEffect(() => {
    if (!receiptModal?.autoPrint) return;

    const timer = window.setTimeout(() => {
      window.print();
      setReceiptModal((current) =>
        current
          ? {
              ...current,
              autoPrint: false,
            }
          : null
      );
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, [receiptModal]);

  useEffect(() => {
    if (!isCheckoutModalOpen || cart.length) return;
    setIsCheckoutModalOpen(false);
  }, [cart.length, isCheckoutModalOpen]);

  useEffect(() => {
    if (!receiptModal && !printMenuReceiptId) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (receiptModal) {
        closeReceiptModal();
        return;
      }
      setPrintMenuReceiptId(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeReceiptModal, printMenuReceiptId, receiptModal]);

  useEffect(() => {
    if (!isCheckoutModalOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.repeat) {
        event.preventDefault();
        return;
      }

      if (event.key === "Escape") {
        if (isSubmitting || isConfirmingSaleRef.current) return;
        setIsCheckoutModalOpen(false);
        window.setTimeout(() => {
          focusScannerCapture();
        }, 0);
        return;
      }

      if (event.key !== "Enter") return;
      if (!cart.length || !paymentMethods.length) return;
      if (!canWritePos || isLoading || isSubmitting || isConfirmingSaleRef.current || isCashGateBlocking) return;

      const activeElement = document.activeElement;
      const isEditableElement =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        Boolean((activeElement as HTMLElement | null)?.isContentEditable);
      const scannerCaptureActive = Boolean(
        activeElement instanceof HTMLElement &&
          activeElement.closest("[data-scanner-capture='true']")
      );

      if (isEditableElement && !scannerCaptureActive) return;

      const form = document.getElementById(checkoutFormId);
      if (!(form instanceof HTMLFormElement)) return;

      event.preventDefault();
      form.requestSubmit();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    canWritePos,
    cart.length,
    focusScannerCapture,
    isCashGateBlocking,
    isCheckoutModalOpen,
    isLoading,
    isSubmitting,
    paymentMethods.length,
  ]);

  useEffect(() => {
    if (!printMenuReceiptId) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest("[data-print-menu='true']")) return;
      setPrintMenuReceiptId(null);
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [printMenuReceiptId]);

  useEffect(() => {
    const handleCheckoutEnter = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      if (event.repeat || event.defaultPrevented) return;
      if (
        customerModalState ||
        receiptModal ||
        isReceiptsListModalOpen ||
        isCheckoutModalOpen ||
        isQuickProductModalOpen ||
        isDebtPaymentModalOpen ||
        isCartDiscountModalOpen
      ) {
        return;
      }
      if (!canWritePos || isLoading || isSubmitting || isConfirmingSaleRef.current) return;
      if (isCashGateBlocking) return;
      if (!cart.length || !paymentMethods.length) return;

      // REQUISITO ESTRICTO:
      // "SI TENGO EL BUSCADOR ABIERTO NO DEBERIA ABRIR EL MODAL DE PAGO HASTA QUE SALGA DEL BUSCADOR"
      const searchInput = document.getElementById("pos-search-input") as HTMLInputElement | null;
      const isSearchActive = Boolean(
        (searchInput && (document.activeElement === searchInput || searchInput.value.trim() !== "")) ||
        document.querySelector('[data-search-open="true"]')
      );
      if (isSearchActive) return;

      const activeElement = document.activeElement;
      const scannerCaptureActive = Boolean(
        activeElement instanceof HTMLElement &&
          activeElement.closest("[data-scanner-capture='true']")
      );

      const isEditableElement =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        Boolean((activeElement as HTMLElement | null)?.isContentEditable);

      if (isEditableElement && !scannerCaptureActive) return;

      event.preventDefault();
      setIsCheckoutModalOpen(true);
    };

    window.addEventListener("keydown", handleCheckoutEnter);
    return () => {
      window.removeEventListener("keydown", handleCheckoutEnter);
    };
  }, [
    canWritePos,
    cart.length,
    customerModalState,
    isCartDiscountModalOpen,
    isCashGateBlocking,
    isCheckoutModalOpen,
    isDebtPaymentModalOpen,
    isLoading,
    isQuickProductModalOpen,
    isReceiptsListModalOpen,
    isSubmitting,
    paymentMethods.length,
    receiptModal,
  ]);

  // Atajos globales dentro del POS: F4 (Buscador) y F8 (Producto Rápido)
  useEffect(() => {
    const handlePosHotkeys = (e: KeyboardEvent) => {
      if (
        isCheckoutModalOpen ||
        receiptModal ||
        customerModalState ||
        isDebtPaymentModalOpen ||
        isQuickProductModalOpen ||
        isReceiptsListModalOpen ||
        isCartDiscountModalOpen
      ) {
        return;
      }

      if (e.key === "F4") {
        e.preventDefault();
        const searchInput = document.getElementById("pos-search-input") as HTMLInputElement | null;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      } else if (e.key === "F8") {
        e.preventDefault();
        setIsQuickProductModalOpen(true);
      }
    };

    window.addEventListener("keydown", handlePosHotkeys);
    return () => window.removeEventListener("keydown", handlePosHotkeys);
  }, [
    customerModalState,
    isCartDiscountModalOpen,
    isCheckoutModalOpen,
    isDebtPaymentModalOpen,
    isQuickProductModalOpen,
    isReceiptsListModalOpen,
    receiptModal,
  ]);

  useEffect(() => {
    if (!tenantId) {
      setClientLogoUrl(null);
      setClientDisplayName("POS");
      return;
    }

    let active = true;

    setClientDisplayName(tenant?.tradeName || tenant?.legalName || "POS");

    const loadBusinessIdentity = async () => {
      try {
        const tenantSettings = await settingsService.getByTenant(tenantId);
        if (!active) return;

        const logo = tenantSettings.negocio.logo_url?.trim() || null;
        const businessName =
          tenantSettings.negocio.trade_name?.trim() ||
          tenantSettings.negocio.legal_name?.trim() ||
          tenant?.tradeName ||
          tenant?.legalName ||
          "POS";

        setClientLogoUrl(logo);
        setClientDisplayName(businessName);
      } catch {
        if (!active) return;
        setClientLogoUrl(null);
      }
    };

    void loadBusinessIdentity();

    return () => {
      active = false;
    };
  }, [tenant?.legalName, tenant?.tradeName, tenantId]);

  const handleRefreshCatalog = useCallback(async () => {
    if (isRefreshingCatalog) return;

    setIsRefreshingCatalog(true);
    clearSyncError();

    try {
      const results = await Promise.allSettled([
        syncNow(),
        reload(true),
        loadRecentReceipts(),
        loadCashSessionGate(),
      ]);
      const hasError = results.some((result) => result.status === "rejected");

      if (hasError) {
        toastError("No se pudieron actualizar todos los datos.");
      } else {
        const count = useProductsStore.getState().products.length;
        toastSuccess(`Catálogo actualizado (${count} productos).`);
      }
    } finally {
      setIsRefreshingCatalog(false);
    }
  }, [
    clearSyncError,
    isRefreshingCatalog,
    loadCashSessionGate,
    loadRecentReceipts,
    reload,
    syncNow,
    toastError,
    toastSuccess,
  ]);

  const operatorInitials = useMemo(() => {
    if (!user?.fullName) return "POS";

    const initials = user.fullName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((value) => value[0]?.toUpperCase() ?? "")
      .join("");

    return initials || "POS";
  }, [user?.fullName]);

  if (!tenantId) {
    return (
      <PagePlaceholder
        title="POS"
        description="No hay un comercio activo"
      />
    );
  }

  if (!canReadPos) {
    return (
      <PagePlaceholder
        title="POS"
        description="No tenes permisos de lectura para este modulo"
      />
    );
  }

  return (
    <div className={cn("pos-page space-y-4 pb-24 lg:pb-2", isSmartPos && "pos-page--smart p-1 sm:p-2")}>
      {/* Input invisible de captura permanente para lector de códigos de barra físico */}
      <input
        ref={scannerCaptureRef}
        type="text"
        className="pos-scanner-capture"
        data-scanner-capture="true"
        autoFocus
        inputMode="none"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Captura scanner"
        disabled={isCheckoutModalOpen}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.value = "";
          }
        }}
        onBlur={() => {
          window.setTimeout(() => {
            if (isCheckoutModalOpen) return;
            const activeElement = document.activeElement;
            const isEditableElement =
              activeElement instanceof HTMLInputElement ||
              activeElement instanceof HTMLTextAreaElement ||
              activeElement instanceof HTMLSelectElement ||
              Boolean((activeElement as HTMLElement | null)?.isContentEditable);

            if (!isEditableElement) {
              scannerCaptureRef.current?.focus();
            }
          }, 80);
        }}
      />

      {isSmartPos ? (
        <PosSmartView
          items={cart}
          isHighlighted={isCartHighlighted}
          onIncrease={increaseQuantity}
          onDecrease={decreaseQuantity}
          onSetQuantity={setCartItemQuantity}
          onEdit={(item) => {
            if (item.is_debt_payment_item) {
              setIsDebtPaymentModalOpen(true);
            } else {
              setEditingCartItemId(item.product_id);
            }
          }}
          onRemove={removeFromCart}
          onClearCart={() => {
            clearCart();
            setSearchResetToken((prev) => prev + 1);
            setVisibleBarcodeValue("");
          }}
          onCycleReturnableStatus={cycleReturnableStatus}
          onOpenDebtPaymentModal={() => setIsDebtPaymentModalOpen(true)}
          hasDebtPaymentInCart={Boolean(existingDebtItem)}
          debtPaymentAmount={debtPaymentTotal}
          cartManualDiscount={cartManualDiscount}
          manualCartDiscountTotal={manualCartDiscountTotal}
          subtotalBeforePromotions={subtotalBeforePromotions}
          onOpenCartDiscountModal={() => setIsCartDiscountModalOpen(true)}
          onRemoveCartDiscount={() => applyCartDiscount(null)}
          onOpenItemPromoModal={(item) => setItemPromoModalTarget(item)}
          disabled={isSubmitting || isCashGateBlocking || isCheckoutModalOpen}
          canWrite={canWritePos}
          searchResetToken={searchResetToken}
          products={products}
          primaryBarcodes={primaryBarcodes}
          onAddProduct={async (product, quantity = 1) => {
            if (!canWritePos || isCashGateBlocking || isCheckoutModalOpen) return false;
            const added = await addProductToCart(product, quantity);
            if (added) {
              triggerCartSuccessHighlight();
              // Si el usuario está en el buscador de productos, NO mover el foco al escáner
              const searchInput = document.getElementById("pos-search-input") as HTMLInputElement | null;
              const isSearchActive = Boolean(
                searchInput && (document.activeElement === searchInput || searchInput.value.trim() !== "")
              );
              if (!isSearchActive) {
                window.setTimeout(() => {
                  focusScannerCapture();
                }, 0);
              }
            }
            return added;
          }}
          onScanBarcode={handleBarcodeScan}
          subtotal={checkoutSummary.subtotal}
          total={checkoutSummary.total}
          roundingAdjustment={checkoutSummary.roundingAdjustment}
          roundingEnabled={roundingEnabled}
          onToggleRounding={toggleRounding}
          discountsEnabled={discountsEnabled}
          onToggleDiscounts={toggleDiscounts}
          promotionDiscountTotal={promotionDiscountTotal}
          lastAddedProductId={lastAddedProductId}
          onCheckout={() => setIsCheckoutModalOpen(true)}
          userName={user?.fullName ?? "Operador"}
          operatorInitials={operatorInitials}
          isRefreshingCatalog={isRefreshingCatalog || isSyncing}
          onRefreshCatalog={() => {
            void handleRefreshCatalog();
          }}
          onOpenReceipts={() => {
            setIsReceiptsListModalOpen(true);
            void loadRecentReceipts();
          }}
          onOpenQuickProduct={() => setIsQuickProductModalOpen(true)}
        />
      ) : (
        <>
          <section className="pos-surface pos-surface--header space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {clientLogoUrl ? (
                  <img
                    src={clientLogoUrl}
                    alt={clientDisplayName}
                    className="h-10 w-10 rounded-xl bg-slate-50 object-cover"
                  />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-sm font-semibold text-white">
                    {clientDisplayName.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <div>
                  <p className="pos-overline uppercase tracking-wider text-[11px] font-bold text-slate-500">{clientDisplayName}</p>
                  <h1 className="pos-title font-bold text-slate-900 dark:text-slate-100">Punto de venta</h1>
                </div>
              </div>

              <div className="flex items-center">
                {isCashGateResolving && !openCashSessionId ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                    Validando caja...
                  </span>
                ) : openCashSessionId ? (
                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    Caja abierta
                  </span>
                ) : (
                  <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    Caja cerrada
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {shouldShowReturnToPanel ? (
                  <button
                    type="button"
                    onClick={handleReturnToPanel}
                    className="ui-btn-ghost text-xs"
                  >
                    Volver al panel
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={cycleTheme}
                  className="ui-btn-ghost text-xs inline-flex items-center gap-1.5"
                  title={`Tema: ${theme === "midnight" ? "Azul Medianoche" : theme === "dark" ? "Oscuro" : "Claro"}. Clic para cambiar.`}
                >
                  {theme === "midnight" ? (
                    <MoonStar size={14} className="text-indigo-400" />
                  ) : theme === "dark" ? (
                    <Moon size={14} className="text-amber-300" />
                  ) : (
                    <Sun size={14} className="text-amber-500" />
                  )}
                  <span className="hidden sm:inline">
                    {theme === "midnight" ? "Azul" : theme === "dark" ? "Oscuro" : "Claro"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleRefreshCatalog();
                  }}
                  disabled={isRefreshingCatalog || isSubmitting}
                  className="ui-btn-ghost text-xs inline-flex items-center gap-1.5"
                  title="Actualizar productos y catálogo desde el servidor"
                >
                  <RefreshCw
                    size={14}
                    className={isRefreshingCatalog || isSyncing ? "animate-spin text-brand-600" : ""}
                  />
                  <span className="hidden sm:inline">
                    {isRefreshingCatalog ? "Actualizando..." : "Actualizar productos"}
                  </span>
                </button>
                {isInstallSupported && canInstall ? (
                  <button
                    type="button"
                    onClick={() => {
                      void installApp();
                    }}
                    className="ui-btn-ghost text-xs"
                    disabled={isInstalling}
                  >
                    {isInstalling ? "Instalando..." : "Instalar app"}
                  </button>
                ) : null}
                {canWritePos ? (
                  <button
                    type="button"
                    onClick={() => setIsQuickProductModalOpen(true)}
                    className="ui-btn-ghost text-xs inline-flex items-center gap-1.5"
                    title="Producto rápido (F8)"
                  >
                    <span>Producto rápido</span>
                    <kbd className="rounded border border-fuchsia-200 bg-fuchsia-100/80 px-1.5 py-0.5 text-[10px] font-bold text-fuchsia-600 dark:border-fuchsia-800 dark:bg-fuchsia-950/60 dark:text-fuchsia-400">
                      F8
                    </kbd>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setIsReceiptsListModalOpen(true);
                    void loadRecentReceipts();
                  }}
                  className="ui-btn-ghost text-xs inline-flex items-center gap-1.5"
                  title="Ver comprobantes y tickets recientes"
                >
                  <FileText size={14} />
                  Comprobantes
                </button>
                <IconButton
                  icon={Camera}
                  label="Escanear con cámara"
                  onClick={() => setIsCameraScannerOpen(true)}
                  disabled={!canWritePos}
                />
                {canWritePos && selectedEmployee ? (
                  <div className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 shadow-2xs">
                    <span className="font-semibold truncate max-w-[170px]" title={selectedEmployee.full_name}>
                      👔 {selectedEmployee.full_name} ({selectedEmployee.discount_percent ?? (posSettings.employee_discount_percent ?? 10)}% OFF)
                    </span>
                    <button
                      type="button"
                      onClick={() => selectEmployee(null)}
                      className="p-0.5 hover:text-rose-600 rounded transition cursor-pointer"
                      title="Quitar empleado de la venta"
                    >
                      <X size={12} strokeWidth={2.5} />
                    </button>
                  </div>
                ) : canWritePos && selectedCustomerId ? (
                  <IconButton
                    icon={ShoppingCart}
                    label="Ver perfil del cliente"
                    onClick={() => {
                      const customer = customers.find((item) => item.id === selectedCustomerId);
                      if (customer) {
                        openCustomerModal(customer);
                      }
                    }}
                  />
                ) : null}
                <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-2.5 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-[11px] font-bold text-white">
                    {operatorInitials}
                  </span>
                  <div className="leading-tight">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {user?.fullName ?? "Operador"}
                    </p>
                    <p className="text-[10px] text-slate-500">Operador de caja</p>
                  </div>
                </div>
              </div>
            </div>

            {lastSyncMessage ? (
              <p className={`text-xs ${lastSyncError ? "text-red-600" : "text-slate-500"}`}>
                {lastSyncMessage}
              </p>
            ) : null}
          </section>

          {selectedCustomer && appliedPriceList && !appliedPriceList.is_active ? (
            <p className="text-xs text-amber-700">
              El cliente tiene una lista inactiva asignada. Se mantiene por compatibilidad.
            </p>
          ) : null}

          {!paymentMethods.length ? (
            <div className="ui-empty-state">
              No hay medios de pago activos. Configuralos desde el modulo Medios de pago.
            </div>
          ) : null}

          {isLoading ? (
            <div className="ui-loading">Cargando POS...</div>
          ) : (
            <div className="pos-content-grid">
              <PosProductList
                products={products}
                favoriteProducts={favoriteProducts}
                primaryBarcodes={primaryBarcodes}
                saleTabs={saleTabs}
                activeTabId={activeTabId}
                onSwitchSaleTab={switchSaleTab}
                onCreateSaleTab={createNewSaleTab}
                onCloseSaleTab={closeSaleTab}
                canWrite={canWritePos}
                disabled={isSubmitting || isCashGateBlocking || isCheckoutModalOpen}
                searchResetToken={searchResetToken}
                onAddProduct={async (product, quantity) => {
                  if (!canWritePos || isCashGateBlocking || isCheckoutModalOpen) return;
                  const added = await addProductToCart(product, quantity);
                  if (added) {
                    triggerCartSuccessHighlight();
                    window.setTimeout(() => {
                      focusScannerCapture();
                    }, 0);
                  }
                  return added;
                }}
              />

              <div className="pos-side-column">
                <PosCart
                  id={cartPanelId}
                  items={cart}
                  isHighlighted={isCartHighlighted}
                  barcodeValue={visibleBarcodeValue}
                  subtotalBeforePromotions={subtotalBeforePromotions}
                  promotionDiscountTotal={promotionDiscountTotal}
                  cartPromotionDiscountTotal={cartPromotionDiscountTotal}
                  cartManualDiscount={cartManualDiscount}
                  manualCartDiscountTotal={manualCartDiscountTotal}
                  subtotal={checkoutSummary.subtotal}
                  surchargeTotal={0}
                  paymentDiscountTotal={0}
                  roundingAdjustment={checkoutSummary.roundingAdjustment}
                  roundingEnabled={roundingEnabled}
                  onToggleRounding={toggleRounding}
                  total={checkoutSummary.total}
                  discountsEnabled={discountsEnabled}
                  onToggleDiscounts={toggleDiscounts}
                  onOpenCartDiscountModal={() => setIsCartDiscountModalOpen(true)}
                  onRemoveCartDiscount={() => applyCartDiscount(null)}
                  onOpenItemPromoModal={(item) => setItemPromoModalTarget(item)}
                  canWrite={canWritePos}
                  disabled={isSubmitting || isCashGateBlocking || isCheckoutModalOpen}
                  onBarcodeChange={setVisibleBarcodeValue}
                  onBarcodeSubmit={handleVisibleBarcodeSubmit}
                  onIncrease={increaseQuantity}
                  onDecrease={decreaseQuantity}
                  onSetQuantity={setCartItemQuantity}
                  onEdit={(item) => setEditingCartItemId(item.product_id)}
                  onRemove={removeFromCart}
                  onCycleReturnableStatus={cycleReturnableStatus}
                  onClearCart={() => {
                    clearCart();
                    setSearchResetToken((prev) => prev + 1);
                    setVisibleBarcodeValue("");
                  }}
                  onOpenQuickProduct={() => setIsQuickProductModalOpen(true)}
                  onCheckout={() => setIsCheckoutModalOpen(true)}
                />
              </div>
            </div>
          )}

          {!isLoading && cart.length && !isCashGateBlocking ? (
            <div className="pos-mobile-dock">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Carrito</p>
                <p className="text-sm font-semibold text-slate-900">
                  {cart.length} items | {currency.format(checkoutSummary.total)}
                </p>
              </div>
              <button
                type="button"
                className="ui-btn-primary whitespace-nowrap"
                onClick={() => {
                  setIsCheckoutModalOpen(true);
                }}
              >
                Confirmar venta
              </button>
            </div>
          ) : null}
        </>
      )}

      {shouldShowCashOpeningModal ? (
        <section className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-3">
          <div className="w-full max-w-lg max-h-[96vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-panel overflow-hidden">
            <header className="shrink-0 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60">
              <div className="flex items-center gap-2">
                <LockOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Apertura de caja obligatoria
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Para iniciar el POS y registrar ventas, primero debés asentar el fondo inicial.
              </p>
            </header>

            <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
              {resolvedOperatorUserId ? (
                <CashOpenForm
                  canWrite={canWritePos}
                  disabled={isOpeningCashSession || isSubmitting}
                  defaultOpeningAmount={cashDefaultOpeningAmount}
                  onSubmit={handleOpenCashFromPos}
                />
              ) : (
                <div className="ui-error-state">No hay usuario activo para abrir caja.</div>
              )}

            {hasResolvedCashGate && !isResolvingOperatorUser && !isCheckingCashSession && cashGateFeedback ? (
              <div className="ui-error-state">{cashGateFeedback}</div>
            ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {isCheckoutModalOpen ? (
        <section className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-3 sm:p-4">
          <button
            type="button"
            aria-label="Cerrar confirmacion de venta"
            className="absolute inset-0"
            onClick={() => {
              setIsCheckoutModalOpen(false);
              window.setTimeout(() => {
                focusScannerCapture();
              }, 0);
            }}
          />
          <div className="relative z-10 w-full max-w-2xl">
            <PosCheckoutPanel
              panelId={checkoutPanelId}
              formId={checkoutFormId}
              layout="modal"
              customers={customers}
              employees={employees}
              paymentMethods={paymentMethods}
              bankAccounts={bankAccounts}
              originBanks={originBanks}
              installmentPlans={installmentPlans}
              selectedCustomerId={selectedCustomerId}
              selectedEmployeeId={selectedEmployeeId}
              onSelectEmployee={selectEmployee}
              employeeDiscountPercent={posSettings.employee_discount_percent ?? 10}
              selectedPaymentMethodId={selectedPaymentMethodId}
              defaultPaymentMethodId={getEffectiveDefaultPaymentMethodId()}
              isOnline={isOnline}
              checkoutTotal={checkoutSummary.total}
              rawCheckoutTotal={checkoutSummary.rawTotal}
              roundingAdjustment={checkoutSummary.roundingAdjustment}
              getCheckoutSummary={getCheckoutSummary}
              mercadoPagoIntent={mercadoPagoIntent}
              mercadoPagoSettings={mercadoPagoSettings}
              mercadoPagoStatus={mercadoPagoStatus}
              isMercadoPagoLoading={isMercadoPagoLoading}
              canWrite={canWritePos}
              canManageCustomers={canWriteCustomers}
              currentAccountSnapshot={currentAccountSnapshot}
              hasOwedReturnables={hasOwedReturnables}
              owedReturnablesCount={owedReturnablesCount}
              disabled={isSubmitting || isCashGateBlocking}
              arcaEnabled={arcaEnabledForPos}
              arcaMode={arcaSettings.mode}
              defaultDocumentType={defaultInvoiceDocumentType}
              paymentMethodInvoiceRules={paymentMethodInvoiceRules}
              onCustomerChange={setSelectedCustomer}
              onPaymentMethodChange={setSelectedPaymentMethodId}
              onCreateOriginBank={handleCreateOriginBank}
              onOpenCustomerModal={openCustomerModal}
              onStartMercadoPago={() => {
                void startMercadoPagoPayment({
                  paymentMethodId: selectedPaymentMethodId,
                  amount: checkoutSummary.total,
                  currencyCode: "ARS",
                  customerId: selectedCustomerId || null,
                });
              }}
              onRefreshMercadoPago={() => {
                void refreshMercadoPagoPayment();
              }}
              onApproveMercadoPago={() => {
                void approveMercadoPagoPayment();
              }}
              onRejectMercadoPago={() => {
                void rejectMercadoPagoPayment();
              }}
              onCancelMercadoPago={() => {
                void cancelMercadoPagoPayment();
              }}
              onClose={() => {
                setIsCheckoutModalOpen(false);
                window.setTimeout(() => {
                  focusScannerCapture();
                }, 0);
              }}
              hasDebtPaymentInCart={Boolean(existingDebtItem)}
              onSubmit={handleConfirmSale}
            />
          </div>
        </section>
      ) : null}

      <PosDebtPaymentModal
        open={isDebtPaymentModalOpen}
        customers={customers}
        selectedCustomer={selectedCustomer}
        existingDebtItem={existingDebtItem}
        disabled={isSubmitting || isCashGateBlocking || !canWritePos}
        tenantId={tenantId}
        userId={resolvedOperatorUserId}
        openCashSessionId={openCashSessionId}
        onClose={() => {
          setIsDebtPaymentModalOpen(false);
          window.setTimeout(() => {
            focusScannerCapture();
          }, 0);
        }}
        onSelectCustomer={(cust) => {
          if (cust) {
            setSelectedCustomer(cust.id);
          }
        }}
        onConfirm={({ customer, amount, notes }) => {
          addDebtPaymentToCart({ customer, amount, notes });
          triggerCartSuccessHighlight();
        }}
        onAddPackageRefund={({ packageName, quantity, unitPrice, notes, customer }) => {
          addPackageRefundToCart({ packageName, quantity, unitPrice, notes, customer });
          triggerCartSuccessHighlight();
        }}
        onRemoveExisting={removeDebtPaymentFromCart}
        onCustomerUpdated={(updated) => {
          upsertCustomer(updated);
        }}
      />

      <PosQuickProductModal
        open={isQuickProductModalOpen && !isCheckoutModalOpen}
        initialBarcode={lastNotFoundBarcode}
        categories={productCategories}
        disabled={isSubmitting || isCashGateBlocking || isCheckoutModalOpen || !canWritePos}
        onClose={() => {
          setIsQuickProductModalOpen(false);
          window.setTimeout(() => {
            focusScannerCapture();
          }, 0);
        }}
        onAddManual={(values) => {
          const ok = addManualProductToCart(values);
          if (ok) {
            setLastNotFoundBarcode("");
            window.setTimeout(() => {
              focusScannerCapture();
            }, 0);
          }
          return ok;
        }}
        onCreateAndAdd={async (values) => {
          const ok = await createProductFromPosAndAddToCart(values);
          if (ok) {
            setLastNotFoundBarcode("");
            window.setTimeout(() => {
              focusScannerCapture();
            }, 0);
          }
          return ok;
        }}
      />

      <PosCartItemEditModal
        item={editingCartItem}
        disabled={isSubmitting || isCashGateBlocking || isCheckoutModalOpen || !canWritePos}
        canEditCatalog={canWriteProducts}
        onClose={() => {
          setEditingCartItemId(null);
          window.setTimeout(() => {
            focusScannerCapture();
          }, 0);
        }}
        onSubmit={(values, scope) => {
          // 1. IMPACTO INMEDIATO EN EL CARRITO (0ms)
          updateCartItem(values);

          // 2. Si se eligió guardar en catálogo, ejecutar en segundo plano sin frenar la terminal
          if (scope === "system_and_sale" && tenantId && !values.productId.startsWith("manual-")) {
            if (!canWriteProducts) {
              toastError("No tenés permisos para actualizar el catálogo de productos. El cambio se aplicó únicamente para esta venta.");
              return;
            }

            void (async () => {
              try {
                const existingProduct = products.find((p) => p.id === values.productId);
                const costPrice = existingProduct?.cost_price ?? 0;
                const vatPercent = existingProduct?.vat_percent ?? 21;
                const computed = computePricingBackward({
                  precioCosto: costPrice,
                  precioFinal: values.unitPrice,
                  porcentajeIva: vatPercent,
                });

                const existingCode = existingProduct?.code?.trim() || "";
                const newCode = values.code?.trim() || "";
                const hasCodeChanged = newCode !== existingCode;

                const existingBarcode = actualPrimaryBarcodes[values.productId]?.trim() || "";
                const newBarcode = values.barcode?.trim() || "";
                const hasBarcodeChanged = values.barcode !== undefined && newBarcode !== existingBarcode;

                const updatePayload: UpdateProductInput = {
                  name: values.name,
                  category: values.category,
                  price: roundMoney(values.unitPrice),
                  price_without_vat: computed.precioSinIva,
                  profit_percent: computed.porcentajeGanancia,
                  ...(values.saleMode ? { sale_mode: values.saleMode } : {}),
                };

                if (hasCodeChanged) {
                  updatePayload.code = newCode || null;
                }

                const updated = await productsService.update(tenantId, values.productId, updatePayload);

                if (hasBarcodeChanged) {
                  await productsService.setPrimaryBarcode(tenantId, values.productId, newBarcode);
                  useProductsStore.getState().patchPrimaryBarcode(values.productId, newBarcode);
                }

                if (updated) {
                  useProductsStore.getState().upsertProduct(updated);
                }

                if (user?.id) {
                  void auditService.createSafe(tenantId, {
                    user_id: user.id,
                    module: "pos",
                    action: "update_product_price",
                    entity_type: "product",
                    entity_id: values.productId,
                    description: `Producto actualizado desde POS para ${existingProduct?.name ?? values.name}: $${values.unitPrice}${values.saleMode ? ` (${values.saleMode === "weight" ? "pesable" : "por unidad"})` : ""}`,
                    metadata: {
                      previous_price: existingProduct?.price,
                      next_price: values.unitPrice,
                      sale_mode: values.saleMode,
                    },
                  });
                }

                toastSuccess("Producto actualizado en el sistema y en la venta");
              } catch (error) {
                console.error("Error al actualizar producto en el sistema:", error);
                const message =
                  getBackendErrorMessage(error) ||
                  (error instanceof Error && error.message ? error.message : null) ||
                  "No se pudo sincronizar con el catálogo";
                toastError(message);
              }
            })();
          }
        }}
      />

      <BarcodeScannerModal
        open={isCameraScannerOpen && !isCheckoutModalOpen}
        title="Escanear producto con camara"
        description="Escanea un codigo para agregar el producto al carrito."
        onClose={() => {
          setIsCameraScannerOpen(false);
          window.setTimeout(() => {
            focusScannerCapture();
          }, 0);
        }}
        onDetected={(barcode) => {
          setIsCameraScannerOpen(false);
          void handleBarcodeScan(barcode);
        }}
      />

      {isReceiptsListModalOpen ? (
        <section className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4">
          <button
            type="button"
            aria-label="Cerrar comprobantes recientes"
            className="absolute inset-0"
            onClick={() => {
              setIsReceiptsListModalOpen(false);
              window.setTimeout(() => {
                focusScannerCapture();
              }, 0);
            }}
          />
          <div className="relative z-10 w-full max-w-2xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-panel dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="text-blue-600 dark:text-blue-400" size={20} />
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Comprobantes recientes
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {filteredReceipts.length === recentReceipts.length
                      ? `Mostrando ${recentReceipts.length} comprobantes`
                      : `Mostrando ${filteredReceipts.length} de ${recentReceipts.length} comprobantes`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <IconButton
                  size="sm"
                  icon={RefreshCw}
                  label="Actualizar comprobantes"
                  onClick={() => {
                    void loadRecentReceipts();
                  }}
                  loading={isLoadingReceipts}
                />
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                  onClick={() => {
                    setIsReceiptsListModalOpen(false);
                    setReceiptsSearchTerm("");
                    window.setTimeout(() => {
                      focusScannerCapture();
                    }, 0);
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Buscador de comprobantes */}
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={receiptsSearchTerm}
                onChange={(e) => setReceiptsSearchTerm(e.target.value)}
                placeholder="Buscar por Nº venta, cliente, banco (Patagonia, etc.) o medio de pago..."
                className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder:text-slate-400"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
              />
              {receiptsSearchTerm ? (
                <button
                  type="button"
                  onClick={() => setReceiptsSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label="Limpiar búsqueda"
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>

            <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
              {isLoadingReceipts ? (
                <div className="ui-loading py-8">Cargando comprobantes...</div>
              ) : !filteredReceipts.length ? (
                <div className="ui-empty-state py-8">
                  {receiptsSearchTerm
                    ? "No se encontraron comprobantes que coincidan con la búsqueda."
                    : "Todavía no hay comprobantes recientes."}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredReceipts.map((item) => {
                    const { receipt, invoice, payments = [] } = item;
                    const friendlyNumber = formatFriendlyReceiptNumber(
                      receipt.sale_number,
                      receipt.receipt_number,
                      invoice
                    );

                    return (
                      <article
                        key={receipt.id}
                        className="rounded-xl border border-slate-200/90 bg-white p-2.5 sm:p-3 transition-colors hover:border-slate-300 dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:border-slate-600 shadow-xs"
                      >
                        {/* FILA 1: Identificador amigable + Fecha + Cliente (Izq) y Total + Tipo (Der) */}
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                            <span
                              className="font-mono font-bold text-slate-900 dark:text-slate-100"
                              title={friendlyNumber.fullNumber}
                            >
                              {friendlyNumber.display}
                            </span>
                            <span className="text-slate-300 dark:text-slate-500">•</span>
                            <span className="text-slate-500 dark:text-slate-300">
                              {new Date(receipt.issued_at).toLocaleString("es-AR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <span className="text-slate-300 dark:text-slate-500">•</span>
                            <span className="text-slate-600 dark:text-slate-200">
                              <span className="text-slate-500 dark:text-slate-400 font-medium">Cliente: </span>
                              <strong className="font-semibold text-slate-900 dark:text-white">
                                {receipt.customer_name ?? "Consumidor final"}
                              </strong>
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 ml-auto">
                            <span className="font-kpi text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                              {currency.format(receipt.total)}
                            </span>
                            {invoice ? (
                              <span className="inline-flex items-center rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:border-emerald-400/60 dark:bg-emerald-900/50 dark:text-emerald-100 shadow-xs">
                                Factura {invoice.document_type}
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:border-blue-400/60 dark:bg-blue-900/50 dark:text-blue-100 shadow-xs">
                                Ticket
                              </span>
                            )}
                          </div>
                        </div>

                        {/* FILA 2: Medio de pago (Izq) y Botones de acción (Der) en una sola línea compacta */}
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-700/60">
                          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-300">
                              Pago:
                            </span>
                            {payments.map((p, idx) => {
                              const isTransfer =
                                p.methodCode === "transfer" ||
                                p.methodCode === "bank_transfer" ||
                                p.methodName.toLowerCase().includes("transferencia") ||
                                Boolean(p.bankName);
                              const isCash =
                                p.methodCode === "cash" || p.methodName.toLowerCase().includes("efectivo");
                              const isCurrentAccount =
                                p.methodCode === "current_account" ||
                                p.methodName.toLowerCase().includes("corriente");
                              const isCard =
                                p.methodCode.includes("card") ||
                                p.methodCode.includes("debit") ||
                                p.methodCode.includes("credit") ||
                                p.methodName.toLowerCase().includes("tarjeta");
                              const isMp =
                                p.methodCode === "mercado_pago" ||
                                p.methodName.toLowerCase().includes("mercado pago");

                              let badgeClasses =
                                "border-slate-200 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200";
                              let iconColor = "text-slate-500 dark:text-slate-300";
                              let bankTextColor = "text-slate-900 dark:text-white";

                              if (isTransfer) {
                                badgeClasses =
                                  "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-400/60 dark:bg-blue-900/50 dark:text-blue-100 font-semibold";
                                iconColor = "text-blue-600 dark:text-blue-300";
                                bankTextColor = "text-blue-950 dark:text-white";
                              } else if (isCash) {
                                badgeClasses =
                                  "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/60 dark:bg-emerald-900/50 dark:text-emerald-100 font-semibold";
                                iconColor = "text-emerald-600 dark:text-emerald-300";
                              } else if (isCurrentAccount) {
                                badgeClasses =
                                  "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-400/60 dark:bg-amber-900/50 dark:text-amber-100 font-semibold";
                                iconColor = "text-amber-600 dark:text-amber-300";
                              } else if (isCard) {
                                badgeClasses =
                                  "border-purple-300 bg-purple-50 text-purple-900 dark:border-purple-400/60 dark:bg-purple-900/50 dark:text-purple-100 font-semibold";
                                iconColor = "text-purple-600 dark:text-purple-300";
                              } else if (isMp) {
                                badgeClasses =
                                  "border-cyan-300 bg-cyan-50 text-cyan-900 dark:border-cyan-400/60 dark:bg-cyan-900/50 dark:text-cyan-100 font-semibold";
                                iconColor = "text-cyan-600 dark:text-cyan-300";
                              }

                              const hasBankInfo = isTransfer && (p.bankName || p.holderName);
                              const bankDisplay = hasBankInfo
                                ? `${p.bankName || "Banco"}${p.holderName ? ` (${p.holderName})` : ""}`
                                : null;

                              return (
                                <span
                                  key={idx}
                                  className={cn(
                                    "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] shadow-xs",
                                    badgeClasses
                                  )}
                                >
                                  {isTransfer ? (
                                    <Landmark size={12} className={cn("shrink-0", iconColor)} />
                                  ) : isCash ? (
                                    <Banknote size={12} className={cn("shrink-0", iconColor)} />
                                  ) : isCurrentAccount ? (
                                    <UserIcon size={12} className={cn("shrink-0", iconColor)} />
                                  ) : isCard ? (
                                    <CreditCard size={12} className={cn("shrink-0", iconColor)} />
                                  ) : (
                                    <FileText size={12} className={cn("shrink-0", iconColor)} />
                                  )}
                                  <span>
                                    {isTransfer ? (
                                      <>
                                        <span>Transferencia</span>
                                        {bankDisplay ? (
                                          <span className={cn("font-bold", bankTextColor)}>
                                            {" "}→ {bankDisplay}
                                          </span>
                                        ) : null}
                                      </>
                                    ) : (
                                      <span>{p.methodName}</span>
                                    )}
                                    {payments.length > 1 ? (
                                      <span className="ml-1 font-mono font-bold">({currency.format(p.amount)})</span>
                                    ) : null}
                                  </span>
                                </span>
                              );
                            })}
                          </div>

                          {/* Acciones */}
                          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                            <button
                              type="button"
                              className="ui-btn-ghost px-2.5 py-1 text-xs font-semibold"
                              onClick={() => openReceiptModal(item, "ticket")}
                            >
                              Ver ticket
                            </button>
                            {invoice ? (
                              <button
                                type="button"
                                className="ui-btn-ghost px-2.5 py-1 text-xs font-semibold"
                                onClick={() => openReceiptModal(item, "invoice")}
                              >
                                Ver factura
                              </button>
                            ) : null}
                            <div className="relative" data-print-menu="true">
                              <button
                                type="button"
                                className="ui-btn-ghost px-2.5 py-1 text-xs font-semibold"
                                onClick={() =>
                                  setPrintMenuReceiptId((current) =>
                                    current === receipt.id ? null : receipt.id
                                  )
                                }
                              >
                                Imprimir
                              </button>
                              {printMenuReceiptId === receipt.id ? (
                                <div className="absolute right-0 z-20 mt-1 min-w-[164px] rounded-lg border border-slate-200 bg-white p-1.5 shadow-panel dark:border-slate-700 dark:bg-slate-900">
                                  <button
                                    type="button"
                                    className="ui-btn-ghost w-full justify-start px-2 py-1.5 text-xs font-medium"
                                    onClick={() => openReceiptModal(item, "ticket", true)}
                                  >
                                    Imprimir ticket
                                  </button>
                                  {invoice ? (
                                    <button
                                      type="button"
                                      className="ui-btn-ghost w-full justify-start px-2 py-1.5 text-xs font-medium"
                                      onClick={() => openReceiptModal(item, "invoice", true)}
                                    >
                                      Imprimir factura
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {receiptModal ? (
        <section className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <button
            type="button"
            aria-label="Cerrar comprobante"
            className="absolute inset-0"
            onClick={closeReceiptModal}
          />
          <div className="relative z-10 w-full max-w-3xl space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-panel dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {receiptModal.view === "invoice" ? "Factura" : "Ticket"}{" "}
                {receiptModal.view === "invoice"
                  ? receiptModal.invoice?.document_number
                  : receiptModal.receipt.receipt_number}
              </p>
              <button type="button" className="ui-btn-ghost px-2.5 py-1.5 text-xs font-semibold" onClick={closeReceiptModal}>
                Cerrar
              </button>
            </div>
            <div className="max-h-[80vh] overflow-auto pr-1">
              <ReceiptTicketPanel
                receipt={receiptModal.receipt}
                invoice={receiptModal.invoice}
                mode={receiptModal.view}
                onClose={closeReceiptModal}
              />
            </div>
          </div>
        </section>
      ) : null}

      {customerModalState ? (
        <PosCustomerModal
          mode={customerModalState.mode}
          defaultTab={customerModalState.defaultTab}
          initialValues={customerModalState.initialValues}
          currentBalance={customerModalState.customer?.current_balance ?? 0}
          disabled={isCustomerModalSubmitting}
          onCancel={closeCustomerModal}
          onSubmit={handleCustomerModalSubmit}
          onOpenCurrentAccount={
            customerModalState.mode === "edit" && customerModalState.customer
              ? openCurrentAccountFromModal
              : undefined
          }
        />
      ) : null}

      <PosCartDiscountModal
        isOpen={isCartDiscountModalOpen}
        onClose={() => setIsCartDiscountModalOpen(false)}
        currentDiscount={cartManualDiscount}
        cartSubtotal={subtotalBeforePromotions > 0 ? subtotalBeforePromotions : checkoutSummary.subtotal}
        onApplyDiscount={(discount) => {
          applyCartDiscount(discount);
          setIsCartDiscountModalOpen(false);
          if (discount) {
            toastSuccess(
              discount.type === "percent"
                ? `Descuento del ${discount.value}% aplicado al carrito`
                : `Descuento de ${currency.format(discount.value)} aplicado al carrito`
            );
          } else {
            toastSuccess("Descuento del carrito eliminado");
          }
        }}
      />

      <PosItemPromoModal
        isOpen={Boolean(itemPromoModalTarget)}
        item={itemPromoModalTarget}
        promotions={promotions}
        onClose={() => setItemPromoModalTarget(null)}
        onApplyDiscount={(productId, discount) => {
          applyItemDiscount(productId, discount);
          setItemPromoModalTarget(null);
          if (discount) {
            toastSuccess(
              discount.type === "percent"
                ? `Descuento del ${discount.value}% aplicado al producto`
                : `Descuento de ${currency.format(discount.value)} aplicado al producto`
            );
          } else {
            toastSuccess("Descuento quitado del producto");
          }
        }}
        onApplyPromotion={(productId, promo) => {
          applyItemPromotion(productId, promo);
          setItemPromoModalTarget(null);
          if (promo) {
            toastSuccess(`Promoción "${promo.name}" aplicada`);
          } else {
            toastSuccess("Promoción quitada del producto");
          }
        }}
      />
    </div>
  );
};
