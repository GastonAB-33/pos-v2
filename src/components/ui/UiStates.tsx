import { Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";

export interface LoadingStateProps {
  message?: string;
  description?: string;
  variant?: "card" | "inline" | "full" | "overlay";
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const LoadingState = ({
  message = "Cargando información...",
  description,
  variant = "card",
  className,
  size = "md",
}: LoadingStateProps) => {
  if (variant === "inline") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2.5 py-2 px-3 text-xs font-medium text-slate-700 dark:text-slate-200",
          className
        )}
      >
        <Loader2 className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
        <span>{message}</span>
      </div>
    );
  }

  if (variant === "full") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center min-h-[55vh] w-full p-6 text-center select-none",
          className
        )}
      >
        <div className="w-full max-w-md p-8 rounded-3xl border border-slate-200/90 bg-white/95 dark:border-slate-800 dark:bg-slate-900/95 shadow-lg backdrop-blur-xs space-y-4">
          <div className="relative mx-auto flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/80">
            <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
            <div className="absolute -inset-1 rounded-2xl border-2 border-blue-500/20 dark:border-blue-400/20 animate-pulse pointer-events-none" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{message}</h3>
            {description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (variant === "overlay") {
    return (
      <div
        className={cn(
          "absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/85 dark:bg-slate-900/85 backdrop-blur-xs p-4 rounded-2xl sm:rounded-3xl",
          className
        )}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/80 shadow-xs">
            <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
          </div>
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{message}</span>
        </div>
      </div>
    );
  }

  // Variant "card" (default)
  return (
    <div
      className={cn(
        "rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-8 sm:p-12 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900 w-full min-w-0 flex flex-col items-center justify-center space-y-3",
        className
      )}
    >
      <div className="relative flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 shadow-xs">
        <Loader2
          className={cn(
            "text-blue-600 dark:text-blue-400 animate-spin",
            size === "sm" ? "w-5 h-5" : size === "lg" ? "w-8 h-8" : "w-6 h-6 sm:w-7 sm:h-7"
          )}
        />
        <div className="absolute -inset-1 rounded-2xl border-2 border-blue-500/20 dark:border-blue-400/20 animate-pulse pointer-events-none" />
      </div>

      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{message}</p>
        {description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
            {description}
          </p>
        )}
      </div>
    </div>
  );
};

export interface UiStateProps {
  message: string;
}

export const EmptyState = ({ message }: UiStateProps) => {
  return <div className="ui-empty-state">{message}</div>;
};

export const ErrorState = ({ message }: UiStateProps) => {
  return <div className="ui-error-state">{message}</div>;
};
