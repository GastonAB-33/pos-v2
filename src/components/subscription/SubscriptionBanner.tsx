import React, { useState } from "react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { Sparkles, AlertTriangle, ArrowRight, ShieldCheck, X } from "lucide-react";
import { SubscriptionPaywallModal } from "./SubscriptionPaywallModal";

export const SubscriptionBanner: React.FC = () => {
  const tenant = useAuthStore((state) => state.tenant);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (!tenant || isDismissed) return null;

  const status = tenant.subscriptionStatus ?? "active";
  const trialEndsAt = tenant.trialEndsAt ? new Date(tenant.trialEndsAt) : null;
  const now = new Date();

  // Si no está en prueba, o si la prueba ya venció (el Paywall se encarga de bloquear), no mostrar este banner
  if (status !== "trial" || !trialEndsAt || trialEndsAt <= now) {
    return null;
  }

  const diffMs = trialEndsAt.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const dayOfTrial = Math.min(7, Math.max(1, 8 - daysRemaining));

  const isUrgent = daysRemaining <= 2;

  return (
    <>
      <div
        className={`w-full py-2 px-4 transition-all flex items-center justify-between gap-3 text-xs font-medium z-30 shadow-sm ${
          isUrgent
            ? "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white"
            : "bg-gradient-to-r from-[#00B5C8] via-[#10B981] to-[#FF7800] text-white"
        }`}
      >
        <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
          {isUrgent ? (
            <AlertTriangle className="h-4 w-4 shrink-0 animate-bounce text-amber-100" />
          ) : (
            <Sparkles className="h-4 w-4 shrink-0 text-amber-200" />
          )}
          <span>
            <strong>Prueba Gratuita Jireh POS:</strong> Estás en el{" "}
            <strong>Día {dayOfTrial} de 7</strong>. Te quedan{" "}
            <span className="underline font-bold">
              {daysRemaining === 1 ? "1 día" : `${daysRemaining} días`}
            </span>{" "}
            de acceso ilimitado.
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsPaywallOpen(true)}
            className="rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-sm px-3 py-1 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-sm active:scale-95"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Activar Plan Definitivo</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="text-white/80 hover:text-white p-1 rounded transition"
            title="Ocultar aviso por esta sesión"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <SubscriptionPaywallModal
        isOpen={isPaywallOpen}
        onClose={() => setIsPaywallOpen(false)}
        isEnforced={false}
      />
    </>
  );
};
