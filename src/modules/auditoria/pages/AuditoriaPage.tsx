import { useState } from "react";
import { EmptyState, LoadingState } from "@/components/ui/UiStates";
import { Download, FilterX, RefreshCw } from "lucide-react";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { useAuditoriaModule } from "@/modules/auditoria/hooks/useAuditoriaModule";
import { appModuleLabels, appModules, type AppModule } from "@/types/modules";
import type { AuditLog } from "@/types/entities";
import { cn } from "@/utils/cn";

const formatDateTime = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(parsed);
};

const resolveModuleLabel = (moduleCode: string): string => {
  if ((appModules as readonly string[]).includes(moduleCode)) {
    return appModuleLabels[moduleCode as AppModule];
  }

  return moduleCode;
};

export const AuditoriaPage = () => {
  const { tenantId } = useTenant();
  const { canRead } = usePermissions();
  const canReadAuditoria = canRead("auditoria");

  const {
    logs,
    users,
    usersById,
    moduleOptions,
    actionOptions,
    filters,
    setFilters,
    resetFilters,
    isLoading,
    feedback,
    clearFeedback,
    reload,
    exportCsv,
  } = useAuditoriaModule(tenantId);

  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);

  if (!tenantId) {
    return (
      <section className="ui-panel p-8 text-center text-sm text-slate-500 dark:text-slate-400">
        No hay un comercio activo.
      </section>
    );
  }

  if (!canReadAuditoria) {
    return (
      <section className="ui-panel p-8 text-center text-sm text-slate-500 dark:text-slate-400">
        No tienes permisos de lectura para este módulo.
      </section>
    );
  }

  return (
    <div className="ui-page operational-page auditoria-page space-y-4 w-full min-w-0 max-w-full">
      {/* Encabezado Principal Flotante Moderno */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
            <span className="text-slate-400 dark:text-slate-500">ANÁLISIS</span>
            <span className="text-slate-400 dark:text-slate-500 font-bold">›</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold">AUDITORÍA DEL SISTEMA</span>
          </div>

          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Auditoría
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Registro cronológico de acciones sensibles por usuario y módulo.
          </p>
        </div>

        {/* Fila de Botones Píldora */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={() => {
              clearFeedback();
              setDetailLog(null);
              resetFilters();
            }}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <FilterX className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <span>Limpiar filtros</span>
          </button>

          <button
            type="button"
            onClick={() => {
              clearFeedback();
              setDetailLog(null);
              void reload();
            }}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <RefreshCw className={cn("h-4 w-4 text-slate-500 dark:text-slate-400", isLoading && "animate-spin")} />
            <span>Actualizar</span>
          </button>

          <button
            type="button"
            onClick={exportCsv}
            disabled={isLoading || !logs.length}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </header>

      {/* Barra de Filtros Integrada */}
      <section className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
        <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))
            }
            className="w-full rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-100"
          />

          <input
            type="date"
            value={filters.dateTo}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, dateTo: event.target.value }))
            }
            className="w-full rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-100"
          />

          <select
            value={filters.userId}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, userId: event.target.value }))
            }
            className="w-full rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-100 cursor-pointer"
          >
            <option value="">Todos los usuarios</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name}
              </option>
            ))}
          </select>

          <select
            value={filters.module}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, module: event.target.value }))
            }
            className="w-full rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-100 cursor-pointer"
          >
            <option value="">Todos los módulos</option>
            {moduleOptions.map((moduleCode) => (
              <option key={moduleCode} value={moduleCode}>
                {resolveModuleLabel(moduleCode)}
              </option>
            ))}
          </select>

          <select
            value={filters.action}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, action: event.target.value }))
            }
            className="w-full rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-100 cursor-pointer"
          >
            <option value="">Todas las acciones</option>
            {actionOptions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-mono">
            {logs.length} registro{logs.length === 1 ? "" : "s"} encontrado{logs.length === 1 ? "" : "s"}
          </span>
        </div>
      </section>

      {feedback ? (
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm font-medium",
            feedback.type === "success" ? "ui-success-state" : "ui-error-state"
          )}
        >
          {feedback.message}
        </div>
      ) : null}

      {isLoading ? (
        <LoadingState message="Cargando auditoría..." />
      ) : logs.length ? (
        <div className="ui-table-wrap rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50/90 dark:bg-slate-800/70 border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className="px-3.5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">Fecha</th>
                <th className="px-3.5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">Usuario</th>
                <th className="px-3.5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">Módulo</th>
                <th className="px-3.5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">Acción</th>
                <th className="px-3.5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">Descripción</th>
                <th className="px-3.5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">Detalle</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
              {logs.map((log) => {
                const hasMetadata = Boolean(log.metadata && Object.keys(log.metadata).length);
                const isDetailOpen = detailLog?.id === log.id;

                return (
                  <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-3.5 py-3 align-top font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="px-3.5 py-3 align-top font-medium text-slate-900 dark:text-slate-100">
                      {log.user_id ? usersById.get(log.user_id) ?? log.user_id : "Sistema"}
                    </td>
                    <td className="px-3.5 py-3 align-top text-slate-700 dark:text-slate-300">
                      {resolveModuleLabel(log.module)}
                    </td>
                    <td className="px-3.5 py-3 align-top">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200/70 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/80 font-mono">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 align-top text-slate-700 dark:text-slate-300 max-w-md">
                      {log.description}
                    </td>
                    <td className="px-3.5 py-3 text-right align-top">
                      <button
                        type="button"
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-semibold transition-all cursor-pointer border",
                          isDetailOpen
                            ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                            : "border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        )}
                        onClick={() => setDetailLog(isDetailOpen ? null : log)}
                        disabled={!hasMetadata}
                      >
                        {isDetailOpen ? "Ocultar" : "Ver"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState message="No hay registros de auditoría para los filtros seleccionados." />
      )}

      {/* Detalle ampliado del log */}
      {detailLog ? (
        <section className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4 animate-in fade-in duration-150">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Detalle del log</h2>
            <button
              type="button"
              className="rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-all cursor-pointer"
              onClick={() => setDetailLog(null)}
            >
              Cerrar detalle
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-700/80 dark:bg-slate-800/50">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Fecha</span>
              <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">{formatDateTime(detailLog.created_at)}</span>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-700/80 dark:bg-slate-800/50">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Usuario</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{detailLog.user_id ? usersById.get(detailLog.user_id) ?? detailLog.user_id : "Sistema"}</span>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-700/80 dark:bg-slate-800/50">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Módulo</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{resolveModuleLabel(detailLog.module)}</span>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-700/80 dark:bg-slate-800/50">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Acción</span>
              <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 font-mono">{detailLog.action}</span>
            </div>
          </div>

          <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">{detailLog.description}</p>

          <pre className="max-h-96 overflow-auto rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4 text-xs font-mono text-slate-800 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-200">
            {JSON.stringify(detailLog.metadata ?? {}, null, 2)}
          </pre>
        </section>
      ) : null}
    </div>
  );
};