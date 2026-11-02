import { useEffect, useState } from "react";
import {
  Lock,
  User,
  CheckCircle2,
  AlertCircle,
  Banknote,
  Coins,
  FileText,
  Clock,
  X,
  Sun,
  Sunset,
  Moon,
} from "lucide-react";
import type { CashSession } from "@/types/entities";
import { parseCloseSnapshot } from "@/modules/caja/hooks/useCashModule";
import {
  getShiftLabel,
  formatLocalTime,
  type ShiftPeriod,
} from "@/modules/caja/utils/cash-date.utils";

interface CashSessionCloseDetailModalProps {
  isOpen: boolean;
  session: CashSession | null;
  availableSessions?: CashSession[];
  onClose: () => void;
  usersById: Record<string, string>;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const BILL_DENOMINATIONS = [20000, 10000, 2000, 1000, 500, 200, 100] as const;

export const CashSessionCloseDetailModal = ({
  isOpen,
  session,
  availableSessions,
  onClose,
  usersById,
}: CashSessionCloseDetailModalProps) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    session?.id ?? null
  );

  useEffect(() => {
    if (session?.id) {
      setSelectedSessionId(session.id);
    }
  }, [session?.id]);

  // Manejo de tecla ESC para cerrar el modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !session) return null;

  // Sesión activa actual (permite alternar entre turnos de la jornada)
  const activeSession =
    (availableSessions &&
      availableSessions.find((s) => s.id === selectedSessionId)) ||
    session;

  const { snapshot, cleanNotes } = parseCloseSnapshot(activeSession.notes);

  const realAmount = activeSession.closing_amount ?? snapshot?.realAmount ?? 0;
  const expectedAmount =
    activeSession.expected_closing_amount ?? snapshot?.expectedAmount ?? 0;
  const difference =
    activeSession.closing_difference ??
    snapshot?.difference ??
    Number((realAmount - expectedAmount).toFixed(2));

  const billCounts =
    snapshot?.billCounts ??
    (activeSession.closing_bill_counts as Record<number, number> | undefined);
  const coinsAmount = snapshot?.coinsAmount ?? activeSession.closing_coins_amount ?? 0;

  const openingBillCounts =
    snapshot?.openingBillCounts ??
    (activeSession.opening_bill_counts as Record<number, number> | undefined);
  const openingCoinsAmount =
    snapshot?.openingCoinsAmount ?? activeSession.opening_coins_amount ?? 0;

  const openedByUser =
    usersById[activeSession.opened_by_user_id] ?? activeSession.opened_by_user_id;
  const closedByUser = activeSession.closed_by_user_id
    ? usersById[activeSession.closed_by_user_id] ?? activeSession.closed_by_user_id
    : "-";

  const reconciliationMode = snapshot?.reconciliationMode ?? "cash_only";

  const hasBillBreakdown =
    billCounts &&
    Object.values(billCounts).some((count) => Number(count) > 0);

  const hasOpeningBillBreakdown =
    openingBillCounts &&
    Object.values(openingBillCounts).some((count) => Number(count) > 0);

  const renderShiftPeriodIcon = (period: ShiftPeriod) => {
    switch (period) {
      case "morning":
        return <Sun size={12} className="text-amber-500" />;
      case "afternoon":
        return <Sunset size={12} className="text-orange-500" />;
      case "night":
        return <Moon size={12} className="text-indigo-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Cabecera del Modal */}
        <header className="shrink-0 px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/80">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Detalle del Cierre de Caja
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                    reconciliationMode === "full"
                      ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                  }`}
                >
                  {reconciliationMode === "full" ? "Arqueo Completo" : "Arqueo Solo Efectivo"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Sesión #{activeSession.id.slice(-6).toUpperCase()} · Cierre formal de turno
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Contenido con scroll */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Selector de Turnos si hay más de 1 turno en la jornada */}
          {availableSessions && availableSessions.length > 1 && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Clock size={11} className="text-blue-500" />
                <span>Turnos registrados de esta fecha:</span>
              </span>
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                {availableSessions.map((s, idx) => {
                  const shiftInfo = getShiftLabel(s.opened_at, idx);
                  const isSelected = s.id === activeSession.id;
                  const openedTime = formatLocalTime(s.opened_at);
                  const closedTime = s.closed_at
                    ? formatLocalTime(s.closed_at)
                    : s.status === "open"
                    ? "En curso"
                    : "--:--";

                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedSessionId(s.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                        isSelected
                          ? "bg-slate-900 text-white border-slate-900 shadow-xs dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100"
                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                      }`}
                    >
                      {renderShiftPeriodIcon(shiftInfo.period)}
                      <span>{shiftInfo.label}</span>
                      <span className="opacity-70 font-mono text-[10px]">
                        ({openedTime} - {closedTime})
                      </span>
                      {s.status === "open" && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tarjetas KPI de Resultados del Arqueo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Monto Esperado (Sistema)
              </span>
              <p className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">
                {currency.format(expectedAmount)}
              </p>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
                {reconciliationMode === "full"
                  ? "Cobros totales del turno"
                  : "Efectivo teórico en cajón"}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Monto Real (Contado)
              </span>
              <p className="mt-1 text-lg font-black text-emerald-600 dark:text-emerald-400">
                {currency.format(realAmount)}
              </p>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
                {hasBillBreakdown ? "Por conteo físico de billetes" : "Declarado en cierre"}
              </span>
            </div>

            <div
              className={`p-3.5 rounded-xl border ${
                difference === 0
                  ? "bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800"
                  : difference > 0
                  ? "bg-blue-50/60 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800"
                  : "bg-rose-50/60 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800"
              }`}
            >
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block flex items-center justify-between">
                <span>Diferencia</span>
                {difference === 0 ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertCircle
                    className={`h-3.5 w-3.5 ${
                      difference > 0
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  />
                )}
              </span>
              <p
                className={`mt-1 text-lg font-black ${
                  difference === 0
                    ? "text-emerald-700 dark:text-emerald-300"
                    : difference > 0
                    ? "text-blue-700 dark:text-blue-300"
                    : "text-rose-700 dark:text-rose-300"
                }`}
              >
                {difference > 0 ? `+${currency.format(difference)}` : currency.format(difference)}
              </p>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5 font-medium">
                {difference === 0
                  ? "Caja exacta sin diferencias"
                  : difference > 0
                  ? "Sobrante de caja"
                  : "Faltante de caja"}
              </span>
            </div>
          </div>

          {/* Información de Auditoría y Tiempos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50/50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/70 dark:border-slate-700/70">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                <span>Horarios del Turno</span>
              </div>
              <div className="pl-5 space-y-0.5 text-slate-700 dark:text-slate-300">
                <p>
                  <strong className="text-slate-900 dark:text-slate-100">Apertura:</strong>{" "}
                  {new Date(activeSession.opened_at).toLocaleString("es-AR")}
                </p>
                <p>
                  <strong className="text-slate-900 dark:text-slate-100">Cierre:</strong>{" "}
                  {activeSession.closed_at
                    ? new Date(activeSession.closed_at).toLocaleString("es-AR")
                    : "Turno aún abierto"}
                </p>
                <p>
                  <strong className="text-slate-900 dark:text-slate-100">Monto Inicial:</strong>{" "}
                  {currency.format(activeSession.opening_amount)}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium">
                <User className="h-3.5 w-3.5 text-blue-500" />
                <span>Responsables</span>
              </div>
              <div className="pl-5 space-y-0.5 text-slate-700 dark:text-slate-300">
                <p>
                  <strong className="text-slate-900 dark:text-slate-100">Abierta por:</strong>{" "}
                  {openedByUser}
                </p>
                <p>
                  <strong className="text-slate-900 dark:text-slate-100">Cerrada por:</strong>{" "}
                  {closedByUser}
                </p>
              </div>
            </div>
          </div>

          {/* Desglose Físico de Billetes en Cierre */}
          {hasBillBreakdown ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                  <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Desglose Físico de Billetes (Cierre)</span>
                </h4>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Total billetes:{" "}
                  <strong className="text-slate-900 dark:text-slate-100">
                    {currency.format(
                      BILL_DENOMINATIONS.reduce(
                        (acc, denom) => acc + denom * (Number(billCounts?.[denom]) || 0),
                        0
                      )
                    )}
                  </strong>
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-[11px]">
                    <tr>
                      <th className="py-2 px-3 text-left font-semibold">Denominación</th>
                      <th className="py-2 px-3 text-center font-semibold">Cantidad</th>
                      <th className="py-2 px-3 text-right font-semibold">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {BILL_DENOMINATIONS.map((denom) => {
                      const count = Number(billCounts?.[denom]) || 0;
                      const subtotal = count * denom;
                      if (count === 0) return null;

                      return (
                        <tr
                          key={denom}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                            ${denom.toLocaleString("es-AR")}
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-medium text-slate-600 dark:text-slate-300">
                            {count}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                            {currency.format(subtotal)}
                          </td>
                        </tr>
                      );
                    })}
                    {coinsAmount > 0 && (
                      <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                          <Coins className="h-3 w-3 text-amber-500" />
                          <span>Monedas / Sueltos</span>
                        </td>
                        <td className="py-2 px-3 text-center text-slate-400 font-mono">-</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          {currency.format(coinsAmount)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400 dark:text-slate-500">
              No se registró desglose de billetes en este turno (cierre directo sin conteo desglosado).
            </div>
          )}

          {/* Desglose Físico de Billetes en Apertura */}
          {hasOpeningBillBreakdown && (
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                  <Banknote className="h-4 w-4 text-amber-500" />
                  <span>Desglose de Billetes en Apertura</span>
                </h4>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Fondo inicial:{" "}
                  <strong className="text-slate-900 dark:text-slate-100">
                    {currency.format(activeSession.opening_amount)}
                  </strong>
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-[11px]">
                    <tr>
                      <th className="py-2 px-3 text-left font-semibold">Denominación</th>
                      <th className="py-2 px-3 text-center font-semibold">Cantidad</th>
                      <th className="py-2 px-3 text-right font-semibold">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {BILL_DENOMINATIONS.map((denom) => {
                      const count = Number(openingBillCounts?.[denom]) || 0;
                      const subtotal = count * denom;
                      if (count === 0) return null;

                      return (
                        <tr
                          key={denom}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                            ${denom.toLocaleString("es-AR")}
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-medium text-slate-600 dark:text-slate-300">
                            {count}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                            {currency.format(subtotal)}
                          </td>
                        </tr>
                      );
                    })}
                    {openingCoinsAmount > 0 && (
                      <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                          <Coins className="h-3 w-3 text-amber-500" />
                          <span>Monedas / Sueltos iniciales</span>
                        </td>
                        <td className="py-2 px-3 text-center text-slate-400 font-mono">-</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          {currency.format(openingCoinsAmount)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Observaciones o Notas del Cierre */}
          {cleanNotes && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-slate-500" />
                <span>Observaciones del Cierre</span>
              </h4>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                {cleanNotes}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="shrink-0 px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer shadow-2xs"
          >
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
};
