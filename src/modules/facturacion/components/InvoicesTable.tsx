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
  if (status === "issued" || status === "accepted") return "ui-badge ui-badge--success";
  if (status === "cancelled" || status === "rejected") return "ui-badge ui-badge--danger";
  if (status === "not_sent" || status === "pending") return "ui-badge ui-badge--warn";
  return "ui-badge ui-badge--info";
};

export const InvoicesTable = ({ invoices, onViewDetail }: InvoicesTableProps) => {
  const columns = [
    columnHelper.accessor("issue_date", {
      header: "Fecha",
      cell: (info) => new Date(info.getValue()).toLocaleString("es-AR"),
    }),
    columnHelper.accessor("document_type", {
      header: "Tipo",
      cell: (info) => <span className="font-kpi text-xs">{info.getValue()}</span>,
    }),
    columnHelper.accessor("document_number", {
      header: "Numero",
      cell: (info) => <span className="font-kpi text-xs">{info.getValue()}</span>,
    }),
    columnHelper.display({
      id: "customer",
      header: "Cliente fiscal",
      cell: (info) =>
        info.row.original.customer_snapshot?.business_name ??
        info.row.original.customer_snapshot?.full_name ??
        "Sin cliente",
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
      cell: (info) => <span className="font-kpi">{currency.format(info.getValue())}</span>,
    }),
    columnHelper.display({
      id: "actions",
      header: "Accion",
      cell: (info) => (
        <button
          type="button"
          className="ui-btn-ghost px-2 py-1 text-xs"
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
    return <div className="ui-empty-state">No hay documentos fiscales para los filtros seleccionados.</div>;
  }

  return (
    <div className="ui-table-wrap">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="px-3 py-2 text-left font-medium text-slate-700">
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
                <td key={cell.id} className="px-3 py-2 text-slate-700">
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
