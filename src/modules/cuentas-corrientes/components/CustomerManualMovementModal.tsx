import { useState } from "react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useToast } from "@/components/ui/useToast";
import { currentAccountsService } from "@/services/current-accounts.service";
import type { Customer } from "@/types/entities";
import { DollarSign, PlusCircle, MinusCircle } from "lucide-react";

interface CustomerManualMovementModalProps {
  open: boolean;
  tenantId: string;
  userId: string | null;
  customer: Customer;
  onClose: () => void;
  onSuccess: () => void;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const CustomerManualMovementModal = ({
  open,
  tenantId,
  userId,
  customer,
  onClose,
  onSuccess,
}: CustomerManualMovementModalProps) => {
  const toast = useToast();
  const [movementType, setMovementType] = useState<"debt" | "adjustment">("debt");
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount.replace(",", "."));
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Ingresá un monto válido mayor a 0");
      return;
    }

    if (!concept.trim()) {
      toast.error("Ingresá un motivo o concepto para el movimiento");
      return;
    }

    setIsSubmitting(true);
    try {
      await currentAccountsService.createMovement(tenantId, {
        customer_id: customer.id,
        sale_id: null,
        type: movementType,
        amount: movementType === "adjustment" ? -numAmount : numAmount,
        notes: concept.trim(),
        created_by: userId ?? null,
      });

      toast.success(
        movementType === "debt"
          ? `Deuda de ${currency.format(numAmount)} registrada correctamente`
          : `Ajuste de ${currency.format(numAmount)} registrado correctamente`
      );
      setAmount("");
      setConcept("");
      onSuccess();
      onClose();
    } catch {
      toast.error("Error al registrar el movimiento en cuenta corriente");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Movimiento Manual en Cuenta Corriente
            </h3>
            <p className="text-xs text-slate-500">
              Cliente: <strong className="text-slate-700 dark:text-slate-300">{customer.full_name}</strong> • Saldo actual: {currency.format(customer.current_balance ?? 0)}
            </p>
          </div>
          <ModalCloseButton label="Cerrar modal" onClick={onClose} disabled={isSubmitting} />
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Tipo de Operación
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMovementType("debt")}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition ${
                  movementType === "debt"
                    ? "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 ring-2 ring-rose-500/20"
                    : "border-slate-200 hover:bg-slate-50 text-slate-700 dark:border-slate-700 dark:text-slate-300"
                }`}
              >
                <PlusCircle className="h-4 w-4 text-rose-600" />
                <span>Adeudar / Cargo</span>
              </button>

              <button
                type="button"
                onClick={() => setMovementType("adjustment")}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition ${
                  movementType === "adjustment"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 ring-2 ring-emerald-500/20"
                    : "border-slate-200 hover:bg-slate-50 text-slate-700 dark:border-slate-700 dark:text-slate-300"
                }`}
              >
                <MinusCircle className="h-4 w-4 text-emerald-600" />
                <span>Ajuste / A Favor</span>
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              {movementType === "debt"
                ? "Suma deuda a la cuenta del cliente (ej. venta fiada, recargo, entrega sin cobro)."
                : "Resta deuda a la cuenta del cliente (ej. compensación, bonificación manual, etc.)."}
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Monto ($)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                autoFocus
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Concepto / Motivo
            </label>
            <input
              type="text"
              required
              placeholder={movementType === "debt" ? "Ej: Venta fiada mostrador, mercadería retirada..." : "Ej: Ajuste por redondeo, bonificación..."}
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              disabled={isSubmitting}
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="ui-btn-ghost text-xs"
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition ${
                movementType === "debt"
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Registrando..." : movementType === "debt" ? "Adeudar al cliente" : "Registrar ajuste"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
