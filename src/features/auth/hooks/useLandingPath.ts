import { useMemo } from "react";
import { moduleRoutes } from "@/app/router/module-routes";
import { routePaths } from "@/config/routes";
import { useAuthStore } from "@/features/auth/store/auth.store";

export const useLandingPath = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const tenantId = useAuthStore((state) => state.tenantId);
  const hasPermission = useAuthStore((state) => state.hasPermission);

  return useMemo(() => {
    if (!isAuthenticated || !user || !tenantId || !user.isActive) {
      return routePaths.login;
    }

    const canAccessMainMenu = moduleRoutes.some((route) => route.path === routePaths.menuPrincipal);
    if (canAccessMainMenu) {
      return routePaths.menuPrincipal;
    }

    const firstAllowed = moduleRoutes.find((route) => {
      if (!route.requiredPermission) return true;
      return hasPermission(route.requiredPermission.module, route.requiredPermission.level ?? "read");
    });

    return firstAllowed?.path ?? routePaths.unauthorized;
  }, [hasPermission, isAuthenticated, tenantId, user]);
};
