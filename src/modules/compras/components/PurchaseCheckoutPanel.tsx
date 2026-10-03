import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Calendar,
  Check,
  ChevronDown,
  FileText,
  Plus,
  Search,
  User,
  StickyNote,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Supplier } from "@/types/entities";
import {
  purchaseHeaderSchema,
  type PurchaseHeaderValues,
} from "@/modules/compras/schemas/purchase-checkout.schema";

interface PurchaseCheckoutPanelProps {
  suppliers: Supplier[];
  canWrite: boolean;
  disabled?: boolean;
  preferredSupplierId?: string;
  formId?: string;
  resetSignal?: number;
  vatPercent: number;
  onVatPercentChange: (vat: number) => void;
  iibbPercent: number;
  iibbAmount: number;
  onCreateSupplier: (initialName?: string) => void;
  onSubmit: (values: PurchaseHeaderValues) => Promise<boolean | void> | boolean | void;
}

const getTodayDate = () => new Date().toISOString().split("T")[0];

export const PurchaseCheckoutPanel = ({
  suppliers,
  canWrite,
  disabled,
  preferredSupplierId,
  formId = "purchase-checkout-form",
  resetSignal,
  vatPercent,
  onVatPercentChange,
  iibbPercent,
  iibbAmount,
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
  } = useForm<PurchaseHeaderValues>({
    resolver: zodResolver(purchaseHeaderSchema),
    defaultValues: {
      supplierId: "",
      documentType: "FACTURA_A",
      documentNumber: "",
      issueDate: getTodayDate(),
      vatPercent: vatPercent || 21,
      iibbPercent: iibbPercent || 0,
      iibbAmount: iibbAmount || 0,
      notes: "",
    },
  });

  const selectedSupplierId = watch("supplierId");
  const selectedDocumentType = watch("documentType");
  const [supplierSearchText, setSupplierSearchText] = useState("");
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  const supplierBoxRef = useRef<HTMLDivElement>(null);

  // Encontrar el proveedor actualmente seleccionado en la lista real
  const currentSelectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === selectedSupplierId) ?? null,
    [suppliers, selectedSupplierId]
  );

  // Sincronizar texto de búsqueda cuando cambia el proveedor
  useEffect(() => {
    if (currentSelectedSupplier) {
      setSupplierSearchText(currentSelectedSupplier.name);
    } else if (!selectedSupplierId) {
      setSupplierSearchText("");
    }
  }, [currentSelectedSupplier, selectedSupplierId]);

  useEffect(() => {
    if (preferredSupplierId) {
      setValue("supplierId", preferredSupplierId, { shouldValidate: true });
      const supplier = suppliers.find((s) => s.id === preferredSupplierId);
      if (supplier) {
        setSupplierSearchText(supplier.name);
      }
      setIsSupplierDropdownOpen(false);
    }
  }, [preferredSupplierId, setValue, suppliers]);

  // Click outside para cerrar dropdown de proveedores
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (supplierBoxRef.current && !supplierBoxRef.current.contains(event.target as Node)) {
        setIsSupplierDropdownOpen(false);
        if (currentSelectedSupplier) {
          setSupplierSearchText(currentSelectedSupplier.name);
        } else {
          setSupplierSearchText("");
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [currentSelectedSupplier]);

  // Filtrado reactivo de proveedores
  const filteredSuppliers = useMemo(() => {
    const q = supplierSearchText.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.code && s.code.toLowerCase().includes(q)) ||
        (s.tax_id && s.tax_id.includes(q))
    );
  }, [suppliers, supplierSearchText]);

  // Sugerencia automática de IVA al cambiar tipo de comprobante (sólo reacciona a cambio de tipo, no a edición de porcentaje)
  const prevDocTypeRef = useRef<string>(selectedDocumentType);

  useEffect(() => {
    if (prevDocTypeRef.current !== selectedDocumentType) {
      prevDocTypeRef.current = selectedDocumentType;
      if (selectedDocumentType === "FACTURA_A") {
        setValue("vatPercent", 21);
        onVatPercentChange(21);
      } else if (
        selectedDocumentType === "FACTURA_C" ||
        selectedDocumentType === "REMITO" ||
        selectedDocumentType === "PRESUPUESTO"
      ) {
        setValue("vatPercent", 0);
        onVatPercentChange(0);
      }
    }
  }, [selectedDocumentType, setValue, onVatPercentChange]);

  const handleSelectSupplier = (supplier: Supplier) => {
    setValue("supplierId", supplier.id, { shouldValidate: true });
    setSupplierSearchText(supplier.name);
    setIsSupplierDropdownOpen(false);
  };

  const handleClearSupplier = () => {
    setValue("supplierId", "", { shouldValidate: true });
    setSupplierSearchText("");
    setIsSupplierDropdownOpen(true);
  };

  // Auto-link si el usuario tipea el nombre exacto de un proveedor existente
  const handleSearchChange = (text: string) => {
    setSupplierSearchText(text);
    setIsSupplierDropdownOpen(true);

    if (!text.trim()) {
      setValue("supplierId", "", { shouldValidate: true });
      return;
    }

    const exactMatch = suppliers.find(
      (s) => s.name.trim().toLowerCase() === text.trim().toLowerCase()
    );
    if (exactMatch) {
      setValue("supplierId", exactMatch.id, { shouldValidate: true });
    } else if (selectedSupplierId && text.trim() !== currentSelectedSupplier?.name.trim()) {
      // Si el texto ya no coincide con el seleccionado, desvincular el ID anterior para evitar enviar datos incorrectos
      setValue("supplierId", "", { shouldValidate: true });
    }
  };

  useEffect(() => {
    if (resetSignal) {
      reset({
        supplierId: "",
        documentType: "FACTURA_A",
        documentNumber: "",
        issueDate: getTodayDate(),
        vatPercent: 21,
        iibbPercent: 0,
        iibbAmount: 0,
        notes: "",
      });
      setSupplierSearchText("");
      onVatPercentChange(21);
    }
  }, [resetSignal, reset, onVatPercentChange]);

  const submit = async (values: PurchaseHeaderValues) => {
    // Validación estricta final de proveedor
    if (!values.supplierId || !suppliers.some((s) => s.id === values.supplierId)) {
      alert("Debes seleccionar un proveedor válido de la lista o crearlo antes de continuar.");
      return;
    }
    await onSubmit({
      ...values,
      vatPercent,
      iibbPercent,
      iibbAmount,
    });
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <FileText className="h-4 w-4 text-brand-600 dark:text-brand-400" />
          Datos de la compra y factura
        </h2>
        <span className="text-[11px] text-slate-400 dark:text-slate-500">
          Proveedor, comprobante y fecha de emisión
        </span>
      </div>

      <form id={formId} autoComplete="off" onSubmit={handleSubmit(submit)} className="space-y-3.5">
        {/* Input oculto para que react-hook-form valide supplierId */}
        <input type="hidden" {...register("supplierId")} />
        <input type="hidden" {...register("vatPercent", { valueAsNumber: true })} />
        <input type="hidden" {...register("iibbPercent", { valueAsNumber: true })} />
        <input type="hidden" {...register("iibbAmount", { valueAsNumber: true })} />

        {/* Grid principal de datos */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Proveedor con Selector Inteligente y Touch-friendly */}
          <div className="relative sm:col-span-2 lg:col-span-2" ref={supplierBoxRef}>
            <div className="mb-1 flex items-center justify-between">
              <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                <User className="h-3 w-3 text-slate-400" />
                Proveedor *
              </label>
              <button
                type="button"
                className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-brand-600 hover:text-brand-700 hover:underline dark:text-brand-400 dark:hover:text-brand-300"
                onClick={() => onCreateSupplier(supplierSearchText.trim())}
                disabled={disabled || !canWrite}
              >
                <Plus className="h-3 w-3" />
                Nuevo
              </button>
            </div>

            {/* Si ya hay un proveedor seleccionado, mostrar tarjeta de confirmación visual */}
            {currentSelectedSupplier ? (
              <div className="flex items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50/90 p-2 dark:border-emerald-800 dark:bg-emerald-950/40">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 truncate">
                    <p className="text-xs font-bold text-emerald-950 dark:text-emerald-200 truncate">
                      {currentSelectedSupplier.name}
                    </p>
                    {currentSelectedSupplier.tax_id ? (
                      <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                        CUIT: {currentSelectedSupplier.tax_id}
                      </p>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearSupplier}
                  disabled={disabled || !canWrite}
                  className="shrink-0 rounded px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
                  <Search className="h-3.5 w-3.5" />
                </div>
                <input
                  type="text"
                  autoComplete="off"
                  placeholder="Toca para buscar o elegir proveedor..."
                  value={supplierSearchText}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => setIsSupplierDropdownOpen(true)}
                  disabled={disabled || !canWrite}
                  className={`w-full rounded-lg border py-2.5 pl-8 pr-10 text-xs font-medium transition focus:outline-none focus:ring-1 ${
                    errors.supplierId
                      ? "border-red-400 bg-red-50/30 text-slate-800 dark:border-red-500 dark:bg-red-950/20 dark:text-slate-100"
                      : "border-slate-300 bg-white text-slate-800 focus:border-brand-500 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-brand-400"
                  }`}
                />

                <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">
                  <button
                    type="button"
                    onClick={() => setIsSupplierDropdownOpen((prev) => !prev)}
                    disabled={disabled || !canWrite}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Menú desplegable con coincidencias en tiempo real optimizado para móvil */}
            {isSupplierDropdownOpen && !currentSelectedSupplier && (
              <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                {filteredSuppliers.length === 0 ? (
                  <div className="p-3 text-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No se encontró ningún proveedor con "{supplierSearchText}"
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSupplierDropdownOpen(false);
                        onCreateSupplier(supplierSearchText.trim());
                      }}
                      className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-700 dark:bg-brand-500"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Crear y asociar este proveedor
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Toca un proveedor para seleccionarlo:
                    </div>
                    {filteredSuppliers.map((supplier) => (
                      <button
                        key={supplier.id}
                        type="button"
                        onClick={() => handleSelectSupplier(supplier)}
                        className="flex min-h-[44px] w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition hover:bg-slate-100 active:bg-slate-200 dark:text-slate-100 dark:hover:bg-slate-800 dark:active:bg-slate-700"
                      >
                        <div className="min-w-0 flex-1 truncate">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {supplier.name}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-400">
                            {supplier.tax_id ? `CUIT: ${supplier.tax_id}` : "Sin CUIT"}
                            {supplier.code ? ` • Cód: ${supplier.code}` : ""}
                          </p>
                        </div>
                        <span className="shrink-0 rounded bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          Elegir
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {errors.supplierId && !currentSelectedSupplier ? (
              <p className="mt-1 text-[11px] font-medium text-red-600 dark:text-red-400">
                ⚠️ {errors.supplierId.message}
              </p>
            ) : null}
          </div>

          {/* Tipo de Comprobante */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Comprobante
            </label>
            <select
              {...register("documentType")}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2.5 text-xs font-medium text-slate-800 transition focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:focus:border-brand-400"
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

          {/* Nº Comprobante */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Nº Comprobante
            </label>
            <input
              type="text"
              placeholder="0001-00012345"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              {...register("documentNumber")}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 transition focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-brand-400"
              disabled={disabled || !canWrite}
            />
          </div>

          {/* Fecha Emisión */}
          <div>
            <label className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              <Calendar className="h-3 w-3 text-slate-400" />
              Fecha
            </label>
            <input
              type="date"
              {...register("issueDate")}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 transition focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:focus:border-brand-400"
              disabled={disabled || !canWrite}
            />
          </div>
        </div>



        {/* Fila: Observaciones */}
        <div>
          <label className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            <StickyNote className="h-3 w-3 text-slate-400" />
            Observaciones / Notas de la factura (Opcional)
          </label>
          <input
            type="text"
            placeholder="Notas sobre remito, vencimiento o entrega..."
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
            {...register("notes")}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800 transition focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-brand-400"
            disabled={disabled || !canWrite}
          />
          {errors.notes ? (
            <p className="mt-0.5 text-[11px] text-red-600 dark:text-red-400">{errors.notes.message}</p>
          ) : null}
        </div>
      </form>
    </section>
  );
};
