import React, { useState } from "react";
import { TenantAccount } from "../types/crm.types";
import { X, ShieldCheck, DollarSign, ArrowRight } from "lucide-react";

interface ManualActivationModalProps {
  isOpen: boolean;
  tenant: TenantAccount | null;
  onClose: () => void;
  onConfirm: (
    tenantId: string,
    planId: string,
    months: number,
    paymentMethod: "transfer" | "cash" | "card" | "mercadopago",
    amount: number,
    notes?: string
  ) => void;
}

export const ManualActivationModal: React.FC<ManualActivationModalProps> = ({
  isOpen,
  tenant,
  onClose,
  onConfirm,
}) => {
  const [planId, setPlanId] = useState<string>(tenant?.planId || "formalizando");
  const [months, setMonths] = useState<number>(1);
  const [paymentMethod, setPaymentMethod] = useState<"transfer" | "cash" | "card" | "mercadopago">("transfer");
  const [reference, setReference] = useState("");

  if (!isOpen || !tenant) return null;

  const planPrices: Record<string, number> = {
    arrancando: 25000,
    formalizando: 40000,
    imperio: 60000,
  };

  const monthlyPrice = planPrices[planId] || 40000;
  const discount = months >= 12 ? 0.8 : 1; // 20% descuento anual
  const totalAmount = monthlyPrice * months * discount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(tenant.id, planId, months, paymentMethod, totalAmount, reference);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl">
        
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 text-emerald-400">
          <ShieldCheck className="h-5 w-5" />
          <h3 className="text-lg font-bold text-white">Activar Suscripción Oficial</h3>
        </div>

        <p className="mt-1 text-xs text-slate-400">
          Comercio: <strong className="text-white">{tenant.tradeName}</strong> ({tenant.slug})
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Plan del Sistema
              </label>
              <select
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-[#00B5C8] focus:outline-none"
              >
                <option value="arrancando">Estoy Arrancando ($25.000/mes)</option>
                <option value="formalizando">Me Estoy Formalizando ($40.000/mes)</option>
                <option value="imperio">Imperio Multicomercio ($60.000/mes)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Período Contratado
              </label>
              <select
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-[#00B5C8] focus:outline-none"
              >
                <option value={1}>1 Mes</option>
                <option value={3}>3 Meses (Trimestral)</option>
                <option value={6}>6 Meses (Semestral)</option>
                <option value={12}>12 Meses (Anual -20% Descuento)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Medio de Pago Utilizado
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-[#00B5C8] focus:outline-none"
              >
                <option value="transfer">Transferencia Bancaria Directa</option>
                <option value="mercadopago">Mercado Pago (Saldo/QR)</option>
                <option value="cash">Efectivo en mano</option>
                <option value="card">Tarjeta Débito/Crédito</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                N° de Comprobante / Referencia
              </label>
              <input
                type="text"
                placeholder="Ej. TRF-839182 / Recibo N° 4"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-[#00B5C8] focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 block">Total cobrado al comercio:</span>
              <span className="text-xl font-black text-emerald-400">
                ${totalAmount.toLocaleString("es-AR")} ARS
              </span>
            </div>
            <div className="text-right text-[11px] text-slate-400">
              <span>Habilita el POS hasta:</span>
              <span className="font-bold text-white block">
                {new Date(Date.now() + months * 30 * 86400000).toLocaleDateString("es-AR")}
              </span>
            </div>
          </div>

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg transition flex items-center justify-center gap-1.5"
            >
              <span>Activar y Habilitar Sistema</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
