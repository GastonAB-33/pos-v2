import React, { useState } from "react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { JirehLogo } from "@/components/brand/JirehLogo";
import {
  Lock,
  ArrowRight,
  MessageSquare,
  ShieldCheck,
  Building,
  Copy,
  Check,
  X,
} from "lucide-react";

interface SubscriptionPaywallModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  isEnforced?: boolean;
}

export const SubscriptionPaywallModal: React.FC<SubscriptionPaywallModalProps> = ({
  isOpen = false,
  onClose,
  isEnforced = false,
}) => {
  const tenant = useAuthStore((state) => state.tenant);
  const user = useAuthStore((state) => state.user);
  const [selectedPlan, setSelectedPlan] = useState<"arrancando" | "formalizando" | "imperio">("formalizando");
  const [copiedAlias, setCopiedAlias] = useState(false);
  const [showTransferData, setShowTransferData] = useState(false);

  if (!isOpen) return null;

  const plans = {
    arrancando: {
      name: 'Plan "Estoy Arrancando"',
      price: "$25.000",
      desc: "Punto de Venta ultra rápido, stock simple y arqueos de caja.",
    },
    formalizando: {
      name: 'Plan "Me Estoy Formalizando"',
      price: "$40.000",
      desc: "Facturación Electrónica AFIP, cuentas corrientes y balanza.",
      badge: "Más Elegido",
    },
    imperio: {
      name: 'Plan "Imperio Multicomercio"',
      price: "$60.000",
      desc: "Múltiples sucursales, auditoría avanzada y soporte prioritario.",
    },
  };

  const handleCopyAlias = () => {
    navigator.clipboard.writeText("jirehpos.oficial.mp");
    setCopiedAlias(true);
    setTimeout(() => setCopiedAlias(false), 2000);
  };

  const currentPlan = plans[selectedPlan];
  const whatsappPhone = import.meta.env.VITE_SUPPORT_WHATSAPP_PHONE || "5492664689173";
  const whatsappMsg = encodeURIComponent(
    `Hola Jireh POS! Soy ${user?.fullName || "usuario"} del comercio "${tenant?.tradeName || "mi negocio"}" (ID: ${tenant?.id}). Quiero activar la suscripción del ${currentPlan.name} (${currentPlan.price} ARS/mes).`
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl my-6 overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
        
        {/* Barra superior de acento con gradiente Jireh */}
        <div className="h-2.5 w-full bg-gradient-to-r from-[#00B5C8] via-[#7CE01E] to-[#FF7800]" />

        {/* Botón cerrar sólo si NO es mandatorio / forzado */}
        {!isEnforced && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-5 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            aria-label="Cerrar ventana"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <JirehLogo size="sm" />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 border border-amber-200">
              <Lock className="h-3.5 w-3.5 text-amber-600" />
              {isEnforced ? "Período de Prueba Finalizado" : "Suscripción Oficial Jireh POS"}
            </span>
          </div>

          <h2 className="mt-4 text-2xl font-black text-slate-900 tracking-tight">
            {isEnforced
              ? `Tu período de 7 días para ${tenant?.tradeName || "tu comercio"} ha finalizado`
              : `Activa tu plan oficial para ${tenant?.tradeName || "tu comercio"}`}
          </h2>

          <p className="mt-1.5 text-sm text-slate-600">
            {isEnforced
              ? "Tus productos, inventario, ventas y clientes están 100% seguros y resguardados en tu base de datos. Selecciona tu plan para continuar operando sin interrupciones."
              : "Disfruta de todas las actualizaciones, facturación electrónica y soporte continuo."}
          </p>

          {/* Selector de Planes */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(Object.keys(plans) as Array<keyof typeof plans>).map((key) => {
              const p = plans[key];
              const isSelected = selectedPlan === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedPlan(key)}
                  className={`relative flex flex-col justify-between p-3.5 rounded-xl border text-left transition ${
                    isSelected
                      ? "border-[#00B5C8] bg-sky-50/60 ring-2 ring-[#00B5C8]/40 shadow-sm"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  {"badge" in p && p.badge && (
                    <span className="absolute -top-2.5 right-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-2 py-0.5 text-[10px] font-extrabold text-white shadow-sm">
                      {p.badge}
                    </span>
                  )}
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{p.name}</h4>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{p.desc}</p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-baseline justify-between">
                    <span className="text-base font-black text-slate-900">{p.price}</span>
                    <span className="text-[10px] text-slate-500 font-medium">ARS /mes</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Opciones de Pago */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Plan Seleccionado:</span>
              <span className="font-bold text-sky-800">{currentPlan.name} ({currentPlan.price} ARS/mes)</span>
            </div>

            {showTransferData ? (
              <div className="rounded-lg bg-white p-3 border border-slate-200 text-xs space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Alias Mercado Pago:</span>
                  <div className="flex items-center gap-1 font-mono font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-100">
                    <span>jirehpos.oficial.mp</span>
                    <button
                      type="button"
                      onClick={handleCopyAlias}
                      className="text-slate-400 hover:text-slate-600 p-0.5"
                      title="Copiar Alias"
                    >
                      {copiedAlias ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Una vez transferido, envíanos el comprobante por WhatsApp y activaremos tu comercio en menos de 5 minutos.
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <a
                href={`https://wa.me/${whatsappPhone}?text=${whatsappMsg}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00B5C8] via-[#10B981] to-[#FF7800] px-4 py-3 text-sm font-bold text-white shadow-md hover:scale-[1.01] active:scale-[0.99] transition"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Activar por WhatsApp</span>
                <ArrowRight className="h-4 w-4" />
              </a>

              <button
                type="button"
                onClick={() => setShowTransferData(!showTransferData)}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                <Building className="h-4 w-4 text-slate-500" />
                <span>{showTransferData ? "Ocultar datos CBU" : "Ver CBU / Alias Bancario"}</span>
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Facturación directa con CUIT / DNI y garantía de soporte.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
