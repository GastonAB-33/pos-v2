import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import type {
  CurrentAccountSummary,
  CurrentAccountDebtSaleOption,
  RegisterCurrentAccountAdjustmentValues,
} from "@/modules/clientes/hooks/useCurrentAccount";

interface CurrentAccountAdjustmentModalProps {
  open: boolean;
  debtSales: CurrentAccountDebtSaleOption[];
  accountSummary: CurrentAccountSummary;
  disabled?: boolean;
  onClose: () => void;
  onSubmit: (values: RegisterCurrentAccountAdjustmentValues) => Promise<boolean>;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const parseOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const schema = z
  .object({
    mode: z.enum(["original", "update_to_today_price", "surcharge_percentage", "surcharge_fixed"]),
    surcharge_percent: z.preprocess(parseOptionalNumber, z.number().optional()),
    surcharge_amount: z.preprocess(parseOptionalNumber, z.number().optional()),
    notes: z.string().max(300, "Maximo 300 caracteres").optional().or(z.literal("")),
  })
  .superRefine((values, context) => {
    if (values.mode === "surcharge_percentage") {
      if (!values.surcharge_percent || values.surcharge_percent <= 0) {
        context.addIssue({
          path: ["surcharge_percent"],
          code: z.ZodIssueCode.custom,
          message: "Ingresa un porcentaje mayor a 0",
        });
      }
    }

    if (values.mode === "surcharge_fixed") {
      if (!values.surcharge_amount || values.surcharge_amount <= 0) {
        context.addIssue({
          path: ["surcharge_amount"],
          code: z.ZodIssueCode.custom,
          message: "Ingresa un monto fijo mayor a 0",
        });
      }
    }
  });

type FormValues = z.infer<typeof schema>;

const roundAmount = (value: number): number => Number(value.toFixed(2));

export const CurrentAccountAdjustmentModal = ({
  open,
  debtSales,
  accountSummary,
  disabled,
  onClose,
  onSubmit,
}: CurrentAccountAdjustmentModalProps) => {
  const {
    register,
    watch,
    setValue,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      mode: "update_to_today_price",
      surcharge_percent: undefined,
      surcharge_amount: undefined,
      notes: "",
    },
  });

  const busy = Boolean(disabled || isSubmitting);
  const selectedMode = watch("mode");
  const surchargePercent = watch("surcharge_percent");
  const surchargeAmount = watch("surcharge_amount");

  useEffect(() => {
    if (!open) return;
    const rule = accountSummary.pricingRule;
    const nextMode =
      rule.mode === "today_prices"
        ? "update_to_today_price"
        : rule.mode === "surcharge_percentage" || rule.mode === "surcharge_fixed" || rule.mode === "original"
          ? rule.mode
          : "update_to_today_price";
    setValue("mode", nextMode, { shouldValidate: true });
    setValue("surcharge_percent", rule.surcharge_percent ?? undefined);
    setValue("surcharge_amount", rule.surcharge_amount ?? undefined);
  }, [accountSummary.pricingRule, open, setValue]);

  const adjustmentPreview = useMemo(() => {
    if (selectedMode === "original") {
      return 0;
    }

    if (selectedMode === "update_to_today_price") {
      return roundAmount(accountSummary.updatedDebtTotal - accountSummary.initialDebtTotal);
    }

    if (selectedMode === "surcharge_percentage") {
      const percent = Number(surchargePercent ?? 0);
      if (!Number.isFinite(percent) || percent <= 0) return null;
      return roundAmount(accountSummary.initialDebtTotal * (percent / 100));
    }

    const fixed = Number(surchargeAmount ?? 0);
    if (!Number.isFinite(fixed) || fixed <= 0) return null;
    return roundAmount(fixed);
  }, [
    accountSummary.initialDebtTotal,
    accountSummary.updatedDebtTotal,
    selectedMode,
    surchargeAmount,
    surchargePercent,
  ]);

  const submit = async (values: FormValues) => {
    const ok = await onSubmit({
      mode: values.mode,
      surcharge_percent: values.surcharge_percent,
      surcharge_amount: values.surcharge_amount,
      notes: values.notes,
    });

    if (!ok) return;

    reset({
      mode: "update_to_today_price",
      surcharge_percent: undefined,
      surcharge_amount: undefined,
      notes: "",
    });
    onClose();
  };

  if (!open) return null;

  return (
    <section className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] p-4">
      <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Realizar ajuste</h3>
            <p className="text-xs text-slate-500">
              Define una regla global para mostrar el saldo actualizado sin crear movimientos contables.
            </p>
          </div>
          <ModalCloseButton label="Cerrar ajuste" onClick={onClose} disabled={busy} />
        </div>

        {!debtSales.length ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            No hay compras en cuenta corriente con productos para calcular saldo actualizado.
          </div>
        ) : (
          <form className="mt-4 grid gap-4" onSubmit={handleSubmit(submit)}>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              El recargo o actualizacion vigente reemplaza al anterior; no se suma varias veces.
            </div>

            <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  value="original"
                  {...register("mode")}
                  disabled={busy}
                />
                <span>Volver a precio original</span>
              </label>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  value="update_to_today_price"
                  {...register("mode")}
                  disabled={busy}
                />
                <span>Actualizar a precio de hoy</span>
              </label>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  value="surcharge_percentage"
                  {...register("mode")}
                  disabled={busy}
                />
                <span>Recargo porcentual sobre productos llevados</span>
              </label>
              {selectedMode === "surcharge_percentage" ? (
                <div>
                  <input
                    type="number"
                    step="0.01"
                    className="ui-input max-w-xs"
                    placeholder="Porcentaje de recargo"
                    {...register("surcharge_percent")}
                    disabled={busy}
                  />
                  {errors.surcharge_percent ? (
                    <p className="mt-1 text-xs text-red-600">{errors.surcharge_percent.message}</p>
                  ) : null}
                </div>
              ) : null}

              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  value="surcharge_fixed"
                  {...register("mode")}
                  disabled={busy}
                />
                <span>Recargo fijo sobre la compra</span>
              </label>
              {selectedMode === "surcharge_fixed" ? (
                <div>
                  <input
                    type="number"
                    step="0.01"
                    className="ui-input max-w-xs"
                    placeholder="Monto fijo de recargo"
                    {...register("surcharge_amount")}
                    disabled={busy}
                  />
                  {errors.surcharge_amount ? (
                    <p className="mt-1 text-xs text-red-600">{errors.surcharge_amount.message}</p>
                  ) : null}
                </div>
              ) : null}
            </div>

            {debtSales.length ? (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs text-slate-500">
                  Deuda original: <strong>{currency.format(accountSummary.initialDebtTotal)}</strong>
                  {" | "}
                  Deuda actualizada: <strong>{currency.format(accountSummary.updatedDebtTotal)}</strong>
                </p>
                {adjustmentPreview != null ? (
                  <p className="text-sm font-medium text-slate-800">
                    Diferencia de referencia: {currency.format(adjustmentPreview)}
                  </p>
                ) : null}
                <div className="max-h-44 overflow-y-auto rounded-md border border-slate-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-2 py-1 text-left">Producto</th>
                        <th className="px-2 py-1 text-left">Cantidad</th>
                        <th className="px-2 py-1 text-left">Precio compra</th>
                        <th className="px-2 py-1 text-left">Precio hoy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {debtSales.flatMap((sale) =>
                        sale.items.map((item) => (
                          <tr key={`${sale.sale_id}-${item.product_id}-${item.product_name}`}>
                            <td className="px-2 py-1 text-slate-700">{item.product_name}</td>
                            <td className="px-2 py-1 text-slate-700">
                              {item.quantity.toLocaleString("es-AR")}
                            </td>
                            <td className="px-2 py-1 text-slate-700">{currency.format(item.unit_price)}</td>
                            <td className="px-2 py-1 text-slate-700">
                              {item.current_unit_price == null
                                ? "-"
                                : currency.format(item.current_unit_price)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Observacion</label>
              <textarea rows={3} className="ui-input" {...register("notes")} disabled={busy} />
              {errors.notes ? <p className="mt-1 text-xs text-red-600">{errors.notes.message}</p> : null}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
              <button type="button" className="ui-btn-ghost" onClick={onClose} disabled={busy}>
                Cancelar
              </button>
              <button type="submit" className="ui-btn-primary" disabled={busy || !debtSales.length}>
                {busy ? "Guardando..." : "Guardar ajuste"}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
};
