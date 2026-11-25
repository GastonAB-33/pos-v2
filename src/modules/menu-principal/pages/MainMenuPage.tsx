import {
  Boxes,
  CircleDollarSign,
  PackageSearch,
  ShoppingCart,
  Users,
  Wallet,
  ArrowRight,
  RefreshCw,
  Bell,
  CheckCircle2,
  Zap,
  Store,
} from "lucide-react";
import { Link } from "react-router-dom";
import { routePaths } from "@/config/routes";
import { usePosNavigation } from "@/hooks/usePosNavigation";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { cn } from "@/utils/cn";

interface QuickActionItem {
  label: string;
  category: string;
  badge: string;
  to: string;
  icon: typeof ShoppingCart;
  actionText: string;
  theme: {
    iconBox: string;
    badge: string;
    footerText: string;
    dot: string;
  };
}

const quickActions: QuickActionItem[] = [
  {
    label: "Nueva venta",
    category: "Terminal POS",
    badge: "VENTAS",
    to: routePaths.pos,
    icon: ShoppingCart,
    actionText: "Abrir terminal",
    theme: {
      iconBox:
        "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/60 dark:text-blue-400 dark:border-blue-900/40",
      badge:
        "bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
      footerText: "text-blue-600 dark:text-blue-400",
      dot: "bg-blue-500 animate-pulse",
    },
  },
  {
    label: "Productos",
    category: "Inventario y artículos",
    badge: "CATÁLOGO",
    to: routePaths.productos,
    icon: PackageSearch,
    actionText: "Catálogo general",
    theme: {
      iconBox:
        "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900/40",
      badge:
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
      footerText: "text-emerald-600 dark:text-emerald-400",
      dot: "bg-emerald-500",
    },
  },
  {
    label: "Caja diaria",
    category: "Flujo de dinero y turnos",
    badge: "TESORERÍA",
    to: routePaths.caja,
    icon: Wallet,
    actionText: "Movimientos y cierres",
    theme: {
      iconBox:
        "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-900/40",
      badge:
        "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800",
      footerText: "text-amber-600 dark:text-amber-400",
      dot: "bg-amber-500",
    },
  },
  {
    label: "Clientes",
    category: "Directorio y contactos",
    badge: "CLIENTES",
    to: routePaths.clientes,
    icon: Users,
    actionText: "Fichas y cuentas",
    theme: {
      iconBox:
        "bg-violet-50 text-violet-600 border-violet-100 dark:bg-violet-950/60 dark:text-violet-400 dark:border-violet-900/40",
      badge:
        "bg-violet-100 text-violet-800 dark:bg-violet-950/80 dark:text-violet-300 border border-violet-200 dark:border-violet-800",
      footerText: "text-violet-600 dark:text-violet-400",
      dot: "bg-violet-500",
    },
  },
  {
    label: "Stock",
    category: "Existencias y ajustes",
    badge: "EXISTENCIAS",
    to: routePaths.stock,
    icon: Boxes,
    actionText: "Control de stock",
    theme: {
      iconBox:
        "bg-sky-50 text-sky-600 border-sky-100 dark:bg-sky-950/60 dark:text-sky-400 dark:border-sky-900/40",
      badge:
        "bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-200 dark:border-sky-800",
      footerText: "text-sky-600 dark:text-sky-400",
      dot: "bg-sky-500",
    },
  },
  {
    label: "Cuentas corrientes",
    category: "Deudas y créditos",
    badge: "COBRANZAS",
    to: routePaths.cuentasCorrientes,
    icon: CircleDollarSign,
    actionText: "Deudas y cobranzas",
    theme: {
      iconBox:
        "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-900/40",
      badge:
        "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800",
      footerText: "text-rose-600 dark:text-rose-400",
      dot: "bg-rose-500",
    },
  },
  {
    label: "Mi Tienda Online",
    category: "Catálogo web y pedidos",
    badge: "E-COMMERCE",
    to: routePaths.miTienda,
    icon: Store,
    actionText: "Gestionar tienda",
    theme: {
      iconBox:
        "bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-400 dark:border-indigo-900/40",
      badge:
        "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800",
      footerText: "text-indigo-600 dark:text-indigo-400",
      dot: "bg-indigo-500",
    },
  },
];

export const MainMenuPage = () => {
  const { openPos, getPosUrl } = usePosNavigation();
  const tenant = useAuthStore((state) => state.tenant);

  return (
    <div className="space-y-6 w-full min-w-0 max-w-full pb-8">
      {/* 1. Header con estilo Modern Rounded Design */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {/* Breadcrumbs en mayúsculas con jerarquía */}
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
            <span className="text-slate-400 dark:text-slate-500">PANEL</span>
            <span className="text-slate-400 dark:text-slate-500 font-bold">›</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold">INICIO OPERATIVO</span>
          </div>

          {/* Título y bajada descriptiva */}
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Inicio operativo
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Accesos principales y novedades del comercio
          </p>
        </div>

        {/* Fila de Botones Píldora */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer"
            title="Actualizar estado"
          >
            <RefreshCw size={15} className="text-slate-500 dark:text-slate-400" />
            <span className="hidden sm:inline">Actualizar</span>
          </button>

          <button
            type="button"
            onClick={() => openPos()}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700 active:scale-95 transition-all cursor-pointer"
          >
            <ShoppingCart size={16} strokeWidth={2.5} />
            <span>Nueva venta</span>
          </button>
        </div>
      </header>

      {/* 2. Sección de Operaciones Frecuentes (Grid 2 en 2 en móvil, 3 en 3 en escritorio) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              ACCESOS RÁPIDOS
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              Operaciones frecuentes
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3.5 lg:gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            const isPos = action.to === routePaths.pos;
            const targetUrl = isPos ? getPosUrl() : action.to;

            return (
              <Link
                key={action.to}
                to={targetUrl}
                onClick={(e) => {
                  if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
                    if (isPos) {
                      e.preventDefault();
                      openPos();
                    }
                  }
                }}
                className={cn(
                  "group relative flex flex-col justify-between rounded-2xl sm:rounded-3xl border bg-white p-3.5 sm:p-4.5 shadow-xs transition-all cursor-pointer text-left select-none dark:bg-slate-900",
                  "border-slate-200/90 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] dark:border-slate-800 dark:hover:border-slate-700"
                )}
              >
                {/* Cabecera de la tarjeta: Icono redondeado y Badge píldora */}
                <div className="flex items-center justify-between gap-2">
                  <div
                    className={cn(
                      "flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl border transition-transform group-hover:scale-105",
                      action.theme.iconBox
                    )}
                  >
                    <Icon size={19} />
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider shrink-0",
                      action.theme.badge
                    )}
                  >
                    {action.badge}
                  </span>
                </div>

                {/* Cuerpo de la tarjeta: Categoría y Título destacado */}
                <div className="mt-2.5 sm:mt-3">
                  <p className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                    {action.category}
                  </p>
                  <div className="mt-0.5 flex items-baseline gap-1">
                    <span className="text-base sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                      {action.label}
                    </span>
                  </div>
                </div>

                {/* Pie de la tarjeta: Indicador de estado y flecha */}
                <div className="mt-2.5 sm:mt-3 flex items-center justify-between border-t border-slate-100 pt-2 sm:pt-2.5 text-[10.5px] sm:text-xs font-medium dark:border-slate-800">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", action.theme.dot)} />
                    <span className={cn("truncate font-medium", action.theme.footerText)}>
                      {action.actionText}
                    </span>
                  </div>
                  <ArrowRight
                    size={13}
                    className="text-slate-400 dark:text-slate-500 shrink-0 group-hover:translate-x-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-all ml-1"
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 3. Sección de Comunicaciones y Estado (Grid 2 en 2 en móvil, 3 en 3 en escritorio) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              SISTEMA & COMUNICACIONES
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              Novedades del comercio
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3.5 lg:gap-4">
          {/* Card 1: Novedades / Comunicaciones */}
          <div className="relative flex flex-col justify-between rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-3.5 sm:p-4.5 shadow-xs transition-all dark:border-slate-800 dark:bg-slate-900 text-left select-none">
            <div className="flex items-center justify-between gap-2">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-950/60 dark:text-blue-400 dark:border-blue-900/40">
                <Bell size={18} />
              </div>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
                SISTEMA
              </span>
            </div>

            <div className="mt-2.5 sm:mt-3">
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                Canal de avisos
              </p>
              <div className="mt-0.5">
                <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate block">
                  Todo al día
                </span>
              </div>
              <p className="mt-1 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                No hay comunicados nuevos para tu comercio.
              </p>
            </div>

            <div className="mt-2.5 sm:mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2 sm:pt-2.5 text-[10.5px] sm:text-xs font-medium text-emerald-600 dark:border-slate-800 dark:text-emerald-400 truncate">
              <CheckCircle2 size={13} className="shrink-0" />
              <span className="truncate">Sin avisos pendientes</span>
            </div>
          </div>

          {/* Card 2: Atajo rápido POS */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => openPos()}
            onKeyDown={(e) => e.key === "Enter" && openPos()}
            className="group relative flex flex-col justify-between rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-3.5 sm:p-4.5 shadow-xs transition-all cursor-pointer dark:border-slate-800 dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] text-left select-none"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-900/40">
                <Zap size={18} />
              </div>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                ATAJO F4
              </span>
            </div>

            <div className="mt-2.5 sm:mt-3">
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                Productividad rápida
              </p>
              <div className="mt-0.5">
                <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors truncate block">
                  Terminal POS
                </span>
              </div>
              <p className="mt-1 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                Presiona F4 desde cualquier módulo para abrir el POS.
              </p>
            </div>

            <div className="mt-2.5 sm:mt-3 flex items-center justify-between border-t border-slate-100 pt-2 sm:pt-2.5 text-[10.5px] sm:text-xs font-medium dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 truncate">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span className="truncate">Acceso directo F4</span>
              </div>
              <ArrowRight
                size={13}
                className="text-slate-400 dark:text-slate-500 shrink-0 group-hover:translate-x-0.5 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-all ml-1"
              />
            </div>
          </div>

          {/* Card 3: Estado del comercio */}
          <div className="col-span-2 lg:col-span-1 relative flex flex-col justify-between rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-3.5 sm:p-4.5 shadow-xs transition-all dark:border-slate-800 dark:bg-slate-900 text-left select-none">
            <div className="flex items-center justify-between gap-2">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900/40">
                <Store size={18} />
              </div>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                EN LÍNEA
              </span>
            </div>

            <div className="mt-2.5 sm:mt-3">
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                Comercio conectado
              </p>
              <div className="mt-0.5">
                <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate block">
                  {tenant?.tradeName || tenant?.legalName || "Mi Comercio"}
                </span>
              </div>
              <p className="mt-1 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                Catálogo, stock y precios sincronizados en tiempo real.
              </p>
            </div>

            <div className="mt-2.5 sm:mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2 sm:pt-2.5 text-[10.5px] sm:text-xs font-medium text-emerald-600 dark:border-slate-800 dark:text-emerald-400 truncate">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
              <span className="truncate">Sistema operativo</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
