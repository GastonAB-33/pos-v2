import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
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

export const EmployeeFormModal = ({
  open,
  mode,
  employee,
  isSubmitting,
  onClose,
  onSubmit,
}: EmployeeFormModalProps) => {
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
        observations: "",
      });
    }
  }, [open, employee, mode, reset]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {mode === "create" ? "Registrar Nuevo Empleado" : `Editar Empleado: ${employee?.full_name}`}
            </h3>
            <p className="text-xs text-slate-500">
              {mode === "create"
                ? "Ingresá los datos personales, laborales y cuenta corriente del personal."
                : "Modificá la información de legajo del empleado seleccionado."}
            </p>
          </div>
          <ModalCloseButton label="Cerrar modal" onClick={onClose} disabled={isSubmitting} />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Datos Personales */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b pb-1 dark:border-slate-800">
              Datos Personales
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre Completo *
                </label>
                <input
                  {...register("fullName")}
                  type="text"
                  placeholder="Ej: Juan Pérez"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                {errors.fullName && (
                  <p className="text-xs text-rose-500 mt-1">{errors.fullName.message}</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tipo Doc.
                  </label>
                  <select
                    {...register("documentType")}
                    className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="dni">DNI</option>
                    <option value="cuil">CUIL</option>
                    <option value="pasaporte">Pasaporte</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    N° Documento *
                  </label>
                  <input
                    {...register("documentNumber")}
                    type="text"
                    placeholder="Ej: 35123456"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  {errors.documentNumber && (
                    <p className="text-xs text-rose-500 mt-1">{errors.documentNumber.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Teléfono de Contacto
                </label>
                <input
                  {...register("phone")}
                  type="text"
                  placeholder="Ej: 11 2345 6789"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email
                </label>
                <input
                  {...register("email")}
                  type="email"
                  placeholder="Ej: empleado@comercio.com"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                {errors.email && (
                  <p className="text-xs text-rose-500 mt-1">{errors.email.message}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Domicilio
                </label>
                <input
                  {...register("address")}
                  type="text"
                  placeholder="Ej: Av. San Martín 123"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Datos Laborales y Sueldo */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b pb-1 dark:border-slate-800">
              Datos Laborales & Sueldo
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Puesto / Cargo *
                </label>
                <input
                  {...register("position")}
                  type="text"
                  placeholder="Ej: Cajero / Mostrador"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                {errors.position && (
                  <p className="text-xs text-rose-500 mt-1">{errors.position.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Sueldo Base ($)
                </label>
                <input
                  {...register("baseSalary")}
                  type="text"
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                {errors.baseSalary && (
                  <p className="text-xs text-rose-500 mt-1">{errors.baseSalary.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tarifa por Hora ($) (Opcional)
                </label>
                <input
                  {...register("hourlyRate")}
                  type="text"
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Fecha de Ingreso
                </label>
                <input
                  {...register("hireDate")}
                  type="date"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Configuración Cuenta Corriente para Empleado */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b pb-1 dark:border-slate-800">
              Cuenta Corriente (Retiro de Productos y Anticipos)
            </h4>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/50 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  {...register("currentAccountEnabled")}
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Habilitar Cuenta Corriente para este empleado
                </span>
              </label>
              <p className="text-xs text-slate-500">
                Permite registrar retiros de productos o consumos a descontar posteriormente del sueldo.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Límite de Cuenta Corriente ($) (Dejar vacío para ilimitado)
                </label>
                <input
                  {...register("currentAccountLimit")}
                  type="text"
                  placeholder="Ej: 50000"
                  className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Observaciones o Notas
            </label>
            <textarea
              {...register("observations")}
              rows={2}
              placeholder="Notas internas sobre el empleado..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              {isSubmitting ? "Guardando..." : mode === "create" ? "Registrar Empleado" : "Guardar Cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
