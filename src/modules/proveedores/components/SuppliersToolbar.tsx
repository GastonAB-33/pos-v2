import { Plus, RefreshCw } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";

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
    <div className="workspace-toolbar workspace-toolbar--inline">
      <div className="grid gap-1">
        <p className="ui-section-label">Abastecimiento</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">Proveedores</h2>
      </div>

      <div className="workspace-toolbar__actions">
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar por nombre, teléfono o email"
          className="ui-input w-full md:w-72"
        />
        <IconButton icon={RefreshCw} label="Recargar proveedores" onClick={onReload} loading={loading} />
        <button
          type="button"
          onClick={onCreate}
          className="ui-btn-primary"
          disabled={!canWrite || loading}
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          Nuevo proveedor
        </button>
      </div>
    </div>
  );
};
