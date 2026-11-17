import { Search, X } from "lucide-react";

interface PaymentMethodsToolbarProps {
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onReload: () => void;
}

export const PaymentMethodsToolbar = ({
  search,
  onSearchChange,
}: PaymentMethodsToolbarProps) => {
  return (
    <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-1 min-w-0 items-center gap-2.5 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2 shadow-2xs focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-700/80 dark:bg-slate-800/40 dark:focus-within:bg-slate-900 transition-all">
        <Search className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
        <input
          className="flex-1 min-w-0 border-0 bg-transparent px-1 py-0.5 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar medio de pago por nombre, código o tipo..."
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 rounded-full cursor-pointer"
          >
            <X size={15} />
          </button>
        )}
      </div>
    </div>
  );
};