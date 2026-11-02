import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
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
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
        pageIndex: 0,
      },
    },
  });

  if (!sessions.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
        No hay historial de sesiones.
      </div>
    );
  }

  return (
    <div className="space-y-3">
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

    {/* Barra de Paginación */}
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 pt-3 text-xs text-slate-600">
      <div>
        Mostrando{" "}
        <strong className="text-slate-900">
          {sessions.length === 0 ? 0 : table.getState().pagination.pageIndex * 10 + 1}
        </strong>{" "}
        a{" "}
        <strong className="text-slate-900">
          {Math.min((table.getState().pagination.pageIndex + 1) * 10, sessions.length)}
        </strong>{" "}
        de <strong className="text-slate-900">{sessions.length}</strong> sesiones
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Anterior
        </button>
        <span className="px-2 font-medium">
          Página {table.getPageCount() === 0 ? 1 : table.getState().pagination.pageIndex + 1} de {Math.max(1, table.getPageCount())}
        </span>
        <button
          type="button"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
        >
          Siguiente <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  </div>
);
};
