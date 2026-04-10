import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { Product } from "@/types/entities";

interface ProductsTableProps {
  products: Product[];
  primaryBarcodes: Record<string, string>;
  selectedIds: string[];
  canWrite: boolean;
  onToggleSelect: (productId: string, selected: boolean) => void;
  onToggleSelectAll: (selected: boolean) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onToggleActive: (product: Product) => void;
  onToggleFavorite: (product: Product) => void;
}

const columnHelper = createColumnHelper<Product>();

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const ProductsTable = ({
  products,
  primaryBarcodes,
  selectedIds,
  canWrite,
  onToggleSelect,
  onToggleSelectAll,
  onEdit,
  onDelete,
  onToggleActive,
  onToggleFavorite,
}: ProductsTableProps) => {
  const selectedIdSet = new Set(selectedIds);
  const selectableCount = products.length;
  const allSelected = selectableCount > 0 && selectedIds.length === selectableCount;

  const columns = [
    columnHelper.display({
      id: "select",
      header: () =>
        canWrite ? (
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(event) => onToggleSelectAll(event.target.checked)}
            aria-label="Seleccionar todos"
          />
        ) : null,
      cell: (info) =>
        canWrite ? (
          <input
            type="checkbox"
            checked={selectedIdSet.has(info.row.original.id)}
            onChange={(event) => onToggleSelect(info.row.original.id, event.target.checked)}
            aria-label={`Seleccionar ${info.row.original.name}`}
          />
        ) : null,
    }),
    columnHelper.accessor("name", {
      header: "Nombre",
      cell: (info) => <span className="font-medium text-slate-900">{info.getValue()}</span>,
    }),
    columnHelper.accessor("price", {
      header: "Precio",
      cell: (info) => currency.format(info.getValue()),
    }),
    columnHelper.accessor("stock_current", {
      header: "Stock",
      cell: (info) => info.getValue().toLocaleString("es-AR"),
    }),
    columnHelper.accessor("category", {
      header: "Categoria",
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor("subcategory", {
      header: "Subcategoria",
      cell: (info) => info.getValue() ?? "-",
    }),
    columnHelper.accessor("supplier", {
      header: "Proveedor",
      cell: (info) => info.getValue() ?? "-",
    }),
    columnHelper.accessor("brand", {
      header: "Marca",
      cell: (info) => info.getValue() ?? "-",
    }),
    columnHelper.display({
      id: "barcode",
      header: "Barcode",
      cell: (info) => primaryBarcodes[info.row.original.id] ?? "-",
    }),
    columnHelper.accessor("is_active", {
      header: "Estado",
      cell: (info) =>
        info.getValue() ? (
          <span className="ui-badge ui-badge--success">Activo</span>
        ) : (
          <span className="ui-badge">Inactivo</span>
        ),
    }),
    columnHelper.accessor("is_favorite", {
      header: "Favorito",
      cell: (info) =>
        info.getValue() ? (
          <span className="ui-badge ui-badge--warn">Favorito</span>
        ) : (
          <span className="text-xs text-slate-500">No</span>
        ),
    }),
    columnHelper.display({
      id: "actions",
      header: "Acciones",
      cell: (info) => {
        const row = info.row.original;

        if (!canWrite) {
          return <span className="text-xs text-slate-400">Sin permisos de escritura</span>;
        }

        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onEdit(row)}
              className="ui-btn-ghost text-xs"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => onToggleActive(row)}
              className="ui-btn-ghost text-xs"
            >
              {row.is_active ? "Desactivar" : "Activar"}
            </button>
            <button
              type="button"
              onClick={() => onToggleFavorite(row)}
              className="ui-btn-ghost text-xs"
            >
              {row.is_favorite ? "Quitar favorito" : "Favorito"}
            </button>
            <button
              type="button"
              onClick={() => onDelete(row)}
              className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700"
            >
              Eliminar
            </button>
          </div>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: products,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!products.length) {
    return <div className="ui-empty-state">No hay productos para los filtros seleccionados.</div>;
  }

  return (
    <div className="ui-table-wrap">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="px-4 py-3 text-left font-medium text-slate-700">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3 text-slate-700">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
