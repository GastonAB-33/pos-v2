import React from "react";
import { BillingTransaction } from "../types/crm.types";
import { CreditCard, CheckCircle2, FileCheck, Building, QrCode, Banknote } from "lucide-react";

interface BillingTransactionsProps {
  transactions: BillingTransaction[];
}

export const BillingTransactions: React.FC<BillingTransactionsProps> = ({ transactions }) => {
  const totalBilled = transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

  const getMethodIcon = (method: string) => {
    switch (method) {
      case "transfer":
        return <Building className="h-4 w-4 text-amber-400" />;
      case "mercadopago":
        return <QrCode className="h-4 w-4 text-[#009ee3]" />;
      case "cash":
        return <Banknote className="h-4 w-4 text-emerald-400" />;
      default:
        return <CreditCard className="h-4 w-4 text-sky-400" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white">Historial de Cobranzas y Suscripciones</h3>
          <p className="text-xs text-slate-400">
            Registro auditable de todas las transacciones procesadas (Mercado Pago y transferencias bancarias directas).
          </p>
        </div>

        <div className="text-right">
          <span className="text-xs text-slate-400 block">Total Cobrado Registrado:</span>
          <span className="text-2xl font-black text-emerald-400">
            ${totalBilled.toLocaleString("es-AR")} ARS
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Comercio</th>
                <th className="py-3 px-4">Plan / Ciclo</th>
                <th className="py-3 px-4">Medio de Pago</th>
                <th className="py-3 px-4">Monto</th>
                <th className="py-3 px-4">Período Habilitado</th>
                <th className="py-3 px-4">Referencia</th>
                <th className="py-3 px-4">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No hay transacciones registradas aún.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 font-bold text-white">
                      {tx.tradeName}
                    </td>
                    <td className="py-3 px-4">
                      <span className="capitalize text-sky-400 font-semibold">{tx.planId}</span>
                      <span className="text-slate-500 block text-[10px]">
                        {tx.billingCycle === "annual" ? "Anual" : "Mensual"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 capitalize text-slate-300">
                        {getMethodIcon(tx.paymentMethod)}
                        <span>{tx.paymentMethod}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-black text-emerald-400 text-sm">
                      ${tx.amount.toLocaleString("es-AR")}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      <span>{new Date(tx.periodStart).toLocaleDateString("es-AR")}</span>
                      <span className="mx-1">al</span>
                      <span className="text-slate-200 font-semibold">
                        {new Date(tx.periodEnd).toLocaleDateString("es-AR")}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      {tx.referenceId || "S/D"}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="h-3 w-3" />
                        {tx.paymentStatus.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
