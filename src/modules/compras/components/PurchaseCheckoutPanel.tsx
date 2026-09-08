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

const getTodayDate = () => new Date().toISOString().split("T")[0];

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
      documentType: "FACTURA_A",
      documentNumber: "",
      issueDate: getTodayDate(),
      paymentMethod: "cash",
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
        documentType: "FACTURA_A",
        documentNumber: "",
        issueDate: getTodayDate(),
        paymentMethod: "cash",
        notes: "",
      });
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
      <h2 className="text-base font-semibold text-slate-900">Datos de la compra y factura</h2>

      <form className="grid gap-3" onSubmit={handleSubmit(submit)}>
        {/* Proveedor */}
        <div>
          <div className="mb-1 flex items-center justify-between gap-3">
            <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
              Proveedor *
            </label>
            <button
              type="button"
              className="ui-btn-ghost px-2 py-0.5 text-xs text-brand-700"
              onClick={onCreateSupplier}
              disabled={disabled || !canWrite}
            >
              <Plus aria-hidden="true" className="h-3.5 w-3.5" />
              Nuevo proveedor
            </button>
          </div>
          <select
            {...register("supplierId")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            disabled={disabled || !canWrite}
          >
            <option value="">Seleccionar proveedor...</option>
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

        {/* Tipo Comprobante & Número */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
              Comprobante
            </label>
            <select
              {...register("documentType")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              disabled={disabled || !canWrite}
            >
              <option value="FACTURA_A">Factura A</option>
              <option value="FACTURA_B">Factura B</option>
              <option value="FACTURA_C">Factura C</option>
              <option value="REMITO">Remito</option>
              <option value="TICKET">Ticket</option>
              <option value="PRESUPUESTO">Presupuesto</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
              Nº Comprobante
            </label>
            <input
              type="text"
              placeholder="Ej: 0001-00012345"
              {...register("documentNumber")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              disabled={disabled || !canWrite}
            />
          </div>
        </div>

        {/* Fecha & Medio de Pago */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
              Fecha Emisión
            </label>
            <input
              type="date"
              {...register("issueDate")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              disabled={disabled || !canWrite}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
              Medio de Pago
            </label>
            <select
              {...register("paymentMethod")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              disabled={disabled || !canWrite}
            >
              <option value="cash">Efectivo (Impacta Caja Diaria)</option>
              <option value="transfer">Transferencia Bancaria</option>
              <option value="card_debit">Tarjeta de Débito</option>
              <option value="card_credit">Tarjeta de Crédito</option>
              <option value="current_account">Cuenta Corriente Proveedor</option>
              <option value="other">Otro</option>
            </select>
          </div>
        </div>

        {/* Observaciones */}
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
            Observaciones / Notas
          </label>
          <textarea
            rows={2}
            placeholder="Notas adicionales sobre la compra o entrega..."
            {...register("notes")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            disabled={disabled || !canWrite}
          />
          {errors.notes ? <p className="mt-1 text-xs text-red-600">{errors.notes.message}</p> : null}
        </div>

        <button
          type="submit"
          className="mt-2 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
          disabled={disabled || !canWrite}
        >
          Confirmar y registrar compra
        </button>
      </form>
    </section>
  );
};


