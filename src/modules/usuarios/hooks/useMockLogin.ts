import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { permissionProfilesService } from "@/services/permission-profiles.service";
import { dataProvider } from "@/services/config/data-provider";
import { tenantsService } from "@/services/tenants.service";
import { usersService } from "@/services/users.service";
import type { PermissionProfileRecord, TenantRecord, UserRecord } from "@/types/entities";
import { appModules } from "@/types/modules";
import {
  createDefaultPermissionProfile,
  normalizePermissionProfile,
  type PermissionProfile,
} from "@/types/permissions";

interface OptionItem {
  value: string;
  label: string;
}

interface SessionValidationResult {
  ok: boolean;
  message?: string;
}

const DEV_TENANT_LOGIN = "demo";
const DEV_TENANT_TRADE_NAME = "Demo";
const DEV_TENANT_LEGAL_NAME = "Demo SA";
const DEV_TENANT_CUIT = "30-00000000-0";
const DEV_ADMIN_USERNAME = "admin";
const DEV_ADMIN_PASSWORD = "admin123";
const DEV_ADMIN_EMAIL = "admin@demo.local";
const DEV_ADMIN_FULL_NAME = "Administrador Demo";

const createFullPermissionProfile = (): PermissionProfile => {
  const profile = createDefaultPermissionProfile();
  for (const module of appModules) {
    profile[module] = { read: true, write: true };
  }
  return profile;
};

const isDemoTenantRecord = (tenant: TenantRecord): boolean => {
  return (
    tenant.cuit === DEV_TENANT_CUIT ||
    tenant.trade_name.trim().toLowerCase() === DEV_TENANT_TRADE_NAME.toLowerCase()
  );
};

const ensureAdminProfileAndUser = async (tenant: TenantRecord) => {
  if (dataProvider !== "mock") return;

  const allProfiles = await permissionProfilesService.getAllByTenant(tenant.id);
  let adminProfile =
    allProfiles.find((profile) => profile.name.trim().toLowerCase() === "administrador") ?? null;

  if (!adminProfile) {
    adminProfile = await permissionProfilesService.create(tenant.id, {
      name: "Administrador",
      description: "Perfil bootstrap de desarrollo",
      is_active: true,
      permissions: createFullPermissionProfile(),
    });
  } else {
    const nextPermissions = createFullPermissionProfile();
    adminProfile =
      (await permissionProfilesService.update(tenant.id, adminProfile.id, {
        is_active: true,
        permissions: nextPermissions,
      })) ?? adminProfile;
  }

  const allUsers = await usersService.getAllByTenant(tenant.id);
  const adminUser =
    allUsers.find((user) => user.username?.trim().toLowerCase() === DEV_ADMIN_USERNAME) ?? null;

  if (!adminUser) {
    await usersService.create(tenant.id, {
      email: DEV_ADMIN_EMAIL,
      username: DEV_ADMIN_USERNAME,
      full_name: DEV_ADMIN_FULL_NAME,
      role_code: "owner",
      permission_profile_id: adminProfile.id,
      is_active: true,
    });
    return;
  }

  await usersService.update(tenant.id, adminUser.id, {
    is_active: true,
    email: adminUser.email ?? DEV_ADMIN_EMAIL,
    full_name: adminUser.full_name || DEV_ADMIN_FULL_NAME,
    permission_profile_id: adminProfile.id,
  });
};

const ensureDemoTenant = async (): Promise<TenantRecord[]> => {
  const tenants = await tenantsService.getAll();
  if (dataProvider !== "mock") return tenants;

  let demoTenant = tenants.find(isDemoTenantRecord) ?? null;
  if (!demoTenant) {
    demoTenant = await tenantsService.create({
      legal_name: DEV_TENANT_LEGAL_NAME,
      trade_name: DEV_TENANT_TRADE_NAME,
      cuit: DEV_TENANT_CUIT,
      is_active: true,
    });
  }

  await ensureAdminProfileAndUser(demoTenant);
  const refreshed = await tenantsService.getAll();
  return refreshed;
};

const resolveProfileOrError = (
  profilesById: Map<string, PermissionProfileRecord>,
  user: UserRecord
): SessionValidationResult & { profile?: PermissionProfileRecord } => {
  if (!user.permission_profile_id) {
    return { ok: false, message: "El usuario no tiene perfil de permisos asignado" };
  }

  const profile = profilesById.get(user.permission_profile_id);
  if (!profile) {
    return { ok: false, message: "No se encontro el perfil de permisos asignado" };
  }

  if (!profile.is_active) {
    return { ok: false, message: "El perfil de permisos asignado esta inactivo" };
  }

  return { ok: true, profile };
};

export const useMockLogin = () => {
  const setSession = useAuthStore((state) => state.setSession);

  const [tenantId, setTenantId] = useState("");
  const [userId, setUserId] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [tenantInput, setTenantInput] = useState(DEV_TENANT_LOGIN);
  const [usernameInput, setUsernameInput] = useState(DEV_ADMIN_USERNAME);
  const [passwordInput, setPasswordInput] = useState(DEV_ADMIN_PASSWORD);
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [profilesById, setProfilesById] = useState<Map<string, PermissionProfileRecord>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === tenantId) ?? null,
    [tenantId, tenants]
  );

  const selectedUser = useMemo(
    () => users.find((user) => user.id === userId) ?? null,
    [userId, users]
  );

  const tenantOptions = useMemo<OptionItem[]>(
    () =>
      tenants
        .slice()
        .sort((a, b) => a.trade_name.localeCompare(b.trade_name))
        .map((tenant) => ({
          value: tenant.id,
          label: tenant.is_active ? tenant.trade_name : `${tenant.trade_name} (inactivo)`,
        })),
    [tenants]
  );

  const filteredUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    if (!term) return users;

    return users.filter((user) =>
      [user.full_name, user.email ?? "", user.username ?? ""].join(" ").toLowerCase().includes(term)
    );
  }, [userSearch, users]);

  const userOptions = useMemo<OptionItem[]>(
    () =>
      filteredUsers.map((user) => {
        const profile = profilesById.get(user.permission_profile_id);
        const statusLabel = user.is_active ? "" : " (inactivo)";
        const profileLabel = profile?.name ? ` · ${profile.name}` : " · sin perfil";
        return {
          value: user.id,
          label: `${user.full_name}${statusLabel}${profileLabel}`,
        };
      }),
    [filteredUsers, profilesById]
  );

  const loadTenants = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const loadedTenants = await ensureDemoTenant();
      const sortedTenants = [...loadedTenants].sort((a, b) =>
        a.trade_name.localeCompare(b.trade_name)
      );

      setTenants(sortedTenants);
      if (!sortedTenants.length) {
        setTenantId("");
        setUserId("");
        return;
      }

      const preferredDemo = sortedTenants.find(isDemoTenantRecord);
      setTenantId((current) => {
        if (current && sortedTenants.some((tenant) => tenant.id === current)) return current;
        if (preferredDemo) return preferredDemo.id;
        return (sortedTenants.find((tenant) => tenant.is_active) ?? sortedTenants[0]).id;
      });
    } catch {
      setError("No se pudieron cargar tenants para login mock");
      setTenants([]);
      setTenantId("");
      setUserId("");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadUsersAndProfiles = useCallback(
    async (selectedTenantId: string) => {
      if (!selectedTenantId) {
        setUsers([]);
        setProfilesById(new Map());
        setUserId("");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const tenant = tenants.find((item) => item.id === selectedTenantId);
        if (!tenant) {
          setError("Tenant inexistente");
          setUsers([]);
          setProfilesById(new Map());
          setUserId("");
          return;
        }

        if (!tenant.is_active) {
          setError("El tenant seleccionado esta inactivo");
        }

        await ensureAdminProfileAndUser(tenant);

        const [tenantUsers, tenantProfiles] = await Promise.all([
          usersService.getAllByTenant(selectedTenantId),
          permissionProfilesService.getAllByTenant(selectedTenantId),
        ]);

        const sortedUsers = [...tenantUsers].sort((a, b) => a.full_name.localeCompare(b.full_name));
        const profilesMap = new Map(tenantProfiles.map((profile) => [profile.id, profile]));

        setUsers(sortedUsers);
        setProfilesById(profilesMap);

        setUserId((current) => {
          if (current && sortedUsers.some((user) => user.id === current)) return current;
          const demoAdmin = sortedUsers.find(
            (user) => user.username?.toLowerCase() === DEV_ADMIN_USERNAME
          );
          if (demoAdmin) return demoAdmin.id;

          const preferred = sortedUsers.find((user) => user.is_active) ?? sortedUsers[0];
          return preferred?.id ?? "";
        });
      } catch {
        setError("No se pudieron cargar usuarios/perfiles del tenant");
        setUsers([]);
        setProfilesById(new Map());
        setUserId("");
      } finally {
        setIsLoading(false);
      }
    },
    [tenants]
  );

  useEffect(() => {
    void loadTenants();
  }, [loadTenants]);

  useEffect(() => {
    void loadUsersAndProfiles(tenantId);
  }, [loadUsersAndProfiles, tenantId]);

  const applySession = (tenant: TenantRecord, user: UserRecord, profile: PermissionProfileRecord) => {
    const effectivePermissions = normalizePermissionProfile(profile.permissions);

    setSession({
      tenant: tenantsService.toTenant(tenant),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.full_name,
        role: user.role_code ?? "staff",
        tenantId: tenant.id,
        isActive: user.is_active,
        permissionProfileId: profile.id,
        permissionProfileName: profile.name,
        permissions: effectivePermissions,
      },
    });
  };

  const validateSelectedSession = (): SessionValidationResult & { profile?: PermissionProfileRecord } => {
    if (!selectedTenant) {
      return { ok: false, message: "Tenant no encontrado" };
    }

    if (!selectedTenant.is_active) {
      return { ok: false, message: "El tenant esta inactivo" };
    }

    if (!selectedUser) {
      return { ok: false, message: "Usuario no encontrado" };
    }

    if (!selectedUser.is_active) {
      return { ok: false, message: "El usuario esta inactivo" };
    }

    return resolveProfileOrError(profilesById, selectedUser);
  };

  const loginWithCredentials = async (): Promise<boolean> => {
    if (dataProvider !== "mock") {
      setError("El login por credenciales demo solo esta disponible en modo mock");
      return false;
    }

    const normalizedTenant = tenantInput.trim().toLowerCase();
    const normalizedUsername = usernameInput.trim().toLowerCase();
    const password = passwordInput;

    if (
      normalizedTenant !== DEV_TENANT_LOGIN ||
      normalizedUsername !== DEV_ADMIN_USERNAME ||
      password !== DEV_ADMIN_PASSWORD
    ) {
      setError("Credenciales de desarrollo invalidas");
      return false;
    }

    const bootstrappedTenants = await ensureDemoTenant();
    const sortedBootstrappedTenants = [...bootstrappedTenants].sort((a, b) =>
      a.trade_name.localeCompare(b.trade_name)
    );
    setTenants(sortedBootstrappedTenants);

    const demoTenant = sortedBootstrappedTenants.find(isDemoTenantRecord) ?? null;
    if (!demoTenant) {
      setError("Tenant demo no disponible");
      return false;
    }

    if (!demoTenant.is_active) {
      setError("El tenant demo esta inactivo");
      return false;
    }

    await ensureAdminProfileAndUser(demoTenant);

    const tenantUsers = await usersService.getAllByTenant(demoTenant.id);
    const tenantProfiles = await permissionProfilesService.getAllByTenant(demoTenant.id);
    const localProfilesById = new Map(tenantProfiles.map((profile) => [profile.id, profile]));

    const demoUser =
      tenantUsers.find((user) => user.username?.toLowerCase() === DEV_ADMIN_USERNAME) ?? null;
    if (!demoUser) {
      setError("Usuario admin demo no disponible");
      return false;
    }

    if (!demoUser.is_active) {
      setError("El usuario admin demo esta inactivo");
      return false;
    }

    const profileValidation = resolveProfileOrError(localProfilesById, demoUser);
    if (!profileValidation.ok || !profileValidation.profile) {
      setError(profileValidation.message ?? "Perfil de permisos invalido");
      return false;
    }

    setTenantId(demoTenant.id);
    setUserId(demoUser.id);
    setUsers(tenantUsers.sort((a, b) => a.full_name.localeCompare(b.full_name)));
    setProfilesById(localProfilesById);

    applySession(demoTenant, demoUser, profileValidation.profile);
    return true;
  };

  const loginFromSelectors = async (): Promise<boolean> => {
    const validation = validateSelectedSession();
    if (!validation.ok || !validation.profile || !selectedTenant || !selectedUser) {
      setError(validation.message ?? "No se pudo iniciar sesion");
      return false;
    }

    applySession(selectedTenant, selectedUser, validation.profile);
    return true;
  };

  const login = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const hasCredentialInput =
        tenantInput.trim().length > 0 ||
        usernameInput.trim().length > 0 ||
        passwordInput.trim().length > 0;

      if (hasCredentialInput) {
        return await loginWithCredentials();
      }

      return await loginFromSelectors();
    } catch {
      setError("No se pudo iniciar sesion mock");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const loginAsDemoAdmin = async () => {
    setTenantInput(DEV_TENANT_LOGIN);
    setUsernameInput(DEV_ADMIN_USERNAME);
    setPasswordInput(DEV_ADMIN_PASSWORD);
    return login();
  };

  const demoCredentials = {
    tenant: DEV_TENANT_LOGIN,
    username: DEV_ADMIN_USERNAME,
    password: DEV_ADMIN_PASSWORD,
  };

  return {
    tenantId,
    setTenantId,
    userId,
    setUserId,
    userSearch,
    setUserSearch,
    tenantInput,
    setTenantInput,
    usernameInput,
    setUsernameInput,
    passwordInput,
    setPasswordInput,
    tenantOptions,
    userOptions,
    selectedTenant,
    selectedUser,
    isLoading,
    isSubmitting,
    error,
    clearError,
    reload: loadTenants,
    login,
    loginAsDemoAdmin,
    demoCredentials,
    canSubmit: Boolean(tenantId && userId) || Boolean(usernameInput.trim() && passwordInput.trim()),
    hasTenants: tenants.length > 0,
    hasUsers: users.length > 0,
  };
};

