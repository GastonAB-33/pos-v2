interface PriceListsToolbarProps {
  canWrite: boolean;
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onCreate: () => void;
  onReload: () => void;
}

export const PriceListsToolbar = ({
  canWrite,
  loading,
  search,
  onSearchChange,
  onCreate,
  onReload,
}: PriceListsToolbarProps) => {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="grid gap-1">
        <h2 className="text-lg font-semibold text-slate-900">Listas de precios</h2>
        <p className="text-sm text-slate-500">Configuracion de precios por tenant</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar por nombre o codigo"
          className="ui-input w-72"
        />
        <button type="button" className="ui-btn-ghost" onClick={onReload} disabled={loading}>
          Recargar
        </button>
        <button
          type="button"
          className="ui-btn-primary disabled:opacity-50"
          onClick={onCreate}
          disabled={!canWrite || loading}
        >
          Nueva lista
        </button>
      </div>
    </div>
  );
};
