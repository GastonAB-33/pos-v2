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

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 transition-all";

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
          Nombre o Razón Social <span className="text-red-500 dark:text-red-400 ml-1">*</span>
        </label>
        <input
          {...register("name")}
          placeholder="Ej: Distribuidora Central S.A."
          className={inputClass}
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
              <span className="text-red-500 dark:text-red-400 ml-1">*</span>
            ) : (
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(opcional)</span>
            )}
          </label>
          <input
            {...register("taxId")}
            placeholder="Ej: 30-12345678-9"
            className={inputClass}
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
              <span className="text-red-500 dark:text-red-400 ml-1">*</span>
            ) : (
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(opcional)</span>
            )}
          </label>
          <input
            {...register("phone")}
            placeholder="Ej: 11 1234-5678"
            className={inputClass}
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
              <span className="text-red-500 dark:text-red-400 ml-1">*</span>
            ) : (
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(opcional)</span>
            )}
          </label>
          <input
            type="email"
            {...register("email")}
            placeholder="ventas@proveedor.com"
            className={inputClass}
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
              <span className="text-red-500 dark:text-red-400 ml-1">*</span>
            ) : (
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(opcional)</span>
            )}
          </label>
          <input
            {...register("address")}
            placeholder="Ej: Av. San Martín 1234"
            className={inputClass}
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
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Observaciones <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(opcional)</span>
          </label>
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
          placeholder="Notas internas sobre días de entrega, vendedor asignado, condiciones comerciales..."
          className={inputClass}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {/* Footer de Acciones */}
      <div className="flex items-center justify-end gap-2 border-t border-slate-200/80 pt-4 dark:border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 transition-all cursor-pointer"
          disabled={disabled}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700 active:scale-95 disabled:opacity-60 transition-all cursor-pointer"
          disabled={disabled}
        >
          {mode === "create" ? "Crear proveedor" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
};
