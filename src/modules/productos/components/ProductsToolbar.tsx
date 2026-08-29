import { useState } from "react";
import { Camera, Download, FileSpreadsheet, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { BarcodeScannerModal } from "@/components/form/BarcodeScannerModal";
import { IconButton } from "@/components/ui/IconButton";

export interface ProductFilters {
  search: string;
  category: string;
  subcategory: string;
  status: "all" | "active" | "inactive";
}

interface ProductsToolbarProps {
  canWrite: boolean;
  loading: boolean;
  hasRows: boolean;
  selectedCount: number;
  filters: ProductFilters;
  categories: string[];
  subcategories: string[];
  exportPriceListId: string;
  exportPriceListOptions: Array<{ id: string; label: string }>;
  onFiltersChange: (patch: Partial<ProductFilters>) => void;
  onReload: () => void;
  onOpenCreateFlow: () => void;
  onOpenImport: () => void;
  onDownloadTemplate: () => void;
  onExportXlsx: () => void;
  onExportCsv: () => void;
  onExportPriceListChange: (value: string) => void;
  onDeleteSelected: () => void;
}

export const ProductsToolbar = ({
  canWrite,
  loading,
  hasRows,
  selectedCount,
  filters,
  categories,
  subcategories,
  exportPriceListId,
  exportPriceListOptions,
  onFiltersChange,
  onReload,
  onOpenCreateFlow,
  onOpenImport,
  onDownloadTemplate,
  onExportXlsx,
  onExportCsv,
  onExportPriceListChange,
  onDeleteSelected,
}: ProductsToolbarProps) => {
  const [scannerOpen, setScannerOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Catalogo de productos</h2>
          <p className="text-sm text-slate-500">Gestion avanzada de productos y carga masiva</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <IconButton
            icon={RefreshCw}
            label="Recargar productos"
            onClick={onReload}
            loading={loading}
          />

          <button
            type="button"
            onClick={onDownloadTemplate}
            className="ui-btn-ghost"
            disabled={loading || !canWrite}
          >
            <FileSpreadsheet aria-hidden="true" className="h-4 w-4" />
            Plantilla XLSX
          </button>

          <button
            type="button"
            onClick={onOpenImport}
            className="ui-btn-ghost"
            disabled={loading || !canWrite}
          >
            <Upload aria-hidden="true" className="h-4 w-4" />
            Importar XLSX
          </button>

          <select
            className="ui-input w-[210px]"
            value={exportPriceListId}
            onChange={(event) => onExportPriceListChange(event.target.value)}
            disabled={loading || !hasRows}
          >
            {exportPriceListOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onExportXlsx}
            className="ui-btn-ghost"
            disabled={loading || !hasRows}
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            Exportar XLSX
          </button>

          <button
            type="button"
            onClick={onExportCsv}
            className="ui-btn-ghost"
            disabled={loading || !hasRows}
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            Exportar CSV
          </button>

          {selectedCount > 0 ? (
            <button
              type="button"
              onClick={onDeleteSelected}
              className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700"
              disabled={loading || !canWrite}
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              Eliminar seleccionados ({selectedCount})
            </button>
          ) : null}

          <button
            type="button"
            onClick={onOpenCreateFlow}
            className="ui-btn-primary"
            disabled={!canWrite || loading}
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            Nuevo producto
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2 flex items-center gap-2">
          <input
            value={filters.search}
            onChange={(event) => onFiltersChange({ search: event.target.value })}
            placeholder="Buscar por nombre, codigos o barcode"
            className="ui-input flex-1"
          />
          <IconButton
            icon={Camera}
            label="Escanear código de barras con cámara"
            onClick={() => setScannerOpen(true)}
            disabled={loading}
          />
        </div>

        <select
          value={filters.category}
          onChange={(event) => onFiltersChange({ category: event.target.value })}
          className="ui-input"
        >
          <option value="">Todas las categorias</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <select
          value={filters.subcategory}
          onChange={(event) => onFiltersChange({ subcategory: event.target.value })}
          className="ui-input"
        >
          <option value="">Todas las subcategorias</option>
          {subcategories.map((subcategory) => (
            <option key={subcategory} value={subcategory}>
              {subcategory}
            </option>
          ))}
        </select>

        <select
          value={filters.status}
          onChange={(event) =>
            onFiltersChange({ status: event.target.value as ProductFilters["status"] })
          }
          className="ui-input"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
      </div>

      <BarcodeScannerModal
        open={scannerOpen}
        title="Buscar por código de barras"
        description="Apuntá la cámara al código de barras para buscar el producto automáticamente."
        onClose={() => setScannerOpen(false)}
        onDetected={(barcode) => {
          onFiltersChange({ search: barcode });
          setScannerOpen(false);
        }}
      />
    </div>
  );
};
