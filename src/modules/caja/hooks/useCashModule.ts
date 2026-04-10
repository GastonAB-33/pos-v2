import { useCallback, useEffect, useMemo, useState } from "react";
import { auditService } from "@/services/audit.service";
import { cashService } from "@/services/cash.service";
import { settingsService } from "@/services/settings.service";
import type { CashMovement, CashSession, CashSettings } from "@/types/entities";
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

const roundAmount = (value: number): number => Number(value.toFixed(2));

const defaultCashSettings: CashSettings = {
  require_open_session_for_sale: false,
  default_opening_amount: 0,
  allow_manual_movements: true,
  require_notes_on_manual_movements: false,
};

export const useCashModule = (tenantId: string | null, userId: string | null) => {
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [cashSettings, setCashSettings] = useState<CashSettings>(defaultCashSettings);
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
      setCashSettings(defaultCashSettings);
      return;
    }

    setIsLoading(true);
    try {
      const [allSessions, allMovements, tenantSettings] = await Promise.all([
        cashService.getAllByTenant(tenantId),
        cashService.getAllMovementsByTenant(tenantId),
        settingsService.getByTenant(tenantId),
      ]);

      setSessions(allSessions.sort((a, b) => b.opened_at.localeCompare(a.opened_at)));
      setMovements(allMovements.sort((a, b) => b.created_at.localeCompare(a.created_at)));
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

  const sessionHistory = useMemo(() => sessions, [sessions]);

  const currentSessionMovements = useMemo(() => {
    if (!currentSession) return [];

    return movements.filter((movement) => {
      if (movement.cash_session_id !== currentSession.id) return false;
      if (movementTypeFilter !== "all" && movement.movement_type !== movementTypeFilter) {
        return false;
      }
      if (dateFrom && movement.created_at.slice(0, 10) < dateFrom) return false;
      if (dateTo && movement.created_at.slice(0, 10) > dateTo) return false;
      return true;
    });
  }, [movements, currentSession, movementTypeFilter, dateFrom, dateTo]);

  const summary = useMemo(() => {
    if (!currentSession) {
      return {
        openingAmount: 0,
        incomes: 0,
        expenses: 0,
        expectedBalance: 0,
      };
    }

    let incomes = 0;
    let expenses = 0;

    for (const movement of currentSessionMovements) {
      const amount = Math.abs(movement.amount);

      if (movement.movement_type === "expense") {
        expenses += amount;
      } else if (movement.movement_type === "adjustment" && movement.amount < 0) {
        expenses += Math.abs(movement.amount);
      } else {
        incomes += amount;
      }
    }

    incomes = roundAmount(incomes);
    expenses = roundAmount(expenses);
    const expectedBalance = roundAmount(currentSession.opening_amount + incomes - expenses);

    return {
      openingAmount: currentSession.opening_amount,
      incomes,
      expenses,
      expectedBalance,
    };
  }, [currentSession, currentSessionMovements]);

  const openCash = async (values: OpenCashValues) => {
    if (!tenantId || !userId) return;

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
    } catch {
      setFeedback({ type: "error", message: "No se pudo abrir la caja" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeCash = async (values: CloseCashValues) => {
    if (!tenantId || !userId || !currentSession) return;

    setIsSubmitting(true);
    try {
      const difference = roundAmount(values.realAmount - summary.expectedBalance);

      const closedSession = await cashService.update(tenantId, currentSession.id, {
        status: "closed",
        closed_by_user_id: userId,
        closed_at: new Date().toISOString(),
        closing_amount: values.realAmount,
        expected_closing_amount: summary.expectedBalance,
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
          expected_amount: summary.expectedBalance,
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

  const registerIncome = async (values: CashMovementValues) => {
    if (!tenantId || !currentSession) return;

    if (!cashSettings.allow_manual_movements) {
      setFeedback({ type: "error", message: "Los movimientos manuales estan desactivados" });
      return;
    }

    if (cashSettings.require_notes_on_manual_movements && !values.notes?.trim()) {
      setFeedback({ type: "error", message: "La observacion es obligatoria en movimientos manuales" });
      return;
    }

    setIsSubmitting(true);
    try {
      const movement = await cashService.createMovement(tenantId, {
        cash_session_id: currentSession.id,
        movement_type: "income",
        amount: values.amount,
        currency_code: "ARS",
        reference_type: "manual_income",
        reference_id: null,
        notes: values.notes?.trim() || null,
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
          notes: values.notes?.trim() || null,
        },
      });

      setFeedback({ type: "success", message: "Ingreso registrado" });
      await loadCashData();
    } catch {
      setFeedback({ type: "error", message: "No se pudo registrar el ingreso" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const registerExpense = async (values: CashMovementValues) => {
    if (!tenantId || !currentSession) return;

    if (!cashSettings.allow_manual_movements) {
      setFeedback({ type: "error", message: "Los movimientos manuales estan desactivados" });
      return;
    }

    if (cashSettings.require_notes_on_manual_movements && !values.notes?.trim()) {
      setFeedback({ type: "error", message: "La observacion es obligatoria en movimientos manuales" });
      return;
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
    } catch {
      setFeedback({ type: "error", message: "No se pudo registrar el egreso" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    currentSession,
    sessionHistory,
    currentSessionMovements,
    cashSettings,
    summary,
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
