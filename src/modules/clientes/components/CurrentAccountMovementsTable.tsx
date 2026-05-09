import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { CurrentAccountMovement } from "@/types/entities";
import type { CurrentAccountSaleDetail } from "@/modules/clientes/hooks/useCurrentAccount";

interface CurrentAccountMovementsTableProps {
  movements: CurrentAccountMovement[];
  saleDetailsById?: Record<string, CurrentAccountSaleDetail>;
}

const columnHelper = createColumnHelper<CurrentAccountMovement>();

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const movementTypeLabels: Record<CurrentAccountMovement["type"], string> = {
  debt: "Deuda",
  payment: "Pago",
  adjustment: "Ajuste",
};

const formatProductsSummary = (saleDetail: CurrentAccountSaleDetail): string => {
  if (!saleDetail.items.length) return "Sin detalle de productos";

  const topItems = saleDetail.items.slice(0, 2);
  const visible = topItems
    .map((item) => `${item.product_name} x${item.quantity.toLocaleString("es-AR")}`)
    .join(", ");
  const remaining = saleDetail.items.length - topItems.length;

  return remaining > 0 ? `${visible} (+${remaining} mas)` : visible;
};

export const CurrentAccountMovementsTable = ({
  movements,
  saleDetailsById = {},
}: CurrentAccountMovementsTableProps) => {
  const columns = [
    columnHelper.accessor("created_at", {
      header: "Fecha",
      cell: (info) => new Date(info.getValue()).toLocaleString("es-AR"),
    }),
    columnHelper.accessor("type", {
      header: "Tipo",
      cell: (info) => movementTypeLabels[info.getValue()] ?? info.getValue(),
    }),
    columnHelper.display({
      id: "voucher",
      header: "Comprobante",
      cell: (info) => {
        const movement = info.row.original;
        if (!movement.sale_id) return "-";

        const saleDetail = saleDetailsById[movement.sale_id];
        if (!saleDetail) return `Venta ${movement.sale_id.slice(0, 8)}`;

        return (
          <div className="space-y-0.5">
            <p className="font-medium text-slate-800">{saleDetail.sale_number}</p>
            <p className="text-xs text-slate-500">
              {saleDetail.receipt_number ? `Ticket ${saleDetail.receipt_number}` : "Sin ticket"}
            </p>
          </div>
        );
      },
    }),
    columnHelper.display({
      id: "products",
      header: "Productos",
      cell: (info) => {
        const movement = info.row.original;
        if (!movement.sale_id) return "-";

        const saleDetail = saleDetailsById[movement.sale_id];
        if (!saleDetail) return "Sin detalle";

        return (
          <p className="max-w-[320px] text-xs text-slate-600">
            {formatProductsSummary(saleDetail)}
          </p>
        );
      },
    }),
    columnHelper.accessor("amount", {
      header: "Monto",
      cell: (info) => currency.format(info.getValue()),
    }),
    columnHelper.accessor("balance_after", {
      header: "Saldo luego",
      cell: (info) => currency.format(info.getValue()),
    }),
    columnHelper.accessor("notes", {
      header: "Observacion",
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
      <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
        Este cliente todavia no tiene movimientos.
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
                <td key={cell.id} className="px-4 py-2 align-top text-slate-700">
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
