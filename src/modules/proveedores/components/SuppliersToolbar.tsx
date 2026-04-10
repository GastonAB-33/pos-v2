interface SuppliersToolbarProps {
  canWrite: boolean;
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onCreate: () => void;
  onReload: () => void;
}

export const SuppliersToolbar = ({
  canWrite,
  loading,
  search,
  onSearchChange,
  onCreate,
  onReload,
}: SuppliersToolbarProps) => {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="grid gap-1">
        <h2 className="text-lg font-semibold text-slate-900">Proveedores</h2>
        <p className="text-sm text-slate-500">CRUD base de proveedores</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar por nombre, telefono o email"
          className="w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={onReload}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          disabled={loading}
        >
          Recargar
        </button>
        <button
          type="button"
          onClick={onCreate}
          className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={!canWrite || loading}
        >
          Nuevo proveedor
        </button>
      </div>
    </div>
  );
};

