import type { ReportType } from "@/modules/reportes/hooks/useReportsModule";
import { cn } from "@/utils/cn";

interface ReportTypeTabsProps {
  value: ReportType;
  counts: Record<ReportType, number>;
  onChange: (next: ReportType) => void;
}

const reportItems: Array<{ value: ReportType; label: string }> = [
  { value: "ventas", label: "Ventas" },
  { value: "caja", label: "Caja" },
  { value: "stock", label: "Stock" },
  { value: "deudores", label: "Deudores" },
  { value: "compras", label: "Compras" },
];

export const ReportTypeTabs = ({ value, counts, onChange }: ReportTypeTabsProps) => {
  return (
    <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-1.5 sm:p-2 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {reportItems.map((item) => {
          const active = item.value === value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl sm:rounded-2xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer",
                active
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/25 active:scale-95"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-slate-100"
              )}
            >
              <span>{item.label}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-bold font-mono transition-colors",
                  active
                    ? "bg-white/25 text-white"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                )}
              >
                {counts[item.value] ?? 0}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};