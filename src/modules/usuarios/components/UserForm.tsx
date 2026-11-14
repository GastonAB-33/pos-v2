import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import type { PermissionProfileRecord, UserRecord } from "@/types/entities";
import {
  createUserFormSchema,
  type UserFormValues,
} from "@/modules/usuarios/schemas/user-form.schema";

interface UserFormProps {
  mode: "create" | "edit";
  user?: UserRecord;
  profiles: PermissionProfileRecord[];
  disabled?: boolean;
  onCancel: () => void;
  onSubmit: (values: UserFormValues) => Promise<void>;
}

const createDefaultValues = (profiles: PermissionProfileRecord[]): UserFormValues => ({
  fullName: "",
  username: "",
  email: "",
  permissionProfileId: profiles[0]?.id ?? "",
  password: "",
  confirmPassword: "",
});

export const UserForm = ({
  mode,
  user,
  profiles,
  disabled,
  onCancel,
  onSubmit,
}: UserFormProps) => {
  const resolver = useMemo(() => zodResolver(createUserFormSchema(mode)), [mode]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver,
    defaultValues: createDefaultValues(profiles),
  });

  useEffect(() => {
    if (!user) {
      reset(createDefaultValues(profiles));
      return;
    }

    reset({
      fullName: user.full_name,
      username: user.username ?? "",
      email: user.email ?? "",
      permissionProfileId: user.permission_profile_id,
      password: "",
      confirmPassword: "",
    });
  }, [profiles, reset, user]);

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)} autoComplete="off">
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
          Nombre completo
        </label>
        <input
          {...register("fullName")}
          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:focus:border-blue-400"
          disabled={disabled}
          placeholder="Ej: Juan Pérez"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-lpignore="true"
        />
        {errors.fullName ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.fullName.message}</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Nombre de perfil / usuario
          </label>
          <input
            {...register("username")}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:focus:border-blue-400"
            disabled={disabled}
            placeholder="Ej: juan.perez"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
          />
          {errors.username ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.username.message}</p> : null}
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Correo electrónico
          </label>
          <input
            type="email"
            {...register("email")}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:focus:border-blue-400"
            disabled={disabled}
            placeholder="correo@empresa.com"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
          />
          {errors.email ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.email.message}</p> : null}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
          Nivel de permisos
        </label>
        <select
          {...register("permissionProfileId")}
          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:focus:border-blue-400 cursor-pointer"
          disabled={disabled}
        >
          <option value="">Seleccionar nivel</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </select>
        {errors.permissionProfileId ? (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.permissionProfileId.message}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Contraseña
          </label>
          <input
            type="password"
            {...register("password")}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:focus:border-blue-400"
            disabled={disabled}
            placeholder={mode === "create" ? "Mínimo 8 caracteres" : "Dejar vacío para mantener"}
            autoComplete="new-password"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
          />
          {errors.password ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.password.message}</p> : null}
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Repetir contraseña
          </label>
          <input
            type="password"
            {...register("confirmPassword")}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:focus:border-blue-400"
            disabled={disabled}
            placeholder={mode === "create" ? "Repetir contraseña" : "Repetir nueva contraseña"}
            autoComplete="new-password"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
          />
          {errors.confirmPassword ? (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.confirmPassword.message}</p>
          ) : null}
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Debe existir al menos un perfil activo para asignar nivel de acceso al usuario.
      </p>

      <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 border-t border-slate-200 dark:border-slate-800 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="w-full sm:w-auto rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 sm:py-2 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer text-center"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={disabled}
          className="w-full sm:w-auto rounded-xl bg-blue-600 px-5 py-2.5 sm:py-2 text-xs sm:text-sm font-semibold text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all cursor-pointer text-center"
        >
          {mode === "create" ? "Crear usuario" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
};