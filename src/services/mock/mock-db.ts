import type {
  CashMovement,
  CashSession,
  CurrentAccountMovement,
  Customer,
  PaymentMethod,
  PermissionProfileRecord,
  Promotion,
  PriceList,
  PriceListItem,
  Purchase,
  PurchaseItem,
  Product,
  ProductBarcode,
  Receipt,
  Invoice,
  CreditNote,
  AuditLog,
  TenantSettings,
  Sale,
  SaleItem,
  SalePayment,
  Supplier,
  TenantRecord,
  UserRecord,
  StockMovement,
  BankAccount,
  OriginBank,
  InstallmentPlan,
} from "@/types/entities";
import type { DbTableName } from "@/lib/database/tables";

const MOCK_DB_STORAGE_KEY = "pos-v2-mock-db";

export interface MockDatabase {
  tenants: TenantRecord[];
  permission_profiles: PermissionProfileRecord[];
  users: UserRecord[];
  products: Product[];
  product_barcodes: ProductBarcode[];
  customers: Customer[];
  suppliers: Supplier[];
  payment_methods: PaymentMethod[];
  bank_accounts: BankAccount[];
  origin_banks: OriginBank[];
  installment_plans: InstallmentPlan[];
  promotions: Promotion[];
  price_lists: PriceList[];
  price_list_items: PriceListItem[];
  purchases: Purchase[];
  purchase_items: PurchaseItem[];
  current_account_movements: CurrentAccountMovement[];
  sales: Sale[];
  sale_items: SaleItem[];
  receipts: Receipt[];
  invoices: Invoice[];
  credit_notes: CreditNote[];
  audit_logs: AuditLog[];
  tenant_settings: TenantSettings[];
  stock_movements: StockMovement[];
  cash_sessions: CashSession[];
  cash_movements: CashMovement[];
  sale_payments: SalePayment[];
}

const createEmptyMockDatabase = (): MockDatabase => ({
  tenants: [],
  permission_profiles: [],
  users: [],
  products: [],
  product_barcodes: [],
  customers: [],
  suppliers: [],
  payment_methods: [],
  bank_accounts: [],
  origin_banks: [],
  installment_plans: [],
  promotions: [],
  price_lists: [],
  price_list_items: [],
  purchases: [],
  purchase_items: [],
  current_account_movements: [],
  sales: [],
  sale_items: [],
  receipts: [],
  invoices: [],
  credit_notes: [],
  audit_logs: [],
  tenant_settings: [],
  stock_movements: [],
  cash_sessions: [],
  cash_movements: [],
  sale_payments: [],
});

const getSafeStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const normalizeProducts = (rows: unknown[]): Product[] =>
  rows.map((row) => {
    const product = row as Product &
      Partial<Record<"supplier" | "is_favorite" | "is_active", unknown>>;
    return {
      ...product,
      supplier: typeof product.supplier === "string" ? product.supplier : null,
      is_favorite: Boolean(product.is_favorite),
      is_active: product.is_active !== false,
    };
  });

const normalizeDatabase = (candidate: Partial<MockDatabase>): MockDatabase => {
  const empty = createEmptyMockDatabase();
  const tableNames = Object.keys(empty) as DbTableName[];

  for (const table of tableNames) {
    const rawRows = candidate[table];
    const rows = Array.isArray(rawRows) ? rawRows : [];

    if (table === "products") {
      (empty[table] as Product[]) = normalizeProducts(rows);
      continue;
    }

    (empty[table] as unknown[]) = [...rows];
  }

  return empty;
};

const loadPersistedMockDatabase = (): MockDatabase | null => {
  const storage = getSafeStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(MOCK_DB_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MockDatabase>;
    return normalizeDatabase(parsed);
  } catch {
    return null;
  }
};

const persisted = loadPersistedMockDatabase();

export const mockDb: MockDatabase = persisted ?? createEmptyMockDatabase();
let storageInitialized = Boolean(persisted);

const replaceMockDatabase = (next: MockDatabase): void => {
  const tables = Object.keys(next) as DbTableName[];
  for (const table of tables) {
    (mockDb[table] as unknown[]).length = 0;
    (mockDb[table] as unknown[]).push(...(next[table] as unknown[]));
  }
};

const syncMockDatabaseFromStorage = (): void => {
  const latest = loadPersistedMockDatabase();
  if (!latest) {
    if (!storageInitialized) {
      persistMockDatabase();
      storageInitialized = true;
    }
    return;
  }
  replaceMockDatabase(latest);
  storageInitialized = true;
};

export const persistMockDatabase = (): void => {
  const storage = getSafeStorage();
  if (!storage) return;

  try {
    storage.setItem(MOCK_DB_STORAGE_KEY, JSON.stringify(mockDb));
  } catch {
    // Silenciar fallos de persistencia en entorno mock.
  }
};

export const getMockTable = <TTable extends DbTableName>(table: TTable): MockDatabase[TTable] => {
  syncMockDatabaseFromStorage();
  return mockDb[table];
};

export const resetMockDatabase = (): void => {
  const tables = Object.keys(mockDb) as DbTableName[];

  for (const table of tables) {
    mockDb[table].length = 0;
  }

  persistMockDatabase();
};

export const seedMockDatabase = (seed: Partial<MockDatabase>): void => {
  const tables = Object.keys(seed) as DbTableName[];

  for (const table of tables) {
    const rows = seed[table];
    if (!rows) continue;
    (mockDb[table] as unknown[]).push(...(rows as unknown[]));
  }

  const normalized = normalizeDatabase(mockDb);
  replaceMockDatabase(normalized);

  persistMockDatabase();
};
