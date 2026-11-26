import { useState } from "react";
import {
  Clock,
  Edit2,
  Trash2,
  Power,
  CheckCircle,
  AlertTriangle,
  UserCheck,
  MoreVertical,
} from "lucide-react";
import type { Employee, EmployeeAttendance } from "@/types/entities";
import { cn } from "@/utils/cn";

interface EmployeesTableProps {
  employees: Employee[];
  todayActiveByEmployee: Map<string, EmployeeAttendance>;
  pendingAdvancesByEmployee?: Map<string, number>;
  canWrite: boolean;
  onSelectEmployee: (employee: Employee) => void;
  onOpenCurrentAccount?: (employee: Employee) => void;
  onOpenProductConsumption?: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  onToggleActive: (employee: Employee) => void;
  onPunchIn?: (employee: Employee) => void;
  onPunchOut?: (attendanceId: string, employee: Employee) => void;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const EmployeesTable = ({
  employees,
  todayActiveByEmployee,
  pendingAdvancesByEmployee,
  canWrite,
  onSelectEmployee,
  onEdit,
  onDelete,
  onToggleActive,
}: EmployeesTableProps) => {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  if (employees.length === 0) {
    return (
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-8 text-center text-sm text-slate-500 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        <p className="font-semibold text-slate-800 dark:text-slate-200">
          No se encontraron empleados registrados
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Hacé clic en &quot;Nuevo Empleado&quot; para registrar el primer integrante del equipo.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0">
      {/* ============================================================== */}
      {/* 1. VISTA MÓVIL: TARJETAS INDIVIDUALES ELEVADAS (md:hidden)     */}
      {/* ============================================================== */}
      <div className="space-y-3 md:hidden">
        {employees.map((employee) => {
          const activeShift = todayActiveByEmployee.get(employee.id);
          const ctaCteBalance = employee.current_balance ?? 0;
          const pendingAdv = pendingAdvancesByEmployee?.get(employee.id) ?? 0;
          const totalDebt = (ctaCteBalance > 0 ? ctaCteBalance : 0) + pendingAdv;
          const totalCredit = ctaCteBalance < 0 ? Math.abs(ctaCteBalance) : 0;
          const netBalance = totalCredit - totalDebt;
          const hasTotalDebt = netBalance < 0;
          const hasTotalCredit = netBalance > 0;
          const isMenuOpen = menuOpenId === employee.id;

          return (
            <article
              key={employee.id}
              className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col gap-2.5 transition-all"
            >
              {/* Zona 1: Pills de Metadata y Estado de Turno / Activo */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                  {/* Documento */}
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200/60 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700/60 font-mono">
                    <span className="uppercase text-slate-400 mr-1 text-[10px]">{employee.document_type}</span>
                    {employee.document_number}
                  </span>

                  {/* Puesto */}
                  {employee.position ? (
                    <span className="inline-flex items-center rounded-full bg-slate-100/80 px-2 py-0.5 text-xs font-medium text-slate-500 border border-slate-200/40 dark:bg-slate-800/70 dark:text-slate-400 dark:border-slate-700/40 max-w-[130px] truncate">
                      {employee.position}
                    </span>
                  ) : null}

                  {/* Estado del Turno Hoy */}
                  {activeShift ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900 animate-pulse">
                      <Clock size={11} />
                      <span>En turno ({activeShift.check_in})</span>
                    </span>
                  ) : null}
                </div>

                {/* Badge de Estado con punto de color */}
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold border shrink-0",
                    employee.is_active
                      ? "bg-emerald-50 border-emerald-200/80 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-400"
                      : "bg-slate-100 border-slate-200/80 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                  )}
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      employee.is_active ? "bg-emerald-500" : "bg-slate-400"
                    )}
                  />
                  <span>{employee.is_active ? "Activo" : "Inactivo"}</span>
                </span>
              </div>

              {/* Zona 2: Nombre Principal / Legajo y Contacto */}
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 font-bold text-sm text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 shadow-2xs mt-0.5">
                  {employee.full_name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <h3
                    onClick={() => onSelectEmployee(employee)}
                    className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition"
                  >
                    {employee.full_name}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500 font-mono truncate">
                    {employee.code}
                    {employee.phone ? ` • ${employee.phone}` : ""}
                    {employee.email ? ` • ${employee.email}` : ""}
                  </p>
                </div>
              </div>

              {/* Zona 3: Métrica Principal (Sueldo Base) y Botones de Acción */}
              <div className="flex items-end justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    SUELDO BASE
                  </span>
                  <span className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight font-mono truncate">
                    {currency.format(employee.base_salary || 0)}
                  </span>
                </div>

                {/* Botones de Acción */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Botón Principal: Ver Ficha (Icono circular en móvil, píldora con texto en pantallas mayores) */}
                  <button
                    type="button"
                    title="Ver Ficha Integral del Empleado"
                    onClick={() => onSelectEmployee(employee)}
                    className="flex h-9 w-9 sm:w-auto sm:px-3 items-center justify-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 active:scale-95 dark:border-blue-800 dark:bg-blue-950/70 dark:text-blue-300 transition-all cursor-pointer shadow-2xs shrink-0"
                    aria-label="Ver Ficha"
                  >
                    <UserCheck size={15} />
                    <span className="hidden sm:inline text-xs font-semibold">Ver Ficha</span>
                  </button>

                  {/* Menú Más Opciones (...) */}
                  {canWrite && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setMenuOpenId(isMenuOpen ? null : employee.id)}
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-slate-50/80 text-slate-500 hover:border-slate-300 hover:bg-slate-100 active:scale-95 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:bg-slate-800 transition-all cursor-pointer",
                          isMenuOpen && "ring-2 ring-blue-500/30"
                        )}
                        title="Más opciones del empleado"
                        aria-label="Más opciones del empleado"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {isMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40 bg-transparent"
                            onClick={() => setMenuOpenId(null)}
                            aria-hidden="true"
                          />
                          <div
                            className="absolute right-0 bottom-full mb-2 z-50 w-52 rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer"
                              onClick={() => {
                                setMenuOpenId(null);
                                onEdit(employee);
                              }}
                            >
                              <Edit2 className="h-4 w-4 text-blue-500" />
                              Editar empleado
                            </button>
                            <button
                              type="button"
                              className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer"
                              onClick={() => {
                                setMenuOpenId(null);
                                onToggleActive(employee);
                              }}
                            >
                              <Power className="h-4 w-4 text-amber-500" />
                              {employee.is_active ? "Desactivar empleado" : "Activar empleado"}
                            </button>
                            <button
                              type="button"
                              className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 text-left transition-colors cursor-pointer"
                              onClick={() => {
                                setMenuOpenId(null);
                                onDelete(employee);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-rose-500" />
                              Eliminar empleado
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Zona 4: Sub-panel de Métricas Secundarias (Saldo Total y Límite Cta Cte) */}
              <div className="rounded-xl bg-slate-50/80 border border-slate-200/70 p-2.5 grid grid-cols-2 text-center divide-x divide-slate-200/70 dark:bg-slate-800/40 dark:border-slate-700/60 dark:divide-slate-700/60 text-xs">
                <div className="px-2 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    SALDO TOTAL
                  </span>
                  <span
                    className={cn(
                      "font-bold font-mono text-xs mt-0.5 inline-flex items-center gap-1",
                      hasTotalDebt
                        ? "text-rose-600 dark:text-rose-400"
                        : hasTotalCredit
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    )}
                  >
                    {hasTotalDebt && <AlertTriangle size={11} />}
                    {!hasTotalDebt && !hasTotalCredit && <CheckCircle size={11} />}
                    {hasTotalDebt
                      ? `-${currency.format(Math.abs(netBalance))}`
                      : hasTotalCredit
                      ? `+${currency.format(netBalance)}`
                      : currency.format(0)}
                  </span>
                  {pendingAdv > 0 && (
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                      Adel: {currency.format(pendingAdv)}
                    </span>
                  )}
                </div>

                <div className="px-2 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    LÍMITE CTA CTE
                  </span>
                  <span className="font-bold font-mono text-xs text-slate-700 dark:text-slate-300 mt-0.5">
                    {employee.current_account_enabled
                      ? employee.current_account_limit
                        ? currency.format(employee.current_account_limit)
                        : "Sin tope"
                      : "Deshabilitada"}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">
                    {employee.current_account_enabled ? "CC habilitada" : "Sin compras a cuenta"}
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* ============================================================== */}
      {/* 2. VISTA ESCRITORIO / TABLET: TABLA TRADICIONAL (hidden md:block) */}
      {/* ============================================================== */}
      <div className="hidden md:block ui-table-wrap rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200/80 bg-slate-50/90 font-bold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-200">
            <tr>
              <th className="py-2.5 px-3">Código / Nombre</th>
              <th className="py-2.5 px-2.5 whitespace-nowrap">Documento</th>
              <th className="py-2.5 px-2.5 whitespace-nowrap">Sueldo Base</th>
              <th className="py-2.5 px-2.5 whitespace-nowrap" title="Saldo negativo total: Cuenta corriente + Adelantos pendientes de descuento">
                Saldo Total
              </th>
              <th className="py-2.5 px-2.5 whitespace-nowrap">Turno Hoy</th>
              <th className="py-2.5 px-2.5 whitespace-nowrap">Estado</th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
            {employees.map((employee, index) => {
              const activeShift = todayActiveByEmployee.get(employee.id);
              const ctaCteBalance = employee.current_balance ?? 0;
              const pendingAdv = pendingAdvancesByEmployee?.get(employee.id) ?? 0;
              const totalDebt = (ctaCteBalance > 0 ? ctaCteBalance : 0) + pendingAdv;
              const totalCredit = ctaCteBalance < 0 ? Math.abs(ctaCteBalance) : 0;
              const netBalance = totalCredit - totalDebt;
              const hasTotalDebt = netBalance < 0;
              const hasTotalCredit = netBalance > 0;
              const isDesktopMenuOpen = menuOpenId === `desktop-${employee.id}`;
              const isBottomRow = index >= employees.length - 2 && employees.length > 2;

              return (
                <tr
                  key={employee.id}
                  className="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                >
                  <td className="py-2.5 px-3">
                    <button
                      type="button"
                      onClick={() => onSelectEmployee(employee)}
                      className="flex items-center gap-2 text-left group cursor-pointer max-w-full min-w-0"
                      title={`Abrir legajo integral de ${employee.full_name}`}
                    >
                      <span className="flex h-7 w-7 xl:h-8 xl:w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 font-bold text-xs xl:text-sm text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 group-hover:scale-105 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/60 transition shadow-2xs">
                        {employee.full_name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="block font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition truncate max-w-[130px] lg:max-w-[160px] xl:max-w-[200px]">
                          {employee.full_name}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono truncate block max-w-[130px] lg:max-w-[160px] xl:max-w-[200px]">
                          {employee.code}
                          {employee.position ? ` • ${employee.position}` : ""}
                        </span>
                      </div>
                    </button>
                  </td>

                  <td className="py-2.5 px-2.5 font-mono whitespace-nowrap text-[11px]">
                    <span className="uppercase text-slate-500 mr-1 text-[10px]">
                      {employee.document_type}
                    </span>
                    {employee.document_number}
                  </td>

                  <td className="py-2.5 px-2.5 font-semibold text-slate-900 dark:text-slate-100 font-mono whitespace-nowrap text-xs">
                    {currency.format(employee.base_salary || 0)}
                  </td>

                  <td className="py-2.5 px-2.5 whitespace-nowrap">
                    <div className="flex flex-col gap-0.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold font-mono w-fit ${
                          hasTotalDebt
                            ? "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900"
                            : hasTotalCredit
                            ? "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
                        }`}
                        title={`Saldo total: ${hasTotalDebt ? `-${currency.format(Math.abs(netBalance))}` : currency.format(netBalance)}${employee.current_account_limit ? ` • Límite pactado: ${currency.format(employee.current_account_limit)}` : ""}`}
                      >
                        {hasTotalDebt && <AlertTriangle size={11} />}
                        {!hasTotalDebt && !hasTotalCredit && <CheckCircle size={11} />}
                        {hasTotalDebt ? `-${currency.format(Math.abs(netBalance))}` : hasTotalCredit ? `+${currency.format(netBalance)}` : currency.format(0)}
                      </span>
                      {pendingAdv > 0 ? (
                        <span className="text-[10px] text-slate-400 font-mono">
                          Cta: {currency.format(ctaCteBalance)} • Adel: {currency.format(pendingAdv)}
                        </span>
                      ) : employee.current_account_limit ? (
                        <span className="text-[10px] text-slate-400 font-mono">
                          Lím: {currency.format(employee.current_account_limit)}
                        </span>
                      ) : null}
                    </div>
                  </td>

                  {/* Estado de Fichada Hoy */}
                  <td className="py-2.5 px-2.5 whitespace-nowrap">
                    {activeShift ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900 animate-pulse">
                        <Clock size={11} />
                        <span>En turno ({activeShift.check_in})</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 border border-slate-200/60 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700/60 shadow-2xs">
                        <Clock size={11} className="text-slate-400" />
                        <span>Fuera de turno</span>
                      </span>
                    )}
                  </td>

                  <td className="py-2.5 px-2.5 whitespace-nowrap">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        employee.is_active
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {employee.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>

                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Botón Principal: Ver Ficha Píldora */}
                      <button
                        type="button"
                        title="Ver Ficha Integral del Empleado (Horarios, Cta Cte, Sueldos)"
                        onClick={() => onSelectEmployee(employee)}
                        className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/70 dark:text-blue-300 transition cursor-pointer shadow-2xs active:scale-95"
                      >
                        <UserCheck size={12} />
                        <span>Ver Ficha</span>
                      </button>

                      {/* Menú Más Opciones (Editar, Activar/Desactivar, Eliminar) */}
                      {canWrite && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setMenuOpenId(isDesktopMenuOpen ? null : `desktop-${employee.id}`)}
                            className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-full border border-slate-200/80 bg-slate-50/80 text-slate-500 hover:border-slate-300 hover:bg-slate-100 active:scale-95 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:bg-slate-800 transition-all cursor-pointer",
                              isDesktopMenuOpen && "ring-2 ring-blue-500/30"
                            )}
                            title="Más opciones del empleado"
                            aria-label="Más opciones del empleado"
                          >
                            <MoreVertical size={14} />
                          </button>

                          {isDesktopMenuOpen && (
                            <>
                              <div
                                className="fixed inset-0 z-40 bg-transparent"
                                onClick={() => setMenuOpenId(null)}
                                aria-hidden="true"
                              />
                              <div
                                className={cn(
                                  "absolute right-0 z-50 w-52 rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-100 text-left",
                                  isBottomRow ? "bottom-full mb-1.5" : "top-full mt-1.5"
                                )}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer"
                                  onClick={() => {
                                    setMenuOpenId(null);
                                    onEdit(employee);
                                  }}
                                >
                                  <Edit2 className="h-4 w-4 text-blue-500" />
                                  Editar empleado
                                </button>
                                <button
                                  type="button"
                                  className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer"
                                  onClick={() => {
                                    setMenuOpenId(null);
                                    onToggleActive(employee);
                                  }}
                                >
                                  <Power className="h-4 w-4 text-amber-500" />
                                  {employee.is_active ? "Desactivar empleado" : "Activar empleado"}
                                </button>
                                <button
                                  type="button"
                                  className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 text-left transition-colors cursor-pointer"
                                  onClick={() => {
                                    setMenuOpenId(null);
                                    onDelete(employee);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-rose-500" />
                                  Eliminar empleado
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
