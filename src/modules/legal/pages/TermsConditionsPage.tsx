import React from "react";
import { Link } from "react-router-dom";
import { FileCheck, ArrowLeft, Shield, RotateCcw, Clock, CheckCircle2, AlertCircle } from "lucide-react";

export const TermsConditionsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header de página */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400">
              <FileCheck className="h-8 w-8" />
            </div>
            <div>
              <div className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                Transparencia Comercial & SLA
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Términos y Condiciones de Uso
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
              <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              1. Alcance y Naturaleza del Servicio SaaS
            </h2>
            <p>
              Jireh POS brinda una plataforma de software en la nube bajo modelo de suscripción (Software as a Service) orientada a la
              administración integral de puntos de venta, facturación electrónica, control de inventario y tesorería comercial.
              El servicio no exige contratos de permanencia forzosa y puede utilizarse tanto en línea como a través de su motor offline contingente.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              2. Equidad en la Cancelación y Transparencia en Precios
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-500 dark:text-slate-400">
              <li>
                <strong>Cancelación sin trabas:</strong> El suscriptor puede dar de baja su servicio en cualquier momento desde su panel
                o notificándolo a los canales de atención, cancelando cargos futuros sin penalidad ni costos de rescisión.
              </li>
              <li>
                <strong>Garantía de reembolso de 30 días:</strong> Si durante los primeros 30 días de suscripción el sistema no se ajusta
                a las funcionalidades técnicas comprometidas, el suscriptor podrá solicitar el reintegro total del importe abonado.
              </li>
              <li>
                <strong>Cero tarifas ocultas:</strong> Las tarifas publicadas constituyen el precio final mensual o anual. No existen
                cargos ocultos por soporte técnico, mantenimiento de base de datos o actualizaciones regulares.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              3. Compromiso de Disponibilidad del Servicio (SLA)
            </h2>
            <p>
              Jireh POS establece un objetivo de disponibilidad del servicio del <strong>99.5%</strong> del tiempo mensual. Los períodos de
              mantenimiento programado se notificarán con anticipación en horarios de bajo impacto operativo. En eventualidades de interrupción
              del enlace a internet por causas ajenas, la terminal POS mantiene su operatoria de venta local mediante su base de datos indexada.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              4. Período de Prueba Gratuita de 7 Días
            </h2>
            <p>
              El acceso a la prueba gratuita de 7 días se activa sin requerir ingreso de tarjetas de crédito o instrumentos de pago.
              Finalizado el período de prueba, el titular decide voluntariamente si contrata un abono comercial o desiste del servicio sin cargo alguno.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              5. Canales de Contacto y Atención de Propiedad Intelectual
            </h2>
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <p><strong>Identificación:</strong> Jireh POS Cloud Solutions</p>
              <p><strong>Canal de Reclamos y Soporte:</strong> soporte@jirehpos.com | +54 9 266 468-9173</p>
              <p><strong>Propiedad Intelectual / Copyright:</strong> legal@jirehpos.com</p>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 pb-8">
          © 2026 Jireh POS • Transparencia Comercial y Erradicación de Patrones Engañosos
        </div>

      </div>
    </div>
  );
};
