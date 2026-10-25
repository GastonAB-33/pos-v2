import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Barcode, Pencil, Power, Trash2 } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import type { Promotion } from "@/types/entities";
import type { PromotionWithDetails } from "@/services/promotions.service";

interface PromotionsTableProps {
  promotions: PromotionWithDetails[];
  productNameById: Map<string, string>;
  canWrite: boolean;
  onEdit: (promotion: PromotionWithDetails) => void;
  onDelete: (promotion: PromotionWithDetails) => void;
  onToggleActive: (promotion: PromotionWithDetails) => void;
  onBarcode: (promotion: PromotionWithDetails) => void;
}

const columnHelper = createColumnHelper<PromotionWithDetails>();

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const getTypeLabel = (type: Promotion["type"]) => {
  switch (type) {
    case "percentage_discount":
      return "Desc. %";
    case "fixed_discount":
      return "Desc. fijo";
    case "combo_price":
      return "Precio cerrado";
    default:
      return type;
  }
};

const getScopeLabel = (scope: Promotion["scope"]) => {
  if (scope === "product") return "Individual";
  if (scope === "bundle") return "Pack / Combo";
  return "Carrito";
};

const formatDateRange = (startsAt: string | null, endsAt: string | null) => {
  if (!startsAt && !endsAt) return "Permanente";

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

  return `${toLabel(startsAt)} → ${toLabel(endsAt)}`;
};

export const PromotionsTable = ({
  promotions,
  productNameById,
  canWrite,
  onEdit,
  onDelete,
  onToggleActive,
  onBarcode,
}: PromotionsTableProps) => {
  const columns = [
    columnHelper.accessor("name", {
      header: "Promoción",
      cell: (info) => (
        <div>
          <span className="font-bold text-slate-900 dark:text-slate-100 block">
            {info.getValue()}
          </span>
          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
            {info.row.original.code}
          </span>
        </div>
      ),
    }),
    columnHelper.accessor("type", {
      header: "Tipo",
      cell: (info) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
          {getTypeLabel(info.getValue())}
        </span>
      ),
    }),
    columnHelper.accessor("scope", {
      header: "Alcance",
      cell: (info) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
          {getScopeLabel(info.getValue())}
        </span>
      ),
    }),
    columnHelper.display({
      id: "items",
      header: "Artículos incluidos",
      cell: (info) => {
        const promo = info.row.original;
        const items = promo.items ?? [];
        if (items.length > 0) {
          return (
            <div className="text-xs text-slate-800 dark:text-slate-200 max-w-xs">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {items
                  .map((it) => {
                    const name = productNameById.get(it.product_id) ?? "Artículo";
                    return `${it.quantity}x ${name}`;
                  })
                  .join(" + ")}
              </span>
            </div>
          );
        }

        if (promo.product_id) {
          const name = productNameById.get(promo.product_id) ?? "Artículo";
          const qty = promo.min_quantity ?? 1;
          return (
            <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
              {qty}x {name}
            </span>
          );
        }

        return <span className="text-xs text-slate-400">-</span>;
      },
    }),
    columnHelper.display({
      id: "pricing",
      header: "Precio Promo",
      cell: (info) => {
        const promo = info.row.original;
        if (promo.combo_price != null && promo.combo_price > 0) {
          return (
            <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
              {currency.format(promo.combo_price)}
            </span>
          );
        }
        if (promo.discount_percent != null && promo.discount_percent > 0) {
          return (
            <span className="font-bold text-blue-600 dark:text-sky-400">
              -{promo.discount_percent}%
            </span>
          );
        }
        if (promo.discount_amount != null && promo.discount_amount > 0) {
          return (
            <span className="font-bold text-indigo-600 dark:text-indigo-400">
              -{currency.format(promo.discount_amount)}
            </span>
          );
        }
        return <span className="text-xs text-slate-400">-</span>;
      },
    }),
    columnHelper.display({
      id: "validity",
      header: "Vigencia",
      cell: (info) => (
        <span className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
          {formatDateRange(info.row.original.starts_at, info.row.original.ends_at)}
        </span>
      ),
    }),
    columnHelper.accessor("is_active", {
      header: "Estado",
      cell: (info) => {
        const promo = info.row.original;
        const now = Date.now();
        const isExpired =
          Boolean(promo.ends_at) &&
          !Number.isNaN(new Date(promo.ends_at!).getTime()) &&
          new Date(promo.ends_at!).getTime() < now;
        const isScheduled =
          Boolean(promo.starts_at) &&
          !Number.isNaN(new Date(promo.starts_at!).getTime()) &&
          new Date(promo.starts_at!).getTime() > now;

        if (!promo.is_active) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              Inactiva
            </span>
          );
        }

        if (isExpired) {
          return (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
              title="La fecha límite de vigencia ya venció. La promoción se encuentra inhabilitada para el POS."
            >
              Vencida
            </span>
          );
        }

        if (isScheduled) {
          return (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
              title="Promoción programada para iniciar en una fecha futura."
            >
              Programada
            </span>
          );
        }

        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            Activa
          </span>
        );
      },
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
          <div className="flex items-center gap-1.5">
            <IconButton size="sm" icon={Pencil} label="Editar promoción" onClick={() => onEdit(promotion)} />
            <IconButton size="sm" icon={Barcode} label="Generar código de barras" onClick={() => onBarcode(promotion)} />
            <IconButton size="sm" icon={Power} label={promotion.is_active ? "Desactivar promoción" : "Activar promoción"} onClick={() => onToggleActive(promotion)} />
            <IconButton size="sm" icon={Trash2} label="Eliminar promoción" tone="danger" onClick={() => onDelete(promotion)} />
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
    <div className="ui-table-wrap overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-panel">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800/70">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3 text-slate-800 dark:text-slate-200">
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
