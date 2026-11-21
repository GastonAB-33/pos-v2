import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { FileText, Calendar } from "lucide-react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { cn } from "@/utils/cn";
import type { CurrentAccountMovement } from "@/types/entities";
import type {
  CurrentAccountSaleDetail,
  CurrentAccountSummary,
  PendingDebtAllocation,
} from "@/modules/clientes/hooks/useCurrentAccount";
import {
  formatDisplaySaleNumber,
  formatDisplayReceiptNumber,
} from "@/utils/voucher-format.utils";

interface CurrentAccountMovementsTableProps {
  movements: CurrentAccountMovement[];
  saleDetailsById?: Record<string, CurrentAccountSaleDetail>;
  accountSummary: CurrentAccountSummary;
  pendingAllocationsByMovementId?: Record<string, PendingDebtAllocation>;
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
  pendingAllocationsByMovementId = {},
}: CurrentAccountMovementsTableProps) => {
  const [ticketSaleDetail, setTicketSaleDetail] = useState<CurrentAccountSaleDetail | null>(null);

  const sortedMovements = useMemo(
    () => [...movements].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [movements]
  );

  const getUpdatedDebtAmount = (movement: CurrentAccountMovement): number => {
    const baseAmount = Math.abs(movement.amount);
    if (movement.type !== "debt") return baseAmount;

    const allocation = pendingAllocationsByMovementId[movement.id];
    if (allocation) {
      if (allocation.pendingAmount <= 0) return baseAmount;
      return allocation.updatedAmount;
    }

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
      if (!Number.isFinite(fixedAmount) || fixedAmount <= 0 || accountSummary.accountingBalance <= 0) {
        return baseAmount;
      }
      return roundAmount(baseAmount + fixedAmount * (baseAmount / accountSummary.accountingBalance));
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
        if (!saleDetail) return `Venta #${movement.sale_id.slice(0, 8)}`;

        return (
          <div className="space-y-0.5">
            <p className="font-medium text-slate-800 dark:text-slate-200">
              {formatDisplaySaleNumber(saleDetail.sale_number)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {saleDetail.receipt_number ? `Ticket ${formatDisplayReceiptNumber(saleDetail.receipt_number)}` : "Sin ticket"}
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
        <span title="Saldo actualizado según la regla vigente calculada sobre la deuda pendiente.">
          Saldo actualizado
        </span>
      ),
      cell: (info) => {
        const movement = info.row.original;
        if (movement.type !== "debt") return "-";
        const allocation = pendingAllocationsByMovementId[movement.id];
        if (allocation && allocation.pendingAmount <= 0) {
          return (
            <span className="text-slate-400 dark:text-slate-500 font-normal">
              Saldada ({currency.format(Math.abs(movement.amount))})
            </span>
          );
        }
        return (
          <span className="font-semibold text-purple-600 dark:text-purple-400 font-mono">
            {currency.format(getUpdatedDebtAmount(movement))}
          </span>
        );
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
            className="rounded-xl border border-slate-200/90 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-all cursor-pointer"
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
      <div className="rounded-2xl border border-slate-200/90 bg-white p-8 text-center text-sm text-slate-500 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        Este cliente todavia no tiene movimientos.
      </div>
    );
  }

  return (
    <>
      {/* 1. DESKTOP VIEW: TABLA TRADICIONAL (hidden md:block) */}
      <div className="hidden md:block current-account-movements ui-table-wrap rounded-2xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden max-h-[520px] overflow-y-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50/90 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-800 backdrop-blur-xs">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-2.5 align-top text-slate-700 dark:text-slate-300">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 2. MOBILE VIEW: TARJETAS INDIVIDUALES (block md:hidden) */}
      <div className="block md:hidden space-y-3 max-h-[560px] overflow-y-auto pr-0.5">
        {sortedMovements.map((movement) => {
          const saleDetail = movement.sale_id ? saleDetailsById[movement.sale_id] : null;
          const isDebt = movement.type === "debt";
          const isPayment = movement.type === "payment";
          const updatedDebt = isDebt ? getUpdatedDebtAmount(movement) : null;

          return (
            <article
              key={movement.id}
              className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-2.5 transition-all"
            >
              {/* Zona 1: Tipo con punto de estado + Fecha */}
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold border shrink-0",
                    isDebt
                      ? "bg-rose-50 border-rose-200/80 text-rose-700 dark:bg-rose-950/60 dark:border-rose-900/60 dark:text-rose-300"
                      : isPayment
                      ? "bg-emerald-50 border-emerald-200/80 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-800/60 dark:text-emerald-300"
                      : "bg-indigo-50 border-indigo-200/80 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-900/60 dark:text-indigo-300"
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0",
                      isDebt
                        ? "bg-rose-500"
                        : isPayment
                        ? "bg-emerald-500"
                        : "bg-indigo-500"
                    )}
                  />
                  <span>{movementTypeLabels[movement.type] ?? movement.type}</span>
                </span>

                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {new Date(movement.created_at).toLocaleString("es-AR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              {/* Zona 2: Identificador / Comprobante */}
              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug">
                  {saleDetail
                    ? formatDisplaySaleNumber(saleDetail.sale_number)
                    : movement.sale_id
                    ? `Venta #${movement.sale_id.slice(0, 8)}`
                    : movement.notes || "Movimiento manual"}
                </h4>
                {saleDetail?.receipt_number ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Ticket: {formatDisplayReceiptNumber(saleDetail.receipt_number)}
                  </p>
                ) : null}
              </div>

              {/* Zona 3: Monto Principal & Botón de Ticket */}
              <div className="flex items-end justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                    MONTO INICIAL
                  </span>
                  <span
                    className={cn(
                      "text-base sm:text-lg font-black font-mono leading-tight",
                      isDebt
                        ? "text-rose-600 dark:text-rose-400"
                        : isPayment
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-slate-900 dark:text-slate-100"
                    )}
                  >
                    {currency.format(movement.amount)}
                  </span>
                </div>

                {saleDetail && (
                  <button
                    type="button"
                    onClick={() => setTicketSaleDetail(saleDetail)}
                    className="!rounded-full h-8 px-3 inline-flex items-center gap-1.5 border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 shadow-2xs text-xs font-semibold active:scale-95 transition-all cursor-pointer"
                    title="Ver comprobante"
                  >
                    <FileText size={13} className="text-blue-600 dark:text-blue-400" />
                    <span>Ver ticket</span>
                  </button>
                )}
              </div>

              {/* Zona 4: Sub-panel para Saldo Actualizado y Observación */}
              {(isDebt || (movement.notes && saleDetail)) && (
                <div className="rounded-xl bg-slate-50/80 border border-slate-200/70 p-2.5 dark:bg-slate-800/40 dark:border-slate-700/60 space-y-1 text-xs">
                  {isDebt && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">
                        Saldo actualizado:
                      </span>
                      {pendingAllocationsByMovementId[movement.id]?.pendingAmount === 0 ? (
                        <span className="text-slate-400 dark:text-slate-500 text-xs">
                          Saldada ({currency.format(Math.abs(movement.amount))})
                        </span>
                      ) : (
                        <strong className="font-mono text-purple-600 dark:text-purple-400 font-bold">
                          {currency.format(updatedDebt ?? Math.abs(movement.amount))}
                        </strong>
                      )}
                    </div>
                  )}
                  {movement.notes && saleDetail && (
                    <p className="text-slate-600 dark:text-slate-300 italic text-[11px] pt-0.5">
                      "{movement.notes}"
                    </p>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {ticketSaleDetail ? (
        <section className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative z-10 w-full max-w-2xl rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] flex flex-col">
            {/* Cabecera */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 pb-3 dark:border-slate-800 shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>Detalle de Ticket / Comprobante de Venta</span>
                </h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                  <span>
                    Venta: <strong className="text-slate-700 dark:text-slate-300">{formatDisplaySaleNumber(ticketSaleDetail.sale_number)}</strong>
                  </span>
                  {ticketSaleDetail.receipt_number && (
                    <span>
                      • Ticket: <strong className="text-slate-700 dark:text-slate-300">{formatDisplayReceiptNumber(ticketSaleDetail.receipt_number)}</strong>
                    </span>
                  )}
                  {ticketSaleDetail.sale_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      {new Date(ticketSaleDetail.sale_date).toLocaleString("es-AR")}
                    </span>
                  )}
                </div>

                {/* Pago o Pago Combinado */}
                {(() => {
                  const payments =
                    ticketSaleDetail.payments && ticketSaleDetail.payments.length > 0
                      ? ticketSaleDetail.payments
                      : [
                          {
                            method_code: "current_account",
                            method_name: ticketSaleDetail.receipt_payment_method || "Cuenta Corriente",
                            amount: ticketSaleDetail.sale_total,
                          },
                        ];
                  const isSplit = payments.length > 1;

                  return (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2.5 text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {isSplit ? "Pago combinado:" : "Pago:"}
                      </span>
                      {payments.map((p, idx) => (
                        <span
                          key={p.id || idx}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                        >
                          <span className="text-slate-600 dark:text-slate-400">{p.method_name}:</span>
                          <strong className="font-mono text-slate-900 dark:text-slate-100">
                            {currency.format(p.amount)}
                          </strong>
                        </span>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <ModalCloseButton label="Cerrar ticket" onClick={() => setTicketSaleDetail(null)} />
            </div>

            {/* Contenido con scroll */}
            <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Productos del comprobante
              </p>
              <div className="overflow-x-auto rounded-xl border border-slate-200/90 dark:border-slate-800">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead className="bg-slate-50/90 dark:bg-slate-800/80 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200 border-b border-slate-200/80 dark:border-slate-800">
                    <tr>
                      <th className="px-3 py-2 text-left">Producto</th>
                      <th className="px-3 py-2 text-right">Cantidad</th>
                      <th className="px-3 py-2 text-right">Precio venta</th>
                      <th className="px-3 py-2 text-right">Precio hoy</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                    {ticketSaleDetail.items.map((item) => (
                      <tr key={`${item.product_id}-${item.product_name}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="px-3 py-2 font-medium">{item.product_name}</td>
                        <td className="px-3 py-2 font-mono text-right">{item.quantity.toLocaleString("es-AR")}</td>
                        <td className="px-3 py-2 font-mono text-right">{currency.format(item.unit_price)}</td>
                        <td className="px-3 py-2 font-mono text-right">
                          {item.current_unit_price == null ? "-" : currency.format(item.current_unit_price)}
                        </td>
                        <td className="px-3 py-2 font-bold font-mono text-right">{currency.format(item.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50/90 dark:bg-slate-800/80 border-t border-slate-200/90 dark:border-slate-800 font-bold">
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-right text-xs uppercase text-slate-600 dark:text-slate-300">
                        Total Comprobante:
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-sm text-slate-900 dark:text-slate-100">
                        {currency.format(ticketSaleDetail.sale_total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {ticketSaleDetail.receipt_notes && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 italic pt-1">
                  Nota del ticket: {ticketSaleDetail.receipt_notes}
                </p>
              )}
            </div>

            {/* Pie del modal */}
            <div className="flex justify-end pt-3 border-t border-slate-200/80 dark:border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setTicketSaleDetail(null)}
                className="rounded-xl bg-slate-900 hover:bg-slate-800 px-5 py-2 text-xs font-semibold text-white dark:bg-slate-800 dark:hover:bg-slate-700 transition cursor-pointer active:scale-95"
              >
                Cerrar
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
};
