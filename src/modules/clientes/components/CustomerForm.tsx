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

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 transition-all";

const selectClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:focus:border-blue-400 transition-all";

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
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
          Nombre y apellido / Razón social <span className="text-red-500 dark:text-red-400 ml-1">*</span>
        </label>
        <input
          {...register("fullName")}
          className={inputClass}
          disabled={disabled}
          placeholder="Ej: Juan Pérez o Distribuidora SRL"
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
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Tipo documento</label>
          <select
            {...register("documentType")}
            className={selectClass}
            disabled={disabled}
          >
            <option value="dni">DNI</option>
            <option value="cuit">CUIT</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Número documento{" "}
            {activeReq.document_number ? (
              <span className="text-red-500 dark:text-red-400 ml-1">*</span>
            ) : (
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(opcional)</span>
            )}
          </label>
          <input
            {...register("documentNumber")}
            className={inputClass}
            disabled={disabled}
            placeholder="Sin puntos ni guiones"
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
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Razón social (fiscal) <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(opcional)</span>
          </label>
          <input
            {...register("fiscalBusinessName")}
            className={inputClass}
            disabled={disabled}
            placeholder="Nombre registrado ante AFIP / ARCA"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Condición fiscal <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(opcional)</span>
          </label>
          <input
            {...register("fiscalCondition")}
            placeholder="Consumidor Final, Resp. Inscripto, Monotributo..."
            className={inputClass}
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
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Lista de precios</label>
        <select
          {...register("priceListId")}
          className={selectClass}
          disabled={disabled}
        >
          <option value="">Precio base (general)</option>
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
            className={inputClass}
            disabled={disabled}
            placeholder="Ej: 11 1234-5678"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
          />
          {errors.phone ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.phone.message}</p> : null}
        </div>

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
            className={inputClass}
            disabled={disabled}
            placeholder="cliente@ejemplo.com"
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
          className={inputClass}
          disabled={disabled}
          placeholder="Calle, número, piso o localidad"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-lpignore="true"
        />
        {errors.address ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.address.message}</p> : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
          Domicilio fiscal <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(opcional)</span>
        </label>
        <input
          {...register("fiscalAddress")}
          className={inputClass}
          disabled={disabled}
          placeholder="Dirección legal o fiscal para comprobantes"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-lpignore="true"
        />
      </div>

      {/* Tarjeta de Cuenta Corriente */}
      <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 dark:border-slate-700/80 dark:bg-slate-800/50">
        <label className="flex items-center gap-2.5 text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
          <input
            type="checkbox"
            {...register("currentAccountEnabled")}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
            disabled={disabled}
          />
          Habilitar cuenta corriente para este cliente
        </label>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 ml-6.5">
          Permite realizar ventas a crédito o fiadas y gestionar saldos deudores.
        </p>

        {currentAccountEnabled && (
          <div className="mt-3.5 pt-3 border-t border-slate-200/80 dark:border-slate-700/60">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Límite de crédito autorizado ($) <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400 lowercase">(opcional)</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              {...register("currentAccountLimit")}
              className={inputClass}
              disabled={disabled || !currentAccountEnabled}
              placeholder="Dejar vacío para crédito sin límite de tope"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
        )}
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
            label="Dictar observaciones de cliente"
          />
        </div>
        <textarea
          {...register("observations")}
          className={inputClass}
          rows={3}
          disabled={disabled}
          placeholder="Notas internas sobre preferencias de entrega, horarios de atención, etc."
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {/* Footer de Acciones del Modal */}
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
          {mode === "create" ? "Crear cliente" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
};
