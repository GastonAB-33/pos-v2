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
    <section className="ui-card space-y-3">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-500">
          Filtros
        </h2>
        <button type="button" className="ui-btn-ghost" onClick={onReset} disabled={disabled}>
          Limpiar filtros
        </button>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-1 text-xs text-slate-500">
          Fecha desde
          <input
            type="date"
            className="ui-input"
            value={filters.dateFrom}
            onChange={(event) => onChange({ dateFrom: event.target.value })}
            disabled={disabled}
          />
        </label>

        <label className="space-y-1 text-xs text-slate-500">
          Fecha hasta
          <input
            type="date"
            className="ui-input"
            value={filters.dateTo}
            onChange={(event) => onChange({ dateTo: event.target.value })}
            disabled={disabled}
          />
        </label>

        <label className="space-y-1 text-xs text-slate-500">
          Cliente
          <select
            className="ui-input"
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
        </label>

        <label className="space-y-1 text-xs text-slate-500">
          Producto
          <select
            className="ui-input"
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
        </label>

        <label className="space-y-1 text-xs text-slate-500">
          Medio de pago
          <select
            className="ui-input"
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
        </label>

        <label className="space-y-1 text-xs text-slate-500">
          Estado
          <select
            className="ui-input"
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
        </label>
      </div>
    </section>
  );
};
