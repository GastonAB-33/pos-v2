import React, { useState } from "react";
import { ChevronDown, ChevronUp, MessageSquare } from "lucide-react";

export const LandingFaq: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: "¿Cómo funciona la prueba gratuita de 15 días? ¿Tengo que ingresar una tarjeta?",
      a: "¡No necesitas tarjeta de crédito! La prueba de 15 días es 100% gratuita y sin compromiso. Solo ingresas el nombre de tu comercio, tu email y contraseña para empezar a usar inmediatamente todas las funciones del sistema.",
    },
    {
      q: "¿Qué sucede cuando terminan los 15 días de prueba?",
      a: "Al finalizar el período de 15 días, todos tus productos, stock cargado y configuraciones permanecen intactos y resguardados en tu base de datos. Puedes elegir cualquiera de nuestros planes: 'Estoy Arrancando' ($25.000 ARS/mes), 'Me Estoy Formalizando' ($40.000 ARS/mes con Facturación AFIP) o 'Lo Quiero a Mi Manera' ($60.000 ARS/mes con ajustes a medida).",
    },
    {
      q: "¿Cómo funciona el modelo por sucursal y la carga masiva de datos?",
      a: "Cada sucursal adicional abona su canon mensual correspondiente, permitiendo escalar de forma predecible según el crecimiento de tu negocio. Además, todos los planes incluyen asistencia transversal para la carga masiva inicial de listas de precios, proveedores y stock.",
    },
    {
      q: "¿Qué medios de pago y pasarelas aceptan para contratar el servicio?",
      a: "Puedes abonar con Mercado Pago (saldo en cuenta, dinero disponible o QR), tarjetas de crédito y débito (Visa, Mastercard, Cabal, American Express) y Transferencia Bancaria Directa (Alias/CBU). Ofrecemos pagos mensuales o anuales con 20% de descuento.",
    },
    {
      q: "¿Puedo usar Jireh POS en varias computadoras, tablets o celulares a la vez?",
      a: "Sí. Jireh POS es 100% en la nube y multidispositivo. Puedes tener una computadora cobrando en el mostrador, otra terminal en el depósito recibiendo mercadería y tú mismo supervisar las estadísticas y caja desde tu celular al mismo tiempo.",
    },
    {
      q: "¿El sistema funciona si se corta internet en mi comercio?",
      a: "Totalmente. Jireh POS cuenta con tecnología PWA y almacenamiento local offline. Si se corta la conexión WiFi, el punto de venta continúa cobrando normalmente y emitiendo tickets. En cuanto regresa la conexión, sincroniza todas las operaciones a la nube automáticamente.",
    },
    {
      q: "¿Puedo importar mi lista actual de productos desde un Excel?",
      a: "Sí, disponemos de importación y exportación masiva de productos en formato Excel (.xlsx). Además, nuestro equipo de soporte técnico puede asistirte de manera remota para dejar todo tu inventario listo en minutos.",
    },
    {
      q: "¿Ofrecen soporte técnico y capacitación para mis cajeros?",
      a: "Sí, todos los planes cuentan con soporte técnico humano a través de WhatsApp y sistema de tickets directos. También disponemos de tutoriales paso a paso y podemos coordinar una videollamada para capacitar a tu equipo.",
    },
  ];

  return (
    <section id="faq" className="py-20 bg-slate-50 relative">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-800 uppercase tracking-wider">
            Preguntas Frecuentes
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Resolvemos todas tus dudas sobre{" "}
            <span className="bg-gradient-to-r from-sky-600 via-emerald-600 to-amber-600 bg-clip-text text-transparent">
              Jireh POS
            </span>
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Todo lo que necesitas saber antes de comenzar tus 15 días gratis.
          </p>
        </div>

        <div className="mt-12 space-y-3.5">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200 bg-white transition-all overflow-hidden shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between p-5 text-left text-sm sm:text-base font-bold text-slate-900 hover:text-sky-700 transition"
                >
                  <span className="pr-4">{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp className="h-5 w-5 text-sky-600 shrink-0" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-slate-400 shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 animate-in fade-in">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Banner de contacto WhatsApp */}
        <div className="mt-12 text-center rounded-2xl bg-white p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-left">
            <h4 className="text-sm font-bold text-slate-900">¿Tienes otra consulta específica sobre tu comercio?</h4>
            <p className="text-xs text-slate-500">Nuestro equipo comercial y técnico te responde en menos de 10 minutos.</p>
          </div>
          <a
            href="https://wa.me/?text=Hola%20Jireh%20POS!%20Tengo%20una%20consulta%20antes%20de%20iniciar%20mi%20prueba%20gratuita."
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition shrink-0"
          >
            <MessageSquare className="h-4 w-4" />
            <span>Consultar por WhatsApp</span>
          </a>
        </div>

      </div>
    </section>
  );
};
