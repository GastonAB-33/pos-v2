import { Plus, RefreshCw } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";

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
    <div className="workspace-toolbar workspace-toolbar--inline">
      <div className="grid gap-1">
        <p className="ui-section-label">Ventas</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">Promociones</h2>
        <p className="text-sm text-slate-500">Reglas automáticas aplicables en POS</p>
      </div>

      <div className="workspace-toolbar__actions">
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar por nombre, codigo o tipo"
          className="ui-input w-72"
        />
        <IconButton icon={RefreshCw} label="Recargar promociones" onClick={onReload} loading={loading} />
        <button
          type="button"
          onClick={onCreate}
          className="ui-btn-primary disabled:opacity-50"
          disabled={!canWrite || loading}
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          Nueva promoción
        </button>
      </div>
    </div>
  );
};

