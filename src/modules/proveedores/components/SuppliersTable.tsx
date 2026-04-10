import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { Supplier } from "@/types/entities";

interface SuppliersTableProps {
  suppliers: Supplier[];
  canWrite: boolean;
  onEdit: (supplier: Supplier) => void;
  onDelete: (supplier: Supplier) => void;
  onToggleActive: (supplier: Supplier) => void;
}

const columnHelper = createColumnHelper<Supplier>();

export const SuppliersTable = ({
  suppliers,
  canWrite,
  onEdit,
  onDelete,
  onToggleActive,
}: SuppliersTableProps) => {
  const columns = [
    columnHelper.accessor("name", {
      header: "Nombre",
      cell: (info) => <span className="font-medium text-slate-900">{info.getValue()}</span>,
    }),
    columnHelper.accessor("phone", {
      header: "Telefono",
      cell: (info) => info.getValue() ?? "-",
    }),
    columnHelper.accessor("email", {
      header: "Email",
      cell: (info) => info.getValue() ?? "-",
    }),
    columnHelper.accessor("address", {
      header: "Direccion",
      cell: (info) => info.getValue() ?? "-",
    }),
    columnHelper.accessor("is_active", {
      header: "Estado",
      cell: (info) =>
        info.getValue() ? (
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
            Activo
          </span>
        ) : (
          <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700">
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
          return <span className="text-xs text-slate-400">Sin permisos de escritura</span>;
        }

        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onEdit(supplier)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => onToggleActive(supplier)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs"
            >
              {supplier.is_active ? "Desactivar" : "Activar"}
            </button>
            <button
              type="button"
              onClick={() => onDelete(supplier)}
              className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700"
            >
              Eliminar
            </button>
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
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
        No hay proveedores cargados.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="px-4 py-3 text-left font-medium text-slate-700">
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
                <td key={cell.id} className="px-4 py-3 text-slate-700">
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

