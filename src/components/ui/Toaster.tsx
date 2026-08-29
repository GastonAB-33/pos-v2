import { useEffect } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useUiStore, type UiToast } from "@/store/ui.store";

interface ToastItemProps {
  toast: UiToast;
  onClose: (id: string) => void;
}

const ToastItem = ({ toast, onClose }: ToastItemProps) => {
  useEffect(() => {
    // Duración predeterminada mayor: 6s para éxito/info, 8s para errores
    const defaultDuration = toast.type === "error" ? 8000 : 6000;
    const duration = toast.durationMs ?? defaultDuration;

    const timeout = window.setTimeout(() => {
      onClose(toast.id);
    }, duration);

    return () => window.clearTimeout(timeout);
  }, [onClose, toast.durationMs, toast.id, toast.type]);

  const isSuccess = toast.type === "success";
  const isError = toast.type === "error";

  const IconComp = isSuccess ? CheckCircle2 : isError ? AlertTriangle : Info;

  const titleText = isSuccess ? "Operación exitosa" : isError ? "Atención / Error" : "Notificación";

  const cardStyle = isSuccess
    ? "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-100 ring-1 ring-emerald-500/20"
    : isError
      ? "border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/90 dark:text-red-100 ring-1 ring-red-500/20"
      : "border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-800 dark:bg-sky-950/90 dark:text-sky-100 ring-1 ring-sky-500/20";

  const iconStyle = isSuccess
    ? "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60"
    : isError
      ? "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/60"
      : "text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/60";

  const accentBar = isSuccess
    ? "bg-emerald-500"
    : isError
      ? "bg-red-500"
      : "bg-sky-500";

  return (
    <article
      className={`pointer-events-auto relative flex w-full overflow-hidden rounded-xl border p-4 shadow-xl transition-all ${cardStyle}`}
      role="alert"
    >
      {/* Barra lateral de acento de color */}
      <div className={`absolute bottom-0 left-0 top-0 w-1.5 ${accentBar}`} />

      <div className="flex w-full items-start gap-3 pl-1">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconStyle}`}>
          <IconComp size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider opacity-75">{titleText}</p>
          <p className="mt-0.5 text-sm font-semibold leading-snug">{toast.message}</p>
        </div>

        <button
          type="button"
          aria-label="Cerrar notificación"
          className="shrink-0 rounded-md p-1 opacity-60 transition-opacity hover:opacity-100"
          onClick={() => onClose(toast.id)}
        >
          <X size={16} />
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
    <section
      aria-label="Notificaciones del sistema"
      className="pointer-events-none fixed bottom-4 right-4 z-[10000] flex w-full max-w-md flex-col-reverse gap-3"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
      ))}
    </section>
  );
};
