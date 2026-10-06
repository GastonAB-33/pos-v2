/**
 * Utilidad para comprimir y optimizar imágenes en el navegador antes de guardarlas
 * en base de datos o almacenamiento, reduciendo peso sin perder legibilidad de documentos.
 */
export interface CompressImageOptions {
  maxDimension?: number;
  quality?: number;
  mimeType?: string;
}

export const compressImageFile = async (
  file: File,
  options: CompressImageOptions = {}
): Promise<string> => {
  const { maxDimension = 1600, quality = 0.75, mimeType = "image/jpeg" } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Error al leer el archivo de imagen"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => {
        // Fallback: devolver la dataUrl original si el navegador no puede decodificarla en Image
        resolve(reader.result as string);
      };
      img.onload = () => {
        try {
          let { width, height } = img;

          // Si es menor que la dimensión máxima y ya es liviana, no redimensionar
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(reader.result as string);
            return;
          }

          // Fondo blanco para imágenes transparentes que se convierten a JPEG
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);

          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL(mimeType, quality);
          resolve(compressed);
        } catch {
          // Fallback a data URL original
          resolve(reader.result as string);
        }
      };

      img.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
};
