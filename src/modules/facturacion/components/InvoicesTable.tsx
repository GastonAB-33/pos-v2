import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { Invoice } from "@/types/entities";

interface InvoicesTableProps {
  invoices: Invoice[];
  onViewDetail: (invoice: Invoice) => void;
}

const columnHelper = createColumnHelper<Invoice>();

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const statusBadgeClass = (status: string): string => {
  if (status === "issued" || status === "accepted")
    return "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border dark:border-emerald-800";
  if (status === "cancelled" || status === "rejected")
    return "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 dark:border dark:border-rose-800";
  if (status === "not_sent" || status === "pending")
    return "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 dark:border dark:border-amber-800";
  return "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 dark:border dark:border-blue-800";
};

export const InvoicesTable = ({ invoices, onViewDetail }: InvoicesTableProps) => {
  const columns = [
    columnHelper.accessor("issue_date", {
      header: "Fecha",
      cell: (info) => (
        <span className="text-slate-700 dark:text-slate-300">
          {new Date(info.getValue()).toLocaleString("es-AR")}
        </span>
      ),
    }),
    columnHelper.accessor("document_type", {
      header: "Tipo",
      cell: (info) => <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">{info.getValue()}</span>,
    }),
    columnHelper.accessor("document_number", {
      header: "Numero",
      cell: (info) => <span className="font-mono text-xs text-slate-800 dark:text-slate-200">{info.getValue()}</span>,
    }),
    columnHelper.display({
      id: "customer",
      header: "Cliente fiscal",
      cell: (info) => (
        <span className="font-medium text-slate-900 dark:text-slate-100">
          {info.row.original.customer_snapshot?.business_name ??
            info.row.original.customer_snapshot?.full_name ??
            "Sin cliente"}
        </span>
      ),
    }),
    columnHelper.accessor("status", {
      header: "Estado",
      cell: (info) => <span className={statusBadgeClass(info.getValue())}>{info.getValue()}</span>,
    }),
    columnHelper.accessor("arca_status", {
      header: "ARCA",
      cell: (info) => <span className={statusBadgeClass(info.getValue())}>{info.getValue()}</span>,
    }),
    columnHelper.accessor("total", {
      header: "Total",
      cell: (info) => <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{currency.format(info.getValue())}</span>,
    }),
    columnHelper.display({
      id: "actions",
      header: "Accion",
      cell: (info) => (
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          onClick={() => onViewDetail(info.row.original)}
        >
          Ver detalle
        </button>
      ),
    }),
  ];

  const table = useReactTable({
    data: invoices,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!invoices.length) {
    return (
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-12 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        No hay documentos fiscales para los filtros seleccionados.
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
