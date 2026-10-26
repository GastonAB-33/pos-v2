import { useEffect, useMemo, useRef, useState } from "react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface ProductImageEditorModalProps {
  open: boolean;
  sourceUrl: string | null;
  disabled?: boolean;
  onClose: () => void;
  onConfirm: (result: { file: File; previewUrl: string }) => void;
}

const OUTPUT_SIZE = 900;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

const clamp = (value: number, min: number, max: number): number => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const loadImage = (sourceUrl: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo cargar la imagen para recorte"));
    image.src = sourceUrl;
  });
};

const renderCropToCanvas = (
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  zoom: number,
  offsetX: number,
  offsetY: number
) => {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("No se pudo inicializar el editor de imagen");
  }

  const size = canvas.width;
  context.clearRect(0, 0, size, size);

  const baseScale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
  const scale = baseScale * zoom;

  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;

  const centerX = (size - drawWidth) / 2;
  const centerY = (size - drawHeight) / 2;

  const shiftX = (offsetX / 100) * (size / 2);
  const shiftY = (offsetY / 100) * (size / 2);

  const minX = size - drawWidth;
  const maxX = 0;
  const minY = size - drawHeight;
  const maxY = 0;

  const drawX = clamp(centerX + shiftX, minX, maxX);
  const drawY = clamp(centerY + shiftY, minY, maxY);

  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
};

const exportCanvasToFile = (canvas: HTMLCanvasElement): Promise<File> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No se pudo generar el archivo final de imagen"));
          return;
        }

        const file = new File([blob], `producto-${Date.now()}.jpg`, {
          type: "image/jpeg",
          lastModified: Date.now(),
        });

        resolve(file);
      },
      "image/jpeg",
      0.82
    );
  });
};

export const ProductImageEditorModal = ({
  open,
  sourceUrl,
  disabled,
  onClose,
  onConfirm,
}: ProductImageEditorModalProps) => {
  useBodyScrollLock(open);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState(1.2);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!open || !sourceUrl) {
      setImage(null);
      setError(null);
      return;
    }

    setZoom(1.2);
    setOffsetX(0);
    setOffsetY(0);
    setError(null);

    void loadImage(sourceUrl)
      .then((nextImage) => {
        setImage(nextImage);
      })
      .catch((reason) => {
        setImage(null);
        setError(reason instanceof Error ? reason.message : "No se pudo preparar la imagen");
      });
  }, [open, sourceUrl]);

  useEffect(() => {
    if (!open || !image || !canvasRef.current) return;

    try {
      renderCropToCanvas(canvasRef.current, image, zoom, offsetX, offsetY);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo previsualizar el recorte");
    }
  }, [image, offsetX, offsetY, open, zoom]);

  const canConfirm = useMemo(
    () => Boolean(open && image && !disabled && !isExporting),
    [disabled, image, isExporting, open]
  );

  if (!open) return null;

  return (
    <section className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--ui-overlay)] p-4">
      <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
        <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Editar fotografía del producto</h3>
            <p className="text-xs text-slate-500">Recorta y optimiza la imagen antes de guardar.</p>
          </div>
          <ModalCloseButton label="Cerrar editor de imagen" onClick={onClose} disabled={isExporting} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <canvas
              ref={canvasRef}
              width={OUTPUT_SIZE}
              height={OUTPUT_SIZE}
              className="h-[300px] w-[300px] rounded-md border border-slate-200 bg-white object-cover"
            />
          </div>

          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Zoom
              </label>
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.01}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="w-full"
                disabled={disabled || isExporting}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Encuadre horizontal
              </label>
              <input
                type="range"
                min={-100}
                max={100}
                step={1}
                value={offsetX}
                onChange={(event) => setOffsetX(Number(event.target.value))}
                className="w-full"
                disabled={disabled || isExporting}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Encuadre vertical
              </label>
              <input
                type="range"
                min={-100}
                max={100}
                step={1}
                value={offsetY}
                onChange={(event) => setOffsetY(Number(event.target.value))}
                className="w-full"
                disabled={disabled || isExporting}
              />
            </div>

            <p className="text-xs text-slate-500">
              Exportación optimizada en JPG cuadrado ({OUTPUT_SIZE}x{OUTPUT_SIZE}) con compresión automática.
            </p>

            {error ? <p className="text-xs text-red-600">{error}</p> : null}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
          <button type="button" className="ui-btn-ghost" onClick={onClose} disabled={isExporting}>
            Cancelar
          </button>
          <button
            type="button"
            className="ui-btn-primary"
            disabled={!canConfirm}
            onClick={() => {
              if (!canvasRef.current) return;

              setIsExporting(true);
              void exportCanvasToFile(canvasRef.current)
                .then((file) => {
                  const previewUrl = URL.createObjectURL(file);
                  onConfirm({ file, previewUrl });
                })
                .catch((reason) => {
                  setError(reason instanceof Error ? reason.message : "No se pudo exportar la imagen");
                })
                .finally(() => {
                  setIsExporting(false);
                });
            }}
          >
            {isExporting ? "Procesando..." : "Usar imagen"}
          </button>
        </div>
      </div>
    </section>
  );
};
