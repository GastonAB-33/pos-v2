import React from "react";
import {
  ClipboardCheck,
  MessageSquareText,
  Rocket,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { WhatsAppIcon } from "./brand/WhatsAppIcon";

interface LandingStepsProps {
  onOpenFreeTrial: () => void;
}

export const LandingSteps: React.FC<LandingStepsProps> = ({ onOpenFreeTrial }) => {
  const steps = [
    {
      stepNumber: "01",
      badge: "Paso 1 • En 1 minuto",
      title: "Completá la ficha rápida",
      description:
        "Ingresás el nombre de tu comercio y tu WhatsApp de contacto. No solicitamos datos de tarjetas ni medios de pago para la prueba.",
      icon: ClipboardCheck,
      color: "from-[#00B5C8] to-sky-600",
      pillColor: "bg-[#00B5C8]/10 text-[#00B5C8] border-[#00B5C8]/20",
      highlight: "🔒 Sin costos ocultos ni compromisos",
    },
    {
      stepNumber: "02",
      badge: "Paso 2 • Atención 1 a 1",
      title: "Tu asesor te escribe por WhatsApp",
      description:
        "Un agente personal de soporte se comunica directo con vos, te entrega tus credenciales privadas de acceso y te acompaña en la puesta en marcha.",
      icon: MessageSquareText,
      color: "from-[#25D366] to-emerald-600",
      pillColor: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
      highlight: "💬 Soporte humano real, sin robots",
    },
    {
      stepNumber: "03",
      badge: "Paso 3 • Venta Inmediata",
      title: "Empezás a vender y cobrar",
      description:
        "Ingresás desde tu celular, tablet o PC. El catálogo con más de 4.000 productos ya está cargado para que escanees y cobres en el acto.",
      icon: Rocket,
      color: "from-[#FF7800] to-amber-600",
      pillColor: "bg-orange-500/10 text-[#FF7800] border-orange-500/20",
      highlight: "🚀 Tu negocio en marcha en 5 minutos",
    },
  ];

  return (
    <section id="como-empezar" className="py-12 sm:py-14 bg-slate-50/80 border-y border-slate-200/80 relative overflow-hidden">
      {/* Luces sutiles de fondo con los tres colores de la marca */}
      <div className="absolute top-1/2 left-0 w-80 h-80 bg-[#00B5C8]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-[#7CE01E]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Encabezado de la Sección */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-gradient-to-r from-teal-50 via-emerald-50 to-orange-50 px-3.5 py-1 text-xs font-bold text-slate-800 shadow-sm">
            <span className="flex h-2 w-2 rounded-full bg-[#7CE01E] animate-pulse" />
            <span className="text-[#00B5C8]">Puesta en marcha express</span>
            <span className="text-slate-300">•</span>
            <span className="text-[#FF7800] font-extrabold">Fácil y Rápido</span>
          </div>

          <h2 className="mt-3 text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Empezar es así de simple:{" "}
            <span className="bg-gradient-to-r from-[#00B5C8] via-[#10B981] to-[#FF7800] bg-clip-text text-transparent">
              en 3 pasos y sin demoras
            </span>
          </h2>
          <p className="mt-3 text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Olvidate de configuraciones complejas o días de espera. Te acompañamos paso a paso para que tu comercio empiece a vender hoy mismo.
          </p>
        </div>

        {/* Las 3 Tarjetas de Pasos */}
        <div className="mt-8 sm:mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={idx}
                className="relative rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-lg hover:shadow-xl transition-all flex flex-col justify-between group overflow-hidden"
              >
                <div>
                  {/* Ícono con gradiente */}
                  <div className="flex items-center justify-between mb-5">
                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${step.color} text-white shadow-md shadow-slate-900/10 group-hover:scale-105 transition-transform`}
                    >
                      <Icon className="h-7 w-7" />
                    </div>

                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold border ${step.pillColor}`}
                    >
                      {step.badge}
                    </span>
                  </div>

                  {/* Título y Descripción */}
                  <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-2.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Resalte inferior */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    {step.highlight}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Banner de Acción Rápida */}
        <div className="mt-8 sm:mt-10 max-w-3xl mx-auto rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xl text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#00B5C8] via-[#7CE01E] to-[#FF7800]" />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <h4 className="text-base sm:text-lg font-black text-slate-900">
                ¿Querés empezar ahora tus 7 días de prueba gratis?
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Tu agente de soporte se comunica con vos por WhatsApp en minutos.
              </p>
            </div>

            <button
              onClick={onOpenFreeTrial}
              className="shrink-0 flex items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-[#25D366] via-[#10B981] to-[#059669] px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-emerald-600/30 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <WhatsAppIcon className="h-4 w-4 text-white" />
              <span>Contactate con tu soporte personal</span>
            </button>
          </div>
        </div>

      </div>
    </section>
  );
};
