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
    <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Nombre completo</label>
        <input
          {...register("fullName")}
          className="ui-input"
          disabled={disabled}
          placeholder="Ej: Juan Perez"
        />
        {errors.fullName ? <p className="mt-1 text-xs text-red-600">{errors.fullName.message}</p> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Nombre de perfil</label>
          <input
            {...register("username")}
            className="ui-input"
            disabled={disabled}
            placeholder="Ej: juan.perez"
          />
          {errors.username ? <p className="mt-1 text-xs text-red-600">{errors.username.message}</p> : null}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Correo electronico</label>
          <input
            type="email"
            {...register("email")}
            className="ui-input"
            disabled={disabled}
            placeholder="correo@empresa.com"
          />
          {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email.message}</p> : null}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Nivel de permisos</label>
        <select
          {...register("permissionProfileId")}
          className="ui-input"
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
          <p className="mt-1 text-xs text-red-600">{errors.permissionProfileId.message}</p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Contrasena</label>
          <input
            type="password"
            {...register("password")}
            className="ui-input"
            disabled={disabled}
            placeholder={mode === "create" ? "Minimo 8 caracteres" : "Dejar vacio para mantener"}
          />
          {errors.password ? <p className="mt-1 text-xs text-red-600">{errors.password.message}</p> : null}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Repetir contrasena</label>
          <input
            type="password"
            {...register("confirmPassword")}
            className="ui-input"
            disabled={disabled}
            placeholder={mode === "create" ? "Repetir contrasena" : "Repetir nueva contrasena"}
          />
          {errors.confirmPassword ? (
            <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>
          ) : null}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Debe existir al menos un perfil activo para asignar nivel de acceso al usuario.
      </p>

      <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
        <button type="button" className="ui-btn-ghost" onClick={onCancel} disabled={disabled}>
          Cancelar
        </button>
        <button type="submit" className="ui-btn-primary" disabled={disabled}>
          {mode === "create" ? "Crear usuario" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
};
