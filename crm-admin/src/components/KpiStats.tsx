import React from "react";
import { CrmStats } from "../types/crm.types";
import { DollarSign, Store, Sparkles, AlertTriangle } from "lucide-react";

interface KpiStatsProps {
  stats: CrmStats;
  onFilterExpiring: () => void;
}

export const KpiStats: React.FC<KpiStatsProps> = ({ stats, onFilterExpiring }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      
      {/* 1. MRR Mensual */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            MRR Recurrente
          </span>
          <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400 border border-emerald-500/20">
            <DollarSign className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-3xl font-black text-white">
            ${stats.totalMrr.toLocaleString("es-AR")}
          </span>
          <span className="text-xs font-semibold text-slate-400 block mt-1">
            Ingresos mensuales de suscripciones
          </span>
        </div>
      </div>

      {/* 2. Clientes Activos */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Comercios Activos
          </span>
          <div className="rounded-xl bg-sky-500/10 p-2 text-sky-400 border border-sky-500/20">
            <Store className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-3xl font-black text-white">
            {stats.activeTenants}
          </span>
          <span className="text-xs font-semibold text-slate-400 block mt-1">
            De {stats.totalTenants} comercios registrados
          </span>
        </div>
      </div>

      {/* 3. En Prueba (7 Días) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Trials en Curso
          </span>
          <div className="rounded-xl bg-amber-500/10 p-2 text-amber-400 border border-amber-500/20">
            <Sparkles className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-3xl font-black text-amber-400">
            {stats.activeTrials}
          </span>
          <span className="text-xs font-semibold text-slate-400 block mt-1">
            Probando gratis por 7 días
          </span>
        </div>
      </div>

      {/* 4. Por Vencer en 48hs */}
      <div
        onClick={onFilterExpiring}
        className={`rounded-2xl border p-5 shadow-lg cursor-pointer transition hover:scale-[1.02] ${
          stats.expiringIn48h > 0
            ? "border-amber-500/40 bg-amber-950/20 text-amber-200"
            : "border-slate-800 bg-slate-900/60 text-slate-400"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider">
            Vencen en ≤ 48hs
          </span>
          <div className="rounded-xl bg-amber-500/20 p-2 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-3xl font-black text-white">
            {stats.expiringIn48h}
          </span>
          <span className="text-xs font-semibold block mt-1">
            {stats.expiringIn48h > 0 ? "⚠️ Clic para contactar por WhatsApp" : "Sin urgencias inmediatas"}
          </span>
        </div>
      </div>

    </div>
  );
};
