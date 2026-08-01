import { Plus, RefreshCw } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";

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
    <div className="workspace-toolbar workspace-toolbar--inline">
      <div className="grid gap-1">
        <p className="ui-section-label">Precios</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">Listas de precios</h2>
      </div>

      <div className="workspace-toolbar__actions">
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar por nombre o codigo"
          className="ui-input w-72"
        />
        <IconButton icon={RefreshCw} label="Recargar listas de precios" onClick={onReload} loading={loading} />
        <button
          type="button"
          className="ui-btn-primary disabled:opacity-50"
          onClick={onCreate}
          disabled={!canWrite || loading}
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          Nueva lista
        </button>
      </div>
    </div>
  );
};
