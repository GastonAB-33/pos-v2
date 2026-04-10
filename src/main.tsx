import React from "react";
import ReactDOM from "react-dom/client";
import { registerServiceWorker } from "@/app/pwa/register-service-worker";
import { AppErrorBoundary } from "@/app/providers/AppErrorBoundary";
import { AppProviders } from "@/app/providers/AppProviders";
import { AppRouter } from "@/app/router/AppRouter";
import "@/styles.css";

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
