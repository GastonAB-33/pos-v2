import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { Product, StockMovement } from "@/types/entities";

interface StockMovementRow {
  movement: StockMovement;
  product: Product | null;
}

interface StockMovementsTableProps {
  rows: StockMovementRow[];
}

const columnHelper = createColumnHelper<StockMovementRow>();

export const StockMovementsTable = ({ rows }: StockMovementsTableProps) => {
  const columns = [
    columnHelper.accessor((row) => row.movement.created_at, {
      id: "date",
      header: "Fecha",
      cell: (info) => new Date(info.getValue()).toLocaleString("es-AR"),
    }),
    columnHelper.accessor((row) => row.product?.name ?? "Producto eliminado", {
      id: "product",
      header: "Producto",
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor((row) => row.movement.movement_type, {
      id: "type",
      header: "Tipo",
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor((row) => row.movement.quantity, {
      id: "quantity",
      header: "Cantidad",
      cell: (info) => info.getValue().toLocaleString("es-AR"),
    }),
    columnHelper.display({
      id: "reference",
      header: "Referencia",
      cell: (info) => {
        const movement = info.row.original.movement;
        return movement.reference_id
          ? `${movement.reference_type} (${movement.reference_id})`
          : movement.reference_type;
      },
    }),
    columnHelper.accessor((row) => row.movement.created_by ?? "-", {
      id: "user",
      header: "Usuario",
      cell: (info) => info.getValue(),
    }),
  ];

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
        No hay movimientos de stock para mostrar.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="px-4 py-2 text-left font-medium text-slate-700">
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
                <td key={cell.id} className="px-4 py-2 text-slate-700">
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

