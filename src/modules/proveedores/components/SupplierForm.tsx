import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { VoiceDictationButton } from "@/components/form/VoiceDictationButton";
import type { Supplier } from "@/types/entities";
import {
  supplierFormSchema,
  type SupplierFormValues,
} from "@/modules/proveedores/schemas/supplier-form.schema";

interface SupplierFormProps {
  mode: "create" | "edit";
  supplier?: Supplier;
  disabled?: boolean;
  onCancel: () => void;
  onSubmit: (values: SupplierFormValues) => Promise<void>;
}

const defaultValues: SupplierFormValues = {
  name: "",
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
}: SupplierFormProps) => {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (!supplier) {
      reset(defaultValues);
      return;
    }

    reset({
      name: supplier.name,
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      address: supplier.address ?? "",
      observations: supplier.observations ?? "",
    });
  }, [supplier, reset]);

  const observationsValue = watch("observations");

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Nombre</label>
        <input
          {...register("name")}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          disabled={disabled}
        />
        {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name.message}</p> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Telefono</label>
          <input
            {...register("phone")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            {...register("email")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled}
          />
          {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email.message}</p> : null}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Direccion</label>
        <input
          {...register("address")}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          disabled={disabled}
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label className="block text-sm font-medium text-slate-700">Observaciones</label>
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
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          disabled={disabled}
        />
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          disabled={disabled}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          disabled={disabled}
        >
          {mode === "create" ? "Crear proveedor" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
};
