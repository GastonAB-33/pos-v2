import { useCallback, useEffect, useMemo, useState } from "react";
import { auditService } from "@/services/audit.service";
import { usersService } from "@/services/users.service";
import type { AuditLog, UserRecord } from "@/types/entities";

export interface AuditFiltersState {
  dateFrom: string;
  dateTo: string;
  userId: string;
  module: string;
  action: string;
}

type FeedbackType = "success" | "error";

interface AuditFeedback {
  type: FeedbackType;
  message: string;
}

const initialFilters: AuditFiltersState = {
  dateFrom: "",
  dateTo: "",
  userId: "",
  module: "",
  action: "",
};

const applyFilters = (rows: AuditLog[], filters: AuditFiltersState): AuditLog[] =>
  rows
    .filter((row) => (!filters.userId ? true : row.user_id === filters.userId))
    .filter((row) => (!filters.module ? true : row.module === filters.module))
    .filter((row) => (!filters.action ? true : row.action === filters.action))
    .filter((row) => (!filters.dateFrom ? true : row.created_at.slice(0, 10) >= filters.dateFrom))
    .filter((row) => (!filters.dateTo ? true : row.created_at.slice(0, 10) <= filters.dateTo));

export const useAuditoriaModule = (tenantId: string | null) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [filters, setFilters] = useState<AuditFiltersState>(initialFilters);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<AuditFeedback | null>(null);

  const clearFeedback = () => setFeedback(null);

  const load = useCallback(async () => {
    if (!tenantId) {
      setLogs([]);
      setUsers([]);
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    try {
      const [allLogs, allUsers] = await Promise.all([
        auditService.getAllByTenant(tenantId),
        usersService.getAllByTenant(tenantId),
      ]);

      setLogs(allLogs);
      setUsers(allUsers.sort((a, b) => a.full_name.localeCompare(b.full_name)));
    } catch {
      setFeedback({ type: "error", message: "No se pudieron cargar logs de auditoria" });
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredLogs = useMemo(() => applyFilters(logs, filters), [filters, logs]);

  const usersById = useMemo(
    () => new Map(users.map((user) => [user.id, user.full_name])),
    [users]
  );

  const moduleOptions = useMemo(
    () => [...new Set(logs.map((log) => log.module))].sort((a, b) => a.localeCompare(b)),
    [logs]
  );

  const actionOptions = useMemo(
    () => [...new Set(logs.map((log) => log.action))].sort((a, b) => a.localeCompare(b)),
    [logs]
  );

  const exportCsv = () => {
    const ok = auditService.exportCsv(`auditoria-${new Date().toISOString().slice(0, 10)}.csv`, filteredLogs);
    if (!ok) {
      setFeedback({ type: "error", message: "No hay logs para exportar" });
      return;
    }
    setFeedback({ type: "success", message: "CSV de auditoria generado" });
  };

  return {
    logs: filteredLogs,
    users,
    usersById,
    moduleOptions,
    actionOptions,
    filters,
    setFilters,
    resetFilters: () => setFilters(initialFilters),
    isLoading,
    feedback,
    clearFeedback,
    reload: load,
    exportCsv,
  };
};
