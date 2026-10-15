import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { Receipt } from "@/types/entities";

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
      cell: (info) => <span className="font-mono text-sm text-slate-900 dark:text-slate-100 font-semibold">{info.getValue()}</span>,
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
            className="ui-btn-ghost px-2 py-1 text-xs"
            onClick={() => onView(info.row.original)}
          >
            Ver detalle
          </button>

          {canGenerateInvoice && onGenerateInvoice ? (
            <button
              type="button"
              className="ui-btn-ghost px-2 py-1 text-xs"
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
    return <div className="ui-empty-state">No hay comprobantes generados.</div>;
  }

  return (
    <div className="ui-table-wrap">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800/80">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="px-4 py-2 text-left font-medium text-slate-700 dark:text-slate-200">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-2 text-slate-700 dark:text-slate-200">
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
