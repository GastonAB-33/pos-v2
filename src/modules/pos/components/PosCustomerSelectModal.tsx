import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Edit2, Plus, Search, Tag, UserCheck, Users, X } from "lucide-react";
import type { Customer, Employee } from "@/types/entities";
import { formatCustomerDocument } from "@/modules/configuracion/hooks/useEntityRequirements";

interface PosCustomerSelectModalProps {
  isOpen: boolean;
  customers: Customer[];
  employees?: Employee[];
  selectedCustomerId?: string | null;
  selectedEmployeeId?: string | null;
  onClose: () => void;
  onSelect: (customer: Customer) => void;
  onSelectEmployee?: (employee: Employee) => void;
  onOpenCreateCustomer: (initialName?: string) => void;
  onEditCustomer?: (customer: Customer, defaultTab?: "personal" | "fiscal" | "account") => void;
  employeeDiscountPercent?: number;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const PosCustomerSelectModal = ({
  isOpen,
  customers,
  employees = [],
  selectedCustomerId,
  selectedEmployeeId,
  onClose,
  onSelect,
  onSelectEmployee,
  onOpenCreateCustomer,
  onEditCustomer,
  employeeDiscountPercent = 10,
}: PosCustomerSelectModalProps) => {
  const [activeTab, setActiveTab] = useState<"customers" | "employees">(
    selectedEmployeeId ? "employees" : "customers"
  );
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);

  // Filtrar clientes activos según el query
  const filteredCustomers = useMemo(() => {
    const q = query.trim().toLowerCase();
    const active = customers.filter((c) => c.is_active);
    if (!q) return active.slice(0, 30);

    return active
      .filter((c) => {
        const nameMatch = c.full_name.toLowerCase().includes(q);
        const docMatch = c.document_number?.toLowerCase().includes(q);
        const phoneMatch = c.phone?.toLowerCase().includes(q);
        const fiscalMatch = c.fiscal_business_name?.toLowerCase().includes(q);
        return nameMatch || docMatch || phoneMatch || fiscalMatch;
      })
      .slice(0, 30);
  }, [customers, query]);

  // Filtrar empleados activos según el query
  const filteredEmployees = useMemo(() => {
    const q = query.trim().toLowerCase();
    const active = employees.filter((e) => e.is_active);
    if (!q) return active.slice(0, 30);

    return active
      .filter((e) => {
        const nameMatch = e.full_name.toLowerCase().includes(q);
        const docMatch = e.document_number?.toLowerCase().includes(q);
        const codeMatch = e.code?.toLowerCase().includes(q);
        const posMatch = e.position?.toLowerCase().includes(q);
        return nameMatch || docMatch || codeMatch || posMatch;
      })
      .slice(0, 30);
  }, [employees, query]);

  const activeListLength =
    activeTab === "customers" ? filteredCustomers.length : filteredEmployees.length;

  // Reset y autofocus inmediato al abrir
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setHighlightedIndex(0);
      setActiveTab(selectedEmployeeId ? "employees" : "customers");
      window.setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 50);
    }
  }, [isOpen, selectedEmployeeId]);

  // Asegurar que el índice resaltado siempre esté dentro del rango
  useEffect(() => {
    setHighlightedIndex((prev) => {
      if (activeListLength === 0) return 0;
      if (prev >= activeListLength) return activeListLength - 1;
      return prev;
    });
  }, [activeListLength]);

  // Scroll automático para mantener el ítem resaltado a la vista
  useEffect(() => {
    if (!listContainerRef.current) return;
    const items = listContainerRef.current.querySelectorAll<HTMLElement>("[data-customer-item]");
    const activeItem = items[highlightedIndex];
    if (activeItem) {
      activeItem.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  // Manejo de teclado ágil (ArrowUp, ArrowDown, Enter, Escape)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        activeListLength > 0 ? (prev + 1) % activeListLength : 0
      );
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        activeListLength > 0
          ? (prev - 1 + activeListLength) % activeListLength
          : 0
      );
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (activeTab === "customers") {
        if (filteredCustomers.length > 0 && filteredCustomers[highlightedIndex]) {
          onSelect(filteredCustomers[highlightedIndex]);
          onClose();
        } else if (query.trim()) {
          onOpenCreateCustomer(query.trim());
          onClose();
        }
      } else {
        if (filteredEmployees.length > 0 && filteredEmployees[highlightedIndex]) {
          onSelectEmployee?.(filteredEmployees[highlightedIndex]);
          onClose();
        }
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
      onKeyDown={handleKeyDown}
    >
      <div className="flex flex-col w-full max-w-xl max-h-[85vh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-3.5 bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300">
              <UserCheck size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Seleccionar Cliente o Empleado
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Para cuenta corriente o asignación de venta directa
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition"
            title="Cerrar (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Selector de Pestañas: Clientes vs Empleados */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-4 bg-slate-50/50 dark:bg-slate-850/50 gap-4 pt-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab("customers");
              setHighlightedIndex(0);
            }}
            className={`pb-2.5 pt-2 text-xs font-bold transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === "customers"
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Users size={14} />
            <span>Clientes ({customers.filter((c) => c.is_active).length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("employees");
              setHighlightedIndex(0);
            }}
            className={`pb-2.5 pt-2 text-xs font-bold transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === "employees"
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <UserCheck size={14} />
            <span>Empleados Cta. Cte. ({employees.filter((e) => e.is_active).length})</span>
            <span className="rounded bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.2 text-[10px] font-bold">
              {employeeDiscountPercent}% OFF
            </span>
          </button>
        </div>

        {/* Search Bar con cursor listo para escribir */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              placeholder={
                activeTab === "customers"
                  ? "Escribí para buscar cliente... (ej: Pérez, 38123...)"
                  : "Escribí para buscar empleado... (ej: Juan, Cajero, EMP-001)"
              }
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent font-medium"
            />
          </div>
        </div>

        {/* Results List */}
        <div
          ref={listContainerRef}
          className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-slate-100 dark:divide-slate-800/60"
        >
          {activeTab === "employees" ? (
            filteredEmployees.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  No se encontraron empleados para &quot;{query}&quot;
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Verificá el nombre, legajo o que el empleado esté registrado en Agenda &gt; Empleados.
                </p>
              </div>
            ) : (
              filteredEmployees.map((emp, idx) => {
                const isHighlighted = idx === highlightedIndex;
                const isSelected = emp.id === selectedEmployeeId;
                const isCcEnabled = emp.current_account_enabled;
                const discount = emp.discount_percent ?? employeeDiscountPercent;

                return (
                  <div
                    key={emp.id}
                    data-customer-item="true"
                    onClick={() => {
                      onSelectEmployee?.(emp);
                      onClose();
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`group relative flex items-center justify-between rounded-xl px-3.5 py-3 text-left transition cursor-pointer ${
                      isHighlighted
                        ? "bg-indigo-50 dark:bg-indigo-950/60 ring-1.5 ring-indigo-500/80 dark:ring-indigo-400/80"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/70"
                    } ${isSelected ? "border-l-4 border-indigo-600 dark:border-indigo-400" : ""}`}
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {emp.full_name}
                        </span>
                        <span className="rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 dark:text-slate-300">
                          {emp.code}
                        </span>
                        <span className="rounded-md bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                          <Tag size={10} /> {discount}% OFF
                        </span>
                        {isSelected && (
                          <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.2 flex items-center gap-1">
                            <Check size={10} strokeWidth={3} /> Seleccionado
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>
                          Puesto: <strong className="text-slate-700 dark:text-slate-300">{emp.position}</strong>
                        </span>
                        {emp.document_number && <span>DNI: {emp.document_number}</span>}
                        {emp.phone && <span>Tel: {emp.phone}</span>}
                      </div>
                    </div>

                    {/* Estado de Cuenta Corriente */}
                    <div className="text-right shrink-0">
                      {isCcEnabled ? (
                        <div>
                          <span className="inline-block rounded-md bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                            Cta. Cte. Habilitada
                          </span>
                          {emp.current_account_limit != null && (
                            <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                              Límite: {currency.format(emp.current_account_limit)}
                            </p>
                          )}
                          <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 font-mono mt-0.5">
                            Saldo adeudado: {currency.format(emp.current_balance || 0)}
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          <span className="inline-block rounded-md bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/70 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                            Cta. Cte. Inactiva
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )
          ) : (
            filteredCustomers.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No se encontraron clientes para &quot;{query}&quot;
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
                Podés darlo de alta ahora mismo y asignarlo a la venta.
              </p>
              <button
                type="button"
                onClick={() => {
                  onOpenCreateCustomer(query.trim());
                  onClose();
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 text-xs transition shadow-sm"
              >
                <Plus size={15} />
                Crear cliente &quot;{query.trim() || "nuevo"}&quot; (Enter)
              </button>
            </div>
          ) : (
            filteredCustomers.map((customer, idx) => {
              const isHighlighted = idx === highlightedIndex;
              const isSelected = customer.id === selectedCustomerId;
              const isCcEnabled = customer.current_account_enabled;

              return (
                <div
                  key={customer.id}
                  data-customer-item="true"
                  onClick={() => {
                    onSelect(customer);
                    onClose();
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`group relative flex items-center justify-between rounded-xl px-3.5 py-3 text-left transition cursor-pointer ${
                    isHighlighted
                      ? "bg-indigo-50 dark:bg-indigo-950/60 ring-1.5 ring-indigo-500/80 dark:ring-indigo-400/80"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/70"
                  } ${isSelected ? "border-l-4 border-indigo-600 dark:border-indigo-400" : ""}`}
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {customer.full_name}
                      </span>
                      {customer.document_number && (
                        <span className="rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 dark:text-slate-300">
                          {formatCustomerDocument(customer.document_type, customer.document_number)}
                        </span>
                      )}
                      {isSelected && (
                        <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.2 flex items-center gap-1">
                          <Check size={10} strokeWidth={3} /> Actual
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {customer.phone && <span>Tel: {customer.phone}</span>}
                      {customer.fiscal_business_name && (
                        <span className="truncate">Razón Social: {customer.fiscal_business_name}</span>
                      )}
                    </div>
                  </div>

                  {/* Estado de Cuenta Corriente */}
                  <div className="text-right shrink-0">
                    {isCcEnabled ? (
                      <div>
                        <span className="inline-block rounded-md bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                          Cta. Cte. Habilitada
                        </span>
                        {customer.current_account_limit != null && (
                          <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                            Límite: {currency.format(customer.current_account_limit)}
                          </p>
                        )}
                        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 font-mono mt-0.5">
                          Saldo actual: {currency.format(customer.current_balance || 0)}
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-end gap-1">
                        <span className="inline-block rounded-md bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/70 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                          Cta. Cte. Inactiva
                        </span>
                        {onEditCustomer ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onClose();
                              onEditCustomer(customer, "account");
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                            title="Editar cliente para asignarle una cuenta corriente"
                          >
                            <Edit2 size={11} />
                            Habilitar Cta. Cte.
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ))}
        </div>

        {/* Footer con botón rápido de alta */}
        {activeTab === "customers" ? (
          <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 px-4 py-3 bg-slate-50 dark:bg-slate-850 text-xs">
            <button
              type="button"
              onClick={() => {
                onOpenCreateCustomer(query.trim());
                onClose();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              <Plus size={14} className="text-indigo-600 dark:text-indigo-400" />
              Crear nuevo cliente
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};
