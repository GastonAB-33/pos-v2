import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { Supplier } from "@/types/entities";
import {
  purchaseCheckoutSchema,
  type PurchaseCheckoutValues,
} from "@/modules/compras/schemas/purchase-checkout.schema";

interface PurchaseCheckoutPanelProps {
  suppliers: Supplier[];
  canWrite: boolean;
  disabled?: boolean;
  onSubmit: (values: PurchaseCheckoutValues) => Promise<void>;
}

export const PurchaseCheckoutPanel = ({
  suppliers,
  canWrite,
  disabled,
  onSubmit,
}: PurchaseCheckoutPanelProps) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PurchaseCheckoutValues>({
    resolver: zodResolver(purchaseCheckoutSchema),
    defaultValues: {
      supplierId: "",
      notes: "",
    },
  });

  const submit = async (values: PurchaseCheckoutValues) => {
    await onSubmit(values);
    reset({
      supplierId: "",
      notes: "",
    });
  };

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
      <h2 className="text-base font-semibold text-slate-900">Confirmar compra</h2>

      <form className="grid gap-3" onSubmit={handleSubmit(submit)}>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Proveedor</label>
          <select
            {...register("supplierId")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled || !canWrite}
          >
            <option value="">Seleccionar...</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
          {errors.supplierId ? (
            <p className="mt-1 text-xs text-red-600">{errors.supplierId.message}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Observacion</label>
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
          Registrar compra
        </button>
      </form>
    </section>
  );
};

