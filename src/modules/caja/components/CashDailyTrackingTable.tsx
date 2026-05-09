import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { CashDailyTrackingRow } from "@/modules/caja/hooks/useCashModule";

interface CashDailyTrackingTableProps {
  rows: CashDailyTrackingRow[];
  onViewDetail?: (date: string) => void;
}

const columnHelper = createColumnHelper<CashDailyTrackingRow>();

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const CashDailyTrackingTable = ({ rows, onViewDetail }: CashDailyTrackingTableProps) => {
  const columns = [
    columnHelper.accessor("date", {
      header: "Fecha",
      cell: (info) => new Date(`${info.getValue()}T00:00:00`).toLocaleDateString("es-AR"),
    }),
    columnHelper.accessor("sessionsCount", {
      header: "Cajas",
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor("openSessionsCount", {
      header: "Abiertas",
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor("openingAmount", {
      header: "Apertura",
      cell: (info) => currency.format(info.getValue()),
    }),
    columnHelper.accessor("incomes", {
      header: "Ingresos",
      cell: (info) => currency.format(info.getValue()),
    }),
    columnHelper.accessor("expenses", {
      header: "Egresos",
      cell: (info) => currency.format(info.getValue()),
    }),
    columnHelper.accessor("realClosingAmount", {
      header: "Cierre real",
      cell: (info) => currency.format(info.getValue()),
    }),
    columnHelper.accessor("differenceAmount", {
      header: "Diferencia",
      cell: (info) => currency.format(info.getValue()),
    }),
    columnHelper.display({
      id: "movements",
      header: "Movimientos",
      cell: (info) => {
        const row = info.row.original;
        return `Venta: ${row.saleMovementsCount} | Manuales: ${row.manualMovementsCount}`;
      },
    }),
    columnHelper.display({
      id: "detail",
      header: "Detalle",
      cell: (info) => {
        const row = info.row.original;
        if (!onViewDetail) return "-";
        return (
          <button
            type="button"
            className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
            onClick={() => onViewDetail(row.date)}
          >
            Ver detalle
          </button>
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
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
        No hay datos diarios de cajas.
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
