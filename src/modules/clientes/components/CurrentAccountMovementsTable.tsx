import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import type { CurrentAccountMovement } from "@/types/entities";
import type {
  CurrentAccountSaleDetail,
  CurrentAccountSummary,
} from "@/modules/clientes/hooks/useCurrentAccount";

interface CurrentAccountMovementsTableProps {
  movements: CurrentAccountMovement[];
  saleDetailsById?: Record<string, CurrentAccountSaleDetail>;
  accountSummary: CurrentAccountSummary;
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

const roundAmount = (value: number): number => Number(value.toFixed(2));

export const CurrentAccountMovementsTable = ({
  movements,
  saleDetailsById = {},
  accountSummary,
}: CurrentAccountMovementsTableProps) => {
  const [ticketSaleDetail, setTicketSaleDetail] = useState<CurrentAccountSaleDetail | null>(null);

  const sortedMovements = useMemo(
    () => [...movements].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [movements]
  );

  const getUpdatedDebtAmount = (movement: CurrentAccountMovement): number => {
    const baseAmount = Math.abs(movement.amount);
    if (movement.type !== "debt") return baseAmount;

    const saleDetail = movement.sale_id ? saleDetailsById[movement.sale_id] : null;
    const rule = accountSummary.pricingRule;

    if (rule.mode === "today_prices") {
      return saleDetail?.current_total ?? baseAmount;
    }

    if (rule.mode === "surcharge_percentage") {
      const percent = Number(rule.surcharge_percent ?? 0);
      if (!Number.isFinite(percent) || percent <= 0) return baseAmount;
      return roundAmount(baseAmount * (1 + percent / 100));
    }

    if (rule.mode === "surcharge_fixed") {
      const fixedAmount = Number(rule.surcharge_amount ?? 0);
      if (!Number.isFinite(fixedAmount) || fixedAmount <= 0 || accountSummary.initialDebtTotal <= 0) {
        return baseAmount;
      }
      return roundAmount(baseAmount + fixedAmount * (baseAmount / accountSummary.initialDebtTotal));
    }

    return baseAmount;
  };

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
    columnHelper.accessor("amount", {
      header: () => (
        <span title="Valor original congelado al momento de registrar la venta o el movimiento.">
          Monto inicial
        </span>
      ),
      cell: (info) => currency.format(info.getValue()),
    }),
    columnHelper.display({
      id: "updated_balance",
      header: () => (
        <span title="El recargo o actualizacion vigente reemplaza al anterior; no se suma varias veces.">
          Saldo actualizado
        </span>
      ),
      cell: (info) => {
        const movement = info.row.original;
        if (movement.type === "debt") return currency.format(getUpdatedDebtAmount(movement));
        return "-";
      },
    }),
    columnHelper.accessor("notes", {
      header: "Observacion",
      cell: (info) => info.getValue() ?? "-",
    }),
    columnHelper.display({
      id: "ticket",
      header: "Ticket",
      cell: (info) => {
        const movement = info.row.original;
        if (!movement.sale_id) return "-";
        const saleDetail = saleDetailsById[movement.sale_id];
        if (!saleDetail) return "Sin ticket";

        return (
          <button
            type="button"
            className="ui-btn-ghost px-2 py-1 text-xs"
            onClick={() => setTicketSaleDetail(saleDetail)}
          >
            Ver ticket
          </button>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: sortedMovements,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!movements.length) {
    return (
      <div className="ui-empty-state">
        Este cliente todavia no tiene movimientos.
      </div>
    );
  }

  return (
    <>
      <div className="current-account-movements ui-table-wrap max-h-[520px] overflow-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50">
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

      {ticketSaleDetail ? (
        <section className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--ui-overlay)] p-4">
          <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Ticket</h3>
                <p className="text-xs text-slate-500">
                  {ticketSaleDetail.sale_number}
                  {ticketSaleDetail.receipt_number ? ` | ${ticketSaleDetail.receipt_number}` : ""}
                </p>
              </div>
              <button
                type="button"
                className="ui-btn-ghost px-2 py-1 text-xs"
                onClick={() => setTicketSaleDetail(null)}
              >
                Cerrar
              </button>
            </div>

            <div className="mt-3 max-h-[60vh] overflow-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Producto</th>
                    <th className="px-3 py-2 text-left">Cantidad</th>
                    <th className="px-3 py-2 text-left">Precio venta</th>
                    <th className="px-3 py-2 text-left">Precio hoy</th>
                    <th className="px-3 py-2 text-left">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {ticketSaleDetail.items.map((item) => (
                    <tr key={`${item.product_id}-${item.product_name}`}>
                      <td className="px-3 py-2">{item.product_name}</td>
                      <td className="px-3 py-2">{item.quantity.toLocaleString("es-AR")}</td>
                      <td className="px-3 py-2">{currency.format(item.unit_price)}</td>
                      <td className="px-3 py-2">
                        {item.current_unit_price == null ? "-" : currency.format(item.current_unit_price)}
                      </td>
                      <td className="px-3 py-2">{currency.format(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
};
