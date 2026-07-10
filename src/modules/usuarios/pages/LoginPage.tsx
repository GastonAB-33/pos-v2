import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { routePaths } from "@/config/routes";
import { isDevAuthBypassEnabled } from "@/features/auth/config/dev-auth";
import { useLandingPath } from "@/features/auth/hooks/useLandingPath";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useMockLogin } from "@/modules/usuarios/hooks/useMockLogin";
import { dataProvider } from "@/services/config/data-provider";
import { tenantsService } from "@/services/tenants.service";
import { normalizeTenantSlug } from "@/utils/tenant-slug";

export const LoginPage = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const sessionTenantId = useAuthStore((state) => state.tenantId);
  const { tenantSlug } = useParams<{ tenantSlug?: string }>();
  const location = useLocation();
  const landingPath = useLandingPath();
  const normalizedTenantSlug = normalizeTenantSlug(tenantSlug);
  const [publicTenantName, setPublicTenantName] = useState<string | null>(null);
  const [tenantSlugError, setTenantSlugError] = useState<string | null>(null);
  const [isTenantSlugLoading, setIsTenantSlugLoading] = useState(false);
  const {
    tenantId,
    setTenantId,
    userId,
    setUserId,
    userSearch,
    setUserSearch,
    tenantInput,
    setTenantInput,
    usernameInput,
    setUsernameInput,
    passwordInput,
    setPasswordInput,
    tenantOptions,
    userOptions,
    selectedTenant,
    selectedUser,
    isLoading,
    isSubmitting,
    error,
    clearError,
    reload,
    login,
    loginAsDemoAdmin,
    demoCredentials,
    canSubmit,
    hasTenants,
    hasUsers,
  } = useMockLogin(normalizedTenantSlug);

  const hasValidSession = Boolean(isAuthenticated && user && user.isActive && sessionTenantId);

  useEffect(() => {
    let isMounted = true;

    const loadTenant = async () => {
      if (!normalizedTenantSlug) {
        setPublicTenantName(null);
        setTenantSlugError(null);
        setIsTenantSlugLoading(false);
        return;
      }

      setIsTenantSlugLoading(true);
      setTenantSlugError(null);

      try {
        const tenant = await tenantsService.getPublicBySlug(normalizedTenantSlug);
        if (!isMounted) return;

        if (!tenant) {
          setPublicTenantName(null);
          setTenantSlugError("El enlace del comercio no existe o no esta disponible");
          return;
        }

        if (!tenant.is_active) {
          setPublicTenantName(tenant.trade_name);
          setTenantSlugError("Este comercio esta inactivo. Contacta a soporte.");
          return;
        }

        setPublicTenantName(tenant.trade_name);
      } catch {
        if (!isMounted) return;
        setPublicTenantName(null);
        setTenantSlugError("No se pudo validar el enlace del comercio");
      } finally {
        if (isMounted) setIsTenantSlugLoading(false);
      }
    };

    void loadTenant();

    return () => {
      isMounted = false;
    };
  }, [normalizedTenantSlug]);

  if (hasValidSession && landingPath !== routePaths.login && location.pathname !== landingPath) {
    return <Navigate to={landingPath} replace />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-panel">
        <h1 className="text-2xl font-semibold text-slate-900">
          {publicTenantName ? `Ingresar a ${publicTenantName}` : "Ingresar a POS V2"}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {normalizedTenantSlug
            ? "Acceso privado del comercio"
            : dataProvider === "supabase"
              ? "Acceso del comercio"
              : "Acceso de desarrollo"}
        </p>

        {dataProvider === "mock" ? (
          <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">
          <p className="font-semibold">Acceso de desarrollo</p>
          <p className="mt-1">Comercio: <span className="font-kpi">{demoCredentials.tenant}</span></p>
          <p>Usuario: <span className="font-kpi">{demoCredentials.username}</span></p>
          <p>Contrasena: <span className="font-kpi">{demoCredentials.password}</span></p>
          <button
            type="button"
            className="ui-btn-primary mt-4 w-full"
            onClick={() => {
              clearError();
              void loginAsDemoAdmin();
            }}
            disabled={isLoading || isSubmitting}
          >
            Ingresar como Admin Demo
          </button>
          </div>
        ) : null}

        {isDevAuthBypassEnabled ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Bypass de auth en desarrollo activo (VITE_DEV_AUTH_BYPASS=true).
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {tenantSlugError ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {tenantSlugError}
          </div>
        ) : null}

        <form
          className="mt-5 space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            await login();
          }}
        >
          <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <h2 className="text-sm font-semibold text-slate-900">
              {dataProvider === "supabase" ? "Ingreso con email" : "Ingreso manual"}
            </h2>
            <label className="grid gap-1 text-xs font-medium text-slate-600" htmlFor="tenantInput">
              Comercio
              <input
                id="tenantInput"
                value={tenantInput}
                onChange={(event) => {
                  clearError();
                  setTenantInput(event.target.value);
                }}
                className="ui-input"
                disabled={isLoading || isSubmitting}
                placeholder="Comercio"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600" htmlFor="usernameInput">
              {dataProvider === "supabase" ? "Usuario (email)" : "Usuario"}
              <input
                id="usernameInput"
                value={usernameInput}
                onChange={(event) => {
                  clearError();
                  setUsernameInput(event.target.value);
                }}
                className="ui-input"
                disabled={isLoading || isSubmitting}
                placeholder={dataProvider === "supabase" ? "Email" : "Usuario"}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600" htmlFor="passwordInput">
              Contrasena
              <input
                id="passwordInput"
                type="password"
                value={passwordInput}
                onChange={(event) => {
                  clearError();
                  setPasswordInput(event.target.value);
                }}
                className="ui-input"
                disabled={isLoading || isSubmitting}
                placeholder="Contrasena"
              />
            </label>
            <button
              type="submit"
              className="ui-btn-primary w-full"
              disabled={!canSubmit || isLoading || isSubmitting || isTenantSlugLoading || Boolean(tenantSlugError)}
            >
              {isTenantSlugLoading ? "Validando comercio..." : isSubmitting ? "Ingresando..." : "Ingresar"}
            </button>
          </section>

          {dataProvider === "mock" ? (
          <details className="rounded-lg border border-slate-200 p-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">
              Opciones avanzadas (comercio/usuario)
            </summary>
            <div className="mt-3 space-y-3">
              <select
                id="tenantId"
                value={tenantId}
                onChange={(event) => {
                  clearError();
                  setTenantId(event.target.value);
                }}
                className="ui-input"
                disabled={isLoading || isSubmitting || !hasTenants}
              >
                <option value="">Seleccionar comercio</option>
                {tenantOptions.map((tenant) => (
                  <option key={tenant.value} value={tenant.value}>
                    {tenant.label}
                  </option>
                ))}
              </select>
              <input
                id="userSearch"
                value={userSearch}
                onChange={(event) => {
                  clearError();
                  setUserSearch(event.target.value);
                }}
                placeholder="Buscar usuario"
                className="ui-input"
                disabled={isLoading || isSubmitting || !hasUsers}
              />
              <select
                id="userId"
                value={userId}
                onChange={(event) => {
                  clearError();
                  setUserId(event.target.value);
                }}
                className="ui-input"
                disabled={isLoading || isSubmitting || !hasUsers}
              >
                <option value="">Seleccionar usuario</option>
                {userOptions.map((user) => (
                  <option key={user.value} value={user.value}>
                    {user.label}
                  </option>
                ))}
              </select>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <p>Comercio: {selectedTenant ? selectedTenant.trade_name : "-"}</p>
                <p>Usuario: {selectedUser ? selectedUser.full_name : "-"}</p>
              </div>
            </div>
          </details>
          ) : null}

          <div className="flex items-center">
            <button
              type="button"
              onClick={() => {
                clearError();
                void reload();
              }}
              className="ui-btn-ghost"
              disabled={isLoading || isSubmitting}
            >
              Recargar datos
            </button>
          </div>
        </form>

        {dataProvider === "mock" && !hasTenants ? (
          <p className="mt-4 text-xs text-slate-500">
            No hay comercios cargados. En mock se bootstrappea automaticamente el comercio demo.
          </p>
        ) : null}

        {dataProvider === "mock" && !hasUsers && tenantId ? (
          <p className="mt-2 text-xs text-slate-500">
            No hay usuarios para el comercio seleccionado.
          </p>
        ) : null}

        <p className="mt-4 text-xs text-slate-500">
          Ruta protegida de ejemplo:{" "}
          <Link to={routePaths.dashboard} className="text-brand-700">
            Estadisticas
          </Link>
        </p>
      </section>
    </main>
  );
};
