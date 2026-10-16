import { useCallback, useEffect, useMemo, useState } from "react";
import { auditService } from "@/services/audit.service";
import { bankAccountsService } from "@/services/bank-accounts.service";
import { cashService } from "@/services/cash.service";
import { generalCashService } from "@/services/general-cash.service";
import { currentAccountsService } from "@/services/current-accounts.service";
import { customersService } from "@/services/customers.service";
import { paymentMethodsService } from "@/services/payment-methods.service";
import { salesService } from "@/services/sales.service";
import { settingsService } from "@/services/settings.service";
import { usersService } from "@/services/users.service";
import type {
  BankAccount,
  CashMovement,
  CashSession,
  CashSettings,
  CurrentAccountMovement,
  Customer,
  PaymentMethod,
  Sale,
  SalePayment,
} from "@/types/entities";
import type {
  CashMovementValues,
  CloseCashValues,
  OpenCashValues,
} from "@/modules/caja/schemas/cash.schemas";

type FeedbackType = "success" | "error";

interface CashFeedback {
  type: FeedbackType;
  message: string;
}

type CashMovementFilter = "all" | CashMovement["movement_type"];

export interface CashDailyTrackingRow {
  date: string;
  sessionsCount: number;
  openSessionsCount: number;
  openingAmount: number;
  incomes: number;
  expenses: number;
  expectedClosingAmount: number;
  realClosingAmount: number;
  differenceAmount: number;
  saleMovementsCount: number;
  manualMovementsCount: number;
}

export interface CashCloseSnapshot {
  billCounts?: Record<number, number>;
  coinsAmount?: number;
  expectedAmount?: number;
  expectedCashAmount?: number;
  expectedFullAmount?: number;
  realAmount?: number;
  difference?: number;
  reconciliationMode?: "cash_only" | "full";
  userNotes?: string;
}

export const serializeCloseSnapshot = (
  snapshot: CashCloseSnapshot,
  userNotes?: string | null
): string => {
  const json = JSON.stringify(snapshot);
  const cleanNotes = userNotes?.trim() || "";
  return `<!--SNAPSHOT:${json}-->${cleanNotes}`;
};

export const parseCloseSnapshot = (
  notes: string | null | undefined
): { snapshot: CashCloseSnapshot | null; cleanNotes: string } => {
  if (!notes) return { snapshot: null, cleanNotes: "" };
  const match = notes.match(/<!--SNAPSHOT:(.*?)-->([\s\S]*)/);
  if (match) {
    try {
      const snapshot = JSON.parse(match[1]) as CashCloseSnapshot;
      return { snapshot, cleanNotes: match[2]?.trim() || "" };
    } catch {
      return { snapshot: null, cleanNotes: notes };
    }
  }
  return { snapshot: null, cleanNotes: notes };
};

interface CashSessionComputedSummary {
  openingAmount: number;
  incomes: number;
  expenses: number;
  cashIncomes: number;
  cashExpenses: number;
  expectedBalance: number;
  expectedCashBalance: number;
  expectedFullBalance: number;
  saleMovementsCount: number;
  manualMovementsCount: number;
  salePaymentsTotal: number;
  cashSalesTotal: number;
  manualIncomesTotal: number;
  positiveAdjustmentsTotal: number;
  negativeAdjustmentsTotal: number;
}

export interface CashCloseResult {
  session: CashSession | null;
  expectedAmount: number;
  realAmount: number;
  difference: number;
  salePaymentsTotal: number;
  cashSalesTotal: number;
  totalIncomes: number;
}

export interface CashBreakdownItem {
  code: string;
  label: string;
  amount: number;
  movementsCount: number;
}

export interface CashSessionBreakdown {
  sessionId: string;
  incomes: {
    total: number;
    items: CashBreakdownItem[];
  };
  expenses: {
    total: number;
    items: CashBreakdownItem[];
  };
  totalCash: {
    openingAmount: number;
    incomes: number;
    expenses: number;
    expectedBalance: number;
  };
}

export interface CurrentAccountDailyCustomerSummary {
  customerId: string;
  customerName: string;
  dailyDebitsAmount: number;
  dailyPaymentsAmount: number;
  dailyAdjustmentsAmount: number;
  dailyNetAmount: number;
  currentBalance: number;
  movementsCount: number;
}

export interface CurrentAccountDailySummary {
  date: string;
  totalDebitsAmount: number;
  totalPaymentsAmount: number;
  totalAdjustmentsAmount: number;
  totalNetAmount: number;
  totalCurrentBalance: number;
  customersCount: number;
  customers: CurrentAccountDailyCustomerSummary[];
}

const roundAmount = (value: number): number => Number(value.toFixed(2));

const normalizeKey = (value: string | null | undefined): string =>
  (value ?? "").trim().toLowerCase();

const toTitleCaseFromCode = (value: string): string =>
  value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^./, (char) => char.toUpperCase());

const defaultPaymentMethodLabels: Record<string, string> = {
  cash: "Efectivo",
  card_debit: "Tarjeta de debito",
  card_credit: "Tarjeta de credito",
  transfer: "Transferencia bancaria",
  mercado_pago: "Mercado Pago",
  cheque: "Cheque",
  current_account: "Cuenta corriente",
};

const incomeReferenceLabels: Record<string, string> = {
  manual_income: "Ingreso manual",
  current_account_payment: "Pago de cuenta corriente",
};

const expenseReferenceLabels: Record<string, string> = {
  manual_expense: "Egreso manual",
  purchase: "Pago a proveedores",
  purchase_payment: "Pago a proveedores",
  supplier_payment: "Pago a proveedores",
};

const defaultCashSettings: CashSettings = {
  require_open_session_for_sale: false,
  default_opening_amount: 0,
  allow_manual_movements: true,
  require_notes_on_manual_movements: false,
  blind_cash_closing: false,
  cash_reconciliation_mode: "cash_only",
};

export const useCashModule = (tenantId: string | null, userId: string | null) => {
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [currentAccountMovements, setCurrentAccountMovements] = useState<CurrentAccountMovement[]>(
    []
  );
  const [customersById, setCustomersById] = useState<Record<string, Customer>>({});
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethodsByCode, setPaymentMethodsByCode] = useState<Record<string, string>>({});
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [salePayments, setSalePayments] = useState<SalePayment[]>([]);
  const [salesById, setSalesById] = useState<Record<string, Sale>>({});
  const [usersById, setUsersById] = useState<Record<string, string>>({});
  const [cashSettings, setCashSettings] = useState<CashSettings>(defaultCashSettings);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [movementTypeFilter, setMovementTypeFilter] = useState<CashMovementFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<CashFeedback | null>(null);

  const clearFeedback = () => setFeedback(null);

  const loadCashData = useCallback(async () => {
    if (!tenantId) {
      setSessions([]);
      setMovements([]);
      setCurrentAccountMovements([]);
      setCustomersById({});
      setPaymentMethods([]);
      setPaymentMethodsByCode({});
      setBankAccounts([]);
      setSalePayments([]);
      setSalesById({});
      setUsersById({});
      setCashSettings(defaultCashSettings);
      setSelectedSessionId("");
      return;
    }

    setIsLoading(true);
    try {
      const [
        allSessions,
        allMovements,
        tenantSettings,
        allUsers,
        allPaymentMethods,
        allCurrentAccountMovements,
        allCustomers,
        allSales,
        allBankAccounts,
        allSalePayments,
      ] = await Promise.all([
        cashService.getAllByTenant(tenantId),
        cashService.getAllMovementsByTenant(tenantId),
        settingsService.getByTenant(tenantId),
        usersService.getAllByTenant(tenantId),
        paymentMethodsService.getAllByTenant(tenantId),
        currentAccountsService.getAllByTenant(tenantId),
        customersService.getAllByTenant(tenantId),
        salesService.getAllByTenant(tenantId),
        bankAccountsService.getActiveByTenant(tenantId).catch(() => []),
        salesService.getAllPaymentsByTenant(tenantId).catch(() => []),
      ]);

      setSessions(allSessions.sort((a, b) => b.opened_at.localeCompare(a.opened_at)));
      setMovements(allMovements.sort((a, b) => b.created_at.localeCompare(a.created_at)));
      setBankAccounts(allBankAccounts);
      setSalePayments(allSalePayments);
      setCurrentAccountMovements(
        allCurrentAccountMovements.sort((a, b) => b.created_at.localeCompare(a.created_at))
      );
      setCustomersById(
        allCustomers.reduce<Record<string, Customer>>((acc, customer) => {
          acc[customer.id] = customer;
          return acc;
        }, {})
      );
      setPaymentMethodsByCode(
        allPaymentMethods.reduce<Record<string, string>>((acc, method) => {
          const key = normalizeKey(method.code);
          if (!key) return acc;
          acc[key] = method.name;
          return acc;
        }, {})
      );
      setPaymentMethods(allPaymentMethods);
      setSalesById(
        allSales.reduce<Record<string, Sale>>((acc, sale) => {
          acc[sale.id] = sale;
          return acc;
        }, {})
      );
      setUsersById(
        allUsers.reduce<Record<string, string>>((acc, user) => {
          const fullName = user.full_name?.trim() ?? "";
          if (fullName) {
            acc[user.id] = fullName;
            return acc;
          }

          const fallback = user.email?.trim() || user.username?.trim() || user.id;
          acc[user.id] = fallback;
          return acc;
        }, {})
      );
      setCashSettings(tenantSettings.caja ?? defaultCashSettings);
    } catch {
      setFeedback({ type: "error", message: "No se pudo cargar informacion de caja" });
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadCashData();
  }, [loadCashData]);

  const currentSession = useMemo(() => {
    // 1. Si el usuario actual abrió una sesión abierta propia, usarla
    const userSession = userId
      ? sessions.find(
          (session) => session.status === "open" && session.opened_by_user_id === userId
        )
      : null;
    if (userSession) return userSession;

    // 2. Si no, pero hay una sesión abierta en el comercio (ej. abierta por otro compañero como Patricia), continuar con esa caja abierta
    return sessions.find((session) => session.status === "open") ?? null;
  }, [sessions, userId]);

  useEffect(() => {
    if (!sessions.length) {
      setSelectedSessionId("");
      return;
    }

    setSelectedSessionId((current) => {
      if (current && sessions.some((session) => session.id === current)) {
        return current;
      }

      if (currentSession) return currentSession.id;
      return sessions[0].id;
    });
  }, [currentSession, sessions]);

  const selectedSession = useMemo(() => {
    if (!sessions.length) return null;
    if (!selectedSessionId) return currentSession ?? sessions[0] ?? null;
    return sessions.find((session) => session.id === selectedSessionId) ?? null;
  }, [sessions, selectedSessionId, currentSession]);

  const sessionHistory = useMemo(() => sessions, [sessions]);

  const selectedSessionMovements = useMemo(() => {
    if (!selectedSession) return [];

    return movements.filter((movement) => {
      if (movement.cash_session_id !== selectedSession.id) return false;
      if (movementTypeFilter !== "all" && movement.movement_type !== movementTypeFilter) {
        return false;
      }
      if (dateFrom && movement.created_at.slice(0, 10) < dateFrom) return false;
      if (dateTo && movement.created_at.slice(0, 10) > dateTo) return false;
      return true;
    });
  }, [movements, selectedSession, movementTypeFilter, dateFrom, dateTo]);

  const sessionSummariesById = useMemo(() => {
    const movementsBySessionId = movements.reduce<Map<string, CashMovement[]>>((acc, movement) => {
      const list = acc.get(movement.cash_session_id) ?? [];
      list.push(movement);
      acc.set(movement.cash_session_id, list);
      return acc;
    }, new Map<string, CashMovement[]>());

    return sessions.reduce<Map<string, CashSessionComputedSummary>>((acc, session) => {
      const sessionMovements = movementsBySessionId.get(session.id) ?? [];
      let incomes = 0;
      let expenses = 0;
      let cashIncomes = 0;
      let cashExpenses = 0;
      let cashSalesTotal = 0;
      let saleMovementsCount = 0;
      let manualMovementsCount = 0;
      let salePaymentsTotal = 0;
      let manualIncomesTotal = 0;
      let positiveAdjustmentsTotal = 0;
      let negativeAdjustmentsTotal = 0;

      for (const movement of sessionMovements) {
        const amount = Math.abs(movement.amount);
        const refType = normalizeKey(movement.reference_type);

        if (movement.movement_type === "expense") {
          expenses += amount;
          // Egresos del cajón son en efectivo a menos que sean explícitamente electrónicos
          if (
            refType !== "transfer" &&
            refType !== "card_debit" &&
            refType !== "card_credit" &&
            refType !== "cheque"
          ) {
            cashExpenses += amount;
          }
        } else if (movement.movement_type === "income") {
          incomes += amount;
          manualIncomesTotal += amount;
          // Ingreso manual al cajón
          if (
            refType === "cash" ||
            refType === "efectivo" ||
            refType === "manual_income" ||
            !refType
          ) {
            cashIncomes += amount;
          }
        } else if (movement.movement_type === "sale_payment") {
          incomes += amount;
          salePaymentsTotal += amount;
          // Cobro por venta: SOLO SI ES EFECTIVO ingresa al cajón de caja física
          if (refType === "cash" || refType === "efectivo") {
            cashIncomes += amount;
            cashSalesTotal += amount;
          }
        } else if (movement.movement_type === "adjustment" && movement.amount < 0) {
          expenses += amount;
          negativeAdjustmentsTotal += amount;
          if (refType !== "transfer" && refType !== "cheque") {
            cashExpenses += amount;
          }
        } else if (movement.movement_type === "adjustment" && movement.amount > 0) {
          incomes += amount;
          positiveAdjustmentsTotal += amount;
          if (refType !== "transfer" && refType !== "cheque") {
            cashIncomes += amount;
          }
        } else {
          incomes += amount;
        }

        if (movement.movement_type === "sale_payment") {
          saleMovementsCount += 1;
        }

        if (
          movement.reference_type.startsWith("manual_") ||
          movement.movement_type === "income" ||
          movement.movement_type === "expense"
        ) {
          manualMovementsCount += 1;
        }
      }

      const normalizedIncomes = roundAmount(incomes);
      const normalizedExpenses = roundAmount(expenses);
      const normalizedCashIncomes = roundAmount(cashIncomes);
      const normalizedCashExpenses = roundAmount(cashExpenses);

      const expectedCashBalance = roundAmount(
        session.opening_amount + normalizedCashIncomes - normalizedCashExpenses
      );
      const expectedFullBalance = roundAmount(
        session.opening_amount + normalizedIncomes - normalizedExpenses
      );
      const isFull = cashSettings.cash_reconciliation_mode === "full";
      const expectedBalance = isFull ? expectedFullBalance : expectedCashBalance;

      acc.set(session.id, {
        openingAmount: session.opening_amount,
        incomes: normalizedIncomes,
        expenses: normalizedExpenses,
        cashIncomes: normalizedCashIncomes,
        cashExpenses: normalizedCashExpenses,
        expectedBalance,
        expectedCashBalance,
        expectedFullBalance,
        saleMovementsCount,
        manualMovementsCount,
        salePaymentsTotal: roundAmount(salePaymentsTotal),
        cashSalesTotal: roundAmount(cashSalesTotal),
        manualIncomesTotal: roundAmount(manualIncomesTotal),
        positiveAdjustmentsTotal: roundAmount(positiveAdjustmentsTotal),
        negativeAdjustmentsTotal: roundAmount(negativeAdjustmentsTotal),
      });
      return acc;
    }, new Map());
  }, [movements, sessions, cashSettings]);

  const summary = useMemo(() => {
    if (!selectedSession) {
      return {
        openingAmount: 0,
        incomes: 0,
        expenses: 0,
        expectedBalance: 0,
        expectedCashBalance: 0,
        expectedFullBalance: 0,
      };
    }

    const selectedSummary = sessionSummariesById.get(selectedSession.id);
    if (!selectedSummary) {
      return {
        openingAmount: selectedSession.opening_amount,
        incomes: 0,
        expenses: 0,
        expectedBalance: selectedSession.opening_amount,
        expectedCashBalance: selectedSession.opening_amount,
        expectedFullBalance: selectedSession.opening_amount,
      };
    }

    return {
      openingAmount: selectedSummary.openingAmount,
      incomes: selectedSummary.incomes,
      expenses: selectedSummary.expenses,
      expectedBalance: selectedSummary.expectedBalance,
      expectedCashBalance: selectedSummary.expectedCashBalance,
      expectedFullBalance: selectedSummary.expectedFullBalance,
    };
  }, [selectedSession, sessionSummariesById]);

  const currentSessionSummary = useMemo(() => {
    if (!currentSession) {
      return {
        openingAmount: 0,
        incomes: 0,
        expenses: 0,
        expectedBalance: 0,
        expectedCashBalance: 0,
        expectedFullBalance: 0,
      };
    }

    const currentSummary = sessionSummariesById.get(currentSession.id);
    if (!currentSummary) {
      return {
        openingAmount: currentSession.opening_amount,
        incomes: 0,
        expenses: 0,
        expectedBalance: currentSession.opening_amount,
        expectedCashBalance: currentSession.opening_amount,
        expectedFullBalance: currentSession.opening_amount,
      };
    }

    return {
      openingAmount: currentSummary.openingAmount,
      incomes: currentSummary.incomes,
      expenses: currentSummary.expenses,
      expectedBalance: currentSummary.expectedBalance,
      expectedCashBalance: currentSummary.expectedCashBalance,
      expectedFullBalance: currentSummary.expectedFullBalance,
    };
  }, [currentSession, sessionSummariesById]);

  const currentSessionIncomeSummary = useMemo(() => {
    if (!currentSession) {
      return {
        salePaymentsTotal: 0,
        cashSalesTotal: 0,
        manualIncomesTotal: 0,
        positiveAdjustmentsTotal: 0,
        totalIncomes: 0,
        totalCash: 0,
      };
    }

    const sessionSummary = sessionSummariesById.get(currentSession.id);
    if (!sessionSummary) {
      return {
        salePaymentsTotal: 0,
        cashSalesTotal: 0,
        manualIncomesTotal: 0,
        positiveAdjustmentsTotal: 0,
        totalIncomes: 0,
        totalCash: roundAmount(currentSession.opening_amount),
      };
    }

    return {
      salePaymentsTotal: sessionSummary.salePaymentsTotal,
      cashSalesTotal: sessionSummary.cashSalesTotal,
      manualIncomesTotal: sessionSummary.manualIncomesTotal,
      positiveAdjustmentsTotal: sessionSummary.positiveAdjustmentsTotal,
      totalIncomes: roundAmount(
        sessionSummary.salePaymentsTotal +
          sessionSummary.manualIncomesTotal +
          sessionSummary.positiveAdjustmentsTotal
      ),
      totalCash: sessionSummary.expectedBalance,
    };
  }, [currentSession, sessionSummariesById]);

  const dailyTracking = useMemo(() => {
    const rowsByDate = new Map<string, CashDailyTrackingRow>();

    for (const session of sessions) {
      const date = session.opened_at.slice(0, 10);
      const sessionSummary = sessionSummariesById.get(session.id);
      const openingAmount = sessionSummary?.openingAmount ?? session.opening_amount;
      const incomes = sessionSummary?.incomes ?? 0;
      const expenses = sessionSummary?.expenses ?? 0;
      const expectedClosingAmount =
        sessionSummary?.expectedBalance ?? roundAmount(session.opening_amount + incomes - expenses);

      const current = rowsByDate.get(date) ?? {
        date,
        sessionsCount: 0,
        openSessionsCount: 0,
        openingAmount: 0,
        incomes: 0,
        expenses: 0,
        expectedClosingAmount: 0,
        realClosingAmount: 0,
        differenceAmount: 0,
        saleMovementsCount: 0,
        manualMovementsCount: 0,
      };

      current.sessionsCount += 1;
      current.openSessionsCount += session.status === "open" ? 1 : 0;
      current.openingAmount = roundAmount(current.openingAmount + openingAmount);
      current.incomes = roundAmount(current.incomes + incomes);
      current.expenses = roundAmount(current.expenses + expenses);
      current.expectedClosingAmount = roundAmount(
        current.expectedClosingAmount + expectedClosingAmount
      );
      current.realClosingAmount = roundAmount(
        current.realClosingAmount + (session.closing_amount ?? 0)
      );
      current.differenceAmount = roundAmount(
        current.differenceAmount + (session.closing_difference ?? 0)
      );
      current.saleMovementsCount += sessionSummary?.saleMovementsCount ?? 0;
      current.manualMovementsCount += sessionSummary?.manualMovementsCount ?? 0;

      rowsByDate.set(date, current);
    }

    return [...rowsByDate.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [sessionSummariesById, sessions]);

  const sessionDateById = useMemo(
    () =>
      sessions.reduce<Record<string, string>>((acc, session) => {
        acc[session.id] = session.opened_at.slice(0, 10);
        return acc;
      }, {}),
    [sessions]
  );

  const saleNumbersById = useMemo(
    () =>
      Object.entries(salesById).reduce<Record<string, string>>((acc, [saleId, sale]) => {
        acc[saleId] = sale.sale_number;
        return acc;
      }, {}),
    [salesById]
  );

  const saleBankAccountsById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of salePayments) {
      const meta = p.metadata as { payment_details?: { destination_account_id?: string } } | null;
      const destAccId = meta?.payment_details?.destination_account_id;
      if (destAccId && p.sale_id) {
        map[p.sale_id] = destAccId;
        const code = normalizeKey(p.payment_method_code);
        if (code) {
          map[`${p.sale_id}_${code}`] = destAccId;
        }
      }
    }
    return map;
  }, [salePayments]);

  const getDailyMovements = useCallback(
    (date: string | null, movementType: CashMovementFilter = "all"): CashMovement[] => {
      if (!date) return [];

      return movements.filter((movement) => {
        const sessionDate = sessionDateById[movement.cash_session_id];
        if (sessionDate !== date) return false;
        if (movementType !== "all" && movement.movement_type !== movementType) return false;
        return true;
      });
    },
    [movements, sessionDateById]
  );

  const getSessionBreakdown = useCallback(
    (sessionId: string | null): CashSessionBreakdown | null => {
      if (!sessionId) return null;

      const session = sessions.find((entry) => entry.id === sessionId);
      if (!session) return null;

      const sessionMovements = movements.filter((movement) => movement.cash_session_id === sessionId);
      const incomesByCode = new Map<string, CashBreakdownItem>();
      const expensesByCode = new Map<string, CashBreakdownItem>();
      let incomesTotal = 0;
      let expensesTotal = 0;

      // Mapa de cuenta bancaria destino por venta para cobros con transferencia
      const destinationAccountBySaleAndMethod = new Map<string, string>();
      for (const p of salePayments) {
        const meta = p.metadata as { payment_details?: { destination_account_id?: string } } | null;
        const destAccId = meta?.payment_details?.destination_account_id;
        if (destAccId) {
          destinationAccountBySaleAndMethod.set(
            `${p.sale_id}_${normalizeKey(p.payment_method_code)}`,
            destAccId
          );
        }
      }

      const addBreakdown = (
        target: Map<string, CashBreakdownItem>,
        code: string,
        label: string,
        amount: number
      ) => {
        const current = target.get(code);
        if (!current) {
          target.set(code, {
            code,
            label,
            amount: roundAmount(amount),
            movementsCount: 1,
          });
          return;
        }

        current.amount = roundAmount(current.amount + amount);
        current.movementsCount += 1;
      };

      for (const movement of sessionMovements) {
        const amount = roundAmount(Math.abs(movement.amount));
        const referenceKey = normalizeKey(movement.reference_type);

        if (movement.movement_type === "sale_payment") {
          const methodCode = referenceKey || "sale_payment";
          const normMethod = normalizeKey(methodCode);

          let targetCode = methodCode;
          let targetLabel =
            paymentMethodsByCode[methodCode] ??
            defaultPaymentMethodLabels[methodCode] ??
            toTitleCaseFromCode(methodCode);

          // Si es transferencia y tiene cuenta bancaria asignada
          if (normMethod === "transfer" && movement.reference_id) {
            const destAccountId = destinationAccountBySaleAndMethod.get(
              `${movement.reference_id}_transfer`
            );
            const bankAcc = destAccountId
              ? bankAccounts.find((b) => b.id === destAccountId)
              : null;
            if (bankAcc) {
              targetCode = `bank_acc_${bankAcc.id}`;
              const holderPart = bankAcc.holder_name ? ` (${bankAcc.holder_name})` : "";
              targetLabel = `Transferencia ${bankAcc.bank_name}${holderPart}`;
            }
          }

          addBreakdown(incomesByCode, targetCode, targetLabel, amount);
          incomesTotal = roundAmount(incomesTotal + amount);
          continue;
        }

        if (movement.movement_type === "income") {
          const incomeCode = referenceKey || "income";
          const label = incomeReferenceLabels[incomeCode] ?? toTitleCaseFromCode(incomeCode);
          addBreakdown(incomesByCode, incomeCode, label, amount);
          incomesTotal = roundAmount(incomesTotal + amount);
          continue;
        }

        if (movement.movement_type === "expense") {
          const expenseCode = referenceKey || "expense";
          const label = expenseReferenceLabels[expenseCode] ?? toTitleCaseFromCode(expenseCode);
          addBreakdown(expensesByCode, expenseCode, label, amount);
          expensesTotal = roundAmount(expensesTotal + amount);
          continue;
        }

        if (movement.movement_type === "adjustment" && movement.amount > 0) {
          addBreakdown(incomesByCode, "adjustment_positive", "Ajuste positivo", amount);
          incomesTotal = roundAmount(incomesTotal + amount);
          continue;
        }

        if (movement.movement_type === "adjustment" && movement.amount < 0) {
          addBreakdown(expensesByCode, "adjustment_negative", "Ajuste negativo", amount);
          expensesTotal = roundAmount(expensesTotal + amount);
        }
      }

      // Cuentas de banco activas y habilitadas para POS (idéntico al modal del POS)
      const posBankAccounts = bankAccounts.filter(
        (b) => b.is_active && b.is_pos_available !== false
      );

      const dynamicBaseItems: CashBreakdownItem[] = [];
      const configuredCodes = Object.keys(paymentMethodsByCode);

      // 1. Efectivo
      if (configuredCodes.some((c) => normalizeKey(c) === "cash")) {
        const existing = incomesByCode.get("cash");
        if (existing) incomesByCode.delete("cash");
        dynamicBaseItems.push({
          code: "cash",
          label: paymentMethodsByCode["cash"] || "Efectivo",
          amount: existing?.amount ?? 0,
          movementsCount: existing?.movementsCount ?? 0,
        });
      }

      // 2. Transferencias Bancarias (Desglose por bancos habilitados en POS)
      const hasTransferMethod = configuredCodes.some((c) => normalizeKey(c) === "transfer");
      if (hasTransferMethod) {
        if (posBankAccounts.length > 0) {
          for (const acc of posBankAccounts) {
            const code = `bank_acc_${acc.id}`;
            const holderPart = acc.holder_name ? ` (${acc.holder_name})` : "";
            const label = `Transferencia ${acc.bank_name}${holderPart}`;
            const existing = incomesByCode.get(code);
            if (existing) incomesByCode.delete(code);
            dynamicBaseItems.push({
              code,
              label,
              amount: existing?.amount ?? 0,
              movementsCount: existing?.movementsCount ?? 0,
            });
          }
        } else {
          const existing = incomesByCode.get("transfer");
          if (existing) incomesByCode.delete("transfer");
          dynamicBaseItems.push({
            code: "transfer",
            label: paymentMethodsByCode["transfer"] || "Transferencia bancaria",
            amount: existing?.amount ?? 0,
            movementsCount: existing?.movementsCount ?? 0,
          });
        }
      }

      // 3. Tarjeta de débito
      if (configuredCodes.some((c) => normalizeKey(c) === "card_debit")) {
        const existing = incomesByCode.get("card_debit");
        if (existing) incomesByCode.delete("card_debit");
        dynamicBaseItems.push({
          code: "card_debit",
          label: paymentMethodsByCode["card_debit"] || "Tarjeta de debito",
          amount: existing?.amount ?? 0,
          movementsCount: existing?.movementsCount ?? 0,
        });
      }

      // 4. Tarjeta de crédito
      if (configuredCodes.some((c) => normalizeKey(c) === "card_credit")) {
        const existing = incomesByCode.get("card_credit");
        if (existing) incomesByCode.delete("card_credit");
        dynamicBaseItems.push({
          code: "card_credit",
          label: paymentMethodsByCode["card_credit"] || "Tarjeta de credito",
          amount: existing?.amount ?? 0,
          movementsCount: existing?.movementsCount ?? 0,
        });
      }

      // 5. Mercado Pago
      if (configuredCodes.some((c) => normalizeKey(c) === "mercado_pago")) {
        const existing = incomesByCode.get("mercado_pago");
        if (existing) incomesByCode.delete("mercado_pago");
        dynamicBaseItems.push({
          code: "mercado_pago",
          label: paymentMethodsByCode["mercado_pago"] || "Mercado Pago",
          amount: existing?.amount ?? 0,
          movementsCount: existing?.movementsCount ?? 0,
        });
      }

      // 6. Cuenta Corriente
      if (configuredCodes.some((c) => normalizeKey(c) === "current_account")) {
        const existing = incomesByCode.get("current_account");
        if (existing) incomesByCode.delete("current_account");
        dynamicBaseItems.push({
          code: "current_account",
          label: paymentMethodsByCode["current_account"] || "Cuenta corriente",
          amount: existing?.amount ?? 0,
          movementsCount: existing?.movementsCount ?? 0,
        });
      }

      // 7. Otros métodos configurados (que no sean cheque)
      for (const [code, label] of Object.entries(paymentMethodsByCode)) {
        const norm = normalizeKey(code);
        if (
          norm === "cash" ||
          norm === "transfer" ||
          norm === "card_debit" ||
          norm === "card_credit" ||
          norm === "mercado_pago" ||
          norm === "current_account" ||
          norm === "cheque"
        ) {
          continue;
        }
        const existing = incomesByCode.get(code);
        if (existing) incomesByCode.delete(code);
        dynamicBaseItems.push({
          code,
          label,
          amount: existing?.amount ?? 0,
          movementsCount: existing?.movementsCount ?? 0,
        });
      }

      // 8. Cheque (al final de los métodos de pago)
      if (configuredCodes.some((c) => normalizeKey(c) === "cheque")) {
        const existing = incomesByCode.get("cheque");
        if (existing) incomesByCode.delete("cheque");
        dynamicBaseItems.push({
          code: "cheque",
          label: paymentMethodsByCode["cheque"] || "Cheque",
          amount: existing?.amount ?? 0,
          movementsCount: existing?.movementsCount ?? 0,
        });
      }

      // Ingresos extras / ajustes no clasificados
      const extraIncomeItems = [...incomesByCode.values()].sort((a, b) => b.amount - a.amount);

      const getIncomeItemPriority = (code: string): number => {
        const norm = normalizeKey(code);
        if (norm === "cash") return 1;
        if (norm.startsWith("bank_acc_") || norm === "transfer") return 2;
        if (norm === "card_debit") return 3;
        if (norm === "card_credit") return 4;
        if (norm === "mercado_pago") return 5;
        if (norm === "current_account") return 6;
        if (norm === "cheque") return 999; // Cheque SIEMPRE al final
        return 50; // Ajustes u otros ingresos
      };

      const incomesItems = [...dynamicBaseItems, ...extraIncomeItems].sort((a, b) => {
        const pA = getIncomeItemPriority(a.code);
        const pB = getIncomeItemPriority(b.code);
        if (pA !== pB) return pA - pB;
        return a.label.localeCompare(b.label);
      });

      const expensesItems = [...expensesByCode.values()].sort((a, b) => b.amount - a.amount);
      const computedSummary = sessionSummariesById.get(session.id);
      const cashIncomes =
        computedSummary?.cashIncomes ??
        (incomesItems.find((i) => normalizeKey(i.code) === "cash")?.amount ?? 0);
      const cashExpenses = computedSummary?.cashExpenses ?? expensesTotal;
      const expectedCashBalance =
        computedSummary?.expectedBalance ??
        roundAmount(session.opening_amount + cashIncomes - cashExpenses);

      return {
        sessionId: session.id,
        incomes: {
          total: incomesTotal,
          items: incomesItems,
        },
        expenses: {
          total: expensesTotal,
          items: expensesItems,
        },
        totalCash: {
          openingAmount: roundAmount(session.opening_amount),
          incomes: cashIncomes,
          expenses: cashExpenses,
          expectedBalance: expectedCashBalance,
        },
      };
    },
    [bankAccounts, movements, paymentMethodsByCode, salePayments, sessions]
  );

  const getCurrentAccountDailySummary = useCallback(
    (date: string | null): CurrentAccountDailySummary | null => {
      if (!date) return null;

      const byCustomer = new Map<
        string,
        {
          dailyDebitsAmount: number;
          dailyPaymentsAmount: number;
          dailyAdjustmentsAmount: number;
          dailyNetAmount: number;
          movementsCount: number;
        }
      >();

      for (const movement of currentAccountMovements) {
        if (movement.created_at.slice(0, 10) !== date) continue;
        const current = byCustomer.get(movement.customer_id) ?? {
          dailyDebitsAmount: 0,
          dailyPaymentsAmount: 0,
          dailyAdjustmentsAmount: 0,
          dailyNetAmount: 0,
          movementsCount: 0,
        };

        const amount = roundAmount(Math.abs(movement.amount));
        if (movement.type === "debt") {
          current.dailyDebitsAmount = roundAmount(current.dailyDebitsAmount + amount);
          current.dailyNetAmount = roundAmount(current.dailyNetAmount + amount);
        } else if (movement.type === "payment") {
          current.dailyPaymentsAmount = roundAmount(current.dailyPaymentsAmount + amount);
          current.dailyNetAmount = roundAmount(current.dailyNetAmount - amount);
        } else {
          current.dailyAdjustmentsAmount = roundAmount(current.dailyAdjustmentsAmount + movement.amount);
          current.dailyNetAmount = roundAmount(current.dailyNetAmount + movement.amount);
        }

        current.movementsCount += 1;
        byCustomer.set(movement.customer_id, current);
      }

      const customers = [...byCustomer.entries()]
        .map<CurrentAccountDailyCustomerSummary>(([customerId, summary]) => {
          const customer = customersById[customerId];
          return {
            customerId,
            customerName: customer?.full_name?.trim() || customerId,
            dailyDebitsAmount: summary.dailyDebitsAmount,
            dailyPaymentsAmount: summary.dailyPaymentsAmount,
            dailyAdjustmentsAmount: summary.dailyAdjustmentsAmount,
            dailyNetAmount: summary.dailyNetAmount,
            currentBalance: roundAmount(customer?.current_balance ?? 0),
            movementsCount: summary.movementsCount,
          };
        })
        .sort((a, b) => b.dailyNetAmount - a.dailyNetAmount);

      const totalDebitsAmount = roundAmount(
        customers.reduce((acc, customer) => acc + customer.dailyDebitsAmount, 0)
      );
      const totalPaymentsAmount = roundAmount(
        customers.reduce((acc, customer) => acc + customer.dailyPaymentsAmount, 0)
      );
      const totalAdjustmentsAmount = roundAmount(
        customers.reduce((acc, customer) => acc + customer.dailyAdjustmentsAmount, 0)
      );
      const totalNetAmount = roundAmount(
        customers.reduce((acc, customer) => acc + customer.dailyNetAmount, 0)
      );
      const totalCurrentBalance = roundAmount(
        customers.reduce((acc, customer) => acc + customer.currentBalance, 0)
      );

      return {
        date,
        totalDebitsAmount,
        totalPaymentsAmount,
        totalAdjustmentsAmount,
        totalNetAmount,
        totalCurrentBalance,
        customersCount: customers.length,
        customers,
      };
    },
    [currentAccountMovements, customersById]
  );

  const openCash = async (values: OpenCashValues) => {
    if (!tenantId || !userId) {
      setFeedback({ type: "error", message: "No se pudo identificar el usuario responsable" });
      return;
    }

    setIsSubmitting(true);
    try {
      const alreadyOpen = await cashService.getOpenSession(tenantId);
      if (alreadyOpen) {
        setFeedback({ type: "error", message: "Ya existe una caja diaria abierta en este comercio" });
        return;
      }

      const createdSession = await cashService.create(tenantId, {
        branch_id: null,
        opened_by_user_id: userId,
        closed_by_user_id: null,
        status: "open",
        opened_at: new Date().toISOString(),
        closed_at: null,
        opening_amount: values.openingAmount,
        closing_amount: null,
        expected_closing_amount: null,
        closing_difference: null,
        notes: values.notes?.trim() || null,
      });
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "caja",
        action: "open",
        entity_type: "cash_session",
        entity_id: createdSession.id,
        description: "Apertura de caja",
        metadata: {
          opening_amount: values.openingAmount,
          notes: values.notes?.trim() || null,
        },
      });

      if (values.openingAmount > 0) {
        try {
          await generalCashService.createMovement(tenantId, {
            type: "expense",
            amount: values.openingAmount,
            origin_type: "daily_cash_open",
            concept: `Fondo inicial para apertura de Caja diaria - Sesión #${createdSession.id.slice(-6)}`,
            reference_id: createdSession.id,
            created_by: userId,
          });
        } catch (genCashErr) {
          console.error("Error al registrar egreso en Caja General al abrir caja:", genCashErr);
        }
      }
      setFeedback({ type: "success", message: "Caja diaria abierta" });
      await loadCashData();
      setSelectedSessionId(createdSession.id);
    } catch {
      setFeedback({ type: "error", message: "No se pudo abrir la caja diaria" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeCash = async (values: CloseCashValues): Promise<CashCloseResult | null> => {
    if (!tenantId || !userId || !currentSession) {
      setFeedback({ type: "error", message: "No hay una caja diaria abierta para cerrar" });
      return null;
    }

    setIsSubmitting(true);
    try {
      const reconciliationMode = cashSettings.cash_reconciliation_mode ?? "cash_only";
      const expectedAmount = currentSessionSummary.expectedBalance;
      const difference = roundAmount(values.realAmount - expectedAmount);

      const snapshot: CashCloseSnapshot = {
        billCounts: values.billCounts,
        coinsAmount: values.coinsAmount,
        expectedAmount,
        expectedCashAmount: currentSessionSummary.expectedCashBalance,
        expectedFullAmount: currentSessionSummary.expectedFullBalance,
        realAmount: values.realAmount,
        difference,
        reconciliationMode,
        userNotes: values.notes?.trim() || "",
      };

      const serializedNotes = serializeCloseSnapshot(
        snapshot,
        values.notes?.trim() || currentSession.notes
      );

      const closedSession = await cashService.update(tenantId, currentSession.id, {
        status: "closed",
        closed_by_user_id: userId,
        closed_at: new Date().toISOString(),
        closing_amount: values.realAmount,
        expected_closing_amount: expectedAmount,
        closing_difference: difference,
        notes: serializedNotes,
        closing_bill_counts: (values.billCounts as Record<string, number>) ?? null,
        closing_coins_amount: values.coinsAmount ?? null,
      });
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "caja",
        action: "close",
        entity_type: "cash_session",
        entity_id: closedSession?.id ?? currentSession.id,
        description: "Cierre de caja",
        metadata: {
          expected_amount: expectedAmount,
          real_amount: values.realAmount,
          difference,
          reconciliation_mode: reconciliationMode,
          bill_counts: values.billCounts,
        },
      });

      if (values.realAmount > 0) {
        try {
          await generalCashService.createMovement(tenantId, {
            type: "income",
            amount: values.realAmount,
            origin_type: "daily_cash_close",
            concept: `Ingreso por cierre de Caja diaria - Sesión #${currentSession.id.slice(-6)}`,
            reference_id: currentSession.id,
            created_by: userId,
          });
        } catch (genCashErr) {
          console.error("Error al registrar ingreso en Caja General al cerrar caja:", genCashErr);
        }
      }
      setFeedback({ type: "success", message: "Caja diaria cerrada" });
      await loadCashData();
      return {
        session: closedSession,
        expectedAmount: currentSessionSummary.expectedBalance,
        realAmount: values.realAmount,
        difference,
        salePaymentsTotal: currentSessionIncomeSummary.salePaymentsTotal,
        cashSalesTotal: currentSessionIncomeSummary.cashSalesTotal,
        totalIncomes: currentSessionIncomeSummary.totalIncomes,
      };
    } catch {
      setFeedback({ type: "error", message: "No se pudo cerrar la caja diaria" });
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const registerIncome = async (values: CashMovementValues): Promise<boolean> => {
    if (!tenantId || !currentSession) {
      setFeedback({ type: "error", message: "No hay caja abierta para registrar el ingreso" });
      return false;
    }
    if (!userId) {
      setFeedback({ type: "error", message: "No se pudo identificar el usuario responsable" });
      return false;
    }

    if (!cashSettings.allow_manual_movements) {
      setFeedback({ type: "error", message: "Los movimientos manuales estan desactivados" });
      return false;
    }

    if (cashSettings.require_notes_on_manual_movements && !values.notes?.trim()) {
      setFeedback({ type: "error", message: "La observacion es obligatoria en movimientos manuales" });
      return false;
    }

    setIsSubmitting(true);
    try {
      const paymentMethod = paymentMethods.find((method) => method.id === values.paymentMethodId);
      if (!paymentMethod) {
        setFeedback({ type: "error", message: "Selecciona un medio de pago para el ingreso" });
        return false;
      }
      const paymentMethodCode = normalizeKey(paymentMethod.code) || "manual_income";
      const movement = await cashService.createMovement(tenantId, {
        cash_session_id: currentSession.id,
        movement_type: "income",
        amount: values.amount,
        currency_code: "ARS",
        reference_type: paymentMethodCode,
        reference_id: paymentMethod.id,
        notes: values.notes?.trim() || `Ingreso manual - ${paymentMethod.name}`,
        created_by: userId,
      });
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "caja",
        action: "income",
        entity_type: "cash_movement",
        entity_id: movement.id,
        description: "Ingreso manual de caja",
        metadata: {
          cash_session_id: currentSession.id,
          amount: values.amount,
          payment_method_id: paymentMethod.id,
          payment_method_code: paymentMethodCode,
          payment_method_name: paymentMethod.name,
          notes: values.notes?.trim() || null,
        },
      });

      setFeedback({ type: "success", message: "Ingreso registrado" });
      await loadCashData();
      return true;
    } catch {
      setFeedback({ type: "error", message: "No se pudo registrar el ingreso" });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const registerExpense = async (values: CashMovementValues): Promise<boolean> => {
    if (!tenantId || !currentSession) {
      setFeedback({ type: "error", message: "No hay caja abierta para registrar el egreso" });
      return false;
    }
    if (!userId) {
      setFeedback({ type: "error", message: "No se pudo identificar el usuario responsable" });
      return false;
    }

    if (!cashSettings.allow_manual_movements) {
      setFeedback({ type: "error", message: "Los movimientos manuales estan desactivados" });
      return false;
    }

    if (cashSettings.require_notes_on_manual_movements && !values.notes?.trim()) {
      setFeedback({ type: "error", message: "La observacion es obligatoria en movimientos manuales" });
      return false;
    }

    setIsSubmitting(true);
    try {
      const movement = await cashService.createMovement(tenantId, {
        cash_session_id: currentSession.id,
        movement_type: "expense",
        amount: values.amount,
        currency_code: "ARS",
        reference_type: "manual_expense",
        reference_id: null,
        notes: values.notes?.trim() || null,
        created_by: userId,
      });
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "caja",
        action: "expense",
        entity_type: "cash_movement",
        entity_id: movement.id,
        description: "Egreso manual de caja",
        metadata: {
          cash_session_id: currentSession.id,
          amount: values.amount,
          notes: values.notes?.trim() || null,
        },
      });

      setFeedback({ type: "success", message: "Egreso registrado" });
      await loadCashData();
      return true;
    } catch {
      setFeedback({ type: "error", message: "No se pudo registrar el egreso" });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeShiftMovements = useMemo(() => {
    if (!currentSession) return [];
    return movements.filter((m) => m.cash_session_id === currentSession.id);
  }, [currentSession, movements]);

  return {
    currentSession,
    selectedSession,
    selectedSessionId,
    setSelectedSessionId,
    sessionHistory,
    movements,
    activeShiftMovements,
    currentSessionMovements: selectedSessionMovements,
    selectedSessionMovements,
    paymentMethods,
    bankAccounts,
    saleBankAccountsById,
    dailyTracking,
    usersById,
    cashSettings,
    summary,
    currentSessionSummary,
    currentSessionIncomeSummary,
    getSessionBreakdown,
    getCurrentAccountDailySummary,
    getDailyMovements,
    saleNumbersById,
    movementTypeFilter,
    setMovementTypeFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload: loadCashData,
    openCash,
    closeCash,
    registerIncome,
    registerExpense,
  };
};
