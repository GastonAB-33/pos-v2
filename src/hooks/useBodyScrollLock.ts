import { useEffect } from "react";

let lockCount = 0;
let preservedScrollY = 0;
let originalBodyStyles: {
  overflow: string;
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  overscrollBehavior: string;
} | null = null;
let originalHtmlStyles: {
  overflow: string;
  overscrollBehavior: string;
} | null = null;

export const useBodyScrollLock = (locked: boolean) => {
  useEffect(() => {
    if (!locked) return;

    if (lockCount === 0) {
      preservedScrollY =
        window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;

      originalBodyStyles = {
        overflow: document.body.style.overflow,
        position: document.body.style.position,
        top: document.body.style.top,
        left: document.body.style.left,
        right: document.body.style.right,
        width: document.body.style.width,
        overscrollBehavior: document.body.style.overscrollBehavior,
      };

      originalHtmlStyles = {
        overflow: document.documentElement.style.overflow,
        overscrollBehavior: document.documentElement.style.overscrollBehavior,
      };

      // Bloquear scroll de la página raíz tanto en html como en body
      document.documentElement.style.overflow = "hidden";
      document.documentElement.style.overscrollBehavior = "none";
      document.documentElement.classList.add("modal-open");

      document.body.style.overflow = "hidden";
      document.body.style.overscrollBehavior = "none";
      document.body.style.position = "fixed";
      document.body.style.top = `-${preservedScrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
      document.body.classList.add("modal-open");
    }

    lockCount++;

    return () => {
      lockCount = Math.max(0, lockCount - 1);

      if (lockCount === 0) {
        if (originalHtmlStyles) {
          document.documentElement.style.overflow = originalHtmlStyles.overflow;
          document.documentElement.style.overscrollBehavior = originalHtmlStyles.overscrollBehavior;
          document.documentElement.classList.remove("modal-open");
          originalHtmlStyles = null;
        }

        if (originalBodyStyles) {
          document.body.style.overflow = originalBodyStyles.overflow;
          document.body.style.overscrollBehavior = originalBodyStyles.overscrollBehavior;
          document.body.style.position = originalBodyStyles.position;
          document.body.style.top = originalBodyStyles.top;
          document.body.style.left = originalBodyStyles.left;
          document.body.style.right = originalBodyStyles.right;
          document.body.style.width = originalBodyStyles.width;
          document.body.classList.remove("modal-open");
          originalBodyStyles = null;
        }

        window.scrollTo(0, preservedScrollY);
      }
    };
  }, [locked]);
};

