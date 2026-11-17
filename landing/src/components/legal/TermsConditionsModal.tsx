import React from "react";
import { X, FileCheck, CheckCircle2, AlertCircle, Clock, RotateCcw, Shield } from "lucide-react";

interface TermsConditionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TermsConditionsModal: React.FC<TermsConditionsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl text-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <FileCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Términos y Condiciones de Uso</h2>
              <p className="text-xs text-slate-400">Transparencia Comercial, SLA y Derechos del Suscriptor</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 space-y-6 text-sm leading-relaxed text-slate-300">
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-400" />
              1. Alcance del Servicio SaaS
            </h3>
            <p>
              Jireh POS provee una solución informática en la nube de gestión comercial que incluye módulos de
              ventas, inventario, facturación electrónica, tesorería y cuentas corrientes. El servicio se contrata
              en modalidad de suscripción periódica sin permanencia obligatoria.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-blue-400" />
              2. Equidad en la Cancelación y Política de Reembolsos
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>
                <strong>Cancelación ágil:</strong> Cancelar la suscripción es tan directo como el proceso de alta.
                El usuario puede solicitar la baja de su plan en cualquier momento sin penalizaciones ni cláusulas de retención.
              </li>
              <li>
                <strong>Política de reembolso claro:</strong> Si durante los primeros 30 días de servicio pago el usuario
                manifiesta inconformidad técnica o operativa fundamentada, se reembolsará el 100% del importe abonado.
              </li>
              <li>
                <strong>Sin tarifas ocultas:</strong> Los planes exhibidos representan el valor final del abono. No se aplicarán
                costos adicionales sorpresivos por soporte técnico ni actualizaciones estándar.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              3. Compromiso de Disponibilidad (SLA)
            </h3>
            <p>
              Jireh POS asume un compromiso objetivo de disponibilidad mensual del <strong>99.5%</strong> para el acceso
              a la plataforma en la nube, sujeto a las condiciones operativas de la infraestructura de Supabase y Vercel.
              En caso de pérdida de conexión a internet local, la terminal POS cuenta con modo offline contingente para
              seguir facturando ventas locales.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-teal-400" />
              4. Período de Prueba Gratuito de 7 Días
            </h3>
            <p>
              El alta de la prueba gratuita no requiere ingresar tarjetas de crédito ni datos de pago. Transcurridos los
              7 días, la cuenta pasará a estado de consulta hasta que el usuario confirme voluntariamente su suscripción.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400" />
              5. Datos de Contacto Empresariales
            </h3>
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1">
              <p><strong>Razón Operativa:</strong> Jireh POS Cloud Solutions</p>
              <p><strong>Atención al Cliente:</strong> soporte@jirehpos.com | +54 9 266 468-9173</p>
              <p><strong>Horarios:</strong> Lunes a Sábado de 08:00 a 20:00 hs (Argentina)</p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-800 p-4 bg-slate-950/60">
          <button
            onClick={onClose}
            className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-6 py-2.5 text-sm font-bold text-white transition active:scale-[0.98]"
          >
            He Leído y Acepto los Términos
          </button>
        </div>

      </div>
    </div>
  );
};
