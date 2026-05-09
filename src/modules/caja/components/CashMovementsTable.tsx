import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo } from "react";
import type { CashMovement } from "@/types/entities";

interface CashMovementsTableProps {
  movements: CashMovement[];
  usersById?: Record<string, string>;
  saleNumbersById?: Record<string, string>;
  onViewSaleDocument?: (saleId: string) => void;
}

const columnHelper = createColumnHelper<CashMovement>();

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const movementTypeLabel: Record<CashMovement["movement_type"], string> = {
  income: "Ingreso",
  expense: "Egreso",
  sale_payment: "Cobro venta",
  adjustment: "Ajuste",
};

const referenceTypeLabels: Record<string, string> = {
  cash: "Efectivo",
  card_debit: "Tarjeta de debito",
  card_credit: "Tarjeta de credito",
  transfer: "Transferencia bancaria",
  mercado_pago: "Mercado Pago",
  cheque: "Cheque",
  current_account: "Cuenta corriente",
  manual_income: "Ingreso manual",
  manual_expense: "Egreso manual",
  current_account_payment: "Pago cuenta corriente",
  current_account_adjustment: "Ajuste cuenta corriente",
  purchase: "Pago a proveedores",
  purchase_payment: "Pago a proveedores",
  supplier_payment: "Pago a proveedores",
};

const formatReference = (
  movement: CashMovement,
  saleNumbersById: Record<string, string>
): string => {
  const referenceType = movement.reference_type.trim().toLowerCase();
  const label = referenceTypeLabels[referenceType] ?? movement.reference_type;

  if (!movement.reference_id) {
    return label;
  }

  if (movement.movement_type === "sale_payment") {
    const saleNumber = saleNumbersById[movement.reference_id];
    if (saleNumber) {
      return `${label} | ${saleNumber}`;
    }
  }

  const shortId = movement.reference_id.length > 12
    ? `${movement.reference_id.slice(0, 8)}...`
    : movement.reference_id;
  return `${label} | ${shortId}`;
};

export const CashMovementsTable = ({
  movements,
  usersById = {},
  saleNumbersById = {},
  onViewSaleDocument,
}: CashMovementsTableProps) => {
  const columns = useMemo(
    () => [
    columnHelper.accessor("created_at", {
      header: "Fecha",
      cell: (info) => new Date(info.getValue()).toLocaleString("es-AR"),
    }),
    columnHelper.accessor("movement_type", {
      header: "Tipo",
      cell: (info) => movementTypeLabel[info.getValue()] ?? info.getValue(),
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
        return formatReference(movement, saleNumbersById);
      },
    }),
    columnHelper.accessor("created_by", {
      header: "Responsable",
      cell: (info) => {
        const userId = info.getValue();
        if (!userId) return "Sin usuario";
        return usersById[userId] ?? userId;
      },
    }),
    columnHelper.display({
      id: "actions",
      header: "Comprobante",
      cell: (info) => {
        const movement = info.row.original;
        if (movement.movement_type !== "sale_payment" || !movement.reference_id) {
          return <span className="text-xs text-slate-400">-</span>;
        }
        return (
          <button
            type="button"
            className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
            onClick={() => onViewSaleDocument?.(movement.reference_id!)}
          >
            Ver
          </button>
        );
      },
    }),
  ],
    [onViewSaleDocument, saleNumbersById, usersById]
  );

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
