import { ArrowLeft, Plus, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { routePaths } from "@/config/routes";
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
      <div className="flex items-center gap-3">
        <Link
          to={routePaths.productos}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-xs transition"
          title="Volver a Productos"
        >
          <ArrowLeft size={14} />
          <span>Volver a Productos</span>
        </Link>
        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />
        <div className="grid gap-0.5">
          <p className="ui-section-label">Inventario</p>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Listas de precios</h2>
        </div>
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
