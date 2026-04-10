import type { JSX } from "react";
import type { ModuleRouteItem } from "@/app/router/types";
import { PermissionGuard } from "@/features/auth/guards/PermissionGuard";

export const withOptionalPermission = (route: ModuleRouteItem): JSX.Element => {
  if (!route.requiredPermission) {
    return <route.Component />;
  }

  return (
    <PermissionGuard
      module={route.requiredPermission.module}
      level={route.requiredPermission.level ?? "read"}
    >
      <route.Component />
    </PermissionGuard>
  );
};