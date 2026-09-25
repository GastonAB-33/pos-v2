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
    ? "ui-toast-card--success"
    : isError
      ? "ui-toast-card--error"
      : "ui-toast-card--info";

  const iconStyle = isSuccess
    ? "ui-toast-icon--success"
    : isError
      ? "ui-toast-icon--error"
      : "ui-toast-icon--info";

  const accentBar = isSuccess
    ? "bg-emerald-500"
    : isError
      ? "bg-red-500"
      : "bg-sky-500";

  return (
    <article
      className={`ui-toast-card pointer-events-auto relative flex w-full overflow-hidden rounded-xl border p-4 transition-all ${cardStyle}`}
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
