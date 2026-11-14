import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Calendar,
  ChevronDown,
  Package,
  Sliders,
  type LucideIcon,
} from "lucide-react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { routePaths } from "@/config/routes";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { isSupportOperator } from "@/features/support/support-operator";
import { useDeviceProfile } from "@/hooks/useDeviceProfile";
import { usePosNavigation } from "@/hooks/usePosNavigation";
import { useUiStore } from "@/store/ui.store";
import type { AppModule } from "@/types/modules";
import { cn } from "@/utils/cn";
import { JirehLogo } from "@/components/brand/JirehLogo";

// Icono caja registradora / terminal de ventas idéntico a la referencia
const CashRegisterIcon = ({ size = 18, className }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn("shrink-0", className)}
    style={{ width: `${size}px`, height: `${size}px` }}
    aria-hidden="true"
  >
    <rect x="7" y="2" width="10" height="5" rx="1" />
    <path d="M10 7v2h4V7" />
    <path d="M4 9h16l1.5 8H2.5L4 9z" />
    <circle cx="8" cy="12.5" r="0.75" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12.5" r="0.75" fill="currentColor" stroke="none" />
    <circle cx="16" cy="12.5" r="0.75" fill="currentColor" stroke="none" />
    <circle cx="8" cy="15" r="0.75" fill="currentColor" stroke="none" />
    <circle cx="12" cy="15" r="0.75" fill="currentColor" stroke="none" />
    <circle cx="16" cy="15" r="0.75" fill="currentColor" stroke="none" />
    <rect x="2" y="17" width="20" height="5" rx="1.5" />
    <line x1="10" y1="19.5" x2="14" y2="19.5" />
  </svg>
);

// Icono comprobante / contable con signo peso
const AccountingDocIcon = ({ size = 16, className }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn("h-4 w-4 shrink-0", className)}
    style={{ width: `${size}px`, height: `${size}px` }}
    aria-hidden="true"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M11.5 13a1.5 1.5 0 0 0-1.5-1.5H8.5a1.5 1.5 0 0 0 0 3h2a1.5 1.5 0 0 1 0 3H8.5a1.5 1.5 0 0 1-1.5-1.5" />
    <line x1="9.5" y1="10.5" x2="9.5" y2="18.5" />
  </svg>
);

interface SidebarItem {
  label: string;
  to: string;
  module: AppModule;
}

interface SidebarGroup {
  id: string;
  label: string;
  icon: LucideIcon | React.ComponentType<{ size?: number; className?: string }>;
  collapsible: boolean;
  defaultExpanded: boolean;
  items: SidebarItem[];
}

const quickAccessItem: SidebarItem = {
  label: "Punto de Venta",
  to: routePaths.pos,
  module: "pos",
};

const sidebarGroups: SidebarGroup[] = [
  {
    id: "agenda",
    label: "Agenda",
    icon: Calendar,
    collapsible: true,
    defaultExpanded: true,
    items: [
      { label: "Clientes", to: routePaths.clientes, module: "clientes" },
      { label: "Proveedores", to: routePaths.proveedores, module: "proveedores" },
      { label: "Empleados", to: routePaths.empleados, module: "empleados" },
    ],
  },
  {
    id: "catalogo",
    label: "Inventario",
    icon: Package,
    collapsible: true,
    defaultExpanded: true,
    items: [
      { label: "Productos", to: routePaths.productos, module: "productos" },
      { label: "Stock", to: routePaths.stock, module: "stock" },
      { label: "Compras a proveedores", to: routePaths.compras, module: "compras" },
    ],
  },
  {
    id: "contable",
    label: "Contable",
    icon: AccountingDocIcon as unknown as LucideIcon,
    collapsible: true,
    defaultExpanded: true,
    items: [
      { label: "Caja diaria", to: routePaths.caja, module: "caja" },
      { label: "Caja general", to: routePaths.cajaGeneral, module: "caja_general" },
      { label: "Cta. cte. clientes", to: routePaths.cuentasCorrientes, module: "cuentas_corrientes" },
      { label: "Cta. cte. proveedores", to: routePaths.cuentasCorrientesProveedores, module: "cuentas_corrientes_proveedores" },
      { label: "Bancos", to: routePaths.bancos, module: "bancos" },
      { label: "Facturación", to: routePaths.facturacion, module: "facturacion" },
    ],
  },
  {
    id: "analisis",
    label: "Análisis",
    icon: BarChart3,
    collapsible: true,
    defaultExpanded: true,
    items: [
      { label: "Estadísticas", to: routePaths.dashboard, module: "dashboard" },
      { label: "Reportes", to: routePaths.reportes, module: "reportes" },
      { label: "Auditoría", to: routePaths.auditoria, module: "auditoria" },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    icon: Sliders,
    collapsible: true,
    defaultExpanded: true,
    items: [
      { label: "Configuración", to: routePaths.configuracionSistema, module: "configuracion" },
      { label: "Usuarios", to: routePaths.usuarios, module: "usuarios" },
      { label: "Alta de comercio", to: routePaths.altaComercio, module: "configuracion" },
      { label: "Centro soporte", to: routePaths.centroSoporte, module: "configuracion" },
      { label: "Mis consultas", to: routePaths.misConsultas, module: "configuracion" },
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
  const sidebarPinned = useUiStore((state) => state.sidebarPinned);
  const sidebarHovered = useUiStore((state) => state.sidebarHovered);
  const setSidebarHovered = useUiStore((state) => state.setSidebarHovered);
  const theme = useUiStore((state) => state.theme);
  const sidebarTheme = useUiStore((state) => state.sidebarTheme);

  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (isDesktop && !sidebarPinned) {
      if (leaveTimerRef.current) {
        clearTimeout(leaveTimerRef.current);
        leaveTimerRef.current = null;
      }
      setSidebarHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (isDesktop && !sidebarPinned) {
      if (leaveTimerRef.current) {
        clearTimeout(leaveTimerRef.current);
      }
      leaveTimerRef.current = setTimeout(() => {
        setSidebarHovered(false);
      }, 180);
    }
  };

  useEffect(() => {
    return () => {
      if (leaveTimerRef.current) {
        clearTimeout(leaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isDesktop || sidebarPinned || !sidebarHovered) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && !target.closest(".app-sidebar") && !target.closest(".app-menu-button")) {
        setSidebarHovered(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isDesktop, sidebarPinned, sidebarHovered, setSidebarHovered]);

  const isSidebarDark =
    sidebarTheme === "dark" ||
    (sidebarTheme === "auto" && (theme === "dark" || theme === "midnight"));

  const isItemActive = (to: string) =>
    location.pathname === to ||
    location.pathname.startsWith(`${to}/`) ||
    (to === routePaths.configuracionSistema && location.pathname === routePaths.configuracion) ||
    (to === routePaths.facturacion && location.pathname === routePaths.comprobantes) ||
    (to === routePaths.productos &&
      (location.pathname === routePaths.listasPrecios ||
        location.pathname.startsWith(`${routePaths.listasPrecios}/`) ||
        location.pathname === routePaths.promociones ||
        location.pathname.startsWith(`${routePaths.promociones}/`)));

  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(() => {
    const activeGroup = sidebarGroups.find((group) =>
      group.items.some((item) => isItemActive(item.to))
    );
    const defaultGroup = activeGroup ?? sidebarGroups.find((group) => group.defaultExpanded);
    return defaultGroup?.id ?? null;
  });

  useEffect(() => {
    const activeGroup = sidebarGroups.find((group) =>
      group.items.some((item) => isItemActive(item.to))
    );
    if (!activeGroup) return;

    setExpandedGroupId(activeGroup.id);
  }, [location.pathname]);

  const { openPos, getPosUrl } = usePosNavigation();

  const handleOpenPos = () => {
    openPos();
    closeDrawerAfterNavigation();
  };

  const closeDrawerAfterNavigation = () => {
    if (!isDesktop) {
      setSidebarOpen(false);
    } else if (!sidebarPinned) {
      setSidebarHovered(false);
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
            if (item.module === "facturacion") {
              return canRead("facturacion") || canRead("comprobantes");
            }
            return canRead(item.module);
          }),
        }))
        .filter((group) => group.items.length > 0),
    [canRead, supportOperator]
  );

  const canReadPos = canRead(quickAccessItem.module);

  const effectiveSidebarDataTheme =
    sidebarTheme === "auto"
      ? theme === "midnight"
        ? "midnight"
        : theme === "dark"
        ? "dark"
        : "light"
      : sidebarTheme;

  return (
    <aside
      className="app-sidebar select-none"
      data-sidebar-theme={effectiveSidebarDataTheme}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
            {/* Cabecera con Logo */}
      <button
        type="button"
        className={cn(
          "app-sidebar-brand flex w-full items-center border-b px-4 py-3.5 text-left transition",
          isSidebarDark
            ? "border-slate-800/80 hover:bg-white/5"
            : "border-slate-200/80 hover:bg-slate-50/80"
        )}
        data-sidebar-theme={effectiveSidebarDataTheme}
        onClick={() => {
          closeDrawerAfterNavigation();
          navigate(routePaths.menuPrincipal);
        }}
      >
        <JirehLogo size="sm" showTagline={true} variant={isSidebarDark ? "light" : "default"} />
      </button>

      {/* Navegación */}
      <nav className="app-sidebar-nav space-y-4 px-3 py-3.5">
        {/* Acceso Rápido - Punto de Venta */}
        {canReadPos ? (
          <section className="space-y-1.5">
            <p className="px-3.5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
              Acceso Rápido
            </p>
            <Link
              to={getPosUrl()}
              onClick={(e) => {
                if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
                  e.preventDefault();
                  handleOpenPos();
                }
              }}
              className="group relative flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 px-3.5 py-2.5 text-white shadow-md shadow-blue-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/30 hover:brightness-105 active:scale-[0.98]"
              title="Abrir Punto de venta (POS Inteligente)"
            >
              <span className="flex items-center gap-2.5 text-[13.5px] font-semibold text-white tracking-tight">
                <CashRegisterIcon className="h-4 w-4 shrink-0 text-white" />
                <span>Punto de Venta</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-white/90 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </section>
        ) : null}

        {/* Grupos de Navegación */}
        <div className="space-y-1">
          {visibleGroups.map((group) => {
            const isExpanded = expandedGroupId === group.id;
            const isGroupActive = group.items.some((item) => isItemActive(item.to));
            const GroupIcon = group.icon;

            return (
              <section key={group.id} className="space-y-0.5">
                {/* Botón Encabezado de Grupo */}
                <button
                  type="button"
                  onClick={() => {
                    if (!group.collapsible) return;
                    setExpandedGroupId((current) => (current === group.id ? null : group.id));
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left transition-all duration-150",
                    isGroupActive
                      ? "bg-blue-50/80 hover:bg-blue-100/70 text-blue-600 dark:bg-blue-950/40 dark:hover:bg-blue-950/60 dark:text-blue-400 font-bold"
                      : "text-slate-700 hover:bg-slate-100/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/50 dark:hover:text-white"
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    {isGroupActive ? (
                      <span className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />
                    ) : (
                      <GroupIcon size={16} className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                    )}
                    <span
                      className={cn(
                        "transition-colors",
                        isGroupActive
                          ? "text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400"
                          : "text-[13.5px] font-medium text-slate-700 dark:text-slate-300"
                      )}
                    >
                      {isGroupActive ? group.label.toUpperCase() : group.label}
                    </span>
                  </span>

                  <ChevronDown
                    size={15}
                    className={cn(
                      "shrink-0 transition-transform duration-200",
                      isGroupActive
                        ? "text-blue-600 dark:text-blue-400 rotate-180"
                        : isExpanded
                        ? "text-slate-400 dark:text-slate-500 rotate-180"
                        : "text-slate-400 dark:text-slate-500 rotate-0"
                    )}
                  />
                </button>

                {/* Submenú desplegable con línea guía vertical */}
                <div
                  className={cn(
                    "overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out will-change-[max-height,opacity]",
                    isExpanded ? "max-h-[540px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
                  )}
                >
                  <div
                    className={cn(
                      "relative ml-[1.05rem] pl-3 border-l-2 space-y-0.5 py-1",
                      isGroupActive
                        ? "border-blue-100 dark:border-blue-900/50"
                        : "border-slate-200/80 dark:border-slate-800"
                    )}
                  >
                    {group.items.map((item) => {
                      const active = isItemActive(item.to);
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={closeDrawerAfterNavigation}
                          className={cn(
                            "group flex w-full items-center justify-between rounded-xl px-3 py-2 text-[13.5px] transition-all duration-150",
                            active
                              ? "bg-blue-600 font-medium text-white shadow-xs"
                              : "font-normal text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/40 dark:hover:text-slate-100"
                          )}
                        >
                          <span className="truncate">{item.label}</span>
                          {active ? (
                            <span className="h-1.5 w-1.5 rounded-full bg-white ml-2 shrink-0 shadow-xs" />
                          ) : null}
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </nav>
    </aside>
  );
};
