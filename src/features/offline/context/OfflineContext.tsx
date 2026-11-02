import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { useToast } from "@/components/ui/useToast";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { offlineService, type SyncSummary } from "@/services/offline.service";

type OfflineConnectionState = "online" | "offline" | "syncing";

interface OfflineContextValue {
  isOnline: boolean;
  isSyncing: boolean;
  connectionState: OfflineConnectionState;
  pendingSalesCount: number;
  pendingCashMovementsCount: number;
  totalPendingCount: number;
  lastSyncMessage: string | null;
  lastSyncError: string | null;
  lastSuccessfulSyncAt: string | null;
  refreshPending: () => void;
  syncNow: () => Promise<void>;
  clearSyncError: () => void;
}

const OfflineContext = createContext<OfflineContextValue | undefined>(undefined);

const buildSyncErrorMessage = (sales: SyncSummary, cash: SyncSummary): string | null => {
  const errors = [...sales.errors, ...cash.errors];
  if (!errors.length) return null;
  return errors[0] ?? "Error al sincronizar";
};

const formatSyncMessage = (sales: SyncSummary, cash: SyncSummary): string => {
  const syncedTotal = sales.synced + cash.synced;
  if (syncedTotal <= 0) {
    return "Sin pendientes para sincronizar";
  }

  return `Sincronizacion completa (${syncedTotal} sincronizadas)`;
};

export const OfflineProvider = ({ children }: PropsWithChildren) => {
  const tenantId = useAuthStore((state) => state.tenantId);
  const toast = useToast();
  const [isOnline, setIsOnline] = useState<boolean>(offlineService.isOnline());
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingSalesCount, setPendingSalesCount] = useState(0);
  const [pendingCashMovementsCount, setPendingCashMovementsCount] = useState(0);
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [lastSuccessfulSyncAt, setLastSuccessfulSyncAt] = useState<string | null>(null);
  const syncingRef = useRef(false);

  const refreshPending = useCallback(() => {
    if (!tenantId) {
      setPendingSalesCount(0);
      setPendingCashMovementsCount(0);
      return;
    }

    const counts = offlineService.getPendingCounts(tenantId);
    setPendingSalesCount(counts.sales);
    setPendingCashMovementsCount(counts.cashMovements);
  }, [tenantId]);

  const clearSyncError = useCallback(() => {
    setLastSyncError(null);
    if (tenantId) {
      offlineService.setSyncMeta(tenantId, { last_error: null });
    }
  }, [tenantId]);

  const syncNow = useCallback(async () => {
    if (!tenantId || !offlineService.isOnline() || syncingRef.current) return;

    syncingRef.current = true;
    setIsSyncing(true);
    setLastSyncError(null);
    setLastSyncMessage("Sincronizando...");

    offlineService.setSyncMeta(tenantId, {
      last_attempt_at: new Date().toISOString(),
      last_error: null,
    });

    const counts = offlineService.getPendingCounts(tenantId);
    const hasPending = counts.sales + counts.cashMovements > 0;
    if (hasPending) {
      toast.info("Sincronizando operaciones pendientes...");
    }

    try {
      const salesSummary = await offlineService.syncPendingSales(tenantId);
      const cashSummary = await offlineService.syncPendingCashMovements(tenantId);
      refreshPending();

      const failedTotal = salesSummary.failed + cashSummary.failed;
      const syncedTotal = salesSummary.synced + cashSummary.synced;
      const processedTotal = salesSummary.processed + cashSummary.processed;

      if (processedTotal === 0) {
        setLastSyncMessage("Sin pendientes para sincronizar");
        return;
      }

      if (failedTotal > 0) {
        const errorMessage = buildSyncErrorMessage(salesSummary, cashSummary) ?? "Error al sincronizar";
        setLastSyncError(errorMessage);
        setLastSyncMessage(`Error al sincronizar (${failedTotal} pendientes)`);
        offlineService.setSyncMeta(tenantId, {
          last_error: errorMessage,
          last_synced_operations: syncedTotal,
        });
        toast.error(`Error al sincronizar (${failedTotal} pendientes)`);
        return;
      }

      const now = new Date().toISOString();
      setLastSuccessfulSyncAt(now);
      setLastSyncMessage(formatSyncMessage(salesSummary, cashSummary));
      offlineService.setSyncMeta(tenantId, {
        last_success_at: now,
        last_error: null,
        last_synced_operations: syncedTotal,
      });

      if (syncedTotal > 0) {
        toast.success(`Sincronizacion completa (${syncedTotal})`);
      }
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [refreshPending, tenantId, toast]);

  useEffect(() => {
    void offlineService.hydrate().then(() => refreshPending());
  }, [refreshPending]);

  useEffect(() => {
    setIsOnline(offlineService.isOnline());
    refreshPending();

    if (!tenantId) {
      setLastSyncError(null);
      setLastSyncMessage(null);
      setLastSuccessfulSyncAt(null);
      return;
    }

    const syncMeta = offlineService.getSyncMeta(tenantId);
    setLastSyncError(syncMeta?.last_error ?? null);
    setLastSuccessfulSyncAt(syncMeta?.last_success_at ?? null);

    if (syncMeta?.last_error) {
      setLastSyncMessage("Error al sincronizar");
      return;
    }

    if (syncMeta?.last_success_at) {
      const dateLabel = new Date(syncMeta.last_success_at).toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      setLastSyncMessage(`Ultima sincronizacion: ${dateLabel}`);
      return;
    }

    setLastSyncMessage(null);
  }, [refreshPending, tenantId]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void syncNow();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setLastSyncMessage("Sin conexion");
    };

    const handleFocus = () => {
      if (!offlineService.isOnline()) return;
      const counts = tenantId ? offlineService.getPendingCounts(tenantId) : { sales: 0, cashMovements: 0 };
      if (counts.sales + counts.cashMovements > 0) {
        void syncNow();
      }
    };

    const handleStorage = () => {
      refreshPending();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("storage", handleStorage);
    };
  }, [refreshPending, syncNow, tenantId]);

  const totalPendingCount = pendingSalesCount + pendingCashMovementsCount;
  const connectionState: OfflineConnectionState = isSyncing ? "syncing" : isOnline ? "online" : "offline";

  const value = useMemo<OfflineContextValue>(
    () => ({
      isOnline,
      isSyncing,
      connectionState,
      pendingSalesCount,
      pendingCashMovementsCount,
      totalPendingCount,
      lastSyncMessage,
      lastSyncError,
      lastSuccessfulSyncAt,
      refreshPending,
      syncNow,
      clearSyncError,
    }),
    [
      clearSyncError,
      connectionState,
      isOnline,
      isSyncing,
      lastSuccessfulSyncAt,
      lastSyncError,
      lastSyncMessage,
      pendingCashMovementsCount,
      pendingSalesCount,
      refreshPending,
      syncNow,
      totalPendingCount,
    ]
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
};

export const useOfflineContext = (): OfflineContextValue => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error("useOfflineContext must be used within OfflineProvider");
  }
  return context;
};
