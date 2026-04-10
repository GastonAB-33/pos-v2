interface PromotionsToolbarProps {
  canWrite: boolean;
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onCreate: () => void;
  onReload: () => void;
}

export const PromotionsToolbar = ({
  canWrite,
  loading,
  search,
  onSearchChange,
  onCreate,
  onReload,
}: PromotionsToolbarProps) => {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="grid gap-1">
        <h2 className="text-lg font-semibold text-slate-900">Promociones</h2>
        <p className="text-sm text-slate-500">Reglas automáticas aplicables en POS</p>
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
          Nueva promo
        </button>
      </div>
    </div>
  );
};

