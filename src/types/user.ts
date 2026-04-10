import type { PermissionProfile } from "@/types/permissions";

export interface AppUser {
  id: string;
  email: string | null;
  username: string | null;
  fullName: string;
  role: string;
  tenantId: string;
  isActive: boolean;
  permissionProfileId: string | null;
  permissionProfileName: string | null;
  permissions: PermissionProfile;
}
