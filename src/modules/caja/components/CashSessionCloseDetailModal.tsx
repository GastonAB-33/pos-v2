import { useEffect } from "react";
import {
  Lock,
  LockOpen,
  User,
  CheckCircle2,
  AlertCircle,
  Banknote,
  Coins,
  FileText,
  Clock,
  Layers,
  X,
} from "lucide-react";
import type { CashSession } from "@/types/entities";
import { parseCloseSnapshot } from "@/modules/caja/hooks/useCashModule";

interface CashSessionCloseDetailModalProps {
  isOpen: boolean;
  session: CashSession | null;
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
  onClose,
  usersById,
}: CashSessionCloseDetailModalProps) => {
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

  const { snapshot, cleanNotes } = parseCloseSnapshot(session.notes);

  const realAmount = session.closing_amount ?? snapshot?.realAmount ?? 0;
  const expectedAmount = session.expected_closing_amount ?? snapshot?.expectedAmount ?? 0;
  const difference =
    session.closing_difference ??
    snapshot?.difference ??
    Number((realAmount - expectedAmount).toFixed(2));

  const billCounts = snapshot?.billCounts ?? (session.closing_bill_counts as Record<number, number> | undefined);
  const coinsAmount = snapshot?.coinsAmount ?? session.closing_coins_amount ?? 0;

  const openingBillCounts =
    snapshot?.openingBillCounts ?? (session.opening_bill_counts as Record<number, number> | undefined);
  const openingCoinsAmount = snapshot?.openingCoinsAmount ?? session.opening_coins_amount ?? 0;

  const openedByUser = usersById[session.opened_by_user_id] ?? session.opened_by_user_id;
  const closedByUser = session.closed_by_user_id
    ? usersById[session.closed_by_user_id] ?? session.closed_by_user_id
    : "-";

  const reconciliationMode = snapshot?.reconciliationMode ?? "cash_only";

  const hasBillBreakdown =
    billCounts &&
    Object.values(billCounts).some((count) => Number(count) > 0);

  const hasOpeningBillBreakdown =
    openingBillCounts &&
    Object.values(openingBillCounts).some((count) => Number(count) > 0);

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
                Sesión #{session.id.slice(-6).toUpperCase()} · Cierre formal de turno
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
                Monto Real (Arqueo Físico)
              </span>
              <p className="mt-1 text-lg font-black text-emerald-700 dark:text-emerald-400">
                {currency.format(realAmount)}
              </p>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
                Declarado al cerrar caja
              </span>
            </div>

            <div
              className={`p-3.5 rounded-xl border ${
                difference === 0
                  ? "bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800"
                  : difference > 0
                    ? "bg-blue-50/70 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800"
                    : "bg-rose-50/70 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Diferencia de Cierre
                </span>
                {difference === 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertCircle
                    className={`h-4 w-4 ${
                      difference > 0 ? "text-blue-600 dark:text-blue-400" : "text-rose-600 dark:text-rose-400"
                    }`}
                  />
                )}
              </div>
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
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mt-0.5">
                {difference === 0 ? "Exacto (Sin diferencia)" : difference > 0 ? "Sobrante a favor" : "Faltante de caja"}
              </span>
            </div>
          </div>

          {/* Desglose de Conteo de Billetes */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Desglose de Conteo de Billetes
                </h4>
              </div>
              {hasBillBreakdown && (
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Total Recontado: <strong className="text-slate-800 dark:text-slate-200">{currency.format(realAmount)}</strong>
                </span>
              )}
            </div>

            {hasBillBreakdown ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                <div className="grid grid-cols-12 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/40">
                  <div className="col-span-5">Denominación</div>
                  <div className="col-span-3 text-center">Cantidad</div>
                  <div className="col-span-4 text-right">Subtotal</div>
                </div>

                {BILL_DENOMINATIONS.map((denom) => {
                  const count = billCounts?.[denom] || 0;
                  const subtotal = denom * count;
                  if (count === 0) return null;

                  return (
                    <div
                      key={denom}
                      className="grid grid-cols-12 px-4 py-2.5 text-xs items-center hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                    >
                      <div className="col-span-5 font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          ${denom.toLocaleString("es-AR")}
                        </span>
                        <span>Billetes de ${denom.toLocaleString("es-AR")}</span>
                      </div>
                      <div className="col-span-3 text-center font-bold text-slate-900 dark:text-slate-100">
                        {count.toLocaleString("es-AR")}
                      </div>
                      <div className="col-span-4 text-right font-bold text-emerald-700 dark:text-emerald-400">
                        {currency.format(subtotal)}
                      </div>
                    </div>
                  );
                })}

                {coinsAmount > 0 && (
                  <div className="grid grid-cols-12 px-4 py-2.5 text-xs items-center bg-slate-50/40 dark:bg-slate-800/30">
                    <div className="col-span-5 font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <Coins className="h-4 w-4 text-amber-500" />
                      <span>Monedas y valores menores</span>
                    </div>
                    <div className="col-span-3 text-center text-slate-400">-</div>
                    <div className="col-span-4 text-right font-bold text-emerald-700 dark:text-emerald-400">
                      {currency.format(coinsAmount)}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-12 px-4 py-3 text-xs items-center bg-emerald-50/40 dark:bg-emerald-950/20 font-bold">
                  <div className="col-span-8 text-slate-900 dark:text-slate-100">
                    Total Arqueo Físico de Billetes y Monedas
                  </div>
                  <div className="col-span-4 text-right text-sm text-emerald-700 dark:text-emerald-300 font-black">
                    {currency.format(realAmount)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-xs space-y-2">
                <div className="inline-flex p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                  <Banknote className="h-5 w-5" />
                </div>
                <p className="font-semibold text-slate-700 dark:text-slate-300">
                  Cierre asentado por monto directo
                </p>
                <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Este turno fue cerrado ingresando el importe total directo de{" "}
                  <strong className="text-slate-800 dark:text-slate-200">{currency.format(realAmount)}</strong>{" "}
                  sin especificar cantidad de billetes por denominación.
                </p>
              </div>
            )}
          </div>

          {/* Desglose de Billetes en Apertura (si fue registrada por conteo físico) */}
          {hasOpeningBillBreakdown && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LockOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    Desglose de Billetes en Apertura
                  </h4>
                </div>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Fondo Inicial: <strong className="text-slate-800 dark:text-slate-200">{currency.format(session.opening_amount)}</strong>
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                <div className="grid grid-cols-12 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/40">
                  <div className="col-span-5">Denominación</div>
                  <div className="col-span-3 text-center">Cantidad</div>
                  <div className="col-span-4 text-right">Subtotal</div>
                </div>

                {BILL_DENOMINATIONS.map((denom) => {
                  const count = openingBillCounts?.[denom] || 0;
                  if (count === 0) return null;
                  const subtotal = denom * count;
                  return (
                    <div
                      key={denom}
                      className="grid grid-cols-12 px-4 py-2 text-xs items-center hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="col-span-5 font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <span>{currency.format(denom)}</span>
                      </div>
                      <div className="col-span-3 text-center font-bold text-slate-900 dark:text-slate-100">
                        {count.toLocaleString("es-AR")}
                      </div>
                      <div className="col-span-4 text-right font-bold text-emerald-700 dark:text-emerald-400">
                        {currency.format(subtotal)}
                      </div>
                    </div>
                  );
                })}

                {openingCoinsAmount > 0 && (
                  <div className="grid grid-cols-12 px-4 py-2.5 text-xs items-center bg-slate-50/40 dark:bg-slate-800/30">
                    <div className="col-span-5 font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <Coins className="h-4 w-4 text-amber-500" />
                      <span>Monedas y valores menores</span>
                    </div>
                    <div className="col-span-3 text-center text-slate-400">-</div>
                    <div className="col-span-4 text-right font-bold text-emerald-700 dark:text-emerald-400">
                      {currency.format(openingCoinsAmount)}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-12 px-4 py-3 text-xs items-center bg-emerald-50/40 dark:bg-emerald-950/20 font-bold">
                  <div className="col-span-8 text-slate-900 dark:text-slate-100">
                    Total Declarado en Apertura
                  </div>
                  <div className="col-span-4 text-right text-sm text-emerald-700 dark:text-emerald-300 font-black">
                    {currency.format(session.opening_amount)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Información Operativa y Auditoría del Turno */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-500" />
              Auditoría y Datos Operativos del Turno
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-medium">Horario de Apertura:</span>
                </div>
                <p className="font-semibold text-slate-900 dark:text-slate-100 pl-5">
                  {new Date(session.opened_at).toLocaleString("es-AR")}
                </p>

                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 pt-2">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-medium">Responsable de Apertura:</span>
                </div>
                <p className="font-semibold text-slate-900 dark:text-slate-100 pl-5">
                  {openedByUser}
                </p>

                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 pt-2">
                  <Banknote className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-medium">Monto Inicial (Apertura):</span>
                </div>
                <p className="font-bold text-slate-900 dark:text-slate-100 pl-5">
                  {currency.format(session.opening_amount)}
                </p>
              </div>

              <div className="space-y-1.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-medium">Horario de Cierre:</span>
                </div>
                <p className="font-semibold text-slate-900 dark:text-slate-100 pl-5">
                  {session.closed_at ? new Date(session.closed_at).toLocaleString("es-AR") : "En curso"}
                </p>

                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 pt-2">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-medium">Responsable de Cierre:</span>
                </div>
                <p className="font-semibold text-slate-900 dark:text-slate-100 pl-5">
                  {closedByUser}
                </p>

                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 pt-2">
                  <Layers className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-medium">Modalidad de Arqueo:</span>
                </div>
                <p className="font-bold text-slate-900 dark:text-slate-100 pl-5">
                  {reconciliationMode === "full" ? "Arqueo Completo (Todos los medios)" : "Arqueo Solo Efectivo"}
                </p>
              </div>
            </div>

            {cleanNotes && (
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Observaciones registradas en el cierre
                </span>
                <p className="text-xs text-slate-800 dark:text-slate-200 mt-1 italic">
                  "{cleanNotes}"
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer con botón de acción */}
        <footer className="shrink-0 px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-300 dark:border-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
};
