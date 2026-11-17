import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { LoadingState } from "@/components/ui/UiStates";
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
  SlidersHorizontal,
  FilterX,
  X,
  ArrowLeft,
} from "lucide-react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { cn } from "@/utils/cn";
import type { Employee, PaymentMethod, BankAccount } from "@/types/entities";
import { useEmployeesCrud } from "@/modules/empleados/hooks/useEmployeesCrud";
import { useEmployeeAttendance } from "@/modules/empleados/hooks/useEmployeeAttendance";
import { useEmployeeSalaryPayments, isAdvancePayment } from "@/modules/empleados/hooks/useEmployeeSalaryPayments";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { EmployeeFormModal } from "@/modules/empleados/components/EmployeeFormModal";
import { EmployeesTable } from "@/modules/empleados/components/EmployeesTable";
import { AttendanceSection } from "@/modules/empleados/components/AttendanceSection";
import { EmployeeCurrentAccountsSection } from "@/modules/empleados/components/EmployeeCurrentAccountsSection";
import { SalaryPaymentsSection } from "@/modules/empleados/components/SalaryPaymentsSection";
import { EmployeeProductConsumptionModal } from "@/modules/empleados/components/EmployeeProductConsumptionModal";
import { EmployeeDetailView } from "@/modules/empleados/components/EmployeeDetailView";
import { employeeCurrentAccountsService } from "@/services/employee-current-accounts.service";
import { paymentMethodsService } from "@/services/payment-methods.service";
import { bankAccountsService } from "@/services/bank-accounts.service";
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
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    Promise.all([
      paymentMethodsService.getActiveByTenant(tenantId).catch(() => []),
      bankAccountsService.getActiveByTenant(tenantId).catch(() => []),
    ]).then(([methods, accounts]) => {
      setPaymentMethods(methods);
      setBankAccounts(accounts);
    });
  }, [tenantId]);

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

  // Filtros Avanzados para lista de Personal (mobile-data-cards pattern)
  const [employeeFilters, setEmployeeFilters] = useState<{
    status: "all" | "active" | "inactive";
    shiftStatus: "all" | "in_shift" | "out_of_shift";
    debtStatus: "all" | "with_debt" | "clean";
    position: string;
  }>({
    status: "all",
    shiftStatus: "all",
    debtStatus: "all",
    position: "",
  });
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  useBodyScrollLock(filtersModalOpen);

  const activeAdvancedFiltersCount =
    (employeeFilters.status !== "all" ? 1 : 0) +
    (employeeFilters.shiftStatus !== "all" ? 1 : 0) +
    (employeeFilters.debtStatus !== "all" ? 1 : 0) +
    (employeeFilters.position ? 1 : 0);

  const hasActiveFilters = Boolean(search.trim()) || activeAdvancedFiltersCount > 0;

  const positions = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.position?.trim()) set.add(e.position.trim());
    });
    return Array.from(set).sort();
  }, [employees]);

  const filteredEmployeesList = useMemo(() => {
    return filteredEmployees.filter((emp) => {
      // 1. Estado
      if (employeeFilters.status === "active" && !emp.is_active) return false;
      if (employeeFilters.status === "inactive" && emp.is_active) return false;

      // 2. Turno Hoy
      const hasActiveShift = todayActiveByEmployee.has(emp.id);
      if (employeeFilters.shiftStatus === "in_shift" && !hasActiveShift) return false;
      if (employeeFilters.shiftStatus === "out_of_shift" && hasActiveShift) return false;

      // 3. Saldo / Deuda
      const ctaCteBalance = emp.current_balance ?? 0;
      const pendingAdv = pendingAdvancesByEmployee?.get(emp.id) ?? 0;
      const totalDebt = (ctaCteBalance > 0 ? ctaCteBalance : 0) + pendingAdv;
      const totalCredit = ctaCteBalance < 0 ? Math.abs(ctaCteBalance) : 0;
      const netBalance = totalCredit - totalDebt;
      if (employeeFilters.debtStatus === "with_debt" && netBalance >= 0) return false;
      if (employeeFilters.debtStatus === "clean" && netBalance < 0) return false;

      // 4. Puesto
      if (employeeFilters.position && emp.position?.trim() !== employeeFilters.position) return false;

      return true;
    });
  }, [filteredEmployees, employeeFilters, todayActiveByEmployee, pendingAdvancesByEmployee]);

  const handleClearAllFilters = () => {
    setSearch("");
    setEmployeeFilters({
      status: "all",
      shiftStatus: "all",
      debtStatus: "all",
      position: "",
    });
  };

  // Paginación para lista de Personal
  const resetPaginationKey = `${search}-${employeeFilters.status}-${employeeFilters.shiftStatus}-${employeeFilters.debtStatus}-${employeeFilters.position}`;
  const paginatedEmployees = usePagination(filteredEmployeesList, 10, resetPaginationKey);

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
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            Agenda de Empleados
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            No hay un comercio activo seleccionado
          </p>
        </div>
      </div>
    );
  }

  if (!canReadEmpleados) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            Agenda de Empleados
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            No tenés permisos de lectura para este módulo
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full min-w-0 max-w-full">
      {/* Floating Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
            RRHH › EMPLEADOS
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Agenda de Empleados
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Legajos de personal, control de horarios, cuentas corrientes y sueldos
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedEmployeeForDetail && (
            <button
              type="button"
              onClick={() => setSelectedEmployeeForDetail(null)}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              <ArrowLeft size={16} />
              <span>Volver a la lista</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleReloadAll()}
            disabled={isLoadingEmployees || isLoadingAttendance || isLoadingSalary}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                isLoadingEmployees || isLoadingAttendance || isLoadingSalary
                  ? "animate-spin"
                  : ""
              }`}
            />
            <span>Actualizar</span>
          </button>

          {canWriteEmpleados && !selectedEmployeeForDetail && activeTab === "personal" && (
            <button
              type="button"
              onClick={() => {
                clearEmployeesFeedback();
                setFormMode("create");
                setSelectedEmployeeForEdit(undefined);
                setFormModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 active:scale-[0.98] cursor-pointer"
            >
              <PlusCircle size={16} />
              <span>Nuevo Empleado</span>
            </button>
          )}
        </div>
      </header>

      {/* FEEDBACK STATE */}
      {employeesFeedback && (
        <div
          className={`rounded-2xl p-4 text-sm font-medium ${
            employeesFeedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
          }`}
        >
          {employeesFeedback.message}
        </div>
      )}

      {/* MAIN VIEW CONTENT */}
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
          paymentMethods={paymentMethods}
          bankAccounts={bankAccounts}
        />
      ) : (
        <div className="space-y-5">
          {/* Barra superior de pestañas del módulo */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/70">
              <button
                type="button"
                onClick={() => handleTabChange("personal")}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition cursor-pointer ${
                  activeTab === "personal"
                    ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                <Users size={16} />
                <span>Personal ({employees.length})</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange("globales")}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition cursor-pointer ${
                  activeTab === "globales"
                    ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                <Globe size={16} />
                <span>Datos Globales</span>
                {todayActiveByEmployee.size > 0 && (
                  <span
                    className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"
                    title="Hay empleados en turno activo"
                  />
                )}
              </button>
            </div>
          </div>

          {/* 1. PERSONAL */}
          {activeTab === "personal" && (
            <div className="space-y-4">
              {/* Buscador de Personal y Filtros Avanzados (mobile-data-cards pattern) */}
              <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5">
                  {/* Campo de Búsqueda Redondeado */}
                  <div className="flex flex-1 min-w-0 items-center gap-2.5 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2 shadow-2xs focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-700/80 dark:bg-slate-800/40 dark:focus-within:bg-slate-900 transition-all">
                    <Search className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar por nombre, DNI, legajo o puesto..."
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                      className="flex-1 min-w-0 border-0 bg-transparent px-1 py-0.5 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                    {search ? (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 rounded-full cursor-pointer"
                        title="Limpiar búsqueda"
                      >
                        <X size={15} />
                      </button>
                    ) : null}
                  </div>

                  {/* Botón de Filtros Avanzados y Limpiar */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setFiltersModalOpen(true)}
                      className={cn(
                        "flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100 px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-200 shrink-0 transition-all cursor-pointer",
                        activeAdvancedFiltersCount > 0 &&
                          "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-semibold"
                      )}
                    >
                      <SlidersHorizontal size={15} className="text-blue-600 dark:text-blue-400" />
                      <span>Filtros avanzados</span>
                      {activeAdvancedFiltersCount > 0 ? (
                        <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {activeAdvancedFiltersCount}
                        </span>
                      ) : null}
                    </button>

                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={handleClearAllFilters}
                        className="inline-flex items-center justify-center h-9 w-9 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100 text-slate-500 hover:text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors shrink-0 cursor-pointer"
                        title="Limpiar todos los filtros"
                        aria-label="Limpiar todos los filtros"
                      >
                        <FilterX size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Chips de filtros activos */}
                {activeAdvancedFiltersCount > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {employeeFilters.status !== "all" ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
                        <span>
                          Estado: <strong>{employeeFilters.status === "active" ? "Solo Activos" : "Solo Inactivos"}</strong>
                        </span>
                        <button
                          type="button"
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 rounded-full cursor-pointer"
                          onClick={() => setEmployeeFilters((p) => ({ ...p, status: "all" }))}
                          aria-label="Quitar filtro de estado"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ) : null}

                    {employeeFilters.shiftStatus !== "all" ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
                        <span>
                          Turno: <strong>{employeeFilters.shiftStatus === "in_shift" ? "En turno ahora" : "Fuera de turno"}</strong>
                        </span>
                        <button
                          type="button"
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 rounded-full cursor-pointer"
                          onClick={() => setEmployeeFilters((p) => ({ ...p, shiftStatus: "all" }))}
                          aria-label="Quitar filtro de turno"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ) : null}

                    {employeeFilters.debtStatus !== "all" ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
                        <span>
                          Saldo: <strong>{employeeFilters.debtStatus === "with_debt" ? "Con saldo deudor" : "Al día"}</strong>
                        </span>
                        <button
                          type="button"
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 rounded-full cursor-pointer"
                          onClick={() => setEmployeeFilters((p) => ({ ...p, debtStatus: "all" }))}
                          aria-label="Quitar filtro de saldo"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ) : null}

                    {employeeFilters.position ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
                        <span>
                          Puesto: <strong>{employeeFilters.position}</strong>
                        </span>
                        <button
                          type="button"
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 rounded-full cursor-pointer"
                          onClick={() => setEmployeeFilters((p) => ({ ...p, position: "" }))}
                          aria-label="Quitar filtro de puesto"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {/* Resumen de conteo */}
                <div className="flex items-center justify-between px-1 text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    {hasActiveFilters ? (
                      <>
                        Mostrando <strong className="text-slate-800 dark:text-slate-200">{filteredEmployeesList.length}</strong> de {employees.length} empleados
                      </>
                    ) : (
                      <>
                        Total de empleados: <strong className="text-slate-800 dark:text-slate-200">{employees.length}</strong>
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Tabla de Empleados */}
              {isLoadingEmployees ? (
                <LoadingState
                  message="Cargando personal y empleados..."
                  description="Consultando turnos, legajos y asistencias activas..."
                />
              ) : (
                <EmployeesTable
                  employees={paginatedEmployees.pageItems}
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
              )}

              <PaginationControls
                currentPage={paginatedEmployees.currentPage}
                pageCount={paginatedEmployees.pageCount}
                startItem={paginatedEmployees.startItem}
                endItem={paginatedEmployees.endItem}
                totalItems={paginatedEmployees.totalItems}
                onPageChange={paginatedEmployees.setCurrentPage}
              />
            </div>
          )}

          {/* 2. DATOS GLOBALES (HORARIOS, CUENTAS CORRIENTES Y SALDOS) */}
          {activeTab === "globales" && (
            <div className="space-y-4">
              {/* Sub-pestañas de Datos Globales */}
              <div className="inline-flex flex-wrap gap-1.5 rounded-2xl bg-slate-100/90 p-1 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => handleGlobalSubTabChange("horarios")}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    globalSubTab === "horarios"
                      ? "bg-white text-blue-600 shadow-xs dark:bg-slate-900 dark:text-blue-400"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
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
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    globalSubTab === "cuentas-corrientes"
                      ? "bg-white text-blue-600 shadow-xs dark:bg-slate-900 dark:text-blue-400"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  <CreditCard size={14} />
                  <span>Cuentas Corrientes Globales</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleGlobalSubTabChange("sueldos")}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    globalSubTab === "sueldos"
                      ? "bg-white text-blue-600 shadow-xs dark:bg-slate-900 dark:text-blue-400"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
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
        </div>
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

      {/* Modal Emergente de Filtros Avanzados (mobile-data-cards pattern) */}
      {filtersModalOpen ? (
        <section className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] p-4 backdrop-blur-[0.5px]">
          <div className="w-full max-w-md overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-blue-600 dark:text-blue-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Filtros de empleados
                </h3>
              </div>
              <ModalCloseButton
                label="Cerrar filtros"
                onClick={() => setFiltersModalOpen(false)}
              />
            </div>

            <div className="space-y-4 py-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Estado del personal
                </label>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 cursor-pointer focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
                  value={employeeFilters.status}
                  onChange={(e) =>
                    setEmployeeFilters((p) => ({ ...p, status: e.target.value as any }))
                  }
                  aria-label="Filtrar por estado"
                >
                  <option value="all">Todos los estados</option>
                  <option value="active">Solo Activos</option>
                  <option value="inactive">Solo Inactivos</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Turno Hoy
                </label>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 cursor-pointer focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
                  value={employeeFilters.shiftStatus}
                  onChange={(e) =>
                    setEmployeeFilters((p) => ({ ...p, shiftStatus: e.target.value as any }))
                  }
                  aria-label="Filtrar por turno"
                >
                  <option value="all">Todos los turnos</option>
                  <option value="in_shift">En turno activo ahora</option>
                  <option value="out_of_shift">Fuera de turno</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Saldo / Cuenta Corriente
                </label>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 cursor-pointer focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
                  value={employeeFilters.debtStatus}
                  onChange={(e) =>
                    setEmployeeFilters((p) => ({ ...p, debtStatus: e.target.value as any }))
                  }
                  aria-label="Filtrar por saldo"
                >
                  <option value="all">Todos los saldos</option>
                  <option value="with_debt">Con saldo deudor pendiente</option>
                  <option value="clean">Al día o saldo a favor</option>
                </select>
              </div>

              {positions.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Puesto / Función
                  </label>
                  <select
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 cursor-pointer focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
                    value={employeeFilters.position}
                    onChange={(e) =>
                      setEmployeeFilters((p) => ({ ...p, position: e.target.value }))
                    }
                    aria-label="Filtrar por puesto"
                  >
                    <option value="">Todos los puestos</option>
                    {positions.map((pos) => (
                      <option key={pos} value={pos}>
                        {pos}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-800">
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                onClick={() => {
                  setEmployeeFilters({
                    status: "all",
                    shiftStatus: "all",
                    debtStatus: "all",
                    position: "",
                  });
                }}
                disabled={activeAdvancedFiltersCount === 0}
              >
                Limpiar filtros
              </button>
              <button
                type="button"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors cursor-pointer"
                onClick={() => setFiltersModalOpen(false)}
              >
                Aplicar y cerrar
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
};
