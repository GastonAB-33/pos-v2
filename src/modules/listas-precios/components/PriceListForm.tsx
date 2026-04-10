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

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Descripcion</label>
        <textarea rows={2} {...register("description")} className="ui-input" disabled={disabled} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Modo de precio</label>
          <select {...register("priceMode")} className="ui-input" disabled={disabled}>
            <option value="percentage">Porcentaje</option>
            <option value="fixed">Precio fijo por producto</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Ajuste %</label>
          <input
            type="number"
            step="0.01"
            {...register("percentageAdjustment")}
            className="ui-input"
            disabled={disabled || priceMode !== "percentage"}
          />
          {errors.percentageAdjustment ? (
            <p className="mt-1 text-xs text-red-600">{errors.percentageAdjustment.message}</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
        <button type="button" onClick={onCancel} className="ui-btn-ghost" disabled={disabled}>
          Cancelar
        </button>
        <button type="submit" className="ui-btn-primary disabled:opacity-60" disabled={disabled}>
          {mode === "create" ? "Crear lista" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
};
