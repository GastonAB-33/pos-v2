import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { Customer } from "@/types/entities";
import {
  budgetFormSchema,
  type BudgetFormValues,
} from "@/modules/facturacion/schemas/facturacion.schemas";

interface BudgetFormProps {
  customers: Customer[];
  disabled?: boolean;
  onSubmit: (values: BudgetFormValues) => Promise<void>;
  onCancel: () => void;
}

const defaultValues: BudgetFormValues = {
  customerId: "",
  subtotal: 0,
  taxTotal: 0,
  notes: "",
};

export const BudgetForm = ({ customers, disabled, onSubmit, onCancel }: BudgetFormProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues,
  });

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Cliente (opcional)</label>
        <select {...register("customerId")} className="ui-input" disabled={disabled}>
          <option value="">Sin cliente</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.full_name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Subtotal</label>
          <input type="number" step="0.01" {...register("subtotal")} className="ui-input" disabled={disabled} />
          {errors.subtotal ? <p className="mt-1 text-xs text-red-600">{errors.subtotal.message}</p> : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Impuestos</label>
          <input type="number" step="0.01" {...register("taxTotal")} className="ui-input" disabled={disabled} />
          {errors.taxTotal ? <p className="mt-1 text-xs text-red-600">{errors.taxTotal.message}</p> : null}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Notas</label>
        <textarea rows={3} {...register("notes")} className="ui-input" disabled={disabled} />
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
        <button type="button" className="ui-btn-ghost" onClick={onCancel} disabled={disabled}>
          Cancelar
        </button>
        <button type="submit" className="ui-btn-primary" disabled={disabled}>
          Crear presupuesto
        </button>
      </div>
    </form>
  );
};
