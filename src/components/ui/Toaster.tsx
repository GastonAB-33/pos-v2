import { useEffect } from "react";
import { useUiStore, type UiToast } from "@/store/ui.store";

interface ToastItemProps {
  toast: UiToast;
  onClose: (id: string) => void;
}

const ToastItem = ({ toast, onClose }: ToastItemProps) => {
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      onClose(toast.id);
    }, toast.durationMs ?? 3200);

    return () => window.clearTimeout(timeout);
  }, [onClose, toast.durationMs, toast.id]);

  const variantClass =
    toast.type === "success"
      ? "border-emerald-300/60 bg-emerald-500/10 text-emerald-200"
      : toast.type === "error"
        ? "border-red-300/60 bg-red-500/10 text-red-200"
        : "border-brand-300/60 bg-brand-500/10 text-brand-100";

  return (
    <article className={`pointer-events-auto w-full rounded-xl border px-3 py-2 shadow-panel ${variantClass}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm">{toast.message}</p>
        <button
          type="button"
          className="text-xs font-semibold text-slate-500 hover:text-slate-900"
          onClick={() => onClose(toast.id)}
        >
          Cerrar
        </button>
      </div>
    </article>
  );
};

export const Toaster = () => {
  const toasts = useUiStore((state) => state.toasts);
  const removeToast = useUiStore((state) => state.removeToast);

  if (!toasts.length) return null;

  return (
    <section className="pointer-events-none fixed right-4 top-4 z-[1000] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
      ))}
    </section>
  );
};
