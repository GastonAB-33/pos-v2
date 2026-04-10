import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { Promotion } from "@/types/entities";

interface PromotionsTableProps {
  promotions: Promotion[];
  productNameById: Map<string, string>;
  canWrite: boolean;
  onEdit: (promotion: Promotion) => void;
  onDelete: (promotion: Promotion) => void;
  onToggleActive: (promotion: Promotion) => void;
}

const columnHelper = createColumnHelper<Promotion>();

const getTypeLabel = (type: Promotion["type"]) => {
  switch (type) {
    case "percentage_discount":
      return "Desc. %";
    case "fixed_discount":
      return "Desc. fijo";
    case "combo_price":
      return "Precio combo";
    default:
      return type;
  }
};

const getScopeLabel = (scope: Promotion["scope"]) => {
  if (scope === "product") return "Producto";
  return "Carrito";
};

const formatDateRange = (startsAt: string | null, endsAt: string | null) => {
  if (!startsAt && !endsAt) return "Sin vigencia";

  const toLabel = (value: string | null) =>
    value
      ? new Date(value).toLocaleString("es-AR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "-";

  return `${toLabel(startsAt)} -> ${toLabel(endsAt)}`;
};

export const PromotionsTable = ({
  promotions,
  productNameById,
  canWrite,
  onEdit,
  onDelete,
  onToggleActive,
}: PromotionsTableProps) => {
  const columns = [
    columnHelper.accessor("name", {
      header: "Nombre",
      cell: (info) => <span className="font-medium text-slate-900">{info.getValue()}</span>,
    }),
    columnHelper.accessor("code", {
      header: "Codigo",
      cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
    }),
    columnHelper.accessor("type", {
      header: "Tipo",
      cell: (info) => <span className="ui-badge ui-badge--info">{getTypeLabel(info.getValue())}</span>,
    }),
    columnHelper.accessor("scope", {
      header: "Alcance",
      cell: (info) => <span className="ui-badge ui-badge--warn">{getScopeLabel(info.getValue())}</span>,
    }),
    columnHelper.accessor("product_id", {
      header: "Producto",
      cell: (info) => {
        const productId = info.getValue();
        if (!productId) return "-";
        return productNameById.get(productId) ?? "Producto no encontrado";
      },
    }),
    columnHelper.display({
      id: "validity",
      header: "Vigencia",
      cell: (info) => formatDateRange(info.row.original.starts_at, info.row.original.ends_at),
    }),
    columnHelper.accessor("is_active", {
      header: "Estado",
      cell: (info) =>
        info.getValue() ? (
          <span className="ui-badge ui-badge--success">Activa</span>
        ) : (
          <span className="ui-badge ui-badge--danger">Inactiva</span>
        ),
    }),
    columnHelper.display({
      id: "actions",
      header: "Acciones",
      cell: (info) => {
        const promotion = info.row.original;

        if (!canWrite) {
          return <span className="text-xs text-slate-400">Sin permisos de escritura</span>;
        }

        return (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onEdit(promotion)} className="ui-btn-ghost px-2 py-1 text-xs">
              Editar
            </button>
            <button
              type="button"
              onClick={() => onToggleActive(promotion)}
              className="ui-btn-ghost px-2 py-1 text-xs"
            >
              {promotion.is_active ? "Desactivar" : "Activar"}
            </button>
            <button
              type="button"
              onClick={() => onDelete(promotion)}
              className="ui-btn-ghost border-red-300 px-2 py-1 text-xs text-red-700"
            >
              Eliminar
            </button>
          </div>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: promotions,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!promotions.length) {
    return <div className="ui-empty-state">No hay promociones cargadas.</div>;
  }

  return (
    <div className="ui-table-wrap">
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

