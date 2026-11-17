import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { Receipt } from "@/types/entities";
import { formatDisplayReceiptNumber } from "@/utils/voucher-format.utils";

interface ReceiptsTableProps {
  receipts: Receipt[];
  onView: (receipt: Receipt) => void;
  canGenerateInvoice?: boolean;
  generating?: boolean;
  onGenerateInvoice?: (receipt: Receipt) => void;
}

const columnHelper = createColumnHelper<Receipt>();

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const ReceiptsTable = ({
  receipts,
  onView,
  canGenerateInvoice,
  generating,
  onGenerateInvoice,
}: ReceiptsTableProps) => {
  const columns = [
    columnHelper.accessor("receipt_number", {
      header: "Numero",
      cell: (info) => (
        <span className="font-mono text-sm text-slate-900 dark:text-slate-100 font-semibold">
          {formatDisplayReceiptNumber(info.getValue())}
        </span>
      ),
    }),
    columnHelper.accessor("issued_at", {
      header: "Fecha",
      cell: (info) => (
        <span className="text-slate-700 dark:text-slate-300">
          {new Date(info.getValue()).toLocaleString("es-AR")}
        </span>
      ),
    }),
    columnHelper.accessor("customer_name", {
      header: "Cliente",
      cell: (info) => (
        <span className="font-medium text-slate-900 dark:text-slate-100">
          {info.getValue() ?? "Consumidor final"}
        </span>
      ),
    }),
    columnHelper.accessor("total", {
      header: "Total",
      cell: (info) => <span className="font-kpi font-bold text-slate-900 dark:text-slate-100">{currency.format(info.getValue())}</span>,
    }),
    columnHelper.display({
      id: "actions",
      header: "Accion",
      cell: (info) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            onClick={() => onView(info.row.original)}
          >
            Ver detalle
          </button>

          {canGenerateInvoice && onGenerateInvoice ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-full transition shadow-xs disabled:opacity-50"
              onClick={() => onGenerateInvoice(info.row.original)}
              disabled={generating}
            >
              Facturar
            </button>
          ) : null}
        </div>
      ),
    }),
  ];

  const table = useReactTable({
    data: receipts,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!receipts.length) {
    return (
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-12 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        No hay comprobantes generados.
      </div>
    );
  }

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800 text-sm">
          <thead className="bg-slate-50/90 dark:bg-slate-800/70 border-b border-slate-200/90 dark:border-slate-800">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/80 transition-colors dark:hover:bg-slate-800/50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
