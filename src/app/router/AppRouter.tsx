import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { AppLayout } from "@/app/layouts/AppLayout";
import { moduleRoutes } from "@/app/router/module-routes";
import { withOptionalPermission } from "@/app/router/route-helpers";
import { routePaths } from "@/config/routes";
import { AuthGuard } from "@/features/auth/guards/AuthGuard";
import { useLandingPath } from "@/features/auth/hooks/useLandingPath";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { LoginPage } from "@/modules/usuarios/pages/LoginPage";
import { UnauthorizedPage } from "@/modules/usuarios/pages/UnauthorizedPage";
import { LandingPage } from "@/features/landing/LandingPage";
import { getTenantSlugFromRecord, normalizeTenantSlug } from "@/utils/tenant-slug";


const TenantSlugGateway = () => {
  const { tenantSlug } = useParams<{ tenantSlug?: string }>();
  const location = useLocation();
  const landingPath = useLandingPath();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const tenant = useAuthStore((state) => state.tenant);
  const tenantId = useAuthStore((state) => state.tenantId);
  const normalizedSlug = normalizeTenantSlug(tenantSlug);

  if (!normalizedSlug) {
    return <Navigate to={routePaths.login} replace />;
  }

  const tenantLoginPath = `/${normalizedSlug}/login`;
  if (!isAuthenticated || !user?.isActive || !tenantId || !tenant) {
    return <Navigate to={tenantLoginPath} replace state={{ from: location.pathname }} />;
  }

  if (getTenantSlugFromRecord(tenant) !== normalizedSlug) {
    return <Navigate to={tenantLoginPath} replace state={{ from: location.pathname }} />;
  }

  const slugPrefix = `/${tenantSlug ?? normalizedSlug}`;
  const internalPath = location.pathname.startsWith(slugPrefix)
    ? location.pathname.slice(slugPrefix.length) || landingPath
    : landingPath;

  return <Navigate to={internalPath === "/" ? landingPath : internalPath} replace />;
};

export const AppRouter = () => {
  return (
    <Routes>
      {/* 1. Landing Page pública oficial en la raíz / y en /landing */}
      <Route path={routePaths.home} element={<LandingPage />} />
      <Route path={routePaths.landing} element={<LandingPage />} />

      {/* 2. Acceso y autenticación */}
      <Route path={routePaths.login} element={<LoginPage />} />
      <Route path="/:tenantSlug/login" element={<LoginPage />} />
      <Route path={routePaths.unauthorized} element={<UnauthorizedPage />} />

      {/* 3. Módulos del sistema protegidos por AuthGuard */}
      <Route
        element={
          <AuthGuard>
            <AppLayout />
          </AuthGuard>
        }
      >
        {moduleRoutes.map((route) => (
          <Route key={route.path} path={route.path.slice(1)} element={withOptionalPermission(route)} />
        ))}
      </Route>

      {/* 4. Gateway por comercio y fallback */}
      <Route path="/:tenantSlug/*" element={<TenantSlugGateway />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
