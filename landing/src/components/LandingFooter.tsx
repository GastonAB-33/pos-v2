import React from "react";
import { JirehLogo } from "./brand/JirehLogo";
import { POS_LOGIN_URL, SUPPORT_WHATSAPP_PHONE } from "../config/app-urls";
import { Sparkles, MessageSquare, Mail, Phone, ShieldCheck, ArrowRight, Shield } from "lucide-react";

interface LandingFooterProps {
  onOpenFreeTrial: () => void;
  onOpenTerms?: () => void;
  onOpenPrivacy?: () => void;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({
  onOpenFreeTrial,
  onOpenTerms,
  onOpenPrivacy,
}) => {
  return (
    <footer className="bg-slate-900 text-slate-300 relative overflow-hidden">
      
      {/* Banner de llamada final previa al footer */}
      <div className="border-b border-white/10 py-14 bg-gradient-to-r from-sky-950/40 via-slate-900 to-emerald-950/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3.5 py-1 text-xs font-bold text-amber-300 border border-amber-500/30">
            <Sparkles className="h-3.5 w-3.5" />
            7 Días Sin Cargo
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            ¿Listo para llevar el control de tu negocio al siguiente nivel?
          </h2>
          <p className="mt-3 text-base text-slate-400 max-w-2xl mx-auto">
            Configura tus productos, cajas y listas de precios en menos de 5 minutos y comienza a vender hoy mismo.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onOpenFreeTrial}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00B5C8] via-[#10B981] to-[#FF7800] px-8 py-3.5 text-base font-extrabold text-white shadow-xl hover:scale-[1.02] active:scale-[0.98] transition"
            >
              <span>Comenzar Prueba Gratuita</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <a
              href={`https://wa.me/${SUPPORT_WHATSAPP_PHONE}?text=${encodeURIComponent("¡Hola! Me gustaría hacer unas consultas sobre Jireh POS.")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 px-6 py-3.5 text-base font-semibold text-white transition"
            >
              <MessageSquare className="h-4 w-4 text-[#25D366]" />
              <span>Consultar por WhatsApp</span>
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Columna 1: Marca y descripción */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-2">
              <JirehLogo size="md" />
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Software de punto de venta y gestión integral diseñado para optimizar almacenes, minimarkets, ferreterías y comercios minoristas de toda Argentina.
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
              <ShieldCheck className="h-4 w-4" />
              <span>Alojamiento Seguro • Modo Offline</span>
            </div>
          </div>

          {/* Columna 2: Módulos clave */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-white tracking-wider uppercase">Módulos</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>Punto de Venta Ultra Rápido</li>
              <li>Control de Stock en Tiempo Real</li>
              <li>Facturación Electrónica ARCA (AFIP)</li>
              <li>Cuentas Corrientes y Saldos</li>
              <li>Múltiples Listas de Precios</li>
              <li>Reportes de Ganancia y Caja</li>
            </ul>
          </div>

          {/* Columna 3: Rubros adaptados */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-white tracking-wider uppercase">Rubros</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>Almacenes y Minimarkets</li>
              <li>Ferreterías y Corralones</li>
              <li>Fiambrerías y Carnicerías</li>
              <li>Kioscos y Maxikioscos 24hs</li>
              <li>Dietéticas y Frutos Secos</li>
              <li>Bazar y Limpieza</li>
            </ul>
          </div>

          {/* Columna 4: Contacto directo */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-white tracking-wider uppercase">Atención al Cliente</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <a
                  href={`https://wa.me/${SUPPORT_WHATSAPP_PHONE}?text=${encodeURIComponent("¡Hola equipo de Jireh! Deseo información comercial.")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition"
                >
                  WhatsApp: Asesor en línea (+54 9 266 468-9173)
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-sky-400 shrink-0" />
                <span>contacto@jirehpos.com</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-amber-400 shrink-0" />
                <span>Lunes a Sábado de 08:00 a 20:00 hs</span>
              </li>
            </ul>

            <div className="pt-2">
              <a
                href={POS_LOGIN_URL}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition"
              >
                <span>Acceso Clientes Registrados →</span>
              </a>
            </div>
          </div>

        </div>

        {/* Barra inferior de copyright y cumplimiento legal */}
        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© 2026 Jireh POS. Todos los derechos reservados. Sistema certificado bajo estándar Security Shield.</p>
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <button
              onClick={onOpenTerms}
              className="hover:text-slate-300 transition underline-offset-2 hover:underline"
            >
              Términos de Servicio
            </button>
            <button
              onClick={onOpenPrivacy}
              className="hover:text-slate-300 transition underline-offset-2 hover:underline"
            >
              Política de Privacidad
            </button>
            <button
              onClick={onOpenPrivacy}
              className="hover:text-slate-300 transition underline-offset-2 hover:underline flex items-center gap-1"
            >
              <Shield className="h-3 w-3 text-emerald-500" />
              <span>Seguridad de Datos</span>
            </button>
          </div>
        </div>
      </div>

    </footer>
  );
};
