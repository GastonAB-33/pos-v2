import React from "react";
import { JirehLogo } from "@/components/brand/JirehLogo";
import { Link } from "react-router-dom";
import { routePaths } from "@/config/routes";
import { Sparkles, MessageSquare, Mail, Phone, ShieldCheck, ArrowRight } from "lucide-react";

interface LandingFooterProps {
  onOpenFreeTrial: () => void;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({ onOpenFreeTrial }) => {
  return (
    <footer className="bg-slate-900 text-slate-300 relative overflow-hidden">
      
      {/* Banner de llamada final previa al footer */}
      <div className="border-b border-white/10 py-14 bg-gradient-to-r from-sky-950/40 via-slate-900 to-emerald-950/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3.5 py-1 text-xs font-bold text-amber-300 border border-amber-500/30">
            <Sparkles className="h-3.5 w-3.5" />
            15 Días Sin Cargo
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
              <Sparkles className="h-4 w-4 text-amber-300" />
              <span>Activar mis 15 Días Gratis</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <Link
              to={routePaths.login}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-bold text-white hover:bg-white/10 transition"
            >
              <span>Acceder al Sistema</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Contenido del Footer */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Columna 1: Marca Jireh */}
          <div className="md:col-span-1 space-y-4">
            <JirehLogo size="md" variant="light" showTagline={true} />
            <p className="text-xs text-slate-400 leading-relaxed">
              Software de punto de venta, inventario en tiempo real y facturación electrónica en la nube. Diseñado para potenciar el crecimiento de comerciantes y negocios.
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
              <span>Plataforma Segura SSL 256-bit</span>
            </div>
          </div>

          {/* Columna 2: Navegación */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Navegación
            </h4>
            <ul className="space-y-2 text-xs">
              <li><a href="#ventajas" className="hover:text-white transition">Ventajas Clave</a></li>
              <li><a href="#herramientas" className="hover:text-white transition">Herramientas y Módulos</a></li>
              <li><a href="#calculadora" className="hover:text-white transition">Calculadora de Ahorro</a></li>
              <li><a href="#planes" className="hover:text-white transition">Planes y Precios</a></li>
              <li><a href="#testimonios" className="hover:text-white transition">Casos de Éxito</a></li>
              <li><a href="#faq" className="hover:text-white transition">Preguntas Frecuentes</a></li>
            </ul>
          </div>

          {/* Columna 3: Funciones Principales */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Módulos Jireh
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>Punto de Venta Ultra Rápido</li>
              <li>Control de Stock e Inventario</li>
              <li>Arqueos de Caja y Cierres Ciegos</li>
              <li>Cuentas Corrientes y Clientes</li>
              <li>Listas de Precios y Promociones</li>
              <li>Modo Offline PWA sin Internet</li>
            </ul>
          </div>

          {/* Columna 4: Contacto y Soporte */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Atención y Soporte
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-emerald-400 shrink-0" />
                <a
                  href="https://wa.me/?text=Hola%20Jireh%20POS!%20Deseo%20informaci%C3%B3n%20comercial."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition"
                >
                  WhatsApp: Asesor en línea
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
              <Link
                to={routePaths.login}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition"
              >
                <span>Acceso Clientes Registrados →</span>
              </Link>
            </div>
          </div>

        </div>

        {/* Barra inferior de copyright */}
        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© 2026 Jireh POS. Todos los derechos reservados.</p>
          <div className="flex items-center gap-6">
            <span className="hover:text-slate-400 cursor-pointer">Términos de Servicio</span>
            <span className="hover:text-slate-400 cursor-pointer">Política de Privacidad</span>
            <span className="hover:text-slate-400 cursor-pointer">Seguridad de Datos</span>
          </div>
        </div>
      </div>

    </footer>
  );
};
