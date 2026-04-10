import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import type { PaymentMethod } from "@/types/entities";
import {
  paymentMethodFormSchema,
  paymentMethodTypeOptions,
  type PaymentMethodFormValues,
} from "@/modules/medios-pago/schemas/payment-method-form.schema";

interface PaymentMethodFormProps {
  mode: "create" | "edit";
  paymentMethod?: PaymentMethod;
  disabled?: boolean;
  onCancel: () => void;
  onSubmit: (values: PaymentMethodFormValues) => Promise<void>;
}

const defaultValues: PaymentMethodFormValues = {
  name: "",
  code: "",
  type: "cash",
  affects_cash: true,
  surcharge_percent: 0,
  discount_percent: 0,
  notes: "",
};

const getTypeLabel = (type: PaymentMethodFormValues["type"]) => {
  switch (type) {
    case "cash":
      return "Efectivo";
    case "transfer":
      return "Transferencia";
    case "card":
      return "Tarjeta";
    case "mercado_pago":
      return "Mercado Pago";
    case "current_account":
      return "Cuenta corriente";
    default:
      return "Otro";
  }
};

export const PaymentMethodForm = ({
  mode,
  paymentMethod,
  disabled,
  onCancel,
  onSubmit,
}: PaymentMethodFormProps) => {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PaymentMethodFormValues>({
    resolver: zodResolver(paymentMethodFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (!paymentMethod) {
      reset(defaultValues);
      return;
    }

    reset({
      name: paymentMethod.name,
      code: paymentMethod.code,
      type: paymentMethod.type,
      affects_cash: paymentMethod.affects_cash,
      surcharge_percent: paymentMethod.surcharge_percent,
      discount_percent: paymentMethod.discount_percent,
      notes: paymentMethod.notes ?? "",
    });
  }, [paymentMethod, reset]);

  const selectedType = watch("type");

  useEffect(() => {
    if (selectedType === "current_account") {
      setValue("affects_cash", false);
    }
  }, [selectedType, setValue]);

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Nombre</label>
          <input {...register("name")} className="ui-input" disabled={disabled} />
          {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name.message}</p> : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Codigo</label>
          <input {...register("code")} className="ui-input" disabled={disabled} />
          {errors.code ? <p className="mt-1 text-xs text-red-600">{errors.code.message}</p> : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Tipo</label>
          <select {...register("type")} className="ui-input" disabled={disabled}>
            {paymentMethodTypeOptions.map((type) => (
              <option key={type} value={type}>
                {getTypeLabel(type)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 pt-7">
          <input
            id="affects_cash"
            type="checkbox"
            {...register("affects_cash")}
            className="h-4 w-4"
            disabled={disabled || selectedType === "current_account"}
          />
          <label htmlFor="affects_cash" className="text-sm text-slate-700">
            Impacta caja fisica
          </label>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Recargo %</label>
          <input
            type="number"
            step="0.01"
            min="0"
            {...register("surcharge_percent")}
            className="ui-input"
            disabled={disabled}
          />
          {errors.surcharge_percent ? (
            <p className="mt-1 text-xs text-red-600">{errors.surcharge_percent.message}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Descuento %</label>
          <input
            type="number"
            step="0.01"
            min="0"
            {...register("discount_percent")}
            className="ui-input"
            disabled={disabled}
          />
          {errors.discount_percent ? (
            <p className="mt-1 text-xs text-red-600">{errors.discount_percent.message}</p>
          ) : null}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Notas</label>
        <textarea rows={3} {...register("notes")} className="ui-input" disabled={disabled} />
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
        <button type="button" onClick={onCancel} className="ui-btn-ghost" disabled={disabled}>
          Cancelar
        </button>
        <button type="submit" className="ui-btn-primary disabled:opacity-60" disabled={disabled}>
          {mode === "create" ? "Crear medio" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
};
