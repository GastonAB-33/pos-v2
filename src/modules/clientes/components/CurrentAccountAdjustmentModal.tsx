import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type {
  CurrentAccountSummary,
  CurrentAccountDebtSaleOption,
  RegisterCurrentAccountAdjustmentValues,
} from "@/modules/clientes/hooks/useCurrentAccount";
import {
  ShieldAlert,
  AlertTriangle,
  Check,
  Loader2,
  SlidersHorizontal,
  TrendingUp,
} from "lucide-react";

interface CurrentAccountAdjustmentModalProps {
  open: boolean;
  debtSales: CurrentAccountDebtSaleOption[];
  accountSummary: CurrentAccountSummary;
  customerName?: string;
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
    notes: z.string().max(300, "Máximo 300 caracteres").optional().or(z.literal("")),
  })
  .superRefine((values, context) => {
    if (values.mode === "surcharge_percentage") {
      if (!values.surcharge_percent || values.surcharge_percent <= 0) {
        context.addIssue({
          path: ["surcharge_percent"],
          code: z.ZodIssueCode.custom,
          message: "Ingresá un porcentaje mayor a 0",
        });
      }
    }

    if (values.mode === "surcharge_fixed") {
      if (!values.surcharge_amount || values.surcharge_amount <= 0) {
        context.addIssue({
          path: ["surcharge_amount"],
          code: z.ZodIssueCode.custom,
          message: "Ingresá un monto fijo mayor a 0",
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
  customerName,
  disabled,
  onClose,
  onSubmit,
}: CurrentAccountAdjustmentModalProps) => {
  useBodyScrollLock(open);

  const [showSecurityConfirm, setShowSecurityConfirm] = useState(false);
  const [pendingFormValues, setPendingFormValues] = useState<FormValues | null>(null);
  const [isSubmittingLocal, setIsSubmittingLocal] = useState(false);

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

  const busy = Boolean(disabled || isSubmitting || isSubmittingLocal);
  const selectedMode = watch("mode");
  const surchargePercent = watch("surcharge_percent");
  const surchargeAmount = watch("surcharge_amount");

  useEffect(() => {
    if (!open) return;
    setShowSecurityConfirm(false);
    setPendingFormValues(null);
    setIsSubmittingLocal(false);

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

  // Manejo de teclado global: Escape para salir
  useEffect(() => {
    if (!open) return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (showSecurityConfirm) {
          setShowSecurityConfirm(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [open, onClose, showSecurityConfirm]);

  const pendingDebtTotal = useMemo(() => {
    return Math.max(0, accountSummary.accountingBalance);
  }, [accountSummary.accountingBalance]);

  const salesTodayTotal = useMemo(() => {
    return roundAmount(
      debtSales.reduce((sum, sale) => sum + (sale.current_total ?? sale.debt_amount), 0)
    );
  }, [debtSales]);

  const salesOriginalDebt = useMemo(() => {
    return roundAmount(
      debtSales.reduce((sum, sale) => sum + sale.debt_amount, 0)
    );
  }, [debtSales]);

  const nonSalesDebt = useMemo(() => {
    return Math.max(0, roundAmount(pendingDebtTotal - salesOriginalDebt));
  }, [pendingDebtTotal, salesOriginalDebt]);

  const todayPricesTotal = useMemo(() => {
    return roundAmount(salesTodayTotal + nonSalesDebt);
  }, [salesTodayTotal, nonSalesDebt]);

  const adjustmentPreview = useMemo(() => {
    if (selectedMode === "original") {
      return 0;
    }

    if (selectedMode === "update_to_today_price") {
      return roundAmount(todayPricesTotal - pendingDebtTotal);
    }

    if (selectedMode === "surcharge_percentage") {
      const percent = Number(surchargePercent ?? 0);
      if (!Number.isFinite(percent) || percent <= 0) return null;
      return roundAmount(pendingDebtTotal * (percent / 100));
    }

    const fixed = Number(surchargeAmount ?? 0);
    if (!Number.isFinite(fixed) || fixed <= 0) return null;
    return roundAmount(fixed);
  }, [
    pendingDebtTotal,
    todayPricesTotal,
    selectedMode,
    surchargeAmount,
    surchargePercent,
  ]);

  const estimatedUpdatedDebt = useMemo(() => {
    if (selectedMode === "original") return pendingDebtTotal;
    if (selectedMode === "update_to_today_price") return todayPricesTotal;
    if (adjustmentPreview != null) return roundAmount(pendingDebtTotal + adjustmentPreview);
    return pendingDebtTotal;
  }, [selectedMode, pendingDebtTotal, todayPricesTotal, adjustmentPreview]);

  const isModeBlocked = selectedMode === "update_to_today_price" && debtSales.length === 0;

  // Paso 1: Valida el formulario y abre la confirmación de seguridad
  const onInitialSubmit = (values: FormValues) => {
    setPendingFormValues(values);
    setShowSecurityConfirm(true);
  };

  // Paso 2: El usuario confirma explícitamente en el diálogo de seguridad
  const executeFinalSubmit = async () => {
    if (!pendingFormValues) return;
    setIsSubmittingLocal(true);

    try {
      const ok = await onSubmit({
        mode: pendingFormValues.mode,
        surcharge_percent: pendingFormValues.surcharge_percent,
        surcharge_amount: pendingFormValues.surcharge_amount,
        notes: pendingFormValues.notes,
      });

      if (!ok) return;

      setShowSecurityConfirm(false);
      reset({
        mode: "update_to_today_price",
        surcharge_percent: undefined,
        surcharge_amount: undefined,
        notes: "",
      });
      onClose();
    } finally {
      setIsSubmittingLocal(false);
    }
  };

  if (!open) return null;

  return (
    <section className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl sm:rounded-3xl border border-slate-300 dark:border-slate-700 bg-white shadow-2xl dark:bg-slate-900 overflow-hidden">
        {/* Cabecera del modal */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 p-4 sm:p-5 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 dark:bg-purple-950/70 dark:text-purple-400 border border-purple-200/80 dark:border-purple-900/60 shadow-xs shrink-0">
              <SlidersHorizontal size={20} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block">
                CUENTA CORRIENTE › REGLA DE AJUSTE
              </span>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
                Actualizar Regla / Ajuste de Cuenta Corriente
              </h3>
              {customerName && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Cliente: <strong className="text-slate-700 dark:text-slate-300">{customerName}</strong>
                </p>
              )}
            </div>
          </div>
          <ModalCloseButton label="Cerrar ajuste" onClick={onClose} disabled={busy} />
        </div>

        <form className="flex flex-1 flex-col overflow-hidden" onSubmit={handleSubmit(onInitialSubmit)}>
          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            {/* Aviso informativo de la regla */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              La regla se calcula dinámicamente sobre la deuda pendiente de pago. Al cobrar, el saldo se cancela con este cálculo y se normaliza en la cuenta corriente.
            </div>

            {/* Opciones de regla */}
            <div className="grid gap-2.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Modalidad de Ajuste
              </span>

              {/* Opción 1: Original */}
              <label className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer ${
                selectedMode === "original"
                  ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 ring-1 ring-blue-500/30"
                  : "border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:border-slate-300"
              }`}>
                <input
                  type="radio"
                  value="original"
                  className="mt-0.5 text-blue-600 dark:text-blue-500"
                  {...register("mode")}
                  disabled={busy}
                />
                <div>
                  <span className="font-bold text-xs sm:text-sm block">Volver a precio original</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Sin recargos adicionales ni ajustes sobre el saldo adeudado original.
                  </span>
                </div>
              </label>

              {/* Opción 2: Precio de hoy */}
              <label className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer ${
                selectedMode === "update_to_today_price"
                  ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 ring-1 ring-blue-500/30"
                  : "border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:border-slate-300"
              }`}>
                <input
                  type="radio"
                  value="update_to_today_price"
                  className="mt-0.5 text-blue-600 dark:text-blue-500"
                  {...register("mode")}
                  disabled={busy}
                />
                <div>
                  <span className="font-bold text-xs sm:text-sm block">Actualizar a precio de hoy (artículos pendientes)</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Ajusta los artículos no pagados al precio vigente de lista en catálogo.
                  </span>
                </div>
              </label>

              {selectedMode === "update_to_today_price" && debtSales.length === 0 && (
                <div className="ml-6 rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300">
                  No hay ventas con artículos pendientes para actualizar a precio de hoy (las deudas registradas son manuales o ya fueron canceladas). Podés usar Recargo porcentual o Recargo fijo.
                </div>
              )}

              {/* Opción 3: Recargo porcentual */}
              <label className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer ${
                selectedMode === "surcharge_percentage"
                  ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 ring-1 ring-blue-500/30"
                  : "border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:border-slate-300"
              }`}>
                <input
                  type="radio"
                  value="surcharge_percentage"
                  className="mt-0.5 text-blue-600 dark:text-blue-500"
                  {...register("mode")}
                  disabled={busy}
                />
                <div className="flex-1">
                  <span className="font-bold text-xs sm:text-sm block">Recargo porcentual (%) sobre saldo adeudado</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">
                    Aplica un porcentaje adicional pactado sobre la deuda pendiente.
                  </span>

                  {selectedMode === "surcharge_percentage" && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        data-lpignore="true"
                        className="w-40 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 px-3 py-1.5 text-sm font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ej: 10"
                        {...register("surcharge_percent")}
                        disabled={busy}
                      />
                      <span className="text-sm font-bold text-slate-600 dark:text-slate-400">%</span>
                    </div>
                  )}
                  {errors.surcharge_percent ? (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400 font-medium">{errors.surcharge_percent.message}</p>
                  ) : null}
                </div>
              </label>

              {/* Opción 4: Recargo fijo */}
              <label className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer ${
                selectedMode === "surcharge_fixed"
                  ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 ring-1 ring-blue-500/30"
                  : "border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:border-slate-300"
              }`}>
                <input
                  type="radio"
                  value="surcharge_fixed"
                  className="mt-0.5 text-blue-600 dark:text-blue-500"
                  {...register("mode")}
                  disabled={busy}
                />
                <div className="flex-1">
                  <span className="font-bold text-xs sm:text-sm block">Recargo fijo en pesos ($)</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">
                    Suma un monto fijo en pesos sobre la deuda pendiente.
                  </span>

                  {selectedMode === "surcharge_fixed" && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-600 dark:text-slate-400">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        data-lpignore="true"
                        className="w-44 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 px-3 py-1.5 text-sm font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ej: 2500"
                        {...register("surcharge_amount")}
                        disabled={busy}
                      />
                    </div>
                  )}
                  {errors.surcharge_amount ? (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400 font-medium">{errors.surcharge_amount.message}</p>
                  ) : null}
                </div>
              </label>
            </div>

            {/* Resumen en tiempo real del saldo pendiente y actualizado */}
            <div className="space-y-2 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <p className="text-slate-600 dark:text-slate-300">
                  Deuda original pendiente: <strong className="text-slate-900 dark:text-slate-100 font-mono">{currency.format(pendingDebtTotal)}</strong>
                </p>
                <p className="text-slate-600 dark:text-slate-300">
                  Saldo actualizado estimado:{" "}
                  <strong className="text-purple-600 dark:text-purple-400 text-sm font-mono font-black">
                    {currency.format(estimatedUpdatedDebt)}
                  </strong>
                </p>
              </div>

              {adjustmentPreview != null && adjustmentPreview !== 0 && (
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
                  <TrendingUp size={14} className={adjustmentPreview > 0 ? "text-purple-600" : "text-emerald-600"} />
                  <span>Diferencia calculada:</span>{" "}
                  <span className={adjustmentPreview > 0 ? "text-purple-600 dark:text-purple-400 font-bold font-mono" : "text-emerald-600 font-bold font-mono"}>
                    {adjustmentPreview > 0 ? `+${currency.format(adjustmentPreview)}` : currency.format(adjustmentPreview)}
                  </span>
                </p>
              )}

              {/* Tabla de artículos pendientes si aplica precio de hoy */}
              {selectedMode === "update_to_today_price" && debtSales.length > 0 && (
                <div className="pt-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Productos pendientes de pago cotizados a precio de hoy
                  </span>
                  <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
                    <table className="min-w-full text-xs">
                      <thead className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 sticky top-0 font-semibold">
                        <tr>
                          <th className="px-3 py-1.5 text-left">Producto</th>
                          <th className="px-3 py-1.5 text-left">Cant. pendiente</th>
                          <th className="px-3 py-1.5 text-left">Precio compra</th>
                          <th className="px-3 py-1.5 text-left">Precio hoy</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {debtSales.flatMap((sale) =>
                          sale.items.map((item) => (
                            <tr key={`${sale.sale_id}-${item.product_id}-${item.product_name}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                              <td className="px-3 py-1.5 text-slate-800 dark:text-slate-200 font-medium">{item.product_name}</td>
                              <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300">
                                {item.quantity.toLocaleString("es-AR")}
                              </td>
                              <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300 font-mono">{currency.format(item.unit_price)}</td>
                              <td className="px-3 py-1.5 text-slate-800 dark:text-slate-200 font-semibold font-mono">
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
              )}
            </div>

            {/* Observación / Justificación */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Observación / Justificación del Ajuste
              </label>
              <textarea
                rows={2}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                data-lpignore="true"
                className="w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 px-3.5 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                {...register("notes")}
                disabled={busy}
                placeholder="Notas o motivo del ajuste en la cuenta corriente..."
              />
              {errors.notes ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.notes.message}</p> : null}
            </div>
          </div>

          {/* Footer de acción principal */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 p-4 sm:p-5 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900">
            <button
              type="button"
              className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              onClick={onClose}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-2xl bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 px-5 py-2.5 text-xs font-bold text-white shadow-sm shadow-purple-500/25 transition active:scale-95 cursor-pointer disabled:cursor-not-allowed"
              disabled={busy || isModeBlocked}
            >
              <AlertTriangle size={14} className="text-amber-300" />
              <span>Continuar con el ajuste →</span>
            </button>
          </div>
        </form>

        {/* DIÁLOGO MODAL DE CONFIRMACIÓN DE SEGURIDAD */}
        {showSecurityConfirm && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-full max-w-md rounded-2xl sm:rounded-3xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
              {/* Header de Seguridad */}
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 shrink-0 border border-amber-300/40 dark:border-amber-700/40">
                  <ShieldAlert size={26} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                    CONFIRMACIÓN DE SEGURIDAD
                  </span>
                  <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
                    ¿Aplicar cambios a la Cuenta Corriente?
                  </h4>
                </div>
              </div>

              {/* Aviso explicativo con nombre de cliente */}
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                <p className="font-semibold">
                  Esta acción modificará el saldo adeudado y las reglas de cobro de:
                </p>
                <p className="mt-1 font-bold text-sm text-slate-900 dark:text-white">
                  {customerName ? customerName : "este cliente"}
                </p>
              </div>

              {/* Desglose de cambios */}
              <div className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 p-3.5 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-200/80 dark:border-slate-700/80">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Tipo de Ajuste:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-right">
                    {pendingFormValues?.mode === "update_to_today_price"
                      ? "Actualización a Precios de Hoy"
                      : pendingFormValues?.mode === "surcharge_percentage"
                      ? `Recargo Porcentual (+${pendingFormValues.surcharge_percent}%)`
                      : pendingFormValues?.mode === "surcharge_fixed"
                      ? `Recargo Fijo (+${currency.format(pendingFormValues.surcharge_amount ?? 0)})`
                      : "Volver a Precio Original (sin recargo)"}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-200/80 dark:border-slate-700/80">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Deuda Original Pendiente:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {currency.format(pendingDebtTotal)}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-200/80 dark:border-slate-700/80">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Diferencia Calculada:</span>
                  <span className={`font-mono font-bold ${
                    (adjustmentPreview ?? 0) > 0
                      ? "text-purple-600 dark:text-purple-400"
                      : (adjustmentPreview ?? 0) < 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-slate-600 dark:text-slate-300"
                  }`}>
                    {(adjustmentPreview ?? 0) > 0 ? `+${currency.format(adjustmentPreview ?? 0)}` : currency.format(adjustmentPreview ?? 0)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-700 dark:text-slate-200 font-bold">Nuevo Saldo Proyectado:</span>
                  <span className="font-mono text-sm font-black text-purple-600 dark:text-purple-400">
                    {currency.format(estimatedUpdatedDebt)}
                  </span>
                </div>
              </div>

              {/* Botones de acción de la confirmación */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowSecurityConfirm(false)}
                  disabled={isSubmittingLocal}
                  className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Volver a revisar
                </button>

                <button
                  type="button"
                  onClick={() => void executeFinalSubmit()}
                  disabled={isSubmittingLocal}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white px-5 py-2.5 text-xs font-bold shadow-sm shadow-amber-500/25 transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingLocal ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Aplicando...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} strokeWidth={3} />
                      <span>Sí, confirmar y aplicar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
