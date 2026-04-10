import type { ComponentType } from "react";
import type { PermissionRequirement } from "@/types/permissions";

export interface ModuleRouteItem {
  path: string;
  Component: ComponentType;
  requiredPermission?: PermissionRequirement;
}