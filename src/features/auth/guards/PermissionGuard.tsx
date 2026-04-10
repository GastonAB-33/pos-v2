import type { PropsWithChildren } from "react";
import { Navigate } from "react-router-dom";
import { routePaths } from "@/config/routes";
import { useAuthStore } from "@/features/auth/store/auth.store";
import type { AppModule } from "@/types/modules";
import type { PermissionLevel } from "@/types/permissions";

interface PermissionGuardProps extends PropsWithChildren {
  module: AppModule;
  level?: PermissionLevel;
}

export const PermissionGuard = ({ module, level = "read", children }: PermissionGuardProps) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const tenantId = useAuthStore((state) => state.tenantId);
  const hasPermission = useAuthStore((state) => state.hasPermission);

  if (!isAuthenticated || !user || !tenantId) {
    return <Navigate to={routePaths.login} replace />;
  }

  if (!user.isActive) {
    return <Navigate to={routePaths.login} replace />;
  }

  if (!hasPermission(module, level)) {
    return <Navigate to={routePaths.unauthorized} replace />;
  }

  return <>{children}</>;
};
