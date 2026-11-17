import { supabase } from "@/lib/supabase/client";
import { isMockDataProvider } from "@/services/config/data-provider";

const SUPPORT_BUCKET =
  (import.meta.env.VITE_SUPABASE_PRODUCT_IMAGES_BUCKET as string | undefined)?.trim() ||
  "product-images";

/**
 * Convierte un DataURL (base64) a un objeto Blob de manera síncrona y segura
 */
export const dataUrlToBlob = (dataUrl: string): Blob => {
  const parts = dataUrl.split(",");
  const mimeMatch = parts[0]?.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/png";
  const binaryStr = atob(parts[1] || "");
  const len = binaryStr.length;
  const u8arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    u8arr[i] = binaryStr.charCodeAt(i);
  }
  return new Blob([u8arr], { type: mime });
};

/**
 * Sube una captura anotada a Supabase Storage y retorna su URL pública accesible
 */
export const uploadSupportScreenshot = async (
  dataUrl: string,
  tenantId: string,
  ticketNumber?: number
): Promise<string | null> => {
  if (!dataUrl) return null;

  if (isMockDataProvider) {
    return null;
  }

  try {
    const blob = dataUrlToBlob(dataUrl);
    const ext = blob.type.includes("webp")
      ? "webp"
      : blob.type.includes("jpeg") || blob.type.includes("jpg")
      ? "jpg"
      : "png";
    const cleanTenant = (tenantId || "general").replace(/[^a-zA-Z0-9_-]/g, "_");
    const num = ticketNumber || Math.floor(1000 + Math.random() * 9000);
    const path = `support-tickets/${cleanTenant}/ticket-${num}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from(SUPPORT_BUCKET).upload(path, blob, {
      contentType: blob.type || "image/png",
      cacheControl: "3600",
      upsert: true,
    });

    if (uploadError) {
      console.warn("No se pudo subir la captura a Supabase Storage:", uploadError);
      return null;
    }

    const { data } = supabase.storage.from(SUPPORT_BUCKET).getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (err) {
    console.warn("Excepción al subir la captura de soporte:", err);
    return null;
  }
};

/**
 * Copia la imagen al portapapeles del sistema (formato PNG nativo) para que
 * el usuario pueda pegarla directamente en WhatsApp con Ctrl + V
 */
export const copyImageToClipboard = async (dataUrl: string): Promise<boolean> => {
  if (typeof window === "undefined" || !navigator?.clipboard || typeof ClipboardItem === "undefined") {
    return false;
  }

  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Error al decodificar la imagen"));
      img.src = dataUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;

    // Fondo blanco por si hay transparencias
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    const pngBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });

    if (!pngBlob) return false;

    await navigator.clipboard.write([
      new ClipboardItem({
        "image/png": pngBlob,
      }),
    ]);

    return true;
  } catch (err) {
    console.warn("No se pudo copiar captura al portapapeles del sistema:", err);
    return false;
  }
};
