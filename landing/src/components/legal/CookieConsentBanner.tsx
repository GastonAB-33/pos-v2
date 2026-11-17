import React, { useState, useEffect } from "react";
import { Cookie, Shield, Check, X } from "lucide-react";

interface CookieConsentBannerProps {
  onOpenPrivacy: () => void;
}

export const CookieConsentBanner: React.FC<CookieConsentBannerProps> = ({ onOpenPrivacy }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("jireh_cookie_consent");
    if (!consent) {
      // Breve retardo para suavizar la animación de entrada
      const timer = setTimeout(() => setIsVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem("jireh_cookie_consent", "all");
    localStorage.setItem("jireh_cookie_consent_timestamp", new Date().toISOString());
    setIsVisible(false);
  };

  const handleAcceptEssentialOnly = () => {
    localStorage.setItem("jireh_cookie_consent", "essential");
    localStorage.setItem("jireh_cookie_consent_timestamp", new Date().toISOString());
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-6 sm:right-auto sm:max-w-md z-50 animate-in slide-in-from-bottom duration-300">
      <div className="rounded-3xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md p-5 shadow-2xl text-slate-200 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
            <Cookie className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>Privacidad y Uso de Cookies</span>
              <Shield className="h-3.5 w-3.5 text-emerald-400" />
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Utilizamos cookies técnicas esenciales para el funcionamiento seguro del sistema y cookies analíticas para mejorar tu experiencia. No comercializamos tus datos ni permitimos rastreo abusivo.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2 pt-1 text-xs font-semibold">
          <button
            onClick={handleAcceptAll}
            className="w-full sm:flex-1 rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-white transition active:scale-[0.98] text-center"
          >
            Aceptar todas
          </button>
          <button
            onClick={handleAcceptEssentialOnly}
            className="w-full sm:flex-1 rounded-2xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-4 py-2 text-slate-300 transition text-center"
          >
            Solo esenciales
          </button>
          <button
            onClick={onOpenPrivacy}
            className="text-[11px] text-slate-400 hover:text-white underline underline-offset-2 py-1 px-2"
          >
            Leer política
          </button>
        </div>
      </div>
    </div>
  );
};
