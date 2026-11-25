import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { WhatsAppIcon } from "@/components/brand/WhatsAppIcon";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { cleanPhoneForWhatsApp } from "@/utils/whatsapp-voucher.utils";

interface WhatsAppPhonePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (phone: string) => void;
  title?: string;
  subtitle?: string;
  defaultPhone?: string;
  recipientName?: string | null;
}

export const WhatsAppPhonePromptModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Enviar por WhatsApp",
  subtitle = "Ingresá el celular de destino para abrir el chat con el comprobante precargado.",
  defaultPhone = "",
  recipientName,
}: WhatsAppPhonePromptModalProps) => {
  useBodyScrollLock(isOpen);
  const [phoneInput, setPhoneInput] = useState(defaultPhone);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPhoneInput(defaultPhone);
      setError(null);
      // Autofoco inmediato para agilidad en caja (agile-keyboard-flow)
      window.setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, defaultPhone]);

  // Manejo de teclado: Escape cierra (agile-keyboard-flow)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleaned = cleanPhoneForWhatsApp(phoneInput);
    if (!cleaned || cleaned.length < 8) {
      setError("Ingresá un número de teléfono válido con código de área (mínimo 8 dígitos).");
      inputRef.current?.focus();
      return;
    }
    setError(null);
    onConfirm(cleaned);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wsp-prompt-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-md rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-5 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <WhatsAppIcon className="h-5 w-5 fill-current" />
            </div>
            <div>
              <h2 id="wsp-prompt-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
                {title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {recipientName ? `Destinatario: ${recipientName}` : subtitle}
              </p>
            </div>
          </div>
          <ModalCloseButton onClick={onClose} />
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-1" autoComplete="off">
          <div className="space-y-1.5">
            <label
              htmlFor="wsp-phone-input"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              Número de Celular / WhatsApp
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                id="wsp-phone-input"
                type="tel"
                value={phoneInput}
                onChange={(e) => {
                  setPhoneInput(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Ej: 2664689173 o 1158990011"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 py-2.5 px-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition font-mono"
              />
            </div>
            {error ? (
              <p className="text-xs font-medium text-rose-500">{error}</p>
            ) : (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Podés ingresarlo con o sin 0/15. Se formateará automáticamente con prefijo internacional.
              </p>
            )}
          </div>

          {/* Footer de Acciones */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-md shadow-emerald-600/20 active:scale-95 transition cursor-pointer"
            >
              <Send size={13} />
              <span>Abrir WhatsApp</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
