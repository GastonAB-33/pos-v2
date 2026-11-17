import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, ArrowLeft, Lock, FileText, Database, UserCheck, RefreshCw } from "lucide-react";

export const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header de página */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <div>
              <div className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                Seguridad & Cumplimiento Normativo
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Política de Privacidad y Protección de Datos
              </h1>
            </div>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver al Login</span>
          </Link>
        </div>

        {/* Contenido normativo */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-10 shadow-sm space-y-8 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              1. Identidad del Responsable y Principio de Minimización
            </h2>
            <p>
              Jireh POS Cloud Solutions actúa como responsable y custodio del tratamiento de los datos gestionados en su plataforma.
              Conforme al principio de minimización de datos (RGPD / Habeas Data), el sistema únicamente almacena y procesa aquellos
              campos estrictamente indispensables para la operativa del punto de venta, control de inventario, emisión de comprobantes fiscales
              homologados y autenticación de usuarios.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              2. Finalidad del Tratamiento y Base Jurídica
            </h2>
            <p>
              Los datos comerciales de cada comercio (catálogos de productos, ventas registradas, saldos de cuentas corrientes de clientes y proveedores)
              son procesados exclusivamente bajo la base jurídica del cumplimiento contractual del servicio y el cumplimiento de normas fiscales
              vigentes aplicables a la facturación electrónica ante ARCA (ex-AFIP).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Lock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              3. Prohibición Estricta de Entrenamiento de Modelos de IA
            </h2>
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-medium text-slate-700 dark:text-slate-200">
              🔒 <strong>Garantía de Confidencialidad Comercial:</strong> Jireh POS garantiza que los datos de operaciones, costos,
              precios, márgenes de ganancia, compras o clientes de ningún comercio suscriptor serán utilizados para el entrenamiento,
              reentrenamiento o fine-tuning de modelos generativos de inteligencia artificial propios ni de terceros.
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              4. Aislamiento Multi-Tenant y Subprocesadores de Infraestructura
            </h2>
            <p>
              Cada comercio cuenta con un entorno aislado a nivel de base de datos mediante políticas de <strong>Row Level Security (RLS)</strong>
              en PostgreSQL. El tratamiento tecnológico se ejecuta sobre infraestructura de primer nivel bajo acuerdos de procesamiento seguro (DPA):
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-500 dark:text-slate-400">
              <li><strong>Supabase Inc.</strong>: Base de datos Postgres administrada, respaldo continuo y cifrado en tránsito y reposo.</li>
              <li><strong>Vercel Inc.</strong>: Alojamiento perimetral con forzado estricto de HTTPS y cabeceras HTTP de seguridad (CSP, HSTS).</li>
              <li><strong>ARCA / AFIP</strong>: Web Services oficiales para obtención de CAE fiscal.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              5. Derechos de Acceso, Portabilidad y Supresión (Derecho al Olvido)
            </h2>
            <p>
              Todo titular de cuenta puede descargar en cualquier momento la totalidad de sus catálogos, registros de stock y movimientos
              en formato Excel/CSV. Asimismo, ante la cancelación de su suscripción, podrá solicitar la supresión definitiva de su comercio
              y credenciales de acceso enviando una solicitud formal a <span className="font-semibold text-blue-600 dark:text-blue-400">privacidad@jirehpos.com</span>.
            </p>
          </section>

        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 pb-8">
          © 2026 Jireh POS • Manual Técnico de Ciberseguridad y Protección de Datos
        </div>

      </div>
    </div>
  );
};
