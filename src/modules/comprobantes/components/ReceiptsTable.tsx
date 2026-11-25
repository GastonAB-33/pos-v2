import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { WhatsAppIcon } from "@/components/brand/WhatsAppIcon";
import type { Receipt } from "@/types/entities";
import { formatDisplayReceiptNumber, formatDisplaySaleNumber } from "@/utils/voucher-format.utils";

interface ReceiptsTableProps {
  receipts: Receipt[];
  onView: (receipt: Receipt) => void;
  canGenerateInvoice?: boolean;
  generating?: boolean;
  onGenerateInvoice?: (receipt: Receipt) => void;
  onShareWhatsApp?: (receipt: Receipt) => void;
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
  onShareWhatsApp,
}: ReceiptsTableProps) => {
  const columns = [
    columnHelper.accessor("receipt_number", {
      header: "Numero",
      cell: (info) => (
        <div>
          <span className="font-mono text-sm text-slate-900 dark:text-slate-100 font-semibold block">
            {formatDisplayReceiptNumber(info.getValue())}
          </span>
          <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 block">
            {formatDisplaySaleNumber(info.row.original.sale_number)}
          </span>
        </div>
      ),
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
      cell: (info) => (
        <span className="font-kpi font-bold text-slate-900 dark:text-slate-100">
          {currency.format(info.getValue())}
        </span>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: "Accion",
      cell: (info) => (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 active:scale-95 cursor-pointer"
            onClick={() => onView(info.row.original)}
          >
            Ver detalle
          </button>

          {onShareWhatsApp ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800/80 rounded-full transition active:scale-95 cursor-pointer"
              title="Compartir por WhatsApp"
              onClick={() => onShareWhatsApp(info.row.original)}
            >
              <WhatsAppIcon className="h-3.5 w-3.5 fill-current text-emerald-600 dark:text-emerald-400" />
              <span>WhatsApp</span>
            </button>
          ) : null}

          {canGenerateInvoice && onGenerateInvoice ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-full transition shadow-xs disabled:opacity-50 active:scale-95 cursor-pointer"
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
    return (
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-12 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        No se encontraron comprobantes para el criterio seleccionado.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* VISTA DESKTOP / TABLET (hidden md:block): Tabla completa de alta densidad */}
      <div className="hidden md:block rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            <thead className="bg-slate-50/90 dark:bg-slate-800/70 border-b border-slate-200/90 dark:border-slate-800">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
                    >
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
                <tr
                  key={row.id}
                  className="hover:bg-slate-50/80 transition-colors dark:hover:bg-slate-800/50"
                >
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

      {/* VISTA MOBILE (block md:hidden): Tarjetas individuales touch-friendly conforme al skill mobile-data-cards */}
      <div className="block md:hidden space-y-2.5">
        {receipts.map((receipt) => (
          <article
            key={receipt.id}
            className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3"
          >
            {/* Zona 1: Cabecera con número de comprobante y fecha */}
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                {formatDisplayReceiptNumber(receipt.receipt_number)}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {new Date(receipt.issued_at).toLocaleString("es-AR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>

            {/* Zona 2: Cliente y Venta Asociada */}
            <div className="flex items-center justify-between text-xs">
              <div className="min-w-0 pr-2">
                <span className="text-slate-400 dark:text-slate-500 font-medium">Cliente: </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate inline-block max-w-[170px] align-bottom">
                  {receipt.customer_name ?? "Consumidor final"}
                </span>
              </div>
              <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                {formatDisplaySaleNumber(receipt.sale_number)}
              </div>
            </div>

            {/* Zona 3: Total destacado y Botones de Acción */}
            <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500 block">
                  Total
                </span>
                <span className="font-kpi text-base font-bold text-slate-900 dark:text-slate-100">
                  {currency.format(receipt.total)}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 active:scale-95 cursor-pointer"
                  onClick={() => onView(receipt)}
                >
                  Ver detalle
                </button>

                {onShareWhatsApp ? (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center h-7 px-2.5 text-xs font-semibold !rounded-full text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800/80 dark:bg-emerald-950/40 dark:text-emerald-400 transition cursor-pointer active:scale-95 gap-1"
                    title="Compartir por WhatsApp"
                    onClick={() => onShareWhatsApp(receipt)}
                  >
                    <WhatsAppIcon className="h-3.5 w-3.5 fill-current text-emerald-600 dark:text-emerald-400" />
                    <span>WhatsApp</span>
                  </button>
                ) : null}

                {canGenerateInvoice && onGenerateInvoice ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-full transition shadow-xs disabled:opacity-50 active:scale-95 cursor-pointer"
                    onClick={() => onGenerateInvoice(receipt)}
                    disabled={generating}
                  >
                    Facturar
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};
