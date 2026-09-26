import React from "react";
import ReactDOM from "react-dom/client";
import { registerServiceWorker } from "@/app/pwa/register-service-worker";
import { AppErrorBoundary } from "@/app/providers/AppErrorBoundary";
import { AppProviders } from "@/app/providers/AppProviders";
import { AppRouter } from "@/app/router/AppRouter";
import "@/styles.css";

// Deshabilitar que la rueda del mouse modifique valores en inputs numéricos en todo el sistema
if (typeof window !== "undefined") {
  window.addEventListener(
    "wheel",
    (event) => {
      const activeEl = document.activeElement;
      if (activeEl instanceof HTMLInputElement && activeEl.type === "number") {
        activeEl.blur();
      }
      if (event.target instanceof HTMLInputElement && event.target.type === "number") {
        event.target.blur();
      }
    },
    { passive: true, capture: true }
  );
}

registerServiceWorker();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </AppErrorBoundary>
  </React.StrictMode>
);
