import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowLeftRight, Camera, Download, Eye, Gift, Maximize2, Search, X } from "lucide-react";
import type { Product, Purchase, Supplier } from "@/types/entities";
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
  products?: Product[];
}

const columnHelper = createColumnHelper<PurchaseHistoryRow>();

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const getPaymentMethodLabel = (method: string | null | undefined): string => {
  switch (method) {
    case "cash_daily":
      return "Caja Diaria";
    case "cash_general":
      return "Caja General";
    case "cash":
      return "Efectivo Directo";
    case "transfer":
      return "Transferencia";
    case "current_account":
      return "Cta. Cte. Proveedor";
    case "card_debit":
      return "Débito";
    case "card_credit":
      return "Crédito";
    default:
      return method || "Efectivo";
  }
};

const renderStatusBadge = (status: string) => {
  if (status === "confirmed") {
    return <span className="ui-badge ui-badge--success">Confirmada</span>;
  }

  if (status === "partial_return") {
    return (
      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
        Devolución parcial
      </span>
    );
  }

  if (status === "returned") {
    return (
      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-950/60 dark:text-red-300">
        Devuelta total
      </span>
    );
  }

  if (status === "cancelled") {
    return <span className="ui-badge ui-badge--danger">Cancelada</span>;
  }

  return <span className="ui-badge ui-badge--warn">{status}</span>;
};

export const PurchasesHistoryTable = ({
  rows,
  canWrite,
  disabled,
  onOpenReturnModal,
  products,
}: PurchasesHistoryTableProps) => {
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseHistoryRow | null>(null);
  const [filterText, setFilterText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [photoViewerUrl, setPhotoViewerUrl] = useState<string | null>(null);

  const productsById = useMemo(
    () => new Map((products ?? []).map((p) => [p.id, p])),
    [products]
  );

  const filteredRows = useMemo(() => {
    let result = rows;

    if (statusFilter !== "all") {
      result = result.filter((r) => r.purchase.status === statusFilter);
    }

    const q = filterText.trim().toLowerCase();
    if (q) {
      result = result.filter((r) => {
        const p = r.purchase;
        const s = r.supplier;
        const num = (p.purchase_number || "").toLowerCase();
        const doc = (p.document_number || "").toLowerCase();
        const sup = (s?.name || "").toLowerCase();
        const notes = (p.notes || "").toLowerCase();
        return num.includes(q) || doc.includes(q) || sup.includes(q) || notes.includes(q);
      });
    }

    return result;
  }, [rows, statusFilter, filterText]);

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
            <span className="font-semibold text-slate-900 dark:text-slate-100">{purchase.purchase_number}</span>
            <div className="text-xs text-slate-500 dark:text-slate-400">
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
        <span className="font-medium text-slate-800 dark:text-slate-200">{info.getValue()}</span>
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
          <span className="text-xs text-slate-600 dark:text-slate-400">
            {items.length} productos ({totalUnits} u.)
          </span>
        );
      },
    }),
    columnHelper.accessor((row) => row.purchase.payment_method, {
      id: "paymentMethod",
      header: "Pago",
      cell: (info) => (
        <span className="text-xs text-slate-600 dark:text-slate-400">{getPaymentMethodLabel(info.getValue())}</span>
      ),
    }),
    columnHelper.accessor((row) => row.purchase.status, {
      id: "status",
      header: "Estado",
      cell: (info) => renderStatusBadge(info.getValue()),
    }),
    columnHelper.accessor((row) => row.purchase.total, {
      id: "total",
      header: "Total",
      cell: (info) => {
        const purchase = info.row.original.purchase;
        return (
          <div>
            <span className="font-bold text-slate-900 dark:text-slate-100">{currency.format(info.getValue())}</span>
            {purchase.returned_total && purchase.returned_total > 0 ? (
              <div className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
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
            {purchase.invoice_photo_url ? (
              <button
                type="button"
                onClick={() => setPhotoViewerUrl(purchase.invoice_photo_url!)}
                className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300 dark:hover:bg-brand-900/60"
                title="Ver fotografía de la factura física adjunta"
              >
                <Camera className="h-3.5 w-3.5" />
                Factura
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => setSelectedPurchase(info.row.original)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              title="Ver detalle de la compra"
            >
              <Eye className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
              Detalle
            </button>

            {isReturnable && canWrite ? (
              <button
                type="button"
                onClick={() => onOpenReturnModal(purchase, supplier)}
                disabled={disabled}
                className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/60"
                title="Registrar devolución o nota de crédito"
              >
                <ArrowLeftRight className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" />
                Devolver
              </button>
            ) : null}
          </div>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: filteredRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
        No hay compras registradas.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 1. Barra de Búsqueda y Filtros de Estado */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Buscar por proveedor, comprobante, nº compra..."
            className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-8 text-xs text-slate-900 placeholder:text-slate-400 shadow-xs transition focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          {filterText ? (
            <button
              type="button"
              onClick={() => setFilterText("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              title="Borrar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              statusFilter === "all"
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            Todas ({rows.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("confirmed")}
            className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              statusFilter === "confirmed"
                ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950 shadow-xs"
                : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            Confirmadas
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("partial_return")}
            className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              statusFilter === "partial_return"
                ? "bg-amber-600 text-white dark:bg-amber-500 dark:text-slate-950 shadow-xs"
                : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            Devoluciones
          </button>
        </div>
      </div>

      {/* Si no hay resultados para el filtro actual */}
      {!filteredRows.length ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>No se encontraron compras con el filtro aplicado.</p>
          <button
            type="button"
            onClick={() => {
              setFilterText("");
              setStatusFilter("all");
            }}
            className="mt-2 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <>
          {/* 2. Vista Móvil: Tarjetas individuales (block md:hidden) */}
          <div className="space-y-3 md:hidden">
            {filteredRows.map((row) => {
              const { purchase, supplier } = row;
              const formattedDate = new Date(
                purchase.issue_date ? `${purchase.issue_date}T00:00:00` : purchase.created_at
              ).toLocaleDateString("es-AR");
              const items = purchase.items ?? [];
              const totalUnits = items.reduce(
                (acc, i) => acc + i.quantity + (i.bonified_quantity || 0),
                0
              );
              const isReturnable = purchase.status === "confirmed" || purchase.status === "partial_return";

              return (
                <article
                  key={purchase.id}
                  className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs transition dark:border-slate-800 dark:bg-slate-900"
                >
                  {/* Encabezado: Nº Compra + Fecha y Badge */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-slate-800/80">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {purchase.purchase_number}
                      </span>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {formattedDate}
                        {purchase.document_type ? ` • ${purchase.document_type}` : ""}
                        {purchase.document_number ? ` Nº ${purchase.document_number}` : ""}
                      </div>
                    </div>
                    <div>{renderStatusBadge(purchase.status)}</div>
                  </div>

                  {/* Contenido: Proveedor, Pago e Ítems */}
                  <div className="grid grid-cols-2 gap-2.5 py-3 text-xs border-b border-slate-100 dark:border-slate-800/80">
                    <div>
                      <span className="block text-slate-500 dark:text-slate-400 text-[11px]">Proveedor</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                        {supplier?.name || "Sin proveedor"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-slate-500 dark:text-slate-400 text-[11px]">Medio de pago</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 block truncate">
                        {getPaymentMethodLabel(purchase.payment_method)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-slate-500 dark:text-slate-400 text-[11px]">Productos</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {items.length} prod. ({totalUnits} u.)
                      </span>
                    </div>
                    <div>
                      <span className="block text-slate-500 dark:text-slate-400 text-[11px]">Total abonado</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {currency.format(purchase.total)}
                      </span>
                      {purchase.returned_total && purchase.returned_total > 0 ? (
                        <span className="block text-[10px] font-medium text-amber-700 dark:text-amber-400">
                          Devuelto: -{currency.format(purchase.returned_total)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Acciones para móvil con botones cómodos */}
                  <div className="flex flex-wrap items-center gap-2 pt-2.5">
                    {purchase.invoice_photo_url ? (
                      <button
                        type="button"
                        onClick={() => setPhotoViewerUrl(purchase.invoice_photo_url!)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 py-2 px-3 text-xs font-semibold text-brand-700 shadow-xs transition hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300"
                        title="Ver fotografía de la factura física adjunta"
                      >
                        <Camera className="h-4 w-4" />
                        Factura
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => setSelectedPurchase(row)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <Eye className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                      Ver detalle
                    </button>

                    {isReturnable && canWrite ? (
                      <button
                        type="button"
                        onClick={() => onOpenReturnModal(purchase, supplier)}
                        disabled={disabled}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/60"
                      >
                        <ArrowLeftRight className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                        Devolver
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>

          {/* 3. Vista Escritorio: Tabla completa (hidden md:block) */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/80">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className="px-4 py-2.5 text-left font-semibold text-slate-700 dark:text-slate-200">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-2.5 text-slate-700 dark:text-slate-300">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal de Detalle de Compra */}
      {selectedPurchase ? (
        <section className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] p-2 sm:p-4 backdrop-blur-[1px]">
          <div className="flex max-h-[92dvh] sm:max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel dark:border-slate-800 dark:bg-slate-900">
            <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-4 sm:px-5 sm:py-4 dark:border-slate-800">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-400">
                  Detalle de Compra
                </p>
                <h2 className="mt-1 text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                  {selectedPurchase.purchase.purchase_number}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  Proveedor: {selectedPurchase.supplier?.name || "Sin proveedor"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selectedPurchase.purchase.invoice_photo_url ? (
                  <button
                    type="button"
                    onClick={() => setPhotoViewerUrl(selectedPurchase.purchase.invoice_photo_url!)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 bg-brand-50 px-2.5 py-1.5 text-xs font-bold text-brand-700 shadow-xs hover:bg-brand-100 active:scale-95 transition dark:border-brand-700 dark:bg-brand-950/60 dark:text-brand-300 dark:hover:bg-brand-900/60"
                    title="Ver fotografía de la factura física adjunta"
                  >
                    <Camera className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                    <span>Ver factura</span>
                  </button>
                ) : null}
                <IconButton
                  icon={X}
                  label="Cerrar detalle"
                  onClick={() => setSelectedPurchase(null)}
                />
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs sm:grid-cols-4 dark:border-slate-700/80 dark:bg-slate-800/50">
                <div>
                  <span className="block text-slate-500 dark:text-slate-400 text-[11px]">Comprobante</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {selectedPurchase.purchase.document_type || "Factura"}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-500 dark:text-slate-400 text-[11px]">Número</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {selectedPurchase.purchase.document_number || "S/N"}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-500 dark:text-slate-400 text-[11px]">Medio de Pago</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {getPaymentMethodLabel(selectedPurchase.purchase.payment_method)}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-500 dark:text-slate-400 text-[11px]">Fecha</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {selectedPurchase.purchase.issue_date ||
                      new Date(selectedPurchase.purchase.created_at).toLocaleDateString("es-AR")}
                  </span>
                </div>
              </div>

              {/* Botón y banner destacado de factura física cargada si existe */}
              {selectedPurchase.purchase.invoice_photo_url ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50/70 p-2.5 sm:px-3.5 dark:border-brand-800/80 dark:bg-brand-950/40">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-brand-300 bg-white cursor-pointer dark:border-brand-700 dark:bg-slate-900"
                      onClick={() => setPhotoViewerUrl(selectedPurchase.purchase.invoice_photo_url!)}
                      title="Toca para ampliar la foto de la factura"
                    >
                      <img
                        src={selectedPurchase.purchase.invoice_photo_url}
                        alt="Factura"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-brand-950 dark:text-brand-200 truncate">
                        Factura física adjunta
                      </p>
                      <p className="text-[11px] text-brand-700 dark:text-brand-400">
                        Comprobante cargado en la compra
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPhotoViewerUrl(selectedPurchase.purchase.invoice_photo_url!)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-brand-700 active:scale-95 transition dark:bg-brand-500"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Ver foto</span>
                  </button>
                </div>
              ) : null}

              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Productos comprados ({selectedPurchase.purchase.items?.length ?? 0})
                </h3>
                <div className="space-y-2">
                  {selectedPurchase.purchase.items?.map((item) => {
                    const product = item.product ?? productsById.get(item.product_id);
                    const salePrice = item.sale_price ?? product?.price;
                    const unitLabel = product?.sale_mode === "weight" ? "kg" : "u.";

                    return (
                      <div
                        key={item.id}
                        className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700/80 dark:bg-slate-800/60"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                            {item.product_name_snapshot}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            <span>Cant. pagada: {item.quantity} {unitLabel}</span>
                            {item.bonified_quantity ? (
                              <span className="inline-flex items-center gap-0.5 font-medium text-emerald-700 dark:text-emerald-400">
                                <Gift className="h-3 w-3" /> +{item.bonified_quantity} bonificados
                              </span>
                            ) : null}
                            {item.returned_quantity ? (
                              <span className="font-medium text-amber-700 dark:text-amber-400">
                                ({item.returned_quantity} devueltos)
                              </span>
                            ) : null}
                            <span>• Costo unit: {currency.format(item.unit_cost)}</span>
                            {item.vat_percent ? <span>• IVA: {item.vat_percent}%</span> : null}
                            {salePrice != null && salePrice > 0 ? (
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                • Precio venta: {currency.format(salePrice)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="text-right shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                          <span className="text-xs text-slate-500 dark:text-slate-400 sm:hidden block text-left">Subtotal ítem:</span>
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {currency.format(item.line_total)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedPurchase.purchase.notes ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700/80 dark:bg-slate-800/50 dark:text-slate-300">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Observaciones / Historial:</span>
                  <p className="mt-1 whitespace-pre-wrap">{selectedPurchase.purchase.notes}</p>
                </div>
              ) : null}

              {/* Fotografía de la factura física adjunta */}
              {selectedPurchase.purchase.invoice_photo_url ? (
                <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-3 dark:border-brand-800/80 dark:bg-brand-950/30">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-brand-900 dark:text-brand-300">
                      <Camera className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                      Fotografía de la factura física
                    </span>
                    <button
                      type="button"
                      onClick={() => setPhotoViewerUrl(selectedPurchase.purchase.invoice_photo_url!)}
                      className="inline-flex items-center gap-1 rounded-md bg-white border border-brand-300 px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50 shadow-xs dark:bg-slate-800 dark:border-brand-700 dark:text-brand-300"
                    >
                      <Maximize2 className="h-3 w-3" /> Ver ampliada
                    </button>
                  </div>
                  <div
                    className="relative h-32 sm:h-44 w-full overflow-hidden rounded-lg border border-brand-200 bg-slate-100 cursor-pointer group dark:border-brand-800/60 dark:bg-slate-900"
                    onClick={() => setPhotoViewerUrl(selectedPurchase.purchase.invoice_photo_url!)}
                    title="Toca para ampliar el comprobante"
                  >
                    <img
                      src={selectedPurchase.purchase.invoice_photo_url}
                      alt="Factura física"
                      className="h-full w-full object-contain transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="rounded-lg bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-xs flex items-center gap-1.5">
                        <Maximize2 className="h-4 w-4" /> Ampliar comprobante
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700/80 dark:bg-slate-800/50">
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>Subtotal neto:</span>
                  <span className="text-slate-800 dark:text-slate-200">{currency.format(selectedPurchase.purchase.subtotal)}</span>
                </div>
                {selectedPurchase.purchase.vat_total ? (
                  <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span>IVA total:</span>
                    <span className="text-slate-800 dark:text-slate-200">{currency.format(selectedPurchase.purchase.vat_total)}</span>
                  </div>
                ) : null}
                {(() => {
                  const match = selectedPurchase.purchase.notes?.match(/IIBB(?:[^:]*):\s*\$?([0-9.,]+)/i);
                  const iibbVal = match ? match[1] : null;
                  if (!iibbVal) return null;
                  return (
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>Percepción IIBB:</span>
                      <span className="text-slate-800 dark:text-slate-200">${iibbVal}</span>
                    </div>
                  );
                })()}
                <div className="flex justify-between text-base font-bold text-slate-900 border-t border-slate-200 dark:border-slate-700 dark:text-slate-100 pt-1">
                  <span>Total Compra:</span>
                  <span className="text-brand-700 dark:text-brand-400">{currency.format(selectedPurchase.purchase.total)}</span>
                </div>
                {selectedPurchase.purchase.returned_total ? (
                  <div className="flex justify-between text-xs font-semibold text-amber-800 dark:text-amber-300">
                    <span>Total Devoluciones / Crédito:</span>
                    <span>-{currency.format(selectedPurchase.purchase.returned_total)}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <footer className="border-t border-slate-200 p-3 sm:px-5 sm:py-3 text-right dark:border-slate-800">
              <button
                type="button"
                className="ui-btn-primary w-full sm:w-auto"
                onClick={() => setSelectedPurchase(null)}
              >
                Cerrar
              </button>
            </footer>
          </div>
        </section>
      ) : null}

      {/* Lightbox / Visor de foto de factura a pantalla completa */}
      {photoViewerUrl ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-3 sm:p-6 animate-fadeIn"
          onClick={() => setPhotoViewerUrl(null)}
        >
          <div
            className="relative flex max-h-[92vh] max-w-4xl flex-col items-center justify-center overflow-hidden rounded-2xl bg-slate-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex w-full items-center justify-between border-b border-slate-800 px-4 py-2.5 text-white">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-brand-400" />
                <span className="text-xs font-bold">Fotografía original de la factura</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={photoViewerUrl}
                  download="factura-compra.jpg"
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                  title="Descargar fotografía"
                >
                  <Download className="h-3.5 w-3.5" /> Descargar
                </a>
                <button
                  type="button"
                  onClick={() => setPhotoViewerUrl(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                  title="Cerrar visor"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex max-h-[calc(92vh-4rem)] w-full items-center justify-center overflow-auto p-2">
              <img
                src={photoViewerUrl}
                alt="Factura original"
                className="max-h-[78vh] w-auto max-w-full rounded-lg object-contain shadow-md"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

