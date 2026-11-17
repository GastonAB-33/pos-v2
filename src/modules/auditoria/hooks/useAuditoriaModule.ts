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

const KNOWN_MODULES = [
  "pos",
  "productos",
  "stock",
  "caja",
  "facturacion",
  "clientes",
  "proveedores",
  "compras",
  "usuarios",
  "configuracion",
];

const KNOWN_ACTIONS = [
  "sale_sync",
  "create",
  "update",
  "delete",
  "stock_adjustment",
  "cash_open",
  "cash_close",
  "payment",
];

export const useAuditoriaModule = (tenantId: string | null) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [filters, setFilters] = useState<AuditFiltersState>(initialFilters);
  const [isLoading, setIsLoading] = useState(true);
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
      // Consulta optimizada a nivel de base de datos con limites estrictos y filtros en servidor
      const [allLogs, allUsers] = await Promise.all([
        auditService.getByFilters(
          tenantId,
          {
            userId: filters.userId || undefined,
            module: filters.module || undefined,
            action: filters.action || undefined,
            dateFrom: filters.dateFrom || undefined,
            dateTo: filters.dateTo || undefined,
          },
          250
        ),
        usersService.getAllByTenant(tenantId),
      ]);

      setLogs(allLogs);
      setUsers(allUsers.sort((a, b) => a.full_name.localeCompare(b.full_name)));
    } catch (err) {
      console.error("[useAuditoriaModule] Error cargando logs:", err);
      setFeedback({ type: "error", message: "No se pudieron cargar logs de auditoría" });
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, filters.userId, filters.module, filters.action, filters.dateFrom, filters.dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredLogs = logs;

  const usersById = useMemo(
    () => new Map(users.map((user) => [user.id, user.full_name])),
    [users]
  );

  const moduleOptions = useMemo(
    () => [...new Set([...KNOWN_MODULES, ...logs.map((log) => log.module)])].sort((a, b) => a.localeCompare(b)),
    [logs]
  );

  const actionOptions = useMemo(
    () => [...new Set([...KNOWN_ACTIONS, ...logs.map((log) => log.action)])].sort((a, b) => a.localeCompare(b)),
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

