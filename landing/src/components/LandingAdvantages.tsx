import React from "react";
import {
  Zap,
  Cloud,
  WifiOff,
  ShieldCheck,
  Headphones,
  TrendingUp,
} from "lucide-react";

export const LandingAdvantages: React.FC = () => {
  const advantages = [
    {
      icon: Zap,
      title: "Velocidad Extrema de Venta",
      description:
        "Diseñado para filas rápidas. Compatible con lectores de códigos de barras, balanzas electrónicas, atajos de teclado y emisión de ticket en menos de 2 segundos.",
      badge: "Cero Demoras",
      color: "sky",
    },
    {
      icon: Cloud,
      title: "100% en la Nube y Multidispositivo",
      description:
        "Supervisa las ventas de tu negocio desde cualquier lugar. Ingresa desde tu computadora de mostrador, tu notebook en casa o tu celular mientras estás de viaje.",
      badge: "Acceso Remoto",
      color: "emerald",
    },
    {
      icon: WifiOff,
      title: "Modo Offline & Tecnología PWA",
      description:
        "¿Se cortó internet en el local? No te preocupes: Jireh POS continúa facturando y registrando ventas normalmente, y sincroniza todo en cuanto vuelve la conexión.",
      badge: "Ventas Sin Pausas",
      color: "amber",
    },
    {
      icon: ShieldCheck,
      title: "Control Total y Anti-Faltantes",
      description:
        "Arqueos de caja ciegos al cambio de turno, control de retiros de efectivo, perfiles de cajeros con permisos estrictos y registro de auditoría de cada modificación.",
      badge: "Máxima Seguridad",
      color: "sky",
    },
    {
      icon: TrendingUp,
      title: "Mayor Rentabilidad Real",
      description:
        "Conoce tu margen de ganancia neto exacto, identifica productos estancados para liquidar con promociones automáticas y evita quiebres de stock en tus productos estrella.",
      badge: "Decisiones Inteligentes",
      color: "emerald",
    },
    {
      icon: Headphones,
      title: "Soporte Humano por WhatsApp",
      description:
        "No lidiamos con bots lentos. Nuestro equipo de soporte técnico te acompaña paso a paso desde el primer día para configurar tu comercio y resolver dudas al instante.",
      badge: "Acompañamiento Real",
      color: "amber",
    },
  ];

  return (
    <section id="ventajas" className="py-20 bg-slate-50 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Encabezado de sección */}
        <div className="text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 uppercase tracking-wider">
            Ventajas Exclusivas
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            ¿Por qué los comerciantes eligen{" "}
            <span className="bg-gradient-to-r from-sky-600 via-emerald-600 to-amber-600 bg-clip-text text-transparent">
              Jireh POS
            </span>
            ?
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600">
            Combinamos la potencia de un software empresarial con la sencillez que tu día a día necesita.
          </p>
        </div>

        {/* Grilla de ventajas */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {advantages.map((adv, idx) => {
            const Icon = adv.icon;
            const borderColors = {
              sky: "border-sky-200 hover:border-sky-400 group-hover:shadow-sky-500/10",
              emerald: "border-emerald-200 hover:border-emerald-400 group-hover:shadow-emerald-500/10",
              amber: "border-amber-200 hover:border-amber-400 group-hover:shadow-amber-500/10",
            }[adv.color];

            const iconBg = {
              sky: "bg-sky-50 text-sky-600 border-sky-100",
              emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
              amber: "bg-amber-50 text-amber-600 border-amber-100",
            }[adv.color];

            const badgeBg = {
              sky: "bg-sky-50 text-sky-700 border-sky-200",
              emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
              amber: "bg-amber-50 text-amber-700 border-amber-200",
            }[adv.color];

            return (
              <div
                key={idx}
                className={`group relative rounded-2xl bg-white p-6 sm:p-7 border shadow-sm hover:shadow-xl transition-all duration-300 ${borderColors}`}
              >
                <div className="flex items-center justify-between">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl border ${iconBg}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold border ${badgeBg}`}>
                    {adv.badge}
                  </span>
                </div>

                <h3 className="mt-5 text-xl font-bold text-slate-900">
                  {adv.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  {adv.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
