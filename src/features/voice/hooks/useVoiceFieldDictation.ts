import { useCallback, useEffect, useRef, useState } from "react";
import {
  normalizeVoiceInput,
  mergeTranscriptsWithoutOverlap,
  deduplicateRepeatedPhrases,
  type VoiceFieldType,
} from "../utils/voice-normalizer";

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      length: number;
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export type VoiceDictationInsertMode = "append" | "replace";

export interface StartVoiceDictationInput {
  currentValue: string;
  onValueChange: (value: string) => void;
  insertMode?: VoiceDictationInsertMode;
  language?: string;
  fieldType?: VoiceFieldType;
}

const getSpeechRecognitionConstructor = (): SpeechRecognitionConstructor | null => {
  if (typeof window === "undefined") return null;

  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
};

const resolveSpanishLanguage = (requested?: string): string => {
  if (requested) return requested;
  if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("es")) {
    return navigator.language;
  }
  return "es-AR";
};

const mapVoiceError = (errorKey?: string): string | null => {
  if (!errorKey || errorKey === "aborted") return null;
  switch (errorKey) {
    case "not-allowed":
    case "permission-denied":
      return "Permiso de micrófono denegado. Habilita el acceso en el candado de la barra del navegador.";
    case "no-speech":
      return "No se detectó audio. Habla claro y cerca del micrófono.";
    case "network":
      return "Error de red con el servicio de voz. Revisa tu conexión a internet.";
    case "audio-capture":
      return "No se detectó ningún micrófono activo.";
    case "service-not-allowed":
      return "Servicio de voz no permitido por el navegador.";
    default:
      return `Error de dictado: ${errorKey}`;
  }
};

export const useVoiceFieldDictation = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const animIntervalRef = useRef<number | null>(null);

  const baseTextRef = useRef("");
  const latestRawTranscriptRef = useRef("");
  const onValueChangeRef = useRef<((value: string) => void) | null>(null);
  const insertModeRef = useRef<VoiceDictationInsertMode>("append");
  const fieldTypeRef = useRef<VoiceFieldType>("text");
  const isRecordingRef = useRef(false);

  useEffect(() => {
    setIsSupported(Boolean(getSpeechRecognitionConstructor()));
  }, []);

  const stopAnimation = useCallback(() => {
    if (animIntervalRef.current) {
      window.clearInterval(animIntervalRef.current);
      animIntervalRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const startAnimation = useCallback(() => {
    stopAnimation();
    // Simular visualmente ondas de sonido activas sin bloquear ni pedir hardware MediaStream extra
    animIntervalRef.current = window.setInterval(() => {
      const level = Math.floor(Math.random() * 55) + 30; // 30% a 85%
      setAudioLevel(level);
    }, 120);
  }, [stopAnimation]);

  const commitCurrentTranscript = useCallback(() => {
    const rawToCommit = latestRawTranscriptRef.current.trim();
    if (!rawToCommit || !onValueChangeRef.current) return;

    const { value: normalizedText, isReset } = normalizeVoiceInput(rawToCommit, {
      fieldType: fieldTypeRef.current,
      autoNumbers: true,
      autoPunctuation: true,
      capitalize: true,
    });

    if (isReset) {
      latestRawTranscriptRef.current = "";
      onValueChangeRef.current("");
      return;
    }

    let finalValue = normalizedText;
    if (insertModeRef.current === "append" && baseTextRef.current.trim()) {
      finalValue = mergeTranscriptsWithoutOverlap(baseTextRef.current.trim(), normalizedText);
    }

    onValueChangeRef.current(finalValue);
  }, []);

  const stopDictation = useCallback(() => {
    isRecordingRef.current = false;
    stopAnimation();
    setIsRecording(false);
    setInterimTranscript("");

    // Asegurar que lo dictado hasta el momento de pulsar detener se consolide
    commitCurrentTranscript();

    try {
      recognitionRef.current?.stop();
    } catch {
      // Ignorar si ya estaba detenido
    }
  }, [stopAnimation, commitCurrentTranscript]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {}
      recognitionRef.current = null;
      stopAnimation();
    };
  }, [stopAnimation]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const startDictation = useCallback(
    ({
      currentValue,
      onValueChange,
      insertMode = "append",
      language,
      fieldType = "text",
    }: StartVoiceDictationInput) => {
      setError(null);
      setInterimTranscript("");

      const Recognition = getSpeechRecognitionConstructor();
      if (!Recognition) {
        setError("Dictado por voz no disponible en este navegador");
        return;
      }

      // Detener sesión previa
      try {
        recognitionRef.current?.abort();
      } catch {}

      baseTextRef.current = currentValue;
      latestRawTranscriptRef.current = "";
      onValueChangeRef.current = onValueChange;
      insertModeRef.current = insertMode;
      fieldTypeRef.current = fieldType;

      const recognition = new Recognition();

      // Compatibilidad con iOS Safari y Android
      try {
        recognition.continuous = true;
      } catch {
        recognition.continuous = false;
      }
      recognition.interimResults = true;
      try {
        recognition.maxAlternatives = 1;
      } catch {}
      recognition.lang = resolveSpanishLanguage(language);

      recognition.onstart = () => {
        isRecordingRef.current = true;
        setIsRecording(true);
        startAnimation();
      };

      recognition.onresult = (event) => {
        let currentFinal = "";
        let currentInterim = "";

        // Inspeccionar y fusionar resultados del evento evitando solapamientos entre chunks
        for (let i = 0; i < event.results.length; i += 1) {
          const item = event.results[i];
          const textChunk = (item?.[0]?.transcript ?? "").trim();
          if (!textChunk) continue;

          if (item?.isFinal) {
            currentFinal = mergeTranscriptsWithoutOverlap(currentFinal, textChunk);
          } else {
            currentInterim = mergeTranscriptsWithoutOverlap(currentInterim, textChunk);
          }
        }

        const combinedRaw = currentInterim
          ? mergeTranscriptsWithoutOverlap(currentFinal, currentInterim)
          : currentFinal;

        const fullRaw = deduplicateRepeatedPhrases(combinedRaw.trim());
        if (!fullRaw) return;

        latestRawTranscriptRef.current = fullRaw;
        setInterimTranscript(currentInterim || currentFinal);

        const { value: normalizedText, isReset } = normalizeVoiceInput(fullRaw, {
          fieldType: fieldTypeRef.current,
          autoNumbers: true,
          autoPunctuation: true,
          capitalize: true,
        });

        if (isReset) {
          latestRawTranscriptRef.current = "";
          setInterimTranscript("");
          onValueChangeRef.current?.("");
          return;
        }

        let finalValue = normalizedText;
        if (insertModeRef.current === "append" && baseTextRef.current.trim()) {
          finalValue = mergeTranscriptsWithoutOverlap(baseTextRef.current.trim(), normalizedText);
        }

        onValueChangeRef.current?.(finalValue);
      };

      recognition.onerror = (event) => {
        const friendly = mapVoiceError(event.error);
        if (friendly) {
          setError(friendly);
        }
        isRecordingRef.current = false;
        setIsRecording(false);
        stopAnimation();
      };

      recognition.onend = () => {
        // Al terminar, consolidar lo último capturado
        commitCurrentTranscript();

        isRecordingRef.current = false;
        setIsRecording(false);
        setInterimTranscript("");
        stopAnimation();
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch (err) {
        console.error("[VoiceDictation] Error starting recognition:", err);
        setError("No se pudo iniciar el micrófono. Revisa los permisos.");
        setIsRecording(false);
        stopAnimation();
      }
    },
    [startAnimation, stopAnimation, commitCurrentTranscript]
  );

  return {
    isSupported,
    isRecording,
    interimTranscript,
    audioLevel,
    error,
    startDictation,
    stopDictation,
    clearError,
  };
};
