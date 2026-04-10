import { useAuthStore } from "@/features/auth/store/auth.store";
import type { AppModule } from "@/types/modules";
import type { PermissionLevel } from "@/types/permissions";

export const usePermissions = () => {
  const profile = useAuthStore((state) => state.permissionProfile);
  const hasPermission = useAuthStore((state) => state.hasPermission);

  const can = (module: AppModule, level: PermissionLevel = "read") =>
    hasPermission(module, level);

  return {
    profile,
    can,
    canRead: (module: AppModule) => can(module, "read"),
    canWrite: (module: AppModule) => can(module, "write"),
  };
};