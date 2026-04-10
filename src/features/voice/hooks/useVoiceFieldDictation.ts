import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechRecognitionEventLike {
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

interface StartVoiceDictationInput {
  currentValue: string;
  onValueChange: (value: string) => void;
  insertMode?: VoiceDictationInsertMode;
  language?: string;
}

const getSpeechRecognitionConstructor = (): SpeechRecognitionConstructor | null => {
  if (typeof window === "undefined") return null;

  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
};

const buildValueFromTranscript = (
  baseText: string,
  transcript: string,
  mode: VoiceDictationInsertMode
): string => {
  const cleanTranscript = transcript.trim();

  if (!cleanTranscript) {
    return baseText;
  }

  if (mode === "replace") {
    return cleanTranscript;
  }

  const cleanBase = baseText.trim();
  if (!cleanBase) return cleanTranscript;

  return `${cleanBase} ${cleanTranscript}`.trim();
};

export const useVoiceFieldDictation = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseTextRef = useRef("");
  const onValueChangeRef = useRef<((value: string) => void) | null>(null);
  const insertModeRef = useRef<VoiceDictationInsertMode>("append");

  useEffect(() => {
    setIsSupported(Boolean(getSpeechRecognitionConstructor()));
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const stopDictation = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const startDictation = useCallback(
    ({ currentValue, onValueChange, insertMode = "append", language = "es-AR" }: StartVoiceDictationInput) => {
      setError(null);

      const Recognition = getSpeechRecognitionConstructor();
      if (!Recognition) {
        setError("Dictado por voz no disponible en este navegador");
        return;
      }

      recognitionRef.current?.abort();

      baseTextRef.current = currentValue;
      onValueChangeRef.current = onValueChange;
      insertModeRef.current = insertMode;

      const recognition = new Recognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event) => {
        let transcript = "";

        for (let index = 0; index < event.results.length; index += 1) {
          const part = event.results[index]?.[0]?.transcript ?? "";
          transcript += `${part} `;
        }

        const nextValue = buildValueFromTranscript(
          baseTextRef.current,
          transcript,
          insertModeRef.current
        );

        onValueChangeRef.current?.(nextValue);
      };

      recognition.onerror = (event) => {
        const nextError = event.error ? `Error de dictado: ${event.error}` : "Error de dictado";
        setError(nextError);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    },
    []
  );

  return {
    isSupported,
    isRecording,
    error,
    startDictation,
    stopDictation,
    clearError,
  };
};
