import React, { useState } from "react";
import {
  ShoppingCart,
  Package,
  WalletCards,
  Users,
  Percent,
  BarChart3,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface LandingToolsProps {
  onOpenFreeTrial: () => void;
}

export const LandingTools: React.FC<LandingToolsProps> = ({ onOpenFreeTrial }) => {
  const [activeTab, setActiveTab] = useState(0);

  const tools = [
    {
      id: "pos",
      icon: ShoppingCart,
      title: "Punto de Venta (POS)",
      shortDesc: "Ventas al instante con atajos y balanza",
      color: "sky",
      features: [
        "Escaneo de códigos de barras y soporte para balanzas electrónicas en tiempo real.",
        "Teclas de acceso rápido (F1 a F12) para cobrar sin usar el mouse.",
        "Múltiples formas de pago en un mismo ticket (ej. mitad efectivo, mitad Mercado Pago).",
        "Ventas en espera para no demorar la fila si un cliente busca otro producto.",
        "Emisión e impresión automática de tickets térmicos (58mm / 80mm).",
      ],
      highlight: "Hasta un 60% más rápido que otros sistemas tradicionales.",
    },
    {
      id: "stock",
      icon: Package,
      title: "Control de Stock Inteligente",
      shortDesc: "Inventario en tiempo real sin desfasajes",
      color: "emerald",
      features: [
        "Descuento automático de stock en cada venta realizada.",
        "Alertas preventivas de stock mínimo para nunca quedarte sin mercadería clave.",
        "Manejo de productos fraccionables (pesables x kilo/gramo) y por bulto.",
        "Ingreso simplificado de compras con actualización automática de costos.",
        "Trazabilidad de mermas, vencimientos y transferencias entre depósitos.",
      ],
      highlight: "Elimina pérdidas por descontrol o mercadería faltante.",
    },
    {
      id: "caja",
      icon: WalletCards,
      title: "Caja y Arqueos Diarios",
      shortDesc: "Finanzas transparentes y sin errores",
      color: "amber",
      features: [
        "Apertura y cierre de caja por turnos de cajeros con arqueo ciego.",
        "Control detallado de entradas y salidas de dinero por gastos menores.",
        "Desglose exacto: Efectivo, Tarjetas, QR Mercado Pago y Transferencias.",
        "Detección inmediata de diferencias y sobrantes/faltantes.",
        "Comprobantes e informes de cierre exportables en un clic.",
      ],
      highlight: "Transparencia absoluta para dueños de comercios.",
    },
    {
      id: "clientes",
      icon: Users,
      title: "Cuentas Corrientes y Clientes",
      shortDesc: "Fia con seguridad y cobra a tiempo",
      color: "sky",
      features: [
        "Historial completo de compras y pagos de cada cliente.",
        "Límites máximos de crédito configurables para evitar deudas impagables.",
        "Cobro de cuotas o entregas parciales con emisión de recibo.",
        "Consulta instantánea del saldo deudor al momento de registrar la venta.",
        "Exportación de resúmenes de cuenta para enviar por WhatsApp.",
      ],
      highlight: "Dile adiós a los cuadernos rotos o anotaciones perdidas.",
    },
    {
      id: "promos",
      icon: Percent,
      title: "Listas de Precios y Promociones",
      shortDesc: "Vende más con ofertas automáticas",
      color: "emerald",
      features: [
        "Listas de precios ilimitadas: Mostrador, Mayorista, Fin de Semana, etc.",
        "Promociones automáticas configurables: 2x1, 3x2, combos o descuentos por cantidad.",
        "Aumento masivo o porcentual de precios por rubro o proveedor en un clic.",
        "Recargos o descuentos según medio de pago (ej. 10% off en efectivo).",
        "Impresión de etiquetas con código de barras y precios actualizados para góndola.",
      ],
      highlight: "Actualiza miles de precios en segundos ante variaciones de costos.",
    },
    {
      id: "reportes",
      icon: BarChart3,
      title: "Estadísticas y Reportes",
      shortDesc: "Decisiones basadas en datos reales",
      color: "amber",
      features: [
        "Ranking de los 10 productos más vendidos y más rentables.",
        "Gráficos de evolución de ventas diarias, semanales y mensuales.",
        "Mapa de horarios y días con mayor concurrencia de clientes.",
        "Cálculo exacto de ganancia bruta y neta descontando costos de mercadería.",
        "Exportación de reportes a Excel con un solo clic.",
      ],
      highlight: "Conoce la rentabilidad real de tu negocio desde tu teléfono.",
    },
  ];

  const currentTool = tools[activeTab];
  const Icon = currentTool.icon;

  return (
    <section id="herramientas" className="py-20 bg-white relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Encabezado */}
        <div className="text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-800 uppercase tracking-wider">
            Herramientas Todo-En-Uno
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Cada herramienta pensada para hacerte{" "}
            <span className="bg-gradient-to-r from-sky-600 via-emerald-600 to-amber-600 bg-clip-text text-transparent">
              ganar más dinero y tiempo
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600">
            Explora los módulos que transformarán la administración de tu comercio.
          </p>
        </div>

        {/* Selector de pestañas */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {tools.map((tool, idx) => {
            const ToolIcon = tool.icon;
            const isActive = activeTab === idx;
            return (
              <button
                key={tool.id}
                onClick={() => setActiveTab(idx)}
                className={`flex items-center gap-2 rounded-xl px-4 py-3 text-xs sm:text-sm font-bold transition-all ${
                  isActive
                    ? "bg-slate-900 text-white shadow-lg shadow-slate-900/15 scale-105"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                }`}
              >
                <ToolIcon className={`h-4 w-4 ${isActive ? "text-amber-400" : "text-slate-500"}`} />
                <span>{tool.title}</span>
              </button>
            );
          })}
        </div>

        {/* Panel de detalle de la herramienta activa */}
        <div className="mt-10 rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50/80 via-white to-sky-50/30 p-6 sm:p-10 shadow-xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Información y características */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-600 via-emerald-600 to-amber-600 text-white shadow-md">
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900">
                    {currentTool.title}
                  </h3>
                  <p className="text-sm font-medium text-slate-500">
                    {currentTool.shortDesc}
                  </p>
                </div>
              </div>

              {/* Lista de funciones */}
              <ul className="space-y-3">
                {currentTool.features.map((feat, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="text-sm font-medium text-slate-700 leading-relaxed">
                      {feat}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Destacado */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 flex items-center gap-2.5">
                <Sparkles className="h-5 w-5 text-amber-600 shrink-0" />
                <span className="text-xs sm:text-sm font-bold text-amber-900">
                  {currentTool.highlight}
                </span>
              </div>

              {/* CTA directo */}
              <div>
                <button
                  onClick={onOpenFreeTrial}
                  className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-slate-800 transition"
                >
                  <span>Probar {currentTool.title} gratis por 15 días</span>
                  <ArrowRight className="h-4 w-4 text-emerald-400" />
                </button>
              </div>
            </div>

            {/* Ilustración / Tarjeta interactiva del módulo */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-sky-500/10 via-emerald-500/10 to-amber-500/10 rounded-full blur-xl pointer-events-none" />
                
                <div className="flex items-center justify-between border-b pb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Vista Operativa
                  </span>
                  <span className="text-[11px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                    Jireh Cloud Sync
                  </span>
                </div>

                <div className="mt-4 space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Estado de sincronización</span>
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      100% Sincronizado
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Dispositivo conectado</span>
                    <span className="text-slate-800 font-medium">Terminal Mostrador #1</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Modo de cobro</span>
                    <span className="text-amber-700 font-bold">Rápido / Escaneo</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Respaldos diarios</span>
                    <span className="text-sky-700 font-bold">Automático en la nube</span>
                  </div>
                </div>

                <div className="mt-5 text-center">
                  <p className="text-[11px] text-slate-500">
                    Todos los módulos están 100% habilitados en tu período de prueba de 15 días.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};
