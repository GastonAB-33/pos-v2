import { useMemo, useState } from "react";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { PermissionProfileForm } from "@/modules/usuarios/components/PermissionProfileForm";
import { PermissionProfilesTable } from "@/modules/usuarios/components/PermissionProfilesTable";
import { UserForm } from "@/modules/usuarios/components/UserForm";
import { UsersTable } from "@/modules/usuarios/components/UsersTable";
import { useUsersModule } from "@/modules/usuarios/hooks/useUsersModule";
import type { PermissionProfileRecord, UserRecord } from "@/types/entities";
import type { PermissionProfile } from "@/types/permissions";
import type { PermissionProfileFormValues } from "@/modules/usuarios/schemas/permission-profile-form.schema";
import type { UserFormValues } from "@/modules/usuarios/schemas/user-form.schema";

type TabKey = "users" | "profiles";

export const UsuariosPage = () => {
  const { tenantId } = useTenant();
  const { canRead, canWrite } = usePermissions();
  const sessionUser = useAuthStore((state) => state.user);
  const canReadUsersModule = canRead("usuarios");
  const canWriteUsersModule = canWrite("usuarios");

  const {
    users,
    profiles,
    profilesById,
    usersByProfileId,
    moduleGroups,
    userSearch,
    setUserSearch,
    profileSearch,
    setProfileSearch,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload,
    createProfile,
    updateProfile,
    toggleProfileActive,
    deleteProfile,
    createUser,
    updateUser,
    toggleUserActive,
    deleteUser,
  } = useUsersModule(tenantId);

  const [tab, setTab] = useState<TabKey>("users");

  const [userFormOpen, setUserFormOpen] = useState(false);
  const [userFormMode, setUserFormMode] = useState<"create" | "edit">("create");
  const [selectedUser, setSelectedUser] = useState<UserRecord | undefined>(undefined);

  const [profileFormOpen, setProfileFormOpen] = useState(false);
  const [profileFormMode, setProfileFormMode] = useState<"create" | "edit">("create");
  const [selectedProfile, setSelectedProfile] = useState<PermissionProfileRecord | undefined>(undefined);

  const allProfiles = useMemo(
    () => [...profilesById.values()].sort((a, b) => a.name.localeCompare(b.name)),
    [profilesById]
  );

  const usersTableRows = useMemo(
    () =>
      users.map((user) => ({
        user,
        profileName: profilesById.get(user.permission_profile_id)?.name ?? "Perfil no encontrado",
        isCurrentSessionUser:
          sessionUser?.id === user.id ||
          Boolean(sessionUser?.email && user.email && sessionUser.email.toLowerCase() === user.email.toLowerCase()) ||
          Boolean(
            sessionUser?.username &&
              user.username &&
              sessionUser.username.toLowerCase() === user.username.toLowerCase()
          ),
      })),
    [profilesById, sessionUser?.email, sessionUser?.id, sessionUser?.username, users]
  );

  const profilesTableRows = useMemo(
    () => profiles.map((profile) => ({ profile, usersCount: usersByProfileId.get(profile.id) ?? 0 })),
    [profiles, usersByProfileId]
  );

  const openCreateUserForm = () => {
    if (!canWriteUsersModule) return;
    clearFeedback();
    setUserFormMode("create");
    setSelectedUser(undefined);
    setUserFormOpen(true);
  };

  const openEditUserForm = (user: UserRecord) => {
    if (!canWriteUsersModule) return;
    clearFeedback();
    setUserFormMode("edit");
    setSelectedUser(user);
    setUserFormOpen(true);
  };

  const openCreateProfileForm = () => {
    if (!canWriteUsersModule) return;
    clearFeedback();
    setProfileFormMode("create");
    setSelectedProfile(undefined);
    setProfileFormOpen(true);
  };

  const openEditProfileForm = (profile: PermissionProfileRecord) => {
    if (!canWriteUsersModule) return;
    clearFeedback();
    setProfileFormMode("edit");
    setSelectedProfile(profile);
    setProfileFormOpen(true);
  };

  const handleSubmitUserForm = async (values: UserFormValues) => {
    if (userFormMode === "create") {
      await createUser(values);
    } else if (selectedUser) {
      await updateUser(selectedUser.id, values);
    }

    setUserFormOpen(false);
    setSelectedUser(undefined);
  };

  const handleSubmitProfileForm = async (
    values: PermissionProfileFormValues,
    permissions: PermissionProfile
  ) => {
    if (profileFormMode === "create") {
      await createProfile(values, permissions);
    } else if (selectedProfile) {
      await updateProfile(selectedProfile.id, values, permissions);
    }

    setProfileFormOpen(false);
    setSelectedProfile(undefined);
  };

  if (!tenantId) {
    return (
      <PagePlaceholder
        title="Usuarios"
        description="No hay tenant activo para operar el modulo"
      />
    );
  }

  if (!canReadUsersModule) {
    return (
      <PagePlaceholder
        title="Usuarios"
        description="No tenes permisos de lectura para este modulo"
      />
    );
  }

  return (
    <PagePlaceholder
      title="Usuarios"
      description="Gestion de usuarios y perfiles de permisos por tenant"
    >
      <div className="space-y-4">
        <section className="ui-card space-y-3 bg-gradient-to-br from-slate-50 to-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">Gestion de accesos</p>
              <h2 className="text-lg font-semibold text-slate-900">Administracion de usuarios</h2>
              <p className="text-sm text-slate-500">Controla perfiles, niveles y permisos por modulo.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="ui-btn-ghost"
                onClick={() => {
                  clearFeedback();
                  void reload();
                }}
                disabled={isLoading || isSubmitting}
              >
                Recargar
              </button>
              {tab === "users" ? (
                <button
                  type="button"
                  className="ui-btn-primary"
                  onClick={openCreateUserForm}
                  disabled={!canWriteUsersModule || isSubmitting || !allProfiles.length}
                >
                  Nuevo usuario
                </button>
              ) : (
                <button
                  type="button"
                  className="ui-btn-primary"
                  onClick={openCreateProfileForm}
                  disabled={!canWriteUsersModule || isSubmitting}
                >
                  Nuevo perfil
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={[
                "rounded-full border px-4 py-2 text-sm font-medium transition",
                tab === "users"
                  ? "border-brand-500 bg-brand-500/15 text-slate-900"
                  : "border-slate-300 bg-white text-slate-600",
              ].join(" ")}
              onClick={() => setTab("users")}
            >
              Usuarios
            </button>
            <button
              type="button"
              className={[
                "rounded-full border px-4 py-2 text-sm font-medium transition",
                tab === "profiles"
                  ? "border-brand-500 bg-brand-500/15 text-slate-900"
                  : "border-slate-300 bg-white text-slate-600",
              ].join(" ")}
              onClick={() => setTab("profiles")}
            >
              Perfiles de permisos
            </button>
          </div>
        </section>

        {feedback ? <div className={feedback.type === "success" ? "ui-success-state" : "ui-error-state"}>{feedback.message}</div> : null}

        {tab === "users" ? (
          <section className="space-y-3 ui-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">Usuarios del tenant</h2>
              <input
                type="search"
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Buscar por nombre completo, correo o nombre de perfil"
                className="ui-input w-full max-w-md"
              />
            </div>

            {isLoading ? (
              <div className="ui-loading">Cargando usuarios...</div>
            ) : (
              <UsersTable
                rows={usersTableRows}
                canWrite={canWriteUsersModule}
                onEdit={(row) => openEditUserForm(row.user)}
                onDelete={(row) => {
                  if (!canWriteUsersModule) return;
                  const confirmed = window.confirm(`Eliminar usuario ${row.user.full_name}?`);
                  if (!confirmed) return;
                  void deleteUser(row.user.id);
                }}
                onToggleActive={(row) => {
                  if (!canWriteUsersModule) return;
                  void toggleUserActive(row.user.id);
                }}
              />
            )}
          </section>
        ) : (
          <section className="space-y-3 ui-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">Perfiles de permisos</h2>
              <input
                type="search"
                value={profileSearch}
                onChange={(event) => setProfileSearch(event.target.value)}
                placeholder="Buscar por nombre o descripcion"
                className="ui-input w-full max-w-md"
              />
            </div>

            {isLoading ? (
              <div className="ui-loading">Cargando perfiles...</div>
            ) : (
              <PermissionProfilesTable
                rows={profilesTableRows}
                moduleOrder={moduleGroups.flatMap((group) => group.modules.map((row) => row.module))}
                canWrite={canWriteUsersModule}
                onEdit={(row) => openEditProfileForm(row.profile)}
                onDelete={(row) => {
                  if (!canWriteUsersModule) return;
                  const confirmed = window.confirm(`Eliminar perfil ${row.profile.name}?`);
                  if (!confirmed) return;
                  void deleteProfile(row.profile.id);
                }}
                onToggleActive={(row) => {
                  if (!canWriteUsersModule) return;
                  void toggleProfileActive(row.profile.id);
                }}
              />
            )}
          </section>
        )}

        {userFormOpen && userFormMode === "create" ? (
          <section className="space-y-3 ui-card">
            <h3 className="text-base font-semibold text-slate-900">
              {userFormMode === "create" ? "Crear usuario" : "Editar usuario"}
            </h3>
            <UserForm
              mode={userFormMode}
              user={selectedUser}
              profiles={allProfiles.filter(
                (profile) => profile.is_active || profile.id === selectedUser?.permission_profile_id
              )}
              disabled={isSubmitting}
              onCancel={() => {
                setUserFormOpen(false);
                setSelectedUser(undefined);
              }}
              onSubmit={handleSubmitUserForm}
            />
          </section>
        ) : null}

        {userFormOpen && userFormMode === "edit" ? (
          <section className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] p-4">
            <button
              type="button"
              className="absolute inset-0"
              aria-label="Cerrar modal de edicion de usuario"
              onClick={() => {
                setUserFormOpen(false);
                setSelectedUser(undefined);
              }}
            />

            <div className="relative z-10 max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-panel md:p-5">
              <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <h3 className="text-base font-semibold text-slate-900">Editar usuario</h3>
                <button
                  type="button"
                  className="ui-btn-ghost px-2.5 py-1.5 text-xs"
                  onClick={() => {
                    setUserFormOpen(false);
                    setSelectedUser(undefined);
                  }}
                >
                  Cerrar
                </button>
              </div>

              <UserForm
                mode={userFormMode}
                user={selectedUser}
                profiles={allProfiles.filter(
                  (profile) => profile.is_active || profile.id === selectedUser?.permission_profile_id
                )}
                disabled={isSubmitting}
                onCancel={() => {
                  setUserFormOpen(false);
                  setSelectedUser(undefined);
                }}
                onSubmit={handleSubmitUserForm}
              />
            </div>
          </section>
        ) : null}

        {profileFormOpen ? (
          <section className="space-y-3 ui-card">
            <h3 className="text-base font-semibold text-slate-900">
              {profileFormMode === "create" ? "Crear perfil" : "Editar perfil"}
            </h3>
            <PermissionProfileForm
              mode={profileFormMode}
              profile={selectedProfile}
              moduleGroups={moduleGroups}
              disabled={isSubmitting}
              onCancel={() => {
                setProfileFormOpen(false);
                setSelectedProfile(undefined);
              }}
              onSubmit={handleSubmitProfileForm}
            />
          </section>
        ) : null}
      </div>
    </PagePlaceholder>
  );
};
