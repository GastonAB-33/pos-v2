import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { PriceList } from "@/types/entities";

interface PriceListsTableProps {
  priceLists: PriceList[];
  selectedPriceListId: string | null;
  canWrite: boolean;
  onSelect: (priceList: PriceList) => void;
  onEdit: (priceList: PriceList) => void;
  onDelete: (priceList: PriceList) => void;
  onToggleActive: (priceList: PriceList) => void;
}

const columnHelper = createColumnHelper<PriceList>();

export const PriceListsTable = ({
  priceLists,
  selectedPriceListId,
  canWrite,
  onSelect,
  onEdit,
  onDelete,
  onToggleActive,
}: PriceListsTableProps) => {
  const columns = [
    columnHelper.accessor("name", {
      header: "Nombre",
      cell: (info) => <span className="font-medium text-slate-900">{info.getValue()}</span>,
    }),
    columnHelper.accessor("code", {
      header: "Codigo",
      cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
    }),
    columnHelper.accessor("price_mode", {
      header: "Modo",
      cell: (info) =>
        info.getValue() === "percentage" ? (
          <span className="ui-badge ui-badge--info">Porcentaje</span>
        ) : (
          <span className="ui-badge ui-badge--warn">Precio fijo</span>
        ),
    }),
    columnHelper.accessor("percentage_adjustment", {
      header: "Ajuste %",
      cell: (info) => (info.getValue() ?? 0).toLocaleString("es-AR"),
    }),
    columnHelper.accessor("is_active", {
      header: "Estado",
      cell: (info) =>
        info.getValue() ? (
          <span className="ui-badge ui-badge--success">Activa</span>
        ) : (
          <span className="ui-badge ui-badge--danger">Inactiva</span>
        ),
    }),
    columnHelper.display({
      id: "actions",
      header: "Acciones",
      cell: (info) => {
        const row = info.row.original;
        const isSelected = selectedPriceListId === row.id;

        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={isSelected ? "ui-btn-primary px-2 py-1 text-xs" : "ui-btn-ghost px-2 py-1 text-xs"}
              onClick={() => onSelect(row)}
            >
              {isSelected ? "Seleccionada" : "Ver detalle"}
            </button>

            {canWrite ? (
              <>
                <button type="button" className="ui-btn-ghost px-2 py-1 text-xs" onClick={() => onEdit(row)}>
                  Editar
                </button>
                <button
                  type="button"
                  className="ui-btn-ghost px-2 py-1 text-xs"
                  onClick={() => onToggleActive(row)}
                >
                  {row.is_active ? "Desactivar" : "Activar"}
                </button>
                <button
                  type="button"
                  className="ui-btn-ghost border-red-300 px-2 py-1 text-xs text-red-700"
                  onClick={() => onDelete(row)}
                >
                  Eliminar
                </button>
              </>
            ) : null}
          </div>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: priceLists,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!priceLists.length) {
    return <div className="ui-empty-state">No hay listas de precios cargadas.</div>;
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
