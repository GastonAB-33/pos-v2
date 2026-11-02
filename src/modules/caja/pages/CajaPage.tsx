import { useEffect, useMemo, useState } from "react";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import {
  ArrowDownLeft,
  ArrowUpRight,
  DollarSign,
  Lock,
  LockOpen,
  Banknote,
  ChevronDown,
  Coins,
  Clock,
  X,
  Eye,
  EyeOff,
  RefreshCw,
  Users,
  CalendarClock,
  ArrowLeftRight,
  ListFilter,
  CheckCircle2,
} from "lucide-react";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { CashCloseForm } from "@/modules/caja/components/CashCloseForm";
import { CashDailyTrackingTable } from "@/modules/caja/components/CashDailyTrackingTable";
import {
  formatLocalDateKey,
  formatLocalDateDisplay,
  getShiftLabel,
  formatLocalTime,
} from "@/modules/caja/utils/cash-date.utils";
import { ManualCashMovementModal } from "@/modules/caja/components/ManualCashMovementModal";
import { CashMovementsTable } from "@/modules/caja/components/CashMovementsTable";
import { CashOpenForm } from "@/modules/caja/components/CashOpenForm";
import { CashSessionCloseDetailModal } from "@/modules/caja/components/CashSessionCloseDetailModal";
import { ReceiptTicketPanel } from "@/modules/comprobantes/components/ReceiptTicketPanel";
import { useCashModule, parseCloseSnapshot } from "@/modules/caja/hooks/useCashModule";
import { invoicesService } from "@/services/invoices.service";
import { receiptsService } from "@/services/receipts.service";
import type { CashSession, Invoice, Receipt } from "@/types/entities";

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const formatMoney = (amount: number | null | undefined): string => {
  const num = typeof amount === "number" ? amount : Number(amount) || 0;
  return currency.format(num);
};

const formatDateTime = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
};

export const CajaPage = () => {
  const { tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);
  const { canRead, canWrite } = usePermissions();
  const canReadCaja = canRead("caja");
  const canWriteCaja = canWrite("caja");

  const [isOpenCashModalOpen, setIsOpenCashModalOpen] = useState(false);
  const [isManualMovementModalOpen, setIsManualMovementModalOpen] = useState(false);
  const [manualMovementTab, setManualMovementTab] = useState<"income" | "expense">("income");
  const [isCloseCashModalOpen, setIsCloseCashModalOpen] = useState(false);
  const [closingSessionSnapshot, setClosingSessionSnapshot] = useState<CashSession | null>(null);
  const [closingSummarySnapshot, setClosingSummarySnapshot] = useState<{
    expectedBalance: number;
    expectedCashBalance: number;
    expectedFullBalance: number;
  } | null>(null);
  const [closingIncomeSnapshot, setClosingIncomeSnapshot] = useState<typeof currentSessionIncomeSummary | null>(null);
  const [isCashClosed, setIsCashClosed] = useState(false);
  const [isDailyDetailModalOpen, setIsDailyDetailModalOpen] = useState(false);
  const [openSummaryModal, setOpenSummaryModal] = useState<"incomes" | "expenses" | "total" | null>(
    null
  );
  const [isCurrentAccountModalOpen, setIsCurrentAccountModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [isRefreshConfirmed, setIsRefreshConfirmed] = useState(false);
  const [detailDate, setDetailDate] = useState<string | null>(null);
  const [isSaleDocumentModalOpen, setIsSaleDocumentModalOpen] = useState(false);
  const [isSaleDocumentLoading, setIsSaleDocumentLoading] = useState(false);
  const [saleDocumentError, setSaleDocumentError] = useState<string | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [saleDocumentInitialTab, setSaleDocumentInitialTab] = useState<"ticket" | "invoice">("ticket");
  const [activeViewTab, setActiveViewTab] = useState<"shift" | "history">("shift");
  const [revealBlindAmounts, setRevealBlindAmounts] = useState(false);
  const [isCloseDetailModalOpen, setIsCloseDetailModalOpen] = useState(false);
  const [selectedCloseSession, setSelectedCloseSession] = useState<CashSession | null>(null);
  const [selectedCloseDateSessions, setSelectedCloseDateSessions] = useState<CashSession[]>([]);
  const [detailSessionId, setDetailSessionId] = useState<string | null>(null);
  const [isShiftPopoverOpen, setIsShiftPopoverOpen] = useState(false);
  const [isBillsPopoverOpen, setIsBillsPopoverOpen] = useState(false);

  const {
    currentSession,
    sessionHistory,
    dailyTracking,
    activeShiftMovements,
    paymentMethods,
    bankAccounts,
    saleBankAccountsById,
    usersById,
    saleNumbersById,
    salesById,
    invoicesBySaleId,
    cashSettings,
    currentSessionSummary,
    currentSessionIncomeSummary,
    getSessionBreakdown,
    getCurrentAccountDailySummary,
    getDailyMovements,
    getSessionMovements,
    isLoading,
    isBackgroundRefreshing,
    isSubmitting,
    feedback,
    clearFeedback,
    reload,
    openCash,
    closeCash,
    updateSessionNotes,
  } = useCashModule(tenantId, user?.id ?? null);

  const handleOpenCloseDetailForDate = (
    date: string | null,
    targetSessionOverride?: CashSession
  ) => {
    if (!date) return;
    const sessionsOnDate = sessionHistory
      .filter((s) => formatLocalDateKey(s.opened_at) === date)
      .sort((a, b) => a.opened_at.localeCompare(b.opened_at));

    const targetSession =
      targetSessionOverride ??
      sessionsOnDate.find((s) => s.status === "closed") ??
      sessionsOnDate[sessionsOnDate.length - 1] ??
      null;

    if (targetSession) {
      setSelectedCloseSession(targetSession);
      setSelectedCloseDateSessions(sessionsOnDate);
      setIsCloseDetailModalOpen(true);
    }
  };

  // Permiso para ver / desenmascarar montos de caja (solo administradores, dueños, supervisores o con permisos privilegiados)
  const canRevealBlindCash = useMemo(() => {
    if (!user) return false;

    const role = (user.role || "").toLowerCase();
    const isPrivilegedRole =
      role === "admin" ||
      role === "owner" ||
      role === "manager" ||
      role === "supervisor" ||
      role === "encargado" ||
      role === "superadmin" ||
      role === "platform_admin";

    const profileName = (user.permissionProfileName || "").toLowerCase();
    const isPrivilegedProfile =
      profileName.includes("admin") ||
      profileName.includes("supervisor") ||
      profileName.includes("encargad") ||
      profileName.includes("gerente") ||
      profileName.includes("dueño");

    const hasPrivilegedPermissions =
      canRead("caja_general") ||
      canRead("auditoria") ||
      canRead("reportes") ||
      canWrite("configuracion") ||
      canRead("usuarios");

    return isPrivilegedRole || isPrivilegedProfile || hasPrivilegedPermissions;
  }, [user, canRead, canWrite]);

  const isBlindModeActive = Boolean(
    cashSettings.blind_cash_closing && (!canRevealBlindCash || !revealBlindAmounts)
  );

  const dailySession = useMemo(
    () => currentSession ?? sessionHistory[0] ?? null,
    [currentSession, sessionHistory]
  );

  const dailyDate = dailySession ? formatLocalDateKey(dailySession.opened_at) : null;
  const activeDetailDate = detailDate ?? dailyDate;
  const dailySessionBreakdown = useMemo(
    () => getSessionBreakdown(dailySession?.id ?? null),
    [dailySession?.id, getSessionBreakdown]
  );
  const dailySessionTotals = dailySessionBreakdown?.totalCash ?? {
    openingAmount: dailySession?.opening_amount ?? 0,
    incomes: 0,
    expenses: 0,
    expectedBalance: dailySession?.opening_amount ?? 0,
  };

  const totalIncomes = dailySessionBreakdown?.incomes.total ?? dailySessionTotals.incomes;
  const cashIncomes = dailySessionTotals.incomes;
  const digitalIncomes = Math.max(0, totalIncomes - cashIncomes);

  const totalExpenses = dailySessionBreakdown?.expenses.total ?? dailySessionTotals.expenses;
  const cashExpenses = dailySessionTotals.expenses;
  const digitalExpenses = Math.max(0, totalExpenses - cashExpenses);
  const detailMovements = useMemo(() => {
    if (detailSessionId) {
      return getSessionMovements(detailSessionId);
    }
    return getDailyMovements(activeDetailDate, "all");
  }, [detailSessionId, activeDetailDate, getSessionMovements, getDailyMovements]);

  const activeDateSessions = useMemo(() => {
    if (!activeDetailDate) return [];
    return sessionHistory
      .filter((s) => formatLocalDateKey(s.opened_at) === activeDetailDate)
      .sort((a, b) => a.opened_at.localeCompare(b.opened_at));
  }, [activeDetailDate, sessionHistory]);
  const currentAccountDailySummary = useMemo(
    () => getCurrentAccountDailySummary(dailyDate),
    [dailyDate, getCurrentAccountDailySummary]
  );

  const dailySessionResponsible = dailySession
    ? usersById[dailySession.opened_by_user_id] ?? dailySession.opened_by_user_id
    : "-";

  useEffect(() => {
    if (isCloseCashModalOpen && !currentSession) {
      setIsCloseCashModalOpen(false);
    }
  }, [currentSession, isCloseCashModalOpen]);

  useEffect(() => {
    if (isOpenCashModalOpen && currentSession) {
      setIsOpenCashModalOpen(false);
    }
  }, [currentSession, isOpenCashModalOpen]);

  useEffect(() => {
    if (!dailySession && openSummaryModal) {
      setOpenSummaryModal(null);
    }
  }, [dailySession, openSummaryModal]);

  useEffect(() => {
    if (!isRefreshConfirmed) return;
    const timer = window.setTimeout(() => {
      setIsRefreshConfirmed(false);
    }, 1800);
    return () => {
      window.clearTimeout(timer);
    };
  }, [isRefreshConfirmed]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => {
      clearFeedback();
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [feedback, clearFeedback]);

  // Tecla ESC para volver un paso atrás cerrando el modal activo
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isCloseDetailModalOpen) {
          e.preventDefault();
          setIsCloseDetailModalOpen(false);
          return;
        }
        if (isSaleDocumentModalOpen) {
          e.preventDefault();
          setIsSaleDocumentModalOpen(false);
          setIsSaleDocumentLoading(false);
          return;
        }
        if (isDailyDetailModalOpen) {
          e.preventDefault();
          setIsDailyDetailModalOpen(false);
          return;
        }
        if (isCurrentAccountModalOpen) {
          e.preventDefault();
          setIsCurrentAccountModalOpen(false);
          return;
        }
        if (openSummaryModal) {
          e.preventDefault();
          setOpenSummaryModal(null);
          return;
        }
        if (isManualMovementModalOpen) {
          e.preventDefault();
          setIsManualMovementModalOpen(false);
          return;
        }
        if (isOpenCashModalOpen) {
          e.preventDefault();
          setIsOpenCashModalOpen(false);
          return;
        }
        if (isCloseCashModalOpen) {
          e.preventDefault();
          setIsCloseCashModalOpen(false);
          return;
        }
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [
    isCloseDetailModalOpen,
    isSaleDocumentModalOpen,
    isDailyDetailModalOpen,
    isCurrentAccountModalOpen,
    openSummaryModal,
    isManualMovementModalOpen,
    isOpenCashModalOpen,
    isCloseCashModalOpen,
  ]);

  const handleRefresh = async () => {
    clearFeedback();
    setIsRefreshing(true);
    try {
      await reload(true);
      setLastUpdatedAt(new Date().toISOString());
      setIsRefreshConfirmed(true);
    } finally {
      setIsRefreshing(false);
    }
  };

  const openDailyDetail = (date: string | null, sessionId?: string) => {
    if (!date) return;
    setDetailDate(date);
    setDetailSessionId(sessionId ?? null);
    setIsDailyDetailModalOpen(true);
  };

  const handleViewSaleDocument = async (
    saleId: string,
    preferredTab: "ticket" | "invoice" = "ticket"
  ) => {
    if (!tenantId) return;

    setIsSaleDocumentModalOpen(true);
    setIsSaleDocumentLoading(true);
    setSaleDocumentError(null);
    setSelectedReceipt(null);
    setSelectedInvoice(null);
    setSaleDocumentInitialTab(preferredTab);

    try {
      const [receipt, invoices] = await Promise.all([
        receiptsService.getBySaleId(tenantId, saleId),
        invoicesService.getBySaleId(tenantId, saleId),
      ]);

      if (!receipt) {
        setSaleDocumentError("No se encontró ticket para esta venta.");
        return;
      }

      const latestInvoice =
        [...invoices].sort((a, b) => b.issue_date.localeCompare(a.issue_date))[0] ?? null;
      setSelectedReceipt(receipt);
      setSelectedInvoice(latestInvoice);
    } catch {
      setSaleDocumentError("No se pudo cargar ticket/factura de la venta.");
    } finally {
      setIsSaleDocumentLoading(false);
    }
  };

  if (!tenantId) {
    return <PagePlaceholder title="Caja diaria" description="No hay un comercio activo" />;
  }

  if (!canReadCaja) {
    return (
      <PagePlaceholder
        title="Caja diaria"
        description="No tenés permisos de lectura para este módulo"
      />
    );
  }

  return (
    <PagePlaceholder
      title="Caja diaria"
      description="Control de efectivo, arqueos de turno y movimientos en mostrador"
    >
      <div className="caja-daily-workspace space-y-3.5">
        {/* Barra Superior Compacta y Funcional con resaltado según estado de caja */}
        <div
          className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl border transition-all duration-200 shadow-sm ${
            currentSession
              ? "bg-white dark:bg-[#0b1325] border-emerald-400 dark:border-emerald-500/80 ring-1 ring-emerald-500/25 shadow-emerald-500/10"
              : "bg-white dark:bg-[#0b1325] border-amber-400 dark:border-amber-500/80 ring-1 ring-amber-500/25 shadow-amber-500/10"
          }`}
        >
          {/* Lado Izquierdo: Estado de Caja + Información en 1 sola línea */}
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                currentSession
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800/80"
                  : "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700/80"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  currentSession ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                }`}
              />
              {currentSession ? "Caja abierta" : "Sin caja abierta"}
            </span>

            {dailySession && (
              <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                <span className="hidden sm:inline text-slate-300 dark:text-slate-600">•</span>
                <span>Responsable de apertura: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{dailySessionResponsible}</strong></span>
                {user?.id && dailySession.opened_by_user_id !== user.id && (
                  <>
                    <span className="hidden sm:inline text-slate-300 dark:text-slate-600">•</span>
                    <span className="text-blue-600 dark:text-blue-400 font-medium">Operando: <strong>{user.fullName || user.username || "Tú"}</strong></span>
                  </>
                )}
                <span className="hidden md:inline text-slate-300 dark:text-slate-600">•</span>
                <span className="hidden md:inline">Desde {formatDateTime(dailySession.opened_at)}</span>
              </span>
            )}
          </div>

          {/* Lado Derecho: Acciones principales */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsCurrentAccountModalOpen(true)}
              disabled={isSubmitting || !dailySession}
              className="h-10 inline-flex items-center gap-2 px-3.5 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-700/80 border border-slate-300 dark:border-slate-700 rounded-xl transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              <Users className="h-4 w-4 text-slate-400 dark:text-slate-400" />
              <span>Cta. Cte.</span>
            </button>

            <button
              type="button"
              disabled={
                isSubmitting ||
                !canWriteCaja ||
                !currentSession ||
                !cashSettings.allow_manual_movements
              }
              onClick={() => {
                setManualMovementTab("income");
                setIsManualMovementModalOpen(true);
              }}
              className="h-10 inline-flex items-center gap-2 px-4 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-xl transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <ArrowLeftRight className="h-4 w-4" />
              <span>Movimiento manual</span>
            </button>

            {!currentSession && canWriteCaja && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsOpenCashModalOpen(true)}
                className="h-10 inline-flex items-center gap-2 px-4 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                <LockOpen className="h-4 w-4" />
                <span>Abrir caja</span>
              </button>
            )}

            {currentSession && canWriteCaja && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setClosingSessionSnapshot(currentSession);
                  setClosingSummarySnapshot({
                    expectedBalance: currentSessionSummary.expectedBalance,
                    expectedCashBalance: currentSessionSummary.expectedCashBalance,
                    expectedFullBalance: currentSessionSummary.expectedFullBalance,
                  });
                  setClosingIncomeSnapshot(currentSessionIncomeSummary);
                  setIsCashClosed(false);
                  setIsCloseCashModalOpen(true);
                }}
                className="h-10 inline-flex items-center gap-2 px-3.5 text-sm font-bold text-rose-700 dark:text-rose-300 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/70 rounded-xl transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                <Lock className="h-4 w-4" />
                <span>Cerrar caja</span>
              </button>
            )}

            {cashSettings.blind_cash_closing && canRevealBlindCash && (
              <button
                type="button"
                onClick={() => setRevealBlindAmounts((prev) => !prev)}
                title={
                  revealBlindAmounts
                    ? "Ocultar montos (Caja a ciegas activa)"
                    : "Revelar montos protegidos (Supervisor / Administrador)"
                }
                className="h-10 inline-flex items-center gap-1.5 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 border border-slate-300 dark:border-slate-700 rounded-xl transition-colors shadow-2xs cursor-pointer"
              >
                {revealBlindAmounts ? (
                  <EyeOff className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                ) : (
                  <Eye className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                )}
                <span className="hidden md:inline">
                  {revealBlindAmounts ? "Ocultar" : "Revelar"}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                void handleRefresh();
              }}
              disabled={isLoading || isSubmitting || isRefreshing || isBackgroundRefreshing}
              title="Recargar caja diaria"
              className="h-10 w-10 inline-flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-300 dark:border-slate-700 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing || isBackgroundRefreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Feedback / Notifications */}
        {(isRefreshing || isBackgroundRefreshing || lastUpdatedAt || isRefreshConfirmed) && (
          <div className="flex items-center gap-1.5 text-xs px-1">
            {isRefreshing || isBackgroundRefreshing ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700 dark:border-slate-600 dark:border-t-slate-200" />
                <span className="text-slate-500 dark:text-slate-400">Actualizando datos de caja en segundo plano...</span>
              </>
            ) : (
              <span className={`inline-flex items-center gap-1 ${isRefreshConfirmed ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-slate-400 dark:text-slate-500"}`}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                {isRefreshConfirmed ? "Caja actualizada correctamente." : "Caja actualizada."}
                {lastUpdatedAt ? ` ${new Date(lastUpdatedAt).toLocaleTimeString("es-AR")}` : ""}
              </span>
            )}
          </div>
        )}

        {feedback && feedback.type === "error" && (
          <div className="flex items-center justify-between p-3 rounded-xl border text-xs font-semibold bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/80">
            <span>{feedback.message}</span>
            <button
              type="button"
              onClick={clearFeedback}
              className="text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-200 cursor-pointer p-0.5 ml-2"
              aria-label="Cerrar notificación"
            >
              ✕
            </button>
          </div>
        )}

        {/* Panel Principal: Hero Saldo en Mano + Métricas Condensadas */}
        {dailySession ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
            {/* Tarjeta Hero: Saldo Teórico en Mano (Col 1 a 5) */}
            <article className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0b1325] p-4 sm:p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    Efectivo en Caja (Teórico)
                    {isBlindModeActive && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        A ciegas
                      </span>
                    )}
                  </span>
                  <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                    <DollarSign className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                  {isBlindModeActive ? "$ ••••••••" : formatMoney(dailySessionTotals.expectedBalance)}
                </p>
                {!isBlindModeActive ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <span>Apertura {formatMoney(dailySessionTotals.openingAmount)}</span>
                    <span className="text-slate-300 dark:text-slate-600">+</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Efec. +{formatMoney(cashIncomes)}</span>
                    <span className="text-slate-300 dark:text-slate-600">-</span>
                    <span className="text-rose-600 dark:text-rose-400 font-semibold">Egresos -{formatMoney(cashExpenses)}</span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    Saldo protegido para arqueo ciego. Se revelará al confirmar el cierre de turno.
                  </p>
                )}
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                {!isBlindModeActive ? (
                  <button
                    type="button"
                    onClick={() => setOpenSummaryModal("total")}
                    className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition underline underline-offset-2 cursor-pointer"
                  >
                    Ver fórmula de cálculo
                  </button>
                ) : (
                  <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                    Fórmula protegida en modo ciego
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => openDailyDetail(dailyDate)}
                  className="text-xs font-semibold text-blue-600 dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <ListFilter size={13} />
                  <span>Auditar movimientos</span>
                </button>
              </div>
            </article>

            {/* Tarjetas Secundarias Condensadas (Col 6 a 12: 3 columnas) */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Apertura */}
              <article className="rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0b1325] p-3.5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Apertura
                    </span>
                    <CalendarClock className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                  </div>
                  <p className="mt-2 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    {formatMoney(dailySession.opening_amount)}
                  </p>
                </div>
                <div className="mt-2.5 py-1.5 px-3 text-center text-xs font-medium text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-800">
                  Fondo de inicio
                </div>
              </article>

              {/* Ingresos */}
              <article className="rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0b1325] p-3.5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Ingresos
                    </span>
                    <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                  </div>
                  <p className="mt-2 text-lg font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                    {isBlindModeActive
                      ? "+••••••••"
                      : `+${formatMoney(totalIncomes)}`}
                  </p>
                  {!isBlindModeActive && (
                    <div className="mt-1 flex flex-col gap-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        En efectivo: +{formatMoney(cashIncomes)}
                      </span>
                      {digitalIncomes > 0 && (
                        <span className="text-slate-400 dark:text-slate-500">
                          Bancos / Digital: +{formatMoney(digitalIncomes)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!isBlindModeActive) setOpenSummaryModal("incomes");
                  }}
                  disabled={isBlindModeActive}
                  title={isBlindModeActive ? "Desglose protegido en modo ciego" : undefined}
                  className={`mt-2.5 w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold rounded-lg transition-colors ${
                    isBlindModeActive
                      ? "opacity-60 cursor-not-allowed text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
                      : "text-emerald-700 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/70 border border-emerald-200/80 dark:border-emerald-800/80 cursor-pointer"
                  }`}
                >
                  {isBlindModeActive ? "Oculto en caja a ciegas" : "Ver detalle"}
                </button>
              </article>

              {/* Egresos */}
              <article className="rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0b1325] p-3.5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Egresos
                    </span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400" />
                  </div>
                  <p className="mt-2 text-lg font-bold tracking-tight text-rose-600 dark:text-rose-400">
                    {isBlindModeActive
                      ? "-••••••••"
                      : `-${formatMoney(totalExpenses)}`}
                  </p>
                  {!isBlindModeActive && (
                    <div className="mt-1 flex flex-col gap-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-rose-600 dark:text-rose-400">
                        En efectivo: -{formatMoney(cashExpenses)}
                      </span>
                      {digitalExpenses > 0 && (
                        <span className="text-slate-400 dark:text-slate-500">
                          Bancos / Débito: -{formatMoney(digitalExpenses)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!isBlindModeActive) setOpenSummaryModal("expenses");
                  }}
                  disabled={isBlindModeActive}
                  title={isBlindModeActive ? "Desglose protegido en modo ciego" : undefined}
                  className={`mt-2.5 w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold rounded-lg transition-colors ${
                    isBlindModeActive
                      ? "opacity-60 cursor-not-allowed text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
                      : "text-rose-700 dark:text-rose-300 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/70 border border-rose-200/80 dark:border-rose-800/80 cursor-pointer"
                  }`}
                >
                  {isBlindModeActive ? "Oculto en caja a ciegas" : "Ver detalle"}
                </button>
              </article>
            </div>
          </div>
        ) : null}

        {/* Selector de Pestañas: "Turno Actual" vs "Historial de Jornadas" */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 pt-1">
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 border border-slate-200 dark:border-slate-700/80">
            <button
              type="button"
              onClick={() => setActiveViewTab("shift")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeViewTab === "shift"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Movimientos del turno ({currentSession ? activeShiftMovements.length : 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveViewTab("history")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeViewTab === "history"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Historial de jornadas ({dailyTracking.length})
            </button>
          </div>

          {activeViewTab === "shift" && currentSession && (
            <button
              type="button"
              onClick={() => openDailyDetail(dailyDate)}
              className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1 cursor-pointer"
            >
              <ListFilter size={13} />
              <span>Filtros y auditoría</span>
            </button>
          )}
        </div>

        {/* Vista Condicional: Tabla de Turno Actual vs Historial */}
        {activeViewTab === "shift" ? (
          currentSession ? (
            <div className="bg-white dark:bg-[#0b1325] rounded-2xl border border-slate-200 dark:border-slate-800/90 shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    Movimientos en Curso
                  </h3>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Operaciones registradas durante este turno de caja
                  </p>
                </div>
              </div>

              <CashMovementsTable
                movements={activeShiftMovements}
                bankAccounts={bankAccounts}
                saleBankAccountsById={saleBankAccountsById}
                paymentMethods={paymentMethods}
                usersById={usersById}
                saleNumbersById={saleNumbersById}
                onViewSaleDocument={handleViewSaleDocument}
                blindMode={isBlindModeActive}
              />
            </div>
          ) : (
            <div className="p-8 text-center bg-white dark:bg-[#0b1325] rounded-2xl border border-slate-200 dark:border-slate-800/90 shadow-sm space-y-3">
              <div className="inline-flex p-3 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/80">
                <Lock className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                No hay un turno de caja abierto en curso
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Los movimientos del turno cerrado se encuentran archivados en el{" "}
                <strong className="text-slate-700 dark:text-slate-200">Historial de Jornadas</strong>.
                Iniciá un nuevo turno para registrar cobros y movimientos en curso.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveViewTab("history")}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                >
                  Ver Historial de Jornadas
                </button>
                {canWriteCaja && (
                  <button
                    type="button"
                    onClick={() => setIsOpenCashModalOpen(true)}
                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <LockOpen className="h-3.5 w-3.5" />
                    <span>Abrir caja</span>
                  </button>
                )}
              </div>
            </div>
          )
        ) : (
          isLoading && dailyTracking.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <RefreshCw className="h-6 w-6 text-slate-400 animate-spin mx-auto mb-2" />
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Cargando historial de cajas diarias...</p>
            </div>
          ) : (
            <CashDailyTrackingTable
              rows={dailyTracking}
              usersById={usersById}
              onViewDetail={(date, sessionId) => {
                openDailyDetail(date, sessionId);
              }}
              onViewCloseDetail={(date, session) => {
                handleOpenCloseDetailForDate(date, session);
              }}
            />
          )
        )}
      </div>


      {/* MODAL: Movimiento Manual */}
      <ManualCashMovementModal
        isOpen={isManualMovementModalOpen}
        onClose={() => setIsManualMovementModalOpen(false)}
        defaultMode={manualMovementTab}
        paymentMethods={paymentMethods}
        bankAccounts={bankAccounts}
        canWrite={canWriteCaja}
      />

      {/* MODAL: Apertura de Caja */}
      {isOpenCashModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg max-h-[88vh] flex flex-col bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            <header className="shrink-0 px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/70 dark:bg-slate-800/60">
              <div className="flex items-center gap-2">
                <LockOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                  Apertura de Turno de Caja
                </h3>
              </div>
              <ModalCloseButton onClick={() => setIsOpenCashModalOpen(false)} />
            </header>

            <div className="flex-1 overflow-y-auto p-4">
              <CashOpenForm
                canWrite={canWriteCaja}
                disabled={isSubmitting}
                defaultOpeningAmount={cashSettings.default_opening_amount}
                onSubmit={async (values) => {
                  await openCash(values);
                  setIsOpenCashModalOpen(false);
                }}
                onCancel={() => setIsOpenCashModalOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Cierre de Caja */}
      {isCloseCashModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-3">
          <div className="w-full max-w-lg max-h-[96vh] flex flex-col bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            <header className="shrink-0 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/70 dark:bg-slate-800/60">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">Cierre de Caja y Arqueo de Turno</h3>
              </div>
              <ModalCloseButton
                onClick={() => {
                  setIsCloseCashModalOpen(false);
                  setClosingSessionSnapshot(null);
                  setClosingSummarySnapshot(null);
                  setClosingIncomeSnapshot(null);
                  setIsCashClosed(false);
                }}
              />
            </header>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {(currentSession || closingSessionSnapshot) ? (
                <>
                  {!cashSettings.blind_cash_closing && !isCashClosed && (
                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200/70 dark:border-slate-700">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">Cobros por venta:</span>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {formatMoney((closingIncomeSnapshot ?? currentSessionIncomeSummary).salePaymentsTotal)}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">Ingresos manuales:</span>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {formatMoney((closingIncomeSnapshot ?? currentSessionIncomeSummary).manualIncomesTotal)}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">Ajustes positivos:</span>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {formatMoney((closingIncomeSnapshot ?? currentSessionIncomeSummary).positiveAdjustmentsTotal)}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">Total ingresos del turno:</span>
                        <p className="font-bold text-emerald-700 dark:text-emerald-400">
                          {formatMoney((closingIncomeSnapshot ?? currentSessionIncomeSummary).totalIncomes)}
                        </p>
                      </div>
                    </div>
                  )}

                  <CashCloseForm
                    canWrite={canWriteCaja}
                    disabled={isSubmitting}
                    expectedBalance={closingSummarySnapshot?.expectedBalance ?? currentSessionSummary.expectedBalance}
                    expectedCashBalance={closingSummarySnapshot?.expectedCashBalance ?? currentSessionSummary.expectedCashBalance}
                    expectedFullBalance={closingSummarySnapshot?.expectedFullBalance ?? currentSessionSummary.expectedFullBalance}
                    reconciliationMode={cashSettings.cash_reconciliation_mode ?? "cash_only"}
                    blindMode={cashSettings.blind_cash_closing ?? false}
                    initialNotes={closingSessionSnapshot?.notes ?? currentSession?.notes}
                    onUpdateNotes={updateSessionNotes}
                    onSubmit={async (values) => {
                      const res = await closeCash(values);
                      if (res) {
                        setIsCashClosed(true);
                        setActiveViewTab("history");
                      }
                      return res;
                    }}
                    onCancel={() => {
                      setIsCloseCashModalOpen(false);
                      setClosingSessionSnapshot(null);
                      setClosingSummarySnapshot(null);
                      setClosingIncomeSnapshot(null);
                      setIsCashClosed(false);
                    }}
                  />
                </>
              ) : (
                <div className="p-4 text-center text-xs text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 rounded-lg border border-rose-200 dark:border-rose-800/80">
                  No hay una caja abierta para cerrar.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Resumen de Ingresos / Egresos / Total Esperado */}
      {openSummaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md max-h-[88vh] flex flex-col bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            <header className="shrink-0 px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/70 dark:bg-slate-800/60">
              <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                {openSummaryModal === "incomes"
                  ? "Detalle de Ingresos del Turno"
                  : openSummaryModal === "expenses"
                    ? "Detalle de Egresos del Turno"
                    : "Fórmula de Saldo Teórico Esperado"}
              </h3>
              <ModalCloseButton onClick={() => setOpenSummaryModal(null)} />
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {dailySessionBreakdown ? (
                openSummaryModal === "incomes" ? (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Total Ingresos:</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">
                        {formatMoney(dailySessionBreakdown.incomes.total)}
                      </span>
                    </div>

                    {dailySessionBreakdown.incomes.items.length ? (
                      <div className="space-y-1.5 max-h-60 overflow-y-auto">
                        {dailySessionBreakdown.incomes.items.map((item) => (
                          <div
                            key={item.code}
                            className="flex items-center justify-between rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/60 px-3 py-2 text-xs"
                          >
                            <span className="text-slate-700 dark:text-slate-300 font-medium">{item.label}</span>
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {formatMoney(item.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">
                        No hay ingresos en esta sesión.
                      </p>
                    )}
                  </div>
                ) : openSummaryModal === "expenses" ? (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Total Egresos:</span>
                      <span className="font-bold text-rose-700 dark:text-rose-400">
                        {formatMoney(dailySessionBreakdown.expenses.total)}
                      </span>
                    </div>

                    {dailySessionBreakdown.expenses.items.length ? (
                      <div className="space-y-1.5 max-h-60 overflow-y-auto">
                        {dailySessionBreakdown.expenses.items.map((item) => (
                          <div
                            key={item.code}
                            className="flex items-center justify-between rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/60 px-3 py-2 text-xs"
                          >
                            <span className="text-slate-700 dark:text-slate-300 font-medium">{item.label}</span>
                            <span className="font-semibold text-rose-700 dark:text-rose-400">
                              -{formatMoney(item.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">
                        No hay egresos en esta sesión.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Cálculo de control para verificar el efectivo real que debe haber en el cajón físico:
                    </p>

                    {/* Arqueo Efectivo Físico */}
                    <div className="space-y-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 p-3.5 text-xs">
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>Fondo inicial de apertura:</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {formatMoney(dailySessionBreakdown.totalCash.openingAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                        <span>+ Cobros en efectivo (cajón):</span>
                        <span className="font-semibold">
                          +{formatMoney(dailySessionBreakdown.totalCash.incomes)}
                        </span>
                      </div>
                      <div className="flex justify-between text-rose-700 dark:text-rose-400">
                        <span>- Egresos en efectivo (cajón):</span>
                        <span className="font-semibold">
                          -{formatMoney(dailySessionBreakdown.totalCash.expenses)}
                        </span>
                      </div>
                      <div className="border-t border-slate-200 dark:border-slate-700 pt-2.5 flex justify-between text-xs font-bold text-slate-900 dark:text-slate-100">
                        <span>Efectivo en mano esperado:</span>
                        <span className="text-emerald-700 dark:text-emerald-400 text-sm">
                          {formatMoney(dailySessionBreakdown.totalCash.expectedBalance)}
                        </span>
                      </div>
                    </div>

                    {/* Cobros electrónicos / bancarios */}
                    {((dailySessionBreakdown?.incomes.total ?? 0) - dailySessionBreakdown.totalCash.incomes) > 0 && (
                      <div className="rounded-xl border border-blue-200/70 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 p-3 text-xs space-y-1.5">
                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>Cobros digitales / bancos (no ingresaron a la caja física):</span>
                          <span className="font-semibold text-blue-700 dark:text-blue-300">
                            +{formatMoney((dailySessionBreakdown.incomes.total ?? 0) - dailySessionBreakdown.totalCash.incomes)}
                          </span>
                        </div>
                        <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200 pt-1.5 border-t border-blue-200/60 dark:border-blue-900/50">
                          <span>Recaudación total consolidada (Efectivo + Bancos):</span>
                          <span className="text-slate-900 dark:text-white">
                            {formatMoney(dailySessionBreakdown.incomes.total)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">
                  No hay datos disponibles.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Cuenta Corriente */}
      {isCurrentAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-3xl max-h-[88vh] flex flex-col bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            <header className="shrink-0 px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/70 dark:bg-slate-800/60">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                  Resumen de Cuenta Corriente del Día
                </h3>
              </div>
              <ModalCloseButton onClick={() => setIsCurrentAccountModalOpen(false)} />
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Jornada analizada:{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {dailyDate ? new Date(`${dailyDate}T00:00:00`).toLocaleDateString("es-AR") : "-"}
                </span>
              </p>

              {currentAccountDailySummary ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                      <span className="text-[10px] uppercase font-medium text-slate-500 dark:text-slate-400">
                        Clientes con saldo
                      </span>
                      <p className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {currentAccountDailySummary.customersCount}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                      <span className="text-[10px] uppercase font-medium text-slate-500 dark:text-slate-400">
                        Débitos del día
                      </span>
                      <p className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {formatMoney(currentAccountDailySummary.totalDebitsAmount)}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                      <span className="text-[10px] uppercase font-medium text-slate-500 dark:text-slate-400">
                        Pagos del día
                      </span>
                      <p className="text-base font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                        {formatMoney(currentAccountDailySummary.totalPaymentsAmount)}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                      <span className="text-[10px] uppercase font-medium text-slate-500 dark:text-slate-400">
                        Saldo global CC
                      </span>
                      <p className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {formatMoney(currentAccountDailySummary.totalCurrentBalance)}
                      </p>
                    </div>
                  </div>

                  {currentAccountDailySummary.customers.length ? (
                    <div className="max-h-60 overflow-auto rounded-lg border border-slate-200/80 dark:border-slate-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-900 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                          <tr>
                            <th className="py-2 px-3">Cliente</th>
                            <th className="py-2 px-3 text-right">Débitos</th>
                            <th className="py-2 px-3 text-right">Pagos</th>
                            <th className="py-2 px-3 text-right">Neto día</th>
                            <th className="py-2 px-3 text-right">Saldo total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900/60">
                          {currentAccountDailySummary.customers.map((c) => (
                            <tr key={c.customerId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">
                                {c.customerName}
                              </td>
                              <td className="py-2 px-3 text-right font-medium text-slate-700 dark:text-slate-300">
                                {formatMoney(c.dailyDebitsAmount)}
                              </td>
                              <td className="py-2 px-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                                {formatMoney(c.dailyPaymentsAmount)}
                              </td>
                              <td className="py-2 px-3 text-right font-medium text-slate-800 dark:text-slate-200">
                                {formatMoney(c.dailyNetAmount)}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-slate-100">
                                {formatMoney(c.currentBalance)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200/70 dark:border-slate-800">
                      No hay registros de cuenta corriente para esta jornada.
                    </div>
                  )}
                </>
              ) : (
                <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200/70 dark:border-slate-800">
                  No hay datos disponibles para calcular el resumen de cuenta corriente.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Detalle de Caja Unificado (Arqueo de Cierre + Movimientos de la Jornada) */}
      {isDailyDetailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-5xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* 1. CABECERA: TÍTULO Y SELECTOR ADAPTATIVO DE TURNOS */}
            <header className="shrink-0 px-4 sm:px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 dark:bg-slate-800/60">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/80">
                  <CalendarClock className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Detalle de Caja</span>
                    <span className="text-xs font-normal text-slate-400">·</span>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {activeDetailDate ? formatLocalDateDisplay(activeDetailDate) : "-"}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Arqueo de cierre y registro completo de movimientos
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* SELECTOR ADAPTATIVO DE TURNOS */}
                {activeDateSessions.length > 1 && (
                  activeDateSessions.length <= 3 ? (
                    /* Si son 1 a 3 turnos: Pastillitas directas a un clic */
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-900/90 p-1 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => {
                          setDetailSessionId(null);
                          setIsBillsPopoverOpen(false);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          !detailSessionId
                            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                        }`}
                      >
                        Toda la jornada
                      </button>
                      {activeDateSessions.map((s, sIdx) => {
                        const sInfo = getShiftLabel(s.opened_at, sIdx);
                        const isSelected = detailSessionId === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setDetailSessionId(s.id);
                              setIsBillsPopoverOpen(false);
                            }}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                              isSelected
                                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                            }`}
                          >
                            <span>{sInfo.label}</span>
                            <span className="font-mono text-[10px] opacity-70">
                              ({formatLocalTime(s.opened_at)})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    /* Si son 4 o más turnos: Selector desplegable compacto flotante (Popover) */
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setIsShiftPopoverOpen(!isShiftPopoverOpen);
                          setIsBillsPopoverOpen(false);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs transition cursor-pointer"
                      >
                        <Clock size={13} className="text-blue-500" />
                        <span>
                          {detailSessionId
                            ? (() => {
                                const activeS = activeDateSessions.find((s) => s.id === detailSessionId);
                                return activeS
                                  ? `${getShiftLabel(activeS.opened_at).label} (${formatLocalTime(activeS.opened_at)})`
                                  : "Turno seleccionado";
                              })()
                            : `Toda la jornada (${activeDateSessions.length} turnos)`}
                        </span>
                        <ChevronDown size={13} className="text-slate-400" />
                      </button>

                      {isShiftPopoverOpen && (
                        <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-2 space-y-1 animate-in fade-in zoom-in-95">
                          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Seleccionar turno a auditar:
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setDetailSessionId(null);
                              setIsShiftPopoverOpen(false);
                              setIsBillsPopoverOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                              !detailSessionId
                                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                                : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            <span>Toda la jornada (Consolidado)</span>
                            <span className="text-[10px] opacity-75">
                              {getDailyMovements(activeDetailDate, "all").length} movs
                            </span>
                          </button>
                          {activeDateSessions.map((s, sIdx) => {
                            const sInfo = getShiftLabel(s.opened_at, sIdx);
                            const isSel = detailSessionId === s.id;
                            const shiftMovsCount = getSessionMovements(s.id).length;
                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                  setDetailSessionId(s.id);
                                  setIsShiftPopoverOpen(false);
                                  setIsBillsPopoverOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                                  isSel
                                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                                    : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                                }`}
                              >
                                <div>
                                  <p className="font-bold text-xs">{sInfo.label}</p>
                                  <p className="text-[10px] opacity-70 font-normal">
                                    {formatLocalTime(s.opened_at)} -{" "}
                                    {s.closed_at ? formatLocalTime(s.closed_at) : "En curso"} ·{" "}
                                    {usersById[s.opened_by_user_id] ?? "Cajero"}
                                  </p>
                                </div>
                                <span className="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-[10px]">
                                  {shiftMovsCount}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )
                )}

                <ModalCloseButton
                  onClick={() => {
                    setIsDailyDetailModalOpen(false);
                    setIsBillsPopoverOpen(false);
                    setIsShiftPopoverOpen(false);
                  }}
                />
              </div>
            </header>

            {/* 2. FRANJA SUPERIOR COMPACTA: RESUMEN DE CIERRE / ARQUEO Y POPOVER DE BILLETES */}
            {(() => {
              const activeModalSession = detailSessionId
                ? activeDateSessions.find((s) => s.id === detailSessionId) ?? null
                : activeDateSessions.find((s) => s.status === "closed") ??
                  activeDateSessions[activeDateSessions.length - 1] ??
                  null;

              const { snapshot: activeModalSnapshot, cleanNotes: activeModalNotes } = parseCloseSnapshot(
                activeModalSession?.notes
              );

              const modalRealAmount =
                activeModalSession?.closing_amount ?? activeModalSnapshot?.realAmount ?? 0;
              const modalExpectedAmount =
                activeModalSession?.expected_closing_amount ?? activeModalSnapshot?.expectedAmount ?? 0;
              const modalDifference =
                activeModalSession?.closing_difference ??
                activeModalSnapshot?.difference ??
                Number((modalRealAmount - modalExpectedAmount).toFixed(2));

              const billCounts =
                activeModalSnapshot?.billCounts ??
                (activeModalSession?.closing_bill_counts as Record<number, number> | undefined);
              const coinsAmount =
                activeModalSnapshot?.coinsAmount ?? activeModalSession?.closing_coins_amount ?? 0;
              const hasBillBreakdown =
                billCounts && Object.values(billCounts).some((c) => Number(c) > 0);

              const BILL_DENOMINATIONS = [20000, 10000, 2000, 1000, 500, 200, 100] as const;
              const totalBillsCounted = hasBillBreakdown
                ? BILL_DENOMINATIONS.reduce(
                    (acc, denom) => acc + denom * (Number(billCounts?.[denom]) || 0),
                    0
                  ) + coinsAmount
                : modalRealAmount;

              const openedByName = activeModalSession
                ? usersById[activeModalSession.opened_by_user_id] ?? activeModalSession.opened_by_user_id
                : "-";
              const closedByName = activeModalSession?.closed_by_user_id
                ? usersById[activeModalSession.closed_by_user_id] ?? activeModalSession.closed_by_user_id
                : null;

              return (
                <div className="relative shrink-0 px-4 sm:px-5 py-2.5 bg-slate-50/90 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        Esperado (Sistema)
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {formatMoney(modalExpectedAmount)}
                      </span>
                    </div>

                    <div className="pl-3 sm:pl-4 border-l border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        Real Contado
                      </span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        {activeModalSession?.status === "open" && !activeModalSession.closing_amount
                          ? "En curso"
                          : formatMoney(modalRealAmount)}
                      </span>
                    </div>

                    <div className="pl-3 sm:pl-4 border-l border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        Diferencia
                      </span>
                      <span
                        className={`font-mono font-black text-sm ${
                          modalDifference === 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : modalDifference > 0
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {modalDifference > 0
                          ? `+${formatMoney(modalDifference)} (Sobrante)`
                          : modalDifference < 0
                          ? `${formatMoney(modalDifference)} (Faltante)`
                          : "Exacta ($0,00)"}
                      </span>
                    </div>

                    {activeModalSession && (
                      <div className="hidden md:block pl-3 sm:pl-4 border-l border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>
                          Abierta por:{" "}
                          <strong className="text-slate-700 dark:text-slate-200">{openedByName}</strong>
                          <span className="font-mono text-[10px] opacity-75 ml-1">
                            ({formatLocalTime(activeModalSession.opened_at)})
                          </span>
                        </span>
                        {closedByName && (
                          <span>
                            {" "}· Cerrada por:{" "}
                            <strong className="text-slate-700 dark:text-slate-200">{closedByName}</strong>
                            <span className="font-mono text-[10px] opacity-75 ml-1">
                              ({formatLocalTime(activeModalSession.closed_at)})
                            </span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* BOTÓN Y PANEL FLOTANTE (POPOVER) DE BILLETES - NO EMPUJA LA TABLA */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setIsBillsPopoverOpen(!isBillsPopoverOpen);
                        setIsShiftPopoverOpen(false);
                      }}
                      className={`h-7 inline-flex items-center gap-1.5 px-3 text-xs font-bold rounded-lg border transition shadow-2xs cursor-pointer ${
                        isBillsPopoverOpen
                          ? "bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-500 dark:border-emerald-500"
                          : "bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60"
                      }`}
                      title="Ver conteo y desglose de billetes"
                    >
                      <Banknote size={14} />
                      <span>Conteo de billetes</span>
                      <ChevronDown
                        size={12}
                        className={`transition-transform duration-150 ${
                          isBillsPopoverOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {/* POPOVER FLOTANTE POR ENCIMA */}
                    {isBillsPopoverOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setIsBillsPopoverOpen(false)}
                        />
                        <div className="absolute left-0 top-full mt-2 z-50 w-80 max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-4 space-y-3 animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-slate-100">
                            <Banknote className="text-emerald-500" size={15} />
                            <span>Desglose Físico de Billetes</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsBillsPopoverOpen(false)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        </div>

                        {hasBillBreakdown ? (
                          <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden text-xs">
                            <table className="w-full">
                              <thead className="bg-slate-50/80 dark:bg-slate-800/80 text-[10px] uppercase font-bold text-slate-400">
                                <tr>
                                  <th className="py-1.5 px-2.5 text-left">Billetes</th>
                                  <th className="py-1.5 px-2 text-center">Cant.</th>
                                  <th className="py-1.5 px-2.5 text-right">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                {BILL_DENOMINATIONS.map((denom) => {
                                  const count = Number(billCounts?.[denom]) || 0;
                                  if (count === 0) return null;
                                  return (
                                    <tr key={denom}>
                                      <td className="py-1 px-2.5 font-semibold text-slate-700 dark:text-slate-300">
                                        ${denom.toLocaleString("es-AR")}
                                      </td>
                                      <td className="py-1 px-2 text-center font-mono text-slate-500">
                                        {count}
                                      </td>
                                      <td className="py-1 px-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                                        {formatMoney(count * denom)}
                                      </td>
                                    </tr>
                                  );
                                })}
                                {coinsAmount > 0 && (
                                  <tr>
                                    <td className="py-1 px-2.5 font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                      <Coins size={11} className="text-amber-500" />
                                      <span>Monedas</span>
                                    </td>
                                    <td className="py-1 px-2 text-center text-slate-400 font-mono">-</td>
                                    <td className="py-1 px-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                                      {formatMoney(coinsAmount)}
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                              <tfoot className="bg-slate-50/80 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 font-bold">
                                <tr>
                                  <td colSpan={2} className="py-1.5 px-2.5 text-slate-700 dark:text-slate-300">
                                    Total Contado:
                                  </td>
                                  <td className="py-1.5 px-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400">
                                    {formatMoney(totalBillsCounted)}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 py-3 text-center">
                            Cierre directo sin conteo desglosado de billetes.
                          </p>
                        )}

                        {activeModalNotes && (
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
                            <strong className="block text-slate-800 dark:text-slate-200">Observaciones:</strong>
                            <p className="mt-0.5 whitespace-pre-wrap">{activeModalNotes}</p>
                          </div>
                        )}
                      </div>
                    </>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* 3. TABLA DE MOVIMIENTOS EN EL RESTO DE LA PANTALLA */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoading && detailMovements.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  Cargando movimientos...
                </div>
              ) : (
                <CashMovementsTable
                  movements={detailMovements}
                  bankAccounts={bankAccounts}
                  saleBankAccountsById={saleBankAccountsById}
                  paymentMethods={paymentMethods}
                  usersById={usersById}
                  saleNumbersById={saleNumbersById}
                  salesById={salesById}
                  invoicesBySaleId={invoicesBySaleId}
                  onViewSaleDocument={handleViewSaleDocument}
                  blindMode={isBlindModeActive && activeDetailDate === dailyDate}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Comprobante / Ticket / Factura */}
      {isSaleDocumentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl max-h-[88vh] flex flex-col bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            <header className="shrink-0 px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/70 dark:bg-slate-800/60">
              <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100">Comprobante de Venta</h3>
              <ModalCloseButton
                onClick={() => {
                  setIsSaleDocumentModalOpen(false);
                  setIsSaleDocumentLoading(false);
                  setSaleDocumentError(null);
                  setSelectedReceipt(null);
                  setSelectedInvoice(null);
                }}
              />
            </header>

            <div className="flex-1 overflow-y-auto p-4">
              {isSaleDocumentLoading ? (
                <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  Cargando comprobante...
                </div>
              ) : saleDocumentError ? (
                <div className="p-4 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 rounded-lg border border-rose-200 dark:border-rose-800/80">
                  {saleDocumentError}
                </div>
              ) : selectedReceipt ? (
                <ReceiptTicketPanel
                  receipt={selectedReceipt}
                  invoice={selectedInvoice}
                  mode={saleDocumentInitialTab === "invoice" ? "invoice" : "both"}
                  onClose={() => {
                    setIsSaleDocumentModalOpen(false);
                    setSelectedReceipt(null);
                    setSelectedInvoice(null);
                  }}
                />
              ) : (
                <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">
                  No hay comprobante disponible.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Detalle de Cierre de Caja (Arqueo y Desglose de Billetes) */}
      <CashSessionCloseDetailModal
        isOpen={isCloseDetailModalOpen}
        session={selectedCloseSession}
        availableSessions={selectedCloseDateSessions}
        onClose={() => {
          setIsCloseDetailModalOpen(false);
          setSelectedCloseDateSessions([]);
        }}
        usersById={usersById}
      />
    </PagePlaceholder>
  );
};
