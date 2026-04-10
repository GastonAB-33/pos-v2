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
    <section className="ui-card">
      <div className="flex flex-wrap gap-2">
        {reportItems.map((item) => {
          const active = item.value === value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm transition",
                active
                  ? "border-brand-500 bg-brand-500/15 text-slate-900"
                  : "border-slate-300 text-slate-600 hover:border-brand-500 hover:text-slate-900"
              )}
            >
              {item.label}{" "}
              <span className="font-kpi text-xs text-slate-500">{counts[item.value]}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
