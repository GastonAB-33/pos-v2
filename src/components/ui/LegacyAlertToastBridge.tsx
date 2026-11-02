import { useEffect } from "react";
import { useUiStore, type UiToastType } from "@/store/ui.store";

const resolveToastType = (element: Element): UiToastType => {
  if (element.classList.contains("ui-error-state")) return "error";
  if (element.classList.contains("ui-success-state")) return "success";
  return "info";
};

const hideElement = (element: Element) => {
  if (element instanceof HTMLElement) {
    element.style.display = "none";
  }
};

export const LegacyAlertToastBridge = () => {
  const pushToast = useUiStore((state) => state.pushToast);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const processLegacyAlerts = () => {
      const nodes = document.querySelectorAll(".ui-error-state, .ui-success-state, .ui-info-state");

      nodes.forEach((node) => {
        const message = (node.textContent ?? "").trim();
        if (!message) return;

        const type = resolveToastType(node);
        const key = `${type}:${message}`;
        const previousKey = node.getAttribute("data-toast-bridge-key");
        if (previousKey === key) {
          hideElement(node);
          return;
        }

        pushToast({ type, message });
        node.setAttribute("data-toast-bridge-key", key);
        hideElement(node);
      });
    };

    processLegacyAlerts();

    const observer = new MutationObserver(() => {
      processLegacyAlerts();
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [pushToast]);

  return null;
};
