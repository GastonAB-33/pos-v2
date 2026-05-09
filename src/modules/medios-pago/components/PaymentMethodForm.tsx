import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import {
  getPaymentMethodBaseNotes,
  getPaymentMethodPosConfig,
  getPaymentMethodTypeLabel,
} from "@/services/payment-methods.service";
import type { BankAccount, PaymentMethod } from "@/types/entities";
import {
  paymentMethodFormSchema,
  type PaymentMethodFormValues,
} from "@/modules/medios-pago/schemas/payment-method-form.schema";

interface PaymentMethodFormProps {
  paymentMethod?: PaymentMethod;
  bankAccounts: BankAccount[];
  disabled?: boolean;
  showHeader?: boolean;
  onCancel?: () => void;
  onSubmit: (values: PaymentMethodFormValues) => Promise<void>;
}

const defaultValues: PaymentMethodFormValues = {
  surcharge_percent: 0,
  discount_percent: 0,
  notes: "",
  config: {
    ask_destination_bank: false,
    destination_bank_account_ids: [],
    ask_coupon_number: false,
    ask_approval_number: false,
    ask_operation_number: false,
    ask_voucher_number: false,
    ask_origin_bank: false,
    allow_new_origin_bank: false,
    ask_origin_account_holder: false,
    ask_card_brand: false,
    ask_installment_plan: false,
    ask_cheque_number: false,
    ask_cheque_due_date: false,
  },
};

export const PaymentMethodForm = ({
  paymentMethod,
  bankAccounts,
  disabled,
  showHeader = true,
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

    const config = getPaymentMethodPosConfig(paymentMethod);
    reset({
      surcharge_percent: paymentMethod.surcharge_percent,
      discount_percent: paymentMethod.discount_percent,
      notes: getPaymentMethodBaseNotes(paymentMethod.notes) ?? "",
      config,
    });
  }, [paymentMethod, reset]);

  const selectedCode = paymentMethod?.code.trim().toLowerCase() ?? "";
  const askDestinationBank = watch("config.ask_destination_bank");
  const destinationBankAccountIds = watch("config.destination_bank_account_ids") ?? [];

  const showCardFields = selectedCode === "card_debit" || selectedCode === "card_credit";
  const showCreditOnlyFields = selectedCode === "card_credit";
  const showTransferFields = selectedCode === "transfer";
  const showMercadoPagoFields = selectedCode === "mercado_pago";
  const showChequeFields = selectedCode === "cheque";

  const availableDestinationAccounts = useMemo(
    () => [...bankAccounts].sort((a, b) => a.bank_name.localeCompare(b.bank_name)),
    [bankAccounts]
  );

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
      {paymentMethod && showHeader ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
          <p className="font-semibold text-slate-900">{paymentMethod.name}</p>
          <p className="text-xs text-slate-500">
            Codigo: <span className="font-mono">{paymentMethod.code}</span> | Tipo:{" "}
            {getPaymentMethodTypeLabel(paymentMethod.type)}
          </p>
        </div>
      ) : null}

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

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-sm font-medium text-slate-700">Datos a solicitar en POS</p>
        <div className="mt-3 grid gap-2">
          {showCardFields || showTransferFields || showMercadoPagoFields || showChequeFields ? (
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4"
                {...register("config.ask_destination_bank")}
                disabled={disabled}
              />
              Solicitar cuenta bancaria destino
            </label>
          ) : null}

          {showCardFields ? (
            <>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  {...register("config.ask_coupon_number")}
                  disabled={disabled}
                />
                Solicitar numero de cupon
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  {...register("config.ask_approval_number")}
                  disabled={disabled}
                />
                Solicitar numero de aprobacion
              </label>
            </>
          ) : null}

          {showCreditOnlyFields ? (
            <>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  {...register("config.ask_card_brand")}
                  disabled={disabled}
                />
                Solicitar marca de tarjeta
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  {...register("config.ask_installment_plan")}
                  disabled={disabled}
                />
                Solicitar plan de cuotas
              </label>
            </>
          ) : null}

          {showTransferFields || showChequeFields ? (
            <>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  {...register("config.ask_origin_bank")}
                  disabled={disabled}
                />
                Solicitar banco de origen
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  {...register("config.allow_new_origin_bank")}
                  disabled={disabled}
                />
                Permitir alta rapida de banco de origen
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  {...register("config.ask_origin_account_holder")}
                  disabled={disabled}
                />
                Solicitar titular de cuenta/origen
              </label>
            </>
          ) : null}

          {showTransferFields ? (
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4"
                {...register("config.ask_voucher_number")}
                disabled={disabled}
              />
              Solicitar numero de comprobante
            </label>
          ) : null}

          {showMercadoPagoFields ? (
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4"
                {...register("config.ask_operation_number")}
                disabled={disabled}
              />
              Solicitar numero de operacion manual
            </label>
          ) : null}

          {showChequeFields ? (
            <>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  {...register("config.ask_cheque_number")}
                  disabled={disabled}
                />
                Solicitar numero de cheque
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  {...register("config.ask_cheque_due_date")}
                  disabled={disabled}
                />
                Solicitar fecha de vencimiento
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  {...register("config.ask_approval_number")}
                  disabled={disabled}
                />
                Solicitar numero de aprobacion/clearing
              </label>
            </>
          ) : null}

          {!showCardFields && !showTransferFields && !showMercadoPagoFields && !showChequeFields ? (
            <p className="text-xs text-slate-500">
              Este medio no requiere datos adicionales por defecto. Puedes ajustar solo recargos,
              descuentos y observaciones.
            </p>
          ) : null}
        </div>
      </div>

      {askDestinationBank ? (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Cuentas bancarias destino habilitadas
          </label>
          <select
            multiple
            value={destinationBankAccountIds}
            onChange={(event) => {
              const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
              setValue("config.destination_bank_account_ids", selected, {
                shouldDirty: true,
                shouldValidate: true,
              });
            }}
            className="ui-input min-h-28"
            disabled={disabled}
          >
            {availableDestinationAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.bank_name} | {account.alias || account.holder_name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Si no seleccionas ninguna, el POS permitira elegir cualquier cuenta activa.
          </p>
        </div>
      ) : null}

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Notas internas (opcional)
        </label>
        <textarea rows={3} {...register("notes")} className="ui-input" disabled={disabled} />
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
        {onCancel ? (
          <button type="button" onClick={onCancel} className="ui-btn-ghost" disabled={disabled}>
            Cancelar
          </button>
        ) : null}
        <button type="submit" className="ui-btn-primary disabled:opacity-60" disabled={disabled}>
          Guardar cambios
        </button>
      </div>
    </form>
  );
};
