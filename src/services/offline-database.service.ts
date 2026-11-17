const DATABASE_NAME = "pos-v2-offline";
const DB_VERSION = 2;
const STORE_NAME = "state";
const SECURITY_STORE_NAME = "security";
const STATE_KEY = "offline-state";
const KEY_NAME = "device-aes-key-v1";

export interface OfflineDatabaseState {
  pendingSales: unknown[];
  pendingCashMovements: unknown[];
  syncMeta: unknown[];
  posSnapshots: unknown[];
}

interface EncryptedStateEnvelope {
  __encrypted: true;
  v: number;
  iv: string;
  ciphertext: string;
  updated_at: string;
}

const emptyState = (): OfflineDatabaseState => ({
  pendingSales: [],
  pendingCashMovements: [],
  syncMeta: [],
  posSnapshots: [],
});

const isEncryptedEnvelope = (value: unknown): value is EncryptedStateEnvelope => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.__encrypted === true &&
    typeof candidate.ciphertext === "string" &&
    typeof candidate.iv === "string"
  );
};

const uint8ToHex = (arr: Uint8Array): string =>
  Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");

const hexToUint8 = (hex: string): Uint8Array => {
  const matches = hex.match(/.{1,2}/g) || [];
  return new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
};

let cachedCryptoKey: CryptoKey | null = null;

const getOrCreateKey = async (db: IDBDatabase): Promise<CryptoKey | null> => {
  if (cachedCryptoKey) return cachedCryptoKey;
  if (typeof window === "undefined" || !window.crypto?.subtle) return null;

  try {
    const existingKey = await new Promise<CryptoKey | undefined>((resolve, reject) => {
      const tx = db.transaction(SECURITY_STORE_NAME, "readonly");
      const store = tx.objectStore(SECURITY_STORE_NAME);
      const req = store.get(KEY_NAME);
      req.onsuccess = () => resolve(req.result as CryptoKey | undefined);
      req.onerror = () => reject(req.error);
    });

    if (existingKey) {
      cachedCryptoKey = existingKey;
      return existingKey;
    }

    // Generar clave AES-GCM de 256 bits NO extraible (extractable: false)
    const newKey = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SECURITY_STORE_NAME, "readwrite");
      const store = tx.objectStore(SECURITY_STORE_NAME);
      const req = store.put(newKey, KEY_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    cachedCryptoKey = newKey;
    return newKey;
  } catch {
    return null;
  }
};

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(SECURITY_STORE_NAME)) {
        db.createObjectStore(SECURITY_STORE_NAME);
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
      const raw = await new Promise<unknown>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).get(STATE_KEY);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (!raw) return null;

      // Si es un payload cifrado con AES-GCM
      if (isEncryptedEnvelope(raw)) {
        const key = await getOrCreateKey(db);
        if (!key) {
          console.warn("[offlineDatabase] Imposible desencriptar: Clave criptográfica no disponible");
          return null;
        }

        try {
          const iv = hexToUint8(raw.iv);
          const ciphertext = hexToUint8(raw.ciphertext);
          const decrypted = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv as unknown as BufferSource },
            key,
            ciphertext as unknown as BufferSource
          );
          const text = new TextDecoder().decode(decrypted);
          return JSON.parse(text) as OfflineDatabaseState;
        } catch (decryptErr) {
          console.error("[offlineDatabase] Error al descifrar almacén offline protegido:", decryptErr);
          return null;
        }
      }

      // Si es un estado heredado sin cifrar (migración transparente)
      return raw as OfflineDatabaseState;
    } finally {
      db.close();
    }
  },

  write: async (state: OfflineDatabaseState): Promise<void> => {
    if (!offlineDatabase.isAvailable()) return;
    const db = await openDatabase();
    try {
      const key = await getOrCreateKey(db);

      let payloadToStore: unknown = state;

      // Cifrado AES-GCM con IV aleatorio de 12 bytes si Web Crypto está disponible
      if (key && typeof window !== "undefined" && window.crypto?.getRandomValues) {
        try {
          const iv = window.crypto.getRandomValues(new Uint8Array(12));
          const encoded = new TextEncoder().encode(JSON.stringify(state));
          const encryptedBuffer = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv as unknown as BufferSource },
            key,
            encoded as unknown as BufferSource
          );

          const envelope: EncryptedStateEnvelope = {
            __encrypted: true,
            v: 1,
            iv: uint8ToHex(iv),
            ciphertext: uint8ToHex(new Uint8Array(encryptedBuffer)),
            updated_at: new Date().toISOString(),
          };

          payloadToStore = envelope;
        } catch (encryptErr) {
          console.warn("[offlineDatabase] Fallback a almacenamiento plano por error de cifrado:", encryptErr);
          payloadToStore = state;
        }
      }

      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).put(payloadToStore, STATE_KEY);
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
