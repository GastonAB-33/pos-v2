import { useEffect, useMemo, useState } from "react";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import {
  ArrowDownLeft,
  ArrowUpRight,
  DollarSign,
  Lock,
  RefreshCw,
  Users,
  CalendarClock,
  ArrowLeftRight,
  ListFilter,
  CheckCircle2,
  Clock,
  User as UserIcon,
} from "lucide-react";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { CashCloseForm } from "@/modules/caja/components/CashCloseForm";
import { CashDailyTrackingTable } from "@/modules/caja/components/CashDailyTrackingTable";
import { CashMovementForm } from "@/modules/caja/components/CashMovementForm";
import { CashMovementsTable } from "@/modules/caja/components/CashMovementsTable";
import { CashOpenForm } from "@/modules/caja/components/CashOpenForm";
import { ReceiptTicketPanel } from "@/modules/comprobantes/components/ReceiptTicketPanel";
import { useCashModule } from "@/modules/caja/hooks/useCashModule";
import { invoicesService } from "@/services/invoices.service";
import { receiptsService } from "@/services/receipts.service";
import type { Invoice, Receipt } from "@/types/entities";

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

  const {
    currentSession,
    sessionHistory,
    dailyTracking,
    paymentMethods,
    usersById,
    saleNumbersById,
    cashSettings,
    currentSessionSummary,
    currentSessionIncomeSummary,
    getSessionBreakdown,
    getCurrentAccountDailySummary,
    getDailyMovements,
    movementTypeFilter,
    setMovementTypeFilter,
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
    () => getDailyMovements(activeDetailDate, movementTypeFilter),
    [activeDetailDate, getDailyMovements, movementTypeFilter]
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
    setMovementTypeFilter("all");
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
      <div className="caja-daily-workspace space-y-3">
        {/* Toolbar & Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            {/* Status Badge */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                currentSession
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                  : "bg-slate-100 text-slate-600 border-slate-200/70"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  currentSession ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                }`}
              />
              {currentSession ? "Caja abierta" : "Sin caja abierta"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsCurrentAccountModalOpen(true)}
              disabled={isSubmitting || !dailySession}
              className="h-8 inline-flex items-center gap-1.5 px-3 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors shadow-xs disabled:opacity-50"
            >
              <Users className="h-3.5 w-3.5 text-slate-400" />
              Cuenta corriente
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
              className="h-8 inline-flex items-center gap-1.5 px-3 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs disabled:opacity-50"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Movimiento manual
            </button>

            {currentSession && canWriteCaja && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsCloseCashModalOpen(true)}
                className="h-8 inline-flex items-center gap-1.5 px-3 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-lg transition-colors shadow-xs disabled:opacity-50"
              >
                <Lock className="h-3.5 w-3.5" />
                Cerrar caja
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                void handleRefresh();
              }}
              disabled={isLoading || isSubmitting || isRefreshing}
              title="Recargar caja diaria"
              className="h-8 w-8 inline-flex items-center justify-center text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Feedback / Notifications */}
        {(isRefreshing || lastUpdatedAt || isRefreshConfirmed) && (
          <div className="flex items-center gap-1.5 text-xs px-1">
            {isRefreshing ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                <span className="text-slate-500">Actualizando datos de caja...</span>
              </>
            ) : (
              <span className={`inline-flex items-center gap-1 ${isRefreshConfirmed ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                {isRefreshConfirmed ? "Caja actualizada correctamente." : "Caja actualizada."}
                {lastUpdatedAt ? ` ${new Date(lastUpdatedAt).toLocaleTimeString("es-AR")}` : ""}
              </span>
            )}
          </div>
        )}

        {feedback && (
          <div
            className={`p-3 rounded-xl border text-xs font-medium ${
              feedback.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200/80"
                : "bg-rose-50 text-rose-800 border-rose-200/80"
            }`}
          >
            {feedback.message}
          </div>
        )}

        {/* Formulario de Apertura si no hay sesión abierta */}
        {!currentSession && (
          <CashOpenForm
            canWrite={canWriteCaja}
            disabled={isSubmitting}
            defaultOpeningAmount={cashSettings.default_opening_amount}
            onSubmit={openCash}
          />
        )}

        {/* KPI Cards: Estilo idéntico a Caja General */}
        {dailySession ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* Card 1: Saldo Esperado */}
              <article className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs hover:border-slate-300 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                    Saldo Esperado
                  </span>
                  <div className="p-1 rounded-md bg-emerald-50 text-emerald-600">
                    <DollarSign className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-1 text-xl font-bold tracking-tight text-emerald-700">
                  {formatMoney(dailySessionTotals.expectedBalance)}
                </p>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[11px] text-slate-400">Efectivo teórico calculado</span>
                  <button
                    type="button"
                    onClick={() => setOpenSummaryModal("total")}
                    className="text-[11px] font-medium text-slate-500 hover:text-slate-900 underline underline-offset-2"
                  >
                    Ver fórmula
                  </button>
                </div>
              </article>

              {/* Card 2: Ingresos del turno */}
              <article className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs hover:border-slate-300 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                    Ingresos del Turno
                  </span>
                  <div className="p-1 rounded-md bg-blue-50 text-blue-600">
                    <ArrowDownLeft className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                  +{formatMoney(dailySessionTotals.incomes)}
                </p>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[11px] text-slate-400">Ventas + manuales</span>
                  <button
                    type="button"
                    onClick={() => setOpenSummaryModal("incomes")}
                    className="text-[11px] font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2"
                  >
                    Ver desglose
                  </button>
                </div>
              </article>

              {/* Card 3: Egresos del turno */}
              <article className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs hover:border-slate-300 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                    Egresos del Turno
                  </span>
                  <div className="p-1 rounded-md bg-rose-50 text-rose-600">
                    <ArrowUpRight className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-1 text-xl font-bold tracking-tight text-rose-700">
                  -{formatMoney(dailySessionTotals.expenses)}
                </p>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[11px] text-slate-400">Retiros, gastos y fletes</span>
                  <button
                    type="button"
                    onClick={() => setOpenSummaryModal("expenses")}
                    className="text-[11px] font-medium text-rose-600 hover:text-rose-800 underline underline-offset-2"
                  >
                    Ver desglose
                  </button>
                </div>
              </article>

              {/* Card 4: Fondo Inicial y Estado */}
              <article className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs hover:border-slate-300 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                    Fondo de Apertura
                  </span>
                  <div className="p-1 rounded-md bg-amber-50 text-amber-600">
                    <CalendarClock className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                  {formatMoney(dailySession.opening_amount)}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                  {dailySession.status === "open" ? "Turno en curso" : "Turno cerrado"} · {dailySessionResponsible}
                </p>
              </article>
            </div>

            {/* Barra de Auditoría de Sesión */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-xs">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <div className="flex items-center gap-1.5 text-slate-700">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-slate-500">Apertura:</span>
                  <span className="font-semibold text-slate-900">
                    {formatDateTime(dailySession.opened_at)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-slate-700">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-slate-500">Cierre:</span>
                  <span className="font-semibold text-slate-900">
                    {dailySession.closed_at ? formatDateTime(dailySession.closed_at) : "En curso"}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-slate-700">
                  <UserIcon className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-slate-500">Responsable:</span>
                  <span className="font-semibold text-slate-900">{dailySessionResponsible}</span>
                </div>

                {dailySession.closing_amount != null && (
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <span className="text-slate-500">Monto real arqueado:</span>
                    <span className="font-bold text-slate-900">
                      {formatMoney(dailySession.closing_amount)}
                    </span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => openDailyDetail(dailyDate)}
                className="h-7 inline-flex items-center gap-1.5 px-3 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors shadow-xs"
              >
                <ListFilter className="h-3.5 w-3.5 text-slate-400" />
                Ver movimientos del turno
              </button>
            </div>
          </>
        ) : null}

        {/* Tabla del Historial de Cajas Diarias */}
        {isLoading ? (
          <div className="p-8 text-center bg-white rounded-xl border border-slate-200/80 shadow-xs">
            <RefreshCw className="h-6 w-6 text-slate-400 animate-spin mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-700">Cargando historial de cajas diarias...</p>
          </div>
        ) : (
          <CashDailyTrackingTable
            rows={dailyTracking}
            onViewDetail={(date) => {
              openDailyDetail(date);
            }}
          />
        )}
      </div>

      {/* MODAL: Movimiento Manual (con altura máxima y scroll para evitar desbordes) */}
      {isManualMovementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg max-h-[88vh] flex flex-col bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden">
            <header className="shrink-0 px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-slate-500" />
                <h3 className="text-xs font-semibold text-slate-800">Movimiento Manual de Caja</h3>
              </div>
              <ModalCloseButton onClick={() => setIsManualMovementModalOpen(false)} />
            </header>

            {/* Selector de Pestañas Ingreso / Egreso */}
            <div className="shrink-0 px-4 pt-3 pb-1">
              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setManualMovementTab("income")}
                  className={`h-7 text-xs font-semibold rounded-md transition-colors ${
                    manualMovementTab === "income"
                      ? "bg-white text-emerald-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  + Ingreso
                </button>
                <button
                  type="button"
                  onClick={() => setManualMovementTab("expense")}
                  className={`h-7 text-xs font-semibold rounded-md transition-colors ${
                    manualMovementTab === "expense"
                      ? "bg-white text-rose-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  - Retiro / Egreso
                </button>
              </div>
            </div>

            {/* Contenido con scroll vertical seguro */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 pt-2">
              {manualMovementTab === "income" ? (
                <CashMovementForm
                  mode="income"
                  paymentMethods={paymentMethods}
                  canWrite={canWriteCaja}
                  disabled={isSubmitting}
                  onSubmit={async (values) => {
                    await registerIncome(values);
                    setIsManualMovementModalOpen(false);
                  }}
                  onSuccess={() => setIsManualMovementModalOpen(false)}
                />
              ) : (
                <CashMovementForm
                  mode="expense"
                  canWrite={canWriteCaja}
                  disabled={isSubmitting}
                  onSubmit={async (values) => {
                    await registerExpense(values);
                    setIsManualMovementModalOpen(false);
                  }}
                  onSuccess={() => setIsManualMovementModalOpen(false)}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Cierre de Caja */}
      {isCloseCashModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl max-h-[88vh] flex flex-col bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden">
            <header className="shrink-0 px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-slate-500" />
                <h3 className="text-xs font-semibold text-slate-800">Cierre de Caja y Arqueo de Turno</h3>
              </div>
              <ModalCloseButton onClick={() => setIsCloseCashModalOpen(false)} />
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {currentSession ? (
                <>
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200/70">
                    <div>
                      <span className="text-slate-500 text-[11px]">Cobros por venta:</span>
                      <p className="font-semibold text-slate-900">
                        {formatMoney(currentSessionIncomeSummary.salePaymentsTotal)}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[11px]">Ingresos manuales:</span>
                      <p className="font-semibold text-slate-900">
                        {formatMoney(currentSessionIncomeSummary.manualIncomesTotal)}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[11px]">Ajustes positivos:</span>
                      <p className="font-semibold text-slate-900">
                        {formatMoney(currentSessionIncomeSummary.positiveAdjustmentsTotal)}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[11px]">Total ingresos del turno:</span>
                      <p className="font-bold text-emerald-700">
                        {formatMoney(currentSessionIncomeSummary.totalIncomes)}
                      </p>
                    </div>
                  </div>

                  <CashCloseForm
                    canWrite={canWriteCaja}
                    disabled={isSubmitting}
                    expectedBalance={currentSessionSummary.expectedBalance}
                    onSubmit={closeCash}
                    onCancel={() => setIsCloseCashModalOpen(false)}
                  />
                </>
              ) : (
                <div className="p-4 text-center text-xs text-rose-600 bg-rose-50 rounded-lg border border-rose-200">
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
          <div className="w-full max-w-md max-h-[88vh] flex flex-col bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden">
            <header className="shrink-0 px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
              <h3 className="text-xs font-semibold text-slate-800">
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
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100 text-xs">
                      <span className="text-slate-500">Total Ingresos:</span>
                      <span className="font-bold text-emerald-700">
                        {formatMoney(dailySessionBreakdown.incomes.total)}
                      </span>
                    </div>

                    {dailySessionBreakdown.incomes.items.length ? (
                      <div className="space-y-1.5 max-h-60 overflow-y-auto">
                        {dailySessionBreakdown.incomes.items.map((item) => (
                          <div
                            key={item.code}
                            className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-slate-50/60 px-3 py-2 text-xs"
                          >
                            <span className="text-slate-700">{item.label}</span>
                            <span className="font-semibold text-slate-900">
                              {formatMoney(item.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 text-center py-4">
                        No hay ingresos en esta sesión.
                      </p>
                    )}
                  </div>
                ) : openSummaryModal === "expenses" ? (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100 text-xs">
                      <span className="text-slate-500">Total Egresos:</span>
                      <span className="font-bold text-rose-700">
                        {formatMoney(dailySessionBreakdown.expenses.total)}
                      </span>
                    </div>

                    {dailySessionBreakdown.expenses.items.length ? (
                      <div className="space-y-1.5 max-h-60 overflow-y-auto">
                        {dailySessionBreakdown.expenses.items.map((item) => (
                          <div
                            key={item.code}
                            className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-slate-50/60 px-3 py-2 text-xs"
                          >
                            <span className="text-slate-700">{item.label}</span>
                            <span className="font-semibold text-rose-700">
                              -{formatMoney(item.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 text-center py-4">
                        No hay egresos en esta sesión.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <p className="text-xs text-slate-500">
                      Cálculo de control para verificar el efectivo real en caja:
                    </p>
                    <div className="space-y-2 rounded-lg border border-slate-200/80 bg-slate-50/70 p-3 text-xs">
                      <div className="flex justify-between text-slate-700">
                        <span>Fondo de apertura:</span>
                        <span className="font-semibold text-slate-900">
                          {formatMoney(dailySessionBreakdown.totalCash.openingAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between text-emerald-700">
                        <span>+ Total ingresos:</span>
                        <span className="font-semibold">
                          +{formatMoney(dailySessionBreakdown.totalCash.incomes)}
                        </span>
                      </div>
                      <div className="flex justify-between text-rose-700">
                        <span>- Total egresos:</span>
                        <span className="font-semibold">
                          -{formatMoney(dailySessionBreakdown.totalCash.expenses)}
                        </span>
                      </div>
                      <div className="border-t border-slate-200 pt-2 flex justify-between text-xs font-bold text-slate-900">
                        <span>Saldo esperado:</span>
                        <span className="text-emerald-700">
                          {formatMoney(dailySessionBreakdown.totalCash.expectedBalance)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <p className="text-xs text-slate-400 text-center py-4">
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
          <div className="w-full max-w-3xl max-h-[88vh] flex flex-col bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden">
            <header className="shrink-0 px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-500" />
                <h3 className="text-xs font-semibold text-slate-800">
                  Resumen de Cuenta Corriente del Día
                </h3>
              </div>
              <ModalCloseButton onClick={() => setIsCurrentAccountModalOpen(false)} />
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <p className="text-xs text-slate-500">
                Jornada analizada:{" "}
                <span className="font-semibold text-slate-800">
                  {dailyDate ? new Date(`${dailyDate}T00:00:00`).toLocaleDateString("es-AR") : "-"}
                </span>
              </p>

              {currentAccountDailySummary ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-2.5 rounded-lg border border-slate-200/80 bg-slate-50">
                      <span className="text-[10px] uppercase font-medium text-slate-500">
                        Clientes con saldo
                      </span>
                      <p className="text-base font-bold text-slate-900 mt-0.5">
                        {currentAccountDailySummary.customersCount}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-200/80 bg-slate-50">
                      <span className="text-[10px] uppercase font-medium text-slate-500">
                        Débitos del día
                      </span>
                      <p className="text-base font-bold text-slate-900 mt-0.5">
                        {formatMoney(currentAccountDailySummary.totalDebitsAmount)}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-200/80 bg-slate-50">
                      <span className="text-[10px] uppercase font-medium text-slate-500">
                        Pagos del día
                      </span>
                      <p className="text-base font-bold text-emerald-700 mt-0.5">
                        {formatMoney(currentAccountDailySummary.totalPaymentsAmount)}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-200/80 bg-slate-50">
                      <span className="text-[10px] uppercase font-medium text-slate-500">
                        Saldo global CC
                      </span>
                      <p className="text-base font-bold text-slate-900 mt-0.5">
                        {formatMoney(currentAccountDailySummary.totalCurrentBalance)}
                      </p>
                    </div>
                  </div>

                  {currentAccountDailySummary.customers.length ? (
                    <div className="max-h-60 overflow-auto rounded-lg border border-slate-200/80">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                          <tr>
                            <th className="py-2 px-3">Cliente</th>
                            <th className="py-2 px-3 text-right">Débitos</th>
                            <th className="py-2 px-3 text-right">Pagos</th>
                            <th className="py-2 px-3 text-right">Neto día</th>
                            <th className="py-2 px-3 text-right">Saldo total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {currentAccountDailySummary.customers.map((c) => (
                            <tr key={c.customerId} className="hover:bg-slate-50/70">
                              <td className="py-2 px-3 font-medium text-slate-800">
                                {c.customerName}
                              </td>
                              <td className="py-2 px-3 text-right font-medium text-slate-700">
                                {formatMoney(c.dailyDebitsAmount)}
                              </td>
                              <td className="py-2 px-3 text-right font-medium text-emerald-600">
                                {formatMoney(c.dailyPaymentsAmount)}
                              </td>
                              <td className="py-2 px-3 text-right font-medium text-slate-800">
                                {formatMoney(c.dailyNetAmount)}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-slate-900">
                                {formatMoney(c.currentBalance)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-slate-200/70">
                      No hay registros de cuenta corriente para esta jornada.
                    </div>
                  )}
                </>
              ) : (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-slate-200/70">
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
          <div className="w-full max-w-5xl max-h-[88vh] flex flex-col bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden">
            <header className="shrink-0 px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
              <div>
                <h3 className="text-xs font-semibold text-slate-800">
                  Movimientos de la Jornada
                </h3>
                <p className="text-[11px] text-slate-400">
                  Fecha:{" "}
                  {activeDetailDate
                    ? new Date(`${activeDetailDate}T00:00:00`).toLocaleDateString("es-AR")
                    : "-"}
                </p>
              </div>
              <ModalCloseButton onClick={() => setIsDailyDetailModalOpen(false)} />
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="flex items-center gap-2">
                <select
                  value={movementTypeFilter}
                  onChange={(event) =>
                    setMovementTypeFilter(event.target.value as typeof movementTypeFilter)
                  }
                  className="h-8 text-xs border border-slate-200 rounded-lg px-2.5 bg-slate-50/70 text-slate-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-slate-900 transition-colors"
                >
                  <option value="all">Todos los movimientos</option>
                  <option value="sale_payment">Solo Cobros de Venta</option>
                  <option value="income">Solo Ingresos Manuales</option>
                  <option value="expense">Solo Egresos / Retiros</option>
                  <option value="adjustment">Solo Ajustes</option>
                </select>
                <span className="text-[11px] text-slate-400">
                  {detailMovements.length} movimientos
                </span>
              </div>

              {isLoading ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Cargando movimientos...
                </div>
              ) : (
                <CashMovementsTable
                  movements={detailMovements}
                  usersById={usersById}
                  saleNumbersById={saleNumbersById}
                  onViewSaleDocument={handleViewSaleDocument}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Comprobante / Ticket / Factura */}
      {isSaleDocumentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl max-h-[88vh] flex flex-col bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden">
            <header className="shrink-0 px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
              <h3 className="text-xs font-semibold text-slate-800">Comprobante de Venta</h3>
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
                <div className="p-8 text-center text-xs text-slate-500">
                  Cargando comprobante...
                </div>
              ) : saleDocumentError ? (
                <div className="p-4 text-xs text-rose-700 bg-rose-50 rounded-lg border border-rose-200">
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
                <div className="p-8 text-center text-xs text-slate-400">
                  No hay comprobante disponible.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PagePlaceholder>
  );
};
