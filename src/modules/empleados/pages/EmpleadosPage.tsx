import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import {
  Users,
  Clock,
  CreditCard,
  Receipt,
  PlusCircle,
  RefreshCw,
  Search,
} from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import type { Employee } from "@/types/entities";
import { useEmployeesCrud } from "@/modules/empleados/hooks/useEmployeesCrud";
import { useEmployeeAttendance } from "@/modules/empleados/hooks/useEmployeeAttendance";
import { useEmployeeSalaryPayments } from "@/modules/empleados/hooks/useEmployeeSalaryPayments";
import { EmployeeFormModal } from "@/modules/empleados/components/EmployeeFormModal";
import { EmployeesTable } from "@/modules/empleados/components/EmployeesTable";
import { AttendanceSection } from "@/modules/empleados/components/AttendanceSection";
import { EmployeeCurrentAccountsSection } from "@/modules/empleados/components/EmployeeCurrentAccountsSection";
import { SalaryPaymentsSection } from "@/modules/empleados/components/SalaryPaymentsSection";

type ActiveTab = "personal" | "horarios" | "cuentas-corrientes" | "sueldos";

export const EmpleadosPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);
  const { canRead, canWrite } = usePermissions();

  const canReadEmpleados = canRead("empleados");
  const canWriteEmpleados = canWrite("empleados");

  // Pestaña activa desde URL o por defecto 'personal'
  const initialTab = (searchParams.get("tab") as ActiveTab) || "personal";
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    ["personal", "horarios", "cuentas-corrientes", "sueldos"].includes(initialTab)
      ? initialTab
      : "personal"
  );

  // Hook 1: CRUD Empleados
  const {
    employees,
    filteredEmployees,
    search,
    setSearch,
    isLoading: isLoadingEmployees,
    isSubmitting: isSubmittingEmployees,
    feedback: employeesFeedback,
    clearFeedback: clearEmployeesFeedback,
    reload: reloadEmployees,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    toggleEmployeeActive,
  } = useEmployeesCrud(tenantId, user?.id ?? null);

  // Hook 2: Asistencia y Horarios
  const {
    attendances,
    filteredAttendances,
    todayActiveByEmployee,
    selectedEmployeeId: attendanceEmpFilter,
    setSelectedEmployeeId: setAttendanceEmpFilter,
    filterDate: attendanceDateFilter,
    setFilterDate: setAttendanceDateFilter,
    filterStatus: attendanceStatusFilter,
    setFilterStatus: setAttendanceStatusFilter,
    isLoading: isLoadingAttendance,
    punchCheckIn,
    punchCheckOut,
    createManualAttendance,
    updateAttendance,
    deleteAttendance,
    reload: reloadAttendance,
  } = useEmployeeAttendance(tenantId, user?.id ?? null);

  // Hook 3: Pagos de Sueldos y Saldos Pagados
  const {
    payments,
    filteredPayments,
    totalPaid,
    totalCurrentAccountDiscounts,
    selectedEmployeeId: salaryEmpFilter,
    setSelectedEmployeeId: setSalaryEmpFilter,
    selectedPeriod: salaryPeriodFilter,
    setSelectedPeriod: setSalaryPeriodFilter,
    isLoading: isLoadingSalary,
    createSalaryPayment,
    deletePayment,
    reload: reloadSalary,
  } = useEmployeeSalaryPayments(tenantId, user?.id ?? null);

  // Estados locales para Modales y Navegación
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedEmployeeForEdit, setSelectedEmployeeForEdit] = useState<Employee | undefined>(
    undefined
  );

  // Empleado seleccionado para Cuenta Corriente
  const initialEmpId = searchParams.get("empleadoId");
  const [currentAccountEmployee, setCurrentAccountEmployee] = useState<Employee | null>(null);

  // Empleado seleccionado para Liquidación de Sueldo directa
  const [disbursementEmployee, setDisbursementEmployee] = useState<Employee | null>(null);

  // Sincronizar parámetro inicial de empleadoId
  useEffect(() => {
    if (initialEmpId && employees.length > 0) {
      const match = employees.find((e) => e.id === initialEmpId);
      if (match) {
        setCurrentAccountEmployee(match);
        setActiveTab("cuentas-corrientes");
      }
    }
  }, [initialEmpId, employees]);

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      if (tab !== "cuentas-corrientes") {
        next.delete("empleadoId");
      }
      return next;
    });
  };

  const handleOpenCurrentAccount = (employee: Employee) => {
    setCurrentAccountEmployee(employee);
    setActiveTab("cuentas-corrientes");
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", "cuentas-corrientes");
      next.set("empleadoId", employee.id);
      return next;
    });
  };

  const handleOpenSalaryDisbursementFromAccount = (employee: Employee) => {
    setDisbursementEmployee(employee);
    setActiveTab("sueldos");
  };

  const handleReloadAll = async () => {
    await Promise.all([reloadEmployees(), reloadAttendance(), reloadSalary()]);
  };

  if (!tenantId) {
    return (
      <PagePlaceholder
        title="Agenda - Empleados"
        description="No hay un comercio activo seleccionado"
      />
    );
  }

  if (!canReadEmpleados) {
    return (
      <PagePlaceholder
        title="Agenda - Empleados"
        description="No tenés permisos de lectura para este módulo"
      />
    );
  }

  return (
    <PagePlaceholder
      title="Agenda • Empleados"
      description="Legajos de personal, control de horarios de ingreso y egreso, cuentas corrientes y liquidación de sueldos"
    >
      <div className="empleados-module space-y-4 w-full min-w-0 max-w-full">
        {/* Barra superior de pestañas del submódulo */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2 dark:border-slate-800">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => handleTabChange("personal")}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                activeTab === "personal"
                  ? "bg-slate-900 text-white shadow dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              <Users size={14} />
              <span>Personal ({employees.length})</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("horarios")}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                activeTab === "horarios"
                  ? "bg-slate-900 text-white shadow dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              <Clock size={14} />
              <span>Horarios & Asistencia</span>
              {todayActiveByEmployee.size > 0 && (
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("cuentas-corrientes")}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                activeTab === "cuentas-corrientes"
                  ? "bg-slate-900 text-white shadow dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              <CreditCard size={14} />
              <span>Cuentas Corrientes</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("sueldos")}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                activeTab === "sueldos"
                  ? "bg-slate-900 text-white shadow dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              <Receipt size={14} />
              <span>Saldos Pagados / Sueldos</span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <IconButton
              icon={RefreshCw}
              label="Recargar módulo"
              onClick={() => void handleReloadAll()}
              loading={isLoadingEmployees || isLoadingAttendance || isLoadingSalary}
            />

            {canWriteEmpleados && activeTab === "personal" && (
              <button
                type="button"
                onClick={() => {
                  clearEmployeesFeedback();
                  setFormMode("create");
                  setSelectedEmployeeForEdit(undefined);
                  setFormModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                <PlusCircle size={14} />
                <span>Nuevo Empleado</span>
              </button>
            )}
          </div>
        </div>

        {employeesFeedback && (
          <div
            className={
              employeesFeedback.type === "success" ? "ui-success-state" : "ui-error-state"
            }
          >
            {employeesFeedback.message}
          </div>
        )}

        {/* CONTENIDO SEGÚN LA PESTAÑA ACTIVA */}

        {/* 1. PERSONAL */}
        {activeTab === "personal" && (
          <div className="space-y-4">
            {/* Buscador de Personal */}
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar empleado por nombre, DNI, legajo o puesto..."
                  className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <p className="text-xs text-slate-500">
                Mostrando {filteredEmployees.length} de {employees.length} empleados
              </p>
            </div>

            {/* Tabla de Empleados */}
            <EmployeesTable
              employees={filteredEmployees}
              todayActiveByEmployee={todayActiveByEmployee}
              canWrite={canWriteEmpleados}
              onOpenCurrentAccount={handleOpenCurrentAccount}
              onEdit={(emp) => {
                clearEmployeesFeedback();
                setFormMode("edit");
                setSelectedEmployeeForEdit(emp);
                setFormModalOpen(true);
              }}
              onDelete={async (emp) => {
                const confirmed = window.confirm(
                  `¿Estás seguro de eliminar al empleado ${emp.full_name}?`
                );
                if (!confirmed) return;
                await deleteEmployee(emp.id);
              }}
              onToggleActive={(emp) => void toggleEmployeeActive(emp.id)}
              onPunchIn={(emp) => void punchCheckIn(emp.id)}
              onPunchOut={(attendanceId) => void punchCheckOut(attendanceId)}
            />
          </div>
        )}

        {/* 2. HORARIOS Y ASISTENCIA */}
        {activeTab === "horarios" && (
          <AttendanceSection
            employees={employees}
            attendances={attendances}
            filteredAttendances={filteredAttendances}
            todayActiveByEmployee={todayActiveByEmployee}
            selectedEmployeeId={attendanceEmpFilter}
            onSelectEmployeeId={setAttendanceEmpFilter}
            filterDate={attendanceDateFilter}
            onFilterDateChange={setAttendanceDateFilter}
            filterStatus={attendanceStatusFilter}
            onFilterStatusChange={setAttendanceStatusFilter}
            canWrite={canWriteEmpleados}
            onPunchIn={punchCheckIn}
            onPunchOut={punchCheckOut}
            onCreateManual={createManualAttendance}
            onUpdateAttendance={updateAttendance}
            onDeleteAttendance={deleteAttendance}
          />
        )}

        {/* 3. CUENTAS CORRIENTES */}
        {activeTab === "cuentas-corrientes" && (
          <EmployeeCurrentAccountsSection
            tenantId={tenantId}
            userId={user?.id ?? null}
            employees={employees}
            canWrite={canWriteEmpleados}
            selectedEmployee={currentAccountEmployee}
            onSelectEmployee={(emp) => {
              setCurrentAccountEmployee(emp);
              if (!emp) {
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.delete("empleadoId");
                  return next;
                });
              }
            }}
            onBalanceUpdated={reloadEmployees}
            onOpenSalaryDisbursement={handleOpenSalaryDisbursementFromAccount}
          />
        )}

        {/* 4. SALDOS PAGADOS / SUELDOS */}
        {activeTab === "sueldos" && (
          <SalaryPaymentsSection
            employees={employees}
            payments={payments}
            filteredPayments={filteredPayments}
            totalPaid={totalPaid}
            totalCurrentAccountDiscounts={totalCurrentAccountDiscounts}
            selectedEmployeeId={salaryEmpFilter}
            onSelectEmployeeId={setSalaryEmpFilter}
            selectedPeriod={salaryPeriodFilter}
            onSelectPeriod={setSalaryPeriodFilter}
            canWrite={canWriteEmpleados}
            initialEmployeeForDisbursement={disbursementEmployee}
            onDisbursementModalClosed={() => setDisbursementEmployee(null)}
            onCreateSalaryPayment={createSalaryPayment}
            onDeletePayment={deletePayment}
            onBalanceUpdated={reloadEmployees}
          />
        )}

        {/* Modal de Alta / Edición de Empleado */}
        {formModalOpen && (
          <EmployeeFormModal
            open={formModalOpen}
            mode={formMode}
            employee={selectedEmployeeForEdit}
            isSubmitting={isSubmittingEmployees}
            onClose={() => {
              setFormModalOpen(false);
              setSelectedEmployeeForEdit(undefined);
            }}
            onSubmit={async (values) => {
              if (formMode === "create") {
                await createEmployee(values);
              } else if (selectedEmployeeForEdit) {
                await updateEmployee(selectedEmployeeForEdit.id, values);
              }
              setFormModalOpen(false);
              setSelectedEmployeeForEdit(undefined);
            }}
          />
        )}
      </div>
    </PagePlaceholder>
  );
};
