import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { UserRecord } from "@/types/entities";

interface UsersTableRow {
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
          <p className="font-medium text-slate-900">{info.getValue()}</p>
          {info.row.original.isCurrentSessionUser ? (
            <p className="text-xs text-slate-500">Sesion actual</p>
          ) : null}
        </div>
      ),
    }),
    columnHelper.display({
      id: "access",
      header: "Email / Username",
      cell: (info) => (
        <div className="space-y-1">
          <p>{info.row.original.user.email ?? "-"}</p>
          <p className="text-xs text-slate-500">{info.row.original.user.username ?? "-"}</p>
        </div>
      ),
    }),
    columnHelper.accessor((row) => row.profileName, {
      id: "profile",
      header: "Perfil",
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor((row) => row.user.is_active, {
      id: "status",
      header: "Estado",
      cell: (info) =>
        info.getValue() ? (
          <span className="ui-badge ui-badge--success">Activo</span>
        ) : (
          <span className="ui-badge ui-badge--danger">Inactivo</span>
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
          <div className="flex items-center gap-2">
            <button type="button" className="ui-btn-ghost px-2 py-1 text-xs" onClick={() => onEdit(info.row.original)}>
              Editar
            </button>
            <button
              type="button"
              className="ui-btn-ghost px-2 py-1 text-xs"
              onClick={() => onToggleActive(info.row.original)}
            >
              {info.row.original.user.is_active ? "Desactivar" : "Activar"}
            </button>
            <button
              type="button"
              className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700"
              onClick={() => onDelete(info.row.original)}
            >
              Eliminar
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
    return <div className="ui-empty-state">No hay usuarios cargados.</div>;
  }

  return (
    <div className="ui-table-wrap">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="px-3 py-2 text-left font-medium text-slate-700">
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
                <td key={cell.id} className="px-3 py-2 text-slate-700">
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
