import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { VoiceDictationButton } from "@/components/form/VoiceDictationButton";
import type { Customer, PriceList } from "@/types/entities";
import {
  customerFormSchema,
  type CustomerFormValues,
} from "@/modules/clientes/schemas/customer-form.schema";

interface CustomerFormProps {
  mode: "create" | "edit";
  customer?: Customer;
  priceLists: PriceList[];
  disabled?: boolean;
  onCancel: () => void;
  onSubmit: (values: CustomerFormValues) => Promise<void>;
}

const defaultValues: CustomerFormValues = {
  fullName: "",
  documentType: "dni",
  documentNumber: "",
  fiscalBusinessName: "",
  fiscalAddress: "",
  fiscalCondition: "",
  priceListId: "",
  phone: "",
  email: "",
  address: "",
  observations: "",
  currentAccountEnabled: false,
  currentAccountLimit: "",
};

export const CustomerForm = ({ mode, customer, priceLists, disabled, onCancel, onSubmit }: CustomerFormProps) => {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (!customer) {
      reset(defaultValues);
      return;
    }

    reset({
      fullName: customer.full_name,
      documentType: customer.document_type,
      documentNumber: customer.document_number,
      fiscalBusinessName: customer.fiscal_business_name ?? "",
      fiscalAddress: customer.fiscal_address ?? "",
      fiscalCondition: customer.fiscal_condition ?? "",
      priceListId: customer.price_list_id ?? "",
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      address: customer.address ?? "",
      observations: customer.observations ?? "",
      currentAccountEnabled: customer.current_account_enabled ?? false,
      currentAccountLimit:
        customer.current_account_limit != null && Number.isFinite(customer.current_account_limit)
          ? customer.current_account_limit.toString()
          : "",
    });
  }, [customer, reset]);

  const observationsValue = watch("observations");
  const currentAccountEnabled = watch("currentAccountEnabled");

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Nombre</label>
        <input
          {...register("fullName")}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          disabled={disabled}
        />
        {errors.fullName ? <p className="mt-1 text-xs text-red-600">{errors.fullName.message}</p> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Tipo doc</label>
          <select
            {...register("documentType")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled}
          >
            <option value="dni">DNI</option>
            <option value="cuit">CUIT</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Documento</label>
          <input
            {...register("documentNumber")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled}
          />
          {errors.documentNumber ? (
            <p className="mt-1 text-xs text-red-600">{errors.documentNumber.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Razon social (fiscal)</label>
          <input
            {...register("fiscalBusinessName")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Condicion fiscal</label>
          <input
            {...register("fiscalCondition")}
            placeholder="Consumidor final, Responsable inscripto..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Lista de precios</label>
        <select
          {...register("priceListId")}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          disabled={disabled}
        >
          <option value="">Precio base</option>
          {priceLists.map((priceList) => (
            <option key={priceList.id} value={priceList.id}>
              {priceList.name}
              {!priceList.is_active ? " (inactiva)" : ""}
            </option>
          ))}
        </select>
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
        <label className="mb-1 block text-sm font-medium text-slate-700">Domicilio fiscal</label>
        <input
          {...register("fiscalAddress")}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          disabled={disabled}
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            {...register("currentAccountEnabled")}
            className="h-4 w-4"
            disabled={disabled}
          />
          Habilitar cuenta corriente
        </label>
        <div className="mt-3">
          <label className="mb-1 block text-sm font-medium text-slate-700">Limite autorizado</label>
          <input
            type="number"
            step="0.01"
            min="0"
            {...register("currentAccountLimit")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled || !currentAccountEnabled}
            placeholder="Sin limite si se deja vacio"
          />
        </div>
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
            label="Dictar observaciones de cliente"
          />
        </div>
        <textarea
          {...register("observations")}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          rows={3}
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
          {mode === "create" ? "Crear cliente" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
};
