import { useEffect, useMemo, useState } from "react";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import {
  ArrowDownLeft,
  ArrowUpRight,
  DollarSign,
  Lock,
  LockOpen,
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
import { CashMovementForm } from "@/modules/caja/components/CashMovementForm";
import { CashMovementsTable } from "@/modules/caja/components/CashMovementsTable";
import { CashOpenForm } from "@/modules/caja/components/CashOpenForm";
import { CashSessionCloseDetailModal } from "@/modules/caja/components/CashSessionCloseDetailModal";
import { ReceiptTicketPanel } from "@/modules/comprobantes/components/ReceiptTicketPanel";
import { useCashModule } from "@/modules/caja/hooks/useCashModule";
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
  const [activeViewTab, setActiveViewTab] = useState<"shift" | "history">("shift");
  const [revealBlindAmounts, setRevealBlindAmounts] = useState(false);
  const [isCloseDetailModalOpen, setIsCloseDetailModalOpen] = useState(false);
  const [selectedCloseSession, setSelectedCloseSession] = useState<CashSession | null>(null);

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
    cashSettings,
    currentSessionSummary,
    currentSessionIncomeSummary,
    getSessionBreakdown,
    getCurrentAccountDailySummary,
    getDailyMovements,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload,
    openCash,
    closeCash,
    registerIncome,
    registerExpense,
  } = useCashModule(tenantId, user?.id ?? null);

  const handleOpenCloseDetailForDate = (date: string | null) => {
    if (!date) return;
    const sessionsOnDate = sessionHistory.filter((s) => s.opened_at.slice(0, 10) === date);
    const targetSession =
      sessionsOnDate.find((s) => s.status === "closed") ?? sessionsOnDate[0] ?? null;
    if (targetSession) {
      setSelectedCloseSession(targetSession);
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

  const dailyDate = dailySession?.opened_at.slice(0, 10) ?? null;
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
  const detailMovements = useMemo(
    () => getDailyMovements(activeDetailDate, "all"),
    [activeDetailDate, getDailyMovements]
  );
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
      await reload();
      setLastUpdatedAt(new Date().toISOString());
      setIsRefreshConfirmed(true);
    } finally {
      setIsRefreshing(false);
    }
  };

  const openDailyDetail = (date: string | null) => {
    if (!date) return;
    setDetailDate(date);
    setIsDailyDetailModalOpen(true);
  };

  const handleViewSaleDocument = async (saleId: string) => {
    if (!tenantId) return;

    setIsSaleDocumentModalOpen(true);
    setIsSaleDocumentLoading(true);
    setSaleDocumentError(null);
    setSelectedReceipt(null);
    setSelectedInvoice(null);

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
                onClick={() => setIsCloseCashModalOpen(true)}
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
              disabled={isLoading || isSubmitting || isRefreshing}
              title="Recargar caja diaria"
              className="h-10 w-10 inline-flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-300 dark:border-slate-700 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Feedback / Notifications */}
        {(isRefreshing || lastUpdatedAt || isRefreshConfirmed) && (
          <div className="flex items-center gap-1.5 text-xs px-1">
            {isRefreshing ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700 dark:border-slate-600 dark:border-t-slate-200" />
                <span className="text-slate-500 dark:text-slate-400">Actualizando datos de caja...</span>
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
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {isBlindModeActive
                    ? "Saldo protegido para arqueo ciego. Se revelará al confirmar el cierre de turno."
                    : "Monto que debe haber en el cajón de efectivo ahora mismo."}
                </p>
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
                      : `+${formatMoney(dailySessionBreakdown?.incomes.total ?? dailySessionTotals.incomes)}`}
                  </p>
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
                      : `-${formatMoney(dailySessionBreakdown?.expenses.total ?? dailySessionTotals.expenses)}`}
                  </p>
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
          isLoading ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <RefreshCw className="h-6 w-6 text-slate-400 animate-spin mx-auto mb-2" />
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Cargando historial de cajas diarias...</p>
            </div>
          ) : (
            <CashDailyTrackingTable
              rows={dailyTracking}
              onViewDetail={(date) => {
                openDailyDetail(date);
              }}
              onViewCloseDetail={(date) => {
                handleOpenCloseDetailForDate(date);
              }}
            />
          )
        )}
      </div>

      {/* MODAL: Movimiento Manual (con altura máxima y scroll para evitar desbordes) */}
      {isManualMovementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg max-h-[88vh] flex flex-col bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            <header className="shrink-0 px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/70 dark:bg-slate-800/60">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100">Movimiento Manual de Caja</h3>
              </div>
              <ModalCloseButton onClick={() => setIsManualMovementModalOpen(false)} />
            </header>

            {/* Selector de Pestañas Ingreso / Egreso */}
            <div className="shrink-0 px-4 pt-3 pb-1">
              <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setManualMovementTab("income")}
                  className={`h-7 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                    manualMovementTab === "income"
                      ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <span>+ Ingreso</span>
                  <kbd className="hidden sm:inline-block text-[10px] px-1 py-0.2 rounded font-mono font-medium opacity-60 border border-current">
                    F2
                  </kbd>
                </button>
                <button
                  type="button"
                  onClick={() => setManualMovementTab("expense")}
                  className={`h-7 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                    manualMovementTab === "expense"
                      ? "bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <span>- Retiro / Egreso</span>
                  <kbd className="hidden sm:inline-block text-[10px] px-1 py-0.2 rounded font-mono font-medium opacity-60 border border-current">
                    F2
                  </kbd>
                </button>
              </div>
            </div>

            {/* Contenido con scroll vertical seguro */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 pt-2">
              {manualMovementTab === "income" ? (
                <CashMovementForm
                  mode="income"
                  paymentMethods={paymentMethods}
                  bankAccounts={bankAccounts}
                  canWrite={canWriteCaja}
                  disabled={isSubmitting}
                  onSubmit={async (values) => {
                    await registerIncome(values);
                    setIsManualMovementModalOpen(false);
                  }}
                  onSuccess={() => setIsManualMovementModalOpen(false)}
                  onCancel={() => setIsManualMovementModalOpen(false)}
                  onToggleMode={(next) => setManualMovementTab(next)}
                />
              ) : (
                <CashMovementForm
                  mode="expense"
                  paymentMethods={paymentMethods}
                  bankAccounts={bankAccounts}
                  canWrite={canWriteCaja}
                  disabled={isSubmitting}
                  onSubmit={async (values) => {
                    await registerExpense(values);
                    setIsManualMovementModalOpen(false);
                  }}
                  onSuccess={() => setIsManualMovementModalOpen(false)}
                  onCancel={() => setIsManualMovementModalOpen(false)}
                  onToggleMode={(next) => setManualMovementTab(next)}
                />
              )}
            </div>
          </div>
        </div>
      )}

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
              <ModalCloseButton onClick={() => setIsCloseCashModalOpen(false)} />
            </header>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {currentSession ? (
                <>
                  {!cashSettings.blind_cash_closing && (
                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200/70 dark:border-slate-700">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">Cobros por venta:</span>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {formatMoney(currentSessionIncomeSummary.salePaymentsTotal)}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">Ingresos manuales:</span>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {formatMoney(currentSessionIncomeSummary.manualIncomesTotal)}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">Ajustes positivos:</span>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {formatMoney(currentSessionIncomeSummary.positiveAdjustmentsTotal)}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">Total ingresos del turno:</span>
                        <p className="font-bold text-emerald-700 dark:text-emerald-400">
                          {formatMoney(currentSessionIncomeSummary.totalIncomes)}
                        </p>
                      </div>
                    </div>
                  )}

                  <CashCloseForm
                    canWrite={canWriteCaja}
                    disabled={isSubmitting}
                    expectedBalance={currentSessionSummary.expectedBalance}
                    expectedCashBalance={currentSessionSummary.expectedCashBalance}
                    expectedFullBalance={currentSessionSummary.expectedFullBalance}
                    reconciliationMode={cashSettings.cash_reconciliation_mode ?? "cash_only"}
                    blindMode={cashSettings.blind_cash_closing ?? false}
                    onSubmit={async (values) => {
                      const res = await closeCash(values);
                      if (res) {
                        setActiveViewTab("history");
                      }
                      return res;
                    }}
                    onCancel={() => setIsCloseCashModalOpen(false)}
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
                  <div className="space-y-2.5">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Cálculo de control para verificar el efectivo real en caja:
                    </p>
                    <div className="space-y-2 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 p-3 text-xs">
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>Fondo de apertura:</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {formatMoney(dailySessionBreakdown.totalCash.openingAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                        <span>+ Total ingresos:</span>
                        <span className="font-semibold">
                          +{formatMoney(dailySessionBreakdown.totalCash.incomes)}
                        </span>
                      </div>
                      <div className="flex justify-between text-rose-700 dark:text-rose-400">
                        <span>- Total egresos:</span>
                        <span className="font-semibold">
                          -{formatMoney(dailySessionBreakdown.totalCash.expenses)}
                        </span>
                      </div>
                      <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between text-xs font-bold text-slate-900 dark:text-slate-100">
                        <span>Saldo esperado:</span>
                        <span className="text-emerald-700 dark:text-emerald-400">
                          {formatMoney(dailySessionBreakdown.totalCash.expectedBalance)}
                        </span>
                      </div>
                    </div>
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

      {/* MODAL: Detalle de Movimientos del Día */}
      {isDailyDetailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-5xl max-h-[88vh] flex flex-col bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            <header className="shrink-0 px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/70 dark:bg-slate-800/60">
              <div>
                <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                  Movimientos de la Jornada
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Fecha:{" "}
                  {activeDetailDate
                    ? new Date(`${activeDetailDate}T00:00:00`).toLocaleDateString("es-AR")
                    : "-"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenCloseDetailForDate(activeDetailDate)}
                  className="h-8 inline-flex items-center gap-1.5 px-3 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-800 rounded-lg transition-colors cursor-pointer shadow-2xs"
                  title="Ver detalle del arqueo y billetes de cierre"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>Detalle de cierre</span>
                </button>
                <ModalCloseButton onClick={() => setIsDailyDetailModalOpen(false)} />
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoading ? (
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
        onClose={() => setIsCloseDetailModalOpen(false)}
        usersById={usersById}
      />
    </PagePlaceholder>
  );
};
