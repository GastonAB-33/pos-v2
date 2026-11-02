import type { FC } from "react";
import { X, HelpCircle, CheckCircle2, AlertCircle, FileText, Download } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const LibroIvaHelpModal: FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
              <HelpCircle className="h-5 w-5" />
            </span>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Guía Fácil: Libro IVA para tu Negocio y tu Contador
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* CONTENT */}
        <div className="mt-4 max-h-[70vh] space-y-4 overflow-y-auto pr-1 text-xs text-slate-700 dark:text-slate-300">
          {/* SECCIÓN 1 */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
            <h4 className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              1. ¿Cómo funciona el IVA en el sistema?
            </h4>
            <ul className="mt-2 space-y-1.5 text-slate-600 dark:text-slate-300">
              <li>
                <strong>Débito Fiscal (Tus Ventas):</strong> Es el IVA que le cobrás a tus clientes cuando emitís una factura. Ese dinero le corresponde a ARCA.
              </li>
              <li>
                <strong>Crédito Fiscal (Tus Compras):</strong> Es el IVA que tus proveedores te cobran en las <strong>Facturas A</strong>. Ese dinero se resta del débito fiscal a tu favor.
              </li>
              <li>
                <strong>Saldo Técnico:</strong> Si el débito es mayor al crédito, se paga la diferencia a ARCA. Si compraste más mercadería de la que vendiste, te queda saldo a favor para el mes siguiente.
              </li>
            </ul>
          </div>

          {/* SECCIÓN 2 */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
            <h4 className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
              <FileText className="h-4 w-4 text-blue-600" />
              2. ¿Qué tenés que registrar en el día a día?
            </h4>
            <div className="mt-2 space-y-2 text-slate-600 dark:text-slate-300">
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">En Ventas (POS / Facturación):</p>
                <p>
                  El sistema ya hace todo solo: emite la factura electrónica a ARCA con CAE y calcula el neto y el IVA automáticamente. Si el cliente pide Factura A, simplemente ingresá su CUIT.
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">En Compras (Módulo de Compras):</p>
                <p>
                  Cada vez que un proveedor te traiga mercadería o un gasto operativo:
                </p>
                <ol className="mt-1 list-decimal pl-5 space-y-1">
                  <li>Elegí al <strong>Proveedor con su CUIT</strong>.</li>
                  <li>Seleccioná si es <strong>Factura A, B, C o Nota de Crédito</strong>.</li>
                  <li>Copiá el <strong>Número de Factura</strong> que figura en el papel/PDF (ej: 0001-00012345).</li>
                  <li>Verificá la <strong>Fecha</strong> y el <strong>IVA (21% o 10.5%)</strong>.</li>
                </ol>
              </div>
            </div>
          </div>

          {/* SECCIÓN 3 */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 dark:border-amber-900/40 dark:bg-amber-950/20">
            <h4 className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              3. ¿Qué pasa si el proveedor es Monotributista (Factura C)?
            </h4>
            <p className="mt-1.5 text-amber-800 dark:text-amber-300">
              Las facturas de monotributistas <strong>no descuentan IVA</strong> porque no tienen IVA discriminado. En el sistema seleccionás <strong>Factura C</strong>: el importe total se registrará como <em>Operaciones que no generan Crédito Fiscal</em> (justifica los gastos de tu negocio ante el contador sin restar IVA de ventas).
            </p>
          </div>

          {/* SECCIÓN 4 */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
            <h4 className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
              <Download className="h-4 w-4 text-purple-600" />
              4. ¿Qué le mandás a tu contador a fin de mes?
            </h4>
            <p className="mt-1.5 text-slate-600 dark:text-slate-300">
              Apenas termine el mes, entrás a esta pantalla de <strong>Libro IVA Digital</strong>, elegís el mes que cerró (por ejemplo, Septiembre 2026) y hacés clic en:
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-md bg-white px-2 py-1 font-mono text-[11px] font-semibold text-slate-800 shadow-xs dark:bg-slate-800 dark:text-slate-200">
                📗 Descargar Excel Contador
              </span>
              <span className="rounded-md bg-white px-2 py-1 font-mono text-[11px] font-semibold text-slate-800 shadow-xs dark:bg-slate-800 dark:text-slate-200">
                🖨️ Imprimir / Guardar PDF (F. 2083)
              </span>
              <span className="rounded-md bg-white px-2 py-1 font-mono text-[11px] font-semibold text-slate-800 shadow-xs dark:bg-slate-800 dark:text-slate-200">
                💾 Archivos TXT para ARCA
              </span>
            </div>
            <p className="mt-2 text-slate-500 dark:text-slate-400">
              Le enviás esos archivos por email o WhatsApp y tu contador tiene todo listo para presentar la declaración jurada en 5 minutos.
            </p>
          </div>
        </div>

        {/* FOOTER */}
        <div className="mt-5 flex justify-end border-t border-slate-200 pt-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition"
          >
            Entendido, ¡gracias!
          </button>
        </div>
      </div>
    </div>
  );
};
