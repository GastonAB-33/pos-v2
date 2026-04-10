import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

interface PwaContextValue {
  isInstallSupported: boolean;
  canInstall: boolean;
  isInstalled: boolean;
  isInstalling: boolean;
  installApp: () => Promise<boolean>;
}

const PwaContext = createContext<PwaContextValue | undefined>(undefined);

const detectInstalled = (): boolean => {
  if (typeof window === "undefined") return false;

  const displayStandalone = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone =
    "standalone" in window.navigator &&
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);

  return Boolean(displayStandalone || iosStandalone);
};

export const PwaProvider = ({ children }: PropsWithChildren) => {
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(detectInstalled());
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(display-mode: standalone)");

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPromptEvent(null);
    };

    const handleDisplayModeChange = () => {
      setIsInstalled(detectInstalled());
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
    window.addEventListener("appinstalled", handleAppInstalled);
    mediaQuery?.addEventListener?.("change", handleDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
      window.removeEventListener("appinstalled", handleAppInstalled);
      mediaQuery?.removeEventListener?.("change", handleDisplayModeChange);
    };
  }, []);

  const installApp = useCallback(async (): Promise<boolean> => {
    if (!installPromptEvent) return false;

    setIsInstalling(true);

    try {
      await installPromptEvent.prompt();
      const choice = await installPromptEvent.userChoice;
      const accepted = choice.outcome === "accepted";
      if (accepted) {
        setIsInstalled(true);
      }
      setInstallPromptEvent(null);
      return accepted;
    } finally {
      setIsInstalling(false);
    }
  }, [installPromptEvent]);

  const value = useMemo<PwaContextValue>(
    () => ({
      isInstallSupported: typeof window !== "undefined" && "serviceWorker" in navigator,
      canInstall: Boolean(installPromptEvent) && !isInstalled,
      isInstalled,
      isInstalling,
      installApp,
    }),
    [installApp, installPromptEvent, isInstalled, isInstalling]
  );

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
};

export const usePwaContext = (): PwaContextValue => {
  const context = useContext(PwaContext);
  if (!context) {
    throw new Error("usePwaContext must be used within PwaProvider");
  }

  return context;
};
