import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { Product } from "@/types/entities";
import {
  stockAdjustmentSchema,
  type StockAdjustmentValues,
} from "@/modules/stock/schemas/stock-adjustment.schema";
import { handleNumericInputFocus, handleNumericInputBlur, parseNumericField } from "@/utils/input-helpers";

interface StockAdjustmentFormProps {
  products: Product[];
  disabled?: boolean;
  canWrite: boolean;
  onSubmit: (values: StockAdjustmentValues) => Promise<void>;
}

export const StockAdjustmentForm = ({
  products,
  disabled,
  canWrite,
  onSubmit,
}: StockAdjustmentFormProps) => {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<StockAdjustmentValues>({
    resolver: zodResolver(stockAdjustmentSchema),
    defaultValues: {
      productId: "",
      quantity: 0,
      notes: "",
    },
  });

  const selectedProductId = watch("productId");
  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const isWeight = selectedProduct?.sale_mode === "weight";

  const submit = async (values: StockAdjustmentValues) => {
    const qty = isWeight ? Number((values.quantity / 1000).toFixed(4)) : values.quantity;
    await onSubmit({
      ...values,
      quantity: qty,
    });
    reset({
      productId: "",
      quantity: 0,
      notes: "",
    });
  };

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
      <h2 className="text-base font-semibold text-slate-900">Ajuste manual de stock</h2>

      <form className="grid gap-3" onSubmit={handleSubmit(submit)}>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Producto</label>
          <select
            {...register("productId")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled || !canWrite}
          >
            <option value="">Seleccionar...</option>
            {products
              .filter((product) => product.is_active)
              .map((product) => {
                const isProdWeight = product.sale_mode === "weight";
                const displayStock = isProdWeight ? product.stock_current * 1000 : product.stock_current;
                const unit = isProdWeight ? "g" : "u.";
                return (
                  <option key={product.id} value={product.id}>
                    {product.name} (stock: {displayStock.toLocaleString("es-AR")} {unit})
                  </option>
                );
              })}
          </select>
          {errors.productId ? (
            <p className="mt-1 text-xs text-red-600">{errors.productId.message}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Cantidad {isWeight ? "en gramos (g) — positivo suma, negativo resta" : "(positivo suma, negativo resta)"}
          </label>
          <input
            type="number"
            step="0.001"
            placeholder="0"
            {...register("quantity", {
              setValueAs: (val) => parseNumericField(val, true),
            })}
            onFocus={(e) =>
              handleNumericInputFocus(e, {
                isNew: true,
                onClear: () => setValue("quantity", "" as any),
              })
            }
            onBlur={(e) => {
              handleNumericInputBlur(e, "0", () => {
                setValue("quantity", 0);
              });
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled || !canWrite}
          />
          {errors.quantity ? (
            <p className="mt-1 text-xs text-red-600">{errors.quantity.message}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Motivo / observacion</label>
          <textarea
            rows={2}
            {...register("notes")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled || !canWrite}
          />
          {errors.notes ? <p className="mt-1 text-xs text-red-600">{errors.notes.message}</p> : null}
        </div>

        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          disabled={disabled || !canWrite}
        >
          Confirmar ajuste
        </button>
      </form>
    </section>
  );
};

