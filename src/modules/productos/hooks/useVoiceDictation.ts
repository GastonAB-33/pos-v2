import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeVoiceInput } from "@/features/voice/utils/voice-normalizer";

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

const getSpeechRecognitionConstructor = (): SpeechRecognitionConstructor | null => {
  if (typeof window === "undefined") return null;

  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
};

const resolveSpanishLanguage = (): string => {
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
      return "Permiso de micrófono denegado. Habilita el acceso en el navegador.";
    case "no-speech":
      return "No se detectó audio. Habla claro y cerca del micrófono.";
    case "network":
      return "Error de conexión con el servicio de voz de Google. Revisa tu internet.";
    case "audio-capture":
      return "No se detectó ningún micrófono activo.";
    default:
      return `Error de dictado: ${errorKey}`;
  }
};

export const useVoiceDictation = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const latestRawTranscriptRef = useRef("");

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

  const commitTranscript = useCallback(() => {
    const raw = latestRawTranscriptRef.current.trim();
    if (!raw) return;

    const { value: normalized } = normalizeVoiceInput(raw, {
      autoNumbers: true,
      autoPunctuation: true,
      capitalize: true,
    });
    setTranscript(normalized);
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

    latestRawTranscriptRef.current = "";

    const recognition = new Recognition();
    try {
      recognition.continuous = true;
    } catch {
      recognition.continuous = false;
    }
    recognition.interimResults = true;
    try {
      recognition.maxAlternatives = 1;
    } catch {}
    recognition.lang = resolveSpanishLanguage();

    recognition.onstart = () => setIsRecording(true);

    recognition.onresult = (event) => {
      let currentFinal = "";
      let currentInterim = "";

      for (let i = 0; i < event.results.length; i += 1) {
        const item = event.results[i];
        const text = item?.[0]?.transcript ?? "";
        if (item?.isFinal) {
          currentFinal += `${text} `;
        } else {
          currentInterim += `${text} `;
        }
      }

      setInterimText(currentInterim.trim() || currentFinal.trim());

      const rawFull = `${currentFinal} ${currentInterim}`.trim();
      if (!rawFull) return;

      latestRawTranscriptRef.current = rawFull;

      const { value: normalized } = normalizeVoiceInput(rawFull, {
        autoNumbers: true,
        autoPunctuation: true,
        capitalize: true,
      });

      setTranscript(normalized);
    };

    recognition.onerror = (event) => {
      const friendly = mapVoiceError(event.error);
      if (friendly) {
        setError(friendly);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      commitTranscript();
      setIsRecording(false);
      setInterimText("");
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setError("No se pudo iniciar el dictado por voz. Revisa los permisos.");
      setIsRecording(false);
    }
  }, [commitTranscript]);

  const stopRecording = useCallback(() => {
    commitTranscript();
    try {
      recognitionRef.current?.stop();
    } catch {}
    setIsRecording(false);
  }, [commitTranscript]);

  const clearRecording = useCallback(() => {
    try {
      recognitionRef.current?.abort();
    } catch {}
    recognitionRef.current = null;
    latestRawTranscriptRef.current = "";
    setIsRecording(false);
    setError(null);
    setTranscript("");
    setInterimText("");
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
