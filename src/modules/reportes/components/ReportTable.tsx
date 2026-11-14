import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/UiStates";

export interface ReportTableColumn<TRow> {
  id: string;
  header: string;
  cell: (row: TRow) => ReactNode;
  align?: "left" | "right" | "center";
}

interface ReportTableProps<TRow> {
  rows: TRow[];
  columns: ReportTableColumn<TRow>[];
  getRowId: (row: TRow) => string;
  emptyMessage: string;
}

const getAlignClass = (align: ReportTableColumn<unknown>["align"]) => {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
};

export const ReportTable = <TRow,>({
  rows,
  columns,
  getRowId,
  emptyMessage,
}: ReportTableProps<TRow>) => {
  if (!rows.length) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <div className="ui-table-wrap rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50/90 dark:bg-slate-800/70 border-b border-slate-200/80 dark:border-slate-800">
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                className={`px-3.5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200 ${getAlignClass(
                  column.align
                )}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
          {rows.map((row) => (
            <tr key={getRowId(row)} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
              {columns.map((column) => (
                <td
                  key={column.id}
                  className={`px-3.5 py-3 align-top text-slate-700 dark:text-slate-200 ${getAlignClass(column.align)}`}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};