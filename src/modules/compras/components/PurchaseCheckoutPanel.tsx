import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Calendar, Check, ChevronDown, CreditCard, FileText, Plus, Search, User, StickyNote, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Supplier } from "@/types/entities";
import {
  purchaseCheckoutSchema,
  type PurchaseCheckoutValues,
} from "@/modules/compras/schemas/purchase-checkout.schema";

interface PurchaseCheckoutPanelProps {
  suppliers: Supplier[];
  canWrite: boolean;
  disabled?: boolean;
  preferredSupplierId?: string;
  formId?: string;
  onCreateSupplier: () => void;
  onSubmit: (values: PurchaseCheckoutValues) => Promise<boolean>;
}

const getTodayDate = () => new Date().toISOString().split("T")[0];

export const PurchaseCheckoutPanel = ({
  suppliers,
  canWrite,
  disabled,
  preferredSupplierId,
  formId = "purchase-checkout-form",
  onCreateSupplier,
  onSubmit,
}: PurchaseCheckoutPanelProps) => {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PurchaseCheckoutValues>({
    resolver: zodResolver(purchaseCheckoutSchema),
    defaultValues: {
      supplierId: "",
      documentType: "FACTURA_A",
      documentNumber: "",
      issueDate: getTodayDate(),
      paymentMethod: "cash",
      notes: "",
    },
  });

  const selectedSupplierId = watch("supplierId");
  const [supplierSearchText, setSupplierSearchText] = useState("");
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  const supplierBoxRef = useRef<HTMLDivElement>(null);

  // Sincronizar texto de búsqueda cuando cambia el proveedor seleccionado
  useEffect(() => {
    if (selectedSupplierId) {
      const match = suppliers.find((s) => s.id === selectedSupplierId);
      if (match) {
        setSupplierSearchText(match.name);
      }
    } else {
      setSupplierSearchText("");
    }
  }, [selectedSupplierId, suppliers]);

  useEffect(() => {
    if (preferredSupplierId) {
      setValue("supplierId", preferredSupplierId, { shouldValidate: true });
    }
  }, [preferredSupplierId, setValue]);

  // Click outside para cerrar dropdown de proveedores
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (supplierBoxRef.current && !supplierBoxRef.current.contains(event.target as Node)) {
        setIsSupplierDropdownOpen(false);
        // Si el texto escrito no coincide con el seleccionado, restaurar el nombre del seleccionado
        const currentSelected = suppliers.find((s) => s.id === selectedSupplierId);
        if (currentSelected) {
          setSupplierSearchText(currentSelected.name);
        } else {
          setSupplierSearchText("");
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedSupplierId, suppliers]);

  // Filtrado reactivo de proveedores
  const filteredSuppliers = useMemo(() => {
    const q = supplierSearchText.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.code && s.code.toLowerCase().includes(q))
    );
  }, [suppliers, supplierSearchText]);

  const handleSelectSupplier = (supplier: Supplier) => {
    setValue("supplierId", supplier.id, { shouldValidate: true });
    setSupplierSearchText(supplier.name);
    setIsSupplierDropdownOpen(false);
  };

  const handleClearSupplier = () => {
    setValue("supplierId", "", { shouldValidate: true });
    setSupplierSearchText("");
    setIsSupplierDropdownOpen(false);
  };

  const submit = async (values: PurchaseCheckoutValues) => {
    const saved = await onSubmit(values);
    if (saved) {
      reset({
        supplierId: "",
        documentType: "FACTURA_A",
        documentNumber: "",
        issueDate: getTodayDate(),
        paymentMethod: "cash",
        notes: "",
      });
      setSupplierSearchText("");
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <FileText className="h-4 w-4 text-brand-600" />
          Datos de la compra y factura
        </h2>
        <span className="text-[11px] text-slate-400">Campos del comprobante y proveedor</span>
      </div>

      <form id={formId} autoComplete="off" onSubmit={handleSubmit(submit)} className="space-y-3">
        {/* Input oculto para que react-hook-form valide supplierId */}
        <input type="hidden" {...register("supplierId")} />

        {/* Grid principal de datos */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Proveedor con Buscador en Vivo (Combobox) */}
          <div className="relative lg:col-span-2" ref={supplierBoxRef}>
            <div className="mb-1 flex items-center justify-between">
              <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                <User className="h-3 w-3 text-slate-400" />
                Proveedor *
              </label>
              <button
                type="button"
                className="inline-flex items-center gap-0.5 text-[11px] font-medium text-brand-600 hover:text-brand-700 hover:underline"
                onClick={onCreateSupplier}
                disabled={disabled || !canWrite}
              >
                <Plus className="h-3 w-3" />
                Nuevo
              </button>
            </div>

            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
                <Search className="h-3.5 w-3.5" />
              </div>
              <input
                type="text"
                autoComplete="off"
                placeholder="Escribe para buscar proveedor..."
                value={supplierSearchText}
                onChange={(e) => {
                  setSupplierSearchText(e.target.value);
                  setIsSupplierDropdownOpen(true);
                  if (!e.target.value.trim()) {
                    setValue("supplierId", "", { shouldValidate: true });
                  }
                }}
                onFocus={() => setIsSupplierDropdownOpen(true)}
                disabled={disabled || !canWrite}
                className={`w-full rounded-lg border bg-slate-50/50 py-1.5 pl-8 pr-14 text-xs font-medium text-slate-800 transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 ${
                  errors.supplierId ? "border-red-400 bg-red-50/30" : "border-slate-300"
                }`}
              />

              <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">
                {selectedSupplierId ? (
                  <button
                    type="button"
                    onClick={handleClearSupplier}
                    disabled={disabled || !canWrite}
                    className="p-1 text-slate-400 hover:text-slate-600"
                    title="Limpiar proveedor"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setIsSupplierDropdownOpen((prev) => !prev)}
                  disabled={disabled || !canWrite}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Menú desplegable con coincidencias en tiempo real */}
            {isSupplierDropdownOpen && (
              <div className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                {filteredSuppliers.length === 0 ? (
                  <div className="p-3 text-center">
                    <p className="text-xs text-slate-500">
                      No se encontró ningún proveedor con "{supplierSearchText}"
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSupplierDropdownOpen(false);
                        onCreateSupplier();
                      }}
                      className="mt-2 inline-flex items-center gap-1 rounded bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                    >
                      <Plus className="h-3 w-3" />
                      Dar de alta este proveedor
                    </button>
                  </div>
                ) : (
                  filteredSuppliers.map((supplier) => {
                    const isSelected = supplier.id === selectedSupplierId;
                    return (
                      <button
                        key={supplier.id}
                        type="button"
                        onClick={() => handleSelectSupplier(supplier)}
                        className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition ${
                          isSelected
                            ? "bg-brand-50 font-bold text-brand-800"
                            : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <div className="min-w-0 flex-1 truncate">
                          <span className="font-semibold">{supplier.name}</span>
                          {supplier.code ? (
                            <span className="ml-1.5 text-[10px] text-slate-400">
                              ({supplier.code})
                            </span>
                          ) : null}
                        </div>
                        {isSelected && <Check className="h-3.5 w-3.5 text-brand-600" />}
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {errors.supplierId ? (
              <p className="mt-0.5 text-[11px] text-red-600">{errors.supplierId.message}</p>
            ) : null}
          </div>

          {/* Tipo de Comprobante */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              Comprobante
            </label>
            <select
              {...register("documentType")}
              className="w-full rounded-lg border border-slate-300 bg-slate-50/50 px-2.5 py-1.5 text-xs font-medium text-slate-800 transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              disabled={disabled || !canWrite}
            >
              <option value="FACTURA_A">Factura A</option>
              <option value="FACTURA_B">Factura B</option>
              <option value="FACTURA_C">Factura C</option>
              <option value="REMITO">Remito</option>
              <option value="TICKET">Ticket</option>
              <option value="PRESUPUESTO">Presupuesto</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>

          {/* Nº Comprobante con autocompletado y sugerencias del navegador DESACTIVADAS */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              Nº Comprobante
            </label>
            <input
              type="text"
              placeholder="0001-00012345"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              {...register("documentNumber")}
              className="w-full rounded-lg border border-slate-300 bg-slate-50/50 px-2.5 py-1.5 text-xs font-medium text-slate-800 transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              disabled={disabled || !canWrite}
            />
          </div>

          {/* Fecha Emisión */}
          <div>
            <label className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              <Calendar className="h-3 w-3 text-slate-400" />
              Fecha
            </label>
            <input
              type="date"
              {...register("issueDate")}
              className="w-full rounded-lg border border-slate-300 bg-slate-50/50 px-2.5 py-1.5 text-xs font-medium text-slate-800 transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              disabled={disabled || !canWrite}
            />
          </div>
        </div>

        {/* Fila secundaria: Medio de pago y Observaciones */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              <CreditCard className="h-3 w-3 text-slate-400" />
              Medio de Pago
            </label>
            <select
              {...register("paymentMethod")}
              className="w-full rounded-lg border border-slate-300 bg-slate-50/50 px-2.5 py-1.5 text-xs font-medium text-slate-800 transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              disabled={disabled || !canWrite}
            >
              <option value="cash">Efectivo (Impacta Caja Diaria)</option>
              <option value="transfer">Transferencia Bancaria</option>
              <option value="card_debit">Tarjeta de Débito</option>
              <option value="card_credit">Tarjeta de Crédito</option>
              <option value="current_account">Cuenta Corriente Proveedor</option>
              <option value="other">Otro</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              <StickyNote className="h-3 w-3 text-slate-400" />
              Observaciones / Notas (Opcional)
            </label>
            <input
              type="text"
              placeholder="Notas breves sobre la compra o entrega..."
              {...register("notes")}
              className="w-full rounded-lg border border-slate-300 bg-slate-50/50 px-2.5 py-1.5 text-xs text-slate-800 transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
              disabled={disabled || !canWrite}
            />
            {errors.notes ? <p className="mt-0.5 text-[11px] text-red-600">{errors.notes.message}</p> : null}
          </div>
        </div>
      </form>
    </section>
  );
};


