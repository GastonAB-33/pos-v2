interface PaginationControlsProps {
  currentPage: number;
  pageCount: number;
  startItem: number;
  endItem: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

export const PaginationControls = ({
  currentPage,
  pageCount,
  startItem,
  endItem,
  totalItems,
  onPageChange,
}: PaginationControlsProps) => {
  if (totalItems <= 10) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-2.5 text-xs text-slate-600 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
      <span>
        Mostrando <strong>{startItem}</strong>-<strong>{endItem}</strong> de{" "}
        <strong>{totalItems}</strong>
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 transition-all active:scale-95"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          Anterior
        </button>
        <span className="font-semibold text-slate-700 dark:text-slate-200">
          {currentPage} / {pageCount}
        </span>
        <button
          type="button"
          className="rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 transition-all active:scale-95"
          disabled={currentPage >= pageCount}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
};
