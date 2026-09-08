import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Calendar, CreditCard, FileText, Plus, User, StickyNote } from "lucide-react";
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
  formId?: string;
  onCreateSupplier: () => void;
  onSubmit: (values: PurchaseCheckoutValues) => Promise<boolean>;
}

const getTodayDate = () => new Date().toISOString().split("T")[0];

export const PurchaseCheckoutPanel = ({
  suppliers,
  canWrite,
  disabled,
  preferredSupplierId,
  formId = "purchase-checkout-form",
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
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <FileText className="h-4 w-4 text-brand-600" />
          Datos de la compra y factura
        </h2>
        <span className="text-[11px] text-slate-400">Campos del comprobante y proveedor</span>
      </div>

      <form id={formId} onSubmit={handleSubmit(submit)} className="space-y-3">
        {/* Grid principal de datos */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Proveedor */}
          <div className="lg:col-span-2">
            <div className="mb-1 flex items-center justify-between">
              <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                <User className="h-3 w-3 text-slate-400" />
                Proveedor *
              </label>
              <button
                type="button"
                className="inline-flex items-center gap-0.5 text-[11px] font-medium text-brand-600 hover:text-brand-700 hover:underline"
                onClick={onCreateSupplier}
                disabled={disabled || !canWrite}
              >
                <Plus className="h-3 w-3" />
                Nuevo
              </button>
            </div>
            <select
              {...register("supplierId")}
              className={`w-full rounded-lg border bg-slate-50/50 px-2.5 py-1.5 text-xs font-medium text-slate-800 transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 ${
                errors.supplierId ? "border-red-400 bg-red-50/30" : "border-slate-300"
              }`}
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
              <p className="mt-0.5 text-[11px] text-red-600">{errors.supplierId.message}</p>
            ) : null}
          </div>

          {/* Tipo de Comprobante */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              Comprobante
            </label>
            <select
              {...register("documentType")}
              className="w-full rounded-lg border border-slate-300 bg-slate-50/50 px-2.5 py-1.5 text-xs font-medium text-slate-800 transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
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

          {/* Nº Comprobante */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              Nº Comprobante
            </label>
            <input
              type="text"
              placeholder="0001-00012345"
              {...register("documentNumber")}
              className="w-full rounded-lg border border-slate-300 bg-slate-50/50 px-2.5 py-1.5 text-xs font-medium text-slate-800 transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              disabled={disabled || !canWrite}
            />
          </div>

          {/* Fecha Emisión */}
          <div>
            <label className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              <Calendar className="h-3 w-3 text-slate-400" />
              Fecha
            </label>
            <input
              type="date"
              {...register("issueDate")}
              className="w-full rounded-lg border border-slate-300 bg-slate-50/50 px-2.5 py-1.5 text-xs font-medium text-slate-800 transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              disabled={disabled || !canWrite}
            />
          </div>
        </div>

        {/* Fila secundaria: Medio de pago y Observaciones */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              <CreditCard className="h-3 w-3 text-slate-400" />
              Medio de Pago
            </label>
            <select
              {...register("paymentMethod")}
              className="w-full rounded-lg border border-slate-300 bg-slate-50/50 px-2.5 py-1.5 text-xs font-medium text-slate-800 transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
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

          <div className="sm:col-span-2">
            <label className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              <StickyNote className="h-3 w-3 text-slate-400" />
              Observaciones / Notas (Opcional)
            </label>
            <input
              type="text"
              placeholder="Notas breves sobre la compra o entrega..."
              {...register("notes")}
              className="w-full rounded-lg border border-slate-300 bg-slate-50/50 px-2.5 py-1.5 text-xs text-slate-800 transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              disabled={disabled || !canWrite}
            />
            {errors.notes ? <p className="mt-0.5 text-[11px] text-red-600">{errors.notes.message}</p> : null}
          </div>
        </div>
      </form>
    </section>
  );
};


