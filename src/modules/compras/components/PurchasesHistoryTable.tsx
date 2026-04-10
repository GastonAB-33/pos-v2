import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { Purchase, Supplier } from "@/types/entities";

interface PurchaseHistoryRow {
  purchase: Purchase;
  supplier: Supplier | null;
}

interface PurchasesHistoryTableProps {
  rows: PurchaseHistoryRow[];
}

const columnHelper = createColumnHelper<PurchaseHistoryRow>();

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const PurchasesHistoryTable = ({ rows }: PurchasesHistoryTableProps) => {
  const columns = [
    columnHelper.accessor((row) => row.purchase.created_at, {
      id: "date",
      header: "Fecha",
      cell: (info) => new Date(info.getValue()).toLocaleString("es-AR"),
    }),
    columnHelper.accessor((row) => row.purchase.purchase_number, {
      id: "number",
      header: "Compra",
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor((row) => row.supplier?.name ?? "Proveedor eliminado", {
      id: "supplier",
      header: "Proveedor",
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor((row) => row.purchase.items?.length ?? 0, {
      id: "itemsCount",
      header: "Items",
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor((row) => row.purchase.status, {
      id: "status",
      header: "Estado",
      cell: (info) => {
        const status = info.getValue();

        if (status === "confirmed") {
          return <span className="ui-badge ui-badge--success">Confirmada</span>;
        }

        if (status === "cancelled") {
          return <span className="ui-badge ui-badge--danger">Cancelada</span>;
        }

        return <span className="ui-badge ui-badge--warn">{status}</span>;
      },
    }),
    columnHelper.accessor((row) => row.purchase.total, {
      id: "total",
      header: "Total",
      cell: (info) => currency.format(info.getValue()),
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
        No hay compras registradas.
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
