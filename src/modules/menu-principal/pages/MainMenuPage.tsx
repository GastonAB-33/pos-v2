import { PagePlaceholder } from "@/components/ui/PagePlaceholder";

export const MainMenuPage = () => {
  return (
    <PagePlaceholder
      title="Menu principal"
      description="Panel informativo general para todo el sistema."
    >
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <article className="ui-card space-y-3 xl:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900">Novedades del sistema</h3>
            <span className="ui-badge ui-badge--info">Comunicado oficial</span>
          </div>
          <p className="text-sm text-slate-700">
            Esta seccion esta reservada para comunicados globales del sistema publicados por administracion central.
          </p>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-sm font-medium text-slate-900">Sin novedades publicadas</p>
            <p className="mt-1 text-xs text-slate-500">
              Cuando exista un anuncio oficial, aparecera aqui para todos los clientes.
            </p>
          </div>
        </article>

        <article className="ui-card space-y-2">
          <h3 className="text-base font-semibold text-slate-900">Area de soporte</h3>
          <p className="text-sm text-slate-700">
            Canal destinado a incidencias tecnicas, consultas funcionales y seguimiento de casos.
          </p>
        </article>

        <article className="ui-card space-y-2">
          <h3 className="text-base font-semibold text-slate-900">Area de tareas</h3>
          <p className="text-sm text-slate-700">
            Espacio para organizar solicitudes, pendientes y prioridades operativas del sistema.
          </p>
        </article>

        <article className="ui-card space-y-2">
          <h3 className="text-base font-semibold text-slate-900">Area de chat</h3>
          <p className="text-sm text-slate-700">
            Seccion para comunicacion rapida entre usuarios y coordinacion de acciones del dia.
          </p>
        </article>

        <article className="ui-card space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900">Manuales</h3>
            <span className="ui-badge ui-badge--warn">Proximamente</span>
          </div>
          <p className="text-sm text-slate-700">
            Los manuales estaran disponibles en una plataforma externa integrada en una proxima version.
          </p>
        </article>
      </div>
    </PagePlaceholder>
  );
};
