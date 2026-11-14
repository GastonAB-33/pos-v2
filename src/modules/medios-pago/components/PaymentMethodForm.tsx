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
import { handleNumericInputFocus, handleNumericInputBlur, parseNumericField } from "@/utils/input-helpers";

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
        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 text-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="font-bold text-slate-900 dark:text-slate-100">{paymentMethod.name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Código: <span className="font-mono">{paymentMethod.code}</span> | Tipo:{" "}
            {getPaymentMethodTypeLabel(paymentMethod.type)}
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Recargo %
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            {...register("surcharge_percent", {
              setValueAs: parseNumericField,
            })}
            onFocus={(e) =>
              handleNumericInputFocus(e, {
                isNew: !paymentMethod || paymentMethod.surcharge_percent === 0,
                onClear: () => setValue("surcharge_percent", "" as any),
              })
            }
            onBlur={(e) => {
              handleNumericInputBlur(e, "0", () => {
                setValue("surcharge_percent", 0);
              });
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:focus:border-blue-400 font-mono"
            disabled={disabled}
          />
          {errors.surcharge_percent ? (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.surcharge_percent.message}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Descuento %
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            {...register("discount_percent", {
              setValueAs: parseNumericField,
            })}
            onFocus={(e) =>
              handleNumericInputFocus(e, {
                isNew: !paymentMethod || paymentMethod.discount_percent === 0,
                onClear: () => setValue("discount_percent", "" as any),
              })
            }
            onBlur={(e) => {
              handleNumericInputBlur(e, "0", () => {
                setValue("discount_percent", 0);
              });
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:focus:border-blue-400 font-mono"
            disabled={disabled}
          />
          {errors.discount_percent ? (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.discount_percent.message}</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-700/80 dark:bg-slate-800/50">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
          Datos a solicitar en terminal de cobro (POS)
        </p>
        <div className="mt-3 grid gap-2.5">
          {showCardFields || showTransferFields || showMercadoPagoFields || showChequeFields ? (
            <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                {...register("config.ask_destination_bank")}
                disabled={disabled}
              />
              <span>Solicitar cuenta bancaria destino</span>
            </label>
          ) : null}

          {showCardFields ? (
            <>
              <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                  {...register("config.ask_coupon_number")}
                  disabled={disabled}
                />
                <span>Solicitar número de cupón</span>
              </label>
              <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                  {...register("config.ask_approval_number")}
                  disabled={disabled}
                />
                <span>Solicitar número de aprobación</span>
              </label>
            </>
          ) : null}

          {showCreditOnlyFields ? (
            <>
              <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                  {...register("config.ask_card_brand")}
                  disabled={disabled}
                />
                <span>Solicitar marca de tarjeta (Visa, Master, etc.)</span>
              </label>
              <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                  {...register("config.ask_installment_plan")}
                  disabled={disabled}
                />
                <span>Solicitar plan de cuotas</span>
              </label>
            </>
          ) : null}

          {showTransferFields || showChequeFields ? (
            <>
              <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                  {...register("config.ask_origin_bank")}
                  disabled={disabled}
                />
                <span>Solicitar banco de origen del cliente</span>
              </label>
              <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                  {...register("config.allow_new_origin_bank")}
                  disabled={disabled}
                />
                <span>Permitir alta rápida de nuevo banco de origen</span>
              </label>
              <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                  {...register("config.ask_origin_account_holder")}
                  disabled={disabled}
                />
                <span>Solicitar titular de cuenta emisora</span>
              </label>
            </>
          ) : null}

          {showTransferFields ? (
            <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                {...register("config.ask_voucher_number")}
                disabled={disabled}
              />
              <span>Solicitar número de comprobante de transferencia</span>
            </label>
          ) : null}

          {showMercadoPagoFields ? (
            <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                {...register("config.ask_operation_number")}
                disabled={disabled}
              />
              <span>Solicitar número de operación manual</span>
            </label>
          ) : null}

          {showChequeFields ? (
            <>
              <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                  {...register("config.ask_cheque_number")}
                  disabled={disabled}
                />
                <span>Solicitar número de cheque</span>
              </label>
              <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                  {...register("config.ask_cheque_due_date")}
                  disabled={disabled}
                />
                <span>Solicitar fecha de vencimiento de cobro</span>
              </label>
              <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                  {...register("config.ask_approval_number")}
                  disabled={disabled}
                />
                <span>Solicitar número de aprobación / clearing</span>
              </label>
            </>
          ) : null}

          {!showCardFields && !showTransferFields && !showMercadoPagoFields && !showChequeFields ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Este medio no requiere datos operativos adicionales en POS. Puedes ajustar solo recargos,
              descuentos y notas internas.
            </p>
          ) : null}
        </div>
      </div>

      {askDestinationBank ? (
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
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
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:focus:border-blue-400 min-h-28"
            disabled={disabled}
          >
            {availableDestinationAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.bank_name} — {account.holder_name}{account.alias ? ` (${account.alias})` : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Si no seleccionas ninguna, el POS permitirá elegir cualquier cuenta bancaria activa.
          </p>
        </div>
      ) : null}

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
          Notas internas (opcional)
        </label>
        <textarea
          rows={3}
          {...register("notes")}
          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:focus:border-blue-400"
          placeholder="Comentarios u observaciones para este medio..."
          disabled={disabled}
        />
      </div>

      <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 dark:border-slate-800 pt-4">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
            disabled={disabled}
          >
            Cancelar
          </button>
        ) : null}
        <button
          type="submit"
          className="rounded-xl bg-blue-600 px-5 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
          disabled={disabled}
        >
          Guardar cambios
        </button>
      </div>
    </form>
  );
};