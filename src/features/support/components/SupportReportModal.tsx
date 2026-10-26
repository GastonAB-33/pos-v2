import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import * as htmlToImage from "html-to-image";
import html2canvas from "html2canvas";
import {
  Camera,
  CheckCircle2,
  LifeBuoy,
  Loader2,
  Monitor,
  Send,
  Upload,
  X,
} from "lucide-react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import {
  detectDeviceInfo,
  formatWhatsAppSupportMessage,
  supportCenterStorage,
  type SupportTicketType,
} from "@/features/support/support-center.storage";
import { SupportAnnotationCanvas } from "@/features/support/components/SupportAnnotationCanvas";
import { compressScreenshotCanvas } from "@/features/support/utils/screenshot-compression";
import { useToast } from "@/components/ui/useToast";

interface SupportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminWhatsAppNumber?: string;
}

const DEFAULT_SUPPORT_WHATSAPP = "5493413628499"; // Número de soporte por defecto

const getFriendlyModuleName = (pathname: string): string => {
  if (pathname.startsWith("/pos")) return "Punto de Venta (POS)";
  if (pathname.startsWith("/productos")) return "Catálogo de Productos";
  if (pathname.startsWith("/clientes")) return "Clientes y Cuentas";
  if (pathname.startsWith("/cuentas-corrientes")) return "Cuentas Corrientes";
  if (pathname.startsWith("/stock")) return "Control de Stock";
  if (pathname.startsWith("/caja")) return "Caja y Movimientos";
  if (pathname.startsWith("/compras")) return "Compras";
  if (pathname.startsWith("/proveedores")) return "Proveedores";
  if (pathname.startsWith("/promociones")) return "Promociones y Descuentos";
  if (pathname.startsWith("/medios-pago")) return "Medios de Pago";
  if (pathname.startsWith("/facturacion") || pathname.startsWith("/comprobantes")) return "Facturación y Comprobantes";
  if (pathname.startsWith("/reportes")) return "Reportes y Estadísticas";
  if (pathname.startsWith("/usuarios")) return "Usuarios y Permisos";
  if (pathname.startsWith("/sistema")) return "Configuración del Sistema";
  if (pathname.startsWith("/dashboard")) return "Panel Principal (Dashboard)";
  return "Sistema POS";
};

export const SupportReportModal = ({
  isOpen,
  onClose,
  adminWhatsAppNumber = DEFAULT_SUPPORT_WHATSAPP,
}: SupportReportModalProps) => {
  const toast = useToast();
  const location = useLocation();
  const { tenant, tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [annotatedImage, setAnnotatedImage] = useState<string | null>(null);
  const [strokesCount, setStrokesCount] = useState(0);

  const [ticketType, setTicketType] = useState<SupportTicketType>("falla");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Telemetría que se guarda internamente para el administrador (sin saturar la vista del cliente)
  const moduleName = useMemo(() => getFriendlyModuleName(location.pathname), [location.pathname]);
  const deviceInfo = useMemo(() => detectDeviceInfo(), []);
  const tenantName = tenant?.tradeName || tenant?.legalName || "Comercio";

  // Capturar pantalla real de la aplicación
  const captureScreen = useCallback(async () => {
    setIsCapturing(true);
    try {
      const modalLayer = document.getElementById("support-report-modal-root");
      if (modalLayer) modalLayer.style.display = "none";

      await new Promise((resolve) => setTimeout(resolve, 80));

      const target = document.getElementById("root") || document.body;

      let dataUrl = "";
      try {
        dataUrl = await htmlToImage.toPng(target, {
          quality: 0.95,
          backgroundColor: "#f8fafc",
          pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
          skipFonts: true,
          filter: (node) => {
            return (node as HTMLElement)?.id !== "support-report-modal-root";
          },
        });
      } catch (domErr) {
        console.warn("htmlToImage primary attempt failed, trying html2canvas fallback:", domErr);
        const canvas = await html2canvas(target, {
          scale: 1,
          logging: false,
          useCORS: false,
          allowTaint: true,
          backgroundColor: "#f8fafc",
          ignoreElements: (el) => el.id === "support-report-modal-root",
        });
        dataUrl = canvas.toDataURL("image/png", 0.95);
      }

      if (modalLayer) modalLayer.style.display = "flex";

      if (dataUrl) {
        setCapturedImage(dataUrl);
        setAnnotatedImage(dataUrl);
        setStrokesCount(0);
      }
    } catch (err) {
      console.error("Error capturing screen:", err);
      toast.info("Podés subir una imagen o pegar una captura con Ctrl+V.");
    } finally {
      const modalLayer = document.getElementById("support-report-modal-root");
      if (modalLayer) modalLayer.style.display = "flex";
      setIsCapturing(false);
    }
  }, [toast]);

  // Captura nativa pixel-perfect con el selector de pantalla del navegador
  const captureWithDisplayMedia = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      toast.info("Podés subir una captura o pegar directamente con Ctrl+V.");
      return;
    }

    try {
      setIsCapturing(true);
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
      });

      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();

      await new Promise((resolve) => setTimeout(resolve, 150));

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = compressScreenshotCanvas(canvas);
        setCapturedImage(dataUrl);
        setAnnotatedImage(dataUrl);
        setStrokesCount(0);
        toast.success("Captura tomada correctamente.");
      }

      stream.getTracks().forEach((t) => t.stop());
    } catch (err) {
      console.warn("User cancelled screen share", err);
    } finally {
      setIsCapturing(false);
    }
  };

  // Carga manual de imagen desde archivo
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setCapturedImage(dataUrl);
        setAnnotatedImage(dataUrl);
        setStrokesCount(0);
        toast.success("Captura cargada con éxito.");
      }
    };
    reader.readAsDataURL(file);
  };

  // Pegar captura desde el portapapeles (Ctrl + V)
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const dataUrl = event.target?.result as string;
              if (dataUrl) {
                setCapturedImage(dataUrl);
                setAnnotatedImage(dataUrl);
                setStrokesCount(0);
                toast.success("Captura pegada desde el portapapeles.");
              }
            };
            reader.readAsDataURL(blob);
            e.preventDefault();
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isOpen, toast]);

  // Al abrir el modal, capturar pantalla si no hay captura previa
  useEffect(() => {
    if (isOpen && !capturedImage && !isCapturing) {
      void captureScreen();
    }
  }, [isOpen, capturedImage, isCapturing, captureScreen]);

  // Reset al cerrar
  const handleClose = () => {
    setCapturedImage(null);
    setAnnotatedImage(null);
    setStrokesCount(0);
    setSubject("");
    setDescription("");
    onClose();
  };

  const handleExportAnnotation = (dataUrl: string, count: number) => {
    setAnnotatedImage(dataUrl);
    setStrokesCount(count);
  };

  // Validación: asunto y detalle obligatorios (la captura/anotación es opcional)
  const isFormValid = subject.trim().length >= 3 && description.trim().length >= 5;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !tenantId || !user) {
      toast.info("Completa el asunto y detalle para enviar el reporte.");
      return;
    }

    setIsSubmitting(true);

    try {
      const ticket = supportCenterStorage.createTicket({
        tenantId,
        tenantName,
        type: ticketType,
        subject: subject.trim(),
        body: description.trim(),
        requesterUserId: user.id,
        requesterLabel: user.fullName || user.username || user.email || "Usuario",
        requesterRole: user.role || "Operador",
        requesterEmail: user.email || null,
        moduleName,
        routePath: location.pathname,
        deviceInfo,
        screenshotDataUrl: annotatedImage,
      });

      // Formatear mensaje para WhatsApp
      const waMessage = formatWhatsAppSupportMessage(ticket);
      const cleanPhone = adminWhatsAppNumber.replace(/\D/g, "");
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMessage)}`;

      toast.success(`Reporte #${ticket.ticketNumber} registrado con éxito.`);

      // Abrir WhatsApp en una nueva pestaña
      window.open(waUrl, "_blank", "noopener,noreferrer");

      handleClose();
    } catch {
      toast.error("Ocurrió un error al guardar el reporte. Intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="support-report-modal-root"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        {/* Encabezado limpio y minimalista */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <LifeBuoy size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Centro de Asistencia y Soporte
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Marcá lo que sucede en pantalla y te asistiremos de inmediato.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Sección de Captura y Marcado */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                1. Indicación sobre la pantalla
              </span>

              {/* Botones de captura */}
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Subir archivo de imagen"
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <Upload size={12} />
                  <span>Subir imagen</span>
                </button>

                <button
                  type="button"
                  onClick={() => void captureWithDisplayMedia()}
                  title="Capturar pantalla con el navegador"
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <Monitor size={12} />
                  <span>Capturar pantalla</span>
                </button>

                <button
                  type="button"
                  onClick={() => void captureScreen()}
                  disabled={isCapturing}
                  title="Recapturar pantalla actual"
                  className="flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-100 disabled:opacity-50 dark:bg-blue-950/50 dark:text-blue-400"
                >
                  <Camera size={12} />
                  <span>{isCapturing ? "Capturando..." : "Recapturar"}</span>
                </button>
              </div>
            </div>

            {isCapturing ? (
              <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
                <Loader2 size={24} className="animate-spin text-blue-600 mb-2" />
                <p className="text-xs font-medium">Capturando pantalla de la aplicación...</p>
              </div>
            ) : capturedImage ? (
              <div className="space-y-1.5">
                <SupportAnnotationCanvas
                  imageSrc={capturedImage}
                  onExport={handleExportAnnotation}
                  onStrokesChange={setStrokesCount}
                />
              </div>
            ) : (
              <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
                <Camera size={24} className="text-slate-400 mb-2" />
                <button
                  type="button"
                  onClick={() => void captureScreen()}
                  className="ui-btn-secondary text-xs"
                >
                  Tomar captura de pantalla
                </button>
              </div>
            )}
          </div>

          {/* Sección de Formulario Limpio */}
          <form id="support-report-form" onSubmit={handleSubmit} className="space-y-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                2. Tipo de reporte:
              </span>
              <div className="flex items-center gap-1.5">
                {[
                  { id: "falla", label: "Reportar Falla" },
                  { id: "consulta", label: "Consulta" },
                  { id: "sugerencia", label: "Sugerencia" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTicketType(opt.id as SupportTicketType)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      ticketType === opt.id
                        ? "bg-blue-600 text-white shadow-sm"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="support-subject" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Asunto breve <span className="text-red-500">*</span>
              </label>
              <input
                id="support-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ej: No me permite guardar el cliente o falla el cálculo"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                required
                minLength={3}
              />
            </div>

            <div>
              <label htmlFor="support-description" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                ¿Qué estabas haciendo cuando ocurrió el problema? <span className="text-red-500">*</span>
              </label>
              <textarea
                id="support-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explicá brevemente lo que sucedió para poder ayudarte más rápido..."
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                required
                minLength={5}
              />
            </div>
          </form>
        </div>

        {/* Pie de modal */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center gap-2">
            {strokesCount > 0 ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 size={14} />
                <span>Captura con {strokesCount} marca(s) lista.</span>
              </span>
            ) : annotatedImage || capturedImage ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-400">
                <CheckCircle2 size={14} />
                <span>Captura de pantalla adjunta.</span>
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="ui-btn-ghost text-xs"
              disabled={isSubmitting}
            >
              Cancelar
            </button>

            <button
              type="submit"
              form="support-report-form"
              disabled={!isFormValid || isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              <span>Enviar reporte y abrir WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
