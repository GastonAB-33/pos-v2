import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Receipt as ReceiptIcon,
  RotateCcw,
  Search,
  ShoppingBag,
  Sliders,
  User,
  UserCheck,
  X,
} from "lucide-react";
import type { BankAccount, CashMovement, Invoice, PaymentMethod, Sale } from "@/types/entities";
import { formatLocalTime } from "@/modules/caja/utils/cash-date.utils";

interface CashMovementsTableProps {
  movements: CashMovement[];
  bankAccounts?: BankAccount[];
  saleBankAccountsById?: Record<string, string>;
  paymentMethods?: PaymentMethod[];
  usersById?: Record<string, string>;
  saleNumbersById?: Record<string, string>;
  salesById?: Record<string, Sale>;
  invoicesBySaleId?: Record<string, Invoice[]>;
  onViewSaleDocument?: (saleId: string, preferredTab?: "ticket" | "invoice") => void;
  blindMode?: boolean;
}

const columnHelper = createColumnHelper<CashMovement>();

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const referenceTypeLabels: Record<string, string> = {
  cash: "Efectivo",
  card_debit: "Tarjeta de débito",
  card_credit: "Tarjeta de crédito",
  transfer: "Transferencia bancaria",
  mercado_pago: "Mercado Pago",
  cheque: "Cheque",
  current_account: "Cuenta corriente",
  manual_income: "Ingreso manual",
  manual_expense: "Egreso manual",
  current_account_payment: "Pago cuenta corriente",
  current_account_adjustment: "Ajuste cuenta corriente",
  purchase: "Pago a proveedores",
  purchase_payment: "Pago a proveedores",
  supplier_payment: "Pago a proveedores",
};

export type MovementCategory =
  | "pos_sale"
  | "manual"
  | "current_account"
  | "purchase"
  | "adjustment"
  | "other";

const getMovementCategory = (movement: CashMovement): MovementCategory => {
  if (movement.movement_type === "sale_payment") return "pos_sale";
  if (movement.movement_type === "adjustment") return "adjustment";

  const ref = (movement.reference_type || "").toLowerCase().trim();
  const notes = (movement.notes || "").toLowerCase();

  if (
    ref === "current_account_payment" ||
    ref === "current_account_adjustment" ||
    notes.includes("cuenta corriente") ||
    notes.includes("cta. cte.") ||
    notes.includes("cobro deuda") ||
    notes.includes("cancelación de deuda")
  ) {
    return "current_account";
  }

  if (
    ref === "purchase" ||
    ref === "purchase_payment" ||
    ref === "supplier_payment" ||
    notes.includes("proveedor") ||
    notes.includes("compra")
  ) {
    return "purchase";
  }

  if (
    ref === "manual_income" ||
    ref === "manual_expense" ||
    movement.movement_type === "income" ||
    movement.movement_type === "expense"
  ) {
    return "manual";
  }

  return "other";
};

interface PaymentMethodInfo {
  code: string;
  label: string;
  bankAccountId?: string;
  bankAccountName?: string;
  bankAccountHolder?: string;
  fullBankLabel?: string;
}

const getPaymentMethodInfo = (
  movement: CashMovement,
  saleBankAccountsById: Record<string, string>,
  bankAccounts: BankAccount[]
): PaymentMethodInfo => {
  const ref = (movement.reference_type || "").toLowerCase().trim();
  const notes = (movement.notes || "").toLowerCase();

  // Transferencia bancaria
  if (ref === "transfer" || notes.includes("transferencia")) {
    const saleId = movement.reference_id;
    const bankAccountId = saleId
      ? saleBankAccountsById[`${saleId}_transfer`] || saleBankAccountsById[saleId]
      : undefined;

    let bankAccount: BankAccount | undefined;
    if (movement.reference_id && bankAccounts.some((b) => b.id === movement.reference_id)) {
      bankAccount = bankAccounts.find((b) => b.id === movement.reference_id);
    } else if (bankAccountId) {
      bankAccount = bankAccounts.find((b) => b.id === bankAccountId);
    } else {
      bankAccount = bankAccounts.find(
        (b) =>
          notes.includes(b.bank_name.toLowerCase()) ||
          (b.holder_name && notes.includes(b.holder_name.toLowerCase()))
      );
    }

    if (bankAccount) {
      const holderPart = bankAccount.holder_name ? ` (${bankAccount.holder_name})` : "";
      return {
        code: "transfer",
        label: "Transferencia bancaria",
        bankAccountId: bankAccount.id,
        bankAccountName: bankAccount.bank_name,
        bankAccountHolder: bankAccount.holder_name || undefined,
        fullBankLabel: `Transferencia ${bankAccount.bank_name}${holderPart}`,
      };
    }

    return {
      code: "transfer",
      label: "Transferencia bancaria",
    };
  }

  if (ref === "cash" || ref === "manual_expense" || notes.includes("efectivo")) {
    return { code: "cash", label: "Efectivo" };
  }

  if (ref === "card_debit" || notes.includes("débito") || notes.includes("debito")) {
    return { code: "card_debit", label: "Tarjeta de débito" };
  }

  if (ref === "card_credit" || notes.includes("crédito") || notes.includes("credito")) {
    return { code: "card_credit", label: "Tarjeta de crédito" };
  }

  if (ref === "mercado_pago" || notes.includes("mercado pago") || notes.includes("mp")) {
    return { code: "mercado_pago", label: "Mercado Pago" };
  }

  if (ref === "cheque" || notes.includes("cheque")) {
    return { code: "cheque", label: "Cheque" };
  }

  if (ref === "current_account" || notes.includes("cuenta corriente") || notes.includes("cta. cte.")) {
    return { code: "current_account", label: "Cuenta corriente" };
  }

  return { code: ref || "other", label: referenceTypeLabels[ref] || ref || "Otro" };
};

const formatReference = (
  movement: CashMovement,
  saleNumbersById: Record<string, string>,
  paymentInfo: PaymentMethodInfo
): { title: string; subtitle?: string; bankBadge?: string } => {
  const saleNumber = movement.reference_id ? saleNumbersById[movement.reference_id] : null;
  const shortId =
    movement.reference_id && movement.reference_id.length > 12
      ? `${movement.reference_id.slice(0, 8)}...`
      : movement.reference_id;

  const baseLabel = paymentInfo.fullBankLabel || paymentInfo.label || movement.reference_type;
  const refDisplay = saleNumber ? `#${saleNumber}` : shortId ? `#${shortId}` : "";
  const title = refDisplay ? `${baseLabel} · ${refDisplay}` : baseLabel;

  let bankBadge: string | undefined;
  if (paymentInfo.bankAccountName) {
    const holderPart = paymentInfo.bankAccountHolder ? ` · ${paymentInfo.bankAccountHolder}` : "";
    bankBadge = `${paymentInfo.bankAccountName}${holderPart}`;
  }

  return {
    title,
    subtitle: movement.notes || undefined,
    bankBadge,
  };
};

const getSignedAmount = (movement: CashMovement): number => {
  const amount = Math.abs(movement.amount);
  if (movement.movement_type === "expense") return -amount;
  if (movement.movement_type === "adjustment" && movement.amount < 0) return -amount;
  return amount;
};

export const CashMovementsTable = ({
  movements,
  bankAccounts = [],
  saleBankAccountsById = {},
  usersById = {},
  saleNumbersById = {},
  salesById = {},
  invoicesBySaleId = {},
  onViewSaleDocument,
  blindMode = false,
}: CashMovementsTableProps) => {
  // Estados para filtros interactivos
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("date_desc");
  const [openDocDropdownSaleId, setOpenDocDropdownSaleId] = useState<string | null>(null);

  // Estado de ordenamiento de TanStack Table
  const [sorting, setSorting] = useState<SortingState>([
    { id: "created_at", desc: true },
  ]);

  // Sincronizar selector "Ordenar por" con el estado de ordenamiento de la tabla
  const handleSortChange = (value: string) => {
    setSortBy(value);
    switch (value) {
      case "date_desc":
        setSorting([{ id: "created_at", desc: true }]);
        break;
      case "date_asc":
        setSorting([{ id: "created_at", desc: false }]);
        break;
      case "amount_desc":
        setSorting([{ id: "amount", desc: true }]);
        break;
      case "amount_asc":
        setSorting([{ id: "amount", desc: false }]);
        break;
      case "type_asc":
        setSorting([{ id: "movement_type", desc: false }]);
        break;
      case "reference_asc":
        setSorting([{ id: "reference", desc: false }]);
        break;
    }
  };

  // Restablecer todos los filtros
  const handleResetFilters = () => {
    setMovementTypeFilter("all");
    setPaymentMethodFilter("all");
    setSearchQuery("");
    setSortBy("date_desc");
    setSorting([{ id: "created_at", desc: true }]);
  };

  const isFiltered =
    movementTypeFilter !== "all" ||
    paymentMethodFilter !== "all" ||
    searchQuery.trim() !== "" ||
    sortBy !== "date_desc";

  // Opciones de Medios de Pago (desglosando bancos habilitados)
  const availablePaymentMethodOptions = useMemo(() => {
    const options: { value: string; label: string; isBank?: boolean }[] = [
      { value: "all", label: "Todos los medios" },
      { value: "cash", label: "Efectivo" },
    ];

    if (bankAccounts.length > 0) {
      options.push({ value: "all_transfers", label: "Transferencias (Todas)" });
      for (const b of bankAccounts) {
        const holderPart = b.holder_name ? ` (${b.holder_name})` : "";
        options.push({
          value: `bank_acc_${b.id}`,
          label: `Transferencia ${b.bank_name}${holderPart}`,
          isBank: true,
        });
      }
    } else {
      options.push({ value: "transfer", label: "Transferencias" });
    }

    options.push(
      { value: "card_debit", label: "Tarjeta de débito" },
      { value: "card_credit", label: "Tarjeta de crédito" },
      { value: "cheque", label: "Cheque" },
      { value: "current_account", label: "Cuenta corriente" }
    );

    return options;
  }, [bankAccounts]);

  // Filtrado de movimientos
  const filteredMovements = useMemo(() => {
    let result = movements;

    // 1. Tipo de movimiento
    if (movementTypeFilter !== "all") {
      result = result.filter((m) => getMovementCategory(m) === movementTypeFilter);
    }

    // 2. Medio de pago / cuenta
    if (paymentMethodFilter !== "all") {
      result = result.filter((m) => {
        const pm = getPaymentMethodInfo(m, saleBankAccountsById, bankAccounts);
        if (paymentMethodFilter === "all_transfers") {
          return pm.code === "transfer";
        }
        if (paymentMethodFilter.startsWith("bank_acc_")) {
          const targetBankId = paymentMethodFilter.replace("bank_acc_", "");
          return pm.code === "transfer" && pm.bankAccountId === targetBankId;
        }
        return pm.code === paymentMethodFilter;
      });
    }

    // 3. Búsqueda de texto
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((m) => {
        const saleNumber = m.reference_id ? (saleNumbersById[m.reference_id] || "").toLowerCase() : "";
        const notes = (m.notes || "").toLowerCase();
        const userName = m.created_by ? (usersById[m.created_by] || "").toLowerCase() : "";
        const refType = (m.reference_type || "").toLowerCase();
        const amountStr = Math.abs(m.amount).toString();
        const pm = getPaymentMethodInfo(m, saleBankAccountsById, bankAccounts);
        const bankName = (pm.bankAccountName || "").toLowerCase();
        const holderName = (pm.bankAccountHolder || "").toLowerCase();

        return (
          saleNumber.includes(q) ||
          notes.includes(q) ||
          userName.includes(q) ||
          refType.includes(q) ||
          amountStr.includes(q) ||
          bankName.includes(q) ||
          holderName.includes(q)
        );
      });
    }

    return result;
  }, [
    movements,
    movementTypeFilter,
    paymentMethodFilter,
    searchQuery,
    saleBankAccountsById,
    bankAccounts,
    saleNumbersById,
    usersById,
  ]);

  // Cálculos de resumen en tiempo real para el resultado filtrado
  const summary = useMemo(() => {
    let incomesTotal = 0;
    let expensesTotal = 0;

    for (const m of filteredMovements) {
      const signed = getSignedAmount(m);
      if (signed > 0) {
        incomesTotal += signed;
      } else {
        expensesTotal += Math.abs(signed);
      }
    }

    return {
      count: filteredMovements.length,
      incomesTotal: Number(incomesTotal.toFixed(2)),
      expensesTotal: Number(expensesTotal.toFixed(2)),
      netTotal: Number((incomesTotal - expensesTotal).toFixed(2)),
    };
  }, [filteredMovements]);

  // Definición de columnas de la tabla con TanStack
  const columns = useMemo(
    () => [
      columnHelper.accessor("created_at", {
        id: "created_at",
        header: ({ column }) => (
          <div
            className="flex items-center gap-1 cursor-pointer select-none group"
            onClick={column.getToggleSortingHandler()}
            title="Clic para ordenar por hora"
          >
            <span>Hora</span>
            {column.getIsSorted() === "asc" ? (
              <ArrowUp size={12} className="text-blue-500" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown size={12} className="text-blue-500" />
            ) : (
              <ArrowUpDown size={11} className="opacity-40 group-hover:opacity-100 transition text-slate-400" />
            )}
          </div>
        ),
        cell: (info) => {
          const rawDate = info.getValue();
          return (
            <span
              className="whitespace-nowrap text-slate-600 dark:text-slate-300 font-mono text-[11px] font-semibold"
              title={new Date(rawDate).toLocaleString("es-AR")}
            >
              {formatLocalTime(rawDate)} hs
            </span>
          );
        },
      }),
      columnHelper.accessor((row) => getMovementCategory(row), {
        id: "movement_type",
        header: ({ column }) => (
          <div
            className="flex items-center gap-1 cursor-pointer select-none group"
            onClick={column.getToggleSortingHandler()}
            title="Clic para ordenar por tipo"
          >
            <span>Tipo</span>
            {column.getIsSorted() === "asc" ? (
              <ArrowUp size={12} className="text-blue-500" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown size={12} className="text-blue-500" />
            ) : (
              <ArrowUpDown size={11} className="opacity-40 group-hover:opacity-100 transition text-slate-400" />
            )}
          </div>
        ),
        cell: (info) => {
          const movement = info.row.original;
          const category = getMovementCategory(movement);

          if (category === "pos_sale") {
            return (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 whitespace-nowrap shadow-2xs">
                <ReceiptIcon className="h-3 w-3" /> Cobro venta
              </span>
            );
          }
          if (category === "current_account") {
            return (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 whitespace-nowrap shadow-2xs">
                <UserCheck className="h-3 w-3" /> Pago cta. cte.
              </span>
            );
          }
          if (category === "purchase") {
            return (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-200/80 dark:border-orange-800/80 whitespace-nowrap shadow-2xs">
                <ShoppingBag className="h-3 w-3" /> Pago proveedor
              </span>
            );
          }
          if (category === "manual") {
            const isExp = movement.movement_type === "expense";
            return isExp ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/80 whitespace-nowrap shadow-2xs">
                <ArrowUpRight className="h-3 w-3" /> Egreso manual
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 whitespace-nowrap shadow-2xs">
                <ArrowDownLeft className="h-3 w-3" /> Ingreso manual
              </span>
            );
          }
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80 whitespace-nowrap shadow-2xs">
              <Sliders className="h-3 w-3" /> Ajuste
            </span>
          );
        },
      }),
      columnHelper.accessor(
        (row) => {
          const pm = getPaymentMethodInfo(row, saleBankAccountsById, bankAccounts);
          return pm.fullBankLabel || pm.label || row.reference_type;
        },
        {
          id: "reference",
          header: ({ column }) => (
            <div
              className="flex items-center gap-1 cursor-pointer select-none group"
              onClick={column.getToggleSortingHandler()}
              title="Clic para ordenar por origen o medio"
            >
              <span>Origen / Medio</span>
              {column.getIsSorted() === "asc" ? (
                <ArrowUp size={12} className="text-blue-500" />
              ) : column.getIsSorted() === "desc" ? (
                <ArrowDown size={12} className="text-blue-500" />
              ) : (
                <ArrowUpDown size={11} className="opacity-40 group-hover:opacity-100 transition text-slate-400" />
              )}
            </div>
          ),
          cell: (info) => {
            const movement = info.row.original;
            const pm = getPaymentMethodInfo(movement, saleBankAccountsById, bankAccounts);
            const { title, subtitle, bankBadge } = formatReference(
              movement,
              saleNumbersById,
              pm
            );

            return (
              <div className="font-medium text-slate-800 dark:text-slate-100">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span>{title}</span>
                  {bankBadge && (
                    <span
                      className="rounded bg-sky-100 dark:bg-sky-950/80 border border-sky-300 dark:border-sky-800 px-1.5 py-0.2 text-[9px] font-bold text-sky-800 dark:text-sky-300 font-mono"
                      title="Cuenta bancaria destino registrada"
                    >
                      {bankBadge}
                    </span>
                  )}
                </div>
                {subtitle && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-normal mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>
            );
          },
        }
      ),
      columnHelper.accessor("created_by", {
        header: ({ column }) => (
          <div
            className="flex items-center gap-1 cursor-pointer select-none group"
            onClick={column.getToggleSortingHandler()}
            title="Clic para ordenar por usuario"
          >
            <span>Usuario</span>
            {column.getIsSorted() === "asc" ? (
              <ArrowUp size={12} className="text-blue-500" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown size={12} className="text-blue-500" />
            ) : (
              <ArrowUpDown size={11} className="opacity-40 group-hover:opacity-100 transition text-slate-400" />
            )}
          </div>
        ),
        cell: (info) => {
          const userId = info.getValue();
          if (!userId) return <span className="text-slate-400 dark:text-slate-500">Sistema</span>;
          const name = usersById[userId] ?? userId;
          return (
            <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300 whitespace-nowrap">
              <User className="h-3 w-3 text-slate-400 dark:text-slate-500" />
              <span>{name}</span>
            </div>
          );
        },
      }),
      columnHelper.accessor((row) => getSignedAmount(row), {
        id: "amount",
        header: ({ column }) => (
          <div
            className="flex items-center justify-end gap-1 cursor-pointer select-none group"
            onClick={column.getToggleSortingHandler()}
            title="Clic para ordenar por importe"
          >
            <span>Importe</span>
            {column.getIsSorted() === "asc" ? (
              <ArrowUp size={12} className="text-blue-500" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown size={12} className="text-blue-500" />
            ) : (
              <ArrowUpDown size={11} className="opacity-40 group-hover:opacity-100 transition text-slate-400" />
            )}
          </div>
        ),
        cell: (info) => {
          if (blindMode) {
            return (
              <div className="text-right font-bold font-mono whitespace-nowrap text-xs text-slate-400 dark:text-slate-500">
                $ ••••••
              </div>
            );
          }
          const signedAmount = info.getValue() as number;
          const isNegative = signedAmount < 0;
          return (
            <div
              className={`text-right font-bold font-mono whitespace-nowrap text-sm ${
                isNegative
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {isNegative ? "-" : "+"} {currency.format(Math.abs(signedAmount))}
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "actions",
        header: () => <div className="text-right">Comprobante</div>,
        cell: (info) => {
          const movement = info.row.original;
          if (movement.movement_type !== "sale_payment" || !movement.reference_id) {
            return <div className="text-right text-slate-400 dark:text-slate-600">-</div>;
          }
          const saleId = movement.reference_id;
          const hasInvoice =
            Boolean(invoicesBySaleId?.[saleId]?.length) ||
            Boolean(salesById?.[saleId]?.arca_document_id);

          if (!hasInvoice) {
            return (
              <div className="text-right">
                <button
                  type="button"
                  className="h-6 inline-flex items-center gap-1 px-2 text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
                  onClick={() => onViewSaleDocument?.(saleId, "ticket")}
                  title="Ver ticket de venta"
                >
                  <ReceiptIcon className="h-3 w-3 text-slate-400" />
                  <span>Ticket</span>
                </button>
              </div>
            );
          }

          const isDropdownOpen = openDocDropdownSaleId === saleId;

          return (
            <div className="relative inline-block text-right">
              <button
                type="button"
                onClick={() => setOpenDocDropdownSaleId(isDropdownOpen ? null : saleId)}
                className="h-6 inline-flex items-center gap-1 px-2 text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-300 dark:border-blue-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
                title="Seleccionar comprobante fiscal o ticket"
              >
                <FileText className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                <span>Factura</span>
                <ChevronDown
                  size={11}
                  className={`transition-transform duration-150 ${isDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setOpenDocDropdownSaleId(null)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-40 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 text-xs animate-in fade-in zoom-in-95 text-left">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenDocDropdownSaleId(null);
                        onViewSaleDocument?.(saleId, "invoice");
                      }}
                      className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-600 dark:hover:text-blue-300 font-semibold cursor-pointer"
                    >
                      <FileText size={13} className="text-blue-500" />
                      <span>Factura</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenDocDropdownSaleId(null);
                        onViewSaleDocument?.(saleId, "ticket");
                      }}
                      className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                    >
                      <ReceiptIcon size={13} className="text-slate-400" />
                      <span>Ticket</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        },
      }),
    ],
    [bankAccounts, blindMode, onViewSaleDocument, saleBankAccountsById, saleNumbersById, usersById, salesById, invoicesBySaleId, openDocDropdownSaleId]
  );

  const table = useReactTable({
    data: filteredMovements,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
        pageIndex: 0,
      },
    },
  });

  return (
    <div className="space-y-3">
      {/* BARRA MINIMALISTA Y COMPACTA DE FILTROS, BÚSQUEDA Y TOTALES (1 SOLA FILA) */}
      <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 p-1.5 px-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 shadow-2xs text-xs">
        {/* Controles de filtro compactos */}
        <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
          {/* Búsqueda rápida */}
          <div className="relative w-32 sm:w-40 focus-within:w-48 transition-all shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              className="w-full h-7 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 pl-7 pr-5 outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                title="Limpiar búsqueda"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Filtro: Tipo de Movimiento */}
          <select
            value={movementTypeFilter}
            onChange={(e) => setMovementTypeFilter(e.target.value)}
            className="h-7 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 px-2 outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition cursor-pointer font-medium"
            title="Filtrar por tipo"
          >
            <option value="all">Todos los tipos</option>
            <option value="pos_sale">Ventas POS</option>
            <option value="manual">Manuales</option>
            <option value="current_account">Cta. Cte.</option>
            <option value="purchase">Proveedores</option>
            <option value="adjustment">Ajustes</option>
          </select>

          {/* Filtro: Medio / Cuenta Bancaria */}
          <select
            value={paymentMethodFilter}
            onChange={(e) => setPaymentMethodFilter(e.target.value)}
            className="h-7 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 px-2 outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition cursor-pointer font-medium max-w-[130px] sm:max-w-[160px] truncate"
            title="Filtrar por medio"
          >
            {availablePaymentMethodOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Selector Ordenar */}
          <select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value)}
            className="h-7 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 px-2 outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition cursor-pointer font-medium"
            title="Ordenar"
          >
            <option value="date_desc">Más recientes</option>
            <option value="date_asc">Más antiguos</option>
            <option value="amount_desc">Mayor importe</option>
            <option value="amount_asc">Menor importe</option>
          </select>

          {/* Botón Restablecer si hay filtro activo */}
          {isFiltered && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="h-7 inline-flex items-center gap-1 px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-semibold transition cursor-pointer shadow-2xs"
              title="Restablecer filtros"
            >
              <RotateCcw size={11} />
              <span>Limpiar</span>
            </button>
          )}
        </div>

        {/* Lado Derecho: Totales y métricas compactas inline */}
        <div className="flex items-center gap-2.5 font-mono shrink-0 text-xs text-slate-500 dark:text-slate-400 ml-auto whitespace-nowrap">
          <span className="text-[11px] font-sans">
            {summary.count} {summary.count === 1 ? "mov." : "movs."}
          </span>
          {summary.count > 0 && !blindMode && (
            <div className="flex items-center gap-2 font-bold text-xs">
              <span className="text-emerald-600 dark:text-emerald-400" title="Ingresos">
                +{currency.format(summary.incomesTotal)}
              </span>
              {summary.expensesTotal > 0 && (
                <span className="text-rose-600 dark:text-rose-400" title="Egresos">
                  -{currency.format(summary.expensesTotal)}
                </span>
              )}
              <span className="text-slate-800 dark:text-slate-200 pl-2 border-l border-slate-300 dark:border-slate-700 font-black" title="Balance neto">
                Neto: {currency.format(summary.netTotal)}
              </span>
            </div>
          )}
          {summary.count > 0 && blindMode && (
            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
              Montos protegidos
            </span>
          )}
        </div>
      </div>

      {/* TABLA PRINCIPAL */}
      {!filteredMovements.length ? (
        <div className="p-8 text-center bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
          <ReceiptIcon className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            No se encontraron movimientos para el filtro seleccionado
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
            Intenta cambiar o limpiar los filtros de tipo de movimiento o medio de pago.
          </p>
          {isFiltered && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              <RotateCcw size={12} />
              Restablecer filtros
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="max-h-[58vh] overflow-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="py-2.5 px-3">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900/60">
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="py-2.5 px-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Barra de Paginación (10 movimientos por página) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 pt-3 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span>
              Mostrando{" "}
              <strong className="text-slate-900 dark:text-slate-100">
                {filteredMovements.length === 0 ? 0 : table.getState().pagination.pageIndex * 10 + 1}
              </strong>{" "}
              a{" "}
              <strong className="text-slate-900 dark:text-slate-100">
                {Math.min((table.getState().pagination.pageIndex + 1) * 10, filteredMovements.length)}
              </strong>{" "}
              de{" "}
              <strong className="text-slate-900 dark:text-slate-100">{filteredMovements.length}</strong> movimientos
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              title="Primera página"
            >
              «
            </button>
            <button
              type="button"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Anterior
            </button>
            <span className="px-2 font-medium">
              Página {table.getPageCount() === 0 ? 1 : table.getState().pagination.pageIndex + 1} de {Math.max(1, table.getPageCount())}
            </span>
            <button
              type="button"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              Siguiente <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              title="Última página"
            >
              »
            </button>
          </div>
        </div>
        </div>
      )}
    </div>
  );
};
