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
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
      <span>
        Mostrando <strong>{startItem}</strong>-<strong>{endItem}</strong> de{" "}
        <strong>{totalItems}</strong>
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="ui-btn-ghost px-2 py-1 text-xs disabled:opacity-50"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          Anterior
        </button>
        <span className="font-medium text-slate-700">
          {currentPage} / {pageCount}
        </span>
        <button
          type="button"
          className="ui-btn-ghost px-2 py-1 text-xs disabled:opacity-50"
          disabled={currentPage >= pageCount}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
};
