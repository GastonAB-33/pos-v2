import type { PropsWithChildren } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { routePaths } from "@/config/routes";
import { isDevAuthBypassEnabled } from "@/features/auth/config/dev-auth";
import { useAuthStore } from "@/features/auth/store/auth.store";

export const AuthGuard = ({ children }: PropsWithChildren) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const tenantId = useAuthStore((state) => state.tenantId);
  const location = useLocation();

  if (isDevAuthBypassEnabled && isAuthenticated && user?.isActive && tenantId) {
    return <>{children}</>;
  }

  if (!isAuthenticated || !user || !tenantId) {
    return <Navigate to={routePaths.login} replace state={{ from: location.pathname }} />;
  }

  if (!user.isActive) {
    return <Navigate to={routePaths.login} replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
};
