import { useState, useEffect } from "react";
import {
  ArrowLeft,
  DollarSign,
  PlusCircle,
  RefreshCw,
  User,
  ShoppingBag,
  FileText,
  Calendar,
} from "lucide-react";
import type { Employee, EmployeeCurrentAccountCategory, PaymentMethod, BankAccount, EmployeeCurrentAccountMovement } from "@/types/entities";
import { useEmployeeCurrentAccount } from "@/modules/empleados/hooks/useEmployeeCurrentAccount";
import { EmployeeManualMovementModal } from "@/modules/empleados/components/EmployeeManualMovementModal";
import { EmployeeProductConsumptionModal } from "@/modules/empleados/components/EmployeeProductConsumptionModal";
import { EmployeeSmartDebtModal } from "@/modules/empleados/components/EmployeeSmartDebtModal";
import { EmployeeSmartPaymentModal } from "@/modules/empleados/components/EmployeeSmartPaymentModal";
import { paymentMethodsService } from "@/services/payment-methods.service";
import { bankAccountsService } from "@/services/bank-accounts.service";
import { salesService } from "@/services/sales.service";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { formatDisplaySaleNumber, formatDisplayReceiptNumber } from "@/utils/voucher-format.utils";

export interface EmployeeTicketItem {
  product_name: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  line_total: number;
  no_discount?: boolean;
}

export interface EmployeeTicketDetail {
  items: EmployeeTicketItem[];
  subtotal?: number | null;
  discountAmount?: number | null;
  discountPercent?: number | null;
  total?: number | null;
  customNotes?: string | null;
  saleNumber?: string | null;
  receiptNumber?: string | null;
}

function parseArNumber(val: string): number {
  if (!val) return 0;
  val = val.trim();
  if (val.includes(",") && val.includes(".")) {
    return parseFloat(val.replace(/\./g, "").replace(",", "."));
  }
  if (val.includes(",")) {
    return parseFloat(val.replace(",", "."));
  }
  return parseFloat(val);
}

function parseEmployeeTicket(notes: string | null | undefined, fallbackAmount = 0): EmployeeTicketDetail | null {
  if (!notes) return null;

  // 1. Verificar si tiene JSON embebido estructurado
  const jsonMatch = notes.match(/(?:<!--\s*TICKET_JSON:|\s*\[TICKET_JSON:)\s*(.*?)(?:\s*-->|\s*\])/s);
  if (jsonMatch && jsonMatch[1]) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      return {
        items: parsed.items || [],
        subtotal: parsed.subtotal != null ? parsed.subtotal : null,
        discountAmount: parsed.discountAmount != null ? parsed.discountAmount : null,
        discountPercent: parsed.discountPercent != null ? parsed.discountPercent : null,
        total: parsed.total != null ? parsed.total : fallbackAmount,
        customNotes: parsed.customNotes || null,
      };
    } catch {}
  }

  // 2. Parser inteligente de notas históricas ("Retiro de mercadería: ...")
  if (!notes.includes("Retiro de mercader")) return null;

  const normalized = notes.replace(/[▪•]/g, "•");
  const [itemsPart, ...restParts] = normalized.split("•");
  const cleanItemsStr = itemsPart.replace(/^Retiro de mercader[íi]a:\s*/i, "").trim();

  const itemRegex = /([\d.,]+)\s*(kg|x|u\.?)\s+([^()]+)\s+\(\$\s*([\d.,]+)(?:\s*\[([^\]]+)\])?\)/gi;
  const items: EmployeeTicketItem[] = [];
  let m;
  while ((m = itemRegex.exec(cleanItemsStr)) !== null) {
    const qty = parseArNumber(m[1]);
    const unit = m[2].toLowerCase();
    const name = m[3].trim();
    const lineTotal = parseArNumber(m[4]);
    const unitPrice = qty > 0 ? Number((lineTotal / qty).toFixed(2)) : lineTotal;
    items.push({
      product_name: name,
      quantity: qty,
      unit,
      unit_price: unitPrice,
      line_total: lineTotal,
      no_discount: !!m[5],
    });
  }

  if (items.length === 0) return null;

  let subtotal: number | null = null;
  let discountAmount: number | null = null;
  let discountPercent: number | null = null;
  let total: number | null = fallbackAmount || null;
  let customNotes: string | null = null;

  for (const part of restParts) {
    const p = part.trim();
    if (p.startsWith("Subtotal:")) {
      const matchSub = p.match(/Subtotal:\s*\$\s*([\d.,]+)/i);
      if (matchSub) subtotal = parseArNumber(matchSub[1]);
    } else if (p.startsWith("Descuento")) {
      const matchDisc = p.match(/Descuento\s*(?:\(([\d.,]+)%\))?:\s*-?\$\s*([\d.,]+)/i);
      if (matchDisc) {
        discountPercent = matchDisc[1] ? parseArNumber(matchDisc[1]) : null;
        discountAmount = parseArNumber(matchDisc[2]);
      }
    } else if (p.startsWith("Total adeudado:")) {
      const matchTot = p.match(/Total adeudado:\s*\$\s*([\d.,]+)/i);
      if (matchTot) total = parseArNumber(matchTot[1]);
    } else if (p.startsWith("Nota:")) {
      customNotes = p.replace(/^Nota:\s*/i, "").trim();
    }
  }

  return {
    items,
    subtotal: subtotal || (discountAmount ? (total || fallbackAmount) + discountAmount : null),
    discountAmount,
    discountPercent,
    total: total || fallbackAmount,
    customNotes,
  };
}

interface EmployeeCurrentAccountPanelProps {
  tenantId: string;
  userId: string | null;
  employee: Employee;
  canWrite: boolean;
  onClose?: () => void;
  hideBackButton?: boolean;
  hideHeaderBanner?: boolean;
  hideActions?: boolean;
  onBalanceUpdated: () => void;
  onOpenSalaryDisbursement?: (employee: Employee) => void;
  usersById?: Record<string, string>;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const categoryLabels: Record<EmployeeCurrentAccountCategory, { label: string; color: string }> = {
  product_purchase: {
    label: "Retiro Productos",
    color: "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900",
  },
  salary_deduction: {
    label: "Descuento Sueldo",
    color: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  },
  advance: {
    label: "Anticipo / Vale",
    color: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  },
  cash_payment: {
    label: "Pago Directo",
    color: "bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900",
  },
  adjustment: {
    label: "Ajuste",
    color: "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  },
  other: {
    label: "Otro",
    color: "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  },
};

export const EmployeeCurrentAccountPanel = ({
  tenantId,
  userId,
  employee,
  canWrite,
  onClose,
  hideBackButton = false,
  hideHeaderBanner = false,
  hideActions = false,
  onBalanceUpdated,
  onOpenSalaryDisbursement: _onOpenSalaryDisbursement,
  usersById = {},
}: EmployeeCurrentAccountPanelProps) => {
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualType, setManualType] = useState<"debt" | "payment" | "adjustment">("debt");
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [smartDebtOpen, setSmartDebtOpen] = useState(false);
  const [smartPaymentOpen, setSmartPaymentOpen] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<{
    movement: EmployeeCurrentAccountMovement;
    ticket: EmployeeTicketDetail;
  } | null>(null);
  const [salesById, setSalesById] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!tenantId) return;
    Promise.all([
      paymentMethodsService.getActiveByTenant(tenantId).catch(() => []),
      bankAccountsService.getActiveByTenant(tenantId).catch(() => []),
    ]).then(([m, a]) => {
      setPaymentMethods(m);
      setBankAccounts(a);
    });
  }, [tenantId]);

  const {
    movements,
    balance,
    isSubmitting,
    feedback,
    registerDebt,
    registerPayment,
    registerAdjustment,
  } = useEmployeeCurrentAccount(tenantId, employee, userId);

  useEffect(() => {
    if (!tenantId || movements.length === 0) return;
    const saleIds = Array.from(new Set(movements.map((m) => m.sale_id).filter(Boolean))) as string[];
    if (saleIds.length === 0) return;

    salesService.getByIds(tenantId, saleIds).then((sales) => {
      const map: Record<string, any> = {};
      sales.forEach((s) => {
        map[s.id] = s;
      });
      setSalesById(map);
    }).catch(() => {});
  }, [tenantId, movements]);

  const getMovementTicket = (mov: EmployeeCurrentAccountMovement): EmployeeTicketDetail | null => {
    if (mov.sale_id && salesById[mov.sale_id]) {
      const s = salesById[mov.sale_id];
      return {
        items: (s.items || []).map((it: any) => ({
          product_name: it.product_name,
          quantity: it.quantity,
          unit: "u",
          unit_price: it.unit_price,
          line_total: it.subtotal,
        })),
        total: s.total,
        saleNumber: s.sale_number,
        receiptNumber: s.receipt_number,
        customNotes: s.notes || null,
      };
    }
    return parseEmployeeTicket(mov.notes, mov.amount);
  };

  const hasDebt = balance > 0;
  const hasCredit = balance < 0;

  const handleManualSubmit = async (values: {
    amount: number;
    notes: string;
    category?: EmployeeCurrentAccountCategory;
  }) => {
    let ok = false;
    if (manualType === "debt") {
      ok = await registerDebt(values);
    } else if (manualType === "payment") {
      ok = await registerPayment(values);
    } else {
      ok = await registerAdjustment(values);
    }
    if (ok) {
      onBalanceUpdated();
    }
    return ok;
  };

  const handleProductSubmit = async (values: {
    amount: number;
    notes: string;
    category: "product_purchase";
  }) => {
    const ok = await registerDebt(values);
    if (ok) {
      onBalanceUpdated();
    }
    return ok;
  };

  return (
    <section className="current-account-detail space-y-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs">
      {/* Barra de navegación superior si no está en ficha integrada */}
      {!hideBackButton && onClose && (
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Volver al listado de cuentas corrientes</span>
          </button>
        </div>
      )}

      {/* Encabezado y Saldo Destacado (se oculta si está embebido en Ficha del empleado para no duplicar datos) */}
      {!hideHeaderBanner && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 font-black text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 text-lg border border-indigo-200/70 dark:border-indigo-800/60 shadow-xs">
              {employee.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                  {employee.full_name}
                </h3>
                <span className="font-mono text-xs font-semibold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                  {employee.code}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Puesto: <span className="font-semibold text-slate-700 dark:text-slate-300">{employee.position || "Empleado"}</span> • Sueldo Base:{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-300">{currency.format(employee.base_salary)}</span>
                {employee.phone ? ` • Tel: ${employee.phone}` : ""}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block font-bold">
              Saldo Adeudado por el Empleado
            </span>
            <span
              className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                hasDebt
                  ? "text-rose-600 dark:text-rose-400"
                  : hasCredit
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {currency.format(balance)}
            </span>
            {employee.current_account_limit ? (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                Límite de crédito pactado: {currency.format(employee.current_account_limit)}
              </p>
            ) : null}
          </div>
        </div>
      )}

      {feedback && (
        <div
          className={`rounded-2xl p-4 text-sm font-medium ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Acciones principales de la Cuenta Corriente */}
      {canWrite && !hideActions && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          {/* Botón Registrar Deuda en Cuenta Corriente (Rojo) */}
          <button
            type="button"
            onClick={() => setSmartDebtOpen(true)}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-2xl shadow-xs transition dark:border-rose-800/80 dark:bg-rose-950/40 dark:text-rose-300 cursor-pointer active:scale-[0.98]"
            title="Registrar deuda directa en cuenta corriente sin escanear productos"
          >
            <PlusCircle size={16} />
            <span>Registrar deuda en cuenta corriente</span>
          </button>

          {/* Botón Retiro de Productos */}
          <button
            type="button"
            onClick={() => setProductModalOpen(true)}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-xs transition dark:bg-indigo-600 dark:hover:bg-indigo-500 cursor-pointer active:scale-[0.98]"
          >
            <ShoppingBag size={16} />
            <span>Retirar Mercadería</span>
          </button>

          {/* Botón Registrar Pago en Cuenta Corriente (Verde) */}
          <button
            type="button"
            onClick={() => setSmartPaymentOpen(true)}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-2xl shadow-xs transition dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 cursor-pointer active:scale-[0.98]"
            title="Registrar pago inteligente con efectivo, bancos, alias y cálculo de vuelto"
          >
            <DollarSign size={16} />
            <span>Registrar pago en cuenta corriente</span>
          </button>

          {/* Botón Ajuste */}
          <button
            type="button"
            onClick={() => {
              setManualType("adjustment");
              setManualModalOpen(true);
            }}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 px-4 py-2 text-xs sm:text-sm font-semibold shadow-xs transition ml-auto cursor-pointer active:scale-[0.98]"
          >
            <RefreshCw size={14} />
            <span>Ajuste</span>
          </button>
        </div>
      )}

      {/* Tabla de Movimientos Históricos de la Cuenta Corriente */}
      <div className="overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200/90 bg-slate-50/90 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/70 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Historial de Movimientos de Cuenta Corriente
          </h4>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
            {movements.length} movimientos registrados
          </span>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200/90 bg-slate-50/70 font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
            <tr>
              <th className="py-2.5 px-3 whitespace-nowrap">Fecha y Hora</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Operación</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Categoría</th>
              <th className="py-2.5 px-3 text-center whitespace-nowrap">Ticket</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Registrado por</th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap">Importe</th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap">Saldo Posterior</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
            {movements.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-slate-500 dark:text-slate-400 font-medium">
                  No hay movimientos registrados para este empleado.
                </td>
              </tr>
            ) : (
              movements.map((mov) => {
                const isDebt = mov.type === "debt";
                const isPayment = mov.type === "payment";
                const catInfo = categoryLabels[mov.category] || categoryLabels.other;
                const ticketData = getMovementTicket(mov);
                const plainNote = mov.notes ? mov.notes.replace(/<!--.*?-->/g, "").trim() : "";

                return (
                  <tr
                    key={mov.id}
                    className="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                  >
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {new Date(mov.created_at).toLocaleString("es-AR")}
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          isDebt
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            : isPayment
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                        }`}
                      >
                        {isDebt ? "Deuda" : isPayment ? "Pago" : "Ajuste"}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${catInfo.color}`}
                      >
                        {catInfo.label}
                      </span>
                    </td>

                    {/* Columna Ticket con botón Ver ticket o nota si no tiene ticket */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {ticketData ? (
                        <button
                          type="button"
                          onClick={() => setSelectedTicket({ movement: mov, ticket: ticketData })}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-all cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 active:scale-95"
                          title="Ver detalle del comprobante de retiro de mercadería"
                        >
                          <FileText size={13} className="text-blue-600 dark:text-blue-400" />
                          <span>Ver ticket</span>
                        </button>
                      ) : plainNote ? (
                        <span className="text-slate-600 dark:text-slate-300 text-xs truncate max-w-[140px] inline-block" title={plainNote}>
                          {plainNote}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-xs whitespace-nowrap">
                      {mov.created_by ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                          <User size={13} className="text-slate-400 shrink-0" />
                          <span className="truncate max-w-[130px]" title={usersById[mov.created_by] || mov.created_by}>
                            {usersById[mov.created_by] || mov.created_by}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    <td
                      className={`py-2.5 px-3 text-right font-bold font-mono whitespace-nowrap ${
                        isDebt
                          ? "text-rose-600 dark:text-rose-400"
                          : isPayment
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-blue-600 dark:text-blue-400"
                      }`}
                    >
                      {isDebt ? "+" : isPayment ? "-" : ""}
                      {currency.format(mov.amount)}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {currency.format(mov.balance_after)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {manualModalOpen && (
        <EmployeeManualMovementModal
          open={manualModalOpen}
          employee={employee}
          initialType={manualType}
          onClose={() => setManualModalOpen(false)}
          onSubmit={handleManualSubmit}
        />
      )}

      {smartDebtOpen && (
        <EmployeeSmartDebtModal
          open={smartDebtOpen}
          tenantId={tenantId}
          userId={userId}
          employee={employee}
          onClose={() => setSmartDebtOpen(false)}
          onSuccess={async () => {
            onBalanceUpdated();
          }}
        />
      )}

      {smartPaymentOpen && (
        <EmployeeSmartPaymentModal
          open={smartPaymentOpen}
          tenantId={tenantId}
          userId={userId}
          employee={employee}
          paymentMethods={paymentMethods}
          bankAccounts={bankAccounts}
          onClose={() => setSmartPaymentOpen(false)}
          onSuccess={async () => {
            onBalanceUpdated();
          }}
        />
      )}

      {productModalOpen && (
        <EmployeeProductConsumptionModal
          open={productModalOpen}
          tenantId={tenantId}
          employee={employee}
          onClose={() => setProductModalOpen(false)}
          onSubmit={handleProductSubmit}
        />
      )}

      {/* Modal Emergente de Ticket (Idéntico a Cuenta Corriente Clientes) */}
      {selectedTicket ? (
        <section className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative z-10 w-full max-w-2xl rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] flex flex-col">
            {/* Cabecera */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 pb-3 dark:border-slate-800 shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>Detalle de Ticket / Retiro de Mercadería</span>
                </h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                  <span>
                    Empleado: <strong className="text-slate-700 dark:text-slate-300">{employee.full_name} ({employee.code})</strong>
                  </span>
                  {selectedTicket.ticket.saleNumber && (
                    <span>
                      • Venta: <strong className="text-slate-700 dark:text-slate-300">{formatDisplaySaleNumber(selectedTicket.ticket.saleNumber)}</strong>
                    </span>
                  )}
                  {selectedTicket.ticket.receiptNumber && (
                    <span>
                      • Ticket: <strong className="text-slate-700 dark:text-slate-300">{formatDisplayReceiptNumber(selectedTicket.ticket.receiptNumber)}</strong>
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    {new Date(selectedTicket.movement.created_at).toLocaleString("es-AR")}
                  </span>
                </div>

                {/* Pago / Operación */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2.5 text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Operación:
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300">
                    <span className="text-indigo-600 dark:text-indigo-400">Retiro a Cuenta Corriente:</span>
                    <strong className="font-mono text-indigo-900 dark:text-indigo-100">
                      {currency.format(selectedTicket.movement.amount)}
                    </strong>
                  </span>
                </div>
              </div>
              <ModalCloseButton label="Cerrar ticket" onClick={() => setSelectedTicket(null)} />
            </div>

            {/* Contenido con scroll */}
            <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Productos del comprobante
              </p>
              <div className="overflow-x-auto rounded-xl border border-slate-200/90 dark:border-slate-800">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead className="bg-slate-50/90 dark:bg-slate-800/80 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200 border-b border-slate-200/80 dark:border-slate-800">
                    <tr>
                      <th className="px-3 py-2 text-left">Producto</th>
                      <th className="px-3 py-2 text-right">Cantidad</th>
                      <th className="px-3 py-2 text-right">Precio unitario</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                    {selectedTicket.ticket.items.map((item, idx) => (
                      <tr key={`${item.product_name}-${idx}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="px-3 py-2 font-medium">
                          {item.product_name}
                          {item.no_discount && (
                            <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold">[sin desc.]</span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-right">
                          {item.quantity.toLocaleString("es-AR")} {item.unit || ""}
                        </td>
                        <td className="px-3 py-2 font-mono text-right">{currency.format(item.unit_price)}</td>
                        <td className="px-3 py-2 font-bold font-mono text-right">{currency.format(item.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50/90 dark:bg-slate-800/80 border-t border-slate-200/90 dark:border-slate-800 font-bold">
                    {selectedTicket.ticket.discountAmount != null && selectedTicket.ticket.discountAmount > 0 && (
                      <>
                        <tr>
                          <td colSpan={3} className="px-3 py-1.5 text-right text-xs text-slate-500 dark:text-slate-400">
                            Subtotal bruto:
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-xs text-slate-700 dark:text-slate-300">
                            {currency.format(
                              selectedTicket.ticket.subtotal ||
                                selectedTicket.movement.amount + selectedTicket.ticket.discountAmount
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="px-3 py-1.5 text-right text-xs text-emerald-600 dark:text-emerald-400">
                            Descuento empleado
                            {selectedTicket.ticket.discountPercent
                              ? ` (${selectedTicket.ticket.discountPercent}%)`
                              : ""}
                            :
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                            -{currency.format(selectedTicket.ticket.discountAmount)}
                          </td>
                        </tr>
                      </>
                    )}
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-right text-xs uppercase text-slate-600 dark:text-slate-300">
                        Total Adeudado:
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-sm text-slate-900 dark:text-slate-100">
                        {currency.format(selectedTicket.ticket.total || selectedTicket.movement.amount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {selectedTicket.ticket.customNotes && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 italic pt-1">
                  Nota del ticket: {selectedTicket.ticket.customNotes}
                </p>
              )}
            </div>

            {/* Pie del modal */}
            <div className="flex justify-end pt-3 border-t border-slate-200/80 dark:border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="rounded-xl bg-slate-900 hover:bg-slate-800 px-5 py-2 text-xs font-semibold text-white dark:bg-slate-800 dark:hover:bg-slate-700 transition cursor-pointer active:scale-95"
              >
                Cerrar
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </section>
  );
};