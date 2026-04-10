import { appModules, type AppModule } from "@/types/modules";

export const basePermissionLevels = ["read", "write"] as const;

export type BasePermissionLevel = (typeof basePermissionLevels)[number];
export type PermissionLevel = BasePermissionLevel | (string & {});

export type ModulePermissionSet = Partial<Record<PermissionLevel, boolean>>;
export type PermissionProfile = Partial<Record<AppModule, ModulePermissionSet>>;

export interface PermissionRequirement {
  module: AppModule;
  level?: PermissionLevel;
}

export const createDefaultPermissionProfile = (): PermissionProfile => {
  const profile = {} as PermissionProfile;

  for (const module of appModules) {
    profile[module] = { read: false, write: false };
  }

  return profile;
};

export const normalizePermissionProfile = (profile: PermissionProfile): PermissionProfile => {
  const base = createDefaultPermissionProfile();

  for (const module of appModules) {
    base[module] = {
      ...base[module],
      ...profile[module],
    };
  }

  return base;
};

export const hasModulePermission = (
  profile: PermissionProfile,
  requirement: PermissionRequirement
): boolean => {
  const level = requirement.level ?? "read";
  return Boolean(profile[requirement.module]?.[level]);
};