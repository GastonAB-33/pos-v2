import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { Product, StockMovement } from "@/types/entities";
import { movementTypeLabel } from "@/modules/stock/utils/stock-labels";

interface StockMovementRow {
  movement: StockMovement;
  product: Product | null;
}

interface StockMovementsTableProps {
  rows: StockMovementRow[];
}

const columnHelper = createColumnHelper<StockMovementRow>();

const referenceTypeLabelMap: Record<string, string> = {
  adjustment: "Ajuste manual",
  manual_adjustment: "Ajuste manual",
  sale: "Venta",
  purchase: "Compra",
  in: "Ingreso",
  out: "Salida",
};

const getReferenceTypeLabel = (value: string): string => referenceTypeLabelMap[value] ?? value;
const unitLabel = (product: Product | null): string => product?.sale_mode === "weight" ? "g" : "u.";

export const StockMovementsTable = ({ rows }: StockMovementsTableProps) => {
  const columns = [
    columnHelper.accessor((row) => row.movement.created_at, {
      id: "date",
      header: "Fecha",
      cell: (info) => (
        <span className="text-slate-600 dark:text-slate-400 whitespace-nowrap">
          {new Date(info.getValue()).toLocaleString("es-AR")}
        </span>
      ),
    }),
    columnHelper.accessor((row) => row.product?.name ?? "Producto eliminado", {
      id: "product",
      header: "Producto",
      cell: (info) => (
        <span className="font-semibold text-slate-900 dark:text-slate-100">
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor((row) => row.movement.movement_type, {
      id: "type",
      header: "Tipo",
      cell: (info) => (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {movementTypeLabel[info.getValue()] ?? info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor((row) => row.movement.quantity, {
      id: "quantity",
      header: "Cantidad",
      cell: (info) => {
        const isWeight = info.row.original.product?.sale_mode === "weight";
        const qty = isWeight ? info.getValue() * 1000 : info.getValue();
        return (
          <span className="font-bold text-slate-900 dark:text-slate-100">
            {qty.toLocaleString("es-AR")} {unitLabel(info.row.original.product)}
          </span>
        );
      },
    }),
    columnHelper.display({
      id: "reference",
      header: "Referencia",
      cell: (info) => {
        const movement = info.row.original.movement;
        return (
          <span className="text-xs text-slate-600 dark:text-slate-400">
            {getReferenceTypeLabel(movement.reference_type)}
          </span>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
        No hay movimientos de stock para mostrar.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <table className="min-w-full divide-y divide-slate-200/80 dark:divide-slate-800 text-sm">
        <thead className="bg-slate-50/90 dark:bg-slate-800/70">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs uppercase tracking-wider">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-2.5 text-slate-700 dark:text-slate-300">
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
