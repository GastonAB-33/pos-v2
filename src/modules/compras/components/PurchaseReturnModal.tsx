import { useState } from "react";
import { AlertCircle, ArrowLeftRight, Check, DollarSign, X } from "lucide-react";
import type { Purchase, Supplier } from "@/types/entities";
import { IconButton } from "@/components/ui/IconButton";

export interface PurchaseReturnItemInput {
  productId: string;
  productName: string;
  returnQuantity: number;
  unitCost: number;
  vatPercent: number;
  refundAmount: number;
}

export interface PurchaseReturnPayload {
  purchaseId: string;
  items: PurchaseReturnItemInput[];
  totalRefund: number;
  refundToCash: boolean;
  reason: string;
}

interface PurchaseReturnModalProps {
  open: boolean;
  purchase: Purchase | null;
  supplier: Supplier | null;
  disabled?: boolean;
  onClose: () => void;
  onConfirmReturn: (payload: PurchaseReturnPayload) => Promise<boolean>;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const PurchaseReturnModal = ({
  open,
  purchase,
  supplier,
  disabled,
  onClose,
  onConfirmReturn,
}: PurchaseReturnModalProps) => {
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [refundToCash, setRefundToCash] = useState(true);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || !purchase) return null;

  const items = purchase.items ?? [];

  const handleQuantityChange = (productId: string, qty: number, maxQty: number) => {
    const safeQty = Math.max(0, Math.min(qty, maxQty));
    setReturnQuantities((prev) => ({
      ...prev,
      [productId]: safeQty,
    }));
    setError(null);
  };

  const calculatedReturnItems: PurchaseReturnItemInput[] = items
    .map((item) => {
      const returnQty = returnQuantities[item.product_id] || 0;
      if (returnQty <= 0) return null;

      const vat = item.vat_percent || 0;
      const unitGrossCost = item.unit_cost * (1 + vat / 100);
      const refundAmount = Number((returnQty * unitGrossCost).toFixed(2));

      return {
        productId: item.product_id,
        productName: item.product_name_snapshot,
        returnQuantity: returnQty,
        unitCost: item.unit_cost,
        vatPercent: vat,
        refundAmount,
      };
    })
    .filter((i): i is PurchaseReturnItemInput => i !== null);

  const totalRefund = Number(
    calculatedReturnItems.reduce((acc, curr) => acc + curr.refundAmount, 0).toFixed(2)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calculatedReturnItems.length) {
      setError("Debes ingresar al menos una unidad a devolver.");
      return;
    }

    if (!reason.trim()) {
      setError("Indica el motivo de la devolución o nota de crédito.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const success = await onConfirmReturn({
        purchaseId: purchase.id,
        items: calculatedReturnItems,
        totalRefund,
        refundToCash,
        reason: reason.trim(),
      });

      if (success) {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar la devolución.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] p-2 sm:p-4">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-700">
              <ArrowLeftRight className="h-4 w-4" />
              Devolución / Nota de Crédito a Proveedor
            </div>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              Compra {purchase.purchase_number}
            </h2>
            <p className="text-xs text-slate-500">
              Proveedor: {supplier?.name || "Sin proveedor"} | Total original: {currency.format(purchase.total)}
            </p>
          </div>
          <IconButton icon={X} label="Cerrar" onClick={onClose} disabled={isSubmitting || disabled} />
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 text-xs text-amber-900">
              <p className="font-semibold">¿Cómo funciona la devolución?</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-amber-800">
                <li>Los productos devueltos se descontarán automáticamente del stock actual.</li>
                <li>
                  Si seleccionas <strong>Reintegrar a caja diaria</strong>, se generará un movimiento de ingreso en la caja abierta por el monto acreditado.
                </li>
              </ul>
            </div>

            {error ? (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">
                Selecciona las cantidades a devolver
              </h3>
              <div className="space-y-2">
                {items.map((item) => {
                  const maxAvailable = (item.quantity + (item.bonified_quantity || 0)) - (item.returned_quantity || 0);
                  const currentReturnQty = returnQuantities[item.product_id] || 0;
                  const unitWithVat = item.unit_cost * (1 + (item.vat_percent || 0) / 100);

                  return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 truncate">
                          {item.product_name_snapshot}
                        </p>
                        <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span>Comprado: {item.quantity} u.</span>
                          {item.bonified_quantity ? (
                            <span>(+{item.bonified_quantity} bonif.)</span>
                          ) : null}
                          {item.returned_quantity ? (
                            <span className="text-amber-700">
                              (Ya devuelto: {item.returned_quantity})
                            </span>
                          ) : null}
                          <span>•</span>
                          <span>Costo c/IVA: {currency.format(unitWithVat)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-32">
                          <label className="mb-0.5 block text-[10px] font-semibold uppercase text-slate-500">
                            Cant. a devolver
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={maxAvailable}
                            step="any"
                            value={currentReturnQty || ""}
                            placeholder="0"
                            disabled={maxAvailable <= 0 || isSubmitting || disabled}
                            onChange={(e) =>
                              handleQuantityChange(
                                item.product_id,
                                Number(e.target.value),
                                maxAvailable
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-900 focus:border-brand-500 focus:outline-none"
                          />
                        </div>
                        <div className="w-24 text-right">
                          <span className="block text-[10px] uppercase text-slate-400">Reintegro</span>
                          <span className="text-xs font-bold text-slate-800">
                            {currency.format(currentReturnQty * unitWithVat)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Opciones de reintegro */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                <input
                  type="checkbox"
                  checked={refundToCash}
                  onChange={(e) => setRefundToCash(e.target.checked)}
                  disabled={isSubmitting || disabled}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <DollarSign className="h-4 w-4 text-emerald-600" />
                <span>Reintegrar dinero en la caja diaria activa ({currency.format(totalRefund)})</span>
              </label>
              <p className="mt-1 pl-6 text-xs text-slate-500">
                Registra un movimiento de ingreso en la caja diaria abierta bajo el concepto "Reintegro devolución de compra".
              </p>
            </div>

            {/* Motivo */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-700">
                Motivo de la devolución / Nota de Crédito *
              </label>
              <textarea
                rows={2}
                required
                placeholder="Ej: Mercadería dañada en transporte / Faltante en remito / Producto vencido..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isSubmitting || disabled}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <div className="text-sm">
              <span className="text-slate-500">Total a acreditar: </span>
              <span className="text-base font-bold text-brand-700">{currency.format(totalRefund)}</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting || disabled}
                className="ui-btn-ghost"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || disabled || !calculatedReturnItems.length}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                Confirmar Devolución
              </button>
            </div>
          </footer>
        </form>
      </div>
    </section>
  );
};
