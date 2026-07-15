import { useState } from "react";
import { EmptyState, LoadingState } from "@/components/ui/UiStates";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { IconButton } from "@/components/ui/IconButton";
import { Download, FilterX, RefreshCw } from "lucide-react";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { useAuditoriaModule } from "@/modules/auditoria/hooks/useAuditoriaModule";
import { appModuleLabels, appModules, type AppModule } from "@/types/modules";
import type { AuditLog } from "@/types/entities";

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
      <PagePlaceholder
        title="Auditoria"
        description="No hay un comercio activo"
      />
    );
  }

  if (!canReadAuditoria) {
    return (
      <PagePlaceholder
        title="Auditoria"
        description="No tenes permisos de lectura para este modulo"
      />
    );
  }

  return (
    <PagePlaceholder
      title="Auditoria"
      description="Registro de acciones sensibles por usuario y modulo"
    >
      <div className="space-y-4">
        <section className="ui-card space-y-3">
          <div className="grid gap-3 md:grid-cols-5">
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))
              }
              className="ui-input"
            />

            <input
              type="date"
              value={filters.dateTo}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, dateTo: event.target.value }))
              }
              className="ui-input"
            />

            <select
              value={filters.userId}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, userId: event.target.value }))
              }
              className="ui-input"
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
              className="ui-input"
            >
              <option value="">Todos los modulos</option>
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
              className="ui-input"
            >
              <option value="">Todas las acciones</option>
              {actionOptions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">Resultados: {logs.length}</p>
            <div className="flex items-center gap-2">
              <IconButton
                icon={FilterX}
                label="Limpiar filtros"
                onClick={() => {
                  clearFeedback();
                  setDetailLog(null);
                  resetFilters();
                }}
              />

              <IconButton
                icon={RefreshCw}
                label="Recargar auditoría"
                onClick={() => {
                  clearFeedback();
                  setDetailLog(null);
                  void reload();
                }}
                loading={isLoading}
              />

              <button
                type="button"
                className="ui-btn-primary"
                onClick={exportCsv}
                disabled={isLoading || !logs.length}
              >
                <Download aria-hidden="true" className="h-4 w-4" />
                Exportar CSV
              </button>
            </div>
          </div>
        </section>

        {feedback ? (
          <div className={feedback.type === "success" ? "ui-success-state" : "ui-error-state"}>
            {feedback.message}
          </div>
        ) : null}

        {isLoading ? (
          <LoadingState message="Cargando auditoria..." />
        ) : logs.length ? (
          <section className="ui-table-wrap">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">Fecha</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">Usuario</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">Modulo</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">Accion</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">Descripcion</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-700">Detalle</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 bg-white">
                {logs.map((log) => {
                  const hasMetadata = Boolean(log.metadata && Object.keys(log.metadata).length);
                  const isDetailOpen = detailLog?.id === log.id;

                  return (
                    <tr key={log.id}>
                      <td className="px-3 py-2 align-top text-slate-700">{formatDateTime(log.created_at)}</td>
                      <td className="px-3 py-2 align-top text-slate-700">
                        {log.user_id ? usersById.get(log.user_id) ?? log.user_id : "Sistema"}
                      </td>
                      <td className="px-3 py-2 align-top text-slate-700">{resolveModuleLabel(log.module)}</td>
                      <td className="px-3 py-2 align-top text-slate-700">
                        <span className="ui-badge ui-badge--info">{log.action}</span>
                      </td>
                      <td className="px-3 py-2 align-top text-slate-700">{log.description}</td>
                      <td className="px-3 py-2 text-right align-top">
                        <button
                          type="button"
                          className="ui-btn-ghost"
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
          </section>
        ) : (
          <EmptyState message="No hay registros de auditoria para los filtros seleccionados." />
        )}

        {detailLog ? (
          <section className="ui-card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">Detalle del log</h2>
              <button type="button" className="ui-btn-ghost" onClick={() => setDetailLog(null)}>
                Cerrar
              </button>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <p className="text-sm text-slate-600">
                <span className="font-medium text-slate-900">Fecha:</span>{" "}
                {formatDateTime(detailLog.created_at)}
              </p>
              <p className="text-sm text-slate-600">
                <span className="font-medium text-slate-900">Usuario:</span>{" "}
                {detailLog.user_id ? usersById.get(detailLog.user_id) ?? detailLog.user_id : "Sistema"}
              </p>
              <p className="text-sm text-slate-600">
                <span className="font-medium text-slate-900">Modulo:</span> {resolveModuleLabel(detailLog.module)}
              </p>
              <p className="text-sm text-slate-600">
                <span className="font-medium text-slate-900">Accion:</span> {detailLog.action}
              </p>
            </div>

            <p className="text-sm text-slate-700">{detailLog.description}</p>

            <pre className="max-h-96 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              {JSON.stringify(detailLog.metadata ?? {}, null, 2)}
            </pre>
          </section>
        ) : null}
      </div>
    </PagePlaceholder>
  );
};
