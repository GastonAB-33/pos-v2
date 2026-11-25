import { useMemo } from "react";
import {
  BarChart3,
  FileText,
  Landmark,
  Package,
  Shield,
  ShoppingCart,
  Sliders,
  Sparkles,
  Truck,
  UserCheck,
  Users,
} from "lucide-react";
import type { AppModule } from "@/types/modules";
import type { PermissionProfile } from "@/types/permissions";
import { createDefaultPermissionProfile } from "@/types/permissions";
import {
  defaultSystemModuleGroups,
  type SystemModuleGroup,
  type SystemModuleItem,
} from "@/modules/usuarios/constants/module-groups";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { cn } from "@/utils/cn";

export interface LegacyModuleItem {
  module: AppModule;
  label: string;
  isSubmodule?: boolean;
  description?: string;
}

export interface ModuleGroup {
  id: string;
  label: string;
  description?: string;
  iconName?: string;
  modules: (SystemModuleItem | LegacyModuleItem)[];
}

interface PermissionMatrixProps {
  groups?: ModuleGroup[] | SystemModuleGroup[];
  value: PermissionProfile;
  disabled?: boolean;
  onChange: (next: PermissionProfile) => void;
}

const renderGroupIcon = (iconName?: string) => {
  switch (iconName) {
    case "shopping-cart":
      return <ShoppingCart className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />;
    case "package":
      return <Package className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />;
    case "truck":
      return <Truck className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />;
    case "users":
      return <Users className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400" />;
    case "landmark":
      return <Landmark className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />;
    case "file-text":
      return <FileText className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" />;
    case "user-check":
      return <UserCheck className="h-4 w-4 shrink-0 text-pink-600 dark:text-pink-400" />;
    case "bar-chart":
      return <BarChart3 className="h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400" />;
    case "sliders":
      return <Sliders className="h-4 w-4 shrink-0 text-slate-700 dark:text-slate-300" />;
    default:
      return <Shield className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />;
  }
};

export const PermissionMatrix = ({
  groups,
  value,
  disabled,
  onChange,
}: PermissionMatrixProps) => {
  const activeGroups = groups && groups.length > 0 ? groups : defaultSystemModuleGroups;

  const normalized = useMemo(
    () => ({
      ...createDefaultPermissionProfile(),
      ...value,
    }),
    [value]
  );

  const getAccess = (module: AppModule): "none" | "read" | "write" => {
    if (normalized[module]?.write) return "write";
    if (normalized[module]?.read) return "read";
    return "none";
  };

  const setSingleAccess = (module: AppModule, access: "none" | "read" | "write") => {
    const accessMap: Record<"none" | "read" | "write", { read: boolean; write: boolean }> = {
      none: { read: false, write: false },
      read: { read: true, write: false },
      write: { read: true, write: true },
    };

    const next: PermissionProfile = {
      ...normalized,
      [module]: {
        ...normalized[module],
        ...accessMap[access],
      },
    };

    // Si se modifica configuracion general, sincronizar con configuracion_sistema
    if (module === "configuracion") {
      next.configuracion_sistema = { ...accessMap[access] };
    }

    onChange(next);
  };

  const setGroupAccess = (
    groupModules: (SystemModuleItem | LegacyModuleItem)[],
    access: "none" | "read" | "write"
  ) => {
    const accessMap: Record<"none" | "read" | "write", { read: boolean; write: boolean }> = {
      none: { read: false, write: false },
      read: { read: true, write: false },
      write: { read: true, write: true },
    };

    const next: PermissionProfile = { ...normalized };
    for (const item of groupModules) {
      if (item.module === "caja_cierre_ciego" && access !== "none") {
        continue;
      }
      next[item.module] = {
        ...next[item.module],
        ...accessMap[access],
      };
      if (item.module === "configuracion") {
        next.configuracion_sistema = { ...accessMap[access] };
      }
    }

    onChange(next);
  };

  return (
    <div className="space-y-4">
      {/* Listado Directo y Limpio de Grupos Funcionales (Sin panel superior saturado) */}
      <div className="space-y-4">
        {activeGroups.map((group) => {
          return (
            <section
              key={group.id}
              className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-3 sm:p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-800/40"
            >
              {/* Cabecera del Grupo con Acciones Rápidas */}
              <header className="mb-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-2 dark:border-slate-700/80">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white shadow-2xs dark:bg-slate-800">
                    {renderGroupIcon((group as SystemModuleGroup).iconName)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {group.label}
                      </h4>
                      <span className="rounded-full bg-slate-200/70 px-2 py-0.2 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        {group.modules.length} {group.modules.length === 1 ? "módulo" : "módulos"}
                      </span>
                    </div>
                    {group.description ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {group.description}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Acciones rápidas para el grupo entero */}
                <div className="flex items-center gap-1 self-start sm:self-auto shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setGroupAccess(group.modules, "none")}
                    disabled={disabled}
                    className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 active:scale-95 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-700/70 dark:hover:text-slate-200 transition-all cursor-pointer"
                  >
                    Sin acceso
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupAccess(group.modules, "read")}
                    disabled={disabled}
                    className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-100/70 hover:text-blue-800 active:scale-95 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-900/40 dark:hover:text-blue-200 transition-all cursor-pointer"
                  >
                    Solo Lectura
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupAccess(group.modules, "write")}
                    disabled={disabled}
                    className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-100/70 hover:text-emerald-800 active:scale-95 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-900/40 dark:hover:text-emerald-200 transition-all cursor-pointer"
                  >
                    Acceso Total
                  </button>
                </div>
              </header>

              {/* Filas de Módulos Simplificadas */}
              <div className="space-y-1.5">
                {group.modules.map((item) => {
                  const access = getAccess(item.module);
                  const isSpecial =
                    (item as SystemModuleItem).isSpecialAction ||
                    (item as LegacyModuleItem).isSubmodule;
                  const sysItem = item as SystemModuleItem;

                  return (
                    <div
                      key={item.module}
                      className={cn(
                        "flex flex-col gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 shadow-2xs dark:border-slate-700/80 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between transition-all hover:border-slate-300 dark:hover:border-slate-600",
                        isSpecial ? "border-amber-200/80 bg-amber-50/15 dark:border-amber-900/40 dark:bg-amber-950/10" : ""
                      )}
                    >
                      {/* Nombre completo del módulo + Tooltip interactivo (Nunca se corta) */}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">
                          {item.label}
                        </p>

                        <InfoTooltip
                          title={item.label}
                          buttonAriaLabel={`Ayuda del módulo ${item.label}`}
                          content={
                            <div className="space-y-2">
                              {item.description && (
                                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                                  {item.description}
                                </p>
                              )}

                              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-2.5 dark:border-slate-700/80 dark:bg-slate-800/60 space-y-1.5 text-[11px]">
                                <div className="flex items-start gap-1.5">
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                                    Acceso Total:
                                  </span>
                                  <span className="text-slate-700 dark:text-slate-200">
                                    {sysItem.writeDescription ?? "Control completo: creación, edición, guardado y operaciones avanzadas."}
                                  </span>
                                </div>
                                <div className="flex items-start gap-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                                  <span className="font-bold text-blue-600 dark:text-blue-400 shrink-0">
                                    Solo Lectura:
                                  </span>
                                  <span className="text-slate-700 dark:text-slate-200">
                                    {sysItem.readDescription ?? "Solo consulta y visualización de registros y reportes (sin modificar)."}
                                  </span>
                                </div>
                                <div className="flex items-start gap-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                                  <span className="font-bold text-slate-500 dark:text-slate-400 shrink-0">
                                    Sin acceso:
                                  </span>
                                  <span className="text-slate-500 dark:text-slate-400">
                                    El usuario no podrá ver ni acceder a este módulo.
                                  </span>
                                </div>
                              </div>
                            </div>
                          }
                        />

                        {isSpecial ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 shrink-0">
                            <Sparkles size={11} />
                            Especial
                          </span>
                        ) : null}
                      </div>

                      {/* Selector de Permiso: Arqueo visible vs Cierre a ciegas para caja_cierre_ciego, o selector de tres estados estándar */}
                      {item.module === "caja_cierre_ciego" ? (
                        <div className="grid grid-cols-2 gap-1 shrink-0 rounded-xl bg-slate-100 p-1 dark:border dark:border-slate-700/80 dark:bg-slate-800 w-full sm:w-auto">
                          <button
                            type="button"
                            className={cn(
                              "rounded-lg px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold transition-all text-center leading-tight flex items-center justify-center cursor-pointer",
                              access === "none"
                                ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white"
                                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                            )}
                            onClick={() => setSingleAccess(item.module, "none")}
                            disabled={disabled}
                            title="Arqueo visible estándar: el usuario visualiza los saldos esperados y cobros"
                          >
                            Arqueo visible
                          </button>
                          <button
                            type="button"
                            className={cn(
                              "rounded-lg px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold transition-all text-center leading-tight flex items-center justify-center cursor-pointer",
                              access !== "none"
                                ? "bg-amber-600 text-white shadow-2xs shadow-amber-500/25"
                                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                            )}
                            onClick={() => setSingleAccess(item.module, "write")}
                            disabled={disabled}
                            title="Cierre a ciegas obligatorio: se ocultan los importes y ventas antes del cierre"
                          >
                            A ciegas (Obligatorio)
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-1 shrink-0 rounded-xl bg-slate-100 p-1 dark:border dark:border-slate-700/80 dark:bg-slate-800 w-full sm:w-auto">
                          <button
                            type="button"
                            className={cn(
                              "rounded-lg px-2 py-1.5 text-[11px] sm:text-xs font-semibold transition-all text-center leading-tight flex items-center justify-center cursor-pointer",
                              access === "none"
                                ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white"
                                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                            )}
                            onClick={() => setSingleAccess(item.module, "none")}
                            disabled={disabled}
                            title="Sin acceso al módulo"
                          >
                            Sin acceso
                          </button>
                          <button
                            type="button"
                            className={cn(
                              "rounded-lg px-2 py-1.5 text-[11px] sm:text-xs font-semibold transition-all text-center leading-tight flex items-center justify-center cursor-pointer",
                              access === "read"
                                ? "bg-blue-600 text-white shadow-2xs shadow-blue-500/25"
                                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                            )}
                            onClick={() => setSingleAccess(item.module, "read")}
                            disabled={disabled}
                            title="Acceso solo lectura / consulta"
                          >
                            Solo Lectura
                          </button>
                          <button
                            type="button"
                            className={cn(
                              "rounded-lg px-2 py-1.5 text-[11px] sm:text-xs font-semibold transition-all text-center leading-tight flex items-center justify-center cursor-pointer",
                              access === "write"
                                ? "bg-emerald-600 text-white shadow-2xs shadow-emerald-500/25"
                                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                            )}
                            onClick={() => setSingleAccess(item.module, "write")}
                            disabled={disabled}
                            title="Acceso total: crear, editar y guardar"
                          >
                            Acceso Total
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
