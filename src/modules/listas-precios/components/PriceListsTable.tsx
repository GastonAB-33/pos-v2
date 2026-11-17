import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Eye, Pencil, Power, Trash2 } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import type { PriceList } from "@/types/entities";

interface PriceListsTableProps {
  priceLists: PriceList[];
  selectedPriceListId: string | null;
  canWrite: boolean;
  onSelect: (priceList: PriceList) => void;
  onEdit: (priceList: PriceList) => void;
  onDelete: (priceList: PriceList) => void;
  onToggleActive: (priceList: PriceList) => void;
}

const columnHelper = createColumnHelper<PriceList>();

export const PriceListsTable = ({
  priceLists,
  selectedPriceListId,
  canWrite,
  onSelect,
  onEdit,
  onDelete,
  onToggleActive,
}: PriceListsTableProps) => {
  const columns = [
    columnHelper.accessor("name", {
      header: "Nombre",
      cell: (info) => (
        <span className="font-semibold text-slate-900 dark:text-slate-100">
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor("code", {
      header: "Código",
      cell: (info) => (
        <span className="font-mono text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor("price_mode", {
      header: "Modo",
      cell: (info) =>
        info.getValue() === "percentage" ? (
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
            Porcentaje
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            Precio fijo
          </span>
        ),
    }),
    columnHelper.accessor("percentage_adjustment", {
      header: "Ajuste %",
      cell: (info) => (
        <span className="font-semibold text-slate-900 dark:text-slate-100">
          {(info.getValue() ?? 0) > 0 ? `+${(info.getValue() ?? 0).toLocaleString("es-AR")}%` : `${(info.getValue() ?? 0).toLocaleString("es-AR")}%`}
        </span>
      ),
    }),
    columnHelper.accessor("is_active", {
      header: "Estado",
      cell: (info) =>
        info.getValue() ? (
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            Activa
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
            Inactiva
          </span>
        ),
    }),
    columnHelper.display({
      id: "actions",
      header: "Acciones",
      cell: (info) => {
        const row = info.row.original;
        const isSelected = selectedPriceListId === row.id;

        return (
          <div className="flex items-center gap-1.5">
            <IconButton
              size="sm"
              icon={Eye}
              label={isSelected ? "Detalle seleccionado" : "Ver detalle"}
              tone={isSelected ? "primary" : "default"}
              onClick={() => onSelect(row)}
              className="!rounded-full hover:scale-105 transition-transform"
            />

            {canWrite ? (
              <>
                <IconButton
                  size="sm"
                  icon={Pencil}
                  label="Editar lista"
                  onClick={() => onEdit(row)}
                  className="!rounded-full hover:scale-105 transition-transform"
                />
                <IconButton
                  size="sm"
                  icon={Power}
                  label={row.is_active ? "Desactivar lista" : "Activar lista"}
                  onClick={() => onToggleActive(row)}
                  className="!rounded-full hover:scale-105 transition-transform"
                />
                <IconButton
                  size="sm"
                  icon={Trash2}
                  label="Eliminar lista"
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
    data: priceLists,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!priceLists.length) {
    return (
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-8 text-center text-sm text-slate-500 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        No hay listas de precios cargadas.
      </div>
    );
  }

  return (
    <div className="ui-table-wrap rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50/90 dark:bg-slate-800/70 border-b border-slate-200/80 dark:border-slate-800">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="px-3.5 py-3 text-left font-semibold text-slate-700 dark:text-slate-200 text-xs uppercase tracking-wider">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
          {table.getRowModel().rows.map((row) => {
            const isSelected = selectedPriceListId === row.original.id;

            return (
              <tr
                key={row.id}
                className={
                  isSelected
                    ? "bg-blue-50/60 dark:bg-blue-950/30 transition-colors"
                    : "hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                }
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3.5 py-2.5 text-slate-700 dark:text-slate-300">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
