import React, { useState } from "react";
import { Lock, ShieldCheck, ArrowRight, Sparkles } from "lucide-react";
import { JirehLogo } from "./brand/JirehLogo";

interface AuthGateModalProps {
  onAuthenticated: () => void;
}

export const AuthGateModal: React.FC<AuthGateModalProps> = ({ onAuthenticated }) => {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  // Clave maestra de SuperAdmin (configurable en VITE_CRM_MASTER_PIN o fallback predeterminado)
  const masterPin = import.meta.env.VITE_CRM_MASTER_PIN || "181093";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.trim() === masterPin) {
      sessionStorage.setItem("jireh_crm_auth", "true");
      onAuthenticated();
    } else {
      setError(true);
      setPin("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900/95 p-6 sm:p-8 shadow-2xl text-center space-y-6">
        <div className="flex justify-center">
          <JirehLogo size="lg" />
        </div>

        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            <span>Acceso SuperAdmin</span>
          </div>
          <h2 className="text-xl font-black text-white">Panel CRM & Control</h2>
          <p className="text-xs text-slate-400">
            Ingresá tu PIN maestro para gestionar los comercios, licencias y prospectos.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="relative">
              <input
                type="password"
                maxLength={8}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError(false);
                }}
                placeholder="Ingresar PIN"
                autoFocus
                className={`w-full rounded-2xl bg-slate-950 border px-4 py-3 text-center text-lg font-mono tracking-widest text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 transition ${
                  error
                    ? "border-rose-500 ring-rose-500/30"
                    : "border-slate-800 focus:border-[#00B5C8] focus:ring-[#00B5C8]/30"
                }`}
              />
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            </div>
            {error && (
              <p className="mt-2 text-xs font-semibold text-rose-400 animate-in fade-in">
                PIN incorrecto. Verificalo e intentá de nuevo.
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-[#00B5C8] hover:from-emerald-600 hover:to-teal-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition active:scale-[0.99]"
          >
            <span>Desbloquear CRM</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <p className="text-[11px] text-slate-600">
          Jireh POS Cloud • Área restringida
        </p>
      </div>
    </div>
  );
};
