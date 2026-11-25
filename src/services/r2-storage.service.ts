import { supabase } from "@/lib/supabase/client";
import { dataProvider } from "@/services/config/data-provider";

export type R2Folder = "productos" | "tienda" | "comprobantes";

const fileToBase64 = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("No se pudo leer el archivo como base64"));
      }
    };
    reader.onerror = () => reject(new Error("Error leyendo archivo para subir a R2"));
    reader.readAsDataURL(file);
  });

export const isR2MerchantAssetUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  return url.includes("/comercios/") && (url.includes("cdn.jireh.cloud") || url.includes(".r2.dev"));
};

export const r2StorageService = {
  /**
   * Sube una imagen optimizada al CDN gratuito de Cloudflare R2 mediante la Edge Function r2-upload.
   * Si la Edge Function aún no está desplegada o no responde, retorna null para permitir fallback silencioso a Supabase Storage.
   */
  async uploadImage(folder: R2Folder, file: Blob, contentType = "image/webp"): Promise<string | null> {
    if (dataProvider === "mock") return null;

    try {
      const base64Data = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("r2-upload", {
        body: {
          action: "upload",
          folder,
          contentType: file.type || contentType,
          base64Data,
        },
      });

      if (error || !data || typeof data !== "object") {
        return null;
      }

      const payload = data as { success?: boolean; publicUrl?: string };
      if (payload.success && payload.publicUrl) {
        return payload.publicUrl;
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Elimina una imagen propia del comercio alojada en Cloudflare R2 (nunca toca fotos compartidas del catálogo global).
   */
  async deleteMerchantImage(publicUrl: string): Promise<boolean> {
    if (dataProvider === "mock" || !isR2MerchantAssetUrl(publicUrl)) return false;

    try {
      const { data, error } = await supabase.functions.invoke("r2-upload", {
        body: {
          action: "delete",
          publicUrl,
        },
      });
      if (error) return false;
      return Boolean((data as { success?: boolean } | null)?.success);
    } catch {
      return false;
    }
  },
};
