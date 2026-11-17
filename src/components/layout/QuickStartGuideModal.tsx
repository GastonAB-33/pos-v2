import { useState } from "react";
import {
  ArrowRight,
  Barcode,
  BookOpen,
  CheckCircle2,
  Lightbulb,
  PackagePlus,
  ShieldCheck,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { routePaths } from "@/config/routes";
import { usePosNavigation } from "@/hooks/usePosNavigation";
import { cn } from "@/utils/cn";

interface QuickStartGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GuideStep {
  id: string;
  badge: string;
  title: string;
  shortDescription: string;
  icon: typeof Wallet;
  actionLabel?: string;
  actionRoute?: string;
  isPosAction?: boolean;
  whyItMatters: string;
  steps: string[];
  proTip: string;
}

const GUIDE_STEPS: GuideStep[] = [
  {
    id: "caja-apertura",
    badge: "Paso 1 · Apertura",
    title: "Abrir tu Caja Diaria",
    shortDescription: "Registra tu fondo inicial antes de comenzar las ventas.",
    icon: Wallet,
    actionLabel: "Ir a Caja Diaria",
    actionRoute: routePaths.caja,
    whyItMatters:
      "Sin una caja abierta, el sistema no puede registrar turnos ni asignar cobranzas a un cajero específico. Es la base de un negocio ordenado.",
    steps: [
      "Ingresa a Caja diaria desde el menú o el botón de acción rápida.",
      "Haz clic en el botón azul Abrir Caja.",
      "Escribe el Monto Inicial de cambio en efectivo con el que arrancas en el cajón físico (ej. $15.000).",
      "Confirma la apertura. ¡El terminal queda listo para registrar cobros!",
    ],
    proTip:
      "Asegúrate de que el monto ingresado coincida exactamente con los billetes físicos en el cajón para que el arqueo de cierre al final del turno sea perfecto.",
  },
  {
    id: "catalogo-global",
    badge: "Paso 2 · Carga rápida",
    title: "Cargar Productos con Catálogo Global",
    shortDescription: "Escanea el código de barras y solo define tu precio de venta.",
    icon: PackagePlus,
    actionLabel: "Ir a Productos",
    actionRoute: routePaths.productos,
    whyItMatters:
      "¡No pierdas horas escribiendo nombres, marcas y categorías! Nuestro sistema cuenta con un Catálogo Global pre-cargado con miles de artículos comerciales.",
    steps: [
      "Ve a Productos y haz clic en + Nuevo Producto.",
      "Escanea el código de barras con tu pistola lectora (o escribe los números si no tienes lector).",
      "¡Magia instantánea!: El sistema consulta nuestro Catálogo Global y autocompleta el nombre, marca, rubro y presentación.",
      "Tú solo debes ingresar tu Precio de Venta (y stock inicial si llevas control de inventario).",
      "Haz clic en Guardar y el producto ya está listo para venderse.",
    ],
    proTip:
      "¿Vendes pan, fiambrería o productos artesanales sin código de barra? Puedes hacer clic en 'Carga manual' para escribir el nombre y asignarle un código corto personalizado.",
  },
  {
    id: "primera-venta",
    badge: "Paso 3 · Operación",
    title: "Registrar tu Primera Venta",
    shortDescription: "Abre el Punto de Venta (POS) y prueba cobrar un producto.",
    icon: ShoppingCart,
    actionLabel: "Abrir Terminal POS",
    actionRoute: routePaths.pos,
    isPosAction: true,
    whyItMatters:
      "Es la pantalla donde pasarás el 90% del día. Está optimizada para velocidad con teclado, lector de barras y emisión rápida de tickets.",
    steps: [
      "Haz clic en Nueva venta (o presiona F2 / atajo rápido) para abrir el Terminal POS.",
      "Escanea el código de barras o escribe el nombre del producto para agregarlo al ticket.",
      "Presiona el botón Cobrar (o la tecla Enter).",
      "Selecciona el medio de pago: Efectivo, Transferencia / Mercado Pago, Débito o Crédito.",
      "Si es efectivo, ingresa con cuánto te paga el cliente para ver el vuelto automático y presiona Confirmar Cobro.",
    ],
    proTip:
      "¡Prueba sin miedo! Puedes hacer una venta de prueba ahora mismo y luego anularla en 1 clic desde 'Comprobantes' o 'Historial de ventas' para que no afecte tus números reales.",
  },
  {
    id: "usuarios-cajeros",
    badge: "Paso 4 · Seguridad",
    title: "Crear Usuarios y Cajeros",
    shortDescription: "Otorga accesos protegidos a tus empleados sin exponer costos.",
    icon: Users,
    actionLabel: "Ir a Usuarios",
    actionRoute: routePaths.usuarios,
    whyItMatters:
      "Como dueño, quieres que tus empleados vendan sin poder ver los márgenes de ganancia, reportes contables ni costos de compra de mercadería.",
    steps: [
      "Ve a Configuración › Usuarios desde el menú.",
      "Haz clic en + Nuevo Usuario.",
      "Ingresa el nombre, usuario de inicio de sesión y una contraseña temporal.",
      "Selecciona el rol adecuado: 'Cajero' (solo ventas y cobros en POS) o 'Administrador' (acceso completo).",
      "Guarda el usuario. Cada empleado tendrá su propio turno y registro de auditoría independiente.",
    ],
    proTip:
      "Nunca compartas la cuenta de Administrador con el personal de caja. Así tendrás total claridad de quién cobró cada ticket y quién abrió cada turno.",
  },
  {
    id: "cierre-arqueo",
    badge: "Paso 5 · Control",
    title: "Cierre de Caja y Arqueo Diario",
    shortDescription: "Cuadra el efectivo del cajón con los registros del sistema.",
    icon: ShieldCheck,
    actionLabel: "Ir a Caja Diaria",
    actionRoute: routePaths.caja,
    whyItMatters:
      "El arqueo diario previene pérdidas y te da tranquilidad absoluta de que no faltó dinero físico en el cambio ni en las recaudaciones.",
    steps: [
      "Al finalizar la jornada o el turno del cajero, ingresa a Caja Diaria.",
      "Haz clic en el botón Cierre de Caja.",
      "Cuenta los billetes físicos reales que hay en el cajón e ingresa el monto total en la casilla de arqueo.",
      "El sistema calculará automáticamente si hay coincidencia exacta, sobrante o faltante.",
      "Confirma el cierre y, si lo deseas, descarga o imprime el resumen del turno.",
    ],
    proTip:
      "Los cobros digitales (Mercado Pago, tarjetas, transferencias) quedan registrados automáticamente por separado, facilitando la conciliación bancaria.",
  },
];

export const QuickStartGuideModal = ({ isOpen, onClose }: QuickStartGuideModalProps) => {
  const [selectedStepId, setSelectedStepId] = useState<string>("caja-apertura");
  const navigate = useNavigate();
  const { openPos } = usePosNavigation();

  if (!isOpen) return null;

  const currentStep = GUIDE_STEPS.find((step) => step.id === selectedStepId) ?? GUIDE_STEPS[0];
  const StepIcon = currentStep.icon;

  const handleActionClick = () => {
    onClose();
    if (currentStep.isPosAction) {
      openPos();
    } else if (currentStep.actionRoute) {
      navigate(currentStep.actionRoute);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-start-title"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4 dark:border-slate-800 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400">
              <BookOpen size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                  Primeros pasos
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">Guía práctica de inicio rápido</span>
              </div>
              <h2 id="quick-start-title" className="text-lg font-semibold text-slate-900 dark:text-white sm:text-xl">
                Manual de inicio para tu comercio
              </h2>
            </div>
          </div>
          <ModalCloseButton onClick={onClose} label="Cerrar guía" />
        </div>

        {/* Modal Body: Two columns layout */}
        <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-12">
          {/* Step Selector List (Left Column) */}
          <div className="border-b border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/50 md:col-span-5 md:border-b-0 md:border-r overflow-y-auto">
            <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Secuencia recomendada
            </p>
            <nav className="space-y-1.5" aria-label="Pasos de la guía">
              {GUIDE_STEPS.map((step) => {
                const Icon = step.icon;
                const isSelected = step.id === selectedStepId;

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setSelectedStepId(step.id)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 text-left transition-all",
                      isSelected
                        ? "bg-white shadow-xs border border-blue-200/90 text-blue-900 dark:border-blue-800/80 dark:bg-slate-800 dark:text-blue-300 ring-1 ring-blue-500/10"
                        : "hover:bg-slate-200/60 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60 border border-transparent"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-colors",
                        isSelected
                          ? "bg-blue-600 text-white dark:bg-blue-500"
                          : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      )}
                    >
                      <Icon size={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold leading-tight">{step.title}</p>
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500 dark:text-slate-400">
                        {step.shortDescription}
                      </p>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Step Detail Content (Right Column) */}
          <div className="flex flex-col justify-between overflow-y-auto p-5 sm:p-6 md:col-span-7">
            <div className="space-y-4">
              {/* Step Header */}
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80">
                    {currentStep.badge}
                  </span>
                </div>
                <h3 className="mt-2 text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <StepIcon className="text-blue-600 dark:text-blue-400 shrink-0" size={22} />
                  <span>{currentStep.title}</span>
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {currentStep.whyItMatters}
                </p>
              </div>

              {/* Special Catálogo Global highlight badge */}
              {currentStep.id === "catalogo-global" && (
                <div className="flex items-center gap-2.5 rounded-xl border border-sky-300 bg-sky-50/80 p-3 text-xs text-sky-950 dark:border-sky-800/80 dark:bg-sky-950/50 dark:text-sky-200">
                  <Barcode className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" />
                  <span>
                    <strong>Catálogo Global Inteligente:</strong> Al escanear el código de barras, no tienes que tipear nada. Solo defines el precio de venta y ¡listo!
                  </span>
                </div>
              )}

              {/* Step checklist */}
              <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
                  Paso a paso:
                </p>
                <ol className="space-y-2.5">
                  {currentStep.steps.map((stepText, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                      <CheckCircle2
                        size={17}
                        className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                        aria-hidden="true"
                      />
                      <span>{stepText}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Pro Tip Box */}
              <div className="flex items-start gap-3 rounded-xl sm:rounded-2xl border border-amber-200/90 bg-amber-50/70 p-3.5 text-xs text-amber-950 dark:border-amber-800/80 dark:bg-amber-950/40 dark:text-amber-200">
                <Lightbulb size={18} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <span className="font-bold">Consejo práctico: </span>
                  <span>{currentStep.proTip}</span>
                </div>
              </div>
            </div>

            {/* Step Action Button */}
            {currentStep.actionLabel && (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-4 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  ¿Listo para probarlo ahora mismo?
                </span>
                <button
                  type="button"
                  onClick={handleActionClick}
                  className="inline-flex items-center gap-2 rounded-xl sm:rounded-2xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                >
                  <span>{currentStep.actionLabel}</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200/80 bg-slate-50/70 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/60 sm:px-6">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Puedes abrir esta guía en cualquier momento desde el botón <strong>Primeros pasos</strong> del encabezado.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
