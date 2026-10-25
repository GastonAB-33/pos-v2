import { useState } from "react";
import {
  ShoppingCart,
  Package,
  Users,
  Wallet,
  Settings,
  Check,
  Shield,
  Sliders,
  ChevronDown,
  ChevronUp,
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

  const [expandedPillars, setExpandedPillars] = useState<Record<string, boolean>>(() => {
    // Todos expandidos por defecto para visibilidad clara
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
    // Si no está definido, por defecto heredaba write (true si write: true)
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
      // Si se da write, habilitar acciones especiales por defecto
      if (item.specialActions) {
        for (const act of item.specialActions) {
          modulePerms[act.id] = access === "write";
        }
      }
      next[item.module] = modulePerms;
    }
    onChange(next);
  };

  // Calcular resumen del grupo
  const getGroupCoverage = (group: ModuleGroup) => {
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

    if (totalWrites === total) return "all_write";
    if (totalReads === total) return "all_read";
    if (totalReads > 0) return "partial";
    return "none";
  };

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const isExpanded = expandedPillars[group.id] ?? true;
        const coverage = getGroupCoverage(group);

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
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {group.label}
                    </h4>
                    {coverage === "all_write" ? (
                      <span className="rounded-md bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                        Acceso Total
                      </span>
                    ) : coverage === "all_read" ? (
                      <span className="rounded-md bg-sky-100 dark:bg-sky-950/80 border border-sky-300 dark:border-sky-800 px-2 py-0.5 text-[10px] font-bold text-sky-800 dark:text-sky-300">
                        Solo Lectura
                      </span>
                    ) : coverage === "partial" ? (
                      <span className="rounded-md bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                        Acceso Parcial
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
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition cursor-pointer"
                  title="Quitar todos los accesos en este pilar"
                >
                  Ninguno
                </button>
                <button
                  type="button"
                  onClick={() => setGroupAccess(group, "read")}
                  disabled={disabled}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition cursor-pointer"
                  title="Dar solo acceso de lectura en este pilar"
                >
                  Solo Lectura
                </button>
                <button
                  type="button"
                  onClick={() => setGroupAccess(group, "write")}
                  disabled={disabled}
                  className="rounded-lg border border-blue-600 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 disabled:opacity-40 transition cursor-pointer"
                  title="Dar acceso total y edición a todo este pilar"
                >
                  Acceso Total
                </button>
                <button
                  type="button"
                  onClick={() => togglePillar(group.id)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ml-1"
                  title={isExpanded ? "Contraer pilar" : "Expandir pilar"}
                >
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
            </header>

            {/* Listado de módulos del pilar */}
            {isExpanded && (
              <div className="p-3 sm:p-4 space-y-2.5">
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
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3">
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

                        {/* Botones de nivel de acceso (3 estados) */}
                        <div className="flex items-center gap-1.5 self-end sm:self-center">
                          <button
                            type="button"
                            className={cn(
                              "px-2.5 py-1 text-xs font-semibold rounded-lg border transition cursor-pointer select-none",
                              access === "none"
                                ? "border-slate-400 bg-slate-100 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 font-bold"
                                : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                            )}
                            onClick={() => setAccess(item.module, "none")}
                            disabled={disabled}
                          >
                            Sin acceso
                          </button>

                          <button
                            type="button"
                            className={cn(
                              "px-2.5 py-1 text-xs font-semibold rounded-lg border transition cursor-pointer select-none",
                              access === "read"
                                ? "border-sky-500 bg-sky-500 text-white font-bold shadow-xs dark:bg-sky-600"
                                : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                            )}
                            onClick={() => setAccess(item.module, "read")}
                            disabled={disabled}
                          >
                            Solo ver
                          </button>

                          <button
                            type="button"
                            className={cn(
                              "px-2.5 py-1 text-xs font-semibold rounded-lg border transition cursor-pointer select-none",
                              access === "write"
                                ? "border-blue-600 bg-blue-600 text-white font-bold shadow-xs dark:bg-blue-600"
                                : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                            )}
                            onClick={() => setAccess(item.module, "write")}
                            disabled={disabled}
                          >
                            Acceder y editar
                          </button>
                        </div>
                      </div>

                      {/* Sub-panel de Acciones Especiales / Permisos Granulares */}
                      {hasSpecialActions && isAccessible && (
                        <div className="border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/30 p-3 rounded-b-xl space-y-2">
                          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Shield size={12} className="text-blue-500" />
                            <span>Atribuciones y Permisos Especiales</span>
                          </p>

                          <div className="grid gap-2 sm:grid-cols-2">
                            {item.specialActions!.map((act) => {
                              const isActive = getActionValue(item.module, act.id);

                              return (
                                <div
                                  key={act.id}
                                  onClick={() => !disabled && toggleSpecialAction(item.module, act.id)}
                                  className={cn(
                                    "flex items-start gap-2.5 p-2 rounded-lg border transition cursor-pointer select-none",
                                    isActive
                                      ? "border-blue-300 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/40"
                                      : "border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
                                      isActive
                                        ? "border-blue-600 bg-blue-600 text-white"
                                        : "border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800"
                                    )}
                                  >
                                    {isActive ? <Check size={12} className="stroke-[3]" /> : null}
                                  </div>
                                  <div>
                                    <p
                                      className={cn(
                                        "text-xs font-semibold leading-tight",
                                        isActive
                                          ? "text-blue-900 dark:text-blue-200"
                                          : "text-slate-700 dark:text-slate-300"
                                      )}
                                    >
                                      {act.label}
                                    </p>
                                    {act.description ? (
                                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                                        {act.description}
                                      </p>
                                    ) : null}
                                  </div>
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
      })}
    </div>
  );
};
