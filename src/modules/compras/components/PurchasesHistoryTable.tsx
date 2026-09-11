import { useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowLeftRight, Eye, Gift, X } from "lucide-react";
import type { Purchase, Supplier } from "@/types/entities";
import { IconButton } from "@/components/ui/IconButton";

interface PurchaseHistoryRow {
  purchase: Purchase;
  supplier: Supplier | null;
}

interface PurchasesHistoryTableProps {
  rows: PurchaseHistoryRow[];
  canWrite: boolean;
  disabled?: boolean;
  onOpenReturnModal: (purchase: Purchase, supplier: Supplier | null) => void;
}

const columnHelper = createColumnHelper<PurchaseHistoryRow>();

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const getPaymentMethodLabel = (method: string | null | undefined): string => {
  switch (method) {
    case "cash":
      return "Efectivo (Caja)";
    case "transfer":
      return "Transferencia";
    case "current_account":
      return "Cta. Cte.";
    case "card_debit":
      return "Débito";
    case "card_credit":
      return "Crédito";
    default:
      return method || "Efectivo";
  }
};

export const PurchasesHistoryTable = ({
  rows,
  canWrite,
  disabled,
  onOpenReturnModal,
}: PurchasesHistoryTableProps) => {
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseHistoryRow | null>(null);

  const columns = [
    columnHelper.accessor((row) => row.purchase.issue_date || row.purchase.created_at, {
      id: "date",
      header: "Fecha / Comprobante",
      cell: (info) => {
        const purchase = info.row.original.purchase;
        const formattedDate = new Date(
          purchase.issue_date ? `${purchase.issue_date}T00:00:00` : purchase.created_at
        ).toLocaleDateString("es-AR");

        return (
          <div>
            <span className="font-semibold text-slate-900">{purchase.purchase_number}</span>
            <div className="text-xs text-slate-500">
              {formattedDate}
              {purchase.document_type ? ` • ${purchase.document_type}` : ""}
              {purchase.document_number ? ` Nº ${purchase.document_number}` : ""}
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor((row) => row.supplier?.name ?? "Sin proveedor", {
      id: "supplier",
      header: "Proveedor",
      cell: (info) => (
        <span className="font-medium text-slate-800">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor((row) => row.purchase.items?.length ?? 0, {
      id: "itemsCount",
      header: "Ítems",
      cell: (info) => {
        const items = info.row.original.purchase.items ?? [];
        const totalUnits = items.reduce(
          (acc, i) => acc + i.quantity + (i.bonified_quantity || 0),
          0
        );
        return (
          <span className="text-xs text-slate-600">
            {items.length} productos ({totalUnits} u.)
          </span>
        );
      },
    }),
    columnHelper.accessor((row) => row.purchase.payment_method, {
      id: "paymentMethod",
      header: "Pago",
      cell: (info) => (
        <span className="text-xs text-slate-600">{getPaymentMethodLabel(info.getValue())}</span>
      ),
    }),
    columnHelper.accessor((row) => row.purchase.status, {
      id: "status",
      header: "Estado",
      cell: (info) => {
        const status = info.getValue();

        if (status === "confirmed") {
          return <span className="ui-badge ui-badge--success">Confirmada</span>;
        }

        if (status === "partial_return") {
          return (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
              Devolución parcial
            </span>
          );
        }

        if (status === "returned") {
          return (
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
              Devuelta total
            </span>
          );
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
      cell: (info) => {
        const purchase = info.row.original.purchase;
        return (
          <div>
            <span className="font-bold text-slate-900">{currency.format(info.getValue())}</span>
            {purchase.returned_total && purchase.returned_total > 0 ? (
              <div className="text-[11px] font-medium text-amber-700">
                Devuelto: -{currency.format(purchase.returned_total)}
              </div>
            ) : null}
          </div>
        );
      },
    }),
    columnHelper.display({
      id: "actions",
      header: "Acciones",
      cell: (info) => {
        const { purchase, supplier } = info.row.original;
        const isReturnable = purchase.status === "confirmed" || purchase.status === "partial_return";

        return (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedPurchase(info.row.original)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              title="Ver detalle de la compra"
            >
              <Eye className="h-3.5 w-3.5 text-slate-500" />
              Detalle
            </button>

            {isReturnable && canWrite ? (
              <button
                type="button"
                onClick={() => onOpenReturnModal(purchase, supplier)}
                disabled={disabled}
                className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                title="Registrar devolución o nota de crédito"
              >
                <ArrowLeftRight className="h-3.5 w-3.5 text-amber-700" />
                Devolver
              </button>
            ) : null}
          </div>
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
        No hay compras registradas.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-2.5 text-left font-semibold text-slate-700">
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
              <tr key={row.id} className="hover:bg-slate-50/70">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-2.5 text-slate-700">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de Detalle de Compra */}
      {selectedPurchase ? (
        <section className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] p-2 sm:p-4">
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel">
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                  Detalle de Compra
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  {selectedPurchase.purchase.purchase_number}
                </h2>
                <p className="text-xs text-slate-500">
                  Proveedor: {selectedPurchase.supplier?.name || "Sin proveedor"}
                </p>
              </div>
              <IconButton
                icon={X}
                label="Cerrar detalle"
                onClick={() => setSelectedPurchase(null)}
              />
            </header>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs sm:grid-cols-4">
                <div>
                  <span className="block text-slate-500">Comprobante</span>
                  <span className="font-semibold text-slate-800">
                    {selectedPurchase.purchase.document_type || "Factura"}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-500">Número</span>
                  <span className="font-semibold text-slate-800">
                    {selectedPurchase.purchase.document_number || "S/N"}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-500">Medio de Pago</span>
                  <span className="font-semibold text-slate-800">
                    {getPaymentMethodLabel(selectedPurchase.purchase.payment_method)}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-500">Fecha</span>
                  <span className="font-semibold text-slate-800">
                    {selectedPurchase.purchase.issue_date ||
                      new Date(selectedPurchase.purchase.created_at).toLocaleDateString("es-AR")}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">
                  Productos comprados ({selectedPurchase.purchase.items?.length ?? 0})
                </h3>
                <div className="space-y-2">
                  {selectedPurchase.purchase.items?.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{item.product_name_snapshot}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>Cant. pagada: {item.quantity} u.</span>
                          {item.bonified_quantity ? (
                            <span className="inline-flex items-center gap-0.5 font-medium text-emerald-700">
                              <Gift className="h-3 w-3" /> +{item.bonified_quantity} bonificados
                            </span>
                          ) : null}
                          {item.returned_quantity ? (
                            <span className="font-medium text-amber-700">
                              ({item.returned_quantity} devueltos)
                            </span>
                          ) : null}
                          <span>• Costo unit: {currency.format(item.unit_cost)}</span>
                          {item.vat_percent ? <span>• IVA: {item.vat_percent}%</span> : null}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-slate-900">
                          {currency.format(item.line_total)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedPurchase.purchase.notes ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Observaciones / Historial:</span>
                  <p className="mt-1 whitespace-pre-wrap">{selectedPurchase.purchase.notes}</p>
                </div>
              ) : null}

              <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Subtotal neto:</span>
                  <span>{currency.format(selectedPurchase.purchase.subtotal)}</span>
                </div>
                {selectedPurchase.purchase.vat_total ? (
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>IVA total:</span>
                    <span>{currency.format(selectedPurchase.purchase.vat_total)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-base font-bold text-slate-900 border-t border-slate-200 pt-1">
                  <span>Total Compra:</span>
                  <span className="text-brand-700">{currency.format(selectedPurchase.purchase.total)}</span>
                </div>
                {selectedPurchase.purchase.returned_total ? (
                  <div className="flex justify-between text-xs font-semibold text-amber-800">
                    <span>Total Devoluciones / Crédito:</span>
                    <span>-{currency.format(selectedPurchase.purchase.returned_total)}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <footer className="border-t border-slate-200 px-5 py-3 text-right">
              <button
                type="button"
                className="ui-btn-primary"
                onClick={() => setSelectedPurchase(null)}
              >
                Cerrar
              </button>
            </footer>
          </div>
        </section>
      ) : null}
    </>
  );
};

