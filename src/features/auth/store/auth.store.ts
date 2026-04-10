import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isDevAuthBypassEnabled } from "@/features/auth/config/dev-auth";
import type { AuthState, SetSessionPayload } from "@/types/auth";
import type { AppModule } from "@/types/modules";
import { appModules } from "@/types/modules";
import {
  createDefaultPermissionProfile,
  hasModulePermission,
  normalizePermissionProfile,
  type PermissionLevel,
  type PermissionProfile,
} from "@/types/permissions";
import type { Tenant } from "@/types/tenant";
import type { AppUser } from "@/types/user";
import { storageKeys } from "@/utils/local-storage";

interface AuthStore extends AuthState {
  setSession: (payload: SetSessionPayload) => void;
  syncCurrentUserAccess: (input: {
    permissionProfileId: string | null;
    permissionProfileName: string | null;
    permissions: PermissionProfile;
    isActive?: boolean;
  }) => void;
  syncCurrentUserIdentity: (input: Partial<Pick<AppUser, "fullName" | "email" | "username">>) => void;
  clearSession: () => void;
  hasPermission: (module: AppModule, level?: PermissionLevel) => boolean;
}

const createFullPermissionProfile = (): PermissionProfile => {
  const profile = createDefaultPermissionProfile();

  for (const module of appModules) {
    profile[module] = {
      read: true,
      write: true,
    };
  }

  return profile;
};

const createDevBypassTenant = (): Tenant => ({
  id: "tenant-demo-ar",
  legalName: "Tenant Demo Argentina SA",
  tradeName: "Tenant Demo AR",
  cuit: "30-00000000-0",
  isActive: true,
  createdAt: new Date(0).toISOString(),
  defaultBranchId: null,
  branches: [],
});

const createDevBypassUser = (permissions: PermissionProfile): AppUser => ({
  id: "user-dev-admin",
  email: "dev@pos.local",
  username: "dev-admin",
  fullName: "Desarrollo POS",
  role: "admin",
  tenantId: "tenant-demo-ar",
  isActive: true,
  permissionProfileId: "profile-dev-admin",
  permissionProfileName: "Administrador",
  permissions,
});

const buildSessionState = (user: AppUser, tenant: Tenant): AuthState => {
  const normalizedProfile = normalizePermissionProfile(user.permissions);
  const normalizedUser: AppUser = {
    ...user,
    tenantId: tenant.id,
    isActive: user.isActive ?? true,
    permissionProfileId: user.permissionProfileId ?? null,
    permissionProfileName: user.permissionProfileName ?? null,
    permissions: normalizedProfile,
  };

  return {
    isAuthenticated: true,
    user: normalizedUser,
    tenantId: tenant.id,
    tenant,
    permissionProfileId: normalizedUser.permissionProfileId,
    permissionProfileName: normalizedUser.permissionProfileName,
    permissionProfile: normalizedProfile,
  };
};

const createInitialAuthState = (): AuthState => {
  if (!isDevAuthBypassEnabled) {
    return {
      isAuthenticated: false,
      user: null,
      tenantId: null,
      tenant: null,
      permissionProfileId: null,
      permissionProfileName: null,
      permissionProfile: createDefaultPermissionProfile(),
    };
  }

  const permissionProfile = createFullPermissionProfile();
  const tenant = createDevBypassTenant();
  const user = createDevBypassUser(permissionProfile);

  return buildSessionState(user, tenant);
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      ...createInitialAuthState(),

      setSession: ({ user, tenant }) => {
        set(buildSessionState(user, tenant));
      },

      syncCurrentUserAccess: ({ permissionProfileId, permissionProfileName, permissions, isActive }) =>
        set((state) => {
          if (!state.user || !state.tenantId || !state.tenant) return state;

          const normalizedProfile = normalizePermissionProfile(permissions);

          return {
            ...state,
            isAuthenticated: isActive ?? state.user.isActive,
            user: {
              ...state.user,
              isActive: isActive ?? state.user.isActive,
              permissionProfileId,
              permissionProfileName,
              permissions: normalizedProfile,
            },
            permissionProfileId,
            permissionProfileName,
            permissionProfile: normalizedProfile,
          };
        }),

      syncCurrentUserIdentity: (input) =>
        set((state) => {
          if (!state.user) return state;
          return {
            ...state,
            user: {
              ...state.user,
              ...input,
            },
          };
        }),

      clearSession: () =>
        set(createInitialAuthState()),

      hasPermission: (module, level = "read") => {
        const profile = get().permissionProfile;
        return hasModulePermission(profile, { module, level });
      },
    }),
    {
      name: storageKeys.auth,
      partialize: (state) =>
        ({
          isAuthenticated: state.isAuthenticated,
          user: state.user,
          tenantId: state.tenantId,
          tenant: state.tenant,
          permissionProfileId: state.permissionProfileId,
          permissionProfileName: state.permissionProfileName,
          permissionProfile: state.permissionProfile,
        }) satisfies AuthState & { permissionProfile: PermissionProfile },
      onRehydrateStorage: () => (state) => {
        if (!state || !isDevAuthBypassEnabled) return;
        state.clearSession();
      },
    }
  )
);
