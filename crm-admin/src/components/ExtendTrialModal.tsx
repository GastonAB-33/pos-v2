import React, { useState } from "react";
import { TenantAccount } from "../types/crm.types";
import { X, Sparkles, Clock, Check } from "lucide-react";

interface ExtendTrialModalProps {
  isOpen: boolean;
  tenant: TenantAccount | null;
  onClose: () => void;
  onConfirm: (tenantId: string, days: number) => void;
}

export const ExtendTrialModal: React.FC<ExtendTrialModalProps> = ({
  isOpen,
  tenant,
  onClose,
  onConfirm,
}) => {
  const [days, setDays] = useState<number>(7);

  if (!isOpen || !tenant) return null;

  const currentExpiry = new Date(tenant.trialEndsAt).getTime() > Date.now()
    ? new Date(tenant.trialEndsAt)
    : new Date();

  const newExpiry = new Date(currentExpiry);
  newExpiry.setDate(newExpiry.getDate() + days);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(tenant.id, days);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl">
        
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 text-amber-400">
          <Sparkles className="h-5 w-5" />
          <h3 className="text-lg font-bold text-white">Extender Prueba Gratuita</h3>
        </div>

        <p className="mt-1 text-xs text-slate-400">
          Comercio: <strong className="text-white">{tenant.tradeName}</strong> ({tenant.slug})
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Días adicionales de prueba
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[3, 7, 15].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  className={`py-2 text-xs font-bold rounded-xl border transition ${
                    days === d
                      ? "border-[#00B5C8] bg-sky-950/60 text-[#00B5C8] ring-1 ring-[#00B5C8]"
                      : "border-slate-800 bg-slate-950 text-slate-400 hover:text-white"
                  }`}
                >
                  +{d} Días
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span>Vencimiento actual:</span>
              <span className="font-semibold text-slate-300">
                {new Date(tenant.trialEndsAt).toLocaleDateString("es-AR")}
              </span>
            </div>
            <div className="flex items-center justify-between text-emerald-400 font-bold border-t border-slate-800/80 pt-2">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Nuevo vencimiento:
              </span>
              <span>{newExpiry.toLocaleDateString("es-AR")}</span>
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
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#00B5C8] via-[#10B981] to-[#FF7800] text-xs font-bold text-white shadow-md hover:scale-[1.01] transition"
            >
              Confirmar Extensión
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
