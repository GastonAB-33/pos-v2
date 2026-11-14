import { useMemo, useState } from "react";
import {
  FilterX,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { LoadingState } from "@/components/ui/UiStates";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { PermissionProfileForm } from "@/modules/usuarios/components/PermissionProfileForm";
import { PermissionProfilesTable } from "@/modules/usuarios/components/PermissionProfilesTable";
import { UserForm } from "@/modules/usuarios/components/UserForm";
import { UsersTable } from "@/modules/usuarios/components/UsersTable";
import { useUsersModule } from "@/modules/usuarios/hooks/useUsersModule";
import { cn } from "@/utils/cn";
import type { PermissionProfileRecord, UserRecord } from "@/types/entities";
import type { PermissionProfile } from "@/types/permissions";
import type { PermissionProfileFormValues } from "@/modules/usuarios/schemas/permission-profile-form.schema";
import type { UserFormValues } from "@/modules/usuarios/schemas/user-form.schema";

type TabKey = "users" | "profiles";
type StatusFilter = "all" | "active" | "inactive";

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

  // Filtros secundarios encapsulados (Mobile Data Cards standard)
  const [userStatusFilter, setUserStatusFilter] = useState<StatusFilter>("all");
  const [userProfileFilter, setUserProfileFilter] = useState<string>("all");
  const [profileStatusFilter, setProfileStatusFilter] = useState<StatusFilter>("all");
  const [userFiltersModalOpen, setUserFiltersModalOpen] = useState(false);
  const [profileFiltersModalOpen, setProfileFiltersModalOpen] = useState(false);

  // Modales de creación/edición
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

  // Contador de filtros activos
  const userActiveFiltersCount = useMemo(() => {
    let count = 0;
    if (userStatusFilter !== "all") count++;
    if (userProfileFilter !== "all") count++;
    return count;
  }, [userStatusFilter, userProfileFilter]);

  const profileActiveFiltersCount = useMemo(() => {
    return profileStatusFilter !== "all" ? 1 : 0;
  }, [profileStatusFilter]);

  // Filas preparadas y filtradas
  const usersTableRows = useMemo(() => {
    return users
      .map((user) => ({
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
      }))
      .filter(({ user }) => {
        if (userStatusFilter === "active" && !user.is_active) return false;
        if (userStatusFilter === "inactive" && user.is_active) return false;
        if (userProfileFilter !== "all" && user.permission_profile_id !== userProfileFilter) return false;
        return true;
      });
  }, [profilesById, sessionUser?.email, sessionUser?.id, sessionUser?.username, userProfileFilter, userStatusFilter, users]);

  const profilesTableRows = useMemo(() => {
    return profiles
      .map((profile) => ({ profile, usersCount: usersByProfileId.get(profile.id) ?? 0 }))
      .filter(({ profile }) => {
        if (profileStatusFilter === "active" && !profile.is_active) return false;
        if (profileStatusFilter === "inactive" && profile.is_active) return false;
        return true;
      });
  }, [profileStatusFilter, profiles, usersByProfileId]);

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
    let success = false;

    if (userFormMode === "create") {
      success = await createUser(values);
    } else if (selectedUser) {
      success = await updateUser(selectedUser.id, values);
    }

    if (!success) return;

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
      <section className="ui-panel p-8 text-center text-sm text-slate-500 dark:text-slate-400">
        No hay un comercio activo.
      </section>
    );
  }

  if (!canReadUsersModule) {
    return (
      <section className="ui-panel p-8 text-center text-sm text-slate-500 dark:text-slate-400">
        No tienes permisos de lectura para este módulo.
      </section>
    );
  }

  return (
    <div className="ui-page operational-page usuarios-page space-y-4 w-full min-w-0 max-w-full">
      {/* Encabezado Principal Flotante Moderno */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
            <span className="text-slate-400 dark:text-slate-500">SISTEMA</span>
            <span className="text-slate-400 dark:text-slate-500 font-bold">›</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold">USUARIOS Y PERMISOS</span>
          </div>

          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Usuarios
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Gestión de cuentas de acceso, perfiles de seguridad y roles operativos del comercio.
          </p>
        </div>

        {/* Fila de Botones Píldora */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={() => {
              clearFeedback();
              void reload();
            }}
            disabled={isLoading || isSubmitting}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <RefreshCw className={cn("h-4 w-4 text-slate-500 dark:text-slate-400", isLoading && "animate-spin")} />
            <span>Actualizar</span>
          </button>

          {tab === "users" ? (
            <button
              type="button"
              onClick={openCreateUserForm}
              disabled={!canWriteUsersModule || isSubmitting || !allProfiles.length}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>Nuevo usuario</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={openCreateProfileForm}
              disabled={!canWriteUsersModule || isSubmitting}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>Nuevo perfil</span>
            </button>
          )}
        </div>
      </header>

      {/* Selector de Pestañas Tipo Píldora Responsivo (Alineación perfecta en móvil) */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-1.5 sm:p-2 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
          <button
            type="button"
            onClick={() => setTab("users")}
            className={cn(
              "flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer w-full sm:w-auto text-center",
              tab === "users"
                ? "bg-blue-600 text-white shadow-sm shadow-blue-500/25"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-slate-100"
            )}
          >
            <Users size={16} className="shrink-0" />
            <span className="truncate">Usuarios</span>
            <span
              className={cn(
                "rounded-full px-1.5 sm:px-2 py-0.5 text-[10.5px] sm:text-[11px] font-bold font-mono transition-colors shrink-0",
                tab === "users"
                  ? "bg-white/25 text-white"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              )}
            >
              {usersTableRows.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTab("profiles")}
            className={cn(
              "flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer w-full sm:w-auto text-center",
              tab === "profiles"
                ? "bg-blue-600 text-white shadow-sm shadow-blue-500/25"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-slate-100"
            )}
          >
            <ShieldCheck size={16} className="shrink-0" />
            <span className="truncate hidden sm:inline">Perfiles de permisos</span>
            <span className="truncate inline sm:hidden">Perfiles</span>
            <span
              className={cn(
                "rounded-full px-1.5 sm:px-2 py-0.5 text-[10.5px] sm:text-[11px] font-bold font-mono transition-colors shrink-0",
                tab === "profiles"
                  ? "bg-white/25 text-white"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              )}
            >
              {profilesTableRows.length}
            </span>
          </button>
        </div>
      </div>

      {feedback ? (
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm font-medium",
            feedback.type === "success" ? "ui-success-state" : "ui-error-state"
          )}
        >
          {feedback.message}
        </div>
      ) : null}

      {/* ========================================================================= */}
      {/* Pestaña 1: Usuarios                                                       */}
      {/* ========================================================================= */}
      {tab === "users" ? (
        <div className="space-y-4">
          {/* Panel de Búsqueda y Filtros Encapsulados (Skill /mobile-data-cards) */}
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5">
              {/* Buscador */}
              <div className="flex flex-1 min-w-0 items-center gap-2.5 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2 shadow-2xs focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-700/80 dark:bg-slate-800/40 dark:focus-within:bg-slate-900 transition-all">
                <Search className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
                <input
                  className="flex-1 min-w-0 border-0 bg-transparent px-1 py-0.5 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder="Buscar usuario por nombre completo, correo o usuario..."
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
                {userSearch && (
                  <button
                    type="button"
                    onClick={() => setUserSearch("")}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 rounded-full cursor-pointer"
                    aria-label="Limpiar buscador de usuarios"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Botón de Filtros Avanzados (Encapsulado para evitar amontonamiento) */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setUserFiltersModalOpen(true)}
                  className={cn(
                    "flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100 px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-200 shrink-0 transition-all cursor-pointer active:scale-95",
                    userActiveFiltersCount > 0 &&
                      "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-semibold"
                  )}
                >
                  <SlidersHorizontal size={15} className="text-blue-600 dark:text-blue-400" />
                  <span>Filtros avanzados</span>
                  {userActiveFiltersCount > 0 && (
                    <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {userActiveFiltersCount}
                    </span>
                  )}
                </button>

                {(userSearch || userActiveFiltersCount > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setUserSearch("");
                      setUserStatusFilter("all");
                      setUserProfileFilter("all");
                    }}
                    className="inline-flex items-center justify-center h-9 w-9 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100 text-slate-500 hover:text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors shrink-0 cursor-pointer active:scale-95"
                    title="Restablecer filtros"
                    aria-label="Restablecer filtros"
                  >
                    <FilterX size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {isLoading ? (
            <LoadingState
              message="Cargando usuarios..."
              description="Consultando operadores, administradores y perfiles asignados..."
            />
          ) : (
            <UsersTable
              rows={usersTableRows}
              canWrite={canWriteUsersModule}
              onEdit={(row) => openEditUserForm(row.user)}
              onDelete={(row) => {
                if (!canWriteUsersModule) return;
                const confirmed = window.confirm(`¿Eliminar usuario ${row.user.full_name}?`);
                if (!confirmed) return;
                void deleteUser(row.user.id);
              }}
              onToggleActive={(row) => {
                if (!canWriteUsersModule) return;
                void toggleUserActive(row.user.id);
              }}
            />
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* Pestaña 2: Perfiles de Permisos                                           */
        /* ========================================================================= */
        <div className="space-y-4">
          {/* Panel de Búsqueda y Filtros Encapsulados (Skill /mobile-data-cards) */}
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5">
              {/* Buscador */}
              <div className="flex flex-1 min-w-0 items-center gap-2.5 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2 shadow-2xs focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-700/80 dark:bg-slate-800/40 dark:focus-within:bg-slate-900 transition-all">
                <Search className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
                <input
                  className="flex-1 min-w-0 border-0 bg-transparent px-1 py-0.5 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
                  value={profileSearch}
                  onChange={(event) => setProfileSearch(event.target.value)}
                  placeholder="Buscar perfil por nombre o descripción..."
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
                {profileSearch && (
                  <button
                    type="button"
                    onClick={() => setProfileSearch("")}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 rounded-full cursor-pointer"
                    aria-label="Limpiar buscador de perfiles"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Botón de Filtros Avanzados */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setProfileFiltersModalOpen(true)}
                  className={cn(
                    "flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100 px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-200 shrink-0 transition-all cursor-pointer active:scale-95",
                    profileActiveFiltersCount > 0 &&
                      "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-semibold"
                  )}
                >
                  <SlidersHorizontal size={15} className="text-blue-600 dark:text-blue-400" />
                  <span>Filtros avanzados</span>
                  {profileActiveFiltersCount > 0 && (
                    <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {profileActiveFiltersCount}
                    </span>
                  )}
                </button>

                {(profileSearch || profileActiveFiltersCount > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setProfileSearch("");
                      setProfileStatusFilter("all");
                    }}
                    className="inline-flex items-center justify-center h-9 w-9 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100 text-slate-500 hover:text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors shrink-0 cursor-pointer active:scale-95"
                    title="Restablecer filtros"
                    aria-label="Restablecer filtros"
                  >
                    <FilterX size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {isLoading ? (
            <LoadingState
              message="Cargando perfiles de permisos..."
              description="Consultando roles y niveles de acceso a módulos..."
            />
          ) : (
            <PermissionProfilesTable
              rows={profilesTableRows}
              moduleOrder={moduleGroups.flatMap((group) => group.modules.map((row) => row.module))}
              canWrite={canWriteUsersModule}
              onEdit={(row) => openEditProfileForm(row.profile)}
              onDelete={(row) => {
                if (!canWriteUsersModule) return;
                const confirmed = window.confirm(`¿Eliminar perfil ${row.profile.name}?`);
                if (!confirmed) return;
                void deleteProfile(row.profile.id);
              }}
              onToggleActive={(row) => {
                if (!canWriteUsersModule) return;
                void toggleProfileActive(row.profile.id);
              }}
            />
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* Modal: Filtros Avanzados de Usuarios (Encapsulado)                         */}
      {/* ========================================================================= */}
      {userFiltersModalOpen && (
        <section className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Cerrar modal de filtros"
            onClick={() => setUserFiltersModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-blue-600 dark:text-blue-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Filtros de Usuarios
                </h3>
              </div>
              <ModalCloseButton
                label="Cerrar filtros"
                onClick={() => setUserFiltersModalOpen(false)}
              />
            </div>

            <div className="space-y-3.5">
              {/* Estado */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Estado de cuenta
                </label>
                <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setUserStatusFilter("all")}
                    className={cn(
                      "rounded-lg px-2 py-1.5 text-xs font-semibold transition-all cursor-pointer text-center",
                      userStatusFilter === "all"
                        ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                    )}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserStatusFilter("active")}
                    className={cn(
                      "rounded-lg px-2 py-1.5 text-xs font-semibold transition-all cursor-pointer text-center",
                      userStatusFilter === "active"
                        ? "bg-emerald-600 text-white shadow-2xs shadow-emerald-500/25"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                    )}
                  >
                    Activos
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserStatusFilter("inactive")}
                    className={cn(
                      "rounded-lg px-2 py-1.5 text-xs font-semibold transition-all cursor-pointer text-center",
                      userStatusFilter === "inactive"
                        ? "bg-red-600 text-white shadow-2xs shadow-red-500/25"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                    )}
                  >
                    Inactivos
                  </button>
                </div>
              </div>

              {/* Perfil de permisos */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Perfil de permisos
                </label>
                <select
                  value={userProfileFilter}
                  onChange={(e) => setUserProfileFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
                >
                  <option value="all">Todos los perfiles</option>
                  {allProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setUserStatusFilter("all");
                  setUserProfileFilter("all");
                }}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                Limpiar filtros
              </button>
              <button
                type="button"
                onClick={() => setUserFiltersModalOpen(false)}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700 active:scale-95 transition-all cursor-pointer"
              >
                Aplicar filtros
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* Modal: Filtros Avanzados de Perfiles (Encapsulado)                         */}
      {/* ========================================================================= */}
      {profileFiltersModalOpen && (
        <section className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Cerrar modal de filtros"
            onClick={() => setProfileFiltersModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-blue-600 dark:text-blue-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Filtros de Perfiles
                </h3>
              </div>
              <ModalCloseButton
                label="Cerrar filtros"
                onClick={() => setProfileFiltersModalOpen(false)}
              />
            </div>

            <div className="space-y-3.5">
              {/* Estado */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Estado del perfil
                </label>
                <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setProfileStatusFilter("all")}
                    className={cn(
                      "rounded-lg px-2 py-1.5 text-xs font-semibold transition-all cursor-pointer text-center",
                      profileStatusFilter === "all"
                        ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                    )}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfileStatusFilter("active")}
                    className={cn(
                      "rounded-lg px-2 py-1.5 text-xs font-semibold transition-all cursor-pointer text-center",
                      profileStatusFilter === "active"
                        ? "bg-emerald-600 text-white shadow-2xs shadow-emerald-500/25"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                    )}
                  >
                    Activos
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfileStatusFilter("inactive")}
                    className={cn(
                      "rounded-lg px-2 py-1.5 text-xs font-semibold transition-all cursor-pointer text-center",
                      profileStatusFilter === "inactive"
                        ? "bg-red-600 text-white shadow-2xs shadow-red-500/25"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                    )}
                  >
                    Inactivos
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setProfileStatusFilter("all")}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                Limpiar filtros
              </button>
              <button
                type="button"
                onClick={() => setProfileFiltersModalOpen(false)}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700 active:scale-95 transition-all cursor-pointer"
              >
                Aplicar filtros
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* Modal de Alta / Edición de Usuario                                        */}
      {/* ========================================================================= */}
      {userFormOpen ? (
        <section className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Cerrar modal de usuario"
            onClick={() => {
              setUserFormOpen(false);
              setSelectedUser(undefined);
            }}
          />
          <div className="relative z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200/80 pb-3 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                  <span className="text-slate-400 dark:text-slate-500">SISTEMA</span>
                  <span className="text-slate-400 dark:text-slate-500 font-bold">›</span>
                  <span className="text-blue-600 dark:text-blue-400 font-bold">
                    {userFormMode === "create" ? "NUEVO USUARIO" : "EDITAR USUARIO"}
                  </span>
                </div>
                <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                  {userFormMode === "create" ? "Registrar nuevo usuario" : `Editar: ${selectedUser?.full_name ?? "Usuario"}`}
                </h3>
              </div>
              <ModalCloseButton
                label="Cerrar modal de usuario"
                onClick={() => {
                  setUserFormOpen(false);
                  setSelectedUser(undefined);
                }}
                disabled={isSubmitting}
              />
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

      {/* ========================================================================= */}
      {/* Modal de Alta / Edición de Perfil de Permisos (Panel Emergente Limpio)     */}
      {/* ========================================================================= */}
      {profileFormOpen ? (
        <section className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-2 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Cerrar modal de perfil"
            onClick={() => {
              setProfileFormOpen(false);
              setSelectedProfile(undefined);
            }}
          />
          <div className="relative z-10 max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200/80 pb-3 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                  <span className="text-slate-400 dark:text-slate-500">SISTEMA</span>
                  <span className="text-slate-400 dark:text-slate-500 font-bold">›</span>
                  <span className="text-blue-600 dark:text-blue-400 font-bold">
                    {profileFormMode === "create" ? "NUEVO PERFIL" : "EDITAR PERFIL"}
                  </span>
                </div>
                <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                  {profileFormMode === "create" ? "Crear perfil de permisos" : `Editar: ${selectedProfile?.name ?? "Perfil"}`}
                </h3>
              </div>
              <ModalCloseButton
                label="Cerrar modal de perfil"
                onClick={() => {
                  setProfileFormOpen(false);
                  setSelectedProfile(undefined);
                }}
                disabled={isSubmitting}
              />
            </div>

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
          </div>
        </section>
      ) : null}
    </div>
  );
};
