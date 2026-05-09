import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { PermissionMatrix, type ModuleGroup } from "@/modules/usuarios/components/PermissionMatrix";
import {
  permissionProfileFormSchema,
  type PermissionProfileFormValues,
} from "@/modules/usuarios/schemas/permission-profile-form.schema";
import { createDefaultPermissionProfile, normalizePermissionProfile, type PermissionProfile } from "@/types/permissions";
import type { PermissionProfileRecord } from "@/types/entities";

interface PermissionProfileFormProps {
  mode: "create" | "edit";
  profile?: PermissionProfileRecord;
  moduleGroups: ModuleGroup[];
  disabled?: boolean;
  onCancel: () => void;
  onSubmit: (values: PermissionProfileFormValues, permissions: PermissionProfile) => Promise<void>;
}

const defaultValues: PermissionProfileFormValues = {
  name: "",
  description: "",
  isActive: true,
};

export const PermissionProfileForm = ({
  mode,
  profile,
  moduleGroups,
  disabled,
  onCancel,
  onSubmit,
}: PermissionProfileFormProps) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PermissionProfileFormValues>({
    resolver: zodResolver(permissionProfileFormSchema),
    defaultValues,
  });

  const [permissions, setPermissions] = useState<PermissionProfile>(createDefaultPermissionProfile());

  useEffect(() => {
    if (!profile) {
      reset(defaultValues);
      setPermissions(createDefaultPermissionProfile());
      return;
    }

    reset({
      name: profile.name,
      description: profile.description ?? "",
      isActive: profile.is_active,
    });
    setPermissions(normalizePermissionProfile(profile.permissions));
  }, [profile, reset]);

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit(async (values) => {
        await onSubmit(values, permissions);
      })}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Nombre</label>
          <input
            {...register("name")}
            className="ui-input"
            disabled={disabled}
          />
          {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name.message}</p> : null}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Descripcion</label>
          <input
            {...register("description")}
            className="ui-input"
            disabled={disabled}
          />
        </div>
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          {...register("isActive")}
          disabled={disabled}
        />
        Perfil activo
      </label>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700">Permisos por modulos y submodulos</p>
        <PermissionMatrix
          groups={moduleGroups}
          value={permissions}
          onChange={setPermissions}
          disabled={disabled}
        />
      </div>

      <p className="text-xs text-slate-500">
        Cada modulo puede quedar sin acceso, con acceso o con acceso y edicion para usuarios del perfil.
      </p>

      <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
        <button type="button" className="ui-btn-ghost" onClick={onCancel} disabled={disabled}>
          Cancelar
        </button>
        <button type="submit" className="ui-btn-primary" disabled={disabled}>
          {mode === "create" ? "Crear perfil" : "Guardar perfil"}
        </button>
      </div>
    </form>
  );
};
