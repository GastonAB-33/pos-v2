import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Plus } from "lucide-react";
import { useEffect } from "react";
import type { Supplier } from "@/types/entities";
import {
  purchaseCheckoutSchema,
  type PurchaseCheckoutValues,
} from "@/modules/compras/schemas/purchase-checkout.schema";

interface PurchaseCheckoutPanelProps {
  suppliers: Supplier[];
  canWrite: boolean;
  disabled?: boolean;
  preferredSupplierId?: string;
  onCreateSupplier: () => void;
  onSubmit: (values: PurchaseCheckoutValues) => Promise<boolean>;
}

export const PurchaseCheckoutPanel = ({
  suppliers,
  canWrite,
  disabled,
  preferredSupplierId,
  onCreateSupplier,
  onSubmit,
}: PurchaseCheckoutPanelProps) => {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<PurchaseCheckoutValues>({
    resolver: zodResolver(purchaseCheckoutSchema),
    defaultValues: {
      supplierId: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (preferredSupplierId) {
      setValue("supplierId", preferredSupplierId, { shouldValidate: true });
    }
  }, [preferredSupplierId, setValue]);

  const submit = async (values: PurchaseCheckoutValues) => {
    const saved = await onSubmit(values);
    if (saved) {
      reset({
        supplierId: "",
        notes: "",
      });
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
      <h2 className="text-base font-semibold text-slate-900">Confirmar compra</h2>

      <form className="grid gap-3" onSubmit={handleSubmit(submit)}>
        <div>
          <div className="mb-1 flex items-center justify-between gap-3">
            <label className="block text-sm font-medium text-slate-700">Proveedor</label>
            <button
              type="button"
              className="ui-btn-ghost px-2 py-1 text-xs"
              onClick={onCreateSupplier}
              disabled={disabled || !canWrite}
            >
              <Plus aria-hidden="true" className="h-3.5 w-3.5" />
              Nuevo proveedor
            </button>
          </div>
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

