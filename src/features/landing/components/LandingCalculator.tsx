import React, { useState } from "react";
import { Clock, DollarSign, Sparkles, ArrowRight } from "lucide-react";

interface LandingCalculatorProps {
  onOpenFreeTrial: () => void;
}

export const LandingCalculator: React.FC<LandingCalculatorProps> = ({ onOpenFreeTrial }) => {
  const [dailySales, setDailySales] = useState(60);
  const [manualHoursPerWeek, setManualHoursPerWeek] = useState(8);

  // Cálculos dinámicos
  const monthlyHoursSaved = Math.round(manualHoursPerWeek * 3.5);
  // Estimación de pérdidas evitadas por descontrol de stock / redondeo (aprox $250 por venta errónea)
  const estimatedMoneySaved = Math.round(dailySales * 30 * 180);

  return (
    <section id="calculadora" className="py-20 bg-slate-100 relative overflow-hidden">
      {/* Círculos de luz */}
      <div className="absolute top-1/2 left-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 uppercase tracking-wider">
            Calculadora de Impacto
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            ¿Cuánto tiempo y dinero ahorras con{" "}
            <span className="bg-gradient-to-r from-sky-600 via-emerald-600 to-amber-600 bg-clip-text text-transparent">
              Jireh POS
            </span>
            ?
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Ajusta los valores según tu negocio y descubre el retorno real de automatizar tus ventas.
          </p>
        </div>

        <div className="mt-12 max-w-4xl mx-auto rounded-3xl bg-white p-6 sm:p-10 border border-slate-200 shadow-xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            
            {/* Controles deslizantes */}
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between text-sm font-bold text-slate-800 mb-2">
                  <span>Ventas promedio por día</span>
                  <span className="text-sky-700 font-extrabold text-base">{dailySales} operaciones</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="300"
                  step="5"
                  value={dailySales}
                  onChange={(e) => setDailySales(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                  <span>15 ventas/día</span>
                  <span>150 ventas/día</span>
                  <span>300+ ventas/día</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-sm font-bold text-slate-800 mb-2">
                  <span>Horas semanales dedicadas a cuadernos y caja</span>
                  <span className="text-emerald-700 font-extrabold text-base">{manualHoursPerWeek} horas</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="25"
                  step="1"
                  value={manualHoursPerWeek}
                  onChange={(e) => setManualHoursPerWeek(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                  <span>2 hs/sem</span>
                  <span>12 hs/sem</span>
                  <span>25+ hs/sem</span>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs text-slate-600 space-y-1.5">
                <p className="font-semibold text-slate-800">¿Cómo lo calculamos?</p>
                <p>
                  Automatizando el cobro con códigos de barras, el arqueo de caja automático al cierre y las alertas de stock para evitar pérdidas de mercadería.
                </p>
              </div>
            </div>

            {/* Resultados y Métricas de Ahorro */}
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 sm:p-8 text-white relative overflow-hidden flex flex-col justify-between">
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-extrabold uppercase tracking-wider">
                  <Sparkles className="h-4 w-4" />
                  <span>Tu Ahorro Estimado con Jireh</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-xl bg-white/10 p-4 border border-white/10">
                    <div className="flex items-center gap-1.5 text-xs text-slate-300">
                      <Clock className="h-4 w-4 text-sky-400" />
                      <span>Tiempo libre al mes</span>
                    </div>
                    <div className="mt-2 text-3xl font-black text-white">
                      {monthlyHoursSaved} <span className="text-base font-normal text-sky-400">horas</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Dedícalas a hacer crecer tu negocio o descansar.
                    </p>
                  </div>

                  <div className="rounded-xl bg-white/10 p-4 border border-white/10">
                    <div className="flex items-center gap-1.5 text-xs text-slate-300">
                      <DollarSign className="h-4 w-4 text-emerald-400" />
                      <span>Ahorro mensual est.</span>
                    </div>
                    <div className="mt-2 text-3xl font-black text-emerald-400">
                      ${estimatedMoneySaved.toLocaleString("es-AR")}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      En faltantes y desvíos de caja evitados.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-white/10">
                <button
                  type="button"
                  onClick={onOpenFreeTrial}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-500 py-3.5 text-sm font-extrabold text-white shadow-lg hover:scale-[1.02] active:scale-[0.98] transition"
                >
                  <span>Probar 15 días y comprobarlo</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
};
