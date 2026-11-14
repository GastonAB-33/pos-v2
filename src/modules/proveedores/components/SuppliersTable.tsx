import { useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { MoreVertical, Pencil, Power, Trash2 } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/utils/cn";
import type { Supplier } from "@/types/entities";

interface SuppliersTableProps {
  suppliers: Supplier[];
  canWrite: boolean;
  onEdit: (supplier: Supplier) => void;
  onDelete: (supplier: Supplier) => void;
  onToggleActive: (supplier: Supplier) => void;
}

const columnHelper = createColumnHelper<Supplier>();

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const SuppliersTable = ({
  suppliers,
  canWrite,
  onEdit,
  onDelete,
  onToggleActive,
}: SuppliersTableProps) => {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const columns = [
    columnHelper.accessor("name", {
      header: "Proveedor",
      cell: (info) => (
        <span className="font-semibold text-slate-900 dark:text-slate-100 block">
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor("tax_id", {
      header: "CUIT / Identificación",
      cell: (info) => (
        <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
          {info.getValue() || "-"}
        </span>
      ),
    }),
    columnHelper.accessor("phone", {
      header: "Teléfono",
      cell: (info) => (
        <span className="text-slate-700 dark:text-slate-300">
          {info.getValue() ?? "-"}
        </span>
      ),
    }),
    columnHelper.accessor("email", {
      header: "Email",
      cell: (info) => (
        <span
          className="text-slate-700 dark:text-slate-300 block truncate max-w-[200px]"
          title={info.getValue() ?? undefined}
        >
          {info.getValue() ?? "-"}
        </span>
      ),
    }),
    columnHelper.accessor("address", {
      header: "Dirección",
      cell: (info) => (
        <span
          className="text-slate-700 dark:text-slate-300 block truncate max-w-[200px]"
          title={info.getValue() ?? undefined}
        >
          {info.getValue() ?? "-"}
        </span>
      ),
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
        const supplier = info.row.original;

        if (!canWrite) {
          return <span className="text-xs text-slate-400 dark:text-slate-500">Lectura</span>;
        }

        return (
          <div className="flex items-center gap-1.5">
            <IconButton
              size="sm"
              icon={Pencil}
              label="Editar proveedor"
              onClick={() => onEdit(supplier)}
              className="!rounded-full hover:scale-105 transition-transform"
            />
            <IconButton
              size="sm"
              icon={Power}
              label={supplier.is_active ? "Desactivar proveedor" : "Activar proveedor"}
              onClick={() => onToggleActive(supplier)}
              className="!rounded-full hover:scale-105 transition-transform"
            />
            <IconButton
              size="sm"
              icon={Trash2}
              label="Eliminar proveedor"
              tone="danger"
              onClick={() => onDelete(supplier)}
              className="!rounded-full hover:scale-105 transition-transform"
            />
          </div>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: suppliers,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!suppliers.length) {
    return (
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-8 text-center text-sm text-slate-500 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        No hay proveedores registrados o coincidentes con los filtros seleccionados.
      </div>
    );
  }

  return (
    <>
      {/* Vista Móvil: Tarjetas individuales separadas idénticas a Productos (md:hidden) */}
      <div className="md:hidden flex flex-col gap-3">
        {suppliers.map((supplier) => {
          const isMenuOpen = menuOpenId === supplier.id;

          return (
            <article
              key={supplier.id}
              className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col gap-2.5 transition-all"
            >
              {/* Fila Superior: Badges de CUIT, Contacto y Estado con punto a la derecha */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200/60 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700/60 max-w-[160px] truncate font-mono">
                    {supplier.tax_id ? `CUIT ${supplier.tax_id}` : "Sin CUIT"}
                  </span>
                  {supplier.code ? (
                    <span className="inline-flex items-center rounded-full bg-slate-100/80 px-2 py-0.5 text-xs font-medium text-slate-500 border border-slate-200/40 dark:bg-slate-800/70 dark:text-slate-400 dark:border-slate-700/40 max-w-[140px] truncate">
                      {supplier.code}
                    </span>
                  ) : null}
                </div>

                {/* Badge de Estado con punto de color (idéntico a Productos) */}
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold border shrink-0",
                    supplier.is_active
                      ? "bg-emerald-50 border-emerald-200/80 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-400"
                      : "bg-slate-100 border-slate-200/80 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                  )}
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      supplier.is_active ? "bg-emerald-500" : "bg-slate-400"
                    )}
                  />
                  <span>{supplier.is_active ? "Activo" : "Inactivo"}</span>
                </span>
              </div>

              {/* Fila Media: Nombre del proveedor y datos de contacto */}
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">
                  {supplier.name}
                </h3>
                {(supplier.phone || supplier.email) ? (
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500 truncate">
                    {[supplier.phone, supplier.email].filter(Boolean).join(" • ")}
                  </p>
                ) : null}
                {supplier.address ? (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                    {supplier.address}
                  </p>
                ) : null}
              </div>

              {/* Fila Inferior: IDENTIFICACIÓN FISCAL y botones circulares de acción */}
              <div className="flex items-end justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {supplier.current_balance != null && supplier.current_balance !== 0
                      ? "SALDO CTA CTE"
                      : "IDENTIFICACIÓN FISCAL"}
                  </span>
                  <span className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight font-mono">
                    {supplier.current_balance != null && supplier.current_balance !== 0
                      ? currency.format(supplier.current_balance)
                      : supplier.tax_id || "Consumidor / S/D"}
                  </span>
                </div>

                {/* Botones circulares de acción idénticos a Productos */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {canWrite ? (
                    <>
                      {/* Botón Editar */}
                      <button
                        type="button"
                        onClick={() => onEdit(supplier)}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-slate-50/80 text-slate-600 hover:border-slate-300 hover:bg-slate-100 active:scale-95 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800 transition-all"
                        title="Editar proveedor"
                        aria-label="Editar proveedor"
                      >
                        <Pencil size={15} />
                      </button>

                      {/* Menú Más Opciones (...) idéntico a Productos */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setMenuOpenId(isMenuOpen ? null : supplier.id)}
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-slate-50/80 text-slate-500 hover:border-slate-300 hover:bg-slate-100 active:scale-95 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:bg-slate-800 transition-all",
                            isMenuOpen && "ring-2 ring-blue-500/30"
                          )}
                          title="Más opciones del proveedor"
                          aria-label="Más opciones del proveedor"
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
                                  onToggleActive(supplier);
                                }}
                              >
                                <Power className="h-4 w-4 text-amber-500" />
                                {supplier.is_active ? "Desactivar proveedor" : "Activar proveedor"}
                              </button>
                              <button
                                type="button"
                                className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 text-left transition-colors"
                                onClick={() => {
                                  setMenuOpenId(null);
                                  onDelete(supplier);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-rose-500" />
                                Eliminar proveedor
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-slate-500">Lectura</span>
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
