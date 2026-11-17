import React, { useState, useEffect } from "react";
import { ShieldCheck, ArrowRight, Lock, AlertTriangle } from "lucide-react";
import { JirehLogo } from "./brand/JirehLogo";

interface AuthGateModalProps {
  onAuthenticated: () => void;
}

// Sal criptográfica para evitar ataques de rainbow tables en el cliente
const SALT = "jireh-superadmin-salt-v2";
// Hash SHA-256 predeterminado de seguridad (no revela el PIN en texto claro en el bundle)
const DEFAULT_AUTH_HASH = "a6c20135593d1a3dace57680c93741c4c26786ea77a8f1058bd92a581a152446";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 60 segundos de bloqueo

async function computeHash(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${SALT}:${pin.trim()}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const AuthGateModal: React.FC<AuthGateModalProps> = ({ onAuthenticated }) => {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);

  // Verificación de bloqueo por fuerza bruta
  useEffect(() => {
    const checkLockout = () => {
      const lockUntil = Number(sessionStorage.getItem("jireh_crm_lockout") || 0);
      const remaining = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
      setLockoutRemaining(remaining);
    };

    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutRemaining > 0 || isVerifying || !pin.trim()) return;

    setIsVerifying(true);
    setError(false);
    setErrorMessage("");

    try {
      const inputHash = await computeHash(pin);
      const targetHash = (import.meta.env.VITE_CRM_AUTH_HASH as string) || DEFAULT_AUTH_HASH;

      if (inputHash === targetHash) {
        // Generar token criptográfico de sesión con caducidad
        const sessionToken = crypto.randomUUID();
        const expiresAt = Date.now() + 4 * 60 * 60 * 1000; // 4 horas
        sessionStorage.setItem("jireh_crm_auth", "true");
        sessionStorage.setItem("jireh_crm_token", sessionToken);
        sessionStorage.setItem("jireh_crm_expires", String(expiresAt));
        sessionStorage.removeItem("jireh_crm_failed_attempts");
        sessionStorage.removeItem("jireh_crm_lockout");
        onAuthenticated();
      } else {
        const attempts = Number(sessionStorage.getItem("jireh_crm_failed_attempts") || 0) + 1;
        sessionStorage.setItem("jireh_crm_failed_attempts", String(attempts));

        if (attempts >= MAX_FAILED_ATTEMPTS) {
          const lockUntil = Date.now() + LOCKOUT_DURATION_MS;
          sessionStorage.setItem("jireh_crm_lockout", String(lockUntil));
          setLockoutRemaining(60);
          setError(true);
          setErrorMessage("Demasiados intentos fallidos. Panel bloqueado temporalmente por seguridad.");
        } else {
          setError(true);
          setErrorMessage(`PIN incorrecto. Intentos restantes antes de bloqueo: ${MAX_FAILED_ATTEMPTS - attempts}`);
        }
        setPin("");
      }
    } catch {
      setError(true);
      setErrorMessage("Error al verificar credenciales.");
    } finally {
      setIsVerifying(false);
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
                disabled={lockoutRemaining > 0 || isVerifying}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError(false);
                }}
                placeholder={lockoutRemaining > 0 ? `Bloqueado (${lockoutRemaining}s)` : "Ingresar PIN"}
                autoFocus
                autoComplete="off"
                data-lpignore="true"
                className={`w-full rounded-2xl bg-slate-950 border px-4 py-3 text-center text-lg font-mono tracking-widest text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 transition ${
                  error
                    ? "border-rose-500 ring-rose-500/30"
                    : "border-slate-800 focus:border-[#00B5C8] focus:ring-[#00B5C8]/30"
                } ${lockoutRemaining > 0 ? "opacity-50 cursor-not-allowed" : ""}`}
              />
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            </div>
            {error && (
              <div className="mt-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-rose-400 animate-in fade-in">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={lockoutRemaining > 0 || isVerifying || !pin.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-[#00B5C8] hover:from-emerald-600 hover:to-teal-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{isVerifying ? "Verificando..." : lockoutRemaining > 0 ? `Esperá ${lockoutRemaining}s` : "Desbloquear CRM"}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <p className="text-[11px] text-slate-600">
          Jireh POS Cloud • Área restringida con cifrado SHA-256
        </p>
      </div>
    </div>
  );
};
