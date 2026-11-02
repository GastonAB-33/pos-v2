const MAX_SCREENSHOT_WIDTH = 1280;
const MAX_SCREENSHOT_HEIGHT = 800;
const SCREENSHOT_QUALITY = 0.72;

export const compressScreenshotCanvas = (sourceCanvas: HTMLCanvasElement): string => {
  try {
    const origWidth = sourceCanvas.width;
    const origHeight = sourceCanvas.height;

    let targetWidth = origWidth;
    let targetHeight = origHeight;

    if (origWidth > MAX_SCREENSHOT_WIDTH || origHeight > MAX_SCREENSHOT_HEIGHT) {
      const ratio = Math.min(
        MAX_SCREENSHOT_WIDTH / origWidth,
        MAX_SCREENSHOT_HEIGHT / origHeight
      );
      targetWidth = Math.round(origWidth * ratio);
      targetHeight = Math.round(origHeight * ratio);
    }

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = targetWidth;
    tempCanvas.height = targetHeight;

    const ctx = tempCanvas.getContext("2d");
    if (!ctx) {
      return sourceCanvas.toDataURL("image/jpeg", SCREENSHOT_QUALITY);
    }

    ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);

    // Intentar WebP (mucho más liviano), con fallback a JPEG
    const webpUrl = tempCanvas.toDataURL("image/webp", SCREENSHOT_QUALITY);
    if (webpUrl.startsWith("data:image/webp")) {
      return webpUrl;
    }

    return tempCanvas.toDataURL("image/jpeg", SCREENSHOT_QUALITY);
  } catch {
    return sourceCanvas.toDataURL("image/jpeg", SCREENSHOT_QUALITY);
  }
};
