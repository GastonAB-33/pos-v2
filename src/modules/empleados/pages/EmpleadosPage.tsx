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
  Globe,
} from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import type { Employee } from "@/types/entities";
import { useEmployeesCrud } from "@/modules/empleados/hooks/useEmployeesCrud";
import { useEmployeeAttendance } from "@/modules/empleados/hooks/useEmployeeAttendance";
import { useEmployeeSalaryPayments, isAdvancePayment } from "@/modules/empleados/hooks/useEmployeeSalaryPayments";
import { useMemo } from "react";
import { EmployeeFormModal } from "@/modules/empleados/components/EmployeeFormModal";
import { EmployeesTable } from "@/modules/empleados/components/EmployeesTable";
import { AttendanceSection } from "@/modules/empleados/components/AttendanceSection";
import { EmployeeCurrentAccountsSection } from "@/modules/empleados/components/EmployeeCurrentAccountsSection";
import { SalaryPaymentsSection } from "@/modules/empleados/components/SalaryPaymentsSection";
import { EmployeeProductConsumptionModal } from "@/modules/empleados/components/EmployeeProductConsumptionModal";
import { EmployeeDetailView } from "@/modules/empleados/components/EmployeeDetailView";
import { employeeCurrentAccountsService } from "@/services/employee-current-accounts.service";
import { usersService } from "@/services/users.service";

type ActiveTab = "personal" | "globales";
type GlobalSubTab = "horarios" | "cuentas-corrientes" | "sueldos";

export const EmpleadosPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);
  const { canRead, canWrite } = usePermissions();

  const canReadEmpleados = canRead("empleados");
  const canWriteEmpleados = canWrite("empleados");

  // Pestaña activa desde URL o por defecto 'personal'
  const rawTab = searchParams.get("tab");
  const isGlobalParam =
    rawTab === "globales" ||
    rawTab === "horarios" ||
    rawTab === "cuentas-corrientes" ||
    rawTab === "sueldos";

  const [activeTab, setActiveTab] = useState<ActiveTab>(
    isGlobalParam ? "globales" : "personal"
  );
  const [globalSubTab, setGlobalSubTab] = useState<GlobalSubTab>(
    rawTab === "cuentas-corrientes" || rawTab === "sueldos" ? rawTab : "horarios"
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
    totalSalariesPaid,
    totalAdvancesPaid,
    totalCurrentAccountDiscounts,
    selectedEmployeeId: salaryEmpFilter,
    setSelectedEmployeeId: setSalaryEmpFilter,
    selectedPeriod: salaryPeriodFilter,
    setSelectedPeriod: setSalaryPeriodFilter,
    selectedType: salaryTypeFilter,
    setSelectedType: setSalaryTypeFilter,
    datePreset: salaryDatePreset,
    setDatePreset: setSalaryDatePreset,
    customStartDate: salaryCustomStartDate,
    setCustomStartDate: setSalaryCustomStartDate,
    customEndDate: salaryCustomEndDate,
    setCustomEndDate: setSalaryCustomEndDate,
    isLoading: isLoadingSalary,
    createSalaryPayment,
    createSalaryAdvance,
    deletePayment,
    reload: reloadSalary,
  } = useEmployeeSalaryPayments(tenantId, user?.id ?? null);

  const [usersById, setUsersById] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!tenantId) return;
    usersService
      .getAllByTenant(tenantId)
      .then((allUsers) => {
        const map: Record<string, string> = {};
        for (const u of allUsers) {
          const displayName = u.full_name || u.username || u.email || "Usuario";
          map[u.id] = displayName;
          if (u.auth_user_id) {
            map[u.auth_user_id] = displayName;
          }
        }
        if (user?.id) {
          map[user.id] = user.fullName || user.username || user.email || "Usuario actual";
        }
        setUsersById(map);
      })
      .catch((err) => {
        console.error("Error loading users for EmpleadosPage:", err);
      });
  }, [tenantId, user]);

  // Adelantos pendientes por empleado (otorgados - deducidos en liquidaciones)
  const pendingAdvancesByEmployee = useMemo(() => {
    const advancesMap = new Map<string, number>();
    const deductionsMap = new Map<string, number>();

    for (const p of payments) {
      if (!p.employee_id) continue;
      if (isAdvancePayment(p)) {
        const amt = p.net_amount_paid || p.gross_amount || 0;
        advancesMap.set(p.employee_id, (advancesMap.get(p.employee_id) || 0) + amt);
      } else {
        const ded = p.advances_discount_applied || 0;
        deductionsMap.set(p.employee_id, (deductionsMap.get(p.employee_id) || 0) + ded);
      }
    }

    const resultMap = new Map<string, number>();
    for (const [empId, totalAdv] of advancesMap.entries()) {
      const totalDed = deductionsMap.get(empId) || 0;
      const pending = Math.max(0, totalAdv - totalDed);
      if (pending > 0) {
        resultMap.set(empId, pending);
      }
    }

    return resultMap;
  }, [payments]);

  // Estados locales para Modales y Navegación
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedEmployeeForEdit, setSelectedEmployeeForEdit] = useState<Employee | undefined>(
    undefined
  );

  // Empleado seleccionado para Ver Ficha / Legajo Individual
  const [selectedEmployeeForDetail, setSelectedEmployeeForDetail] = useState<Employee | null>(null);
  const [detailSubTab, setDetailSubTab] = useState<
    "horarios" | "cuenta-corriente" | "sueldos"
  >("horarios");

  // Empleado seleccionado para Cuenta Corriente global
  const initialEmpId = searchParams.get("empleadoId");
  const [currentAccountEmployee, setCurrentAccountEmployee] = useState<Employee | null>(null);

  // Empleado seleccionado para Liquidación de Sueldo directa
  const [disbursementEmployee, setDisbursementEmployee] = useState<Employee | null>(null);

  // Empleado seleccionado para Carga Directa de Productos
  const [productConsumptionEmployee, setProductConsumptionEmployee] = useState<Employee | null>(null);

  const handleProductSubmitFromPage = async (values: {
    amount: number;
    notes: string;
    category: "product_purchase";
  }) => {
    if (!productConsumptionEmployee || !tenantId) return false;
    try {
      await employeeCurrentAccountsService.createMovement(tenantId, {
        employee_id: productConsumptionEmployee.id,
        type: "debt",
        amount: values.amount,
        category: values.category,
        notes: values.notes,
        created_by: user?.id ?? null,
      });
      await reloadEmployees();
      setProductConsumptionEmployee(null);
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const handleSelectEmployeeForDetail = (
    employee: Employee,
    subTab: "horarios" | "cuenta-corriente" | "sueldos" = "horarios"
  ) => {
    setSelectedEmployeeForDetail(employee);
    setDetailSubTab(subTab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("empleadoId", employee.id);
      next.set("view", "legajo");
      return next;
    });
  };

  const handleBackToList = () => {
    setSelectedEmployeeForDetail(null);
    setCurrentAccountEmployee(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("empleadoId");
      next.delete("view");
      return next;
    });
  };

  // Sincronizar parámetro inicial de empleadoId
  useEffect(() => {
    if (initialEmpId && employees.length > 0) {
      const match = employees.find((e) => e.id === initialEmpId);
      if (match) {
        const view = searchParams.get("view");
        if (view === "legajo" || rawTab === "personal") {
          setSelectedEmployeeForDetail(match);
        } else if (rawTab === "cuentas-corrientes") {
          setCurrentAccountEmployee(match);
          setActiveTab("globales");
          setGlobalSubTab("cuentas-corrientes");
        }
      }
    }
  }, [initialEmpId, employees, rawTab, searchParams]);

  useEffect(() => {
    if (selectedEmployeeForDetail && employees.length > 0) {
      const fresh = employees.find((e) => e.id === selectedEmployeeForDetail.id);
      if (fresh) setSelectedEmployeeForDetail(fresh);
    }
  }, [employees]);

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === "globales") {
        next.set("tab", globalSubTab);
      } else {
        next.set("tab", "personal");
        next.delete("empleadoId");
      }
      return next;
    });
  };

  const handleGlobalSubTabChange = (subTab: GlobalSubTab) => {
    setGlobalSubTab(subTab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", subTab);
      if (subTab !== "cuentas-corrientes") {
        next.delete("empleadoId");
      }
      return next;
    });
  };

  const handleOpenCurrentAccount = (employee: Employee) => {
    handleSelectEmployeeForDetail(employee, "cuenta-corriente");
  };

  const handleOpenSalaryDisbursementFromAccount = (employee: Employee) => {
    setDisbursementEmployee(employee);
    setActiveTab("globales");
    setGlobalSubTab("sueldos");
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
        {selectedEmployeeForDetail ? (
          <EmployeeDetailView
            employee={selectedEmployeeForDetail}
            allEmployees={employees}
            tenantId={tenantId}
            userId={user?.id ?? null}
            canWrite={canWriteEmpleados}
            initialSubTab={detailSubTab}
            onBackToList={handleBackToList}
            onSelectEmployee={(emp) => handleSelectEmployeeForDetail(emp, detailSubTab)}
            onEditEmployee={(emp) => {
              clearEmployeesFeedback();
              setFormMode("edit");
              setSelectedEmployeeForEdit(emp);
              setFormModalOpen(true);
            }}
            onReloadAll={handleReloadAll}
            attendances={attendances}
            todayActiveShift={todayActiveByEmployee.get(selectedEmployeeForDetail.id)}
            onPunchIn={(empId) => punchCheckIn(empId)}
            onPunchOut={(attendanceId) => punchCheckOut(attendanceId)}
            onCreateManualAttendance={createManualAttendance}
            onUpdateAttendance={updateAttendance}
            onDeleteAttendance={deleteAttendance}
            payments={payments}
            onCreateSalaryPayment={createSalaryPayment}
            onCreateSalaryAdvance={createSalaryAdvance}
            onDeletePayment={deletePayment}
            onOpenProductConsumption={setProductConsumptionEmployee}
            usersById={usersById}
          />
        ) : (
          <>
            {/* Barra superior de pestañas del submódulo */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2 dark:border-slate-800">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => handleTabChange("personal")}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
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
                  onClick={() => handleTabChange("globales")}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                    activeTab === "globales"
                      ? "bg-slate-900 text-white shadow dark:bg-slate-100 dark:text-slate-900"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  <Globe size={14} />
                  <span>Datos Globales</span>
                  {todayActiveByEmployee.size > 0 && (
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Hay empleados en turno activo" />
                  )}
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
                  pendingAdvancesByEmployee={pendingAdvancesByEmployee}
                  canWrite={canWriteEmpleados}
                  onSelectEmployee={(emp) => handleSelectEmployeeForDetail(emp, "horarios")}
                  onOpenCurrentAccount={handleOpenCurrentAccount}
                  onOpenProductConsumption={setProductConsumptionEmployee}
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

            {/* 2. DATOS GLOBALES (UNIFICADO: HORARIOS, CUENTAS CORRIENTES Y SALDOS) */}
            {activeTab === "globales" && (
              <div className="space-y-4">
                {/* Sub-pestañas de Datos Globales */}
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => handleGlobalSubTabChange("horarios")}
                    className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                      globalSubTab === "horarios"
                        ? "bg-slate-900 text-white shadow dark:bg-slate-100 dark:text-slate-900"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Clock size={14} />
                    <span>Horarios Globales</span>
                    {todayActiveByEmployee.size > 0 && (
                      <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleGlobalSubTabChange("cuentas-corrientes")}
                    className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                      globalSubTab === "cuentas-corrientes"
                        ? "bg-slate-900 text-white shadow dark:bg-slate-100 dark:text-slate-900"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    }`}
                  >
                    <CreditCard size={14} />
                    <span>Cuentas Corrientes Globales</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleGlobalSubTabChange("sueldos")}
                    className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                      globalSubTab === "sueldos"
                        ? "bg-slate-900 text-white shadow dark:bg-slate-100 dark:text-slate-900"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Receipt size={14} />
                    <span>Saldos Globales</span>
                  </button>
                </div>

                {/* 2.1. HORARIOS Y ASISTENCIA */}
                {globalSubTab === "horarios" && (
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

                {/* 2.2. CUENTAS CORRIENTES */}
                {globalSubTab === "cuentas-corrientes" && (
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
                    usersById={usersById}
                  />
                )}

                {/* 2.3. SALDOS PAGADOS / SUELDOS */}
                {globalSubTab === "sueldos" && (
                  <SalaryPaymentsSection
                    employees={employees}
                    payments={payments}
                    filteredPayments={filteredPayments}
                    totalPaid={totalPaid}
                    totalSalariesPaid={totalSalariesPaid}
                    totalAdvancesPaid={totalAdvancesPaid}
                    totalCurrentAccountDiscounts={totalCurrentAccountDiscounts}
                    selectedEmployeeId={salaryEmpFilter}
                    onSelectEmployeeId={setSalaryEmpFilter}
                    selectedPeriod={salaryPeriodFilter}
                    onSelectPeriod={setSalaryPeriodFilter}
                    selectedType={salaryTypeFilter}
                    onSelectType={setSalaryTypeFilter}
                    datePreset={salaryDatePreset}
                    onSelectDatePreset={setSalaryDatePreset}
                    customStartDate={salaryCustomStartDate}
                    onSelectCustomStartDate={setSalaryCustomStartDate}
                    customEndDate={salaryCustomEndDate}
                    onSelectCustomEndDate={setSalaryCustomEndDate}
                    canWrite={canWriteEmpleados}
                    initialEmployeeForDisbursement={disbursementEmployee}
                    onDisbursementModalClosed={() => setDisbursementEmployee(null)}
                    onCreateSalaryPayment={createSalaryPayment}
                    onCreateSalaryAdvance={createSalaryAdvance}
                    onDeletePayment={deletePayment}
                    onBalanceUpdated={reloadEmployees}
                    usersById={usersById}
                  />
                )}
              </div>
            )}
          </>
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
        {/* Modal de Carga de Productos desde pestaña Personal */}
        {productConsumptionEmployee && tenantId && (
          <EmployeeProductConsumptionModal
            open={Boolean(productConsumptionEmployee)}
            tenantId={tenantId}
            employee={productConsumptionEmployee}
            onClose={() => setProductConsumptionEmployee(null)}
            onSubmit={handleProductSubmitFromPage}
          />
        )}
      </div>
    </PagePlaceholder>
  );
};
