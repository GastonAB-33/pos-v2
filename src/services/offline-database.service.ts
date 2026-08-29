const DATABASE_NAME = "pos-v2-offline";
const STORE_NAME = "state";
const STATE_KEY = "offline-state";

export interface OfflineDatabaseState {
  pendingSales: unknown[];
  pendingCashMovements: unknown[];
  syncMeta: unknown[];
  posSnapshots: unknown[];
}

const emptyState = (): OfflineDatabaseState => ({
  pendingSales: [],
  pendingCashMovements: [],
  syncMeta: [],
  posSnapshots: [],
});

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export const offlineDatabase = {
  isAvailable: (): boolean => typeof window !== "undefined" && "indexedDB" in window,

  read: async (): Promise<OfflineDatabaseState | null> => {
    if (!offlineDatabase.isAvailable()) return null;
    const db = await openDatabase();
    try {
      return await new Promise<OfflineDatabaseState | null>((resolve, reject) => {
        const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(STATE_KEY);
        request.onsuccess = () => resolve((request.result as OfflineDatabaseState | undefined) ?? null);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  },

  write: async (state: OfflineDatabaseState): Promise<void> => {
    if (!offlineDatabase.isAvailable()) return;
    const db = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).put(state, STATE_KEY);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      db.close();
    }
  },

  emptyState,
};
