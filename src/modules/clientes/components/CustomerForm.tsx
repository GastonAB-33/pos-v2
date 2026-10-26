import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { VoiceDictationButton } from "@/components/form/VoiceDictationButton";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import {
  getEditableDocumentNumber,
  useEntityRequirements,
} from "@/modules/configuracion/hooks/useEntityRequirements";
import type { Customer, CustomerRequiredFieldsSettings, PriceList } from "@/types/entities";
import {
  buildCustomerFormSchema,
  type CustomerFormValues,
} from "@/modules/clientes/schemas/customer-form.schema";

interface CustomerFormProps {
  mode: "create" | "edit";
  customer?: Customer;
  priceLists: PriceList[];
  disabled?: boolean;
  onCancel: () => void;
  onSubmit: (values: CustomerFormValues) => Promise<void>;
  requirements?: CustomerRequiredFieldsSettings;
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

export const CustomerForm = ({
  mode,
  customer,
  priceLists,
  disabled,
  onCancel,
  onSubmit,
  requirements,
}: CustomerFormProps) => {
  const { tenantId } = useTenant();
  const { customerRequirements } = useEntityRequirements(tenantId);
  const activeReq = requirements ?? customerRequirements;

  const schema = useMemo(() => buildCustomerFormSchema(activeReq), [activeReq]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(schema),
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
      documentNumber: getEditableDocumentNumber(customer.document_number),
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
    <form autoComplete="off" className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nombre</label>
        <input
          {...register("fullName")}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-slate-400"
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-lpignore="true"
        />
        {errors.fullName ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.fullName.message}</p> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Tipo doc</label>
          <select
            {...register("documentType")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
            disabled={disabled}
          >
            <option value="dni">DNI</option>
            <option value="cuit">CUIT</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Documento{" "}
            {activeReq.document_number ? (
              <span className="text-red-500">*</span>
            ) : (
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(opcional)</span>
            )}
          </label>
          <input
            {...register("documentNumber")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-slate-400"
            disabled={disabled}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
          />
          {errors.documentNumber ? (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.documentNumber.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Razon social (fiscal)</label>
          <input
            {...register("fiscalBusinessName")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-slate-400"
            disabled={disabled}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Condicion fiscal</label>
          <input
            {...register("fiscalCondition")}
            placeholder="Consumidor final, Responsable inscripto..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-slate-400"
            disabled={disabled}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Lista de precios</label>
        <select
          {...register("priceListId")}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
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
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Telefono{" "}
            {activeReq.phone ? (
              <span className="text-red-500">*</span>
            ) : (
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(opcional)</span>
            )}
          </label>
          <input
            {...register("phone")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-slate-400"
            disabled={disabled}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
          />
          {errors.phone ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.phone.message}</p> : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
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
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-slate-400"
            disabled={disabled}
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
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Direccion{" "}
          {activeReq.address ? (
            <span className="text-red-500">*</span>
          ) : (
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(opcional)</span>
          )}
        </label>
        <input
          {...register("address")}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-slate-400"
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-lpignore="true"
        />
        {errors.address ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.address.message}</p> : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Domicilio fiscal</label>
        <input
          {...register("fiscalAddress")}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-slate-400"
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-lpignore="true"
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            {...register("currentAccountEnabled")}
            className="h-4 w-4"
            disabled={disabled}
          />
          Habilitar cuenta corriente
        </label>
        <div className="mt-3">
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Limite autorizado</label>
          <input
            type="number"
            step="0.01"
            min="0"
            {...register("currentAccountLimit")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-slate-400"
            disabled={disabled || !currentAccountEnabled}
            placeholder="Sin limite si se deja vacio"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Observaciones</label>
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
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:ring-slate-400"
          rows={3}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
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
