import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Mail, Pencil, Power, Shield, Trash2, User } from "lucide-react";
import type { UserRecord } from "@/types/entities";
import { cn } from "@/utils/cn";

export interface UsersTableRow {
  user: UserRecord;
  profileName: string;
  isCurrentSessionUser: boolean;
}

interface UsersTableProps {
  rows: UsersTableRow[];
  canWrite: boolean;
  onEdit: (row: UsersTableRow) => void;
  onDelete: (row: UsersTableRow) => void;
  onToggleActive: (row: UsersTableRow) => void;
}

const columnHelper = createColumnHelper<UsersTableRow>();

export const UsersTable = ({
  rows,
  canWrite,
  onEdit,
  onDelete,
  onToggleActive,
}: UsersTableProps) => {
  const columns = [
    columnHelper.accessor((row) => row.user.full_name, {
      id: "full_name",
      header: "Nombre",
      cell: (info) => (
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-100">{info.getValue()}</p>
          {info.row.original.isCurrentSessionUser ? (
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
              Sesión actual
            </span>
          ) : null}
        </div>
      ),
    }),
    columnHelper.display({
      id: "access",
      header: "Datos de acceso",
      cell: (info) => (
        <div className="space-y-0.5">
          <p className="text-slate-800 dark:text-slate-200">{info.row.original.user.email ?? "-"}</p>
          <p className="font-mono text-xs text-slate-500 dark:text-slate-400">@{info.row.original.user.username ?? "-"}</p>
        </div>
      ),
    }),
    columnHelper.accessor((row) => row.profileName, {
      id: "profile",
      header: "Perfil de permisos",
      cell: (info) => (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor((row) => row.user.is_active, {
      id: "status",
      header: "Estado",
      cell: (info) =>
        info.getValue() ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60 font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Activo
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 border border-red-200/60 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800/60 font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            Inactivo
          </span>
        ),
    }),
    columnHelper.display({
      id: "actions",
      header: "Acciones",
      cell: (info) => {
        if (!canWrite) {
          return <span className="text-xs text-slate-400">Solo lectura</span>;
        }

        return (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onEdit(info.row.original)}
              className="!rounded-full h-8 w-8 inline-flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-all cursor-pointer"
              title="Editar usuario"
            >
              <Pencil size={15} />
            </button>
            <button
              type="button"
              onClick={() => onToggleActive(info.row.original)}
              className="!rounded-full h-8 w-8 inline-flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-all cursor-pointer"
              title={info.row.original.user.is_active ? "Desactivar usuario" : "Activar usuario"}
            >
              <Power size={15} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(info.row.original)}
              className="!rounded-full h-8 w-8 inline-flex items-center justify-center text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/50 transition-all cursor-pointer"
              title="Eliminar usuario"
            >
              <Trash2 size={15} />
            </button>
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
      <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
        No se encontraron usuarios cargados con los filtros actuales.
      </div>
    );
  }

  return (
    <div className="space-y-3 w-full min-w-0">
      {/* ============================================================== */}
      {/* 1. VISTA MÓVIL: TARJETAS TOUCH-FRIENDLY (block md:hidden)     */}
      {/* ============================================================== */}
      <div className="block md:hidden space-y-3">
        {rows.map((row) => {
          const user = row.user;
          return (
            <article
              key={user.id}
              className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col gap-2.5 transition-all"
            >
              {/* Zona 1: Badges superiores y Estado con punto de color */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 max-w-[170px] truncate">
                    <Shield size={11} className="shrink-0 text-blue-600 dark:text-blue-400" />
                    <span className="truncate">{row.profileName}</span>
                  </span>

                  {row.isCurrentSessionUser && (
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200/60 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900/60">
                      Sesión actual
                    </span>
                  )}
                </div>

                {/* Badge de Estado con punto de color */}
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold border shrink-0",
                    user.is_active
                      ? "bg-emerald-50 border-emerald-200/80 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-400"
                      : "bg-red-50 border-red-200/80 text-red-700 dark:bg-red-950/40 dark:border-red-900/60 dark:text-red-400"
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0",
                      user.is_active ? "bg-emerald-500" : "bg-red-500"
                    )}
                  />
                  <span>{user.is_active ? "Activo" : "Inactivo"}</span>
                </span>
              </div>

              {/* Zona 2: Nombre del Usuario */}
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">
                  {user.full_name}
                </h3>
              </div>

              {/* Zona 3: Métricas / Acciones Circulares */}
              <div className="flex items-end justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    PERFIL ASIGNADO
                  </span>
                  <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100 leading-tight truncate max-w-[200px]">
                    {row.profileName}
                  </span>
                </div>

                {/* Botones de acción circulares accesibles (Touch-friendly) */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {canWrite ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onEdit(row)}
                        className="!rounded-full h-8 w-8 inline-flex items-center justify-center border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-600 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 active:scale-95 transition-all shadow-2xs cursor-pointer"
                        title="Editar usuario"
                        aria-label="Editar usuario"
                      >
                        <Pencil size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={() => onToggleActive(row)}
                        className={cn(
                          "!rounded-full h-8 w-8 inline-flex items-center justify-center border active:scale-95 transition-all shadow-2xs cursor-pointer",
                          user.is_active
                            ? "border-amber-200/90 bg-amber-50/70 text-amber-700 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                            : "border-emerald-200/90 bg-emerald-50/70 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                        )}
                        title={user.is_active ? "Desactivar usuario" : "Activar usuario"}
                        aria-label={user.is_active ? "Desactivar usuario" : "Activar usuario"}
                      >
                        <Power size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={() => onDelete(row)}
                        className="!rounded-full h-8 w-8 inline-flex items-center justify-center border border-rose-200/90 bg-rose-50/70 text-rose-600 hover:bg-rose-100 hover:text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-400 active:scale-95 transition-all shadow-2xs cursor-pointer"
                        title="Eliminar usuario"
                        aria-label="Eliminar usuario"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400">Solo lectura</span>
                  )}
                </div>
              </div>

              {/* Zona 4: Sub-panel de Datos de Acceso */}
              <div className="rounded-xl bg-slate-50/80 border border-slate-200/70 p-2.5 grid grid-cols-2 text-center divide-x divide-slate-200/70 dark:bg-slate-800/40 dark:border-slate-700/60 dark:divide-slate-700/60">
                <div className="px-2 min-w-0">
                  <span className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    <Mail size={11} className="shrink-0" />
                    <span>CORREO</span>
                  </span>
                  <span
                    className="block text-xs font-medium text-slate-700 dark:text-slate-200 truncate mt-0.5"
                    title={user.email ?? "Sin correo"}
                  >
                    {user.email || "-"}
                  </span>
                </div>
                <div className="px-2 min-w-0">
                  <span className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    <User size={11} className="shrink-0" />
                    <span>USUARIO</span>
                  </span>
                  <span
                    className="block text-xs font-mono font-medium text-slate-700 dark:text-slate-200 truncate mt-0.5"
                    title={`@${user.username ?? "-"}`}
                  >
                    @{user.username || "-"}
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* ============================================================== */}
      {/* 2. VISTA ESCRITORIO: TABLA TRADICIONAL (hidden md:block)       */}
      {/* ============================================================== */}
      <div className="hidden md:block ui-table-wrap rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50/90 dark:bg-slate-800/70 border-b border-slate-200/80 dark:border-slate-800">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3.5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200"
                  >
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
              <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3.5 py-3 text-slate-700 dark:text-slate-200 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
