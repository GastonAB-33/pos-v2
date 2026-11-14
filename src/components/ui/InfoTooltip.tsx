import { useState, useRef, useEffect, type ReactNode } from "react";
import { Info, X } from "lucide-react";
import { cn } from "@/utils/cn";

interface InfoTooltipProps {
  title?: string;
  content?: ReactNode;
  children?: ReactNode;
  className?: string;
  panelClassName?: string;
  buttonAriaLabel?: string;
  align?: "start" | "center" | "end";
}

export const InfoTooltip = ({
  title,
  content,
  children,
  className,
  panelClassName,
  buttonAriaLabel = "Más información",
  align = "start",
}: InfoTooltipProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    // Solo hover en pantallas desktop (sm+)
    if (typeof window !== "undefined" && window.innerWidth >= 640) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setIsOpen(true);
      }, 120);
    }
  };

  const handleMouseLeave = () => {
    if (typeof window !== "undefined" && window.innerWidth >= 640) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setIsOpen(false);
      }, 150);
    }
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isOpen]);

  const alignClasses = {
    start: "left-0",
    center: "left-1/2 -translate-x-1/2",
    end: "right-0",
  }[align];

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-flex items-center shrink-0", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        onClick={handleToggleClick}
        aria-label={buttonAriaLabel}
        aria-expanded={isOpen}
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors cursor-pointer shrink-0",
          isOpen && "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
        )}
      >
        <Info size={14} className="shrink-0" />
      </button>

      {isOpen && (
        <>
          {/* ============================================================== */}
          {/* 1. MÓVIL: MODAL CENTRADO EN PANTALLA (NUNCA SE SALE NI SE CORTA) */}
          {/* ============================================================== */}
          <div className="sm:hidden fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in duration-150">
            <div
              className="fixed inset-0"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />
            <div
              role="dialog"
              aria-modal="true"
              className="relative z-10 w-full max-w-sm rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xl dark:border-slate-700/80 dark:bg-slate-900 animate-in zoom-in-95 duration-150 text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-slate-800">
                <h5 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
                  {title ?? "Información del módulo"}
                </h5>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer shrink-0"
                  aria-label="Cerrar tooltip"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="mt-3 text-xs text-slate-600 dark:text-slate-300 space-y-2">
                {content}
                {children}
              </div>

              <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* 2. ESCRITORIO: POPOVER FLOTANTE (hidden sm:block)               */}
          {/* ============================================================== */}
          <div
            role="tooltip"
            className={cn(
              "hidden sm:block absolute z-50 top-full mt-2 w-80 max-w-sm rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xl dark:border-slate-700/80 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-150 text-left",
              alignClasses,
              panelClassName
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
              <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
                {title ?? "Información del módulo"}
              </h5>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer shrink-0"
                aria-label="Cerrar tooltip"
              >
                <X size={12} />
              </button>
            </div>

            <div className="mt-2 text-xs text-slate-600 dark:text-slate-300 space-y-2">
              {content}
              {children}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
