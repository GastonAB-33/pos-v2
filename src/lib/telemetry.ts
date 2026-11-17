/**
 * Servicio Centralizado de Telemetría, Monitoreo de Errores y Protección de Privacidad
 * Conforme al Manual de Ciberseguridad y Observabilidad (POS V2 Security Shield)
 */
import { maskSensitiveData } from "@/utils/security-sanitizer";

export interface TelemetryEvent {
  level: "info" | "warning" | "error";
  category: string;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Filtra y ofusca automáticamente datos sensibles dentro de objetos de contexto
 * antes de despacharlos a servicios externos (Sentry / PostHog).
 */
export function sanitizeTelemetryContext(
  context: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!context) return {};

  const sensitiveKeys = [
    "password",
    "pin",
    "token",
    "secret",
    "key",
    "certificate_key",
    "credit_card",
    "card_number",
    "cvv",
    "cuit",
  ];

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(context)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveKeys.some((s) => lowerKey.includes(s));

    if (isSensitive) {
      sanitized[key] = maskSensitiveData(String(value ?? ""));
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeTelemetryContext(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

class TelemetryService {
  private initialized = false;

  public init(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Captura global de errores no controlados en tiempo de ejecución
    if (typeof window !== "undefined") {
      window.addEventListener("error", (event) => {
        this.captureError(event.error || new Error(event.message), {
          source: "window.onerror",
          filename: event.filename,
          lineno: event.lineno,
        });
      });

      window.addEventListener("unhandledrejection", (event) => {
        this.captureError(
          event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
          {
            source: "unhandledrejection",
          }
        );
      });
    }
  }

  public captureError(error: unknown, context?: Record<string, unknown>): void {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    const sanitizedCtx = sanitizeTelemetryContext(context);

    // Registro seguro local (preparado para hook de Sentry / PostHog)
    if (import.meta.env.DEV) {
      console.warn("[Security Shield Telemetry]", {
        message: errorMsg,
        stack,
        context: sanitizedCtx,
        timestamp: new Date().toISOString(),
      });
    }
  }

  public trackEvent(eventName: string, properties?: Record<string, unknown>): void {
    const sanitizedProps = sanitizeTelemetryContext(properties);
    if (import.meta.env.DEV) {
      console.info(`[Security Shield Event] ${eventName}:`, sanitizedProps);
    }
  }
}

export const telemetry = new TelemetryService();
