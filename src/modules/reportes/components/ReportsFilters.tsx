import { FilterX } from "lucide-react";
import type {
  ReportStatusFilter,
  ReportsFiltersState,
} from "@/modules/reportes/hooks/useReportsModule";

interface SelectOption {
  value: string;
  label: string;
}

interface ReportsFiltersProps {
  filters: ReportsFiltersState;
  statusOptions: SelectOption[];
  customerOptions: SelectOption[];
  productOptions: SelectOption[];
  paymentMethodOptions: SelectOption[];
  disabled?: boolean;
  onChange: (patch: Partial<ReportsFiltersState>) => void;
  onReset: () => void;
}

export const ReportsFilters = ({
  filters,
  statusOptions,
  customerOptions,
  productOptions,
  paymentMethodOptions,
  disabled,
  onChange,
  onReset,
}: ReportsFiltersProps) => {
  return (
    <section className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
      <header className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Filtros de búsqueda
        </h2>
        <button
          type="button"
          onClick={onReset}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/80 transition-all cursor-pointer"
        >
          <FilterX size={14} className="text-slate-400 dark:text-slate-500" />
          <span>Limpiar filtros</span>
        </button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
            Fecha desde
          </label>
          <input
            type="date"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:focus:border-blue-400"
            value={filters.dateFrom}
            onChange={(event) => onChange({ dateFrom: event.target.value })}
            disabled={disabled}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
            Fecha hasta
          </label>
          <input
            type="date"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:focus:border-blue-400"
            value={filters.dateTo}
            onChange={(event) => onChange({ dateTo: event.target.value })}
            disabled={disabled}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
            Cliente
          </label>
          <select
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:focus:border-blue-400"
            value={filters.customerId}
            onChange={(event) => onChange({ customerId: event.target.value })}
            disabled={disabled}
          >
            <option value="">Todos</option>
            {customerOptions.map((customer) => (
              <option key={customer.value} value={customer.value}>
                {customer.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
            Producto
          </label>
          <select
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:focus:border-blue-400"
            value={filters.productId}
            onChange={(event) => onChange({ productId: event.target.value })}
            disabled={disabled}
          >
            <option value="">Todos</option>
            {productOptions.map((product) => (
              <option key={product.value} value={product.value}>
                {product.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
            Medio de pago
          </label>
          <select
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:focus:border-blue-400"
            value={filters.paymentMethodCode}
            onChange={(event) => onChange({ paymentMethodCode: event.target.value })}
            disabled={disabled}
          >
            <option value="">Todos</option>
            {paymentMethodOptions.map((paymentMethod) => (
              <option key={paymentMethod.value} value={paymentMethod.value}>
                {paymentMethod.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
            Estado
          </label>
          <select
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:focus:border-blue-400"
            value={filters.status}
            onChange={(event) =>
              onChange({ status: event.target.value as ReportStatusFilter })
            }
            disabled={disabled}
          >
            {statusOptions.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
};