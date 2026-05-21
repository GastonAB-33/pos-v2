import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { CashSession } from "@/types/entities";

interface CashSessionHistoryTableProps {
  sessions: CashSession[];
  usersById?: Record<string, string>;
}

const columnHelper = createColumnHelper<CashSession>();

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const CashSessionHistoryTable = ({ sessions, usersById = {} }: CashSessionHistoryTableProps) => {
  const columns = [
    columnHelper.accessor("opened_at", {
      header: "Apertura",
      cell: (info) => new Date(info.getValue()).toLocaleString("es-AR"),
    }),
    columnHelper.accessor("closed_at", {
      header: "Cierre",
      cell: (info) => (info.getValue() ? new Date(info.getValue()!).toLocaleString("es-AR") : "-"),
    }),
    columnHelper.accessor("status", {
      header: "Estado",
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor("opened_by_user_id", {
      header: "Abierta por",
      cell: (info) => usersById[info.getValue()] ?? info.getValue(),
    }),
    columnHelper.accessor("closed_by_user_id", {
      header: "Cerrada por",
      cell: (info) => (info.getValue() ? usersById[info.getValue()!] ?? info.getValue() : "-"),
    }),
    columnHelper.accessor("opening_amount", {
      header: "Inicial",
      cell: (info) => currency.format(info.getValue()),
    }),
    columnHelper.accessor("closing_amount", {
      header: "Real",
      cell: (info) => (info.getValue() != null ? currency.format(info.getValue()!) : "-"),
    }),
    columnHelper.accessor("closing_difference", {
      header: "Diferencia",
      cell: (info) => (info.getValue() != null ? currency.format(info.getValue()!) : "-"),
    }),
  ];

  const table = useReactTable({
    data: sessions,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!sessions.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
        No hay historial de sesiones.
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
