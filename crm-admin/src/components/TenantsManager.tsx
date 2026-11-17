import React, { useState } from "react";
import { TenantAccount, SubscriptionStatus } from "../types/crm.types";
import {
  Search,
  Store,
  Phone,
  Calendar,
  Sparkles,
  ShieldCheck,
  PauseCircle,
  PlayCircle,
  Clock,
  Package,
  ShoppingCart,
  MessageSquare,
  FileText,
  RefreshCw,
} from "lucide-react";

interface TenantsManagerProps {
  tenants: TenantAccount[];
  filterExpiringOnly?: boolean;
  onExtendTrial: (tenant: TenantAccount) => void;
  onActivateManual: (tenant: TenantAccount) => void;
  onToggleStatus: (tenantId: string, currentStatus: SubscriptionStatus) => void;
  onOpenNotes: (tenant: TenantAccount) => void;
  onRefreshTelemetry?: (tenant: TenantAccount) => void;
  onRefreshAllTelemetry?: () => void;
  loadingTenantId?: string | null;
  isRefreshingAll?: boolean;
}

export const TenantsManager: React.FC<TenantsManagerProps> = ({
  tenants,
  filterExpiringOnly = false,
  onExtendTrial,
  onActivateManual,
  onToggleStatus,
  onOpenNotes,
  onRefreshTelemetry,
  onRefreshAllTelemetry,
  loadingTenantId,
  isRefreshingAll = false,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(filterExpiringOnly ? "expiring" : "all");

  const now = Date.now();

  const filteredTenants = tenants.filter((t) => {
    const matchesSearch =
      t.tradeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.phone.includes(searchTerm) ||
      t.email.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === "all") return true;
    if (statusFilter === "active") return t.subscriptionStatus === "active";
    if (statusFilter === "trial") return t.subscriptionStatus === "trial";
    if (statusFilter === "past_due") return t.subscriptionStatus === "past_due";
    if (statusFilter === "expiring") {
      const trialMs = new Date(t.trialEndsAt).getTime();
      const diffHours = (trialMs - now) / (1000 * 3600);
      return t.subscriptionStatus === "trial" && diffHours > 0 && diffHours <= 48;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Controles de búsqueda y filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, slug, teléfono o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-[#00B5C8] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: "all", label: "Todos" },
            { id: "trial", label: "🟡 En Prueba" },
            { id: "expiring", label: "⚠️ Vencen en 48h" },
            { id: "active", label: "🟢 Activos" },
            { id: "past_due", label: "🔴 Vencidos" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                statusFilter === f.id
                  ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}

          {onRefreshAllTelemetry && (
            <button
              onClick={onRefreshAllTelemetry}
              disabled={isRefreshingAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-950/60 hover:bg-sky-900/80 text-sky-400 border border-sky-800/60 text-xs font-bold transition disabled:opacity-50 ml-1"
              title="Consultar métricas en la base de datos para todos los comercios mostrados"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingAll ? "animate-spin" : ""}`} />
              <span>{isRefreshingAll ? "Consultando..." : "Consultar Todo"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Listado de Comercios */}
      <div className="space-y-3">
        {filteredTenants.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center text-slate-400">
            No se encontraron comercios con los filtros seleccionados.
          </div>
        ) : (
          filteredTenants.map((t) => {
            const isTrial = t.subscriptionStatus === "trial";
            const trialMs = new Date(t.trialEndsAt).getTime();
            const daysLeft = Math.max(0, Math.ceil((trialMs - now) / 86400000));
            const isUrgent = isTrial && daysLeft <= 2;

            const whatsappMsg = encodeURIComponent(
              isTrial
                ? `Hola ${t.tradeName}! Te escribo desde Jireh POS. Veo que estás en tus días de prueba gratuita. ¿Cómo va la carga de tus productos y ventas? ¿Precisas ayuda técnica?`
                : `Hola ${t.tradeName}! Te escribo desde Jireh POS respecto a tu suscripción oficial.`
            );

            return (
              <div
                key={t.id}
                className={`rounded-2xl border bg-slate-900/70 p-5 transition-all shadow-md ${
                  isUrgent
                    ? "border-amber-500/50 ring-1 ring-amber-500/20"
                    : "border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  {/* Info Principal */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <h4 className="text-base font-bold text-white">{t.tradeName}</h4>
                      <span className="font-mono text-xs text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800/60">
                        /{t.slug}
                      </span>
                      {t.subscriptionStatus === "active" && (
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-500/20">
                          🟢 Activo Oficial
                        </span>
                      )}
                      {t.subscriptionStatus === "trial" && (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                            isUrgent
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          }`}
                        >
                          🟡 Prueba (Quedan {daysLeft} días)
                        </span>
                      )}
                      {t.subscriptionStatus === "past_due" && (
                        <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-bold text-rose-400 border border-rose-500/20">
                          🔴 Vencido
                        </span>
                      )}
                      {t.subscriptionStatus === "suspended" && (
                        <span className="rounded-full bg-slate-700 px-2.5 py-0.5 text-[11px] font-bold text-slate-300">
                          ⚪ Suspendido
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                      <span>CUIT: <strong className="text-slate-300">{t.cuit}</strong></span>
                      <span>Rubro: <strong className="text-slate-300">{t.category}</strong></span>
                      <span>Plan: <strong className="text-sky-300 uppercase">{t.planId}</strong></span>
                      <span>MRR: <strong className="text-emerald-400">${t.mrrAmount.toLocaleString("es-AR")}</strong></span>
                    </div>

                    {/* Métricas de adopción en vivo (consulta bajo demanda a la base de datos) */}
                    <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-400 pt-2">
                      <span className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800">
                        <Package className="h-3.5 w-3.5 text-sky-400" />
                        <span>Productos:</span>
                        <strong className="text-white font-mono">{t.productsCount}</strong>
                      </span>
                      <span className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800">
                        <ShoppingCart className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Ventas Registradas:</span>
                        <strong className="text-white font-mono">{t.salesCount}</strong>
                      </span>

                      {onRefreshTelemetry && (
                        <button
                          onClick={() => onRefreshTelemetry(t)}
                          disabled={loadingTenantId === t.id}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-sky-950/50 hover:bg-sky-900/70 text-sky-300 hover:text-white border border-sky-800/60 text-xs font-semibold transition disabled:opacity-50"
                          title="Consultar datos reales de productos y ventas en la base de datos (bajo consumo)"
                        >
                          <RefreshCw className={`h-3 w-3 text-sky-400 ${loadingTenantId === t.id ? "animate-spin" : ""}`} />
                          <span>{loadingTenantId === t.id ? "Consultando..." : "Consultar en base de datos"}</span>
                        </button>
                      )}
                    </div>

                    {t.notes && (
                      <p className="text-xs text-slate-500 italic pt-1 border-t border-slate-800/60 mt-2">
                        Notas: {t.notes}
                      </p>
                    )}
                  </div>

                  {/* Acciones Rápidas */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Botón WhatsApp */}
                    <a
                      href={`https://wa.me/${t.phone.replace(/[^0-9]/g, "")}?text=${whatsappMsg}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition"
                      title="Chatear con el cliente por WhatsApp"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>WhatsApp</span>
                    </a>

                    {/* Botón Bitácora */}
                    <button
                      onClick={() => onOpenNotes(t)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold transition"
                      title="Ver y registrar notas de interacción"
                    >
                      <FileText className="h-3.5 w-3.5 text-sky-400" />
                      <span>Bitácora</span>
                    </button>

                    {/* Botón Extender Prueba */}
                    {isTrial && (
                      <button
                        onClick={() => onExtendTrial(t)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold transition"
                        title="Extender 3 o 7 días de prueba adicional"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Extender Prueba</span>
                      </button>
                    )}

                    {/* Botón Activar Manual */}
                    <button
                      onClick={() => onActivateManual(t)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition shadow-sm"
                      title="Activar 1 mes o 1 año por transferencia o efectivo"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Activar Pago</span>
                    </button>

                    {/* Botón Suspender / Reactivar */}
                    <button
                      onClick={() => onToggleStatus(t.id, t.subscriptionStatus)}
                      className={`p-2 rounded-xl border text-xs font-semibold transition ${
                        t.subscriptionStatus === "suspended"
                          ? "border-emerald-800 text-emerald-400 hover:bg-emerald-950/40"
                          : "border-slate-800 text-slate-400 hover:text-rose-400 hover:bg-rose-950/20"
                      }`}
                      title={t.subscriptionStatus === "suspended" ? "Reactivar acceso" : "Suspender comercio"}
                    >
                      {t.subscriptionStatus === "suspended" ? (
                        <PlayCircle className="h-4 w-4" />
                      ) : (
                        <PauseCircle className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
