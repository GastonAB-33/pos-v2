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

const createFullPermissionProfile = (): PermissionProfile => {
  const profile = createDefaultPermissionProfile();

  for (const module of appModules) {
    profile[module] = { read: true, write: true };
  }

  return profile;
};

export const normalizePermissionProfile = (profile: PermissionProfile): PermissionProfile => {
  const maybeWildcard = profile as unknown as { all?: unknown };
  if (maybeWildcard?.all === true) {
    return createFullPermissionProfile();
  }

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
  const directPermission = Boolean(profile[requirement.module]?.[level]);
  if (directPermission) return true;

  const isScopedConfigModule = requirement.module.startsWith("configuracion_");
  if (!isScopedConfigModule) return false;

  // Compatibilidad: si el perfil aun no tiene los permisos nuevos por submodulo
  // pero si tiene el permiso legacy de configuracion, se habilita el acceso.
  return Boolean(profile.configuracion?.[level]);
};
