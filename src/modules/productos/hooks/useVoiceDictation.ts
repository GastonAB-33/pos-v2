import { useCallback, useEffect, useRef, useState } from "react";
import {
  mergeTranscriptsWithoutOverlap,
  normalizeVoiceInput,
} from "@/features/voice/utils/voice-normalizer";

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

const getSpeechRecognitionConstructor = (): SpeechRecognitionConstructor | null => {
  if (typeof window === "undefined") return null;

  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
};

export const useVoiceDictation = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const accumulatedFinalRef = useRef("");

  useEffect(() => {
    setIsSupported(Boolean(getSpeechRecognitionConstructor()));
  }, []);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {}
      recognitionRef.current = null;
    };
  }, []);

  const startRecording = useCallback(() => {
    setError(null);
    setInterimText("");
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      setError("El navegador no soporta dictado por voz.");
      return;
    }

    try {
      recognitionRef.current?.abort();
    } catch {}

    accumulatedFinalRef.current = "";

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "es-AR";

    recognition.onstart = () => setIsRecording(true);

    recognition.onresult = (event) => {
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const item = event.results[i];
        const text = item?.[0]?.transcript ?? "";

        if (item?.isFinal) {
          accumulatedFinalRef.current = mergeTranscriptsWithoutOverlap(
            accumulatedFinalRef.current,
            text
          );
        } else {
          interim += `${text} `;
        }
      }

      setInterimText(interim.trim());

      const rawFinal = accumulatedFinalRef.current.trim();
      const combined = interim.trim()
        ? mergeTranscriptsWithoutOverlap(rawFinal, interim)
        : rawFinal;

      const { value: normalized } = normalizeVoiceInput(combined, {
        autoNumbers: true,
        autoPunctuation: true,
        capitalize: true,
      });

      setTranscript(normalized);
    };

    recognition.onerror = (event) => {
      if (event.error && event.error !== "aborted") {
        setError(`Error de dictado: ${event.error}`);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      setInterimText("");
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setError("No se pudo iniciar el dictado por voz.");
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {}
    setIsRecording(false);
  }, []);

  const clearRecording = useCallback(() => {
    try {
      recognitionRef.current?.abort();
    } catch {}
    recognitionRef.current = null;
    setIsRecording(false);
    setError(null);
    setTranscript("");
    setInterimText("");
    accumulatedFinalRef.current = "";
  }, []);

  return {
    isSupported,
    isRecording,
    transcript,
    interimText,
    error,
    setTranscript,
    setError,
    startRecording,
    stopRecording,
    clearRecording,
  };
};
