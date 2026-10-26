import { Plus, RefreshCw } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";

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
    <div className="workspace-toolbar space-y-3">
      <div className="flex flex-col gap-1">
        <p className="ui-section-label">Agenda comercial</p>
        <p className="text-xs text-slate-500">Busca por nombre, documento, teléfono o email.</p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar por nombre, doc, teléfono o email..."
            className="ui-input w-full"
          />
        </div>
        <IconButton icon={RefreshCw} label="Recargar clientes" onClick={onReload} loading={loading} />
        <button
          type="button"
          onClick={onCreate}
          className="ui-btn-primary shrink-0 gap-1.5 px-3 py-2 text-xs font-semibold"
          disabled={!canWrite || loading}
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          <span className="hidden sm:inline">Nuevo cliente</span>
          <span className="sm:hidden">Nuevo</span>
        </button>
      </div>
    </div>
  );
};
