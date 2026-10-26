import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { VoiceDictationButton } from "@/components/form/VoiceDictationButton";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { useEntityRequirements } from "@/modules/configuracion/hooks/useEntityRequirements";
import type { Supplier, SupplierRequiredFieldsSettings } from "@/types/entities";
import {
  buildSupplierFormSchema,
  type SupplierFormValues,
} from "@/modules/proveedores/schemas/supplier-form.schema";

interface SupplierFormProps {
  mode: "create" | "edit";
  supplier?: Supplier;
  disabled?: boolean;
  onCancel: () => void;
  onSubmit: (values: SupplierFormValues) => Promise<void>;
  requirements?: SupplierRequiredFieldsSettings;
  initialName?: string;
}

const defaultValues: SupplierFormValues = {
  name: "",
  taxId: "",
  phone: "",
  email: "",
  address: "",
  observations: "",
};

export const SupplierForm = ({
  mode,
  supplier,
  disabled,
  onCancel,
  onSubmit,
  requirements,
  initialName,
}: SupplierFormProps) => {
  const { tenantId } = useTenant();
  const { supplierRequirements } = useEntityRequirements(tenantId);
  const activeReq = requirements ?? supplierRequirements;

  const schema = useMemo(() => buildSupplierFormSchema(activeReq), [activeReq]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...defaultValues,
      name: initialName?.trim() || "",
    },
  });

  useEffect(() => {
    if (!supplier) {
      reset({
        ...defaultValues,
        name: initialName?.trim() || "",
      });
      return;
    }

    reset({
      name: supplier.name,
      taxId: supplier.tax_id ?? "",
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      address: supplier.address ?? "",
      observations: supplier.observations ?? "",
    });
  }, [supplier, initialName, reset]);

  const observationsValue = watch("observations");

  return (
    <form autoComplete="off" className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
          Nombre <span className="text-red-500">*</span>
        </label>
        <input
          {...register("name")}
          placeholder="Ej: Distribuidora Central"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-slate-400"
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-lpignore="true"
        />
        {errors.name ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.name.message}</p> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            CUIT / Identificación fiscal{" "}
            {activeReq.tax_id ? (
              <span className="text-red-500">*</span>
            ) : (
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(opcional)</span>
            )}
          </label>
          <input
            {...register("taxId")}
            placeholder="Ej: 30-12345678-9"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-slate-400"
            disabled={disabled}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
          />
          {errors.taxId ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.taxId.message}</p> : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Teléfono{" "}
            {activeReq.phone ? (
              <span className="text-red-500">*</span>
            ) : (
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(opcional)</span>
            )}
          </label>
          <input
            {...register("phone")}
            placeholder="Ej: 2664123456"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-slate-400"
            disabled={disabled}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
          />
          {errors.phone ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.phone.message}</p> : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Email{" "}
            {activeReq.email ? (
              <span className="text-red-500">*</span>
            ) : (
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(opcional)</span>
            )}
          </label>
          <input
            type="email"
            {...register("email")}
            placeholder="proveedor@ejemplo.com"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-slate-400"
            disabled={disabled}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
          />
          {errors.email ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.email.message}</p> : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Dirección{" "}
            {activeReq.address ? (
              <span className="text-red-500">*</span>
            ) : (
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(opcional)</span>
            )}
          </label>
          <input
            {...register("address")}
            placeholder="Ej: Av. San Martín 1234"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-slate-400"
            disabled={disabled}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
          />
          {errors.address ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.address.message}</p> : null}
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Observaciones</label>
          <VoiceDictationButton
            value={observationsValue ?? ""}
            onValueChange={(nextValue) =>
              setValue("observations", nextValue, { shouldDirty: true, shouldValidate: true })
            }
            insertMode="append"
            disabled={disabled}
            label="Dictar observaciones de proveedor"
          />
        </div>
        <textarea
          rows={3}
          {...register("observations")}
          placeholder="Notas adicionales o información de contacto..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-slate-400"
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          disabled={disabled}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          disabled={disabled}
        >
          {mode === "create" ? "Crear proveedor" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
};
