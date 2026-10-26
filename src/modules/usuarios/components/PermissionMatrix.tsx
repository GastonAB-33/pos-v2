import { useState, useMemo } from "react";
import {
  ShoppingCart,
  Package,
  Users,
  Wallet,
  Settings,
  Shield,
  Sliders,
  ChevronDown,
  ChevronUp,
  Ban,
  Eye,
  CheckCircle2,
  Info,
  Search,
  Sparkles,
  RotateCcw,
  Briefcase,
  Crown,
  X,
} from "lucide-react";
import type { AppModule } from "@/types/modules";
import type { PermissionProfile } from "@/types/permissions";
import { createDefaultPermissionProfile } from "@/types/permissions";
import { cn } from "@/utils/cn";

export interface SpecialActionItem {
  id: string;
  label: string;
  description?: string;
}

export interface ModuleItem {
  module: AppModule;
  label: string;
  isSubmodule?: boolean;
  specialActions?: SpecialActionItem[];
}

export interface ModuleGroup {
  id: string;
  label: string;
  description?: string;
  badge?: string;
  icon?: "shopping-cart" | "package" | "users" | "wallet" | "settings";
  modules: ModuleItem[];
}

interface PermissionMatrixProps {
  groups: ModuleGroup[];
  value: PermissionProfile;
  disabled?: boolean;
  onChange: (next: PermissionProfile) => void;
}

const PillarIcon = ({ icon }: { icon?: string }) => {
  switch (icon) {
    case "shopping-cart":
      return <ShoppingCart size={18} className="text-blue-600 dark:text-blue-400" />;
    case "package":
      return <Package size={18} className="text-amber-600 dark:text-amber-400" />;
    case "users":
      return <Users size={18} className="text-purple-600 dark:text-purple-400" />;
    case "wallet":
      return <Wallet size={18} className="text-emerald-600 dark:text-emerald-400" />;
    case "settings":
    default:
      return <Settings size={18} className="text-slate-600 dark:text-slate-400" />;
  }
};

// Clasificación de severidad para badges visuales
const isCriticalAction = (actionId: string): boolean => {
  return [
    "allow_negative_stock",
    "allow_price_override",
    "view_cost_price",
    "view_theoretical_balance",
    "allow_manual_adjustments",
  ].includes(actionId);
};

export const PermissionMatrix = ({
  groups,
  value,
  disabled,
  onChange,
}: PermissionMatrixProps) => {
  const normalized: PermissionProfile = {
    ...createDefaultPermissionProfile(),
    ...value,
  };

  const [search, setSearch] = useState("");

  const [expandedPillars, setExpandedPillars] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const g of groups) {
      initial[g.id] = true;
    }
    return initial;
  });

  const togglePillar = (id: string) => {
    setExpandedPillars((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const setAccess = (module: AppModule, access: "none" | "read" | "write") => {
    const accessMap: Record<"none" | "read" | "write", { read: boolean; write: boolean }> = {
      none: { read: false, write: false },
      read: { read: true, write: false },
      write: { read: true, write: true },
    };

    const nextModulePerms = {
      ...(normalized[module] ?? {}),
      ...accessMap[access],
    };

    onChange({
      ...normalized,
      [module]: nextModulePerms,
    });
  };

  const toggleSpecialAction = (module: AppModule, actionId: string) => {
    const modulePerms = normalized[module] ?? { read: true, write: true };
    const currentVal = modulePerms[actionId];
    const effectiveVal = currentVal !== undefined ? currentVal : Boolean(modulePerms.write);

    onChange({
      ...normalized,
      [module]: {
        ...modulePerms,
        [actionId]: !effectiveVal,
      },
    });
  };

  const getAccess = (module: AppModule): "none" | "read" | "write" => {
    if (normalized[module]?.write) return "write";
    if (normalized[module]?.read) return "read";
    return "none";
  };

  const getActionValue = (module: AppModule, actionId: string): boolean => {
    const modulePerms = normalized[module];
    if (!modulePerms || (!modulePerms.read && !modulePerms.write)) return false;
    if (modulePerms[actionId] !== undefined) {
      return Boolean(modulePerms[actionId]);
    }
    return Boolean(modulePerms.write);
  };

  // Acciones en lote para un pilar completo
  const setGroupAccess = (group: ModuleGroup, access: "none" | "read" | "write") => {
    const next = { ...normalized };
    const accessMap: Record<"none" | "read" | "write", { read: boolean; write: boolean }> = {
      none: { read: false, write: false },
      read: { read: true, write: false },
      write: { read: true, write: true },
    };

    for (const item of group.modules) {
      const modulePerms: Record<string, boolean> = { ...(next[item.module] ?? {}), ...accessMap[access] };
      if (item.specialActions) {
        for (const act of item.specialActions) {
          modulePerms[act.id] = access === "write";
        }
      }
      next[item.module] = modulePerms;
    }
    onChange(next);
  };

  // Plantillas Rápidas con 1 Clic
  const applyPreset = (presetKey: "cashier" | "stock" | "supervisor" | "admin" | "clean") => {
    if (disabled) return;
    const next: PermissionProfile = createDefaultPermissionProfile();

    if (presetKey === "clean") {
      for (const group of groups) {
        for (const item of group.modules) {
          const modPerms: Record<string, boolean> = { read: false, write: false };
          if (item.specialActions) {
            for (const act of item.specialActions) {
              modPerms[act.id] = false;
            }
          }
          next[item.module] = modPerms;
        }
      }
      onChange(next);
      return;
    }

    if (presetKey === "admin") {
      for (const group of groups) {
        for (const item of group.modules) {
          const modPerms: Record<string, boolean> = { read: true, write: true };
          if (item.specialActions) {
            for (const act of item.specialActions) {
              modPerms[act.id] = true;
            }
          }
          next[item.module] = modPerms;
        }
      }
      onChange(next);
      return;
    }

    // Limpiar base para presets específicos
    for (const group of groups) {
      for (const item of group.modules) {
        const modPerms: Record<string, boolean> = { read: false, write: false };
        if (item.specialActions) {
          for (const act of item.specialActions) {
            modPerms[act.id] = false;
          }
        }
        next[item.module] = modPerms;
      }
    }

    if (presetKey === "cashier") {
      // 🛒 Cajero: Ventas, Caja (con arqueo ciego sin saldo teórico), sin ver costos ni cambiar precios
      next.pos = {
        read: true,
        write: true,
        allow_manual_discount: true,
        allow_price_override: false,
        allow_negative_stock: false,
      };
      next.comprobantes = { read: true, write: false };
      next.facturacion = { read: true, write: false };
      next.caja = {
        read: true,
        write: true,
        allow_manual_movements: true,
        view_theoretical_balance: false,
      };
      next.clientes = { read: true, write: false };
      next.cuentas_corrientes = { read: true, write: false };
      next.productos = { read: true, write: false };
      next.stock = {
        read: true,
        write: false,
        view_cost_price: false,
        allow_manual_adjustments: false,
      };
      next.listas_precios = { read: true, write: false };
      next.promociones = { read: true, write: false };
      onChange(next);
      return;
    }

    if (presetKey === "stock") {
      // 📦 Repositor: Control de catálogo, stock y recepción de compras, sin ver caja ni márgenes
      next.productos = { read: true, write: true };
      next.stock = {
        read: true,
        write: true,
        allow_manual_adjustments: true,
        view_cost_price: false,
      };
      next.compras = { read: true, write: true };
      next.compras_margen = { read: false, write: false };
      next.proveedores = { read: true, write: false };
      next.listas_precios = { read: true, write: false };
      next.promociones = { read: true, write: false };
      onChange(next);
      return;
    }

    if (presetKey === "supervisor") {
      // 💼 Encargado: Casi todo habilitado excepto usuarios, bancos y config sensible
      for (const group of groups) {
        for (const item of group.modules) {
          if (["usuarios", "configuracion", "configuracion_sistema", "bancos"].includes(item.module)) {
            next[item.module] = { read: false, write: false };
          } else {
            const modPerms: Record<string, boolean> = { read: true, write: true };
            if (item.specialActions) {
              for (const act of item.specialActions) {
                modPerms[act.id] = true;
              }
            }
            next[item.module] = modPerms;
          }
        }
      }
      onChange(next);
      return;
    }
  };

  // Filtro de búsqueda
  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return groups;

    return groups
      .map((g) => {
        const matchingModules = g.modules.filter((m) => {
          if (m.label.toLowerCase().includes(term)) return true;
          if (
            m.specialActions?.some(
              (a) =>
                a.label.toLowerCase().includes(term) ||
                (a.description && a.description.toLowerCase().includes(term))
            )
          ) {
            return true;
          }
          return false;
        });
        if (matchingModules.length > 0) {
          return { ...g, modules: matchingModules };
        }
        return null;
      })
      .filter(Boolean) as ModuleGroup[];
  }, [groups, search]);

  // Resumen del grupo
  const getGroupStats = (group: ModuleGroup) => {
    let totalWrites = 0;
    let totalReads = 0;
    const total = group.modules.length;

    for (const item of group.modules) {
      if (normalized[item.module]?.write) {
        totalWrites += 1;
        totalReads += 1;
      } else if (normalized[item.module]?.read) {
        totalReads += 1;
      }
    }

    let coverage: "all_write" | "all_read" | "partial" | "none" = "none";
    if (totalWrites === total && total > 0) coverage = "all_write";
    else if (totalReads === total && total > 0) coverage = "all_read";
    else if (totalReads > 0) coverage = "partial";

    return { totalWrites, totalReads, total, coverage };
  };

  return (
    <div className="space-y-4">
      {/* 1. Barra de Plantillas Rápidas (1 Clic) y Buscador */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/80 p-3.5 sm:p-4 space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Sparkles size={16} />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Plantillas Rápidas por Puesto
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Configurá el 90% del perfil con 1 solo clic según las mejores prácticas
              </p>
            </div>
          </div>

          {/* Buscador de permisos */}
          <div className="relative min-w-[200px] sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar módulo o permiso..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-8 pr-7 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Botones de Presets */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/70 dark:border-slate-800">
          <button
            type="button"
            onClick={() => applyPreset("cashier")}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-40"
            title="Punto de venta, cobros y arqueos. Bloquea ver costos, márgenes y modificar precios"
          >
            <ShoppingCart size={13} />
            <span>🛒 Cajero / Mostrador</span>
          </button>

          <button
            type="button"
            onClick={() => applyPreset("stock")}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-40"
            title="Catálogo, stock y recepción de mercadería. Sin acceso a caja ni márgenes"
          >
            <Package size={13} />
            <span>📦 Repositor / Stock</span>
          </button>

          <button
            type="button"
            onClick={() => applyPreset("supervisor")}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 dark:border-purple-900/60 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-40"
            title="Control operativo completo de ventas, compras, caja y stock con ajustes"
          >
            <Briefcase size={13} />
            <span>💼 Encargado / Supervisor</span>
          </button>

          <button
            type="button"
            onClick={() => applyPreset("admin")}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-40"
            title="Otorga acceso total y edición a todos los módulos y atribuciones"
          >
            <Crown size={13} />
            <span>👑 Administrador Total</span>
          </button>

          <button
            type="button"
            onClick={() => applyPreset("clean")}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold transition shadow-2xs cursor-pointer ml-auto disabled:opacity-40"
            title="Quita todos los accesos para armar un perfil personalizado desde cero"
          >
            <RotateCcw size={13} />
            <span>Limpiar todo</span>
          </button>
        </div>
      </div>

      {/* 2. Pilares de Módulos */}
      {filteredGroups.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-500 text-xs">
          No se encontraron módulos o permisos que coincidan con "{search}".
        </div>
      ) : (
        filteredGroups.map((group) => {
          const isExpanded = search ? true : (expandedPillars[group.id] ?? true);
          const { totalWrites, total, coverage } = getGroupStats(group);

          return (
            <section
              key={group.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xs overflow-hidden transition-all"
            >
              {/* Cabecera del Pilar con resumen y botones de lote */}
              <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800">
                <div
                  className="flex items-center gap-2.5 cursor-pointer select-none group"
                  onClick={() => togglePillar(group.id)}
                >
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs group-hover:scale-105 transition-transform">
                    <PillarIcon icon={group.icon} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {group.label}
                      </h4>

                      {/* Estado global de cobertura */}
                      {coverage === "all_write" ? (
                        <span className="rounded-md bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                          <CheckCircle2 size={11} />
                          Acceso Total
                        </span>
                      ) : coverage === "all_read" ? (
                        <span className="rounded-md bg-sky-100 dark:bg-sky-950/80 border border-sky-300 dark:border-sky-800 px-2 py-0.5 text-[10px] font-bold text-sky-800 dark:text-sky-300 flex items-center gap-1">
                          <Eye size={11} />
                          Solo Lectura
                        </span>
                      ) : coverage === "partial" ? (
                        <span className="rounded-md bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                          {totalWrites} de {total} activos
                        </span>
                      ) : (
                        <span className="rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          Sin Acceso
                        </span>
                      )}
                    </div>
                    {group.description ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {group.description}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Botones de acción rápida para todo el pilar */}
                <div className="flex items-center gap-1.5 self-end sm:self-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mr-1 hidden lg:inline">
                    Pilar:
                  </span>
                  <button
                    type="button"
                    onClick={() => setGroupAccess(group, "none")}
                    disabled={disabled}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition cursor-pointer"
                    title="Quitar todos los accesos en este pilar"
                  >
                    Ninguno
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupAccess(group, "read")}
                    disabled={disabled}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition cursor-pointer"
                    title="Dar solo acceso de lectura en este pilar"
                  >
                    Solo Lectura
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupAccess(group, "write")}
                    disabled={disabled}
                    className="rounded-lg border border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 disabled:opacity-40 transition cursor-pointer"
                    title="Dar acceso total y edición a todo este pilar"
                  >
                    Acceso Total
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePillar(group.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ml-1 cursor-pointer"
                    title={isExpanded ? "Contraer pilar" : "Expandir pilar"}
                  >
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </header>

              {/* Listado de módulos del pilar */}
              {isExpanded && (
                <div className="p-3 sm:p-4 space-y-3">
                  {group.modules.map((item) => {
                    const access = getAccess(item.module);
                    const hasSpecialActions = Boolean(item.specialActions && item.specialActions.length > 0);
                    const isAccessible = access !== "none";

                    return (
                      <div
                        key={item.module}
                        className={cn(
                          "rounded-xl border transition-colors",
                          item.isSubmodule
                            ? "ml-3 sm:ml-6 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20"
                            : "border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/60"
                        )}
                      >
                        {/* Fila principal del módulo */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                {item.label}
                              </p>
                              {item.isSubmodule ? (
                                <span className="rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.2 text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                  Submódulo
                                </span>
                              ) : null}
                            </div>
                            {hasSpecialActions && isAccessible ? (
                              <p className="text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-1 font-medium">
                                <Sliders size={11} />
                                <span>Controles granulares disponibles abajo</span>
                              </p>
                            ) : null}
                          </div>

                          {/* Segmented Control Semáforo de 3 Estados */}
                          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-950 p-0.5 border border-slate-200 dark:border-slate-800 shrink-0 shadow-2xs self-end sm:self-center">
                            {/* 1. Sin acceso */}
                            <button
                              type="button"
                              onClick={() => setAccess(item.module, "none")}
                              disabled={disabled}
                              title="Sin acceso al módulo"
                              className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer select-none",
                                access === "none"
                                  ? "bg-white text-slate-800 shadow-2xs dark:bg-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-bold"
                                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                              )}
                            >
                              <Ban size={12} className={access === "none" ? "text-slate-600 dark:text-slate-400" : "text-slate-400"} />
                              <span>Sin acceso</span>
                            </button>

                            {/* 2. Solo ver */}
                            <button
                              type="button"
                              onClick={() => setAccess(item.module, "read")}
                              disabled={disabled}
                              title="Solo lectura y consulta de datos"
                              className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer select-none",
                                access === "read"
                                  ? "bg-sky-500 text-white shadow-xs font-bold dark:bg-sky-600 border border-sky-400 dark:border-sky-500"
                                  : "text-slate-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-300"
                              )}
                            >
                              <Eye size={12} className={access === "read" ? "text-white" : "text-sky-500"} />
                              <span>Solo ver</span>
                            </button>

                            {/* 3. Acceso total */}
                            <button
                              type="button"
                              onClick={() => setAccess(item.module, "write")}
                              disabled={disabled}
                              title="Acceso total con permisos de creación y edición"
                              className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer select-none",
                                access === "write"
                                  ? "bg-emerald-600 text-white shadow-xs font-bold dark:bg-emerald-600 border border-emerald-500"
                                  : "text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-300"
                              )}
                            >
                              <CheckCircle2 size={12} className={access === "write" ? "text-white" : "text-emerald-500"} />
                              <span>Acceso total</span>
                            </button>
                          </div>
                        </div>

                        {/* Sub-panel de Atribuciones y Permisos Especiales */}
                        {hasSpecialActions && isAccessible && (
                          <div className="border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/30 p-3 rounded-b-xl space-y-2">
                            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                              <Shield size={12} className="text-blue-500" />
                              <span>Atribuciones y Permisos Especiales</span>
                            </p>

                            <div className="grid gap-2 sm:grid-cols-2">
                              {item.specialActions!.map((act) => {
                                const isActive = getActionValue(item.module, act.id);
                                const isCritical = isCriticalAction(act.id);

                                return (
                                  <div
                                    key={act.id}
                                    className={cn(
                                      "flex items-center justify-between gap-2.5 p-2.5 rounded-xl border transition select-none",
                                      isActive
                                        ? "border-emerald-200 dark:border-emerald-900/70 bg-emerald-50/50 dark:bg-emerald-950/20"
                                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 opacity-75 hover:opacity-100"
                                    )}
                                  >
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <span
                                        className={cn(
                                          "text-xs font-semibold truncate",
                                          isActive
                                            ? "text-slate-900 dark:text-slate-100 font-bold"
                                            : "text-slate-600 dark:text-slate-400"
                                        )}
                                      >
                                        {act.label}
                                      </span>

                                      {/* Badge de nivel de criticidad */}
                                      {isCritical ? (
                                        <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                          🛡️ Crítico
                                        </span>
                                      ) : (
                                        <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                          ⚡ Operativo
                                        </span>
                                      )}

                                      {/* Tooltip flotante al pasar el mouse por el icono de información */}
                                      {act.description && (
                                        <div className="relative group/tip shrink-0 inline-flex items-center">
                                          <Info
                                            size={13}
                                            className="text-slate-400 hover:text-blue-500 cursor-help transition"
                                          />
                                          <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tip:flex flex-col z-50 w-64 rounded-xl bg-slate-900/95 dark:bg-slate-950/95 border border-slate-700 p-2.5 text-[11px] text-slate-200 shadow-2xl backdrop-blur-md">
                                            <span className="font-bold text-white mb-0.5">{act.label}</span>
                                            <span className="text-slate-300 leading-snug">{act.description}</span>
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-700" />
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {/* Switch Toggle Moderno */}
                                    <button
                                      type="button"
                                      role="switch"
                                      aria-checked={isActive}
                                      onClick={() => !disabled && toggleSpecialAction(item.module, act.id)}
                                      disabled={disabled}
                                      title={isActive ? "Habilitado (clic para deshabilitar)" : "Deshabilitado (clic para habilitar)"}
                                      className={cn(
                                        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                                        isActive ? "bg-emerald-600 dark:bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                                      )}
                                    >
                                      <span
                                        aria-hidden="true"
                                        className={cn(
                                          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                                          isActive ? "translate-x-4" : "translate-x-0"
                                        )}
                                      />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
};
