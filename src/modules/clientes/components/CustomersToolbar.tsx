interface CustomersToolbarProps {
  canWrite: boolean;
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onCreate: () => void;
  onReload: () => void;
}

export const CustomersToolbar = ({
  canWrite,
  loading,
  search,
  onSearchChange,
  onCreate,
  onReload,
}: CustomersToolbarProps) => {
  return (
    <div className="workspace-toolbar workspace-toolbar--inline">
      <div>
        <p className="ui-section-label">Agenda comercial</p>
        <p className="mt-1 text-sm text-slate-500">Busca por nombre, documento, telefono o email.</p>
      </div>

      <div className="workspace-toolbar__actions">
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar por nombre, doc, telefono o email"
          className="ui-input w-72"
        />
        <button
          type="button"
          onClick={onReload}
          className="ui-btn-ghost"
          disabled={loading}
        >
          Recargar
        </button>
        <button
          type="button"
          onClick={onCreate}
          className="ui-btn-primary"
          disabled={!canWrite || loading}
        >
          Nuevo cliente
        </button>
      </div>
    </div>
  );
};
