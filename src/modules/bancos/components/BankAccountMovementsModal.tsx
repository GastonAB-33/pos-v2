import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  FileText,
  Plus,
  Minus,
  Search,
  Wallet,
  X,
} from "lucide-react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { LoadingState } from "@/components/ui/UiStates";
import { useToast } from "@/components/ui/useToast";
import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  bankAccountMovementsService,
  type BankAccountBalanceSummary,
} from "@/services/bank-account-movements.service";
import type {
  BankAccount,
  BankAccountMovement,
  BankAccountMovementOriginType,
} from "@/types/entities";

interface BankAccountMovementsModalProps {
  account: BankAccount | null;
  onClose: () => void;
  canWrite: boolean;
  onBalanceUpdated?: () => void;
}

const COMMON_EXPENSE_CONCEPTS = [
  "Pago de Luz / Electricidad",
  "Pago de Internet / Teléfono",
  "Pago de Gas",
  "Pago de Alquiler",
  "Pago de Impuestos / Tasas / Monotributo",
  "Pago a Proveedor",
  "Mantenimiento / Comisiones Bancarias",
  "Sueldos / Anticipos de Personal",
  "Retiro de Fondos / Dueño",
  "Otro Gasto",
];

const COMMON_INCOME_CONCEPTS = [
  "Aporte de Capital / Dueño",
  "Depósito en Efectivo",
  "Devolución / Reintegro",
  "Cobro de Venta / Mostrador",
  "Transferencia de Tercero",
  "Otro Ingreso",
];

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

const formatCurrency = (val: number) => currencyFormatter.format(val);

const formatDateTime = (iso?: string | null) => {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

const getOriginLabel = (origin: BankAccountMovementOriginType): string => {
  switch (origin) {
    case "pos_sale":
      return "Venta POS";
    case "supplier_payment":
      return "Pago Compra Proveedor";
    case "customer_collection":
      return "Cobranza Cliente";
    case "service_expense":
      return "Pago de Servicio";
    case "manual_income":
      return "Ingreso Manual";
    case "manual_expense":
      return "Egreso Manual";
    case "account_transfer":
      return "Transf. entre cuentas";
    default:
      return origin;
  }
};

export const BankAccountMovementsModal = ({
  account,
  onClose,
  canWrite,
  onBalanceUpdated,
}: BankAccountMovementsModalProps) => {
  const toast = useToast();
  const user = useAuthStore((state) => state.user);

  const [movements, setMovements] = useState<BankAccountMovement[]>([]);
  const [summary, setSummary] = useState<BankAccountBalanceSummary>({
    currentBalance: 0,
    totalIncome: 0,
    totalExpense: 0,
    totalMovements: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");

  // Submodal para registrar nuevo movimiento
  const [formModalOpen, setFormModalOpen] = useState<"income" | "expense" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [movementForm, setMovementForm] = useState({
    presetConcept: "",
    customConcept: "",
    amount: "",
    voucherNumber: "",
    notes: "",
  });

  const loadData = useCallback(async () => {
    if (!account?.tenant_id || !account?.id) return;
    setIsLoading(true);
    try {
      const [movs, summ] = await Promise.all([
        bankAccountMovementsService.getByBankAccount(account.tenant_id, account.id),
        bankAccountMovementsService.getBalanceByBankAccount(account.tenant_id, account.id),
      ]);
      setMovements(movs);
      setSummary(summ);
    } catch (err) {
      console.error("Error al cargar movimientos de cuenta bancaria:", err);
      toast.error("No se pudieron cargar los movimientos de la cuenta.");
    } finally {
      setIsLoading(false);
    }
  }, [account?.id, account?.tenant_id, toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openFormModal = (type: "income" | "expense") => {
    setFormModalOpen(type);
    setMovementForm({
      presetConcept: type === "expense" ? COMMON_EXPENSE_CONCEPTS[0] : COMMON_INCOME_CONCEPTS[0],
      customConcept: "",
      amount: "",
      voucherNumber: "",
      notes: "",
    });
  };

  const handleSaveMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account?.tenant_id || !account?.id || !formModalOpen) return;

    const parsedAmount = parseFloat(movementForm.amount.replace(",", "."));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Ingresá un monto válido mayor a 0.");
      return;
    }

    const effectiveConcept =
      movementForm.presetConcept === "Otro Gasto" ||
      movementForm.presetConcept === "Otro Ingreso" ||
      !movementForm.presetConcept
        ? movementForm.customConcept.trim()
        : movementForm.presetConcept;

    if (!effectiveConcept) {
      toast.error("Ingresá o seleccioná un concepto para el movimiento.");
      return;
    }

    setIsSubmitting(true);
    try {
      const originType: BankAccountMovementOriginType =
        formModalOpen === "income"
          ? "manual_income"
          : effectiveConcept.toLowerCase().includes("luz") ||
            effectiveConcept.toLowerCase().includes("internet") ||
            effectiveConcept.toLowerCase().includes("gas") ||
            effectiveConcept.toLowerCase().includes("alquiler") ||
            effectiveConcept.toLowerCase().includes("impuesto")
          ? "service_expense"
          : "manual_expense";

      await bankAccountMovementsService.createMovement(account.tenant_id, {
        bank_account_id: account.id,
        type: formModalOpen,
        origin_type: originType,
        concept: effectiveConcept,
        amount: parsedAmount,
        voucher_number: movementForm.voucherNumber.trim() || null,
        notes: movementForm.notes.trim() || null,
        created_by: user?.id ?? null,
      });

      toast.success(
        formModalOpen === "income"
          ? `Ingreso de ${formatCurrency(parsedAmount)} registrado.`
          : `Egreso de ${formatCurrency(parsedAmount)} registrado.`
      );

      setFormModalOpen(null);
      await loadData();
      if (onBalanceUpdated) onBalanceUpdated();
    } catch (err) {
      console.error("Error al registrar movimiento:", err);
      toast.error("Error al registrar el movimiento en la cuenta bancaria.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      if (filterType !== "all" && m.type !== filterType) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const matchConcept = (m.concept || "").toLowerCase().includes(q);
      const matchVoucher = (m.voucher_number || "").toLowerCase().includes(q);
      const matchNotes = (m.notes || "").toLowerCase().includes(q);
      const matchOrigin = getOriginLabel(m.origin_type).toLowerCase().includes(q);
      return matchConcept || matchVoucher || matchNotes || matchOrigin;
    });
  }, [movements, filterType, searchQuery]);

  if (!account) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-4 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {account.bank_name}
                </h2>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {account.account_type.replace("_", " ")}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Titular: {account.holder_name}
                {account.alias ? ` • Alias: ${account.alias}` : ""}
                {account.cbu ? ` • CBU/CVU: ${account.cbu}` : ""}
              </p>
            </div>
          </div>

          <ModalCloseButton onClick={onClose} label="Cerrar ventana" />
        </div>

        {/* Tarjetas KPI de Saldo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50/40 dark:bg-slate-950/20 border-b border-slate-200 dark:border-slate-800">
          {/* Saldo Actual */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 dark:border-blue-900/60 dark:bg-blue-950/40 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                Saldo Disponible
              </span>
              <p className="text-xl font-mono font-black text-blue-950 dark:text-blue-100 mt-0.5">
                {formatCurrency(summary.currentBalance)}
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Wallet className="h-4 w-4" />
            </div>
          </div>

          {/* Total Ingresos */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-900/60 dark:bg-emerald-950/40 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Total Ingresos
              </span>
              <p className="text-lg font-mono font-black text-emerald-900 dark:text-emerald-100 mt-0.5">
                +{formatCurrency(summary.totalIncome)}
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
              <ArrowDownRight className="h-4 w-4" />
            </div>
          </div>

          {/* Total Egresos */}
          <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 dark:border-rose-900/60 dark:bg-rose-950/40 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                Total Egresos
              </span>
              <p className="text-lg font-mono font-black text-rose-900 dark:text-rose-100 mt-0.5">
                -{formatCurrency(summary.totalExpense)}
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Barra de Acciones y Filtros */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900">
          {/* Búsqueda y Filtros de tipo */}
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por concepto o comprobante..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setFilterType("all")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                  filterType === "all"
                    ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                Todos ({movements.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType("income")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                  filterType === "income"
                    ? "bg-white text-emerald-800 shadow-2xs dark:bg-slate-700 dark:text-emerald-300"
                    : "text-slate-600 dark:text-slate-400 hover:text-emerald-700"
                }`}
              >
                Ingresos
              </button>
              <button
                type="button"
                onClick={() => setFilterType("expense")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                  filterType === "expense"
                    ? "bg-white text-rose-800 shadow-2xs dark:bg-slate-700 dark:text-rose-300"
                    : "text-slate-600 dark:text-slate-400 hover:text-rose-700"
                }`}
              >
                Egresos
              </button>
            </div>
          </div>

          {/* Botones de Registro Rápido */}
          {canWrite && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openFormModal("income")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 shadow-xs transition"
              >
                <Plus size={14} className="stroke-[3]" />
                Registrar Ingreso
              </button>
              <button
                type="button"
                onClick={() => openFormModal("expense")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3 py-1.5 shadow-xs transition"
              >
                <Minus size={14} className="stroke-[3]" />
                Registrar Egreso
              </button>
            </div>
          )}
        </div>

        {/* Tabla de Movimientos */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="p-8">
              <LoadingState message="Cargando movimientos bancarios..." />
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Sin movimientos registrados
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {searchQuery
                  ? "No hay movimientos que coincidan con la búsqueda."
                  : "Los cobros del POS, pagos a proveedores y registros manuales aparecerán aquí."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-2.5 px-3">Fecha y Hora</th>
                    <th className="py-2.5 px-3">Concepto</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">Origen</th>
                    <th className="py-2.5 px-3">Comprobante</th>
                    <th className="py-2.5 px-3 text-right">Monto</th>
                    <th className="py-2.5 px-3 text-right">Saldo Resultante</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredMovements.map((mov) => {
                    const isIncome = mov.type === "income";
                    return (
                      <tr
                        key={mov.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {formatDateTime(mov.created_at)}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                          {mov.concept}
                          {mov.notes && (
                            <p className="text-[10px] text-slate-400 font-normal">{mov.notes}</p>
                          )}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              isIncome
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            }`}
                          >
                            {isIncome ? (
                              <ArrowDownRight size={10} className="stroke-[3]" />
                            ) : (
                              <ArrowUpRight size={10} className="stroke-[3]" />
                            )}
                            {isIncome ? "Ingreso" : "Egreso"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {getOriginLabel(mov.origin_type)}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                          {mov.voucher_number || "-"}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap ${
                            isIncome
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {isIncome ? "+" : "-"}
                          {formatCurrency(mov.amount)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {formatCurrency(mov.balance_after)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal de Registro de Movimiento */}
        {formModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="relative w-full max-w-md rounded-xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      formModalOpen === "income"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {formModalOpen === "income" ? (
                      <ArrowDownRight size={18} />
                    ) : (
                      <ArrowUpRight size={18} />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {formModalOpen === "income"
                        ? "Registrar Ingreso Bancario"
                        : "Registrar Egreso Bancario / Pago"}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Cuenta: {account.bank_name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormModalOpen(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveMovement} className="space-y-3">
                {/* Concepto Preset */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Concepto / Motivo
                  </label>
                  <select
                    value={movementForm.presetConcept}
                    onChange={(e) =>
                      setMovementForm((curr) => ({ ...curr, presetConcept: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    {(formModalOpen === "income"
                      ? COMMON_INCOME_CONCEPTS
                      : COMMON_EXPENSE_CONCEPTS
                    ).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Concepto Personalizado (si elige Otro o quiere especificar) */}
                {(movementForm.presetConcept === "Otro Gasto" ||
                  movementForm.presetConcept === "Otro Ingreso" ||
                  movementForm.presetConcept === "Pago de Luz / Electricidad" ||
                  movementForm.presetConcept === "Pago de Internet / Teléfono") && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Detalle adicional (ej: Empresa, Factura, Mes)
                    </label>
                    <input
                      type="text"
                      value={movementForm.customConcept}
                      onChange={(e) =>
                        setMovementForm((curr) => ({ ...curr, customConcept: e.target.value }))
                      }
                      placeholder="Ej: Edesur Factura 98412 - Mes Septiembre"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                {/* Monto */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Monto ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-slate-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={movementForm.amount}
                      onChange={(e) =>
                        setMovementForm((curr) => ({ ...curr, amount: e.target.value }))
                      }
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2 text-sm font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Nº Comprobante */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nº de Comprobante / Referencia (opcional)
                  </label>
                  <input
                    type="text"
                    value={movementForm.voucherNumber}
                    onChange={(e) =>
                      setMovementForm((curr) => ({ ...curr, voucherNumber: e.target.value }))
                    }
                    placeholder="Ej: Transf. #849102"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Notas */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Observaciones (opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={movementForm.notes}
                    onChange={(e) =>
                      setMovementForm((curr) => ({ ...curr, notes: e.target.value }))
                    }
                    placeholder="Anotaciones internas..."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setFormModalOpen(null)}
                    disabled={isSubmitting}
                    className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`px-4 py-2 rounded-lg text-xs font-bold text-white transition ${
                      formModalOpen === "income"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : "bg-rose-600 hover:bg-rose-700"
                    }`}
                  >
                    {isSubmitting ? "Guardando..." : "Confirmar Movimiento"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
