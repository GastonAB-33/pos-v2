import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Pencil, Power, Trash2 } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import type { PermissionProfileRecord } from "@/types/entities";
import type { AppModule } from "@/types/modules";

interface PermissionProfilesRow {
  profile: PermissionProfileRecord;
  usersCount: number;
}

interface PermissionProfilesTableProps {
  rows: PermissionProfilesRow[];
  moduleOrder: AppModule[];
  canWrite: boolean;
  onEdit: (row: PermissionProfilesRow) => void;
  onDelete: (row: PermissionProfilesRow) => void;
  onToggleActive: (row: PermissionProfilesRow) => void;
}

const columnHelper = createColumnHelper<PermissionProfilesRow>();

const countGrantedModules = (profile: PermissionProfileRecord, moduleOrder: AppModule[]): number => {
  let count = 0;
  for (const module of moduleOrder) {
    if (profile.permissions[module]?.read || profile.permissions[module]?.write) {
      count += 1;
    }
  }
  return count;
};

export const PermissionProfilesTable = ({
  rows,
  moduleOrder,
  canWrite,
  onEdit,
  onDelete,
  onToggleActive,
}: PermissionProfilesTableProps) => {
  const columns = [
    columnHelper.accessor((row) => row.profile.name, {
      id: "name",
      header: "Perfil",
      cell: (info) => (
        <div>
          <p className="font-medium text-slate-900">{info.getValue()}</p>
          <p className="text-xs text-slate-500">
            {info.row.original.profile.description ?? "Sin descripcion"}
          </p>
        </div>
      ),
    }),
    columnHelper.accessor((row) => row.usersCount, {
      id: "users",
      header: "Usuarios",
      cell: (info) => (
        <span className="font-kpi">{info.getValue().toLocaleString("es-AR")}</span>
      ),
    }),
    columnHelper.display({
      id: "modules",
      header: "Modulos habilitados",
      cell: (info) => {
        const count = countGrantedModules(info.row.original.profile, moduleOrder);
        return <span className="font-kpi">{count.toLocaleString("es-AR")}</span>;
      },
    }),
    columnHelper.accessor((row) => row.profile.is_active, {
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
            <IconButton size="sm" icon={Pencil} label="Editar perfil" onClick={() => onEdit(info.row.original)} />
            <IconButton size="sm" icon={Power} label={info.row.original.profile.is_active ? "Desactivar perfil" : "Activar perfil"} onClick={() => onToggleActive(info.row.original)} />
            <IconButton size="sm" icon={Trash2} label="Eliminar perfil" tone="danger" onClick={() => onDelete(info.row.original)} />
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
    return <div className="ui-empty-state">No hay perfiles de permisos cargados.</div>;
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
