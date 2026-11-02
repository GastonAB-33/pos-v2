import React, { useState } from "react";
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Barcode,
  CreditCard,
  QrCode,
  TrendingUp,
  Receipt,
  ShoppingCart,
  Store,
  DollarSign,
} from "lucide-react";

interface LandingHeroProps {
  onOpenFreeTrial: () => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({ onOpenFreeTrial }) => {
  const [activeTab, setActiveTab] = useState<"pos" | "caja" | "stock">("pos");

  return (
    <section className="relative overflow-hidden pt-6 pb-20 lg:pt-12 lg:pb-28">
      {/* Luces de fondo con los tres colores de la marca Jireh (Azul, Verde y Naranja) */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-sky-400/15 via-emerald-400/15 to-amber-400/15 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-10 right-10 w-72 h-72 bg-amber-400/10 rounded-full blur-2xl pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-10 w-80 h-80 bg-sky-500/10 rounded-full blur-2xl pointer-events-none -z-10" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          {/* Badge superior */}
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-gradient-to-r from-teal-50 via-emerald-50 to-orange-50 px-4 py-1.5 text-xs font-bold text-slate-800 shadow-sm">
            <span className="flex h-2 w-2 rounded-full bg-[#7CE01E] animate-pulse" />
            <span className="text-[#00B5C8]">Software Punto de Venta & Gestión</span>
            <span className="text-slate-300">•</span>
            <span className="text-[#FF7800] font-extrabold">15 Días Gratis</span>
          </div>

          {/* Título Principal */}
          <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 leading-[1.15]">
            Potencia, vende y gestiona tu comercio con{" "}
            <span className="bg-gradient-to-r from-[#00B5C8] via-[#10B981] to-[#FF7800] bg-clip-text text-transparent">
              Jireh POS
            </span>
          </h1>

          {/* Subtítulo */}
          <p className="mt-6 text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
            El sistema de punto de venta en la nube más rápido, moderno y seguro. Control de stock, arqueos de caja, cuentas corrientes, múltiples medios de pago y reportes en tiempo real.
          </p>

          {/* Llamadas a la Acción */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onOpenFreeTrial}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#00B5C8] via-[#10B981] to-[#FF7800] px-8 py-4 text-base font-extrabold text-white shadow-xl shadow-teal-600/25 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <Sparkles className="h-5 w-5 text-amber-200" />
              <span>Iniciar Prueba Gratuita (15 días)</span>
              <ArrowRight className="h-5 w-5" />
            </button>

            <a
              href="#planes"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white/80 backdrop-blur-sm px-6 py-3.5 text-base font-bold text-slate-800 hover:border-sky-600 hover:text-sky-600 hover:bg-slate-50 transition-all"
            >
              <span>Ver Planes y Precios</span>
            </a>
          </div>

          {/* Beneficios inmediatos */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs sm:text-sm font-semibold text-slate-600">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Sin tarjeta de crédito</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-sky-600" />
              <span>Instalación y uso en 5 minutos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-amber-600" />
              <span>Soporte por WhatsApp</span>
            </div>
          </div>
        </div>

        {/* Mockup Interactivo de la Interfaz Jireh POS */}
        <div className="mt-12 sm:mt-16 max-w-5xl mx-auto">
          <div className="rounded-3xl border border-slate-200/90 bg-white/95 p-3 sm:p-5 shadow-2xl shadow-slate-900/10 backdrop-blur-md">
            
            {/* Cabecera del mockup */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3.5 px-2">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-400" />
                  <div className="h-3 w-3 rounded-full bg-amber-400" />
                  <div className="h-3 w-3 rounded-full bg-emerald-400" />
                </div>
                <span className="text-xs font-bold text-slate-700 ml-2">
                  Jireh POS Cloud • Sucursal Central
                </span>
                <span className="hidden sm:inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                  En línea
                </span>
              </div>

              {/* Selector interactivo de vista en el mockup */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
                <button
                  type="button"
                  onClick={() => setActiveTab("pos")}
                  className={`px-3 py-1 rounded-lg transition ${
                    activeTab === "pos" ? "bg-white text-sky-700 shadow-sm" : "hover:text-slate-900"
                  }`}
                >
                  Punto de Venta
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("caja")}
                  className={`px-3 py-1 rounded-lg transition ${
                    activeTab === "caja" ? "bg-white text-emerald-700 shadow-sm" : "hover:text-slate-900"
                  }`}
                >
                  Caja y Métricas
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("stock")}
                  className={`px-3 py-1 rounded-lg transition ${
                    activeTab === "stock" ? "bg-white text-amber-700 shadow-sm" : "hover:text-slate-900"
                  }`}
                >
                  Inventario en Vivo
                </button>
              </div>
            </div>

            {/* Contenido según pestaña */}
            {activeTab === "pos" && (
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Lado izquierdo: Ticket de venta actual */}
                <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5 text-sky-600" />
                      <span className="text-sm font-bold text-slate-800">Venta Actual #0042</span>
                    </div>
                    <span className="rounded-full bg-sky-100 text-sky-800 text-xs px-2.5 py-0.5 font-bold">
                      Consumidor Final
                    </span>
                  </div>

                  {/* Lista de productos en el ticket */}
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between rounded-xl bg-white p-3 border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600 font-bold text-xs">
                          2x
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">Café Tostado Selección 500g</p>
                          <p className="text-[10px] text-slate-400 font-mono">Cod: 779123456789</p>
                        </div>
                      </div>
                      <span className="text-xs font-extrabold text-slate-900">$8.400,00</span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-white p-3 border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold text-xs">
                          1x
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">Leche Entera Fortificada 1L</p>
                          <p className="text-[10px] text-slate-400 font-mono">Cod: 779987654321</p>
                        </div>
                      </div>
                      <span className="text-xs font-extrabold text-slate-900">$1.650,00</span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-white p-3 border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 font-bold text-xs">
                          3x
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">Galletitas Rellenas Pack x3 (Promo 3x2)</p>
                          <p className="text-[10px] text-emerald-600 font-bold">Descuento aplicado: -$1.200</p>
                        </div>
                      </div>
                      <span className="text-xs font-extrabold text-slate-900">$2.400,00</span>
                    </div>
                  </div>

                  {/* Barra de escaneo rápido */}
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-white p-2 border border-slate-200">
                    <Barcode className="h-5 w-5 text-slate-400 ml-1 shrink-0" />
                    <span className="text-xs text-slate-400 flex-1">Escanear código de barras o F3 para buscar...</span>
                    <span className="rounded bg-slate-100 text-slate-500 text-[10px] font-mono px-2 py-0.5">Enter</span>
                  </div>
                </div>

                {/* Lado derecho: Totales y Medios de Pago */}
                <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-sky-100 bg-gradient-to-b from-sky-50/40 to-white p-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Venta</span>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-3xl font-black text-slate-900">$12.450,00</span>
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                        Ahorro $1.200
                      </span>
                    </div>

                    {/* Medios de Pago */}
                    <div className="mt-5">
                      <span className="text-xs font-semibold text-slate-600 block mb-2">Medio de Cobro</span>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2 p-2.5 rounded-xl border border-sky-500 bg-sky-500/10 text-sky-800 font-bold text-xs">
                          <QrCode className="h-4 w-4 text-sky-600" />
                          <span>Mercado Pago / QR</span>
                        </div>
                        <div className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-xs">
                          <DollarSign className="h-4 w-4 text-emerald-600" />
                          <span>Efectivo (F1)</span>
                        </div>
                        <div className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-xs">
                          <CreditCard className="h-4 w-4 text-amber-600" />
                          <span>Tarjeta Déb/Créd</span>
                        </div>
                        <div className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-xs">
                          <Store className="h-4 w-4 text-indigo-600" />
                          <span>Cta. Corriente</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Botón Cobro */}
                  <div className="mt-5 pt-3 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={onOpenFreeTrial}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 via-emerald-600 to-amber-600 py-3 text-sm font-black text-white shadow-lg shadow-emerald-500/20 hover:scale-[1.01] transition"
                    >
                      <Receipt className="h-4 w-4" />
                      <span>Cobrar e Imprimir Ticket (F12)</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "caja" && (
              <div className="mt-4 p-4 bg-slate-50/60 rounded-2xl border border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl bg-white p-4 border border-slate-200 shadow-sm">
                    <span className="text-xs font-medium text-slate-500">Ventas Hoy (Turno Actual)</span>
                    <p className="mt-1 text-2xl font-black text-emerald-600">$184.920,00</p>
                    <span className="text-[11px] text-emerald-700 font-bold mt-1 inline-flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5" /> +18.4% vs ayer
                    </span>
                  </div>
                  <div className="rounded-xl bg-white p-4 border border-slate-200 shadow-sm">
                    <span className="text-xs font-medium text-slate-500">Tickets Emitidos</span>
                    <p className="mt-1 text-2xl font-black text-sky-700">46 operaciones</p>
                    <span className="text-[11px] text-slate-500 mt-1 block">Promedio: $4.020 / ticket</span>
                  </div>
                  <div className="rounded-xl bg-white p-4 border border-slate-200 shadow-sm">
                    <span className="text-xs font-medium text-slate-500">Arqueo de Efectivo en Caja</span>
                    <p className="mt-1 text-2xl font-black text-amber-600">$62.300,00</p>
                    <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">✓ Caja balanceada sin faltantes</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "stock" && (
              <div className="mt-4 p-4 bg-slate-50/60 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 border-b pb-2 px-3">
                  <span>Producto</span>
                  <span>Stock Actual</span>
                  <span>Alerta Mínima</span>
                  <span>Estado</span>
                </div>
                <div className="flex items-center justify-between text-xs bg-white p-3 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-800">Aceite Girasol 1.5L</span>
                  <span className="font-mono font-bold text-slate-700">28 un.</span>
                  <span className="text-slate-500">Mín: 10</span>
                  <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-bold">Óptimo</span>
                </div>
                <div className="flex items-center justify-between text-xs bg-white p-3 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-800">Arroz Largo Fino 1kg</span>
                  <span className="font-mono font-bold text-amber-600">4 un.</span>
                  <span className="text-slate-500">Mín: 8</span>
                  <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-bold">Reponer pronto</span>
                </div>
                <div className="flex items-center justify-between text-xs bg-white p-3 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-800">Azúcar Clásica 1kg</span>
                  <span className="font-mono font-bold text-slate-700">65 un.</span>
                  <span className="text-slate-500">Mín: 15</span>
                  <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-bold">Óptimo</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
