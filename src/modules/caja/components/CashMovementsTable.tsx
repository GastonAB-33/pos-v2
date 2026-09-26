import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Receipt as ReceiptIcon,
  Sliders,
  FileText,
  User,
} from "lucide-react";
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

const referenceTypeLabels: Record<string, string> = {
  cash: "Efectivo",
  card_debit: "Tarjeta de débito",
  card_credit: "Tarjeta de crédito",
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
      return `${label} · #${saleNumber}`;
    }
  }

  const shortId =
    movement.reference_id.length > 12
      ? `${movement.reference_id.slice(0, 8)}...`
      : movement.reference_id;
  return `${label} · ${shortId}`;
};

const getSignedAmount = (movement: CashMovement): number => {
  const amount = Math.abs(movement.amount);
  if (movement.movement_type === "expense") return -amount;
  if (movement.movement_type === "adjustment" && movement.amount < 0) return -amount;
  return amount;
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
        header: "Fecha / Hora",
        cell: (info) => (
          <span className="whitespace-nowrap text-slate-500 dark:text-slate-300 font-medium">
            {new Date(info.getValue()).toLocaleString("es-AR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        ),
      }),
      columnHelper.accessor("movement_type", {
        header: "Tipo",
        cell: (info) => {
          const type = info.getValue();
          if (type === "expense") {
            return (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200/60 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60 whitespace-nowrap">
                <ArrowUpRight className="h-3 w-3" /> Egreso
              </span>
            );
          }
          if (type === "income") {
            return (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60 whitespace-nowrap">
                <ArrowDownLeft className="h-3 w-3" /> Ingreso
              </span>
            );
          }
          if (type === "sale_payment") {
            return (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200/60 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/60 whitespace-nowrap">
                <ReceiptIcon className="h-3 w-3" /> Cobro venta
              </span>
            );
          }
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60 whitespace-nowrap">
              <Sliders className="h-3 w-3" /> Ajuste
            </span>
          );
        },
      }),
      columnHelper.display({
        id: "reference",
        header: "Origen / Medio",
        cell: (info) => {
          const movement = info.row.original;
          return (
            <div className="font-medium text-slate-800 dark:text-slate-100">
              {formatReference(movement, saleNumbersById)}
              {movement.notes && (
                <p className="text-[10px] text-slate-400 dark:text-slate-300 font-normal mt-0.5">{movement.notes}</p>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor("created_by", {
        header: "Usuario",
        cell: (info) => {
          const userId = info.getValue();
          if (!userId) return <span className="text-slate-400 dark:text-slate-400">Sistema</span>;
          const name = usersById[userId] ?? userId;
          return (
            <div className="flex items-center gap-1 text-slate-600 dark:text-slate-200 whitespace-nowrap">
              <User className="h-3 w-3 text-slate-400 dark:text-slate-400" />
              <span>{name}</span>
            </div>
          );
        },
      }),
      columnHelper.accessor("amount", {
        header: () => <div className="text-right">Importe</div>,
        cell: (info) => {
          const movement = info.row.original;
          const signedAmount = getSignedAmount(movement);
          const isNegative = signedAmount < 0;
          return (
            <div
              className={`text-right font-semibold whitespace-nowrap ${
                isNegative ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {isNegative ? "-" : "+"} {currency.format(Math.abs(signedAmount))}
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "actions",
        header: () => <div className="text-right">Ticket</div>,
        cell: (info) => {
          const movement = info.row.original;
          if (movement.movement_type !== "sale_payment" || !movement.reference_id) {
            return <div className="text-right text-slate-400 dark:text-slate-400">-</div>;
          }
          return (
            <div className="text-right">
              <button
                type="button"
                className="h-6 inline-flex items-center gap-1 px-2 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-md transition-colors shadow-xs dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 dark:text-slate-200"
                onClick={() => onViewSaleDocument?.(movement.reference_id!)}
              >
                <FileText className="h-3 w-3 text-slate-400 dark:text-slate-400" />
                Ticket
              </button>
            </div>
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
      <div className="p-8 text-center bg-slate-50/50 rounded-xl border border-slate-200/80 dark:bg-slate-900/60 dark:border-slate-800">
        <ReceiptIcon className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
        <p className="text-xs font-medium text-slate-700 dark:text-slate-200">No hay movimientos registrados</p>
        <p className="text-[11px] text-slate-400 dark:text-slate-400 mt-0.5">
          Los cobros de ventas e ingresos/egresos del turno aparecerán aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="max-h-[55vh] overflow-auto rounded-xl border border-slate-200/80 shadow-xs dark:border-slate-800">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-800">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="py-2 px-3">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-slate-100/80 bg-white dark:bg-slate-900 dark:divide-slate-800">
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="py-2 px-3">
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
