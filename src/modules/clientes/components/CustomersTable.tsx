import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Pencil, Power, Trash2, WalletCards } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
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
  const columns = [
    columnHelper.accessor("full_name", {
      header: "Nombre",
      cell: (info) => <span className="font-medium text-slate-900">{info.getValue()}</span>,
    }),
    columnHelper.display({
      id: "document",
      header: "Documento",
      cell: (info) => {
        const row = info.row.original;
        return `${row.document_type.toUpperCase()} ${row.document_number}`;
      },
    }),
    columnHelper.accessor("phone", {
      header: "Telefono",
      cell: (info) => info.getValue() ?? "-",
    }),
    columnHelper.accessor("email", {
      header: "Email",
      cell: (info) => info.getValue() ?? "-",
    }),
    columnHelper.accessor("current_balance", {
      header: "Saldo Cta Cte",
      cell: (info) => currency.format(info.getValue()),
    }),
    columnHelper.display({
      id: "price_list",
      header: "Lista precios",
      cell: (info) => {
        const priceListId = info.row.original.price_list_id;
        if (!priceListId) return "Base";
        return priceListNameById.get(priceListId) ?? "Lista no encontrada";
      },
    }),
    columnHelper.accessor("is_active", {
      header: "Estado",
      cell: (info) =>
        info.getValue() ? (
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">Activo</span>
        ) : (
          <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700">Inactivo</span>
        ),
    }),
    columnHelper.display({
      id: "actions",
      header: "Acciones",
      cell: (info) => {
        const row = info.row.original;

        return (
          <div className="flex items-center gap-2">
            <IconButton size="sm" icon={WalletCards} label="Ver cuenta corriente" onClick={() => onViewCurrentAccount(row)} />

            {canWrite ? (
              <>
                <IconButton size="sm" icon={Pencil} label="Editar cliente" onClick={() => onEdit(row)} />
                <IconButton size="sm" icon={Power} label={row.is_active ? "Desactivar cliente" : "Activar cliente"} onClick={() => onToggleActive(row)} />
                <IconButton size="sm" icon={Trash2} label="Eliminar cliente" tone="danger" onClick={() => onDelete(row)} />
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
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
        No hay clientes cargados.
      </div>
    );
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
