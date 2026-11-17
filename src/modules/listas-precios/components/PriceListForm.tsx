import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import type { PriceList } from "@/types/entities";
import {
  priceListFormSchema,
  type PriceListFormValues,
} from "@/modules/listas-precios/schemas/price-list-form.schema";

interface PriceListFormProps {
  mode: "create" | "edit";
  priceList?: PriceList;
  disabled?: boolean;
  onCancel: () => void;
  onSubmit: (values: PriceListFormValues) => Promise<void>;
}

const defaultValues: PriceListFormValues = {
  name: "",
  code: "",
  description: "",
  priceMode: "percentage",
  percentageAdjustment: 0,
};

export const PriceListForm = ({
  mode,
  priceList,
  disabled,
  onCancel,
  onSubmit,
}: PriceListFormProps) => {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<PriceListFormValues>({
    resolver: zodResolver(priceListFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (!priceList) {
      reset(defaultValues);
      return;
    }

    reset({
      name: priceList.name,
      code: priceList.code,
      description: priceList.description ?? "",
      priceMode: priceList.price_mode,
      percentageAdjustment: priceList.percentage_adjustment ?? 0,
    });
  }, [priceList, reset]);

  const priceMode = watch("priceMode");

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Nombre
          </label>
          <input
            {...register("name")}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200 dark:placeholder-slate-500 dark:disabled:bg-slate-800/60"
            disabled={disabled}
          />
          {errors.name ? <p className="mt-1 text-xs text-rose-500">{errors.name.message}</p> : null}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Código
          </label>
          <input
            {...register("code")}
            type="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
            data-form-type="other"
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200 dark:placeholder-slate-500 dark:disabled:bg-slate-800/60"
            disabled={disabled}
          />
          {errors.code ? <p className="mt-1 text-xs text-rose-500">{errors.code.message}</p> : null}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
          Descripción
        </label>
        <textarea
          rows={2}
          {...register("description")}
          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200 dark:placeholder-slate-500 dark:disabled:bg-slate-800/60"
          disabled={disabled}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Modo de precio
          </label>
          <select
            {...register("priceMode")}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-800 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200 dark:disabled:bg-slate-800/60"
            disabled={disabled}
          >
            <option value="percentage">Porcentaje</option>
            <option value="fixed">Precio fijo por producto</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Ajuste %
          </label>
          <input
            type="number"
            step="0.01"
            {...register("percentageAdjustment")}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200 dark:placeholder-slate-500 dark:disabled:bg-slate-800/60"
            disabled={disabled || priceMode !== "percentage"}
          />
          {errors.percentageAdjustment ? (
            <p className="mt-1 text-xs text-rose-500">{errors.percentageAdjustment.message}</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2.5 border-t border-slate-200/90 pt-4 dark:border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-all"
          disabled={disabled}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700 active:scale-95 disabled:opacity-60 transition-all"
          disabled={disabled}
        >
          {mode === "create" ? "Crear lista" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
};
