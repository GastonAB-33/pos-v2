import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BarcodeScannerModal } from "@/components/form/BarcodeScannerModal";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { IconButton } from "@/components/ui/IconButton";
import { Camera, RefreshCw, ShoppingCart } from "lucide-react";
import { useToast } from "@/components/ui/useToast";
import { routePaths } from "@/config/routes";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useOffline } from "@/features/offline/hooks/useOffline";
import { usePwa } from "@/features/pwa/hooks/usePwa";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { PosCustomerModal, type PosCustomerModalValues } from "@/modules/pos/components/PosCustomerModal";
import { CashOpenForm } from "@/modules/caja/components/CashOpenForm";
import { ReceiptTicketPanel } from "@/modules/comprobantes/components/ReceiptTicketPanel";
import { PosCart } from "@/modules/pos/components/PosCart";
import { PosCartItemEditModal } from "@/modules/pos/components/PosCartItemEditModal";
import { PosCheckoutPanel } from "@/modules/pos/components/PosCheckoutPanel";
import { PosProductList } from "@/modules/pos/components/PosProductList";
import { PosQuickProductModal } from "@/modules/pos/components/PosQuickProductModal";
import { useBarcodeScanner } from "@/modules/pos/hooks/useBarcodeScanner";
import { usePosSale } from "@/modules/pos/hooks/usePosSale";
import type { PosCheckoutValues } from "@/modules/pos/schemas/pos-checkout.schema";
import type { OpenCashValues } from "@/modules/caja/schemas/cash.schemas";
import { auditService } from "@/services/audit.service";
import { cashService } from "@/services/cash.service";
import { customersService } from "@/services/customers.service";
import { invoicesService } from "@/services/invoices.service";
import { normalizePaymentMethodCode } from "@/services/payment-methods.service";
import { posCustomerProfilesService } from "@/services/pos-customer-profiles.service";
import { receiptsService } from "@/services/receipts.service";
import { settingsService } from "@/services/settings.service";
import { usersService } from "@/services/users.service";
import type { Customer, Invoice, OriginBank, Receipt } from "@/types/entities";

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

interface PosRecentReceiptItem {
  receipt: Receipt;
  invoice: Invoice | null;
}

interface PosReceiptModalState {
  receipt: Receipt;
  invoice: Invoice | null;
  view: "ticket" | "invoice";
  autoPrint: boolean;
}

interface PosCustomerModalState {
  mode: "create" | "edit";
  customer: Customer | null;
  initialValues: PosCustomerModalValues;
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
    customers,
    paymentMethods,
    bankAccounts,
    originBanks,
    installmentPlans,
    posSettings,
    mercadoPagoSettings,
    mercadoPagoStatus,
    selectedCustomerId,
    selectedCustomer,
    appliedPriceList,
    cart,
    subtotalBeforePromotions,
    promotionDiscountTotal,
    cartPromotionDiscountTotal,
    isLoading,
    isSubmitting,
    isMercadoPagoLoading,
    feedback,
    clearFeedback,
    reload,
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
    approveMercadoPagoPayment,
    rejectMercadoPagoPayment,
    cancelMercadoPagoPayment,
    clearMercadoPagoIntent,
    getCheckoutSummary,
    confirmSale,
    generatedReceipt,
    generatedInvoice,
    clearGeneratedReceipt,
  } = usePosSale(tenantId);

  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState("");
  const [visibleBarcodeValue, setVisibleBarcodeValue] = useState("");
  const [rightPanelTab, setRightPanelTab] = useState<"cart" | "receipts">("cart");
  const [recentReceipts, setRecentReceipts] = useState<PosRecentReceiptItem[]>([]);
  const [isLoadingReceipts, setIsLoadingReceipts] = useState(false);
  const [receiptModal, setReceiptModal] = useState<PosReceiptModalState | null>(null);
  const [printMenuReceiptId, setPrintMenuReceiptId] = useState<string | null>(null);
  const [customerModalState, setCustomerModalState] = useState<PosCustomerModalState | null>(null);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isQuickProductModalOpen, setIsQuickProductModalOpen] = useState(false);
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [isCustomerModalSubmitting, setIsCustomerModalSubmitting] = useState(false);
  const [clientLogoUrl, setClientLogoUrl] = useState<string | null>(null);
  const [clientDisplayName, setClientDisplayName] = useState("POS");
  const [isManualSyncing, setIsManualSyncing] = useState(false);
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

  useEffect(() => {
    if (!paymentMethods.length) {
      setSelectedPaymentMethodId("");
      return;
    }

    setSelectedPaymentMethodId((current) => {
      if (current && paymentMethods.some((method) => method.id === current)) {
        return current;
      }

      const defaultPaymentMethodId = posSettings.default_payment_method_id;
      if (
        defaultPaymentMethodId &&
        paymentMethods.some((method) => method.id === defaultPaymentMethodId)
      ) {
        return defaultPaymentMethodId;
      }

      return paymentMethods[0].id;
    });
  }, [paymentMethods, posSettings.default_payment_method_id]);

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
  const editingCartItem = useMemo(
    () => cart.find((item) => item.product_id === editingCartItemId) ?? null,
    [cart, editingCartItemId]
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
      const [receiptRows, invoiceRows] = await Promise.all([
        receiptsService.getAllByTenant(tenantId),
        invoicesService.getAllByTenant(tenantId),
      ]);

      const receiptList = [...receiptRows]
        .sort((a, b) => b.issued_at.localeCompare(a.issued_at))
        .slice(0, 30);

      const invoiceBySaleId = new Map<string, Invoice>();
      [...invoiceRows]
        .filter((invoice) => invoice.sale_id)
        .sort((a, b) => b.issue_date.localeCompare(a.issue_date))
        .forEach((invoice) => {
          if (!invoice.sale_id || invoiceBySaleId.has(invoice.sale_id)) return;
          invoiceBySaleId.set(invoice.sale_id, invoice);
        });

      const merged = receiptList.map((receipt) => ({
        receipt,
        invoice: invoiceBySaleId.get(receipt.sale_id) ?? null,
      }));

      setRecentReceipts(merged);
    } catch {
      toastError("No se pudieron cargar comprobantes recientes.");
    } finally {
      setIsLoadingReceipts(false);
    }
  }, [tenantId, toastError]);

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

      const lookupValue = user.email?.trim() || user.username?.trim() || "";
      if (lookupValue) {
        const byIdentity = await usersService.getByEmailOrUsername(tenantId, lookupValue);
        if (byIdentity?.is_active) {
          persistResolvedUser(byIdentity.id);
          return;
        }
      }

      const openSession = await cashService.getOpenSession(tenantId);
      if (openSession?.opened_by_user_id) {
        persistResolvedUser(openSession.opened_by_user_id, false);
        return;
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

  const handleConfirmSale = useCallback(
    async (values: PosCheckoutValues) => {
      if (!canWritePos) return;
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
      clearFeedback();
      await confirmSale(values, resolvedOperatorUserId, { openCashSessionId });
      setIsCheckoutModalOpen(false);
    },
    [
      canWritePos,
      clearFeedback,
      confirmSale,
      isCashGateResolving,
      isOpeningCashSession,
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
          notes: values.notes?.trim() || null,
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
    const input = scannerCaptureRef.current;
    if (!input) return;
    input.focus({ preventScroll: true });
  }, []);

  const handleBarcodeScan = useCallback(
    async (barcode: string): Promise<boolean> => {
      if (!canWritePos || isSubmitting || isCashGateBlocking) return false;

      try {
        const result = await addProductByBarcode(barcode);
        if (!result.ok || (!result.product && !result.promotion)) {
          toastError(result.error ?? `No se encontro producto para ${barcode}`);
          return false;
        }

        if (result.promotion) {
          toastSuccess(`Promo: ${result.promotion.name}`);
          return true;
        }
        const scannedProduct = result.product;
        if (!scannedProduct) {
          toastError(result.error ?? `No se encontro producto para ${barcode}`);
          return false;
        }

        const isScaleScan = Boolean(result.parsedScale);
        const scaleWeight =
          result.parsedScale?.weight != null && result.parsedScale.weight > 0
            ? result.parsedScale.weight
            : null;
        const scaleSuffix =
          scaleWeight != null ? ` (${scaleWeight.toLocaleString("es-AR")} kg)` : "";

        if (isScaleScan) {
          toastSuccess(
            `Balanza: ${scannedProduct.name}${scaleSuffix}${
              result.parsedScale?.productCode ? ` | PLU ${result.parsedScale.productCode}` : ""
            }`
          );
        } else {
          toastSuccess(`Escaneado: ${scannedProduct.name}`);
        }
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
      isSubmitting,
      toastError,
      toastSuccess,
    ]
  );

  const onBarcodeScannerScan = useCallback(
    (barcode: string) => {
      void handleBarcodeScan(barcode);
    },
    [handleBarcodeScan]
  );

  const handleVisibleBarcodeSubmit = useCallback(() => {
    const barcode = visibleBarcodeValue.trim();
    if (!barcode) return;

    void handleBarcodeScan(barcode).then((ok) => {
      if (ok) {
        setVisibleBarcodeValue("");
      }
    });
  }, [handleBarcodeScan, visibleBarcodeValue]);

  useBarcodeScanner({
    enabled: Boolean(
      tenantId &&
        canReadPos &&
        canWritePos &&
        !isCashGateBlocking &&
        !isSubmitting &&
        !customerModalState &&
        !receiptModal &&
        !isCameraScannerOpen
    ),
    onScan: onBarcodeScannerScan,
  });

  useEffect(() => {
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
    isSubmitting,
    receiptModal,
  ]);

  useEffect(() => {
    if (isCashGateBlocking) return;
    if (rightPanelTab !== "cart") return;
    if (isSubmitting) return;
    if (customerModalState || receiptModal) return;
    if (isCameraScannerOpen) return;
    focusScannerCapture();
  }, [
    customerModalState,
    focusScannerCapture,
    isCameraScannerOpen,
    isCashGateBlocking,
    isSubmitting,
    receiptModal,
    rightPanelTab,
  ]);

  useEffect(() => {
    if (!generatedReceipt) return;

    setRecentReceipts((previous) => {
      const nextItem: PosRecentReceiptItem = {
        receipt: generatedReceipt,
        invoice: generatedInvoice ?? null,
      };

      const deduped = previous.filter((item) => item.receipt.id !== generatedReceipt.id);
      return [nextItem, ...deduped].slice(0, 30);
    });

    clearGeneratedReceipt();
    if (!isCashGateBlocking) {
      window.setTimeout(() => {
        focusScannerCapture();
      }, 0);
    }
  }, [clearGeneratedReceipt, focusScannerCapture, generatedInvoice, generatedReceipt, isCashGateBlocking]);

  const closeReceiptModal = useCallback(() => {
    setReceiptModal(null);
    setPrintMenuReceiptId(null);
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
        documentNumber: customer?.document_number ?? "",
        phone: customer?.phone ?? "",
        email: customer?.email ?? "",
        address: customer?.address ?? "",
        fiscalBusinessName: customer?.fiscal_business_name ?? "",
        fiscalAddress: customer?.fiscal_address ?? "",
        fiscalCondition: customer?.fiscal_condition ?? "",
        fiscalCuit: customer?.document_type === "cuit" ? customer.document_number : "",
        currentAccountEnabled: accountEnabled,
        currentAccountLimit:
          accountLimit != null && Number.isFinite(accountLimit) ? accountLimit.toString() : "",
      };
    },
    [tenantId]
  );

  const openCustomerModal = useCallback(
    (customer: Customer | null) => {
      if (!canWriteCustomers) return;

      setCustomerModalState({
        mode: customer ? "edit" : "create",
        customer,
        initialValues: buildCustomerModalInitialValues(customer),
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
      const documentNumber = fiscalCuit || values.documentNumber.trim();
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

          await reload();
          setSelectedCustomer(created.id);
          toastSuccess("Cliente creado y seleccionado");
          closeCustomerModal();
          return;
        }

        const existing = customerModalState.customer;
        if (!existing) return;

        await customersService.update(tenantId, existing.id, {
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
      if (event.key === "Escape") {
        setIsCheckoutModalOpen(false);
        window.setTimeout(() => {
          focusScannerCapture();
        }, 0);
        return;
      }

      if (event.key !== "Enter") return;
      if (event.defaultPrevented) return;
      if (!cart.length || !paymentMethods.length) return;
      if (!canWritePos || isLoading || isSubmitting || isCashGateBlocking) return;

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
      if (event.defaultPrevented) return;
      if (customerModalState || receiptModal || isCheckoutModalOpen) return;
      if (rightPanelTab !== "cart") return;
      if (!canWritePos || isLoading || isSubmitting) return;
      if (isCashGateBlocking) return;
      if (!cart.length || !paymentMethods.length) return;

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
    isCashGateBlocking,
    isLoading,
    isCheckoutModalOpen,
    isSubmitting,
    paymentMethods.length,
    receiptModal,
    rightPanelTab,
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

  const handleSynchronize = useCallback(async () => {
    if (isManualSyncing) return;

    setIsManualSyncing(true);
    clearSyncError();

    try {
      const results = await Promise.allSettled([
        syncNow(),
        reload(),
        loadRecentReceipts(),
        loadCashSessionGate(),
      ]);
      const hasError = results.some((result) => result.status === "rejected");

      if (hasError) {
        toastError("No se pudo completar la sincronizacion.");
        return;
      }

      toastSuccess("Sincronizacion completada.");
    } finally {
      setIsManualSyncing(false);
    }
  }, [
    clearSyncError,
    isManualSyncing,
    loadRecentReceipts,
    loadCashSessionGate,
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
    <div className="pos-page space-y-4 pb-24 lg:pb-2">
      <section className="pos-surface pos-surface--header">
        <div className="pos-topbar">
          <div className="flex items-center gap-3">
            {clientLogoUrl ? (
              <img
                src={clientLogoUrl}
                alt={clientDisplayName}
                className="h-12 w-12 rounded-xl bg-slate-50 object-cover"
              />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-sm font-semibold text-white">
                {clientDisplayName.slice(0, 2).toUpperCase()}
              </span>
            )}
            <div>
              <p className="pos-overline">{clientDisplayName}</p>
              <h1 className="pos-title">Punto de venta</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 xl:col-start-3">
            {shouldShowReturnToPanel ? (
              <button
                type="button"
                onClick={handleReturnToPanel}
                className="ui-btn-ghost"
              >
                Volver al panel
              </button>
            ) : null}
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
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.value = "";
                }
              }}
              onBlur={() => {
                window.setTimeout(() => {
                  const activeElement = document.activeElement;
                  const isEditableElement =
                    activeElement instanceof HTMLInputElement ||
                    activeElement instanceof HTMLTextAreaElement ||
                    activeElement instanceof HTMLSelectElement ||
                    Boolean((activeElement as HTMLElement | null)?.isContentEditable);

                  if (!isEditableElement) {
                    focusScannerCapture();
                  }
                }, 0);
              }}
            />
            <IconButton
              icon={RefreshCw}
              label="Sincronizar punto de venta"
              onClick={() => {
                void handleSynchronize();
              }}
              loading={isManualSyncing || isSyncing}
              disabled={isManualSyncing || isSubmitting}
            />
            <button
              type="button"
              className="ui-btn-ghost"
              onClick={() => setIsQuickProductModalOpen(true)}
              disabled={isSubmitting || !canWritePos || isCashGateBlocking}
            >
              Producto rapido
            </button>
            <IconButton
              icon={Camera}
              label="Escanear con cámara"
              onClick={() => setIsCameraScannerOpen(true)}
              disabled={isSubmitting || !canWritePos || isCashGateBlocking}
            />
            {isInstallSupported && canInstall ? (
              <button
                type="button"
                onClick={() => {
                  void installApp();
                }}
                className="ui-btn-ghost"
                disabled={isInstalling}
              >
                {isInstalling ? "Instalando..." : "Instalar app"}
              </button>
            ) : null}
            <IconButton
              icon={ShoppingCart}
              label="Limpiar carrito"
              onClick={clearCart}
              disabled={isSubmitting || !canWritePos || isCashGateBlocking}
            />
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-2.5 py-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-sm font-semibold text-white">
                {operatorInitials}
              </span>
              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {user?.fullName ?? "Operador"}
                </p>
                <p className="truncate text-xs text-slate-500">Operador de caja</p>
              </div>
            </div>
          </div>
        </div>

        {lastSyncMessage ? (
          <p className={`text-xs ${lastSyncError ? "text-red-600" : "text-slate-500"}`}>
            {lastSyncMessage}
          </p>
        ) : null}
        <p
          className={`text-xs ${
            isCashGateResolving
              ? "text-slate-500"
              : openCashSessionId
                ? "text-emerald-700"
                : "text-amber-700"
          }`}
        >
          {isCashGateResolving && !openCashSessionId
            ? "Validando usuario y caja..."
            : openCashSessionId
              ? "Caja abierta"
              : "Abre la caja para comenzar a vender."}
        </p>
        {isCashGateResolving && !openCashSessionId ? (
          <div className="inline-flex items-center gap-2 text-xs text-slate-500">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
            Cargando informacion de caja...
          </div>
        ) : null}

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
              checkoutAnchorId={cartPanelId}
              onOpenCheckout={() => setRightPanelTab("cart")}
              canWrite={canWritePos}
              disabled={isSubmitting || isCashGateBlocking}
              onAddProduct={async (product, quantity) => {
                if (!canWritePos || isCashGateBlocking) return;
                const added = await addProductToCart(product, quantity);
                if (added) {
                  window.setTimeout(() => {
                    focusScannerCapture();
                  }, 0);
                }
                return added;
              }}
            />

            <div className="pos-side-column">
              <div className="pos-side-tabs">
                <button
                  type="button"
                  onClick={() => setRightPanelTab("cart")}
                  className={
                    rightPanelTab === "cart"
                      ? "pos-side-tab pos-side-tab--active"
                      : "pos-side-tab"
                  }
                >
                  Carrito
                </button>
                <button
                  type="button"
                  onClick={() => setRightPanelTab("receipts")}
                  className={
                    rightPanelTab === "receipts"
                      ? "pos-side-tab pos-side-tab--active"
                      : "pos-side-tab"
                  }
                >
                  Comprobantes
                </button>
              </div>

              {rightPanelTab === "cart" ? (
                <>
                  <PosCart
                    id={cartPanelId}
                    items={cart}
                    barcodeValue={visibleBarcodeValue}
                    subtotalBeforePromotions={subtotalBeforePromotions}
                    promotionDiscountTotal={promotionDiscountTotal}
                    cartPromotionDiscountTotal={cartPromotionDiscountTotal}
                    subtotal={checkoutSummary.subtotal}
                    surchargeTotal={0}
                    paymentDiscountTotal={0}
                    paymentAdjustment={0}
                    total={checkoutSummary.subtotal}
                    canWrite={canWritePos}
                    disabled={isSubmitting || isCashGateBlocking}
                    onBarcodeChange={setVisibleBarcodeValue}
                    onBarcodeSubmit={handleVisibleBarcodeSubmit}
                    onIncrease={increaseQuantity}
                    onDecrease={decreaseQuantity}
                    onSetQuantity={setCartItemQuantity}
                    onEdit={(item) => setEditingCartItemId(item.product_id)}
                    onRemove={removeFromCart}
                    onOpenQuickProduct={() => setIsQuickProductModalOpen(true)}
                    onCheckout={() => setIsCheckoutModalOpen(true)}
                  />
                </>
              ) : (
                <section className="pos-surface space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold text-slate-900">Comprobantes recientes</h2>
                    <IconButton
                      size="sm"
                      icon={RefreshCw}
                      label="Actualizar comprobantes"
                      onClick={() => {
                        void loadRecentReceipts();
                      }}
                      loading={isLoadingReceipts}
                    />
                  </div>

                  {isLoadingReceipts ? (
                    <div className="ui-loading">Cargando comprobantes...</div>
                  ) : !recentReceipts.length ? (
                    <div className="ui-empty-state">Todavia no hay comprobantes recientes.</div>
                  ) : (
                    <div className="pos-receipts-list">
                      {recentReceipts.map((item) => {
                        const { receipt, invoice } = item;
                        return (
                          <article key={receipt.id} className="pos-receipt-item">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {receipt.sale_number || receipt.receipt_number}
                              </p>
                              <p className="text-xs text-slate-500">
                                {new Date(receipt.issued_at).toLocaleString("es-AR")}
                              </p>
                              <p className="text-xs text-slate-500">
                                Cliente: {receipt.customer_name ?? "Consumidor final"}
                              </p>
                            </div>

                            <div className="text-right">
                              <p className="font-kpi text-sm font-semibold text-slate-900">
                                {currency.format(receipt.total)}
                              </p>
                              <div className="mt-1 flex items-center justify-end gap-1">
                                <span className="ui-badge ui-badge--info">Ticket disponible</span>
                                {invoice ? (
                                  <span className="ui-badge ui-badge--success">Factura disponible</span>
                                ) : (
                                  <span className="ui-badge ui-badge--warn">Sin factura</span>
                                )}
                              </div>
                            </div>

                            <div className="col-span-2 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                className="ui-btn-ghost px-2.5 py-1.5 text-xs"
                                onClick={() => openReceiptModal(item, "ticket")}
                              >
                                Ver ticket
                              </button>
                              {invoice ? (
                                <button
                                  type="button"
                                  className="ui-btn-ghost px-2.5 py-1.5 text-xs"
                                  onClick={() => openReceiptModal(item, "invoice")}
                                >
                                  Ver factura
                                </button>
                              ) : null}
                              <div className="relative" data-print-menu="true">
                                <button
                                  type="button"
                                  className="ui-btn-ghost px-2.5 py-1.5 text-xs"
                                  onClick={() =>
                                    setPrintMenuReceiptId((current) =>
                                      current === receipt.id ? null : receipt.id
                                    )
                                  }
                                >
                                  Imprimir
                                </button>
                                {printMenuReceiptId === receipt.id ? (
                                  <div className="absolute right-0 z-10 mt-1 min-w-[164px] rounded-lg border border-slate-200 bg-white p-1.5 shadow-panel">
                                    <button
                                      type="button"
                                      className="ui-btn-ghost w-full justify-start px-2 py-1.5 text-xs"
                                      onClick={() => openReceiptModal(item, "ticket", true)}
                                    >
                                      Imprimir ticket
                                    </button>
                                    {invoice ? (
                                      <button
                                        type="button"
                                        className="ui-btn-ghost w-full justify-start px-2 py-1.5 text-xs"
                                        onClick={() => openReceiptModal(item, "invoice", true)}
                                      >
                                        Imprimir factura
                                      </button>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}
            </div>
          </div>
        )}
      </section>

      {!isLoading && cart.length && !isCashGateBlocking ? (
        <div className="pos-mobile-dock">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Carrito</p>
            <p className="text-sm font-semibold text-slate-900">
              {cart.length} items | {currency.format(checkoutSummary.subtotal)}
            </p>
          </div>
          <button
            type="button"
            className="ui-btn-primary whitespace-nowrap"
            onClick={() => {
              setRightPanelTab("cart");
              setIsCheckoutModalOpen(true);
            }}
          >
            Confirmar venta
          </button>
        </div>
      ) : null}

      {shouldShowCashOpeningModal ? (
        <section className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/55 p-4">
          <div className="w-full max-w-xl space-y-3 rounded-2xl bg-white p-4 shadow-panel">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-slate-900">Apertura de caja obligatoria</h2>
              <p className="text-sm text-slate-600">
                Para iniciar el POS y registrar movimientos contables, primero debes abrir caja.
              </p>
            </div>

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
          <div className="relative z-10 w-full max-w-4xl rounded-2xl bg-white p-4 shadow-panel">
            <div className="max-h-[88vh] overflow-auto pr-1">
              <PosCheckoutPanel
                panelId={checkoutPanelId}
                formId={checkoutFormId}
                layout="modal"
                customers={customers}
                paymentMethods={paymentMethods}
                bankAccounts={bankAccounts}
                originBanks={originBanks}
                installmentPlans={installmentPlans}
                selectedCustomerId={selectedCustomerId}
                selectedPaymentMethodId={selectedPaymentMethodId}
                isOnline={isOnline}
                checkoutTotal={checkoutSummary.total}
                mercadoPagoIntent={mercadoPagoIntent}
                mercadoPagoSettings={mercadoPagoSettings}
                mercadoPagoStatus={mercadoPagoStatus}
                isMercadoPagoLoading={isMercadoPagoLoading}
                canWrite={canWritePos}
                canManageCustomers={canWriteCustomers}
                currentAccountSnapshot={currentAccountSnapshot}
                disabled={isSubmitting || isCashGateBlocking}
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
                onSubmit={handleConfirmSale}
              />
            </div>
          </div>
        </section>
      ) : null}

      <PosQuickProductModal
        open={isQuickProductModalOpen}
        categories={productCategories}
        disabled={isSubmitting || isCashGateBlocking || !canWritePos}
        onClose={() => {
          setIsQuickProductModalOpen(false);
          window.setTimeout(() => {
            focusScannerCapture();
          }, 0);
        }}
        onAddManual={(values) => {
          const ok = addManualProductToCart(values);
          if (ok) {
            setRightPanelTab("cart");
            window.setTimeout(() => {
              focusScannerCapture();
            }, 0);
          }
          return ok;
        }}
        onCreateAndAdd={async (values) => {
          const ok = await createProductFromPosAndAddToCart(values);
          if (ok) {
            setRightPanelTab("cart");
            window.setTimeout(() => {
              focusScannerCapture();
            }, 0);
          }
          return ok;
        }}
      />

      <PosCartItemEditModal
        item={editingCartItem}
        disabled={isSubmitting || isCashGateBlocking || !canWritePos}
        onClose={() => {
          setEditingCartItemId(null);
          window.setTimeout(() => {
            focusScannerCapture();
          }, 0);
        }}
        onSubmit={(values) => {
          updateCartItem(values);
        }}
      />

      <BarcodeScannerModal
        open={isCameraScannerOpen}
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

      {receiptModal ? (
        <section className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4">
          <button
            type="button"
            aria-label="Cerrar comprobante"
            className="absolute inset-0"
            onClick={closeReceiptModal}
          />
          <div className="relative z-10 w-full max-w-3xl space-y-3 rounded-2xl bg-white p-4 shadow-panel">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">
                {receiptModal.view === "invoice" ? "Factura" : "Ticket"}{" "}
                {receiptModal.view === "invoice"
                  ? receiptModal.invoice?.document_number
                  : receiptModal.receipt.receipt_number}
              </p>
              <button type="button" className="ui-btn-ghost px-2.5 py-1.5 text-xs" onClick={closeReceiptModal}>
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
    </div>
  );
};
