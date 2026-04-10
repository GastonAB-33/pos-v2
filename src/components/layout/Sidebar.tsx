import { useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { routePaths } from "@/config/routes";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import type { AppModule } from "@/types/modules";
import { cn } from "@/utils/cn";

interface SidebarItem {
  label: string;
  to: string;
  module: AppModule;
}

interface SidebarGroup {
  id: string;
  label: string;
  collapsible: boolean;
  defaultExpanded: boolean;
  items: SidebarItem[];
}

const quickAccessItem: SidebarItem = {
  label: "POS",
  to: routePaths.pos,
  module: "pos",
};

const sidebarGroups: SidebarGroup[] = [
  {
    id: "agenda",
    label: "Agenda",
    collapsible: true,
    defaultExpanded: true,
    items: [
      { label: "Clientes", to: routePaths.clientes, module: "clientes" },
      { label: "Proveedores", to: routePaths.proveedores, module: "proveedores" },
    ],
  },
  {
    id: "catalogo",
    label: "Catalogo",
    collapsible: true,
    defaultExpanded: true,
    items: [
      { label: "Productos", to: routePaths.productos, module: "productos" },
      { label: "Stock", to: routePaths.stock, module: "stock" },
      { label: "Listas de precios", to: routePaths.listasPrecios, module: "listas_precios" },
      { label: "Promociones", to: routePaths.promociones, module: "promociones" },
      { label: "Compras", to: routePaths.compras, module: "compras" },
    ],
  },
  {
    id: "contable",
    label: "Contable",
    collapsible: true,
    defaultExpanded: true,
    items: [
      { label: "Caja", to: routePaths.caja, module: "caja" },
      { label: "Cuentas corrientes", to: routePaths.cuentasCorrientes, module: "cuentas_corrientes" },
      { label: "Comprobantes", to: routePaths.comprobantes, module: "comprobantes" },
      { label: "Medios de pago", to: routePaths.mediosPago, module: "medios_pago" },
      { label: "Facturacion", to: routePaths.facturacion, module: "facturacion" },
    ],
  },
  {
    id: "analisis",
    label: "Analisis",
    collapsible: true,
    defaultExpanded: true,
    items: [
      { label: "Estadisticas", to: routePaths.dashboard, module: "dashboard" },
      { label: "Reportes", to: routePaths.reportes, module: "reportes" },
      { label: "Auditoria", to: routePaths.auditoria, module: "auditoria" },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    collapsible: true,
    defaultExpanded: true,
    items: [
      { label: "Usuarios", to: routePaths.usuarios, module: "usuarios" },
      { label: "Configuracion", to: routePaths.configuracion, module: "configuracion" },
    ],
  },
];

export const Sidebar = () => {
  const location = useLocation();
  const { canRead } = usePermissions();

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sidebarGroups.map((group) => [group.id, group.defaultExpanded]))
  );

  const openPosInNewTab = () => {
    if (typeof window === "undefined") return;

    const posUrl = new URL(quickAccessItem.to, window.location.origin);
    posUrl.searchParams.set("from", "panel-web");
    posUrl.searchParams.set("view", "browser");
    const opened = window.open("", "_blank");
    if (!opened) {
      window.alert(
        "No se pudo abrir una nueva pestana web para POS. Habilita popups para este sitio e intenta de nuevo."
      );
      return;
    }

    opened.opener = null;
    const safeTitle = `${quickAccessItem.label} Web`;
    const safeUrl = posUrl.toString();
    opened.document.open();
    opened.document.write(`<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #f1f5f9; }
      iframe { width: 100%; height: 100%; border: 0; display: block; background: #fff; }
    </style>
  </head>
  <body>
    <iframe src="${safeUrl}" title="${safeTitle}" referrerpolicy="no-referrer"></iframe>
  </body>
</html>`);
    opened.document.close();
  };

  const isItemActive = (to: string) =>
    location.pathname === to || location.pathname.startsWith(`${to}/`);

  const visibleGroups = useMemo(
    () =>
      sidebarGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => canRead(item.module)),
        }))
        .filter((group) => group.items.length > 0),
    [canRead]
  );

  const canReadPos = canRead(quickAccessItem.module);

  return (
    <aside className="app-sidebar">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">POS V2</p>
        <p className="mt-1 text-lg font-semibold text-slate-900">Panel Operativo</p>
      </div>

      <nav className="space-y-5 p-3">
        {canReadPos ? (
          <section className="space-y-2">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Acceso rapido
            </p>
            <button
              type="button"
              onClick={openPosInNewTab}
              className={cn(
                "flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-semibold transition",
                isItemActive(quickAccessItem.to)
                  ? "border-brand-500/40 bg-brand-500/15 text-slate-900"
                  : "border-brand-500/30 bg-brand-500/10 text-slate-700 hover:bg-brand-500/20 hover:text-slate-900"
              )}
            >
              <span>{quickAccessItem.label}</span>
              <span className="ui-badge ui-badge--info text-[10px]">LIVE</span>
            </button>
          </section>
        ) : null}

        {visibleGroups.map((group) => {
          const isExpanded = expandedGroups[group.id] ?? true;

          return (
            <section key={group.id} className="space-y-1">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-2 py-1 text-left"
                onClick={() => {
                  if (!group.collapsible) return;
                  setExpandedGroups((previous) => ({
                    ...previous,
                    [group.id]: !previous[group.id],
                  }));
                }}
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {group.label}
                </span>
                <span
                  className={cn(
                    "ml-auto text-xs text-slate-500 transition-transform",
                    isExpanded ? "rotate-180" : "rotate-0"
                  )}
                >
                  v
                </span>
              </button>

              {isExpanded ? (
                <div className="space-y-1 pl-2">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={() =>
                        cn(
                          "block rounded-r-lg border-l-2 px-3 py-2 text-sm transition",
                          isItemActive(item.to)
                            ? "border-brand-500 bg-brand-500/15 text-slate-900"
                            : "border-transparent text-slate-600 hover:border-brand-500 hover:bg-slate-50"
                        )
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </nav>
    </aside>
  );
};
