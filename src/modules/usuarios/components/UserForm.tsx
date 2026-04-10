import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import type { PermissionProfileRecord, UserRecord } from "@/types/entities";
import { userFormSchema, type UserFormValues } from "@/modules/usuarios/schemas/user-form.schema";

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
  email: "",
  username: "",
  permissionProfileId: profiles[0]?.id ?? "",
});

export const UserForm = ({
  mode,
  user,
  profiles,
  disabled,
  onCancel,
  onSubmit,
}: UserFormProps) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: createDefaultValues(profiles),
  });

  useEffect(() => {
    if (!user) {
      reset(createDefaultValues(profiles));
      return;
    }

    reset({
      fullName: user.full_name,
      email: user.email ?? "",
      username: user.username ?? "",
      permissionProfileId: user.permission_profile_id,
    });
  }, [profiles, reset, user]);

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Nombre</label>
        <input
          {...register("fullName")}
          className="ui-input"
          disabled={disabled}
        />
        {errors.fullName ? <p className="mt-1 text-xs text-red-600">{errors.fullName.message}</p> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            {...register("email")}
            className="ui-input"
            disabled={disabled}
          />
          {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email.message}</p> : null}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Username</label>
          <input
            {...register("username")}
            className="ui-input"
            disabled={disabled}
          />
          {errors.username ? <p className="mt-1 text-xs text-red-600">{errors.username.message}</p> : null}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Perfil de permisos</label>
        <select
          {...register("permissionProfileId")}
          className="ui-input"
          disabled={disabled}
        >
          <option value="">Seleccionar perfil</option>
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

      <p className="text-xs text-slate-500">
        Debe existir al menos un perfil activo para asignar al usuario.
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
