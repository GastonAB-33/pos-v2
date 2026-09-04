import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Building2,
  ChevronDown,
  ClipboardList,
  Package,
  ShoppingCart,
  Tags,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { routePaths } from "@/config/routes";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { isSupportOperator } from "@/features/support/support-operator";
import { useDeviceProfile } from "@/hooks/useDeviceProfile";
import { useUiStore } from "@/store/ui.store";
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
  icon: LucideIcon;
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
    icon: ClipboardList,
    collapsible: true,
    defaultExpanded: true,
    items: [
      { label: "Clientes", to: routePaths.clientes, module: "clientes" },
      { label: "Proveedores", to: routePaths.proveedores, module: "proveedores" },
      { label: "Configuracion", to: routePaths.configuracionAgenda, module: "configuracion_agenda" },
    ],
  },
  {
    id: "catalogo",
    label: "Catalogo",
    icon: Package,
    collapsible: true,
    defaultExpanded: true,
    items: [
      { label: "Productos", to: routePaths.productos, module: "productos" },
      { label: "Stock", to: routePaths.stock, module: "stock" },
      { label: "Listas de precios", to: routePaths.listasPrecios, module: "listas_precios" },
      { label: "Promociones", to: routePaths.promociones, module: "promociones" },
      { label: "Compras a proveedores", to: routePaths.compras, module: "compras" },
      { label: "Configuracion", to: routePaths.configuracionCatalogo, module: "configuracion_catalogo" },
    ],
  },
  {
    id: "contable",
    label: "Contable",
    icon: WalletCards,
    collapsible: true,
    defaultExpanded: true,
    items: [
      { label: "Caja", to: routePaths.caja, module: "caja" },
      { label: "Cuentas corrientes", to: routePaths.cuentasCorrientes, module: "cuentas_corrientes" },
      { label: "Comprobantes", to: routePaths.comprobantes, module: "comprobantes" },
      { label: "Medios de pago", to: routePaths.mediosPago, module: "medios_pago" },
      { label: "Facturacion", to: routePaths.facturacion, module: "facturacion" },
      { label: "Configuracion", to: routePaths.configuracionContable, module: "configuracion_contable" },
    ],
  },
  {
    id: "analisis",
    label: "Analisis",
    icon: BarChart3,
    collapsible: true,
    defaultExpanded: true,
    items: [
      { label: "Estadisticas", to: routePaths.dashboard, module: "dashboard" },
      { label: "Reportes", to: routePaths.reportes, module: "reportes" },
      { label: "Auditoria", to: routePaths.auditoria, module: "auditoria" },
      { label: "Configuracion", to: routePaths.configuracionAnalisis, module: "configuracion_analisis" },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    icon: Tags,
    collapsible: true,
    defaultExpanded: true,
    items: [
      { label: "Usuarios", to: routePaths.usuarios, module: "usuarios" },
      { label: "Alta de comercio", to: routePaths.altaComercio, module: "configuracion_sistema" },
      { label: "Centro soporte", to: routePaths.centroSoporte, module: "configuracion_sistema" },
      { label: "Mis consultas", to: routePaths.misConsultas, module: "configuracion_sistema" },
      { label: "Configuracion", to: routePaths.configuracionSistema, module: "configuracion_sistema" },
    ],
  },
];

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { canRead } = usePermissions();
  const supportOperator = isSupportOperator(user);
  const { isDesktop } = useDeviceProfile();
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);

  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(() => {
    const activeGroup = sidebarGroups.find((group) =>
      group.items.some(
        (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
      )
    );
    const defaultGroup = activeGroup ?? sidebarGroups.find((group) => group.defaultExpanded);
    return defaultGroup?.id ?? null;
  });

  useEffect(() => {
    const activeGroup = sidebarGroups.find((group) =>
      group.items.some(
        (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
      )
    );
    if (!activeGroup) return;

    setExpandedGroupId(activeGroup.id);
  }, [location.pathname]);

  const handleOpenPos = () => {
    navigate(quickAccessItem.to);
    closeDrawerAfterNavigation();
  };

  const isItemActive = (to: string) =>
    location.pathname === to || location.pathname.startsWith(`${to}/`);

  const closeDrawerAfterNavigation = () => {
    if (!isDesktop) {
      setSidebarOpen(false);
    }
  };

  const visibleGroups = useMemo(
    () =>
      sidebarGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => {
            const isSupportCenterItem = item.to === routePaths.centroSoporte;
            if (isSupportCenterItem && !supportOperator) return false;
            const isTenantOnboardingItem = item.to === routePaths.altaComercio;
            if (isTenantOnboardingItem && !supportOperator) return false;
            return canRead(item.module);
          }),
        }))
        .filter((group) => group.items.length > 0),
    [canRead, supportOperator]
  );

  const canReadPos = canRead(quickAccessItem.module);

  return (
    <aside className="app-sidebar">
      <button
        type="button"
        className="app-sidebar-brand w-full border-b border-slate-200 px-4 py-4 text-left transition hover:bg-slate-50"
        onClick={() => {
          closeDrawerAfterNavigation();
          navigate(routePaths.menuPrincipal);
        }}
      >
        <span className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--ui-accent)] text-white">
            <Building2 aria-hidden="true" size={18} />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-900">Gestion POS</span>
            <span className="mt-0.5 block text-[11px] font-medium text-slate-500">Panel operativo</span>
          </span>
        </span>
      </button>

      <nav className="app-sidebar-nav space-y-5 p-3">
        {canReadPos ? (
          <section className="space-y-2">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Acceso rapido
            </p>
            <button
              type="button"
              onClick={handleOpenPos}
              className={cn(
                "app-sidebar-pos flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm font-semibold transition",
                isItemActive(quickAccessItem.to)
                  ? "border-brand-500/40 bg-brand-500/15 text-slate-900"
                  : "border-brand-500/30 bg-brand-500/10 text-slate-700 hover:bg-brand-500/20 hover:text-slate-900"
              )}
            >
              <span className="flex items-center gap-2"><ShoppingCart aria-hidden="true" size={16} /> Punto de venta</span>
            </button>
          </section>
        ) : null}

        {visibleGroups.map((group) => {
          const isExpanded = expandedGroupId === group.id;
          const GroupIcon = group.icon;

          return (
            <section key={group.id} className="space-y-1">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-2 py-1 text-left"
                onClick={() => {
                  if (!group.collapsible) return;
                  setExpandedGroupId((current) => current === group.id ? null : group.id);
                }}
              >
                <GroupIcon aria-hidden="true" size={14} className="text-slate-500" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{group.label}</span>
                <ChevronDown
                  aria-hidden="true"
                  size={15}
                  className={cn(
                    "ml-auto text-xs text-slate-500 transition-transform",
                    isExpanded ? "rotate-180" : "rotate-0"
                  )}
                />
              </button>

              <div
                className={cn(
                  "overflow-hidden transition-[max-height,opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[max-height,opacity,transform]",
                  isExpanded
                    ? "max-h-[520px] translate-y-0 opacity-100"
                    : "max-h-0 -translate-y-1 opacity-0"
                )}
              >
                <div className="space-y-1 pl-2 pt-1">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={closeDrawerAfterNavigation}
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
              </div>
            </section>
          );
        })}
      </nav>
    </aside>
  );
};
