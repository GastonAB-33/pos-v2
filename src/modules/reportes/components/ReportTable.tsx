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
    <div className="ui-table-wrap">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                className={`px-3 py-2 font-medium text-slate-700 ${getAlignClass(column.align)}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {rows.map((row) => (
            <tr key={getRowId(row)}>
              {columns.map((column) => (
                <td
                  key={column.id}
                  className={`px-3 py-2 align-top text-slate-700 ${getAlignClass(column.align)}`}
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
