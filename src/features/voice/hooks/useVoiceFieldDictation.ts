import { useCallback, useEffect, useRef, useState } from "react";
import {
  mergeTranscriptsWithoutOverlap,
  normalizeVoiceInput,
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

const mapVoiceError = (errorKey?: string): string | null => {
  if (!errorKey || errorKey === "aborted") return null;
  switch (errorKey) {
    case "not-allowed":
    case "permission-denied":
      return "Permiso de micrófono denegado. Habilítalo en tu navegador.";
    case "no-speech":
      return "No se detectó audio. Intenta hablar más cerca del micrófono.";
    case "network":
      return "Error de red con el servicio de voz.";
    case "audio-capture":
      return "No se detectó ningún micrófono activo.";
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
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const baseTextRef = useRef("");
  const accumulatedFinalRef = useRef("");
  const onValueChangeRef = useRef<((value: string) => void) | null>(null);
  const insertModeRef = useRef<VoiceDictationInsertMode>("append");
  const fieldTypeRef = useRef<VoiceFieldType>("text");

  useEffect(() => {
    setIsSupported(Boolean(getSpeechRecognitionConstructor()));
  }, []);

  const cleanupAudioAnalyser = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const stopDictation = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // Ignorar si ya estaba detenido
    }
    cleanupAudioAnalyser();
    setIsRecording(false);
    setInterimTranscript("");
  }, [cleanupAudioAnalyser]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {}
      recognitionRef.current = null;
      cleanupAudioAnalyser();
    };
  }, [cleanupAudioAnalyser]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const startAudioAnalyser = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      mediaStreamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateLevel = () => {
        if (!mediaStreamRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i += 1) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalizedLevel = Math.min(100, Math.round((avg / 128) * 100));
        setAudioLevel(normalizedLevel);
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch {
      // Si el usuario deniega getUserMedia o falla, el reconocimiento de voz nativo puede seguir funcionando
    }
  }, []);

  const startDictation = useCallback(
    ({
      currentValue,
      onValueChange,
      insertMode = "append",
      language = "es-AR",
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
      cleanupAudioAnalyser();

      baseTextRef.current = currentValue;
      accumulatedFinalRef.current = "";
      onValueChangeRef.current = onValueChange;
      insertModeRef.current = insertMode;
      fieldTypeRef.current = fieldType;

      const recognition = new Recognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onstart = () => {
        setIsRecording(true);
        startAudioAnalyser();
      };

      recognition.onresult = (event) => {
        let currentInterim = "";

        // Procesar usando event.resultIndex para no volver a calcular viejos fragmentos
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const resultItem = event.results[i];
          const textChunk = resultItem?.[0]?.transcript ?? "";

          if (resultItem?.isFinal) {
            // Unir sin solapamiento para evitar repeticiones provocadas por el motor
            accumulatedFinalRef.current = mergeTranscriptsWithoutOverlap(
              accumulatedFinalRef.current,
              textChunk
            );
          } else {
            currentInterim += `${textChunk} `;
          }
        }

        setInterimTranscript(currentInterim.trim());

        // Normalizar texto consolidado final
        const rawFinal = accumulatedFinalRef.current.trim();
        const rawFull = currentInterim.trim()
          ? mergeTranscriptsWithoutOverlap(rawFinal, currentInterim)
          : rawFinal;

        const { value: normalizedText, isReset } = normalizeVoiceInput(rawFull, {
          fieldType: fieldTypeRef.current,
          autoNumbers: true,
          autoPunctuation: true,
          capitalize: true,
        });

        if (isReset) {
          accumulatedFinalRef.current = "";
          setInterimTranscript("");
          onValueChangeRef.current?.("");
          return;
        }

        // Construir valor con baseText si es modo append
        let finalValue = normalizedText;
        if (insertModeRef.current === "append" && baseTextRef.current.trim()) {
          finalValue = `${baseTextRef.current.trim()} ${normalizedText}`.trim();
        }

        onValueChangeRef.current?.(finalValue);
      };

      recognition.onerror = (event) => {
        const friendly = mapVoiceError(event.error);
        if (friendly) {
          setError(friendly);
        }
        setIsRecording(false);
        cleanupAudioAnalyser();
      };

      recognition.onend = () => {
        setIsRecording(false);
        setInterimTranscript("");
        cleanupAudioAnalyser();

        // En onend consolidar el texto finalizado normalizado
        if (accumulatedFinalRef.current.trim() && onValueChangeRef.current) {
          const { value: finalClean } = normalizeVoiceInput(accumulatedFinalRef.current, {
            fieldType: fieldTypeRef.current,
            autoNumbers: true,
            autoPunctuation: true,
            capitalize: true,
          });

          let finalValue = finalClean;
          if (insertModeRef.current === "append" && baseTextRef.current.trim()) {
            finalValue = `${baseTextRef.current.trim()} ${finalClean}`.trim();
          }
          onValueChangeRef.current(finalValue);
        }
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch (err) {
        setError("No se pudo iniciar el micrófono.");
        setIsRecording(false);
      }
    },
    [cleanupAudioAnalyser, startAudioAnalyser]
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
