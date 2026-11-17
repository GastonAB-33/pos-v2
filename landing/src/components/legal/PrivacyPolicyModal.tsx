import React from "react";
import { X, ShieldCheck, Lock, FileText, Database, UserCheck, RefreshCw } from "lucide-react";

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl text-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Política de Privacidad y Protección de Datos</h2>
              <p className="text-xs text-slate-400">Estándar de Seguridad y Cumplimiento Normativo (POS V2)</p>
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
              <FileText className="h-4 w-4 text-blue-400" />
              1. Identidad del Responsable y Principio de Minimización
            </h3>
            <p>
              Jireh POS actúa como responsable del tratamiento de los datos operativos y comerciales de su plataforma.
              Conforme al principio de minimización de datos, únicamente solicitamos la información estrictamente
              necesaria para el funcionamiento del Punto de Venta, facturación legal (ARCA/AFIP) y gestión de usuarios.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Database className="h-4 w-4 text-emerald-400" />
              2. Finalidad del Tratamiento y Bases Jurídicas
            </h3>
            <p>
              Los datos recopilados (ventas, catálogo de productos, clientes de cuenta corriente y comprobantes fiscales)
              se procesan exclusivamente para:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>Prestación ininterrumpida de los servicios de facturación, caja y control de inventario.</li>
              <li>Cumplimiento de las obligaciones fiscales ante ARCA (ex-AFIP) mediante Web Services seguros.</li>
              <li>Soporte técnico, mantenimiento y prevención de accesos indebidos o ciberamenazas.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Lock className="h-4 w-4 text-purple-400" />
              3. Prohibición de Entrenamiento con Inteligencia Artificial
            </h3>
            <p className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-300 font-medium">
              🔒 <strong>Garantía de Privacidad Comercial:</strong> Jireh POS garantiza expresamente que ningún dato de ventas,
              márgenes, costos, transacciones ni listas de clientes ingresados por los usuarios será utilizado para
              entrenar o ajustar modelos de inteligencia artificial propios o de terceros.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-amber-400" />
              4. Proveedores Tecnológicos y Subprocesadores
            </h3>
            <p>
              El almacenamiento y procesamiento de datos se efectúa bajo acuerdos de tratamiento de datos (DPA) con:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li><strong>Supabase Inc.</strong>: Base de datos Postgres en la nube con cifrado y RLS multi-tenant.</li>
              <li><strong>Vercel Inc.</strong>: Alojamiento perimetral con cabeceras HTTP de seguridad y forzado HTTPS.</li>
              <li><strong>Mercado Pago / ARCA</strong>: Pasarelas seguras y emisión de comprobantes fiscales homologados.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-teal-400" />
              5. Derechos del Titular (Acceso, Rectificación y Supresión)
            </h3>
            <p>
              El titular de la cuenta puede ejercer en cualquier momento sus derechos de acceso, descarga completa
              de datos en formatos abiertos (Excel/CSV) y eliminación definitiva de su comercio y cuentas asociadas
              escribiendo a <span className="text-blue-400 font-semibold">privacidad@jirehpos.com</span>.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-800 p-4 bg-slate-950/60">
          <button
            onClick={onClose}
            className="rounded-2xl bg-blue-600 hover:bg-blue-700 px-6 py-2.5 text-sm font-bold text-white transition active:scale-[0.98]"
          >
            Entendido y Aceptar
          </button>
        </div>

      </div>
    </div>
  );
};
