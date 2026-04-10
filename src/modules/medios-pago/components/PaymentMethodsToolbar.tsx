interface PaymentMethodsToolbarProps {
  canWrite: boolean;
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onCreate: () => void;
  onReload: () => void;
}

export const PaymentMethodsToolbar = ({
  canWrite,
  loading,
  search,
  onSearchChange,
  onCreate,
  onReload,
}: PaymentMethodsToolbarProps) => {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="grid gap-1">
        <h2 className="text-lg font-semibold text-slate-900">Medios de pago</h2>
        <p className="text-sm text-slate-500">Configuracion por tenant para POS y caja</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar por nombre, codigo o tipo"
          className="ui-input w-72"
        />
        <button type="button" onClick={onReload} className="ui-btn-ghost" disabled={loading}>
          Recargar
        </button>
        <button
          type="button"
          onClick={onCreate}
          className="ui-btn-primary disabled:opacity-50"
          disabled={!canWrite || loading}
        >
          Nuevo medio
        </button>
      </div>
    </div>
  );
};
