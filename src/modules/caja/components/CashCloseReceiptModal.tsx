import React from "react";
import { CheckCircle2, Printer, X, ShieldAlert, Banknote, CreditCard } from "lucide-react";
import { ARS_DENOMINATIONS } from "./CashDenominationCounter";

interface CashCloseReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionData: {
    sessionId: string;
    closedAt: string;
    closedByName: string;
    realAmount: number;
    expectedBalance?: number | null;
    difference?: number | null;
    notes?: string | null;
    isBlindClose?: boolean | null;
    countedDenominations?: Record<string, number> | null;
    declaredOtherPayments?: Record<string, number> | null;
  };
  canViewAudit: boolean;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const CashCloseReceiptModal: React.FC<CashCloseReceiptModalProps> = ({
  isOpen,
  onClose,
  sessionData,
  canViewAudit,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const hasDenominations = sessionData.countedDenominations &&
    Object.values(sessionData.countedDenominations).some((count) => count > 0);

  const hasOtherPayments = sessionData.declaredOtherPayments &&
    Object.values(sessionData.declaredOtherPayments).some((amount) => amount > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {canViewAudit ? "Auditoría de Cierre de Caja" : "Comprobante de Entrega de Turno"}
              </h3>
              <p className="text-xs text-slate-500">
                Sesión #{sessionData.sessionId.slice(-6)} • {new Date(sessionData.closedAt).toLocaleString("es-AR")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Tarjeta principal de efectivo declarado */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-800 dark:bg-slate-800/40">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Efectivo Declarado para Entrega
            </span>
            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">
              {currency.format(sessionData.realAmount)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Operador: <span className="font-semibold text-slate-700 dark:text-slate-300">{sessionData.closedByName}</span>
            </p>
          </div>

          {/* Panel exclusivo para administradores / supervisores con revelación */}
          {canViewAudit && sessionData.expectedBalance !== null && sessionData.expectedBalance !== undefined ? (
            <div className="rounded-xl border border-slate-200 p-4 space-y-3 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                <ShieldAlert className="h-4 w-4 text-brand-600" />
                <span>Conciliación de Sistema vs. Declarado</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/50">
                  <span className="text-[11px] text-slate-500 block">Esperado Sistema</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {currency.format(sessionData.expectedBalance)}
                  </span>
                </div>

                <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/50">
                  <span className="text-[11px] text-slate-500 block">Diferencia de Arqueo</span>
                  {(() => {
                    const diff = sessionData.difference ?? 0;
                    if (diff === 0) {
                      return <span className="font-bold text-emerald-600">Exacto (,00)</span>;
                    }
                    if (diff > 0) {
                      return <span className="font-bold text-emerald-600">+{currency.format(diff)} (Sobrante)</span>;
                    }
                    return <span className="font-bold text-rose-600">{currency.format(diff)} (Faltante)</span>;
                  })()}
                </div>
              </div>
            </div>
          ) : null}

          {/* Desglose de billetes si fue cargado */}
          {hasDenominations ? (
            <div className="rounded-xl border border-slate-200 p-4 space-y-2.5 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                <Banknote className="h-4 w-4 text-emerald-600" />
                <span>Billetes Declarados</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {ARS_DENOMINATIONS.map((d) => {
                  const count = sessionData.countedDenominations?.[d.value] || 0;
                  if (count === 0) return null;
                  return (
                    <div key={d.value} className="rounded-md border border-slate-200 bg-slate-50/70 p-2 text-center dark:border-slate-800 dark:bg-slate-800/40">
                      <span className="text-slate-500 block">{d.label}</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {count} u. ({currency.format(count * d.value)})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Otros medios declarados */}
          {hasOtherPayments ? (
            <div className="rounded-xl border border-slate-200 p-4 space-y-2 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                <CreditCard className="h-4 w-4 text-blue-600" />
                <span>Otros Comprobantes Físicos</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {sessionData.declaredOtherPayments?.card_coupons !== undefined && (
                  <div className="rounded-md bg-slate-50 p-2 dark:bg-slate-800/50">
                    <span className="text-slate-500 block">Cupones de Tarjeta</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {currency.format(sessionData.declaredOtherPayments.card_coupons)}
                    </span>
                  </div>
                )}
                {sessionData.declaredOtherPayments?.transfers !== undefined && (
                  <div className="rounded-md bg-slate-50 p-2 dark:bg-slate-800/50">
                    <span className="text-slate-500 block">Transferencias / QR</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {currency.format(sessionData.declaredOtherPayments.transfers)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* Notas u observaciones */}
          {sessionData.notes ? (
            <div className="rounded-lg bg-amber-50 border border-amber-200/80 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
              <span className="font-bold block mb-0.5">Observaciones del operador:</span>
              <p>{sessionData.notes}</p>
            </div>
          ) : null}

          {/* Mensaje de resguardo para el cajero */}
          {!canViewAudit && (
            <p className="text-center text-xs text-slate-500 italic">
              Por favor, coloque el dinero en el sobre de cierre, adjunte los cupones y entréguelo al responsable de caja.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-850">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-300"
          >
            <Printer className="h-4 w-4" /> Imprimir Comprobante
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
};
