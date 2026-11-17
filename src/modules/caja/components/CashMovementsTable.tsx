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
  SlidersHorizontal,
  User,
  UserCheck,
  X,
} from "lucide-react";
import type { BankAccount, CashMovement, Invoice, PaymentMethod, Sale } from "@/types/entities";
import { formatLocalTime } from "@/modules/caja/utils/cash-date.utils";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { cn } from "@/utils/cn";
import {
  formatDisplaySaleNumber,
  formatDisplayNotes,
} from "@/utils/voucher-format.utils";

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

export const renderMovementTypeBadge = (movement: CashMovement) => {
  const category = getMovementCategory(movement);

  if (category === "pos_sale") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 whitespace-nowrap shadow-2xs">
        <ReceiptIcon className="h-3 w-3" /> Cobro venta
      </span>
    );
  }
  if (category === "current_account") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 whitespace-nowrap shadow-2xs">
        <UserCheck className="h-3 w-3" /> Pago cta. cte.
      </span>
    );
  }
  if (category === "purchase") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-200/80 dark:border-orange-800/80 whitespace-nowrap shadow-2xs">
        <ShoppingBag className="h-3 w-3" /> Pago proveedor
      </span>
    );
  }
  if (category === "manual") {
    const isExp = movement.movement_type === "expense";
    return isExp ? (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/80 whitespace-nowrap shadow-2xs">
        <ArrowUpRight className="h-3 w-3" /> Egreso manual
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 whitespace-nowrap shadow-2xs">
        <ArrowDownLeft className="h-3 w-3" /> Ingreso manual
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80 whitespace-nowrap shadow-2xs">
      <Sliders className="h-3 w-3" /> Ajuste
    </span>
  );
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
  const formattedSaleNumber = saleNumber ? formatDisplaySaleNumber(saleNumber) : null;
  const refDisplay = formattedSaleNumber
    ? `#${formattedSaleNumber}`
    : shortId
    ? `#${shortId}`
    : "";
  const title = refDisplay ? `${baseLabel} · ${refDisplay}` : baseLabel;

  let bankBadge: string | undefined;
  if (paymentInfo.bankAccountName) {
    const holderPart = paymentInfo.bankAccountHolder ? ` · ${paymentInfo.bankAccountHolder}` : "";
    bankBadge = `${paymentInfo.bankAccountName}${holderPart}`;
  }

  return {
    title,
    subtitle: movement.notes ? formatDisplayNotes(movement.notes) : undefined,
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
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (movementTypeFilter !== "all") count++;
    if (paymentMethodFilter !== "all") count++;
    if (sortBy !== "date_desc") count++;
    return count;
  }, [movementTypeFilter, paymentMethodFilter, sortBy]);

  useBodyScrollLock(isAdvancedFiltersOpen);

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

  const renderSaleDocumentButton = (movement: CashMovement, isMobile = false) => {
    if (movement.movement_type !== "sale_payment" || !movement.reference_id) {
      return isMobile ? null : <div className="text-right text-slate-400 dark:text-slate-600">-</div>;
    }
    const saleId = movement.reference_id;
    const hasInvoice =
      Boolean(invoicesBySaleId?.[saleId]?.length) ||
      Boolean(salesById?.[saleId]?.arca_document_id);

    if (!hasInvoice) {
      return (
        <div className={isMobile ? "" : "text-right"}>
          <button
            type="button"
            className="h-7 inline-flex items-center gap-1 px-2.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
            onClick={() => onViewSaleDocument?.(saleId, "ticket")}
            title="Ver ticket de venta"
          >
            <ReceiptIcon className="h-3 w-3 text-slate-400" />
            <span>Ticket</span>
          </button>
        </div>
      );
    }

    const dropdownKey = isMobile ? `mob_${saleId}` : saleId;
    const isDropdownOpen = openDocDropdownSaleId === dropdownKey;

    return (
      <div className={`relative inline-block ${isMobile ? "" : "text-right"}`}>
        <button
          type="button"
          onClick={() => setOpenDocDropdownSaleId(isDropdownOpen ? null : dropdownKey)}
          className="h-7 inline-flex items-center gap-1 px-2.5 text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-300 dark:border-blue-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
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
            <div className="absolute right-0 bottom-full mb-1 sm:bottom-auto sm:top-full sm:mt-1 z-40 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 text-xs animate-in fade-in zoom-in-95 text-left">
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
        const rawSaleNumber = m.reference_id ? (saleNumbersById[m.reference_id] || "").toLowerCase() : "";
        const dispSaleNumber = rawSaleNumber ? formatDisplaySaleNumber(rawSaleNumber).toLowerCase() : "";
        const notes = (m.notes || "").toLowerCase();
        const dispNotes = notes ? formatDisplayNotes(notes).toLowerCase() : "";
        const userName = m.created_by ? (usersById[m.created_by] || "").toLowerCase() : "";
        const refType = (m.reference_type || "").toLowerCase();
        const amountStr = Math.abs(m.amount).toString();
        const pm = getPaymentMethodInfo(m, saleBankAccountsById, bankAccounts);
        const bankName = (pm.bankAccountName || "").toLowerCase();
        const holderName = (pm.bankAccountHolder || "").toLowerCase();

        return (
          rawSaleNumber.includes(q) ||
          dispSaleNumber.includes(q) ||
          notes.includes(q) ||
          dispNotes.includes(q) ||
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
        cell: (info) => renderMovementTypeBadge(info.row.original),
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
        cell: (info) => renderSaleDocumentButton(info.row.original, false),
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
    <div className="space-y-3 w-full max-w-full min-w-0 box-border">
      {/* BARRA ADAPTATIVA DE FILTROS, BÚSQUEDA Y TOTALES */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 p-2.5 sm:p-3 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs text-xs w-full max-w-full min-w-0 box-border overflow-hidden">
        {/* 1. VISTA MÓVIL (< md): Buscador full-width + Botón Filtros Avanzados único debajo */}
        <div className="flex md:hidden flex-col gap-2 w-full">
          {/* Buscador ancho completo */}
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar concepto, venta, usuario..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              className="w-full h-9 text-xs rounded-xl border border-slate-200/90 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 pl-8 pr-7 outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer rounded-full"
                title="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Botón único de Filtros Avanzados debajo del buscador */}
          <div className="flex items-center gap-2 w-full">
            <button
              type="button"
              onClick={() => setIsAdvancedFiltersOpen(true)}
              className={cn(
                "flex-1 h-9 flex items-center justify-center gap-2 rounded-xl border text-xs font-semibold transition cursor-pointer shadow-2xs",
                activeFiltersCount > 0
                  ? "border-blue-500/90 bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-bold"
                  : "border-slate-200/90 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <SlidersHorizontal
                size={14}
                className={activeFiltersCount > 0 ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"}
              />
              <span>Filtros avanzados</span>
              {activeFiltersCount > 0 && (
                <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {isFiltered && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="h-9 px-3 rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-semibold transition cursor-pointer shadow-2xs shrink-0 flex items-center gap-1.5"
                title="Restablecer filtros"
              >
                <RotateCcw size={12} />
                <span>Limpiar</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. VISTA DESKTOP (>= md): Controles de filtro compactos inline */}
        <div className="hidden md:flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
          {/* Búsqueda rápida */}
          <div className="relative w-44 focus-within:w-56 transition-all shrink-0">
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
              className="w-full h-8 text-xs rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/40 text-slate-900 dark:text-slate-100 pl-8 pr-6 outline-none focus:border-blue-500 dark:focus:border-blue-400 transition placeholder:text-slate-400"
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
            className="h-8 text-xs rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 px-2.5 outline-none focus:ring-2 focus:ring-blue-500/20 transition cursor-pointer font-medium"
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
            className="h-8 text-xs rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 px-2.5 outline-none focus:ring-2 focus:ring-blue-500/20 transition cursor-pointer font-medium max-w-[160px] truncate"
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
            className="h-8 text-xs rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 px-2.5 outline-none focus:ring-2 focus:ring-blue-500/20 transition cursor-pointer font-medium"
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
              className="h-8 inline-flex items-center gap-1.5 px-3 rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-semibold transition cursor-pointer shadow-2xs"
              title="Restablecer filtros"
            >
              <RotateCcw size={11} />
              <span>Limpiar</span>
            </button>
          )}
        </div>

        {/* Lado Derecho: Totales y métricas compactas inline */}
        <div className="flex flex-wrap items-center justify-between md:justify-end gap-2.5 font-mono shrink-0 text-xs text-slate-500 dark:text-slate-400 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800 whitespace-nowrap w-full md:w-auto">
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

      {/* LISTADO DE MOVIMIENTOS: DUAL VIEW (TARJETAS EN MÓVIL + TABLA EN DESKTOP) */}
      {!filteredMovements.length ? (
        <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
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
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer shadow-2xs"
            >
              <RotateCcw size={12} />
              Restablecer filtros
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* VISTA MÓVIL: Tarjetas fluidas (< md) */}
          <div className="md:hidden space-y-2.5">
            {table.getRowModel().rows.map((row) => {
              const movement = row.original;
              const pm = getPaymentMethodInfo(movement, saleBankAccountsById, bankAccounts);
              const { title, subtitle, bankBadge } = formatReference(movement, saleNumbersById, pm);
              const signedAmount = getSignedAmount(movement);
              const isNegative = signedAmount < 0;
              const userName = movement.created_by
                ? usersById[movement.created_by] ?? movement.created_by
                : "Sistema";

              return (
                <div
                  key={row.id}
                  className="p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2.5 w-full max-w-full min-w-0 box-border overflow-hidden"
                >
                  {/* Zona 1: Metadatos superiores (Hora + Usuario a la izquierda, Badge Tipo a la derecha) */}
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs min-w-0">
                      <span className="font-mono font-semibold shrink-0">
                        {formatLocalTime(movement.created_at)} hs
                      </span>
                      <span className="text-slate-300 dark:text-slate-600 shrink-0">·</span>
                      <div className="flex items-center gap-1 min-w-0 truncate">
                        <User className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="truncate text-[11px]">{userName}</span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {renderMovementTypeBadge(movement)}
                    </div>
                  </div>

                  {/* Zona 2: Identificador / Concepto + Badge Banco + Subtítulo */}
                  <div className="text-xs space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap font-bold text-slate-900 dark:text-slate-100 leading-snug">
                      <span className="break-words">{title}</span>
                      {bankBadge && (
                        <span className="rounded bg-sky-100 dark:bg-sky-950/80 border border-sky-300 dark:border-sky-800 px-1.5 py-0.2 text-[9px] font-bold text-sky-800 dark:text-sky-300 font-mono shrink-0">
                          {bankBadge}
                        </span>
                      )}
                    </div>
                    {subtitle && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed break-words">
                        {subtitle}
                      </p>
                    )}
                  </div>

                  {/* Zona 3: KPI Principal (Importe con micro-label) & Botón de Acción Comprobante */}
                  <div className="flex items-end justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 leading-none mb-1">
                        {isNegative ? "Egreso" : "Ingreso"}
                      </p>
                      {blindMode ? (
                        <span className="font-mono font-bold text-sm text-slate-400 dark:text-slate-500">
                          $ ••••••
                        </span>
                      ) : (
                        <p
                          className={`font-mono font-black text-base sm:text-lg leading-tight ${
                            isNegative
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {isNegative ? "-" : "+"} {currency.format(Math.abs(signedAmount))}
                        </p>
                      )}
                    </div>

                    {/* Botón Comprobante */}
                    <div className="shrink-0">
                      {renderSaleDocumentButton(movement, true)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* VISTA DESKTOP: Tabla con scroll horizontal interno (>= md) */}
          <div className="hidden md:block max-h-[58vh] overflow-auto rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50/90 dark:bg-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200/80 dark:border-slate-800">
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

          {/* Barra de Paginación Redondeada (10 movimientos por página) */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white px-4 py-2.5 shadow-xs dark:border-slate-800 dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-400">
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
                className="rounded-xl border border-slate-200/90 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
                title="Primera página"
              >
                «
              </button>
              <button
                type="button"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200/90 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
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
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200/90 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
              >
                Siguiente <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
                className="rounded-xl border border-slate-200/90 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
                title="Última página"
              >
                »
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL / BOTTOM SHEET DE FILTROS AVANZADOS (MÓVIL) */}
      {isAdvancedFiltersOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 overscroll-contain animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAdvancedFiltersOpen(false);
          }}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera */}
            <div className="shrink-0 px-4 sm:px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/60">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/80">
                  <SlidersHorizontal className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Filtros avanzados</span>
                    {activeFiltersCount > 0 && (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        {activeFiltersCount} activo{activeFiltersCount === 1 ? "" : "s"}
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Filtrar y ordenar movimientos de caja
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAdvancedFiltersOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Cerrar filtros"
              >
                <X size={16} />
              </button>
            </div>

            {/* Contenido / Opciones de Filtro */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4 text-xs">
              {/* 1. Tipo de Movimiento */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                  Tipo de movimiento u operación
                </label>
                <select
                  value={movementTypeFilter}
                  onChange={(e) => setMovementTypeFilter(e.target.value)}
                  className="w-full h-10 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100 px-3 outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                >
                  <option value="all">Todos los tipos</option>
                  <option value="pos_sale">Ventas POS (Mostrador)</option>
                  <option value="manual">Manuales (Ingresos / Egresos)</option>
                  <option value="current_account">Cta. Cte. (Cobros de clientes)</option>
                  <option value="purchase">Proveedores (Compras / Pagos)</option>
                  <option value="adjustment">Ajustes (Arqueos / Cuadres)</option>
                </select>
              </div>

              {/* 2. Medio de cobro / Cuenta Bancaria */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                  Medio de pago o cuenta bancaria
                </label>
                <select
                  value={paymentMethodFilter}
                  onChange={(e) => setPaymentMethodFilter(e.target.value)}
                  className="w-full h-10 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100 px-3 outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                >
                  {availablePaymentMethodOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Criterio de Orden */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                  Criterio de ordenación
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="w-full h-10 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100 px-3 outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                >
                  <option value="date_desc">Más recientes primero (predeterminado)</option>
                  <option value="date_asc">Más antiguos primero</option>
                  <option value="amount_desc">Mayor importe primero</option>
                  <option value="amount_asc">Menor importe primero</option>
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 px-4 py-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleResetFilters}
                disabled={!isFiltered}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Restablecer
              </button>
              <button
                type="button"
                onClick={() => setIsAdvancedFiltersOpen(false)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs text-center cursor-pointer"
              >
                Aplicar filtros
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
