import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { PaymentMethod } from "@/types/entities";

interface PaymentMethodsTableProps {
  paymentMethods: PaymentMethod[];
  canWrite: boolean;
  onEdit: (paymentMethod: PaymentMethod) => void;
  onDelete: (paymentMethod: PaymentMethod) => void;
  onToggleActive: (paymentMethod: PaymentMethod) => void;
}

const columnHelper = createColumnHelper<PaymentMethod>();

const getTypeLabel = (type: PaymentMethod["type"]) => {
  switch (type) {
    case "cash":
      return "Efectivo";
    case "transfer":
      return "Transferencia";
    case "card":
      return "Tarjeta";
    case "mercado_pago":
      return "Mercado Pago";
    case "current_account":
      return "Cuenta corriente";
    default:
      return "Otro";
  }
};

const getTypeBadgeClass = (type: PaymentMethod["type"]) => {
  if (type === "cash" || type === "transfer") return "ui-badge ui-badge--success";
  if (type === "current_account") return "ui-badge ui-badge--warn";
  if (type === "mercado_pago") return "ui-badge ui-badge--info";
  return "ui-badge ui-badge--danger";
};

export const PaymentMethodsTable = ({
  paymentMethods,
  canWrite,
  onEdit,
  onDelete,
  onToggleActive,
}: PaymentMethodsTableProps) => {
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
      cell: (info) => (
        <span className={getTypeBadgeClass(info.getValue())}>{getTypeLabel(info.getValue())}</span>
      ),
    }),
    columnHelper.accessor("affects_cash", {
      header: "Impacta caja",
      cell: (info) => (
        <span className={info.getValue() ? "ui-badge ui-badge--success" : "ui-badge ui-badge--warn"}>
          {info.getValue() ? "Si" : "No"}
        </span>
      ),
    }),
    columnHelper.accessor("surcharge_percent", {
      header: "Recargo %",
      cell: (info) => info.getValue().toLocaleString("es-AR"),
    }),
    columnHelper.accessor("discount_percent", {
      header: "Descuento %",
      cell: (info) => info.getValue().toLocaleString("es-AR"),
    }),
    columnHelper.accessor("is_active", {
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
        const method = info.row.original;

        if (!canWrite) {
          return <span className="text-xs text-slate-400">Sin permisos de escritura</span>;
        }

        return (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onEdit(method)} className="ui-btn-ghost px-2 py-1 text-xs">
              Editar
            </button>
            <button
              type="button"
              onClick={() => onToggleActive(method)}
              className="ui-btn-ghost px-2 py-1 text-xs"
            >
              {method.is_active ? "Desactivar" : "Activar"}
            </button>
            <button
              type="button"
              onClick={() => onDelete(method)}
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
    data: paymentMethods,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!paymentMethods.length) {
    return <div className="ui-empty-state">No hay medios de pago cargados.</div>;
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
