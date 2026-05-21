import { useCallback, useEffect, useMemo, useState } from "react";
import { auditService } from "@/services/audit.service";
import { cashService } from "@/services/cash.service";
import { currentAccountsService } from "@/services/current-accounts.service";
import { customersService } from "@/services/customers.service";
import { paymentMethodsService } from "@/services/payment-methods.service";
import { salesService } from "@/services/sales.service";
import { settingsService } from "@/services/settings.service";
import { usersService } from "@/services/users.service";
import type {
  CashMovement,
  CashSession,
  CashSettings,
  CurrentAccountMovement,
  Customer,
  PaymentMethod,
  Sale,
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

interface CashSessionComputedSummary {
  openingAmount: number;
  incomes: number;
  expenses: number;
  expectedBalance: number;
  saleMovementsCount: number;
  manualMovementsCount: number;
  salePaymentsTotal: number;
  manualIncomesTotal: number;
  positiveAdjustmentsTotal: number;
  negativeAdjustmentsTotal: number;
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
      ] = await Promise.all([
        cashService.getAllByTenant(tenantId),
        cashService.getAllMovementsByTenant(tenantId),
        settingsService.getByTenant(tenantId),
        usersService.getAllByTenant(tenantId),
        paymentMethodsService.getAllByTenant(tenantId),
        currentAccountsService.getAllByTenant(tenantId),
        customersService.getAllByTenant(tenantId),
        salesService.getAllByTenant(tenantId),
      ]);

      setSessions(allSessions.sort((a, b) => b.opened_at.localeCompare(a.opened_at)));
      setMovements(allMovements.sort((a, b) => b.created_at.localeCompare(a.created_at)));
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
    if (!userId) return null;
    return (
      sessions.find(
        (session) => session.status === "open" && session.opened_by_user_id === userId
      ) ?? null
    );
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
      let saleMovementsCount = 0;
      let manualMovementsCount = 0;
      let salePaymentsTotal = 0;
      let manualIncomesTotal = 0;
      let positiveAdjustmentsTotal = 0;
      let negativeAdjustmentsTotal = 0;

      for (const movement of sessionMovements) {
        const amount = Math.abs(movement.amount);

        if (movement.movement_type === "expense") {
          expenses += amount;
        } else if (movement.movement_type === "income") {
          incomes += amount;
          manualIncomesTotal += amount;
        } else if (movement.movement_type === "sale_payment") {
          incomes += amount;
          salePaymentsTotal += amount;
        } else if (movement.movement_type === "adjustment" && movement.amount < 0) {
          expenses += amount;
          negativeAdjustmentsTotal += amount;
        } else if (movement.movement_type === "adjustment" && movement.amount > 0) {
          incomes += amount;
          positiveAdjustmentsTotal += amount;
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

      acc.set(session.id, {
        openingAmount: session.opening_amount,
        incomes: normalizedIncomes,
        expenses: normalizedExpenses,
        expectedBalance: roundAmount(session.opening_amount + normalizedIncomes - normalizedExpenses),
        saleMovementsCount,
        manualMovementsCount,
        salePaymentsTotal: roundAmount(salePaymentsTotal),
        manualIncomesTotal: roundAmount(manualIncomesTotal),
        positiveAdjustmentsTotal: roundAmount(positiveAdjustmentsTotal),
        negativeAdjustmentsTotal: roundAmount(negativeAdjustmentsTotal),
      });
      return acc;
    }, new Map());
  }, [movements, sessions]);

  const summary = useMemo(() => {
    if (!selectedSession) {
      return {
        openingAmount: 0,
        incomes: 0,
        expenses: 0,
        expectedBalance: 0,
      };
    }

    const selectedSummary = sessionSummariesById.get(selectedSession.id);
    if (!selectedSummary) {
      return {
        openingAmount: selectedSession.opening_amount,
        incomes: 0,
        expenses: 0,
        expectedBalance: selectedSession.opening_amount,
      };
    }

    return {
      openingAmount: selectedSummary.openingAmount,
      incomes: selectedSummary.incomes,
      expenses: selectedSummary.expenses,
      expectedBalance: selectedSummary.expectedBalance,
    };
  }, [selectedSession, sessionSummariesById]);

  const currentSessionSummary = useMemo(() => {
    if (!currentSession) {
      return {
        openingAmount: 0,
        incomes: 0,
        expenses: 0,
        expectedBalance: 0,
      };
    }

    const currentSummary = sessionSummariesById.get(currentSession.id);
    if (!currentSummary) {
      return {
        openingAmount: currentSession.opening_amount,
        incomes: 0,
        expenses: 0,
        expectedBalance: currentSession.opening_amount,
      };
    }

    return {
      openingAmount: currentSummary.openingAmount,
      incomes: currentSummary.incomes,
      expenses: currentSummary.expenses,
      expectedBalance: currentSummary.expectedBalance,
    };
  }, [currentSession, sessionSummariesById]);

  const currentSessionIncomeSummary = useMemo(() => {
    if (!currentSession) {
      return {
        salePaymentsTotal: 0,
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
        manualIncomesTotal: 0,
        positiveAdjustmentsTotal: 0,
        totalIncomes: 0,
        totalCash: roundAmount(currentSession.opening_amount),
      };
    }

    return {
      salePaymentsTotal: sessionSummary.salePaymentsTotal,
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
          const label =
            paymentMethodsByCode[methodCode] ??
            defaultPaymentMethodLabels[methodCode] ??
            toTitleCaseFromCode(methodCode);
          addBreakdown(incomesByCode, methodCode, label, amount);
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

      const configuredPaymentMethodItems = Object.entries(paymentMethodsByCode)
        .map<CashBreakdownItem>(([code, label]) => {
          const existing = incomesByCode.get(code);
          if (existing) {
            incomesByCode.delete(code);
            return existing;
          }

          return {
            code,
            label,
            amount: 0,
            movementsCount: 0,
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label));
      const extraIncomeItems = [...incomesByCode.values()].sort((a, b) => b.amount - a.amount);
      const incomesItems = [...configuredPaymentMethodItems, ...extraIncomeItems];
      const expensesItems = [...expensesByCode.values()].sort((a, b) => b.amount - a.amount);
      const expectedBalance = roundAmount(session.opening_amount + incomesTotal - expensesTotal);

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
          incomes: incomesTotal,
          expenses: expensesTotal,
          expectedBalance,
        },
      };
    },
    [movements, paymentMethodsByCode, sessions]
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
      const alreadyOpen = await cashService.getOpenSessionByUser(tenantId, userId);
      if (alreadyOpen) {
        setFeedback({ type: "error", message: "Ya tenes una caja abierta" });
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

      setFeedback({ type: "success", message: "Caja abierta" });
      await loadCashData();
      setSelectedSessionId(createdSession.id);
    } catch {
      setFeedback({ type: "error", message: "No se pudo abrir la caja" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeCash = async (values: CloseCashValues) => {
    if (!tenantId || !userId || !currentSession) {
      setFeedback({ type: "error", message: "No hay una caja abierta para cerrar" });
      return;
    }

    setIsSubmitting(true);
    try {
      const difference = roundAmount(values.realAmount - currentSessionSummary.expectedBalance);

      const closedSession = await cashService.update(tenantId, currentSession.id, {
        status: "closed",
        closed_by_user_id: userId,
        closed_at: new Date().toISOString(),
        closing_amount: values.realAmount,
        expected_closing_amount: currentSessionSummary.expectedBalance,
        closing_difference: difference,
        notes: values.notes?.trim() || currentSession.notes,
      });
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "caja",
        action: "close",
        entity_type: "cash_session",
        entity_id: closedSession?.id ?? currentSession.id,
        description: "Cierre de caja",
        metadata: {
          expected_amount: currentSessionSummary.expectedBalance,
          real_amount: values.realAmount,
          difference,
        },
      });

      setFeedback({ type: "success", message: "Caja cerrada" });
      await loadCashData();
    } catch {
      setFeedback({ type: "error", message: "No se pudo cerrar la caja" });
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

  return {
    currentSession,
    selectedSession,
    selectedSessionId,
    setSelectedSessionId,
    sessionHistory,
    currentSessionMovements: selectedSessionMovements,
    selectedSessionMovements,
    paymentMethods,
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
