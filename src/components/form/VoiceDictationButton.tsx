import { useEffect, useState } from "react";
import { Mic, MicOff, Volume2, AlertCircle } from "lucide-react";
import {
  useVoiceFieldDictation,
  type VoiceDictationInsertMode,
} from "@/features/voice/hooks/useVoiceFieldDictation";
import type { VoiceFieldType } from "@/features/voice/utils/voice-normalizer";

interface VoiceDictationButtonProps {
  value: string;
  onValueChange: (nextValue: string) => void;
  disabled?: boolean;
  insertMode?: VoiceDictationInsertMode;
  fieldType?: VoiceFieldType;
  label?: string;
  className?: string;
}

export const VoiceDictationButton = ({
  value,
  onValueChange,
  disabled,
  insertMode = "append",
  fieldType = "text",
  label = "Dictado por voz",
  className,
}: VoiceDictationButtonProps) => {
  const {
    isSupported,
    isRecording,
    interimTranscript,
    audioLevel,
    error,
    startDictation,
    stopDictation,
    clearError,
  } = useVoiceFieldDictation();

  const [showLiveTooltip, setShowLiveTooltip] = useState(false);

  useEffect(() => {
    if (!disabled) return;
    if (!isRecording) return;
    stopDictation();
  }, [disabled, isRecording, stopDictation]);

  useEffect(() => {
    if (isRecording) {
      setShowLiveTooltip(true);
    } else {
      const timer = setTimeout(() => setShowLiveTooltip(false), 800);
      return () => clearTimeout(timer);
    }
  }, [isRecording]);

  const handleStart = () => {
    clearError();
    startDictation({
      currentValue: value,
      onValueChange,
      insertMode,
      fieldType,
    });
  };

  const handleToggle = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (disabled || !isSupported) return;
    if (isRecording) {
      stopDictation();
    } else {
      handleStart();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") {
      handleToggle(e);
    }
  };

  return (
    <div className={["relative inline-flex items-center gap-1.5", className ?? ""].join(" ")}>
      <button
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={[
          "group relative inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-all select-none focus:outline-none focus:ring-2 focus:ring-blue-500/30",
          isRecording
            ? "border-red-400 bg-red-50 text-red-700 shadow-sm animate-pulse dark:border-red-600 dark:bg-red-950/40 dark:text-red-300"
            : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800",
          disabled || !isSupported ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        ].join(" ")}
        disabled={disabled || !isSupported}
        aria-label={label}
        aria-pressed={isRecording}
        title={
          !isSupported
            ? "Dictado por voz no disponible en este navegador"
            : isRecording
            ? "Pulsar para detener dictado"
            : "Pulsar para dictar con voz"
        }
      >
        {isRecording ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600 dark:bg-red-500"></span>
            </span>

            {/* Ecualizador / barras de sonido reactivas */}
            <span className="flex items-center gap-0.5 px-0.5">
              <span
                className="h-2 w-0.5 rounded-full bg-red-500 dark:bg-red-400 transition-all duration-75"
                style={{ height: `${Math.max(4, Math.min(14, (audioLevel / 100) * 16))}px` }}
              />
              <span
                className="h-3 w-0.5 rounded-full bg-red-600 dark:bg-red-400 transition-all duration-75"
                style={{ height: `${Math.max(6, Math.min(16, (audioLevel / 100) * 22))}px` }}
              />
              <span
                className="h-2 w-0.5 rounded-full bg-red-500 dark:bg-red-400 transition-all duration-75"
                style={{ height: `${Math.max(4, Math.min(14, (audioLevel / 100) * 16))}px` }}
              />
            </span>
            <span className="font-semibold">Detener</span>
          </>
        ) : (
          <>
            <Mic className="h-3.5 w-3.5 text-slate-500 group-hover:text-blue-600 dark:text-slate-400 dark:group-hover:text-blue-400 transition-colors" />
            <span>Dictar</span>
          </>
        )}
      </button>

      {/* Floating Live Transcript / Status Popover */}
      {showLiveTooltip && (
        <div
          role="status"
          aria-live="polite"
          className="absolute left-0 bottom-full mb-1.5 z-50 min-w-[220px] max-w-[320px] rounded-lg border border-slate-200 bg-white p-2.5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
              </span>
              <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                {isRecording ? "Escuchando..." : "Finalizado"}
              </span>
            </div>
            <Volume2 className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
          </div>

          <div className="mt-1.5">
            {interimTranscript ? (
              <p className="text-xs italic text-slate-600 dark:text-slate-300 break-words font-sans">
                "{interimTranscript}"
              </p>
            ) : (
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Habla con naturalidad o mantén presionado...
              </p>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-1 text-[10px] text-slate-400 dark:border-slate-800 dark:text-slate-500">
            <span>Di "borrar todo" para limpiar</span>
            <button
              type="button"
              onClick={() => stopDictation()}
              className="text-blue-600 hover:underline dark:text-blue-400 font-medium"
            >
              Listo
            </button>
          </div>
        </div>
      )}

      {/* Indicadores de error y compatibilidad */}
      {!isSupported && (
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
          <MicOff className="h-3 w-3" />
          No soportado
        </span>
      )}

      {error && (
        <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-medium">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {error}
        </span>
      )}
    </div>
  );
};
