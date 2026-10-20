import { useState, useEffect } from "react";
import {
  X,
  ShieldCheck,
  Download,
  Upload,
  Check,
  AlertCircle,
  ExternalLink,
  Key,
  FileCheck,
  ChevronRight,
  Terminal,
  RefreshCw,
  Sparkles,
  FileText,
} from "lucide-react";
import { useToast } from "@/components/ui/useToast";
import { ArcaAccountantGuideModal } from "./ArcaAccountantGuideModal";
import {
  generateArcaKeyPairAndCsr,
  generateOpenSslCommand,
  validateCertificateCrt,
  validatePrivateKey,
  downloadFile,
} from "@/modules/configuracion/utils/arca-certificate-helper";

interface ArcaCertificateWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  cuit: string;
  businessName: string;
  alias: string;
  currentCrt?: string | null;
  currentKey?: string | null;
  onSaveCredentials: (credentials: {
    certificate_crt: string;
    certificate_key: string;
    certificado_alias?: string;
  }) => void;
}

export const ArcaCertificateWizardModal = ({
  isOpen,
  onClose,
  cuit,
  businessName,
  alias,
  currentCrt,
  currentKey,
  onSaveCredentials,
}: ArcaCertificateWizardModalProps) => {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<"step1" | "step2" | "step3">("step1");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedOpenSsl, setCopiedOpenSsl] = useState(false);

  const cleanCuit = cuit.replace(/\D/g, "");

  // Recuperar clave pendiente de localStorage si no viene guardada previamente
  const pendingKey = typeof window !== "undefined" && cleanCuit
    ? localStorage.getItem(`arca_pending_key_${cleanCuit}`) || ""
    : "";

  // Estados locales para la clave y certificado
  const [generatedKey, setGeneratedKey] = useState<string>(currentKey || pendingKey);
  const [generatedCsr, setGeneratedCsr] = useState<string>("");
  const [uploadedCrt, setUploadedCrt] = useState<string>(currentCrt || "");
  const [uploadedKey, setUploadedKey] = useState<string>(currentKey || pendingKey);
  const [customAlias, setCustomAlias] = useState<string>(alias || "pos-v2");
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);

  // Validación de formatos
  const crtValidation = uploadedCrt ? validateCertificateCrt(uploadedCrt) : null;
  const keyValidation = uploadedKey ? validatePrivateKey(uploadedKey) : null;

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Paso 1: Generar Claves y Descargar CSR
  const handleGenerateCsr = async () => {
    if (!cleanCuit || cleanCuit.length < 11) {
      toast.error("Ingresá un CUIT válido de 11 dígitos en la configuración antes de generar el certificado.");
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateArcaKeyPairAndCsr({
        cuit: cleanCuit,
        businessName: businessName || "Comercio",
        alias: customAlias,
      });

      setGeneratedKey(result.privateKeyPem);
      setGeneratedCsr(result.csrPem);
      setUploadedKey(result.privateKeyPem);

      // Guardar clave en localStorage para persistencia segura contra cierres de ventana
      try {
        localStorage.setItem(`arca_pending_key_${cleanCuit}`, result.privateKeyPem);
      } catch (err) {
        console.warn("No se pudo persistir clave en localStorage:", err);
      }

      // Descargar el archivo .csr en la computadora del usuario
      downloadFile(
        `pedido_arca_${cleanCuit}.csr`,
        result.csrPem,
        "application/x-x509-ca-cert"
      );

      // Descargar también automáticamente el archivo .key
      downloadFile(
        `clave_privada_${cleanCuit}.key`,
        result.privateKeyPem,
        "application/x-pem-file"
      );

      toast.success(
        "¡Pedido (.csr) y Clave Privada (.key) descargados! Tu clave quedó vinculada."
      );
      setActiveTab("step2");
    } catch (err) {
      console.error("Error al generar CSR:", err);
      toast.error("Ocurrió un error al generar las claves criptográficas.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Copiar comando OpenSSL
  const handleCopyOpenSsl = () => {
    const cmd = generateOpenSslCommand({
      cuit: cleanCuit,
      businessName: businessName || "Comercio",
      alias: customAlias,
    });
    void navigator.clipboard.writeText(cmd);
    setCopiedOpenSsl(true);
    toast.success("Comando OpenSSL copiado al portapapeles.");
    window.setTimeout(() => setCopiedOpenSsl(false), 3000);
  };

  // Cargar archivo .crt desde el disco
  const handleCrtFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setUploadedCrt(text);
        const valid = validateCertificateCrt(text);
        if (valid.valid) {
          toast.success("Certificado (.crt) cargado correctamente.");
        } else {
          toast.error(valid.message);
        }
      }
    };
    reader.readAsText(file);
  };

  // Cargar archivo .key desde el disco
  const handleKeyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setUploadedKey(text);
        const valid = validatePrivateKey(text);
        if (valid.valid) {
          toast.success("Clave privada (.key) cargada correctamente.");
        } else {
          toast.error(valid.message);
        }
      }
    };
    reader.readAsText(file);
  };

  // Guardar y Aplicar en la Configuración
  const handleSaveAll = () => {
    if (!uploadedCrt || !crtValidation?.valid) {
      toast.error("Debes cargar un Certificado (.crt) válido emitido por ARCA.");
      return;
    }
    if (!uploadedKey || !keyValidation?.valid) {
      toast.error("Debes contar con la Clave Privada (.key) asociada al certificado.");
      return;
    }

    onSaveCredentials({
      certificate_crt: uploadedCrt.trim(),
      certificate_key: uploadedKey.trim(),
      certificado_alias: customAlias.trim(),
    });

    try {
      localStorage.removeItem(`arca_pending_key_${cleanCuit}`);
    } catch {}

    toast.success("¡Certificado y Clave Privada de ARCA guardados exitosamente!");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Encabezado */}
        <header className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-4 bg-slate-50/80 dark:bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Asistente de Certificado Digital ARCA
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generá o cargá tu certificado para emitir Factura Electrónica (A, B, C)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Cerrar modal"
          >
            <X size={18} />
          </button>
        </header>

        {/* Barra de progreso de Pasos */}
        <div className="grid grid-cols-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/30 text-xs shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("step1")}
            className={`py-3 px-4 font-semibold text-center border-b-2 flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === "step1"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/60 text-[11px] font-bold">
              1
            </span>
            <span>Generar Pedido (.csr)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("step2")}
            className={`py-3 px-4 font-semibold text-center border-b-2 flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === "step2"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/60 text-[11px] font-bold">
              2
            </span>
            <span>Subir a ARCA</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("step3")}
            className={`py-3 px-4 font-semibold text-center border-b-2 flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === "step3"
                ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/60 text-[11px] font-bold">
              3
            </span>
            <span>Vincular Certificado (.crt)</span>
          </button>
        </div>

        {/* Contenido del Paso */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* PASO 1 */}
          {activeTab === "step1" && (
            <div className="space-y-4">
              <div className="rounded-xl p-4 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/60 space-y-2">
                <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200 font-bold text-sm">
                  <Sparkles size={16} className="text-blue-600 dark:text-blue-400" />
                  Paso 1: Generar Solicitud de Certificado (CSR)
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  El sistema generará tu par de claves criptográficas RSA 2048 de forma local y segura en tu navegador.
                  Obtendrás un archivo <strong>.csr</strong> listo para subir a la web de ARCA.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    CUIT del Emisor
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={cuit || "Sin CUIT especificado"}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono font-bold text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Razón Social / Titular
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={businessName || "Comercio"}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Alias para el Certificado en ARCA
                  </label>
                  <input
                    type="text"
                    value={customAlias}
                    onChange={(e) => setCustomAlias(e.target.value)}
                    placeholder="Ej: pos-v2"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Nombre identificatorio para reconocer este certificado dentro del portal de ARCA.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={handleGenerateCsr}
                  disabled={isGenerating || !cleanCuit}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Generando claves...
                    </>
                  ) : (
                    <>
                      <Download size={14} />
                      Generar y Descargar Pedido (.csr)
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleCopyOpenSsl}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold text-xs transition cursor-pointer"
                >
                  {copiedOpenSsl ? (
                    <>
                      <Check size={14} className="text-emerald-500" />
                      ¡Comando copiado!
                    </>
                  ) : (
                    <>
                      <Terminal size={14} />
                      Copiar comando OpenSSL
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsGuideModalOpen(true)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-blue-300 dark:border-blue-700/80 bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 font-semibold text-xs transition cursor-pointer"
                >
                  <FileText size={14} />
                  <span>Instructivo para mi Contador (PDF)</span>
                </button>
              </div>

              {generatedKey && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-medium">
                    <Key size={14} className="text-emerald-600" />
                    Clave privada generada y guardada en memoria.
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      downloadFile(`clave_privada_${cleanCuit}.key`, generatedKey)
                    }
                    className="underline text-emerald-700 dark:text-emerald-400 font-bold hover:text-emerald-900"
                  >
                    Descargar respaldo .key
                  </button>
                </div>
              )}
            </div>
          )}

          {/* PASO 2 */}
          {activeTab === "step2" && (
            <div className="space-y-4">
              <div className="rounded-xl p-4 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/60 space-y-1">
                <h3 className="text-sm font-bold text-blue-950 dark:text-blue-100 flex items-center gap-2">
                  <ExternalLink size={15} className="text-blue-600 dark:text-blue-400" />
                  Paso 2: Subir el archivo .csr en la web de ARCA (2 minutos)
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Este trámite lo puede realizar el titular del comercio o su contador desde el portal de ARCA.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-1">
                  <span className="font-bold text-slate-900 dark:text-slate-100 block">
                    1. Ingresá a la web oficial de ARCA
                  </span>
                  <p className="text-slate-600 dark:text-slate-400">
                    Entrá en{" "}
                    <a
                      href="https://www.arca.gob.ar"
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 dark:text-blue-400 underline font-semibold"
                    >
                      www.arca.gob.ar
                    </a>{" "}
                    con tu CUIT y Clave Fiscal (Nivel 3).
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-1">
                  <span className="font-bold text-slate-900 dark:text-slate-100 block">
                    2. Abrí "Administración de Certificados Digitales"
                  </span>
                  <p className="text-slate-600 dark:text-slate-400">
                    Hacé clic en el botón <strong>"Agregar Alias"</strong>. Escribí como alias:{" "}
                    <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded font-mono font-bold text-slate-900 dark:text-slate-100">
                      {customAlias}
                    </code>{" "}
                    y seleccioná el archivo <strong>pedido_arca_{cleanCuit}.csr</strong> que descargaste en el Paso 1.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-1">
                  <span className="font-bold text-slate-900 dark:text-slate-100 block">
                    3. Descargá el Certificado (.crt)
                  </span>
                  <p className="text-slate-600 dark:text-slate-400">
                    Una vez creado el alias, hacé clic en el botón <strong>"Ver"</strong> al lado de tu alias y presioná{" "}
                    <strong>"Descargar Certificado"</strong>. Guardará un archivo con extensión <strong>.crt</strong>.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-1">
                  <span className="font-bold text-slate-900 dark:text-slate-100 block">
                    4. Vincular el Web Service en "Administrador de Relaciones de Clave Fiscal"
                  </span>
                  <p className="text-slate-600 dark:text-slate-400">
                    En el menú de ARCA, entrá a <em>"Administrador de Relaciones de Clave Fiscal"</em> &gt; <em>"Nueva Relación"</em> &gt;{" "}
                    <em>"Buscar Servicio"</em> &gt; <em>"ARCA / Web Services"</em> &gt; <strong>"Facturación Electrónica"</strong>. En
                    Representante, seleccioná el alias que creaste (<strong>{customAlias}</strong>).
                  </p>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsGuideModalOpen(true)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-blue-300 dark:border-blue-700/80 bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 font-semibold text-xs transition cursor-pointer"
                >
                  <FileText size={14} />
                  <span>Ver / Imprimir Instructivo para Contador (PDF)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("step3")}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  Ya descargué el .crt, ir al Paso 3
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* PASO 3 */}
          {activeTab === "step3" && (
            <div className="space-y-4">
              <div className="rounded-xl p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/60 space-y-1">
                <h3 className="text-sm font-bold text-emerald-950 dark:text-emerald-100 flex items-center gap-2">
                  <FileCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
                  Paso 3: Cargar y Vincular tu Certificado (.crt)
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Subí el archivo de certificado otorgado por ARCA para activar la facturación en POS V2.
                </p>
              </div>

              {/* Selector de Certificado .crt */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Archivo del Certificado Digital (.crt / .pem) *
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-xl bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-xs font-semibold cursor-pointer transition">
                    <Upload size={16} className="text-blue-500" />
                    <span>Hacé clic para seleccionar el archivo .crt</span>
                    <input
                      type="file"
                      accept=".crt,.cer,.pem,.txt"
                      onChange={handleCrtFileChange}
                      className="hidden"
                    />
                  </label>
                </div>

                {uploadedCrt && (
                  <div
                    className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                      crtValidation?.valid
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                        : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                    }`}
                  >
                    {crtValidation?.valid ? <Check size={14} /> : <AlertCircle size={14} />}
                    <span>{crtValidation?.message}</span>
                  </div>
                )}
              </div>

              {/* Selector de Clave Privada .key */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Clave Privada (.key)
                  </label>
                  {uploadedKey && keyValidation?.valid && (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Check size={12} />
                      Clave privada vinculada
                    </span>
                  )}
                </div>

                {!uploadedKey && (
                  <div className="flex items-center gap-3">
                    <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-xl bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-xs font-semibold cursor-pointer transition">
                      <Key size={14} className="text-amber-500" />
                      <span>Seleccionar archivo .key (si fue generado externamente)</span>
                      <input
                        type="file"
                        accept=".key,.pem,.txt"
                        onChange={handleKeyFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                {uploadedKey && !keyValidation?.valid && (
                  <div className="p-2.5 rounded-lg text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-2">
                    <AlertCircle size={14} />
                    <span>{keyValidation?.message}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer con acciones */}
        <footer className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 px-5 py-3 bg-slate-50/80 dark:bg-slate-800/60 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Cancelar
          </button>

          {activeTab === "step3" ? (
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={!uploadedCrt || !crtValidation?.valid || !uploadedKey || !keyValidation?.valid}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              Guardar y Activar Certificado
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === "step1" ? "step2" : "step3")}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition cursor-pointer"
            >
              Siguiente paso
            </button>
          )}
        </footer>
      </div>

      <ArcaAccountantGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
        cuit={cuit}
        businessName={businessName}
        alias={customAlias}
        csrPem={generatedCsr}
      />
    </div>
  );
};
