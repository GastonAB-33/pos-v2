import React, { useState } from "react";
import { Check, Sparkles, ShieldCheck, CreditCard, UploadCloud, Store } from "lucide-react";
import type { PlanDetails } from "./PaymentGatewayModal";

interface LandingPricingProps {
  onOpenFreeTrial: (planName: string) => void;
  onOpenPayment: (plan: PlanDetails) => void;
}

export const LandingPricing: React.FC<LandingPricingProps> = ({
  onOpenFreeTrial,
  onOpenPayment,
}) => {
  const [period, setPeriod] = useState<"monthly" | "annual">("monthly");

  const plans = [
    {
      id: "estoy-arrancando",
      name: "Estoy Arrancando",
      tag: "Ideal para iniciar",
      subtitle: "Para emprendimientos iniciales, kioscos y comercios barriales que buscan ordenar su flujo diario sin complicaciones tributarias.",
      monthlyPrice: 25000,
      annualPricePerMonth: 20000,
      popular: false,
      color: "sky",
      fiscalNote: "Facturación electrónica no requerida",
      support: "Soporte Estándar / Asincrónico (tickets y mensajería en horario comercial)",
      features: [
        "Punto de venta (POS) ágil para cobro inmediato en mostrador",
        "Gestión de caja diaria (aperturas, cierres, control de efectivo y arqueos)",
        "Control de inventario, stock crítico y alertas automáticas de reposición",
        "Asistencia para carga masiva inicial de artículos y listas de precios",
        "Reportes esenciales de ventas diarias y márgenes comerciales",
        "Sincronización móvil para modo escáner vía QR / WebSockets",
      ],
      notIncluded: [
        "Módulo de facturación electrónica AFIP",
        "Reportes avanzados de IVA ventas",
        "Desarrollo de mejoras a medida",
      ],
    },
    {
      id: "me-estoy-formalizando",
      name: "Me Estoy Formalizando",
      tag: "El más elegido",
      subtitle: "Para comercios consolidados en proceso de formalización fiscal ante AFIP que manejan mayor rotación y volumen.",
      monthlyPrice: 40000,
      annualPricePerMonth: 32000,
      popular: true,
      color: "emerald",
      fiscalNote: "Facturación Electrónica AFIP Integrada (A, B, C, NC/ND)",
      support: "Soporte Prioritario en mostrador y emisión fiscal",
      features: [
        "Incluye la totalidad de funciones de 'Estoy Arrancando'",
        "Facturación Electrónica Integrada: emisión automática de comprobantes fiscales legales",
        "Actualización y sincronización masiva periódica de listas y costos de proveedores",
        "Informes analíticos avanzados de rendimiento financiero y rentabilidad neta",
        "Reportes impositivos y Libro de IVA Ventas digital",
        "Control de cuentas corrientes y límites de crédito a clientes",
        "Soporte prioritario ante incidencias operativas de cobro y AFIP",
      ],
      notIncluded: [
        "Desarrollo de mejoras y ajustes personalizados a medida",
      ],
    },
    {
      id: "lo-quiero-a-mi-manera",
      name: "Lo Quiero a Mi Manera",
      tag: "A medida & Co-Creación",
      subtitle: "Para negocios consolidados, cadenas o comercios con flujos operativos particulares que demandan adaptaciones a su dinámica.",
      monthlyPrice: 60000,
      annualPricePerMonth: 48000,
      popular: false,
      color: "amber",
      fiscalNote: "POS Integral + Facturación Electrónica + Adaptaciones",
      support: "Canal preferencial directo y atención técnica especializada",
      features: [
        "Incluye la totalidad de funciones de 'Me Estoy Formalizando'",
        "Soporte para Mejoras y Ajustes Personalizados según tus necesidades",
        "Auditoría técnica de requerimientos: viabilidad, escalabilidad y compatibilidad",
        "Modelo de co-creación: desarrollos incorporados con altos estándares de calidad",
        "Acceso preferencial exclusivo a nuevas funcionalidades en fase beta",
        "Asesor técnico dedicado y canal preferencial directo de desarrollo",
      ],
      notIncluded: [],
    },
  ];

  return (
    <section id="planes" className="py-20 bg-slate-50 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Encabezado */}
        <div className="text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 uppercase tracking-wider">
            Estructura de Suscripción Clara
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Planes adaptados al crecimiento real de tu negocio
          </h2>
          <p className="mt-3 text-base sm:text-lg text-slate-600">
            Precios fundamentados en el estado de madurez operativa y fiscal de tu comercio. Sin costos ocultos.
          </p>

          {/* Pilares comerciales */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-slate-600">
            <span className="inline-flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
              <Store className="h-3.5 w-3.5 text-sky-600" />
              Precios por sucursal
            </span>
            <span className="inline-flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
              <UploadCloud className="h-3.5 w-3.5 text-emerald-600" />
              Asistencia para carga masiva inicial en todos los planes
            </span>
            <span className="inline-flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              15 días de prueba gratuita sin tarjeta
            </span>
          </div>

          {/* Selector Mensual / Anual */}
          <div className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-white p-1.5 border border-slate-200 shadow-sm">
            <button
              type="button"
              onClick={() => setPeriod("monthly")}
              className={`rounded-xl px-5 py-2 text-xs sm:text-sm font-bold transition-all ${
                period === "monthly"
                  ? "bg-slate-900 text-white shadow-md"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Pago Mensual
            </button>
            <button
              type="button"
              onClick={() => setPeriod("annual")}
              className={`flex items-center gap-2 rounded-xl px-5 py-2 text-xs sm:text-sm font-bold transition-all ${
                period === "annual"
                  ? "bg-emerald-600 text-white shadow-md"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>Pago Anual</span>
              <span className="rounded-full bg-amber-400 text-slate-900 text-[10px] font-black px-2 py-0.5 shadow-sm">
                Ahorra 20%
              </span>
            </button>
          </div>
        </div>

        {/* Tarjetas de Precios */}
        <div className="mt-14 grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan) => {
            const displayPrice = period === "annual" ? plan.annualPricePerMonth : plan.monthlyPrice;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col justify-between rounded-3xl bg-white p-6 sm:p-8 transition-all duration-300 ${
                  plan.popular
                    ? "border-2 border-emerald-500 shadow-2xl shadow-emerald-500/15 scale-105 z-10"
                    : "border border-slate-200 shadow-lg hover:shadow-xl hover:border-slate-300"
                }`}
              >
                {/* Badge Popular */}
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-1 text-xs font-black uppercase tracking-wider text-white shadow-md flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                    Más Elegido por Comercios
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      {plan.tag}
                    </span>
                  </div>

                  <h3 className="mt-1 text-2xl font-black text-slate-900">
                    "{plan.name}"
                  </h3>

                  <p className="mt-2 text-xs text-slate-600 min-h-[40px] leading-relaxed">
                    {plan.subtitle}
                  </p>

                  {/* Precio */}
                  <div className="mt-5 border-y border-slate-100 py-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs text-slate-400 font-bold">$</span>
                      <span className="text-4xl font-black text-slate-900">
                        {displayPrice.toLocaleString("es-AR")}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        ARS /mes (por sucursal)
                      </span>
                    </div>
                    {period === "annual" ? (
                      <p className="mt-1 text-[11px] font-bold text-emerald-600">
                        Facturado anualmente (${(displayPrice * 12).toLocaleString("es-AR")} ARS/año por sucursal)
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-400">
                        Sin contratos de permanencia. Cancela o escala cuando quieras.
                      </p>
                    )}
                  </div>

                  {/* Aspecto fiscal y soporte */}
                  <div className="mt-3 space-y-1.5 text-[11px]">
                    <div className="rounded-lg bg-slate-50 p-2 border border-slate-200">
                      <span className="font-bold text-slate-700 block">Facturación:</span>
                      <span className="text-slate-600">{plan.fiscalNote}</span>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2 border border-slate-200">
                      <span className="font-bold text-slate-700 block">Soporte:</span>
                      <span className="text-slate-600">{plan.support}</span>
                    </div>
                  </div>

                  {/* Botones de acción del plan */}
                  <div className="mt-6 space-y-2.5">
                    {/* Botón 1: 15 Días Gratis */}
                    <button
                      type="button"
                      onClick={() => onOpenFreeTrial(`Plan "${plan.name}"`)}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 via-emerald-600 to-amber-600 py-3 text-sm font-extrabold text-white shadow-md hover:scale-[1.01] active:scale-[0.99] transition"
                    >
                      <Sparkles className="h-4 w-4 text-amber-300" />
                      <span>Probar 15 Días Gratis</span>
                    </button>

                    {/* Botón 2: Contratar con Pasarela de Pago */}
                    <button
                      type="button"
                      onClick={() =>
                        onOpenPayment({
                          id: plan.id,
                          name: `Plan "${plan.name}"`,
                          monthlyPrice: plan.monthlyPrice,
                          annualPricePerMonth: plan.annualPricePerMonth,
                          period,
                        })
                      }
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition"
                    >
                      <CreditCard className="h-3.5 w-3.5 text-slate-500" />
                      <span>Contratar con Pasarela de Pago</span>
                    </button>
                  </div>

                  {/* Lista de características */}
                  <div className="mt-7">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-3">
                      Alcance funcional incluido:
                    </span>
                    <ul className="space-y-2.5 text-xs">
                      {plan.features.map((feat, i) => (
                        <li key={i} className="flex items-start gap-2 text-slate-700">
                          <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 text-center">
                  <span className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    Asistencia de carga inicial incluida
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pasarelas de pago aceptadas */}
        <div className="mt-14 rounded-2xl bg-white p-6 border border-slate-200 shadow-sm text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
            Pasarelas de pago habilitadas para contratar tu suscripción
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-semibold text-slate-700">
            <span className="flex items-center gap-2 bg-sky-50 px-3.5 py-1.5 rounded-lg border border-sky-200 text-sky-800">
              <span className="h-2 w-2 rounded-full bg-sky-500" />
              Mercado Pago (Saldo, Débito, QR)
            </span>
            <span className="flex items-center gap-2 bg-emerald-50 px-3.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-800">
              <CreditCard className="h-4 w-4 text-emerald-600" />
              Tarjetas de Crédito y Débito (Visa, Master, Cabal)
            </span>
            <span className="flex items-center gap-2 bg-amber-50 px-3.5 py-1.5 rounded-lg border border-amber-200 text-amber-800">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Transferencia Bancaria Inmediata (Alias / CBU)
            </span>
          </div>
        </div>

      </div>
    </section>
  );
};
