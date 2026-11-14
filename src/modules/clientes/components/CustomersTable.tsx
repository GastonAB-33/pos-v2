import { useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { MoreVertical, Pencil, Power, Trash2, WalletCards } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { formatCustomerDocument } from "@/modules/configuracion/hooks/useEntityRequirements";
import { cn } from "@/utils/cn";
import type { Customer } from "@/types/entities";

interface CustomersTableProps {
  customers: Customer[];
  priceListNameById: Map<string, string>;
  canWrite: boolean;
  onViewCurrentAccount: (customer: Customer) => void;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
  onToggleActive: (customer: Customer) => void;
}

const columnHelper = createColumnHelper<Customer>();

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const CustomersTable = ({
  customers,
  priceListNameById,
  canWrite,
  onViewCurrentAccount,
  onEdit,
  onDelete,
  onToggleActive,
}: CustomersTableProps) => {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const columns = [
    columnHelper.accessor("full_name", {
      header: "Cliente",
      cell: (info) => {
        const row = info.row.original;
        return (
          <div>
            <span className="font-semibold text-slate-900 dark:text-slate-100 block">
              {info.getValue()}
            </span>
            {row.fiscal_business_name && row.fiscal_business_name !== row.full_name ? (
              <span className="text-xs text-slate-500 dark:text-slate-400 block truncate max-w-[200px]" title={row.fiscal_business_name}>
                {row.fiscal_business_name}
              </span>
            ) : null}
          </div>
        );
      },
    }),
    columnHelper.display({
      id: "document",
      header: "Documento",
      cell: (info) => {
        const row = info.row.original;
        return (
          <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
            {formatCustomerDocument(row.document_type, row.document_number)}
          </span>
        );
      },
    }),
    columnHelper.accessor("phone", {
      header: "Teléfono",
      cell: (info) => (
        <span className="text-slate-700 dark:text-slate-300">
          {info.getValue() || "-"}
        </span>
      ),
    }),
    columnHelper.accessor("email", {
      header: "Email",
      cell: (info) => (
        <span
          className="text-slate-700 dark:text-slate-300 block truncate max-w-[180px]"
          title={info.getValue() ?? undefined}
        >
          {info.getValue() || "-"}
        </span>
      ),
    }),
    columnHelper.accessor("current_balance", {
      header: "Saldo Cta Cte",
      cell: (info) => {
        const balance = info.getValue() ?? 0;
        const row = info.row.original;
        return (
          <div>
            <span
              className={cn(
                "font-semibold block",
                balance > 0
                  ? "text-rose-600 dark:text-rose-400 font-mono"
                  : balance < 0
                  ? "text-blue-600 dark:text-blue-400 font-mono"
                  : "text-slate-500 dark:text-slate-400 font-mono"
              )}
            >
              {currency.format(balance)}
            </span>
            {row.current_account_enabled ? (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                CC activa {row.current_account_limit != null ? `(${currency.format(row.current_account_limit)})` : ""}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                Sin CC
              </span>
            )}
          </div>
        );
      },
    }),
    columnHelper.display({
      id: "price_list",
      header: "Lista precios",
      cell: (info) => {
        const priceListId = info.row.original.price_list_id;
        const name = !priceListId ? "Base" : priceListNameById.get(priceListId) ?? "No encontrada";
        return (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700/60">
            {name}
          </span>
        );
      },
    }),
    columnHelper.accessor("is_active", {
      header: "Estado",
      cell: (info) =>
        info.getValue() ? (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300">
            Activo
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 border border-slate-200/80 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
            Inactivo
          </span>
        ),
    }),
    columnHelper.display({
      id: "actions",
      header: "Acciones",
      cell: (info) => {
        const row = info.row.original;

        return (
          <div className="flex items-center gap-1.5">
            <IconButton
              size="sm"
              icon={WalletCards}
              label="Ver cuenta corriente"
              onClick={() => onViewCurrentAccount(row)}
              className="!rounded-full hover:scale-105 transition-transform"
            />

            {canWrite ? (
              <>
                <IconButton
                  size="sm"
                  icon={Pencil}
                  label="Editar cliente"
                  onClick={() => onEdit(row)}
                  className="!rounded-full hover:scale-105 transition-transform"
                />
                <IconButton
                  size="sm"
                  icon={Power}
                  label={row.is_active ? "Desactivar cliente" : "Activar cliente"}
                  onClick={() => onToggleActive(row)}
                  className="!rounded-full hover:scale-105 transition-transform"
                />
                <IconButton
                  size="sm"
                  icon={Trash2}
                  label="Eliminar cliente"
                  tone="danger"
                  onClick={() => onDelete(row)}
                  className="!rounded-full hover:scale-105 transition-transform"
                />
              </>
            ) : null}
          </div>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: customers,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!customers.length) {
    return (
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-8 text-center text-sm text-slate-500 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        No hay clientes registrados o coincidentes con los filtros seleccionados.
      </div>
    );
  }

  return (
    <>
      {/* Vista Móvil: Tarjetas individuales separadas idénticas a Productos (md:hidden) */}
      <div className="md:hidden flex flex-col gap-3">
        {customers.map((customer) => {
          const balance = customer.current_balance ?? 0;
          const formattedDoc = formatCustomerDocument(
            customer.document_type,
            customer.document_number
          );
          const hasDoc = formattedDoc !== "Sin documento";
          const priceListName = !customer.price_list_id
            ? "Base"
            : priceListNameById.get(customer.price_list_id) ?? "Base";
          const isMenuOpen = menuOpenId === customer.id;

          return (
            <article
              key={customer.id}
              className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col gap-2.5 transition-all"
            >
              {/* Fila Superior: Badges de Documento, Lista de Precios y Estado con punto a la derecha */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200/60 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700/60 max-w-[160px] truncate font-mono">
                    {hasDoc ? formattedDoc : "Sin documento"}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-slate-100/80 px-2 py-0.5 text-xs font-medium text-slate-500 border border-slate-200/40 dark:bg-slate-800/70 dark:text-slate-400 dark:border-slate-700/40 max-w-[140px] truncate">
                    {priceListName}
                  </span>
                  {customer.current_account_enabled ? (
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/60">
                      CC activa
                    </span>
                  ) : null}
                </div>

                {/* Badge de Estado con punto de color (idéntico a Productos) */}
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold border shrink-0",
                    customer.is_active
                      ? "bg-emerald-50 border-emerald-200/80 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-400"
                      : "bg-slate-100 border-slate-200/80 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                  )}
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      customer.is_active ? "bg-emerald-500" : "bg-slate-400"
                    )}
                  />
                  <span>{customer.is_active ? "Activo" : "Inactivo"}</span>
                </span>
              </div>

              {/* Fila Media: Nombre del cliente y subtítulo / datos de contacto */}
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">
                  {customer.full_name}
                </h3>
                {customer.fiscal_business_name &&
                customer.fiscal_business_name !== customer.full_name ? (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                    {customer.fiscal_business_name}
                  </p>
                ) : null}
                {(customer.phone || customer.email) ? (
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500 truncate">
                    {[customer.phone, customer.email].filter(Boolean).join(" • ")}
                  </p>
                ) : null}
              </div>

              {/* Fila Inferior: SALDO CTA CTE y botones circulares de acción */}
              <div className="flex items-end justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    SALDO CTA CTE
                  </span>
                  <span
                    className={cn(
                      "text-xl font-black tracking-tight font-mono",
                      balance > 0
                        ? "text-rose-600 dark:text-rose-400"
                        : balance < 0
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-slate-900 dark:text-slate-100"
                    )}
                  >
                    {currency.format(balance)}
                  </span>
                </div>

                {/* Botones circulares de acción idénticos a Productos */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Botón Ver Cuenta Corriente */}
                  <button
                    type="button"
                    onClick={() => onViewCurrentAccount(customer)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-blue-100 bg-blue-50/80 text-blue-600 hover:border-blue-200 hover:bg-blue-100 active:scale-95 dark:border-blue-900/60 dark:bg-blue-950/60 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-all"
                    title="Ver cuenta corriente"
                    aria-label="Ver cuenta corriente"
                  >
                    <WalletCards size={16} />
                  </button>

                  {/* Botón Editar */}
                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => onEdit(customer)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-slate-50/80 text-slate-600 hover:border-slate-300 hover:bg-slate-100 active:scale-95 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800 transition-all"
                      title="Editar cliente"
                      aria-label="Editar cliente"
                    >
                      <Pencil size={15} />
                    </button>
                  )}

                  {/* Menú Más Opciones (...) idéntico a Productos */}
                  {canWrite && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setMenuOpenId(isMenuOpen ? null : customer.id)}
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-slate-50/80 text-slate-500 hover:border-slate-300 hover:bg-slate-100 active:scale-95 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:bg-slate-800 transition-all",
                          isMenuOpen && "ring-2 ring-blue-500/30"
                        )}
                        title="Más opciones del cliente"
                        aria-label="Más opciones del cliente"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {isMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40 bg-transparent"
                            onClick={() => setMenuOpenId(null)}
                            aria-hidden="true"
                          />
                          <div
                            className="absolute right-0 bottom-full mb-2 z-50 w-52 rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 text-left transition-colors"
                              onClick={() => {
                                setMenuOpenId(null);
                                onToggleActive(customer);
                              }}
                            >
                              <Power className="h-4 w-4 text-amber-500" />
                              {customer.is_active ? "Desactivar cliente" : "Activar cliente"}
                            </button>
                            <button
                              type="button"
                              className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 text-left transition-colors"
                              onClick={() => {
                                setMenuOpenId(null);
                                onDelete(customer);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-rose-500" />
                              Eliminar cliente
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Vista Escritorio: Tabla completa (hidden md:block) */}
      <div className="hidden md:block ui-table-wrap rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50/90 dark:bg-slate-800/70 border-b border-slate-200/80 dark:border-slate-800">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};
