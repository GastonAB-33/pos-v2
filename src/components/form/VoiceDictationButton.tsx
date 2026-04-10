import { useEffect } from "react";
import {
  useVoiceFieldDictation,
  type VoiceDictationInsertMode,
} from "@/features/voice/hooks/useVoiceFieldDictation";

interface VoiceDictationButtonProps {
  value: string;
  onValueChange: (nextValue: string) => void;
  disabled?: boolean;
  insertMode?: VoiceDictationInsertMode;
  label?: string;
  className?: string;
}

export const VoiceDictationButton = ({
  value,
  onValueChange,
  disabled,
  insertMode = "append",
  label = "Dictado por voz",
  className,
}: VoiceDictationButtonProps) => {
  const { isSupported, isRecording, error, startDictation, stopDictation, clearError } =
    useVoiceFieldDictation();

  useEffect(() => {
    if (!disabled) return;
    if (!isRecording) return;
    stopDictation();
  }, [disabled, isRecording, stopDictation]);

  const handleToggle = () => {
    clearError();

    if (isRecording) {
      stopDictation();
      return;
    }

    startDictation({
      currentValue: value,
      onValueChange,
      insertMode,
    });
  };

  return (
    <div className={["inline-flex items-center gap-2", className ?? ""].join(" ")}>
      <button
        type="button"
        onClick={handleToggle}
        className={[
          "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs",
          isRecording
            ? "border-amber-300 bg-amber-50 text-amber-700"
            : "border-slate-300 bg-white text-slate-600",
        ].join(" ")}
        disabled={disabled || !isSupported}
        aria-label={label}
        title={!isSupported ? "Dictado no soportado" : label}
      >
        <span aria-hidden="true" className="inline-flex">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" focusable="false">
            <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Z" />
            <path d="M6 11a1 1 0 1 1 2 0 4 4 0 1 0 8 0 1 1 0 1 1 2 0 6 6 0 0 1-5 5.92V20h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-3.08A6 6 0 0 1 6 11Z" />
          </svg>
        </span>
        <span>{isRecording ? "Detener" : "Dictar"}</span>
      </button>

      {isRecording ? <span className="text-xs text-amber-700">Grabando...</span> : null}
      {!isSupported ? <span className="text-xs text-slate-500">Voz no disponible</span> : null}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
};
