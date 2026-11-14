import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { PermissionMatrix, type ModuleGroup } from "@/modules/usuarios/components/PermissionMatrix";
import type { SystemModuleGroup } from "@/modules/usuarios/constants/module-groups";
import {
  permissionProfileFormSchema,
  type PermissionProfileFormValues,
} from "@/modules/usuarios/schemas/permission-profile-form.schema";
import { createDefaultPermissionProfile, normalizePermissionProfile, type PermissionProfile } from "@/types/permissions";
import type { PermissionProfileRecord } from "@/types/entities";

interface PermissionProfileFormProps {
  mode: "create" | "edit";
  profile?: PermissionProfileRecord;
  moduleGroups?: (ModuleGroup | SystemModuleGroup)[];
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
      autoComplete="off"
      onSubmit={handleSubmit(async (values) => {
        await onSubmit(values, permissions);
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Nombre del perfil
          </label>
          <input
            {...register("name")}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:focus:border-blue-400"
            disabled={disabled}
            placeholder="Ej: Cajero Turno Mañana"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
          />
          {errors.name ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.name.message}</p> : null}
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Descripción del rol
          </label>
          <input
            {...register("description")}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:focus:border-blue-400"
            disabled={disabled}
            placeholder="Ej: Operación en POS y cobro sin acceso a costos ni configuración"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
          <input
            type="checkbox"
            {...register("isActive")}
            disabled={disabled}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 cursor-pointer"
          />
          <span>Perfil activo (disponible para asignar a usuarios)</span>
        </label>
      </div>

      <div className="space-y-2 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Matriz de Permisos por Áreas y Módulos
          </p>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Selecciona el nivel de acceso para cada área del negocio
          </span>
        </div>
        <PermissionMatrix
          groups={moduleGroups}
          value={permissions}
          onChange={setPermissions}
          disabled={disabled}
        />
      </div>

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
          {mode === "create" ? "Crear perfil" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
};
