import type { AppModule } from "@/types/modules";
import type { PermissionLevel, PermissionProfile } from "@/types/permissions";
import type { Tenant } from "@/types/tenant";
import type { AppUser } from "@/types/user";

export interface AuthState {
  isAuthenticated: boolean;
  user: AppUser | null;
  tenantId: string | null;
  tenant: Tenant | null;
  permissionProfileId: string | null;
  permissionProfileName: string | null;
  permissionProfile: PermissionProfile;
}

export interface SetSessionPayload {
  user: AppUser;
  tenant: Tenant;
}

export interface PermissionCheckInput {
  module: AppModule;
  level?: PermissionLevel;
}
