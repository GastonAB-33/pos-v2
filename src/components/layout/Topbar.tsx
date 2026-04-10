import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/useToast";
import { routePaths } from "@/config/routes";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useOffline } from "@/features/offline/hooks/useOffline";
import { usePwa } from "@/features/pwa/hooks/usePwa";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { useUiStore } from "@/store/ui.store";

const routeLabels: Array<{ path: string; label: string }> = [
  { path: routePaths.dashboard, label: "Estadisticas" },
  { path: routePaths.clientes, label: "Clientes" },
  { path: routePaths.proveedores, label: "Proveedores" },
  { path: routePaths.productos, label: "Productos" },
  { path: routePaths.stock, label: "Stock" },
  { path: routePaths.listasPrecios, label: "Listas de precios" },
  { path: routePaths.promociones, label: "Promociones" },
  { path: routePaths.compras, label: "Compras" },
  { path: routePaths.caja, label: "Caja" },
  { path: routePaths.cuentasCorrientes, label: "Cuentas corrientes" },
  { path: routePaths.comprobantes, label: "Comprobantes" },
  { path: routePaths.mediosPago, label: "Medios de pago" },
  { path: routePaths.facturacion, label: "Facturacion" },
  { path: routePaths.reportes, label: "Reportes" },
  { path: routePaths.auditoria, label: "Auditoria" },
  { path: routePaths.usuarios, label: "Usuarios" },
  { path: routePaths.configuracion, label: "Configuracion" },
];

export const Topbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const { tenant, tenantId } = useTenant();
  const {
    connectionState,
    isOnline,
    isSyncing,
    totalPendingCount,
    lastSyncMessage,
    lastSyncError,
    syncNow,
    clearSyncError,
  } = useOffline();
  const { canInstall, isInstalling, isInstalled, installApp, isInstallSupported } = usePwa();
  const theme = useUiStore((state) => state.theme);
  const toggleTheme = useUiStore((state) => state.toggleTheme);

  const currentTitle = useMemo(() => {
    const match = routeLabels.find(
      ({ path }) => location.pathname === path || location.pathname.startsWith(`${path}/`)
    );

    return match?.label ?? "Panel";
  }, [location.pathname]);

  const connectionLabel =
    connectionState === "syncing" ? "Sincronizando" : connectionState === "online" ? "Conectado" : "Sin conexion";
  const connectionBadgeClass =
    connectionState === "syncing"
      ? "ui-badge ui-badge--warn"
      : connectionState === "online"
        ? "ui-badge ui-badge--success"
        : "ui-badge ui-badge--danger";

  return (
    <header className="app-topbar">
      <div>
        <p className="text-[15px] font-semibold text-slate-900">{currentTitle}</p>
        <p className="text-xs text-slate-500">Tenant: {tenant?.tradeName ?? tenantId ?? "Sin tenant"}</p>
        {lastSyncMessage ? (
          <p className={`text-[11px] ${lastSyncError ? "text-red-600" : "text-slate-500"}`}>{lastSyncMessage}</p>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <span className={connectionBadgeClass}>{connectionLabel}</span>

        {totalPendingCount > 0 ? <span className="ui-badge ui-badge--info">Pendientes: {totalPendingCount}</span> : null}

        <button
          type="button"
          onClick={() => {
            clearSyncError();
            void syncNow();
          }}
          className="ui-btn-ghost text-xs"
          disabled={!isOnline || isSyncing || totalPendingCount === 0}
        >
          {lastSyncError ? "Reintentar sync" : "Sincronizar"}
        </button>

        {isInstallSupported && canInstall ? (
          <button
            type="button"
            onClick={() => {
              void installApp().then((accepted) => {
                if (accepted) {
                  toast.success("App instalada");
                }
              });
            }}
            className="ui-btn-ghost text-xs"
            disabled={isInstalling}
          >
            {isInstalling ? "Instalando..." : "Instalar app"}
          </button>
        ) : null}

        {isInstalled ? <span className="ui-badge ui-badge--info">App instalada</span> : null}

        <button
          type="button"
          onClick={() => {
            clearSession();
            navigate(routePaths.login, { replace: true });
          }}
          className="ui-btn-ghost text-xs"
        >
          Salir
        </button>

        <button type="button" onClick={toggleTheme} className="ui-btn-ghost text-xs">
          {theme === "dark" ? "Modo claro" : "Modo oscuro"}
        </button>

        <div className="text-right">
          <p className="text-sm font-medium text-slate-900">{user?.fullName ?? "Invitado"}</p>
          <p className="text-xs text-slate-500">{user?.email ?? "sin-sesion@local"}</p>
        </div>
      </div>
    </header>
  );
};
