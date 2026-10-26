import React from "react";
import { Check } from "lucide-react";

export const LandingStats: React.FC = () => {
  const stats = [
    {
      number: "+1.200",
      label: "Comercios activos",
      description: "Gestionan sus ventas diarias con Jireh POS",
      color: "from-sky-600 to-sky-800",
    },
    {
      number: "99.9%",
      label: "Disponibilidad Cloud",
      description: "Tus datos seguros con respaldos automáticos",
      color: "from-emerald-600 to-emerald-800",
    },
    {
      number: "5 min",
      label: "Puesta en marcha",
      description: "Comienzas a vender sin instalaciones complicadas",
      color: "from-amber-600 to-amber-800",
    },
    {
      number: "+3.5M",
      label: "Operaciones al mes",
      description: "Tickets y comprobantes procesados con éxito",
      color: "from-sky-700 to-emerald-700",
    },
  ];

  const businessTypes = [
    "Almacenes y Kioscos",
    "Minimarkets y Supermercados",
    "Indumentaria y Calzado",
    "Ferreterías y Corralones",
    "Gastronomía y Bares",
    "Distribuidoras Mayoristas",
    "Librerías y Papeleras",
    "Farmacias y Perfumerías",
  ];

  return (
    <section className="py-12 bg-slate-900 text-white relative overflow-hidden">
      {/* Resplandor decorativo con azul, verde y naranja */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {stats.map((stat, idx) => (
            <div
              key={idx}
              className="text-center p-4 sm:p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:border-white/20 transition-all"
            >
              <div
                className={`text-3xl sm:text-4xl lg:text-5xl font-black bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}
              >
                {stat.number}
              </div>
              <div className="mt-2 text-sm sm:text-base font-bold text-slate-200">
                {stat.label}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {stat.description}
              </div>
            </div>
          ))}
        </div>

        {/* Rubros adaptados */}
        <div className="mt-12 pt-8 border-t border-white/10 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
            Adaptado y optimizado para tu rubro
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            {businessTypes.map((type, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-medium text-slate-200 border border-white/5 hover:bg-white/15 transition"
              >
                <Check className="h-3 w-3 text-emerald-400" />
                {type}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
