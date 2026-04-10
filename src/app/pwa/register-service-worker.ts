const shouldRegisterServiceWorker = (): boolean => {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;

  if (import.meta.env.PROD) return true;

  return import.meta.env.VITE_PWA_ENABLE_DEV === "true";
};

export const registerServiceWorker = (): void => {
  if (!shouldRegisterServiceWorker()) return;

  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register("/service-worker.js", { scope: "/" })
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener("statechange", () => {
            if (installingWorker.state !== "installed") return;
            if (!navigator.serviceWorker.controller) return;

            installingWorker.postMessage({ type: "SKIP_WAITING" });
          });
        });
      })
      .catch(() => {
        // No rompemos el boot de la app si falla el SW.
      });
  });
};
