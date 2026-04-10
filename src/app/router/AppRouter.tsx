import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/app/layouts/AppLayout";
import { moduleRoutes } from "@/app/router/module-routes";
import { withOptionalPermission } from "@/app/router/route-helpers";
import { routePaths } from "@/config/routes";
import { AuthGuard } from "@/features/auth/guards/AuthGuard";
import { useLandingPath } from "@/features/auth/hooks/useLandingPath";
import { LoginPage } from "@/modules/usuarios/pages/LoginPage";
import { UnauthorizedPage } from "@/modules/usuarios/pages/UnauthorizedPage";

const InitialRedirect = () => {
  const landingPath = useLandingPath();
  return <Navigate to={landingPath} replace />;
};

export const AppRouter = () => {
  return (
    <Routes>
      <Route path={routePaths.login} element={<LoginPage />} />
      <Route path={routePaths.unauthorized} element={<UnauthorizedPage />} />

      <Route
        path={routePaths.home}
        element={
          <AuthGuard>
            <AppLayout />
          </AuthGuard>
        }
      >
        <Route index element={<InitialRedirect />} />
        {moduleRoutes.map((route) => (
          <Route key={route.path} path={route.path.slice(1)} element={withOptionalPermission(route)} />
        ))}
      </Route>

      <Route path="*" element={<InitialRedirect />} />
    </Routes>
  );
};
