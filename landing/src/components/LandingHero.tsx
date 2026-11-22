import React from "react";
import { MessageSquareText, CheckCircle2 } from "lucide-react";

interface LandingHeroProps {
  onOpenFreeTrial: () => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({ onOpenFreeTrial }) => {
  return (
    <section className="relative overflow-hidden pt-8 pb-8 lg:pt-12 lg:pb-10">
      {/* Luces de fondo con los tres colores oficiales de la marca Jireh (Turquesa, Verde Lima y Naranja) */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-[#00B5C8]/15 via-[#7CE01E]/15 to-[#FF7800]/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-10 right-10 w-72 h-72 bg-[#FF7800]/10 rounded-full blur-2xl pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-10 w-80 h-80 bg-[#00B5C8]/10 rounded-full blur-2xl pointer-events-none -z-10" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          {/* Badge superior */}
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-gradient-to-r from-teal-50 via-emerald-50 to-orange-50 px-4 py-1.5 text-xs font-bold text-slate-800 shadow-sm">
            <span className="flex h-2 w-2 rounded-full bg-[#7CE01E] animate-pulse" />
            <span className="text-[#00B5C8]">Software Punto de Venta & Gestión</span>
            <span className="text-slate-300">•</span>
            <span className="text-[#FF7800] font-extrabold">7 Días Gratis</span>
          </div>

          {/* Título Principal */}
          <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 leading-[1.15]">
            Potencia, vende y gestiona tu comercio con{" "}
            <span className="bg-gradient-to-r from-[#00B5C8] via-[#10B981] to-[#FF7800] bg-clip-text text-transparent">
              Jireh POS
            </span>
          </h1>

          {/* Subtítulo */}
          <p className="mt-5 text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
            El sistema de punto de venta en la nube más rápido, moderno y seguro. Control de stock, arqueos de caja, cuentas corrientes, múltiples medios de pago y reportes en tiempo real.
          </p>

          {/* Llamadas a la Acción */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <button
              onClick={onOpenFreeTrial}
              className="w-full sm:w-auto max-w-xl flex items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#25D366] via-[#10B981] to-[#059669] px-7 sm:px-9 py-3.5 sm:py-4 text-sm sm:text-base font-extrabold text-white shadow-xl shadow-emerald-600/30 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all border border-emerald-300/40 text-center"
            >
              <MessageSquareText className="h-5 w-5 sm:h-6 sm:w-6 text-white shrink-0" />
              <span className="leading-snug">Contactate con tu soporte personal para prueba gratis</span>
            </button>

            <a
              href="#planes"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-full border-2 border-slate-300 bg-white/80 backdrop-blur-sm px-6 py-3.5 text-sm sm:text-base font-bold text-slate-800 hover:border-sky-600 hover:text-sky-600 hover:bg-slate-50 transition-all"
            >
              <span>Ver Planes y Precios</span>
            </a>
          </div>

          {/* Beneficios inmediatos */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm font-semibold text-slate-600">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Facturación ARCA Oficial</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-[#00B5C8]" />
              <span>Catálogo +4.000 Productos Pre-cargados</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-[#7CE01E]" />
              <span>100% Nube & Modo Offline</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-[#FF7800]" />
              <span>Soporte 1 a 1 por WhatsApp</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
