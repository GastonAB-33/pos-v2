import { useEffect, useMemo, useState } from "react";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
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

interface CashMetricCardProps {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "danger" | "accent";
  actionLabel?: string;
  onAction?: () => void;
  disabled?: boolean;
}

const toneClasses: Record<NonNullable<CashMetricCardProps["tone"]>, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  accent: "border-sky-200 bg-sky-50 text-sky-700",
};

const CashMetricCard = ({
  label,
  value,
  tone = "neutral",
  actionLabel,
  onAction,
  disabled,
}: CashMetricCardProps) => (
  <article className={`cash-metric-card cash-metric-card--${tone} rounded-xl border px-3 py-2.5 ${toneClasses[tone]}`}>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
        <p className="mt-1 truncate font-kpi text-lg font-semibold">{value}</p>
      </div>
      {actionLabel && onAction ? (
        <button
          type="button"
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
          disabled={disabled}
          onClick={onAction}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  </article>
);

export const CajaPage = () => {
  const { tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);
  const { canRead, canWrite } = usePermissions();
  const canReadCaja = canRead("caja");
  const canWriteCaja = canWrite("caja");

  const [isManualMovementModalOpen, setIsManualMovementModalOpen] = useState(false);
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
        setSaleDocumentError("No se encontro ticket para esta venta.");
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
    return <PagePlaceholder title="Caja" description="No hay tenant activo para operar el modulo" />;
  }

  if (!canReadCaja) {
    return <PagePlaceholder title="Caja" description="No tenes permisos de lectura para este modulo" />;
  }

  return (
    <PagePlaceholder title="Caja" description="Control diario y cierre de caja">
      <div className="space-y-4">
        <section className="workspace-toolbar workspace-toolbar--inline">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="workspace-meta">
              <span className={currentSession ? "ui-badge ui-badge--success" : "ui-badge ui-badge--warn"}>
                {currentSession ? "Caja abierta" : "Sin caja abierta"}
              </span>
              <span className="ui-badge ui-badge--info">
                {cashSettings.require_open_session_for_sale ? "Venta exige caja" : "Venta con caja opcional"}
              </span>
              {cashSettings.allow_manual_movements ? (
                <span className="ui-badge">Manual habilitado</span>
              ) : (
                <span className="ui-badge ui-badge--danger">Manual bloqueado</span>
              )}
              {cashSettings.require_notes_on_manual_movements ? (
                <span className="ui-badge ui-badge--warn">Observacion obligatoria</span>
              ) : null}
            </div>

            <div className="workspace-toolbar__actions">
              <button
                type="button"
                className="ui-btn-ghost"
                disabled={isSubmitting || !dailySession}
                onClick={() => setIsCurrentAccountModalOpen(true)}
              >
                Cuenta corriente
              </button>
              <button
                type="button"
                className="ui-btn-primary"
                disabled={
                  isSubmitting || !canWriteCaja || !currentSession || !cashSettings.allow_manual_movements
                }
                onClick={() => setIsManualMovementModalOpen(true)}
              >
                Movimiento manual
              </button>
              <button
                type="button"
                className="cash-close-action"
                disabled={isSubmitting || !canWriteCaja || !currentSession}
                onClick={() => setIsCloseCashModalOpen(true)}
              >
                Cerrar caja
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleRefresh();
                }}
                className="ui-btn-ghost"
                disabled={isLoading || isSubmitting || isRefreshing}
              >
                {isRefreshing ? "Actualizando..." : "Actualizar"}
              </button>
            </div>
          </div>
        </section>
        {(isRefreshing || lastUpdatedAt || isRefreshConfirmed) && (
          <div className="flex items-center gap-2 text-xs">
            {isRefreshing ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                <span className="text-slate-500">Actualizando caja...</span>
              </>
            ) : (
              <span className={isRefreshConfirmed ? "text-emerald-600" : "text-slate-500"}>
                {isRefreshConfirmed ? "Caja actualizada correctamente." : "Caja actualizada."}
                {lastUpdatedAt ? ` ${new Date(lastUpdatedAt).toLocaleTimeString("es-AR")}` : ""}
              </span>
            )}
          </div>
        )}

        {feedback ? (
          <div className={feedback.type === "success" ? "ui-success-state" : "ui-error-state"}>{feedback.message}</div>
        ) : null}

        {!currentSession ? (
          <CashOpenForm
            canWrite={canWriteCaja}
            disabled={isSubmitting}
            defaultOpeningAmount={cashSettings.default_opening_amount}
            onSubmit={openCash}
          />
        ) : null}

        <section className="cash-daily-workspace space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-slate-900">Caja diaria</h2>
              <p className="text-sm text-slate-600">
                Resumen operativo de la caja seleccionada, ordenado para controlar apertura, cobros, egresos y cierre.
              </p>
            </div>
            {dailySession ? (
              <span className={dailySession.status === "open" ? "ui-badge ui-badge--success" : "ui-badge"}>
                {dailySession.status === "open" ? "En curso" : "Cerrada"}
              </span>
            ) : null}
          </div>

          {dailySession ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <CashMetricCard
                  label="Apertura"
                  value={new Date(dailySession.opened_at).toLocaleString("es-AR")}
                />
                <CashMetricCard
                  label="Cierre"
                  value={
                    dailySession.closed_at
                      ? new Date(dailySession.closed_at).toLocaleString("es-AR")
                      : "Pendiente"
                  }
                />
                <CashMetricCard label="Monto apertura" value={currency.format(dailySession.opening_amount)} />
                <CashMetricCard
                  label="Monto cierre"
                  value={dailySession.closing_amount != null ? currency.format(dailySession.closing_amount) : "Pendiente"}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <CashMetricCard
                  label="Ingresos"
                  value={currency.format(dailySessionTotals.incomes)}
                  tone="success"
                  actionLabel="Ver"
                  onAction={() => setOpenSummaryModal("incomes")}
                />
                <CashMetricCard
                  label="Egresos"
                  value={currency.format(dailySessionTotals.expenses)}
                  tone="danger"
                  actionLabel="Ver"
                  onAction={() => setOpenSummaryModal("expenses")}
                />
                <CashMetricCard
                  label="Caja esperada"
                  value={currency.format(dailySessionTotals.expectedBalance)}
                  tone="accent"
                  actionLabel="Ver"
                  onAction={() => setOpenSummaryModal("total")}
                />
                <CashMetricCard label="Responsable" value={dailySessionResponsible} />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  Sesion {dailySession.status === "open" ? "abierta" : "cerrada"} | ID {dailySession.id}
                </p>
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
                  disabled={isSubmitting}
                  onClick={() => {
                    openDailyDetail(dailyDate);
                  }}
                >
                  Ver detalle de la caja diaria
                </button>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              No hay sesiones de caja para mostrar.
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">Historial de cajas diarias</h2>
            <p className="text-sm text-slate-600">
              Resumen por fecha con acceso al detalle de movimientos del dia.
            </p>
          </div>

          {isLoading ? (
            <div className="rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-600">
              Cargando historial diario...
            </div>
          ) : (
            <CashDailyTrackingTable
              rows={dailyTracking}
              onViewDetail={(date) => {
                openDailyDetail(date);
              }}
            />
          )}
        </section>
      </div>

      {isManualMovementModalOpen ? (
        <section className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4">
          <button
            type="button"
            aria-label="Cerrar modal de movimiento manual"
            className="absolute inset-0"
            onClick={() => setIsManualMovementModalOpen(false)}
          />
          <div className="relative z-10 max-h-[92vh] w-full max-w-5xl space-y-3 overflow-auto rounded-2xl bg-white p-4 shadow-panel">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-900">Movimiento manual</h3>
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                onClick={() => setIsManualMovementModalOpen(false)}
              >
                Cerrar
              </button>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">Ingreso</p>
                <CashMovementForm
                  mode="income"
                  paymentMethods={paymentMethods}
                  canWrite={canWriteCaja}
                  disabled={isSubmitting}
                  onSubmit={async (values) => {
                    await registerIncome(values);
                  }}
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">Egreso</p>
                <CashMovementForm
                  mode="expense"
                  canWrite={canWriteCaja}
                  disabled={isSubmitting}
                  onSubmit={async (values) => {
                    await registerExpense(values);
                  }}
                />
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {isCloseCashModalOpen ? (
        <section className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4">
          <button
            type="button"
            aria-label="Cerrar modal de cierre de caja"
            className="absolute inset-0"
            onClick={() => setIsCloseCashModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-2xl space-y-3 rounded-2xl bg-white p-4 shadow-panel">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-900">Cierre de caja</h3>
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                onClick={() => setIsCloseCashModalOpen(false)}
              >
                Cerrar
              </button>
            </div>

            {currentSession ? (
              <>
                <section className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
                  <p className="text-sm text-slate-700">
                    Cobros por venta:{" "}
                    <span className="font-semibold text-slate-900">
                      {currency.format(currentSessionIncomeSummary.salePaymentsTotal)}
                    </span>
                  </p>
                  <p className="text-sm text-slate-700">
                    Ingresos manuales:{" "}
                    <span className="font-semibold text-slate-900">
                      {currency.format(currentSessionIncomeSummary.manualIncomesTotal)}
                    </span>
                  </p>
                  <p className="text-sm text-slate-700">
                    Ajustes positivos:{" "}
                    <span className="font-semibold text-slate-900">
                      {currency.format(currentSessionIncomeSummary.positiveAdjustmentsTotal)}
                    </span>
                  </p>
                  <p className="text-sm text-slate-700">
                    Total ingresos:{" "}
                    <span className="font-semibold text-slate-900">
                      {currency.format(currentSessionIncomeSummary.totalIncomes)}
                    </span>
                  </p>
                  <p className="text-sm text-slate-700 md:col-span-2">
                    Total caja esperado:{" "}
                    <span className="font-semibold text-slate-900">
                      {currency.format(currentSessionIncomeSummary.totalCash)}
                    </span>
                  </p>
                </section>

                <CashCloseForm
                  canWrite={canWriteCaja}
                  disabled={isSubmitting}
                  expectedBalance={currentSessionSummary.expectedBalance}
                  onSubmit={closeCash}
                />
              </>
            ) : (
              <div className="ui-error-state">No hay una caja abierta para cerrar.</div>
            )}
          </div>
        </section>
      ) : null}

      {openSummaryModal ? (
        <section className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4">
          <button
            type="button"
            aria-label="Cerrar modal de resumen de caja"
            className="absolute inset-0"
            onClick={() => setOpenSummaryModal(null)}
          />
          <div className="relative z-10 w-full max-w-2xl space-y-3 rounded-2xl bg-white p-4 shadow-panel">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-900">
                {openSummaryModal === "incomes"
                  ? "Detalle de ingresos"
                  : openSummaryModal === "expenses"
                    ? "Detalle de egresos"
                    : "Detalle del total de caja"}
              </h3>
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                onClick={() => setOpenSummaryModal(null)}
              >
                Cerrar
              </button>
            </div>

            {dailySessionBreakdown ? (
              openSummaryModal === "incomes" ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    Ingresos totales:{" "}
                    <span className="font-semibold text-slate-900">
                      {currency.format(dailySessionBreakdown.incomes.total)}
                    </span>
                  </p>
                  {dailySessionBreakdown.incomes.items.length ? (
                    <div className="space-y-2">
                      {dailySessionBreakdown.incomes.items.map((item) => (
                        <article
                          key={item.code}
                          className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                        >
                          <p className="text-sm text-slate-700">{item.label}</p>
                          <p className="text-sm font-semibold text-slate-900">
                            {currency.format(item.amount)}
                          </p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                      No hay ingresos para esta caja diaria.
                    </div>
                  )}
                </div>
              ) : openSummaryModal === "expenses" ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    Egresos totales:{" "}
                    <span className="font-semibold text-slate-900">
                      {currency.format(dailySessionBreakdown.expenses.total)}
                    </span>
                  </p>
                  {dailySessionBreakdown.expenses.items.length ? (
                    <div className="space-y-2">
                      {dailySessionBreakdown.expenses.items.map((item) => (
                        <article
                          key={item.code}
                          className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                        >
                          <p className="text-sm text-slate-700">{item.label}</p>
                          <p className="text-sm font-semibold text-slate-900">
                            {currency.format(item.amount)}
                          </p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                      No hay egresos para esta caja diaria.
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    Formula del total de caja esperado para la sesion diaria.
                  </p>
                  <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm text-slate-700">
                      Monto apertura:{" "}
                      <span className="font-semibold text-slate-900">
                        {currency.format(dailySessionBreakdown.totalCash.openingAmount)}
                      </span>
                    </p>
                    <p className="text-sm text-slate-700">
                      + Ingresos:{" "}
                      <span className="font-semibold text-slate-900">
                        {currency.format(dailySessionBreakdown.totalCash.incomes)}
                      </span>
                    </p>
                    <p className="text-sm text-slate-700">
                      - Egresos:{" "}
                      <span className="font-semibold text-slate-900">
                        {currency.format(dailySessionBreakdown.totalCash.expenses)}
                      </span>
                    </p>
                    <div className="border-t border-slate-200 pt-2 text-sm text-slate-800">
                      Total esperado:{" "}
                      <span className="font-semibold text-slate-900">
                        {currency.format(dailySessionBreakdown.totalCash.expectedBalance)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                No hay datos disponibles para este resumen.
              </div>
            )}
          </div>
        </section>
      ) : null}

      {isCurrentAccountModalOpen ? (
        <section className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4">
          <button
            type="button"
            aria-label="Cerrar modal de cuenta corriente"
            className="absolute inset-0"
            onClick={() => setIsCurrentAccountModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-4xl space-y-3 rounded-2xl bg-white p-4 shadow-panel">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-900">Resumen de cuenta corriente</h3>
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                onClick={() => setIsCurrentAccountModalOpen(false)}
              >
                Cerrar
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Fecha analizada:{" "}
              {dailyDate ? new Date(`${dailyDate}T00:00:00`).toLocaleDateString("es-AR") : "-"}
            </p>

            {currentAccountDailySummary ? (
              <>
                <section className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-3">
                  <p className="text-sm text-slate-700">
                    Clientes con registro:{" "}
                    <span className="font-semibold text-slate-900">
                      {currentAccountDailySummary.customersCount}
                    </span>
                  </p>
                  <p className="text-sm text-slate-700">
                    Debitos del dia:{" "}
                    <span className="font-semibold text-slate-900">
                      {currency.format(currentAccountDailySummary.totalDebitsAmount)}
                    </span>
                  </p>
                  <p className="text-sm text-slate-700">
                    Pagos del dia:{" "}
                    <span className="font-semibold text-slate-900">
                      {currency.format(currentAccountDailySummary.totalPaymentsAmount)}
                    </span>
                  </p>
                  <p className="text-sm text-slate-700">
                    Neto del dia:{" "}
                    <span className="font-semibold text-slate-900">
                      {currency.format(currentAccountDailySummary.totalNetAmount)}
                    </span>
                  </p>
                  <p className="text-sm text-slate-700 md:col-span-3">
                    Total saldo cuenta corriente:{" "}
                    <span className="font-semibold text-slate-900">
                      {currency.format(currentAccountDailySummary.totalCurrentBalance)}
                    </span>
                  </p>
                </section>

                {currentAccountDailySummary.customers.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
                          <th className="px-3 py-2">Cliente</th>
                          <th className="px-3 py-2">Debitos</th>
                          <th className="px-3 py-2">Pagos</th>
                          <th className="px-3 py-2">Neto dia</th>
                          <th className="px-3 py-2">Saldo cuenta corriente</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentAccountDailySummary.customers.map((customer) => (
                          <tr key={customer.customerId} className="border-b border-slate-100 text-sm">
                            <td className="px-3 py-2 text-slate-800">{customer.customerName}</td>
                            <td className="px-3 py-2 font-semibold text-slate-900">
                              {currency.format(customer.dailyDebitsAmount)}
                            </td>
                            <td className="px-3 py-2 font-semibold text-slate-900">
                              {currency.format(customer.dailyPaymentsAmount)}
                            </td>
                            <td className="px-3 py-2 font-semibold text-slate-900">
                              {currency.format(customer.dailyNetAmount)}
                            </td>
                            <td className="px-3 py-2 font-semibold text-slate-900">
                              {currency.format(customer.currentBalance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                    No hay registros de cuenta corriente para esta fecha.
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                No hay fecha de caja disponible para calcular el resumen.
              </div>
            )}
          </div>
        </section>
      ) : null}

      {isDailyDetailModalOpen ? (
        <section className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4">
          <button
            type="button"
            aria-label="Cerrar modal de detalle de caja"
            className="absolute inset-0"
            onClick={() => setIsDailyDetailModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-6xl space-y-3 rounded-2xl bg-white p-4 shadow-panel">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-900">
                Detalle de movimientos de caja diaria
              </h3>
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                onClick={() => setIsDailyDetailModalOpen(false)}
              >
                Cerrar
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <select
                value={movementTypeFilter}
                onChange={(event) =>
                  setMovementTypeFilter(event.target.value as typeof movementTypeFilter)
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="all">Todos los tipos</option>
                <option value="sale_payment">Cobro venta</option>
                <option value="income">Ingreso</option>
                <option value="expense">Egreso</option>
                <option value="adjustment">Ajuste</option>
              </select>
            </div>

            <p className="text-xs text-slate-500">
              Caja abierta el:{" "}
              {activeDetailDate
                ? new Date(`${activeDetailDate}T00:00:00`).toLocaleDateString("es-AR")
                : "-"}
            </p>

            {isLoading ? (
              <div className="rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-600">
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
        </section>
      ) : null}

      {isSaleDocumentModalOpen ? (
        <section className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4">
          <button
            type="button"
            aria-label="Cerrar modal de comprobante"
            className="absolute inset-0"
            onClick={() => {
              setIsSaleDocumentModalOpen(false);
              setIsSaleDocumentLoading(false);
              setSaleDocumentError(null);
              setSelectedReceipt(null);
              setSelectedInvoice(null);
            }}
          />
          <div className="relative z-10 w-full max-w-3xl space-y-3 rounded-2xl bg-white p-4 shadow-panel">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-900">Ticket / Factura</h3>
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                onClick={() => {
                  setIsSaleDocumentModalOpen(false);
                  setIsSaleDocumentLoading(false);
                  setSaleDocumentError(null);
                  setSelectedReceipt(null);
                  setSelectedInvoice(null);
                }}
              >
                Cerrar
              </button>
            </div>

            {isSaleDocumentLoading ? (
              <div className="rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-600">
                Cargando comprobante...
              </div>
            ) : saleDocumentError ? (
              <div className="ui-error-state">{saleDocumentError}</div>
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
              <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                No hay comprobante disponible.
              </div>
            )}
          </div>
        </section>
      ) : null}
    </PagePlaceholder>
  );
};
