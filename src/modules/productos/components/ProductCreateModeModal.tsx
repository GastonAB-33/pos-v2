import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface ProductCreateModeModalProps {
  canWrite: boolean;
  loading: boolean;
  onClose: () => void;
  onSelectManual: () => void;
  onSelectPhoto: () => void;
  onSelectVoice: () => void;
}

export const ProductCreateModeModal = ({
  canWrite,
  loading,
  onClose,
  onSelectManual,
  onSelectPhoto,
  onSelectVoice,
}: ProductCreateModeModalProps) => {
  useBodyScrollLock(true);
  return (
    <section className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] p-4">
      <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Nuevo producto</h3>
            <p className="text-xs text-slate-500">Elige como queres cargar el producto</p>
          </div>
          <ModalCloseButton label="Cerrar opciones" onClick={onClose} disabled={loading} />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <button
            type="button"
            onClick={onSelectManual}
            disabled={!canWrite || loading}
            className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-[var(--ui-accent)]"
          >
            <p className="text-sm font-semibold text-slate-900">Carga manual</p>
            <p className="mt-1 text-xs text-slate-500">Formulario tradicional completo</p>
          </button>

          <button
            type="button"
            onClick={onSelectPhoto}
            disabled={!canWrite || loading}
            className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-[var(--ui-accent)]"
          >
            <p className="text-sm font-semibold text-slate-900">Carga con IA (Foto)</p>
            <p className="mt-1 text-xs text-slate-500">Sube una imagen y recibe sugerencias</p>
          </button>

          <button
            type="button"
            onClick={onSelectVoice}
            disabled={!canWrite || loading}
            className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-[var(--ui-accent)]"
          >
            <p className="text-sm font-semibold text-slate-900">Carga con IA (Voz)</p>
            <p className="mt-1 text-xs text-slate-500">Dicta y analiza para completar campos</p>
          </button>
        </div>
      </div>
    </section>
  );
};
