import { useRef } from "react";
import {
  Printer,
  Download,
  X,
  ShieldCheck,
  FileText,
  Key,
  Server,
  Link2,
  CheckCircle2,
  Copy,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/components/ui/useToast";
import { generateOpenSslCommand } from "@/modules/configuracion/utils/arca-certificate-helper";

interface ArcaAccountantGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  cuit: string;
  businessName: string;
  alias?: string;
  csrPem?: string;
}

export const ArcaAccountantGuideModal = ({
  isOpen,
  onClose,
  cuit,
  businessName,
  alias = "pos-v2",
  csrPem,
}: ArcaAccountantGuideModalProps) => {
  const toast = useToast();
  const printContainerRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const cleanCuit = cuit.replace(/\D/g, "");
  const formattedCuit =
    cleanCuit.length === 11
      ? `${cleanCuit.slice(0, 2)}-${cleanCuit.slice(2, 10)}-${cleanCuit.slice(10)}`
      : cuit;

  const openSslCmd = generateOpenSslCommand({
    cuit: cleanCuit,
    businessName: businessName || "Comercio",
    alias: alias || "pos-v2",
  });

  const handlePrint = () => {
    window.print();
  };

  const handleCopyOpenSsl = () => {
    void navigator.clipboard.writeText(openSslCmd);
    toast.success("Comando OpenSSL copiado al portapapeles.");
  };

  const handleDownloadCsr = () => {
    if (!csrPem) {
      toast.info("Generá primero el archivo .csr en el Asistente de ARCA.");
      return;
    }
    const blob = new Blob([csrPem], { type: "application/x-x509-ca-cert" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pedido_arca_${cleanCuit || "comercio"}.csr`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Archivo .csr descargado.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
      {/* Contenedor Modal */}
      <div
        ref={printContainerRef}
        className="relative w-full max-w-4xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-2xl flex flex-col max-h-[94vh] print:max-h-none print:shadow-none print:border-none print:w-full print:bg-white print:text-black"
      >
        {/* ENCABEZADO MODAL (Oculto al imprimir) */}
        <header className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 print:hidden bg-slate-50 dark:bg-slate-800/60 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <FileText size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                Instructivo de Vinculación ARCA (ex AFIP)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Paso a paso ilustrado para habilitar Facturación Electrónica oficial
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              title="Descargar como PDF o imprimir en hoja A4"
            >
              <Printer size={14} />
              <span>Descargar PDF / Imprimir</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              aria-label="Cerrar instructivo"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* CUERPO DEL INSTRUCTIVO (Formato imprimible con gráficos y mockups) */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-6 text-slate-800 dark:text-slate-200 print:p-0 print:overflow-visible print:text-black">
          {/* BANNER PRINCIPAL / MEMBRETE */}
          <div className="border-b-2 border-slate-900 dark:border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest print:text-black">
                <ShieldCheck size={16} /> POS V2 - Integración Fiscal Oficial ARCA
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 mt-0.5 print:text-black">
                Instructivo para Estudio Contable / Titular
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 print:text-slate-700">
                Habilitación de Web Services de Factura Electrónica (WSFE) en afip.gob.ar
              </p>
            </div>

            {/* Ficha Resumen del Contribuyente */}
            <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-3 text-xs space-y-1 sm:text-right shrink-0 min-w-[240px] print:border-black print:bg-white print:text-black">
              <div>
                <span className="text-slate-500 dark:text-slate-400 font-medium print:text-slate-700">Titular / Comercio: </span>
                <span className="font-bold text-slate-900 dark:text-slate-100 print:text-black">{businessName || "Comercio"}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 font-medium print:text-slate-700">CUIT: </span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 print:text-black">{formattedCuit}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 font-medium print:text-slate-700">Alias sugerido: </span>
                <span className="font-mono font-bold text-blue-700 dark:text-blue-400 print:text-black">{alias || "pos-v2"}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 font-medium print:text-slate-700">Servicio ARCA: </span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400 print:text-black">wsfe (Factura Electrónica)</span>
              </div>
            </div>
          </div>

          {/* INTRODUCCIÓN Y RECURSOS RÁPIDOS */}
          <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/30 p-4 text-xs space-y-2 print:border-slate-400 print:bg-slate-100">
            <h3 className="font-bold text-blue-950 dark:text-blue-200 flex items-center gap-1.5 text-sm print:text-black">
              <CheckCircle2 size={16} className="text-blue-600 dark:text-blue-400 print:text-black" />
              Estimado/a Contador/a o Titular del Monotributo / Responsable Inscripto:
            </h3>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed print:text-black">
              Para que el sistema de cobro emita comprobantes con <strong>CAE y Código QR oficial</strong> de ARCA automáticamente, se realizan <strong>4 pasos simples</strong> en la web con Clave Fiscal. Este proceso se realiza <strong>una única vez</strong> y el certificado tiene una duración de 2 años.
            </p>

            {csrPem ? (
              <div className="pt-1 flex items-center gap-2 print:hidden">
                <button
                  type="button"
                  onClick={handleDownloadCsr}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Download size={13} />
                  Descargar Solicitud .csr para el Paso 2
                </button>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Archivo listo para subir a ARCA.
                </span>
              </div>
            ) : null}
          </div>

          {/* GRID DE PASOS VISUALES CON MOCKUPS ILUSTRADOS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            {/* PASO 1 */}
            <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/40 p-4 space-y-3 print:border-black print:bg-white flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0 print:bg-black print:text-white">
                    1
                  </span>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm print:text-black">
                    Crear Punto de Venta para Web Services
                  </h4>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] print:text-slate-700">
                  Ingresar en <strong>"Administración de Puntos de Venta y Domicilios"</strong> &gt; <em>A/B/M Puntos de Venta</em> &gt; <em>Agregar</em>.
                </p>

                {/* Mockup Ilustrativo Portal AFIP */}
                <div className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 space-y-2 font-mono text-[11px]">
                  <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 pb-1 text-[10px] text-slate-500 font-sans font-bold">
                    <Server size={11} className="text-blue-500" /> AFIP &bull; Alta de Punto de Venta
                  </div>
                  <div className="space-y-1.5 font-sans">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Número PV:</span>
                      <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono font-bold text-blue-600 dark:text-blue-400">
                        0002 (o correlativo libre)
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Nombre Fantasía:</span>
                      <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-medium">
                        {businessName || "Local de Ventas"}
                      </span>
                    </div>
                    <div className="pt-1">
                      <span className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                        Sistema a Asociar:
                      </span>
                      <div className="mt-0.5 p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold text-[11px] flex items-center justify-between">
                        <span>Factura Electrónica - Web Services</span>
                        <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-mono uppercase">
                          ✓ ELEGIR ESTE
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                * No seleccionar "Facturador Web" ni "Controlador Fiscal", ya que no admiten sincronización por sistema.
              </p>
            </div>

            {/* PASO 2 */}
            <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/40 p-4 space-y-3 print:border-black print:bg-white flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0 print:bg-black print:text-white">
                    2
                  </span>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm print:text-black">
                    Cargar el Certificado (.csr) en ARCA
                  </h4>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] print:text-slate-700">
                  Ingresar en <strong>"Administración de Certificados Digitales"</strong> &gt; presionar botón <strong>"Agregar Alias"</strong>.
                </p>

                {/* Mockup Ilustrativo Portal AFIP */}
                <div className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 space-y-2 font-mono text-[11px]">
                  <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 pb-1 text-[10px] text-slate-500 font-sans font-bold">
                    <Key size={11} className="text-amber-500" /> AFIP &bull; Agregar Alias de Certificado
                  </div>
                  <div className="space-y-1.5 font-sans">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Alias:</span>
                      <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {alias || "pos-v2"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                        Cargar archivo Solicitud (.csr):
                      </span>
                      <div className="mt-0.5 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-700 flex items-center justify-between text-blue-900 dark:text-blue-200">
                        <span className="font-mono text-[11px] font-semibold">
                          📄 pedido_arca_{cleanCuit}.csr
                        </span>
                        <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded font-bold">
                          Subir archivo
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                * Presionar "Agregar Alias" para que ARCA procese la firma del certificado oficial.
              </p>
            </div>

            {/* PASO 3 */}
            <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/40 p-4 space-y-3 print:border-black print:bg-white flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0 print:bg-black print:text-white">
                    3
                  </span>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm print:text-black">
                    Asociar Servicio "wsfe" en Relaciones
                  </h4>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] print:text-slate-700">
                  Ir a <strong>"Administrador de Relaciones de Clave Fiscal"</strong> &gt; <em>Nueva Relación</em> &gt; <em>Buscar Servicio</em>.
                </p>

                {/* Mockup Ilustrativo Portal AFIP */}
                <div className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 space-y-2 font-mono text-[11px]">
                  <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 pb-1 text-[10px] text-slate-500 font-sans font-bold">
                    <Link2 size={11} className="text-purple-500" /> AFIP &bull; Delegación de Web Service
                  </div>
                  <div className="space-y-1 font-sans text-[11px]">
                    <div className="p-1.5 rounded bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-500 dark:text-slate-400">1. Servicio: </span>
                      <strong className="text-slate-900 dark:text-slate-100">AFIP &gt; Web Services &gt; Facturación Electrónica (wsfe)</strong>
                    </div>
                    <div className="p-1.5 rounded bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-500 dark:text-slate-400">2. Representante: </span>
                      <span className="text-blue-600 dark:text-blue-400 font-bold">Buscar &gt; Computador Fiscal &gt; {alias || "pos-v2"}</span>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                * Con este paso se autoriza al alias a solicitar CAE para Facturas A, B y C.
              </p>
            </div>

            {/* PASO 4 */}
            <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/40 p-4 space-y-3 print:border-black print:bg-white flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shrink-0 print:bg-black print:text-white">
                    4
                  </span>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm print:text-black">
                    Descargar Certificado (.crt) y Vincular
                  </h4>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] print:text-slate-700">
                  Volver a <em>Administración de Certificados</em> &gt; en el alias <strong>{alias || "pos-v2"}</strong> hacer clic en <em>"Ver"</em> y <strong>Descargar</strong>.
                </p>

                {/* Mockup Ilustrativo Portal AFIP */}
                <div className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 space-y-2 font-mono text-[11px]">
                  <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 pb-1 text-[10px] text-slate-500 font-sans font-bold">
                    <Download size={11} className="text-emerald-500" /> AFIP &bull; Certificado Digital Generado
                  </div>
                  <div className="space-y-1.5 font-sans">
                    <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 flex items-center justify-between text-emerald-950 dark:text-emerald-200">
                      <div>
                        <p className="font-bold text-[11px]">certificado_{alias}.crt</p>
                        <p className="text-[10px] text-emerald-700 dark:text-emerald-400">Válido por 2 años</p>
                      </div>
                      <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-bold">
                        Descargar .crt
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                ✓ Subir este archivo .crt en el POS y la facturación quedará 100% activa.
              </p>
            </div>
          </div>

          {/* OPENSSL ALTERNATIVO PARA EL CONTADOR */}
          <div className="rounded-xl border border-slate-300 dark:border-slate-700 p-4 space-y-2 text-xs bg-slate-50/70 dark:bg-slate-800/40 print:border-slate-400 print:bg-white">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 print:text-black">
                <Key size={14} className="text-slate-600 print:text-black" />
                Opción de Terminal para Estudio Contable (OpenSSL)
              </span>
              <button
                type="button"
                onClick={handleCopyOpenSsl}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline print:hidden cursor-pointer"
              >
                <Copy size={12} /> Copiar comando
              </button>
            </div>
            <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap select-all border border-slate-700 print:bg-slate-100 print:text-black print:border-black">
              {openSslCmd}
            </pre>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 print:text-slate-600">
              Genera simultáneamente la Clave Privada (.key) de 2048 bits y la Solicitud (.csr) con el CUIT {cleanCuit}.
            </p>
          </div>

          {/* PIE DE PÁGINA IMPRESIÓN */}
          <div className="border-t border-slate-300 dark:border-slate-700 pt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 print:border-black print:text-black">
            <span>POS V2 - Sistema de Facturación Electrónica Oficial ARCA (Resolución General AFIP 4291/2018)</span>
            <span className="font-mono">{new Date().toLocaleDateString("es-AR")}</span>
          </div>
        </div>

        {/* PIE MODAL (Oculto al imprimir) */}
        <footer className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 print:hidden bg-slate-50 dark:bg-slate-800/60 rounded-b-2xl">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Sparkles size={14} className="text-amber-500" />
            Al presionar "Descargar PDF", elegí la opción "Guardar como PDF" en tu navegador.
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer size={14} />
              Descargar PDF / Imprimir
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
