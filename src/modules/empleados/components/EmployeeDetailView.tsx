import { useState, useMemo, useEffect } from "react";
import {
  ArrowLeft,
  Clock,
  CreditCard,
  Receipt,
  User,
  LogIn,
  LogOut,
  PlusCircle,
  ShoppingBag,
  Coins,
  Edit2,
  Trash2,
  Calendar,
  Phone,
  Mail,
  Briefcase,
  IdCard,
  X,
} from "lucide-react";
import type {
  Employee,
  EmployeeAttendance,
  EmployeeSalaryPayment,
  EmployeeAttendanceStatus,
} from "@/types/entities";
import { EmployeeCurrentAccountPanel } from "./EmployeeCurrentAccountPanel";
import { AttendanceManualModal } from "./AttendanceManualModal";
import { SalaryPaymentModal } from "./SalaryPaymentModal";
import { SalaryAdvanceModal } from "./SalaryAdvanceModal";
import { isAdvancePayment } from "../hooks/useEmployeeSalaryPayments";

interface EmployeeDetailViewProps {
  employee: Employee;
  allEmployees: Employee[];
  tenantId: string;
  userId: string | null;
  canWrite: boolean;
  initialSubTab?: DetailSubTab;
  onBackToList: () => void;
  onSelectEmployee: (emp: Employee) => void;
  onEditEmployee: (emp: Employee) => void;
  onReloadAll: () => Promise<void>;
  // Attendance
  attendances: EmployeeAttendance[];
  todayActiveShift?: EmployeeAttendance;
  onPunchIn: (employeeId: string) => Promise<boolean>;
  onPunchOut: (attendanceId: string) => Promise<boolean>;
  onCreateManualAttendance: (values: {
    employee_id: string;
    date: string;
    check_in: string;
    check_out: string | null;
    status: EmployeeAttendanceStatus;
    notes?: string;
  }) => Promise<boolean>;
  onUpdateAttendance: (id: string, values: Partial<EmployeeAttendance>) => Promise<boolean>;
  onDeleteAttendance: (id: string) => Promise<boolean>;
  // Salary
  payments: EmployeeSalaryPayment[];
  onCreateSalaryPayment: (values: {
    employee_id: string;
    period: string;
    gross_amount: number;
    deductions_amount: number;
    current_account_discount_applied: number;
    advances_discount_applied?: number;
    bonuses_amount: number;
    net_amount_paid: number;
    payment_method_code: string;
    payment_date: string;
    notes?: string;
  }) => Promise<boolean>;
  onCreateSalaryAdvance?: (values: {
    employee_id: string;
    amount: number;
    payment_method_code: string;
    payment_date: string;
    period?: string;
    notes?: string;
  }) => Promise<boolean>;
  onDeletePayment: (id: string) => Promise<boolean>;
  // Product consumption
  onOpenProductConsumption: (emp: Employee) => void;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export type DetailSubTab = "horarios" | "cuenta-corriente" | "sueldos" | "legajo";

const statusLabels: Record<EmployeeAttendance["status"], { label: string; color: string }> = {
  present: {
    label: "Presente",
    color:
      "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
  },
  late: {
    label: "Tardanza",
    color:
      "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  },
  early_leave: {
    label: "Salida Temprana",
    color:
      "bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800",
  },
  justified: {
    label: "Justificado",
    color:
      "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
  },
  absent: {
    label: "Ausente",
    color:
      "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
  },
};

export const EmployeeDetailView = ({
  employee,
  allEmployees,
  tenantId,
  userId,
  canWrite,
  initialSubTab = "horarios",
  onBackToList,
  onSelectEmployee,
  onEditEmployee,
  onReloadAll,
  attendances,
  todayActiveShift,
  onPunchIn,
  onPunchOut,
  onCreateManualAttendance,
  onUpdateAttendance,
  onDeleteAttendance,
  payments,
  onCreateSalaryPayment,
  onCreateSalaryAdvance,
  onDeletePayment,
  onOpenProductConsumption,
}: EmployeeDetailViewProps) => {
  const [activeSubTab, setActiveSubTab] = useState<DetailSubTab>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) setActiveSubTab(initialSubTab);
  }, [initialSubTab]);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString("es-AR"));

  // Modales
  const [isLegajoModalOpen, setIsLegajoModalOpen] = useState(false);
  const [manualAttendanceOpen, setManualAttendanceOpen] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<EmployeeAttendance | null>(null);
  const [salaryPaymentModalOpen, setSalaryPaymentModalOpen] = useState(false);
  const [salaryAdvanceModalOpen, setSalaryAdvanceModalOpen] = useState(false);

  // Filtros internos de Horarios
  const [attendanceDateFilter, setAttendanceDateFilter] = useState("");

  // Reloj en vivo
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString("es-AR"));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Filtrar horarios solo para este empleado
  const employeeAttendances = useMemo(() => {
    return attendances
      .filter((a) => a.employee_id === employee.id)
      .filter((a) => (!attendanceDateFilter ? true : a.date === attendanceDateFilter))
      .sort((a, b) => b.date.localeCompare(a.date) || (b.check_in || "").localeCompare(a.check_in || ""));
  }, [attendances, employee.id, attendanceDateFilter]);

  // Horas acumuladas de este empleado
  const totalHours = useMemo(() => {
    return employeeAttendances.reduce((sum, a) => sum + (a.total_hours || 0), 0);
  }, [employeeAttendances]);

  // Filtrar pagos y adelantos solo para este empleado
  const employeePayments = useMemo(() => {
    return payments
      .filter((p) => p.employee_id === employee.id)
      .sort((a, b) => (b.payment_date || "").localeCompare(a.payment_date || ""));
  }, [payments, employee.id]);

  // Totales de sueldos
  const totalSalariesPaid = useMemo(() => {
    return employeePayments
      .filter((p) => !isAdvancePayment(p))
      .reduce((sum, p) => sum + (p.net_amount_paid || 0), 0);
  }, [employeePayments]);

  const totalAdvancesPaid = useMemo(() => {
    return employeePayments
      .filter((p) => isAdvancePayment(p))
      .reduce((sum, p) => sum + (p.net_amount_paid || 0), 0);
  }, [employeePayments]);

  const balance = employee.current_balance ?? 0;
  const hasDebt = balance > 0;
  const hasCredit = balance < 0;

  const handlePunchToggle = async () => {
    if (todayActiveShift) {
      await onPunchOut(todayActiveShift.id);
    } else {
      await onPunchIn(employee.id);
    }
  };

  return (
    <div className="employee-detail-view space-y-4 animate-in fade-in">
      {/* 1. BARRA SUPERIOR DE NAVEGACIÓN Y SELECTOR RÁPIDO */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-xs">
        <button
          type="button"
          onClick={onBackToList}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
        >
          <ArrowLeft size={15} />
          <span>Volver a Lista de Empleados</span>
        </button>

        {/* Selector para cambiar directamente de empleado */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Ver otro legajo:
          </span>
          <select
            value={employee.id}
            onChange={(e) => {
              const nextEmp = allEmployees.find((emp) => emp.id === e.target.value);
              if (nextEmp) onSelectEmployee(nextEmp);
            }}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {allEmployees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.full_name} ({emp.position || "Empleado"})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. HERO CARD: FICHA PRINCIPAL DEL EMPLEADO */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          {/* Avatar y Datos Personales Básicos */}
          <div className="flex items-start gap-4">
            <div className="relative">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white font-black text-xl flex items-center justify-center shadow-md">
                {employee.full_name.charAt(0).toUpperCase()}
              </div>
              <span
                className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white dark:border-slate-900 ${
                  employee.is_active ? "bg-emerald-500" : "bg-slate-400"
                }`}
                title={employee.is_active ? "Empleado Activo" : "Empleado Inactivo"}
              />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">
                  {employee.full_name}
                </h1>
                <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-lg">
                  {employee.code}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    employee.is_active
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {employee.is_active ? "Activo" : "Inactivo"}
                </span>
              </div>

              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                {employee.position || "Puesto sin especificar"}
              </p>

              {/* Meta Info Chits */}
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-600 dark:text-slate-300">
                {employee.document_number && (
                  <span className="flex items-center gap-1 font-mono">
                    <IdCard size={13} className="text-slate-400" />
                    <span>
                      {employee.document_type}: {employee.document_number}
                    </span>
                  </span>
                )}
                {employee.phone && (
                  <span className="flex items-center gap-1">
                    <Phone size={13} className="text-slate-400" />
                    <span>{employee.phone}</span>
                  </span>
                )}
                {employee.email && (
                  <span className="flex items-center gap-1">
                    <Mail size={13} className="text-slate-400" />
                    <span>{employee.email}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Botones de Acción Rápida para este Empleado */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {canWrite && employee.is_active && (
              <button
                type="button"
                onClick={handlePunchToggle}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer text-white ${
                  todayActiveShift
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {todayActiveShift ? (
                  <>
                    <LogOut size={14} />
                    <span>Fichar Egreso ({currentTime.slice(0, 5)})</span>
                  </>
                ) : (
                  <>
                    <LogIn size={14} />
                    <span>Fichar Ingreso ({currentTime.slice(0, 5)})</span>
                  </>
                )}
              </button>
            )}

            {canWrite && employee.is_active && (
              <button
                type="button"
                onClick={() => onOpenProductConsumption(employee)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 shadow-xs transition cursor-pointer"
              >
                <ShoppingBag size={14} />
                <span>Retirar Mercadería</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsLegajoModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-blue-200 dark:border-blue-800/80 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 shadow-xs transition cursor-pointer"
              title="Consultar datos personales y legajo contractual del empleado"
            >
              <User size={14} />
              <span>Ver Legajo</span>
            </button>
          </div>
        </div>

        {/* Franja de 4 KPIs del Empleado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* KPI 1: Turno de Hoy */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-3 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Clock size={12} className="text-blue-500" /> Turno Hoy
            </span>
            {todayActiveShift ? (
              <div>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  En turno ({todayActiveShift.check_in})
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Jornada abierta</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                  ⚪ Fuera de turno
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Sin ingreso activo</p>
              </div>
            )}
          </div>

          {/* KPI 2: Saldo Cuenta Corriente */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-3 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <CreditCard size={12} className="text-purple-500" /> Cta. Corriente
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={`text-base font-black font-mono ${
                  hasDebt
                    ? "text-rose-600 dark:text-rose-400"
                    : hasCredit
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {currency.format(balance)}
              </span>
              {hasDebt && (
                <span className="text-[9px] font-bold uppercase bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 px-1.5 py-0.2 rounded">
                  Deuda
                </span>
              )}
            </div>
            {employee.current_account_limit ? (
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Límite: {currency.format(employee.current_account_limit)}
              </p>
            ) : (
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Sin límite pactado</p>
            )}
          </div>

          {/* KPI 3: Sueldo Base */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-3 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Receipt size={12} className="text-emerald-500" /> Sueldo Base
            </span>
            <p className="text-base font-black font-mono text-slate-900 dark:text-slate-100">
              {currency.format(employee.base_salary || 0)}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {employee.hourly_rate ? `Valor hora: ${currency.format(employee.hourly_rate)}` : "Remuneración base mensual"}
            </p>
          </div>

          {/* KPI 4: Horas Computadas */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-3 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Clock size={12} className="text-indigo-500" /> Horas Registradas
            </span>
            <p className="text-base font-black font-mono text-slate-900 dark:text-slate-100">
              {totalHours.toFixed(1)} hs
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {employeeAttendances.length} fichadas registradas
            </p>
          </div>
        </div>
      </div>

      {/* 3. SUB-PESTAÑAS DE SEGUIMIENTO DEL EMPLEADO */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab("horarios")}
          className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
            activeSubTab === "horarios"
              ? "bg-slate-900 text-white shadow dark:bg-slate-100 dark:text-slate-900"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          }`}
        >
          <Clock size={14} />
          <span>Horarios & Asistencia</span>
          <span className="rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] px-1.5 py-0.2">
            {employeeAttendances.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("cuenta-corriente")}
          className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
            activeSubTab === "cuenta-corriente"
              ? "bg-slate-900 text-white shadow dark:bg-slate-100 dark:text-slate-900"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          }`}
        >
          <CreditCard size={14} />
          <span>Cuenta Corriente</span>
          <span
            className={`rounded-full text-[10px] px-1.5 py-0.2 font-mono font-bold ${
              hasDebt
                ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
            }`}
          >
            {currency.format(balance)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("sueldos")}
          className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
            activeSubTab === "sueldos"
              ? "bg-slate-900 text-white shadow dark:bg-slate-100 dark:text-slate-900"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          }`}
        >
          <Receipt size={14} />
          <span>Sueldos & Adelantos</span>
          <span className="rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] px-1.5 py-0.2">
            {employeePayments.length}
          </span>
        </button>
      </div>

      {/* 4. CONTENIDO DE LA SUB-PESTAÑA SELECCIONADA */}

      {/* SUB-PESTAÑA 1: HORARIOS Y ASISTENCIA */}
      {activeSubTab === "horarios" && (
        <div className="space-y-4">
          {/* Barra de Filtro de Fechas y Botón Cargar Horario */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-xs">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/90 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100">
                <Calendar size={13} className="text-slate-500 dark:text-slate-300" />
                <input
                  type="date"
                  value={attendanceDateFilter}
                  onChange={(e) => setAttendanceDateFilter(e.target.value)}
                  className="bg-transparent text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none"
                />
                {attendanceDateFilter && (
                  <button
                    type="button"
                    onClick={() => setAttendanceDateFilter("")}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[10px] ml-1 font-bold cursor-pointer"
                    title="Limpiar filtro de fecha"
                  >
                    ✕
                  </button>
                )}
              </div>

              <span className="text-xs text-slate-500 dark:text-slate-400">
                {employeeAttendances.length} registros • {totalHours.toFixed(1)} horas acumuladas
              </span>
            </div>

            {canWrite && (
              <button
                type="button"
                onClick={() => {
                  setEditingAttendance(null);
                  setManualAttendanceOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <PlusCircle size={14} />
                <span>Cargar Horario Manual</span>
              </button>
            )}
          </div>

          {/* Tabla de Horarios de este Empleado */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  <tr>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Ingreso</th>
                    <th className="py-3 px-4">Egreso</th>
                    <th className="py-3 px-4">Total Horas</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4">Observaciones</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                  {employeeAttendances.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-10 text-center text-slate-600 dark:text-slate-300 font-medium"
                      >
                        No se registraron fichadas para este empleado con los filtros actuales.
                      </td>
                    </tr>
                  ) : (
                    employeeAttendances.map((att) => {
                      const statusInfo = statusLabels[att.status] || {
                        label: att.status,
                        color: "bg-slate-100 text-slate-700",
                      };

                      return (
                        <tr
                          key={att.id}
                          className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                        >
                          <td className="py-3 px-4 font-mono font-semibold">{att.date}</td>
                          <td className="py-3 px-4 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                            {att.check_in}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                            {att.check_out ? (
                              att.check_out
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 animate-pulse font-medium">
                                <Clock size={11} /> En curso...
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono">
                            {att.total_hours != null ? (
                              <span className="font-bold text-slate-900 dark:text-slate-100">
                                {att.total_hours} hs
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusInfo.color}`}
                            >
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate font-medium">
                            {att.notes || "-"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {canWrite && !att.check_out && (
                                <button
                                  type="button"
                                  onClick={() => onPunchOut(att.id)}
                                  className="rounded-lg bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800 hover:bg-amber-100 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-200 cursor-pointer"
                                  title="Cerrar turno"
                                >
                                  Egreso
                                </button>
                              )}
                              {canWrite && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingAttendance(att);
                                    setManualAttendanceOpen(true);
                                  }}
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
                                  title="Editar registro"
                                >
                                  <Edit2 size={13} />
                                </button>
                              )}
                              {canWrite && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const confirmed = window.confirm(
                                      `¿Eliminar el registro de horario del día ${att.date}?`
                                    );
                                    if (confirmed) await onDeleteAttendance(att.id);
                                  }}
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-300 cursor-pointer"
                                  title="Eliminar registro"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-PESTAÑA 2: CUENTA CORRIENTE */}
      {activeSubTab === "cuenta-corriente" && (
        <EmployeeCurrentAccountPanel
          tenantId={tenantId}
          userId={userId}
          employee={employee}
          canWrite={canWrite}
          hideBackButton={true}
          onBalanceUpdated={onReloadAll}
          onOpenSalaryDisbursement={() => setActiveSubTab("sueldos")}
        />
      )}

      {/* SUB-PESTAÑA 3: SUELDOS Y PAGOS */}
      {activeSubTab === "sueldos" && (
        <div className="space-y-4">
          {/* Header con resumen y acciones */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-xs">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Receipt size={16} className="text-emerald-600" />
                <span>Liquidaciones y Vales / Anticipos de Sueldo</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Historial de cobros y retenciones de cuenta corriente de {employee.full_name}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {canWrite && onCreateSalaryAdvance && (
                <button
                  type="button"
                  onClick={() => setSalaryAdvanceModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-3.5 py-1.5 text-xs font-bold text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 shadow-xs transition cursor-pointer"
                >
                  <Coins size={14} />
                  <span>Nuevo Vale / Adelanto</span>
                </button>
              )}

              {canWrite && (
                <button
                  type="button"
                  onClick={() => setSalaryPaymentModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  <Receipt size={14} />
                  <span>Liquidar Sueldo</span>
                </button>
              )}
            </div>
          </div>

          {/* Tarjetas resumen de cobros */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-3 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Sueldos Liquidados
              </span>
              <p className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
                {currency.format(totalSalariesPaid)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-3 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Vales / Adelantos
              </span>
              <p className="text-base font-black font-mono text-amber-600 dark:text-amber-400">
                {currency.format(totalAdvancesPaid)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-3 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Sueldo Base Acordado
              </span>
              <p className="text-base font-black font-mono text-slate-900 dark:text-slate-100">
                {currency.format(employee.base_salary || 0)}
              </p>
            </div>
          </div>

          {/* Tabla de pagos */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  <tr>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Período</th>
                    <th className="py-3 px-4">Monto Bruto</th>
                    <th className="py-3 px-4">Desc. Cta Cte</th>
                    <th className="py-3 px-4">Neto Pagado</th>
                    <th className="py-3 px-4">Medio de Pago</th>
                    <th className="py-3 px-4">Observaciones</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                  {employeePayments.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="py-10 text-center text-slate-600 dark:text-slate-300 font-medium"
                      >
                        No se registraron liquidaciones ni adelantos para este empleado.
                      </td>
                    </tr>
                  ) : (
                    employeePayments.map((p) => {
                      const isAdvance = isAdvancePayment(p);
                      return (
                        <tr
                          key={p.id}
                          className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                        >
                          <td className="py-3 px-4 font-mono font-medium">{p.payment_date}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                isAdvance
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                              }`}
                            >
                              {isAdvance ? "Adelanto / Vale" : "Liquidación Sueldo"}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium">{p.period || "-"}</td>
                          <td className="py-3 px-4 font-mono">
                            {currency.format(p.gross_amount || p.net_amount_paid)}
                          </td>
                          <td className="py-3 px-4 font-mono text-rose-600 dark:text-rose-400">
                            {p.current_account_discount_applied
                              ? `-${currency.format(p.current_account_discount_applied)}`
                              : "-"}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                            {currency.format(p.net_amount_paid)}
                          </td>
                          <td className="py-3 px-4 uppercase text-[10px] font-semibold text-slate-500">
                            {p.payment_method_code}
                          </td>
                          <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                            {p.notes || "-"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {canWrite && (
                              <button
                                type="button"
                                onClick={async () => {
                                  const confirmed = window.confirm(
                                    `¿Eliminar este registro de pago de ${currency.format(
                                      p.net_amount_paid
                                    )}?`
                                  );
                                  if (confirmed) await onDeletePayment(p.id);
                                }}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 cursor-pointer"
                                title="Eliminar registro"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EMERGENTE: FICHA DE LEGAJO */}
      {isLegajoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-in zoom-in-95">
            {/* Header del Modal */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-300">
                  <User size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Ficha de Legajo
                    </h3>
                    <span className="font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {employee.code}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {employee.full_name} • {employee.position || "Empleado"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsLegajoModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Contenido: Cards de Datos Personales y Condiciones Laborales */}
            <div className="p-5 max-h-[80vh] overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Card 1: Datos Personales */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-4 space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-700/80 pb-2">
                    <User size={13} className="text-blue-500" /> Datos Personales
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-800/50">
                      <span className="text-slate-500 dark:text-slate-400">Nombre Completo:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{employee.full_name}</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-800/50">
                      <span className="text-slate-500 dark:text-slate-400">Tipo y Documento:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {employee.document_type} {employee.document_number}
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-800/50">
                      <span className="text-slate-500 dark:text-slate-400">Teléfono:</span>
                      <span className="text-slate-900 dark:text-slate-100 font-medium">
                        {employee.phone || "No especificado"}
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-800/50">
                      <span className="text-slate-500 dark:text-slate-400">Correo Electrónico:</span>
                      <span className="text-slate-900 dark:text-slate-100 font-medium">
                        {employee.email || "No especificado"}
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-500 dark:text-slate-400">Dirección:</span>
                      <span className="text-slate-900 dark:text-slate-100 font-medium">
                        {employee.address || "No especificada"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 2: Condiciones Laborales y Salario */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-4 space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-700/80 pb-2">
                    <Briefcase size={13} className="text-indigo-500" /> Condiciones & Salario
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-800/50">
                      <span className="text-slate-500 dark:text-slate-400">Puesto / Cargo:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {employee.position || "Empleado"}
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-800/50">
                      <span className="text-slate-500 dark:text-slate-400">Código de Legajo:</span>
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {employee.code}
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-800/50">
                      <span className="text-slate-500 dark:text-slate-400">Fecha de Ingreso:</span>
                      <span className="font-mono text-slate-900 dark:text-slate-100">
                        {employee.hire_date || "No registrada"}
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-800/50">
                      <span className="text-slate-500 dark:text-slate-400">Sueldo Base:</span>
                      <span className="font-mono font-black text-slate-900 dark:text-slate-100">
                        {currency.format(employee.base_salary || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-800/50">
                      <span className="text-slate-500 dark:text-slate-400">Desc. Mercadería:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {employee.discount_percent ?? 10}%
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-500 dark:text-slate-400">Límite Cta. Cte.:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {employee.current_account_limit
                          ? currency.format(employee.current_account_limit)
                          : "Sin límite"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer con botón Modificar */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 px-5 py-3.5 bg-slate-50/50 dark:bg-slate-900/50">
              <button
                type="button"
                onClick={() => setIsLegajoModalOpen(false)}
                className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Cerrar
              </button>
              {canWrite && (
                <button
                  type="button"
                  onClick={() => {
                    setIsLegajoModalOpen(false);
                    onEditEmployee(employee);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer"
                >
                  <Edit2 size={13} />
                  <span>Modificar Datos del Legajo</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL HORARIO MANUAL */}
      {manualAttendanceOpen && (
        <AttendanceManualModal
          open={manualAttendanceOpen}
          employees={allEmployees}
          attendance={editingAttendance}
          onClose={() => {
            setManualAttendanceOpen(false);
            setEditingAttendance(null);
          }}
          onSubmit={async (values) => {
            if (editingAttendance) {
              await onUpdateAttendance(editingAttendance.id, values);
            } else {
              await onCreateManualAttendance(values);
            }
            setManualAttendanceOpen(false);
            setEditingAttendance(null);
          }}
        />
      )}

      {/* MODAL LIQUIDAR SUELDO */}
      {salaryPaymentModalOpen && (
        <SalaryPaymentModal
          open={salaryPaymentModalOpen}
          employees={allEmployees}
          initialEmployee={employee}
          payments={payments}
          onClose={() => setSalaryPaymentModalOpen(false)}
          onSubmit={async (values) => {
            const ok = await onCreateSalaryPayment(values);
            if (ok) {
              setSalaryPaymentModalOpen(false);
              await onReloadAll();
            }
            return ok;
          }}
        />
      )}

      {/* MODAL ADELANTO / VALE */}
      {salaryAdvanceModalOpen && onCreateSalaryAdvance && (
        <SalaryAdvanceModal
          open={salaryAdvanceModalOpen}
          employees={allEmployees}
          initialEmployee={employee}
          onClose={() => setSalaryAdvanceModalOpen(false)}
          onSubmit={async (values) => {
            const ok = await onCreateSalaryAdvance(values);
            if (ok) {
              setSalaryAdvanceModalOpen(false);
              await onReloadAll();
            }
            return ok;
          }}
        />
      )}
    </div>
  );
};
