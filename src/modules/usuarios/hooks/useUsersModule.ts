import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { auditService } from "@/services/audit.service";
import { permissionProfilesService } from "@/services/permission-profiles.service";
import { usersService } from "@/services/users.service";
import type { PermissionProfileRecord, UserRecord } from "@/types/entities";
import { appModuleLabels, appModules } from "@/types/modules";
import {
  createDefaultPermissionProfile,
  normalizePermissionProfile,
  type PermissionProfile,
} from "@/types/permissions";
import type { PermissionProfileFormValues } from "@/modules/usuarios/schemas/permission-profile-form.schema";
import type { UserFormValues } from "@/modules/usuarios/schemas/user-form.schema";

type FeedbackType = "success" | "error";

interface CrudFeedback {
  type: FeedbackType;
  message: string;
}

const normalizeEmpty = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const createFullPermissionProfile = (): PermissionProfile => {
  const profile = createDefaultPermissionProfile();
  for (const module of appModules) {
    profile[module] = { read: true, write: true };
  }
  return profile;
};

const createBootstrapProfileInput = (): {
  name: string;
  description: string;
  is_active: boolean;
  permissions: PermissionProfile;
} => ({
  name: "Administrador",
  description: "Acceso completo al sistema",
  is_active: true,
  permissions: createFullPermissionProfile(),
});

const ensureAtLeastOneProfile = async (
  tenantId: string,
  profiles: PermissionProfileRecord[]
): Promise<PermissionProfileRecord[]> => {
  if (profiles.length) return profiles;

  await permissionProfilesService.create(tenantId, createBootstrapProfileInput());
  return permissionProfilesService.getAllByTenant(tenantId);
};

const isSameUser = (
  sessionUser: ReturnType<typeof useAuthStore.getState>["user"],
  record: UserRecord
) => {
  if (!sessionUser) return false;
  if (sessionUser.id === record.id) return true;
  if (sessionUser.email && record.email && sessionUser.email.toLowerCase() === record.email.toLowerCase()) {
    return true;
  }
  if (
    sessionUser.username &&
    record.username &&
    sessionUser.username.toLowerCase() === record.username.toLowerCase()
  ) {
    return true;
  }
  return false;
};

const resolveAuthProfileData = (
  profile: PermissionProfileRecord | null
): { permissionProfileId: string | null; permissionProfileName: string | null; permissions: PermissionProfile } => {
  if (!profile) {
    return {
      permissionProfileId: null,
      permissionProfileName: null,
      permissions: createDefaultPermissionProfile(),
    };
  }

  return {
    permissionProfileId: profile.id,
    permissionProfileName: profile.name,
    permissions: normalizePermissionProfile(profile.permissions),
  };
};

export const useUsersModule = (tenantId: string | null) => {
  const sessionUser = useAuthStore((state) => state.user);
  const syncCurrentUserAccess = useAuthStore((state) => state.syncCurrentUserAccess);
  const syncCurrentUserIdentity = useAuthStore((state) => state.syncCurrentUserIdentity);

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [profiles, setProfiles] = useState<PermissionProfileRecord[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [profileSearch, setProfileSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<CrudFeedback | null>(null);
  const auditUserId = sessionUser?.id ?? null;

  const clearFeedback = () => setFeedback(null);
  const logAudit = async (input: {
    module: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    description: string;
    metadata?: Record<string, unknown> | null;
  }) => {
    await auditService.createSafe(tenantId, {
      user_id: auditUserId,
      module: input.module,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      description: input.description,
      metadata: input.metadata ?? null,
    });
  };

  const loadData = useCallback(async () => {
    if (!tenantId) {
      setUsers([]);
      setProfiles([]);
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    try {
      const [usersList, profilesList] = await Promise.all([
        usersService.getAllByTenant(tenantId),
        permissionProfilesService.getAllByTenant(tenantId),
      ]);

      const ensuredProfiles = await ensureAtLeastOneProfile(tenantId, profilesList);
      const resolvedProfiles = [...ensuredProfiles].sort((a, b) => a.name.localeCompare(b.name));
      const resolvedUsers = [...usersList].sort((a, b) => a.full_name.localeCompare(b.full_name));

      setProfiles(resolvedProfiles);
      setUsers(resolvedUsers);
    } catch {
      setFeedback({ type: "error", message: "No se pudieron cargar usuarios y perfiles" });
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const profilesById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles]
  );

  const usersByProfileId = useMemo(() => {
    const map = new Map<string, number>();
    for (const user of users) {
      map.set(user.permission_profile_id, (map.get(user.permission_profile_id) ?? 0) + 1);
    }
    return map;
  }, [users]);

  const userRows = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    if (!term) return users;

    return users.filter((user) =>
      [user.full_name, user.email ?? "", user.username ?? ""].join(" ").toLowerCase().includes(term)
    );
  }, [userSearch, users]);

  const profileRows = useMemo(() => {
    const term = profileSearch.trim().toLowerCase();
    if (!term) return profiles;

    return profiles.filter((profile) =>
      [profile.name, profile.description ?? ""].join(" ").toLowerCase().includes(term)
    );
  }, [profileSearch, profiles]);

  const moduleRows = useMemo(
    () =>
      appModules.map((module) => ({
        module,
        label: appModuleLabels[module],
      })),
    []
  );

  const createProfile = async (
    values: PermissionProfileFormValues,
    permissions: PermissionProfile
  ) => {
    if (!tenantId) return;

    setIsSubmitting(true);
    try {
      const created = await permissionProfilesService.create(tenantId, {
        name: values.name.trim(),
        description: normalizeEmpty(values.description),
        is_active: values.isActive,
        permissions: normalizePermissionProfile(permissions),
      });
      await logAudit({
        module: "usuarios",
        action: "create_profile",
        entityType: "permission_profile",
        entityId: created.id,
        description: `Perfil creado: ${created.name}`,
        metadata: {
          is_active: created.is_active,
        },
      });

      setFeedback({ type: "success", message: "Perfil creado" });
      await loadData();
    } catch {
      setFeedback({ type: "error", message: "No se pudo crear el perfil" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateProfile = async (
    profileId: string,
    values: PermissionProfileFormValues,
    permissions: PermissionProfile
  ) => {
    if (!tenantId) return;

    setIsSubmitting(true);
    try {
      const updated = await permissionProfilesService.update(tenantId, profileId, {
        name: values.name.trim(),
        description: normalizeEmpty(values.description),
        is_active: values.isActive,
        permissions: normalizePermissionProfile(permissions),
      });
      if (updated) {
        await logAudit({
          module: "usuarios",
          action: "update_profile",
          entityType: "permission_profile",
          entityId: updated.id,
          description: `Perfil actualizado: ${updated.name}`,
          metadata: {
            is_active: updated.is_active,
          },
        });
      }

      if (updated && sessionUser?.permissionProfileId === updated.id) {
        syncCurrentUserAccess({
          permissionProfileId: updated.id,
          permissionProfileName: updated.name,
          permissions: updated.permissions,
          isActive: sessionUser.isActive,
        });
      }

      setFeedback({ type: "success", message: "Perfil actualizado" });
      await loadData();
    } catch {
      setFeedback({ type: "error", message: "No se pudo actualizar el perfil" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleProfileActive = async (profileId: string) => {
    if (!tenantId) return;

    setIsSubmitting(true);
    try {
      const updated = await permissionProfilesService.toggleActive(tenantId, profileId);
      if (!updated) {
        setFeedback({ type: "error", message: "Perfil no encontrado" });
        return;
      }
      await logAudit({
        module: "usuarios",
        action: "toggle_profile_active",
        entityType: "permission_profile",
        entityId: updated.id,
        description: `Perfil ${updated.is_active ? "activado" : "desactivado"}: ${updated.name}`,
        metadata: {
          is_active: updated.is_active,
        },
      });

      if (sessionUser?.permissionProfileId === updated.id) {
        syncCurrentUserAccess({
          permissionProfileId: updated.id,
          permissionProfileName: updated.name,
          permissions: updated.permissions,
          isActive: sessionUser.isActive,
        });
      }

      setFeedback({
        type: "success",
        message: updated.is_active ? "Perfil activado" : "Perfil desactivado",
      });
      await loadData();
    } catch {
      setFeedback({ type: "error", message: "No se pudo cambiar el estado del perfil" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteProfile = async (profileId: string) => {
    if (!tenantId) return;
    const profile = profilesById.get(profileId) ?? null;

    const assignedUsers = usersByProfileId.get(profileId) ?? 0;
    if (assignedUsers > 0) {
      setFeedback({
        type: "error",
        message: "No se puede eliminar un perfil asignado a usuarios",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await permissionProfilesService.delete(tenantId, profileId);
      await logAudit({
        module: "usuarios",
        action: "delete_profile",
        entityType: "permission_profile",
        entityId: profileId,
        description: `Perfil eliminado${profile ? `: ${profile.name}` : ""}`,
        metadata: null,
      });
      setFeedback({ type: "success", message: "Perfil eliminado" });
      await loadData();
    } catch {
      setFeedback({ type: "error", message: "No se pudo eliminar el perfil" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const createUser = async (values: UserFormValues) => {
    if (!tenantId) return;

    setIsSubmitting(true);
    try {
      const created = await usersService.create(tenantId, {
        full_name: values.fullName.trim(),
        email: normalizeEmpty(values.email),
        username: normalizeEmpty(values.username),
        role_code: "staff",
        permission_profile_id: values.permissionProfileId,
        is_active: true,
      });
      await logAudit({
        module: "usuarios",
        action: "create_user",
        entityType: "user",
        entityId: created.id,
        description: `Usuario creado: ${created.full_name}`,
        metadata: {
          email: created.email,
          username: created.username,
          permission_profile_id: created.permission_profile_id,
          is_active: created.is_active,
        },
      });

      setFeedback({ type: "success", message: "Usuario creado" });
      await loadData();
    } catch {
      setFeedback({ type: "error", message: "No se pudo crear el usuario" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateUser = async (userId: string, values: UserFormValues) => {
    if (!tenantId) return;
    const existing = users.find((user) => user.id === userId) ?? null;

    setIsSubmitting(true);
    try {
      const updatedUser = await usersService.update(tenantId, userId, {
        full_name: values.fullName.trim(),
        email: normalizeEmpty(values.email),
        username: normalizeEmpty(values.username),
        permission_profile_id: values.permissionProfileId,
      });
      if (updatedUser) {
        await logAudit({
          module: "usuarios",
          action: "update_user",
          entityType: "user",
          entityId: updatedUser.id,
          description: `Usuario actualizado: ${updatedUser.full_name}`,
          metadata: {
            previous_permission_profile_id: existing?.permission_profile_id ?? null,
            next_permission_profile_id: updatedUser.permission_profile_id,
          },
        });
      }

      if (updatedUser && isSameUser(sessionUser, updatedUser)) {
        const profile = profilesById.get(updatedUser.permission_profile_id) ?? null;
        const access = resolveAuthProfileData(profile);
        syncCurrentUserIdentity({
          fullName: updatedUser.full_name,
          email: updatedUser.email,
          username: updatedUser.username,
        });
        syncCurrentUserAccess({
          ...access,
          isActive: updatedUser.is_active,
        });
      }

      setFeedback({ type: "success", message: "Usuario actualizado" });
      await loadData();
    } catch {
      setFeedback({ type: "error", message: "No se pudo actualizar el usuario" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleUserActive = async (userId: string) => {
    if (!tenantId) return;

    setIsSubmitting(true);
    try {
      const updatedUser = await usersService.toggleActive(tenantId, userId);
      if (!updatedUser) {
        setFeedback({ type: "error", message: "Usuario no encontrado" });
        return;
      }
      await logAudit({
        module: "usuarios",
        action: "toggle_user_active",
        entityType: "user",
        entityId: updatedUser.id,
        description: `Usuario ${updatedUser.is_active ? "activado" : "desactivado"}: ${updatedUser.full_name}`,
        metadata: {
          is_active: updatedUser.is_active,
        },
      });

      if (isSameUser(sessionUser, updatedUser)) {
        const profile = profilesById.get(updatedUser.permission_profile_id) ?? null;
        const access = resolveAuthProfileData(profile);
        syncCurrentUserAccess({
          ...access,
          isActive: updatedUser.is_active,
        });
      }

      setFeedback({
        type: "success",
        message: updatedUser.is_active ? "Usuario activado" : "Usuario desactivado",
      });
      await loadData();
    } catch {
      setFeedback({ type: "error", message: "No se pudo cambiar el estado del usuario" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!tenantId) return;

    setIsSubmitting(true);
    try {
      const target = users.find((user) => user.id === userId) ?? null;
      const deleted = await usersService.delete(tenantId, userId);
      if (!deleted) {
        setFeedback({ type: "error", message: "Usuario no encontrado" });
        return;
      }
      await logAudit({
        module: "usuarios",
        action: "delete_user",
        entityType: "user",
        entityId: userId,
        description: `Usuario eliminado${target ? `: ${target.full_name}` : ""}`,
        metadata: target
          ? {
              email: target.email,
              username: target.username,
            }
          : null,
      });

      if (target && isSameUser(sessionUser, target)) {
        setFeedback({
          type: "error",
          message: "El usuario actual fue eliminado. Recarga sesion para continuar.",
        });
      } else {
        setFeedback({ type: "success", message: "Usuario eliminado" });
      }

      await loadData();
    } catch {
      setFeedback({ type: "error", message: "No se pudo eliminar el usuario" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getProfilePermissions = (profileId: string | null | undefined): PermissionProfile => {
    if (!profileId) return createDefaultPermissionProfile();
    const profile = profilesById.get(profileId);
    if (!profile) return createDefaultPermissionProfile();
    return normalizePermissionProfile(profile.permissions);
  };

  return {
    users: userRows,
    profiles: profileRows,
    profilesById,
    usersByProfileId,
    moduleRows,
    userSearch,
    setUserSearch,
    profileSearch,
    setProfileSearch,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload: loadData,
    createProfile,
    updateProfile,
    toggleProfileActive,
    deleteProfile,
    createUser,
    updateUser,
    toggleUserActive,
    deleteUser,
    getProfilePermissions,
  };
};
