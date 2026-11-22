import React, { useState } from "react";
import {
  ShoppingCart,
  FileCheck2,
  Cloud,
  WifiOff,
  Database,
  Users2,
  Landmark,
  ShieldCheck,
  Tag,
  BarChart3,
  Boxes,
  ClipboardCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Play,
  Image as ImageIcon,
  ChevronRight,
} from "lucide-react";
import { WhatsAppIcon } from "./brand/WhatsAppIcon";

interface LandingToolsProps {
  onOpenFreeTrial: () => void;
}

interface ToolItem {
  id: string;
  category: "ventas" | "stock" | "finanzas" | "cloud";
  categoryLabel: string;
  icon: React.ElementType;
  title: string;
  shortDesc: string;
  badge: string;
  mediaGif?: string;
  features: string[];
  highlight: string;
  mockupDetails: {
    title: string;
    metrics: { label: string; value: string; color?: string }[];
    footerNote: string;
  };
}

export const LandingTools: React.FC<LandingToolsProps> = ({ onOpenFreeTrial }) => {
  const [selectedCategory, setSelectedCategory] = useState<"all" | "ventas" | "stock" | "finanzas" | "cloud">("all");
  const [activeToolId, setActiveToolId] = useState<string>("pos-agil");
  const [imageErrorMap, setImageErrorMap] = useState<Record<string, boolean>>({});

  const tools: ToolItem[] = [
    {
      id: "pos-agil",
      category: "ventas",
      categoryLabel: "Ventas & Mostrador",
      icon: ShoppingCart,
      title: "POS Ágil con Atajos de Teclado",
      shortDesc: "Ventas y cobros a la velocidad de la luz sin tocar el mouse",
      badge: "Despacho Inmediato",
      mediaGif: "/features/pos-agil.gif",
      features: [
        "Navegación por teclado (F1 a F12, Enter) para cobrar en menos de 3 segundos.",
        "Múltiples formas de pago por ticket: mitad efectivo, mitad transferencia o QR.",
        "Ventas en espera para no trabar la fila si un cliente busca otro artículo.",
        "Soporte directo para lectores de código de barras y balanzas electrónicas en vivo.",
        "Impresión automática de tickets térmicos rápidos (58mm y 80mm).",
      ],
      highlight: "Despacha hasta un 65% más rápido en horas pico de clientes.",
      mockupDetails: {
        title: "Mostrador #1 • Cobro Rápido",
        metrics: [
          { label: "Tiempo promedio ticket", value: "3.2 seg", color: "text-emerald-400" },
          { label: "Atajo de cobro", value: "F2 Rápido" },
          { label: "Medio de pago dividido", value: "Efectivo + QR MP" },
        ],
        footerNote: "Soporta lectores USB/Bluetooth y balanzas Systel, Kretz y Moretti.",
      },
    },
    {
      id: "facturacion-arca",
      category: "ventas",
      categoryLabel: "Ventas & Mostrador",
      icon: FileCheck2,
      title: "Facturación Electrónica ARCA (AFIP)",
      shortDesc: "Facturas A, B, C y Notas de Crédito al instante con CAE oficial",
      badge: "100% Homologado ARCA",
      mediaGif: "/features/facturacion-arca.gif",
      features: [
        "Conexión directa con Web Services de ARCA (ex-AFIP) para CAE en tiempo real.",
        "Facturas A, B, C y Notas de Crédito con QR fiscal obligatorio.",
        "Envío automático del comprobante digital por WhatsApp o email al cliente.",
        "Sin comprar impresoras fiscales caras: facturá desde cualquier PC o celular.",
        "Libro de IVA Digital y reportes de facturación listos para tu contador.",
      ],
      highlight: "Ahorra miles de dólares al no requerir impresoras fiscales de hardware.",
      mockupDetails: {
        title: "Emisor Fiscal ARCA",
        metrics: [
          { label: "Estado del servicio", value: "Online (CAE Activo)", color: "text-emerald-400" },
          { label: "Comprobantes", value: "Factura A, B, C, NC" },
          { label: "Entrega automática", value: "PDF por WhatsApp" },
        ],
        footerNote: "Validez legal garantizada con régimen fiscal argentino vigente.",
      },
    },
    {
      id: "catalogo-global",
      category: "ventas",
      categoryLabel: "Ventas & Mostrador",
      icon: Database,
      title: "Catálogo Global con +4.000 Productos",
      shortDesc: "Escaneá el código de barras y el sistema ya sabe qué producto es",
      badge: "+4.000 Artículos Pre-cargados",
      mediaGif: "/features/catalogo-global.gif",
      features: [
        "Base de datos precargada con más de 4.000 productos de consumo habitual.",
        "Al escanear un código nuevo, Jireh completa automáticamente nombre, marca y rubro.",
        "Evita la tediosa carga manual de productos antes de empezar a usar tu sistema.",
        "Solo ingresas tu costo y margen: listo para empezar a vender en el día 1.",
        "Buscador predictivo inteligente por nombre, marca o fragmento de código.",
      ],
      highlight: "Ahorra más de 40 horas de tipeo inicial en tu negocio.",
      mockupDetails: {
        title: "Base Global Comunitaria",
        metrics: [
          { label: "Base preinstalada", value: "4.280 productos", color: "text-sky-400" },
          { label: "Auto-completado", value: "Nombre, Marca, Rubro" },
          { label: "Tiempo de alta", value: "< 2 segundos" },
        ],
        footerNote: "Especialmente optimizado para kioscos, almacenes y minimarkets.",
      },
    },
    {
      id: "offline-sync",
      category: "cloud",
      categoryLabel: "Nube & Conectividad",
      icon: WifiOff,
      title: "Modo Offline con Sincronización Automática",
      shortDesc: "Si se corta internet o la luz, seguís vendiendo sin detenerte",
      badge: "Anti-Cortes de Conexión",
      mediaGif: "/features/offline-sync.gif",
      features: [
        "El punto de venta continúa operando aunque el local se quede sin conexión.",
        "Guarda las transacciones localmente en el dispositivo de forma encriptada.",
        "Cuando el servicio de internet vuelve, sincroniza automáticamente con la nube.",
        "Cero colas paradas: no le decís nunca más a un cliente 'se cayó el sistema'.",
        "Control de coherencia para evitar cobros duplicados o desajustes de caja.",
      ],
      highlight: "Blindaje operativo total ante caídas de proveedores de internet.",
      mockupDetails: {
        title: "Monitor de Conectividad Local",
        metrics: [
          { label: "Estado actual", value: "Offline Activo / Seguro", color: "text-amber-400" },
          { label: "Cola de sincronización", value: "Automática al volver" },
          { label: "Protección de datos", value: "Cache local segura" },
        ],
        footerNote: "Sincronización bidireccional silenciosa sin intervención manual.",
      },
    },
    {
      id: "cloud-multidevice",
      category: "cloud",
      categoryLabel: "Nube & Conectividad",
      icon: Cloud,
      title: "100% en la Nube y Multidispositivo",
      shortDesc: "Ves la misma información en vivo desde tu celular, tablet o PC",
      badge: "Acceso Remoto 24/7",
      mediaGif: "/features/cloud-multidevice.gif",
      features: [
        "Acceso desde cualquier navegador web en celular Android/iPhone, tablet o PC.",
        "Monitoreá tus ventas, cierres de caja y stock en vivo mientras estás de viaje.",
        "Actualizaciones de listas de precios desde tu casa que impactan al instante en el local.",
        "Sin servidores costosos que mantener ni copias de seguridad manuales.",
        "Backups diarios automatizados en centros de datos con encriptación bancaria.",
      ],
      highlight: "Ten el control total de tu negocio en la palma de tu mano.",
      mockupDetails: {
        title: "Dispositivos Vinculados en Vivo",
        metrics: [
          { label: "Dispositivos conectados", value: "Caja PC + Celular Dueño", color: "text-emerald-400" },
          { label: "Latencia de datos", value: "Instantánea (< 1 seg)" },
          { label: "Copias de seguridad", value: "Automáticas cada 24 hs" },
        ],
        footerNote: "No requiere instalar programas pesados ni configuraciones de red.",
      },
    },
    {
      id: "compras-2pasos",
      category: "stock",
      categoryLabel: "Stock & Compras",
      icon: ClipboardCheck,
      title: "Carga de Compras Opcional en 2 Pasos",
      shortDesc: "El empleado recibe la mercadería y el dueño confirma los precios de venta",
      badge: "Control Dueño vs Empleado",
      mediaGif: "/features/compras-2pasos.gif",
      features: [
        "Paso 1 (Empleado): Ingresa la factura del proveedor, cuenta bultos y asienta pago.",
        "Paso 2 (Dueño): Revisa el aumento de costos, fija margen de ganancia e IVA.",
        "Evita que mercadería con costos aumentados se venda a precios viejos por descuido.",
        "Los precios de mostrador solo se actualizan cuando la persona autorizada los aprueba.",
        "Historial completo de variaciones de costos por proveedor a lo largo del tiempo.",
      ],
      highlight: "Protege tu rentabilidad evitando que la inflación se coma tu margen.",
      mockupDetails: {
        title: "Bandeja de Aprobación de Costos",
        metrics: [
          { label: "Estado del remito", value: "Cargado por Repositor" },
          { label: "Pendiente", value: "Margen de Ganancia Dueño", color: "text-amber-400" },
          { label: "Impacto en mostrador", value: "Bloqueado hasta confirmar" },
        ],
        footerNote: "Modalidad opcional: podés activar el flujo simple directo o el flujo en 2 pasos.",
      },
    },
    {
      id: "cuentas-corrientes",
      category: "finanzas",
      categoryLabel: "Finanzas & Cuentas",
      icon: Users2,
      title: "Cuentas Corrientes: Clientes y Proveedores",
      shortDesc: "Doble control: 'fiá' con límite de crédito y controlá deudas a proveedores",
      badge: "Doble Control Financiero",
      mediaGif: "/features/cuentas-corrientes.gif",
      features: [
        "Cuentas Corrientes Clientes: límite de crédito configurable para no fiar de más.",
        "Cobro de cuotas o entregas con emisión de recibo y saldo actualizado en el acto.",
        "Envío de resúmenes de cuenta claros y profesionales por WhatsApp en 1 toque.",
        "Cuentas Corrientes Proveedores: calendario de vencimientos de facturas de mercadería.",
        "Previene olvidos de pago o cobros duplicados de distribuidores y preventistas.",
      ],
      highlight: "Eliminá para siempre los cuadernos de fiado rotos o cuentas perdidas.",
      mockupDetails: {
        title: "Cuentas Corrientes Integradas",
        metrics: [
          { label: "Total por cobrar clientes", value: "$ 480.200", color: "text-sky-400" },
          { label: "Total deuda proveedores", value: "$ 310.000", color: "text-orange-400" },
          { label: "Notificaciones", value: "Resumen por WhatsApp" },
        ],
        footerNote: "Consulta instantánea del saldo deudor del cliente directamente al cobrar en caja.",
      },
    },
    {
      id: "bancos-billeteras",
      category: "finanzas",
      categoryLabel: "Finanzas & Cuentas",
      icon: Landmark,
      title: "Control de Bancos, Billeteras & Mercado Pago",
      shortDesc: "Seguimiento exacto de ingresos, egresos y comisiones sin desfasajes",
      badge: "Conciliación Bancaria",
      mediaGif: "/features/bancos-billeteras.gif",
      features: [
        "Cuentas separadas: Efectivo en Mostrador, Bancos, Mercado Pago y Transferencias.",
        "Registro de ingresos y egresos por gastos operativos diarios (fletes, servicios).",
        "Control de retenciones y comisiones por cobro digital para conocer el dinero neto real.",
        "Arqueo ciego de caja al finalizar el turno: el cajero no ve el saldo teórico.",
        "Detección inmediata de sobrantes o faltantes en el momento exacto del cierre.",
      ],
      highlight: "Transparencia absoluta entre lo que cobraste y lo que ingresó a tu banco.",
      mockupDetails: {
        title: "Tablero de Liquidez & Billeteras",
        metrics: [
          { label: "Efectivo en mostrador", value: "$ 185.400" },
          { label: "Mercado Pago & QR", value: "$ 324.950", color: "text-sky-400" },
          { label: "Bancos / Transferencias", value: "$ 512.000", color: "text-emerald-400" },
        ],
        footerNote: "Reporte consolidado de flujo de fondos para tomar decisiones con certeza.",
      },
    },
    {
      id: "multiusuario-roles",
      category: "cloud",
      categoryLabel: "Nube & Conectividad",
      icon: ShieldCheck,
      title: "Multiusuario con Roles y Permisos Protegidos",
      shortDesc: "Los empleados cobran sin ver tus ganancias, costos ni borrar ventas",
      badge: "Seguridad y Auditoría",
      mediaGif: "/features/multiusuario-roles.gif",
      features: [
        "Perfiles diferenciados: Cajero, Repositor, Encargado y Administrador/Dueño.",
        "Bloqueo estricto de costos de compra y ganancias para personal de mostrador.",
        "Protección contra eliminación de tickets o modificaciones de precios sin permiso.",
        "Auditoría completa: cada movimiento registra qué usuario lo hizo, cuándo y su IP.",
        "Claves individuales rápidas para alternar de usuario en el mismo mostrador.",
      ],
      highlight: "Delega la atención de tu mostrador con tranquilidad y sin riesgos.",
      mockupDetails: {
        title: "Matriz de Permisos & Perfiles",
        metrics: [
          { label: "Visualización costos", value: "Bloqueada para Cajeros", color: "text-rose-400" },
          { label: "Borrado de ventas", value: "Requiere Clave Dueño" },
          { label: "Auditoría de acciones", value: "100% Trazable" },
        ],
        footerNote: "Configuración granular por módulo: activá o desactivá accesos con un clic.",
      },
    },
    {
      id: "listas-precios",
      category: "stock",
      categoryLabel: "Stock & Compras",
      icon: Tag,
      title: "Múltiples Listas de Precios & Aumentos Masivos",
      shortDesc: "Minorista, mayorista, revendedor y actualización de precios en 1 clic",
      badge: "Flexibilidad Comercial",
      mediaGif: "/features/listas-precios.gif",
      features: [
        "Creá listas ilimitadas: Mostrador Minorista, Mayorista por Bulto, Especiales.",
        "Aumentos masivos porcentuales o por monto por proveedor, rubro o marca en segundos.",
        "Reglas automáticas por forma de pago (ej. 10% de descuento en efectivo).",
        "Impresión ágil de etiquetas para góndola con código de barras y precio nuevo.",
        "Promociones automáticas configurables: 2x1, combos o descuentos por cantidad.",
      ],
      highlight: "Actualizá toda la góndola en minutos cuando un proveedor aumenta sus listas.",
      mockupDetails: {
        title: "Gestor de Listas & Aumentos",
        metrics: [
          { label: "Listas simultáneas", value: "Minorista / Mayorista / Especial" },
          { label: "Aumento masivo por rubro", value: "+15% en 'Bebidas'", color: "text-emerald-400" },
          { label: "Etiquetas de góndola", value: "Generación automática" },
        ],
        footerNote: "Mantiene la coherencia de márgenes de ganancia automáticamente ante cada ajuste.",
      },
    },
    {
      id: "estadisticas-contables",
      category: "finanzas",
      categoryLabel: "Finanzas & Cuentas",
      icon: BarChart3,
      title: "Estadísticas y Seguimiento Contable Real",
      shortDesc: "Ganancias netas reales, control de gastos fijos y ranking de productos estrella",
      badge: "Rentabilidad Clara",
      mediaGif: "/features/estadisticas-contables.gif",
      features: [
        "Cálculo exacto de ganancia bruta y neta descontando costos de mercadería y gastos.",
        "Ranking de los productos más vendidos y los más rentables de tu negocio.",
        "Control de gastos fijos y operativos: alquiler, luz, sueldos, fletes y servicios.",
        "Gráficos de facturación por franjas horarias para optimizar turnos de personal.",
        "Exportación a Excel y PDF con un solo clic para tu análisis o el de tu contador.",
      ],
      highlight: "Sabé exactamente cuánto dinero limpio ganaste al final de cada mes.",
      mockupDetails: {
        title: "Reporte Financiero Mensual",
        metrics: [
          { label: "Facturación total", value: "$ 4.820.000" },
          { label: "Costo de mercadería", value: "$ 2.910.000" },
          { label: "Ganancia neta real", value: "$ 1.450.000", color: "text-emerald-400" },
        ],
        footerNote: "Informes claros y directos sin tecnicismos contables innecesarios.",
      },
    },
    {
      id: "inventario-alertas",
      category: "stock",
      categoryLabel: "Stock & Compras",
      icon: Boxes,
      title: "Valor del Inventario & Alertas de Stock",
      shortDesc: "Valuación de tu capital invertido y alertas para no quedarte sin stock clave",
      badge: "Capital Protegido",
      mediaGif: "/features/inventario-alertas.gif",
      features: [
        "Valuación en tiempo real de todo tu capital invertido a precio de costo y venta.",
        "Alertas preventivas de stock mínimo para no perder ventas de artículos estrella.",
        "Descuento automático de stock en tiempo real con cada ticket de venta emitido.",
        "Ajustes rápidos de inventario manual para corregir diferencias y recuentos físicos.",
        "Gestión de artículos fraccionables (pesables x kilo/gramos con balanza) y por bulto.",
      ],
      highlight: "Tu capital de trabajo siempre visible y optimizado sin sobrantes ni faltantes.",
      mockupDetails: {
        title: "Auditoría de Inventario",
        metrics: [
          { label: "Valor stock a costo", value: "$ 8.940.000", color: "text-sky-400" },
          { label: "Valor estimado a venta", value: "$ 13.850.000", color: "text-emerald-400" },
          { label: "Alertas de reposición", value: "3 productos críticos", color: "text-amber-400" },
        ],
        footerNote: "Descuento automático de unidades al escanear en cualquier terminal del local.",
      },
    },
  ];

  const filteredTools = selectedCategory === "all"
    ? tools
    : tools.filter((t) => t.category === selectedCategory);

  const currentTool = tools.find((t) => t.id === activeToolId) || filteredTools[0] || tools[0];
  const IconComponent = currentTool.icon;

  const handleImageError = (id: string) => {
    setImageErrorMap((prev) => ({ ...prev, [id]: true }));
  };

  const hasImageFailed = imageErrorMap[currentTool.id] || !currentTool.mediaGif;

  return (
    <section id="herramientas" className="py-10 sm:py-14 bg-slate-50/70 relative overflow-hidden">
      {/* Luces difusas de fondo */}
      <div className="absolute top-10 left-10 w-80 h-80 bg-[#00B5C8]/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-[#7CE01E]/10 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Encabezado Principal Compacto */}
        <div className="text-center max-w-3xl mx-auto mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-gradient-to-r from-teal-50 via-emerald-50 to-orange-50 px-3.5 py-1 text-xs font-bold text-slate-800 shadow-sm">
            <span className="flex h-2 w-2 rounded-full bg-[#7CE01E] animate-pulse" />
            <span className="text-[#00B5C8]">Módulos del Sistema</span>
            <span className="text-slate-300">•</span>
            <span className="text-[#FF7800] font-extrabold">Todo Incluido en la Prueba</span>
          </div>

          <h2 className="mt-2.5 text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            Diseñado para que tu comercio venda más,{" "}
            <span className="bg-gradient-to-r from-[#00B5C8] via-[#10B981] to-[#FF7800] bg-clip-text text-transparent">
              sin perder tiempo ni dinero
            </span>
          </h2>
        </div>

        {/* ESTRUCTURA MASTER-DETAIL COMPACTA (Se adapta al marco visual de la pantalla) */}
        <div className="flex flex-col lg:flex-row gap-5 lg:gap-6 items-start">
          
          {/* ======================================================== */}
          {/* COLUMNA IZQUIERDA: Menú selector vertical de funciones   */}
          {/* ======================================================== */}
          <div className="w-full lg:w-[320px] xl:w-[340px] shrink-0 space-y-2.5">
            
            {/* Filtros rápidos por categoría */}
            <div className="bg-white p-1.5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-between gap-1 overflow-x-auto scrollbar-none text-xs">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`px-2.5 py-1 rounded-xl font-bold transition-all shrink-0 ${
                  selectedCategory === "all"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                Todas ({tools.length})
              </button>
              <button
                onClick={() => setSelectedCategory("ventas")}
                className={`px-2 py-1 rounded-xl font-bold transition-all shrink-0 ${
                  selectedCategory === "ventas"
                    ? "bg-[#00B5C8] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                Ventas
              </button>
              <button
                onClick={() => setSelectedCategory("stock")}
                className={`px-2 py-1 rounded-xl font-bold transition-all shrink-0 ${
                  selectedCategory === "stock"
                    ? "bg-[#FF7800] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                Stock
              </button>
              <button
                onClick={() => setSelectedCategory("finanzas")}
                className={`px-2 py-1 rounded-xl font-bold transition-all shrink-0 ${
                  selectedCategory === "finanzas"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                Finanzas
              </button>
              <button
                onClick={() => setSelectedCategory("cloud")}
                className={`px-2 py-1 rounded-xl font-bold transition-all shrink-0 ${
                  selectedCategory === "cloud"
                    ? "bg-sky-700 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                Cloud
              </button>
            </div>

            {/* Lista vertical de herramientas (altura balanceada a 490px) */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-2 shadow-md max-h-[490px] overflow-y-auto space-y-1 overscroll-contain">
              {filteredTools.map((tool) => {
                const ItemIcon = tool.icon;
                const isActive = activeToolId === tool.id;
                return (
                  <button
                    key={tool.id}
                    onClick={() => setActiveToolId(tool.id)}
                    className={`w-full text-left px-2.5 py-2 rounded-2xl flex items-center justify-between gap-2.5 transition-all ${
                      isActive
                        ? "bg-slate-900 text-white shadow-md shadow-slate-900/15 translate-x-1"
                        : "text-slate-700 hover:bg-slate-100/90"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors ${
                          isActive
                            ? "bg-white/10 text-[#7CE01E]"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        <ItemIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className={`text-xs font-bold truncate ${isActive ? "text-white" : "text-slate-900"}`}>
                          {tool.title}
                        </div>
                        <div className={`text-[10px] truncate ${isActive ? "text-slate-400" : "text-slate-500"}`}>
                          {tool.badge}
                        </div>
                      </div>
                    </div>

                    <ChevronRight
                      className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                        isActive ? "text-[#00B5C8] translate-x-0.5" : "text-slate-300"
                      }`}
                    />
                  </button>
                );
              })}
            </div>

          </div>

          {/* ======================================================== */}
          {/* COLUMNA DERECHA: Tarjeta compacta con explicaciones y GIF */}
          {/* ======================================================== */}
          <div className="flex-1 w-full min-w-0">
            <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 lg:p-6 shadow-xl relative overflow-hidden">
              
              {/* Barra superior con gradiente de marca */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#00B5C8] via-[#7CE01E] to-[#FF7800]" />

              {/* Cabecera compacta: sin el cartel redundante */}
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#00B5C8] via-[#10B981] to-[#FF7800] text-white shadow-sm">
                  <IconComponent className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                      {currentTool.categoryLabel}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800 border border-emerald-200">
                      <Sparkles className="h-2.5 w-2.5 text-emerald-600" />
                      {currentTool.badge}
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight truncate mt-0.5">
                    {currentTool.title}
                  </h3>
                </div>
              </div>

              {/* Contenido dividido: Explicaciones (Izquierda) + Mockup/GIF (Derecha) */}
              <div className="mt-4 grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                
                {/* 1. EXPLICACIONES COMPLETAS */}
                <div className="xl:col-span-7 space-y-3">
                  <p className="text-xs sm:text-[13px] font-medium text-slate-600 leading-snug">
                    {currentTool.shortDesc}
                  </p>

                  {/* Lista de viñetas compactas */}
                  <ul className="space-y-2 pt-0.5">
                    {currentTool.features.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span className="text-xs sm:text-[13px] font-medium text-slate-700 leading-snug">
                          {feat}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* Resalte de Beneficio Compacto */}
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 flex items-center gap-2.5">
                    <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
                    <span className="text-xs font-bold text-amber-900 leading-snug">
                      {currentTool.highlight}
                    </span>
                  </div>

                  {/* Botón de Prueba Gratuita */}
                  <div className="pt-1">
                    <button
                      onClick={onOpenFreeTrial}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#25D366] via-[#10B981] to-[#059669] px-5 py-2.5 text-xs sm:text-sm font-extrabold text-white shadow-md shadow-emerald-600/25 hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all"
                    >
                      <WhatsAppIcon className="h-4 w-4 text-white shrink-0" />
                      <span>Probar {currentTool.title} Gratis (7 Días)</span>
                      <ArrowRight className="h-3.5 w-3.5 text-emerald-100" />
                    </button>
                  </div>
                </div>

                {/* 2. DEMOSTRACIÓN VISUAL / CONTENEDOR DE GIF O IMAGEN */}
                <div className="xl:col-span-5">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 shadow-xl overflow-hidden text-white">
                    
                    {/* Barra de cabecera estilo ventana */}
                    <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-3 py-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-rose-500/80" />
                        <span className="h-2 w-2 rounded-full bg-amber-500/80" />
                        <span className="h-2 w-2 rounded-full bg-emerald-500/80" />
                        <span className="ml-1.5 text-[10px] font-semibold text-slate-400 truncate max-w-[150px]">
                          {currentTool.title}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400 border border-emerald-500/30">
                        <Play className="h-2 w-2 fill-emerald-400" />
                        Demostración
                      </span>
                    </div>

                    {/* Área de GIF / Simulación en vivo */}
                    <div className="relative min-h-[220px] sm:min-h-[250px] max-h-[270px] flex items-center justify-center p-3 bg-slate-900/90">
                      {!hasImageFailed ? (
                        <img
                          src={currentTool.mediaGif}
                          alt={`Demostración interactiva de ${currentTool.title}`}
                          onError={() => handleImageError(currentTool.id)}
                          className="w-full h-auto max-h-[250px] object-contain rounded-lg shadow-lg"
                          loading="lazy"
                        />
                      ) : (
                        /* Simulación interactiva con métricas reales en vivo */
                        <div className="w-full space-y-2">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                              <ImageIcon className="h-3 w-3 text-sky-400" />
                              {currentTool.mockupDetails.title}
                            </span>
                            <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400 border border-emerald-400/20">
                              En Vivo
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {currentTool.mockupDetails.metrics.map((m, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between rounded-lg bg-slate-800/80 border border-slate-700/60 px-2.5 py-1.5 text-[11px]"
                              >
                                <span className="text-slate-300 font-medium">{m.label}</span>
                                <span className={`font-bold ${m.color || "text-white"}`}>
                                  {m.value}
                                </span>
                              </div>
                            ))}
                          </div>

                          <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/60 p-2 text-center">
                            <p className="text-[10px] text-slate-400 leading-tight">
                              {currentTool.mockupDetails.footerNote}
                            </p>
                            <p className="mt-0.5 text-[9px] font-mono text-[#00B5C8]/80">
                              📁 public/features/{currentTool.id}.gif
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Pie de la ventana */}
                    <div className="border-t border-slate-800 bg-slate-950 px-3 py-1.5 flex items-center justify-between text-[10px] text-slate-400">
                      <span>✓ 100% Funcional en la nube</span>
                      <span className="text-[#7CE01E] font-semibold">Sin costo adicional</span>
                    </div>

                  </div>
                </div>

              </div>

            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
