import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { CashMovement } from "@/types/entities";

interface CashMovementsTableProps {
  movements: CashMovement[];
}

const columnHelper = createColumnHelper<CashMovement>();

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const CashMovementsTable = ({ movements }: CashMovementsTableProps) => {
  const columns = [
    columnHelper.accessor("created_at", {
      header: "Fecha",
      cell: (info) => new Date(info.getValue()).toLocaleString("es-AR"),
    }),
    columnHelper.accessor("movement_type", {
      header: "Tipo",
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor("amount", {
      header: "Monto",
      cell: (info) => currency.format(info.getValue()),
    }),
    columnHelper.display({
      id: "reference",
      header: "Referencia",
      cell: (info) => {
        const movement = info.row.original;
        return movement.reference_id
          ? `${movement.reference_type} (${movement.reference_id})`
          : movement.reference_type;
      },
    }),
    columnHelper.accessor("created_by", {
      header: "Usuario",
      cell: (info) => info.getValue() ?? "-",
    }),
  ];

  const table = useReactTable({
    data: movements,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!movements.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
        No hay movimientos para esta sesion.
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

