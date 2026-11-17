import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import {
  employeeFormSchema,
  type EmployeeFormValues,
} from "@/modules/empleados/schemas/employee-form.schema";
import type { Employee } from "@/types/entities";

interface EmployeeFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  employee?: Employee;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: EmployeeFormValues) => Promise<void>;
}

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 transition-all";

const selectClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:focus:border-blue-400 transition-all";

export const EmployeeFormModal = ({
  open,
  mode,
  employee,
  isSubmitting,
  onClose,
  onSubmit,
}: EmployeeFormModalProps) => {
  useBodyScrollLock(open);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      fullName: "",
      documentType: "dni",
      documentNumber: "",
      phone: "",
      email: "",
      address: "",
      position: "",
      baseSalary: "",
      hourlyRate: "",
      hireDate: new Date().toISOString().split("T")[0],
      currentAccountEnabled: true,
      currentAccountLimit: "",
      discountPercent: "",
      observations: "",
    },
  });

  useEffect(() => {
    if (!open) return;

    if (employee && mode === "edit") {
      reset({
        fullName: employee.full_name,
        documentType: (employee.document_type as "dni" | "cuil" | "pasaporte") || "dni",
        documentNumber: employee.document_number,
        phone: employee.phone || "",
        email: employee.email || "",
        address: employee.address || "",
        position: employee.position,
        baseSalary: employee.base_salary ? String(employee.base_salary) : "",
        hourlyRate: employee.hourly_rate ? String(employee.hourly_rate) : "",
        hireDate: employee.hire_date || "",
        currentAccountEnabled: employee.current_account_enabled ?? true,
        currentAccountLimit: employee.current_account_limit
          ? String(employee.current_account_limit)
          : "",
        discountPercent: employee.discount_percent != null ? String(employee.discount_percent) : "",
        observations: employee.observations || "",
      });
    } else {
      reset({
        fullName: "",
        documentType: "dni",
        documentNumber: "",
        phone: "",
        email: "",
        address: "",
        position: "",
        baseSalary: "",
        hourlyRate: "",
        hireDate: new Date().toISOString().split("T")[0],
        currentAccountEnabled: true,
        currentAccountLimit: "",
        discountPercent: "",
        observations: "",
      });
    }
  }, [open, employee, mode, reset]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative z-10 w-full max-w-2xl rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-slate-200/90 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-4 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
              <span className="text-slate-400 dark:text-slate-500">GESTIÓN</span>
              <span className="text-slate-400 dark:text-slate-500 font-bold">›</span>
              <span className="text-blue-600 dark:text-blue-400 font-bold">
                {mode === "create" ? "NUEVO EMPLEADO" : "EDITAR LEGAJO"}
              </span>
            </div>
            <h3 className="mt-0.5 text-lg font-bold text-slate-900 dark:text-slate-100">
              {mode === "create" ? "Registrar Nuevo Empleado" : `Editar Empleado: ${employee?.full_name}`}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {mode === "create"
                ? "Ingresá los datos personales, laborales y cuenta corriente del personal."
                : "Modificá la información de legajo del empleado seleccionado."}
            </p>
          </div>
          <ModalCloseButton label="Cerrar modal" onClick={onClose} disabled={isSubmitting} />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} autoComplete="off" className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Datos Personales */}
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 dark:border-slate-700/80 dark:bg-slate-800/50 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b border-slate-200/80 dark:border-slate-700/60 pb-1">
              Datos Personales
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Nombre Completo <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <input
                  {...register("fullName")}
                  type="text"
                  placeholder="Ej: Juan Pérez"
                  className={inputClass}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                />
                {errors.fullName && (
                  <p className="text-xs text-rose-500 mt-1">{errors.fullName.message}</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Tipo Doc.
                  </label>
                  <select
                    {...register("documentType")}
                    className={selectClass}
                  >
                    <option value="dni">DNI</option>
                    <option value="cuil">CUIL</option>
                    <option value="pasaporte">Pasaporte</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    N° Documento <span className="text-red-500 dark:text-red-400">*</span>
                  </label>
                  <input
                    {...register("documentNumber")}
                    type="text"
                    placeholder="Ej: 35123456"
                    className={inputClass}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-lpignore="true"
                  />
                  {errors.documentNumber && (
                    <p className="text-xs text-rose-500 mt-1">{errors.documentNumber.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Teléfono de Contacto
                </label>
                <input
                  {...register("phone")}
                  type="text"
                  placeholder="Ej: 11 2345 6789"
                  className={inputClass}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Email
                </label>
                <input
                  {...register("email")}
                  type="email"
                  placeholder="Ej: empleado@comercio.com"
                  className={inputClass}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                />
                {errors.email && (
                  <p className="text-xs text-rose-500 mt-1">{errors.email.message}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Domicilio
                </label>
                <input
                  {...register("address")}
                  type="text"
                  placeholder="Ej: Av. San Martín 123"
                  className={inputClass}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                />
              </div>
            </div>
          </div>

          {/* Datos Laborales y Sueldo */}
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 dark:border-slate-700/80 dark:bg-slate-800/50 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b border-slate-200/80 dark:border-slate-700/60 pb-1">
              Datos Laborales & Sueldo
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Puesto / Cargo <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <input
                  {...register("position")}
                  type="text"
                  placeholder="Ej: Cajero / Mostrador"
                  className={inputClass}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                />
                {errors.position && (
                  <p className="text-xs text-rose-500 mt-1">{errors.position.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Sueldo Base ($)
                </label>
                <input
                  {...register("baseSalary")}
                  type="text"
                  placeholder="0.00"
                  className={inputClass}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                {errors.baseSalary && (
                  <p className="text-xs text-rose-500 mt-1">{errors.baseSalary.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Tarifa por Hora ($) <span className="text-[11px] font-normal text-slate-400">(opcional)</span>
                </label>
                <input
                  {...register("hourlyRate")}
                  type="text"
                  placeholder="0.00"
                  className={inputClass}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Fecha de Ingreso
                </label>
                <input
                  {...register("hireDate")}
                  type="date"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Configuración Cuenta Corriente para Empleado */}
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 dark:border-slate-700/80 dark:bg-slate-800/50 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b border-slate-200/80 dark:border-slate-700/60 pb-1">
              Cuenta Corriente (Retiro de Productos y Anticipos)
            </h4>
            <div className="space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  {...register("currentAccountEnabled")}
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                />
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Habilitar Cuenta Corriente para este empleado
                </span>
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Permite registrar retiros de productos o consumos a descontar posteriormente del sueldo.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Límite de Cuenta Corriente ($) <span className="text-[11px] font-normal text-slate-400">(Vacío = sin límite)</span>
                  </label>
                  <input
                    {...register("currentAccountLimit")}
                    type="text"
                    placeholder="Ej: 50000"
                    className={inputClass}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Descuento especial (%) <span className="text-[11px] font-normal text-slate-400">(Vacío = default comercio)</span>
                  </label>
                  <input
                    {...register("discountPercent")}
                    type="text"
                    placeholder="Ej: 15"
                    className={inputClass}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
              Observaciones o Notas
            </label>
            <textarea
              {...register("observations")}
              rows={2}
              placeholder="Notas internas sobre el empleado..."
              className={inputClass}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200/80 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700 active:scale-95 disabled:opacity-60 transition-all cursor-pointer"
            >
              {isSubmitting ? "Guardando..." : mode === "create" ? "Registrar Empleado" : "Guardar Cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
