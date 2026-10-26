import { useEffect, useMemo, useState } from "react";

interface PaginationResult<T> {
  currentPage: number;
  pageCount: number;
  pageItems: T[];
  pageSize: number;
  startItem: number;
  endItem: number;
  totalItems: number;
  setCurrentPage: (page: number) => void;
}

export const usePagination = <T,>(
  items: T[],
  pageSize = 10,
  resetKey = ""
): PaginationResult<T> => {
  const [currentPage, setCurrentPageState] = useState(1);
  const totalItems = items.length;
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    setCurrentPageState(1);
  }, [resetKey]);

  useEffect(() => {
    setCurrentPageState((page) => Math.min(Math.max(page, 1), pageCount));
  }, [pageCount]);

  const setCurrentPage = (page: number) => {
    setCurrentPageState(Math.min(Math.max(page, 1), pageCount));
  };

  const startIndex = (currentPage - 1) * pageSize;
  const pageItems = useMemo(
    () => items.slice(startIndex, startIndex + pageSize),
    [items, pageSize, startIndex]
  );

  return {
    currentPage,
    pageCount,
    pageItems,
    pageSize,
    startItem: totalItems === 0 ? 0 : startIndex + 1,
    endItem: Math.min(startIndex + pageSize, totalItems),
    totalItems,
    setCurrentPage,
  };
};
