import { useCallback, useEffect, useRef, useState } from "react";
import { Ban, Check, Edit2, Eraser, MoveRight, RotateCcw, Square, Type } from "lucide-react";
import { compressScreenshotCanvas } from "@/features/support/utils/screenshot-compression";
import { cn } from "@/utils/cn";

export type AnnotationTool = "pencil" | "arrow" | "rectangle" | "censor" | "text";

interface Point {
  x: number;
  y: number;
}

interface Shape {
  id: string;
  tool: AnnotationTool;
  color: string;
  strokeWidth: number;
  points?: Point[];
  startPoint?: Point;
  endPoint?: Point;
  text?: string;
}

interface SupportAnnotationCanvasProps {
  imageSrc: string;
  onExport: (annotatedDataUrl: string, strokesCount: number) => void;
  onStrokesChange?: (strokesCount: number) => void;
}

const COLORS = [
  { label: "Rojo", value: "#ef4444" },
  { label: "Azul", value: "#2563eb" },
  { label: "Amarillo", value: "#f59e0b" },
  { label: "Negro", value: "#1e293b" },
];

export const SupportAnnotationCanvas = ({
  imageSrc,
  onExport,
  onStrokesChange,
}: SupportAnnotationCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageObjRef = useRef<HTMLImageElement | null>(null);

  const [activeTool, setActiveTool] = useState<AnnotationTool>("rectangle");
  const [activeColor, setActiveColor] = useState<string>("#ef4444");
  const activeStrokeWidth = 5;

  const [shapes, setShapes] = useState<Shape[]>([]);
  const [currentShape, setCurrentShape] = useState<Shape | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Cargar imagen de fondo
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
    img.onload = () => {
      imageObjRef.current = img;
      renderCanvas();
    };
  }, [imageSrc]);

  // Notificar al componente padre cuántos trazos van
  useEffect(() => {
    onStrokesChange?.(shapes.length);
  }, [shapes.length, onStrokesChange]);

  // Dibujar flecha en canvas
  const drawArrow = (ctx: CanvasRenderingContext2D, from: Point, to: Point, color: string, width: number) => {
    const headlen = Math.max(12, width * 3);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angle = Math.atan2(dy, dx);

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Línea principal
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    // Punta de flecha
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - headlen * Math.cos(angle - Math.PI / 6), to.y - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(to.x - headlen * Math.cos(angle + Math.PI / 6), to.y - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  };

  // Renderizar todo el contenido en el canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageObjRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Dimensionar canvas acorde a la imagen original
    if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
    }

    // Dibujar imagen de fondo
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    // Dibujar formas guardadas
    const allShapes = currentShape ? [...shapes, currentShape] : shapes;

    for (const shape of allShapes) {
      ctx.save();

      if (shape.tool === "pencil" && shape.points && shape.points.length > 1) {
        ctx.strokeStyle = shape.color;
        ctx.lineWidth = shape.strokeWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        for (let i = 1; i < shape.points.length; i++) {
          ctx.lineTo(shape.points[i].x, shape.points[i].y);
        }
        ctx.stroke();
      } else if (shape.tool === "arrow" && shape.startPoint && shape.endPoint) {
        drawArrow(ctx, shape.startPoint, shape.endPoint, shape.color, shape.strokeWidth);
      } else if (shape.tool === "rectangle" && shape.startPoint && shape.endPoint) {
        const x = Math.min(shape.startPoint.x, shape.endPoint.x);
        const y = Math.min(shape.startPoint.y, shape.endPoint.y);
        const w = Math.abs(shape.startPoint.x - shape.endPoint.x);
        const h = Math.abs(shape.startPoint.y - shape.endPoint.y);

        ctx.strokeStyle = shape.color;
        ctx.lineWidth = shape.strokeWidth;
        ctx.fillStyle = `${shape.color}15`; // Sombra suave interior
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
      } else if (shape.tool === "censor" && shape.startPoint && shape.endPoint) {
        const x = Math.min(shape.startPoint.x, shape.endPoint.x);
        const y = Math.min(shape.startPoint.y, shape.endPoint.y);
        const w = Math.abs(shape.startPoint.x - shape.endPoint.x);
        const h = Math.abs(shape.startPoint.y - shape.endPoint.y);

        ctx.fillStyle = "#0f172a";
        ctx.fillRect(x, y, w, h);

        // Patrón o texto indicador de censura
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, w, h);
      } else if (shape.tool === "text" && shape.startPoint && shape.text) {
        ctx.font = `bold ${Math.max(16, shape.strokeWidth * 4)}px sans-serif`;
        ctx.fillStyle = shape.color;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.strokeText(shape.text, shape.startPoint.x, shape.startPoint.y);
        ctx.fillText(shape.text, shape.startPoint.x, shape.startPoint.y);
      }

      ctx.restore();
    }
  }, [currentShape, shapes]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Obtener coordenadas relativas exactas del Canvas
  const getCanvasCoordinates = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getCanvasCoordinates(e);

    if (activeTool === "text") {
      const text = window.prompt("Escribí el texto que querés agregar en este punto:");
      if (text && text.trim()) {
        const newShape: Shape = {
          id: crypto.randomUUID(),
          tool: "text",
          color: activeColor,
          strokeWidth: activeStrokeWidth,
          startPoint: pt,
          text: text.trim(),
        };
        const nextShapes = [...shapes, newShape];
        setShapes(nextShapes);
      }
      return;
    }

    setIsDrawing(true);

    if (activeTool === "pencil") {
      setCurrentShape({
        id: crypto.randomUUID(),
        tool: "pencil",
        color: activeColor,
        strokeWidth: activeStrokeWidth,
        points: [pt],
      });
    } else {
      setCurrentShape({
        id: crypto.randomUUID(),
        tool: activeTool,
        color: activeColor,
        strokeWidth: activeStrokeWidth,
        startPoint: pt,
        endPoint: pt,
      });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentShape) return;
    const pt = getCanvasCoordinates(e);

    if (currentShape.tool === "pencil") {
      setCurrentShape((prev) =>
        prev
          ? {
              ...prev,
              points: [...(prev.points || []), pt],
            }
          : null
      );
    } else {
      setCurrentShape((prev) =>
        prev
          ? {
              ...prev,
              endPoint: pt,
            }
          : null
      );
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentShape) return;
    setIsDrawing(false);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignorar si el puntero ya se liberó
    }

    const nextShapes = [...shapes, currentShape];
    setShapes(nextShapes);
    setCurrentShape(null);
  };

  const handleUndo = () => {
    setShapes((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (shapes.length > 0) {
      setShapes([]);
    }
  };

  // Exportar captura con anotaciones
  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = compressScreenshotCanvas(canvas);
    onExport(dataUrl, shapes.length);
  };

  // Cada vez que cambian las figuras, actualizamos el export
  useEffect(() => {
    handleExport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapes]);

  return (
    <div className="flex flex-col space-y-2.5">
      {/* Barra de herramientas flotante/superior */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900">
        {/* Herramientas de dibujo */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTool("arrow")}
            title="Flecha indicadora"
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition",
              activeTool === "arrow"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800"
            )}
          >
            <MoveRight size={14} />
            <span>Flecha</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool("rectangle")}
            title="Recuadro de enfoque"
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition",
              activeTool === "rectangle"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800"
            )}
          >
            <Square size={14} />
            <span>Recuadro</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool("pencil")}
            title="Lápiz libre"
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition",
              activeTool === "pencil"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800"
            )}
          >
            <Edit2 size={14} />
            <span>Lápiz</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool("censor")}
            title="Censurar / Tapar dato confidencial"
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition",
              activeTool === "censor"
                ? "bg-slate-900 text-white shadow-sm dark:bg-slate-700"
                : "text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800"
            )}
          >
            <Ban size={14} />
            <span>Censurar</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool("text")}
            title="Agregar texto"
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition",
              activeTool === "text"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800"
            )}
          >
            <Type size={14} />
            <span>Texto</span>
          </button>
        </div>

        {/* Colores y Deshacer */}
        <div className="flex items-center gap-2">
          {/* Paleta de colores */}
          <div className="flex items-center gap-1 border-r border-slate-200 pr-2 dark:border-slate-800">
            {COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setActiveColor(c.value)}
                style={{ backgroundColor: c.value }}
                title={c.label}
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full transition ring-offset-1",
                  activeColor === c.value ? "ring-2 ring-blue-500 scale-110" : "opacity-80 hover:opacity-100"
                )}
              >
                {activeColor === c.value ? <Check size={10} className="text-white drop-shadow" /> : null}
              </button>
            ))}
          </div>

          {/* Deshacer y Limpiar */}
          <button
            type="button"
            onClick={handleUndo}
            disabled={shapes.length === 0}
            title="Deshacer último trazo"
            className="flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <RotateCcw size={13} />
            <span>Deshacer</span>
          </button>

          <button
            type="button"
            onClick={handleClear}
            disabled={shapes.length === 0}
            title="Limpiar todas las indicaciones"
            className="flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-red-950/40"
          >
            <Eraser size={13} />
            <span>Borrar todo</span>
          </button>
        </div>
      </div>

      {/* Contenedor del Canvas con Scroll Responsivo */}
      <div className="relative max-h-[50vh] min-h-[220px] overflow-auto rounded-xl border border-slate-300 bg-slate-900/5 p-1 text-center shadow-inner dark:border-slate-700 dark:bg-slate-950">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="mx-auto block max-w-full cursor-crosshair rounded-lg shadow"
          style={{ touchAction: "none" }}
        />
      </div>

      {/* Contador de trazos y aviso */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500 dark:text-slate-400">
          Marcas realizadas:{" "}
          <strong className={shapes.length > 0 ? "text-emerald-600" : "text-amber-600"}>
            {shapes.length}
          </strong>
        </span>
        {shapes.length === 0 ? (
          <span className="font-medium text-amber-600 dark:text-amber-400">
            ⚠️ Hacé clic o arrastrá sobre la imagen para señalar el problema
          </span>
        ) : (
          <span className="font-medium text-emerald-600 dark:text-emerald-400">
            ✓ Indicación realizada correctamente
          </span>
        )}
      </div>
    </div>
  );
};
