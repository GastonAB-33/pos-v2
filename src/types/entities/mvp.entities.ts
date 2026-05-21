import type { PermissionProfile } from "@/types/permissions";

export interface TenantScopedEntity {
  id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

export interface TenantRecord {
  id: string;
  legal_name: string;
  trade_name: string;
  cuit: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRecord extends TenantScopedEntity {
  auth_user_id?: string | null;
  email: string | null;
  username: string | null;
  full_name: string;
  role_code: string | null;
  permission_profile_id: string;
  is_active: boolean;
}

export interface PermissionProfileRecord extends TenantScopedEntity {
  name: string;
  description: string | null;
  is_active: boolean;
  permissions: PermissionProfile;
}

export interface Product extends TenantScopedEntity {
  code: string;
  name: string;
  image_url?: string | null;
  brand: string | null;
  supplier: string | null;
  is_favorite: boolean;
  description: string | null;
  price: number;
  cost_price: number;
  stock_current: number;
  stock_min: number | null;
  stock_max: number | null;
  category: string;
  subcategory: string | null;
  sale_mode: "unit" | "weight";
  currency_code: string;
  price_without_vat?: number | null;
  vat_percent?: number | null;
  profit_percent?: number | null;
  is_active: boolean;
}

export interface ProductBarcode extends TenantScopedEntity {
  product_id: string;
  barcode: string;
  is_primary: boolean;
}

export interface Customer extends TenantScopedEntity {
  code: string;
  full_name: string;
  document_type: "dni" | "cuit";
  document_number: string;
  fiscal_business_name?: string | null;
  fiscal_address?: string | null;
  fiscal_condition?: string | null;
  price_list_id: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  observations: string | null;
  current_balance: number;
  current_account_enabled?: boolean | null;
  current_account_limit?: number | null;
  current_account_pricing_mode?: CurrentAccountPricingMode | null;
  current_account_surcharge_percent?: number | null;
  current_account_surcharge_amount?: number | null;
  current_account_pricing_updated_at?: string | null;
  is_active: boolean;
}

export interface Supplier extends TenantScopedEntity {
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  observations: string | null;
  is_active: boolean;
}

export type PaymentMethodType =
  | "cash"
  | "card_debit"
  | "card_credit"
  | "transfer"
  | "mercado_pago"
  | "cheque"
  | "current_account";

export interface PaymentMethod extends TenantScopedEntity {
  name: string;
  code: string;
  type: PaymentMethodType;
  is_active: boolean;
  affects_cash: boolean;
  surcharge_percent: number;
  discount_percent: number;
  notes: string | null;
}

export type BankAccountType =
  | "caja_ahorro"
  | "cuenta_corriente"
  | "billetera_virtual"
  | "otro";

export interface BankAccount extends TenantScopedEntity {
  bank_name: string;
  account_type: BankAccountType;
  holder_name: string;
  cbu: string | null;
  alias: string | null;
  currency_code: string;
  notes: string | null;
  is_active: boolean;
}

export interface OriginBank extends TenantScopedEntity {
  code: string;
  name: string;
  is_active: boolean;
}

export interface InstallmentPlan extends TenantScopedEntity {
  code: string;
  name: string;
  installments: number;
  interest_percent: number;
  card_brand: string | null;
  notes: string | null;
  is_active: boolean;
}

export type PriceMode = "percentage" | "fixed";

export interface PriceList extends TenantScopedEntity {
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  price_mode: PriceMode;
  percentage_adjustment: number | null;
}

export interface PriceListItem extends TenantScopedEntity {
  price_list_id: string;
  product_id: string;
  fixed_price: number;
}

export type PromotionType = "percentage_discount" | "fixed_discount" | "combo_price";
export type PromotionScope = "product" | "cart" | "bundle";

export interface Promotion extends TenantScopedEntity {
  name: string;
  code: string;
  description: string | null;
  type: PromotionType;
  scope: PromotionScope;
  product_id: string | null;
  min_quantity: number | null;
  discount_percent: number | null;
  discount_amount: number | null;
  combo_price: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
}

export interface PromotionItem extends TenantScopedEntity {
  promotion_id: string;
  product_id: string;
  quantity: number;
}

export interface PromotionBarcode extends TenantScopedEntity {
  promotion_id: string;
  barcode: string;
  is_primary: boolean;
}

export type PurchaseStatus = "confirmed" | "cancelled";

export interface Purchase extends TenantScopedEntity {
  supplier_id: string;
  purchase_number: string;
  status: PurchaseStatus;
  subtotal: number;
  total: number;
  notes: string | null;
  created_by: string | null;
  items?: PurchaseItem[];
  supplier?: Supplier | null;
}

export interface PurchaseItem extends TenantScopedEntity {
  purchase_id: string;
  product_id: string;
  product_name_snapshot: string;
  quantity: number;
  unit_cost: number;
  line_total: number;
}

export type CurrentAccountMovementType = "debt" | "payment" | "adjustment";
export type CurrentAccountPricingMode =
  | "original"
  | "today_prices"
  | "surcharge_percentage"
  | "surcharge_fixed";

export interface CurrentAccountMovement extends TenantScopedEntity {
  customer_id: string;
  sale_id: string | null;
  type: CurrentAccountMovementType;
  amount: number;
  balance_after: number;
  notes: string | null;
  created_by: string | null;
}

export type SaleStatus = "draft" | "completed" | "cancelled";

export interface Sale extends TenantScopedEntity {
  sale_number: string;
  customer_id: string | null;
  cash_session_id: string | null;
  status: SaleStatus;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
  currency_code: string;
  notes: string | null;
  current_account_id: string | null;
  arca_document_id: string | null;
  mercado_pago_preference_id: string | null;
  items?: SaleItem[];
  payments?: SalePayment[];
  customer?: Customer | null;
}

export interface SaleItem extends TenantScopedEntity {
  sale_id: string;
  product_id: string;
  product_name_snapshot: string;
  quantity: number;
  unit_price: number;
  discount_total: number;
  tax_total: number;
  line_total: number;
  metadata: Record<string, unknown> | null;
}

export interface SalePayment extends TenantScopedEntity {
  sale_id: string;
  payment_method_code: string;
  provider: "internal" | "mercado_pago" | "arca" | (string & {});
  provider_code: "internal" | "mercado_pago" | "arca" | (string & {});
  amount: number;
  currency_code: string;
  status: "pending" | "approved" | "rejected" | "cancelled" | "expired";
  provider_status: "pending" | "approved" | "rejected" | "cancelled" | "expired";
  provider_reference: string | null;
  provider_metadata: Record<string, unknown> | null;
  external_reference: string | null;
  metadata: Record<string, unknown> | null;
}

export type ReceiptPaymentMethod = PaymentMethodType;

export interface ReceiptItemSnapshot {
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Receipt extends TenantScopedEntity {
  sale_id: string;
  sale_number: string;
  receipt_number: string;
  issued_at: string;
  customer_name: string | null;
  payment_method: ReceiptPaymentMethod;
  items: ReceiptItemSnapshot[];
  total: number;
  notes: string | null;
  created_by: string | null;
}

export interface AuditLog {
  id: string;
  tenant_id: string;
  user_id: string | null;
  module: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export type UiDensity = "standard" | "compact";

export interface BusinessSettings {
  trade_name: string;
  legal_name: string;
  cuit: string;
  address: string;
  phone: string;
  email: string;
  logo_url: string | null;
  currency_code: string;
  timezone: string;
}

export type PosCartBehavior = "merge_same_product" | "separate_lines";

export interface PosSettings {
  default_customer_id: string | null;
  default_payment_method_id: string | null;
  auto_print_receipt: boolean;
  allow_sale_without_customer: boolean;
  allow_negative_stock: boolean;
  barcode_scan_quantity: number;
  cart_behavior: PosCartBehavior;
}

export interface StockSettings {
  use_min_max: boolean;
  alerts_active: boolean;
  global_low_stock_threshold: number;
  allow_manual_adjustments: boolean;
  allow_negative_stock: boolean;
}

export interface CashSettings {
  require_open_session_for_sale: boolean;
  default_opening_amount: number;
  allow_manual_movements: boolean;
  require_notes_on_manual_movements: boolean;
}

export interface FacturacionSettings {
  document_sequences: {
    A: number;
    B: number;
    C: number;
    PRESUPUESTO: number;
  };
  default_document_type: InvoiceDocumentType;
  allow_budget_without_customer: boolean;
  issuer_tax_name: string;
  issuer_cuit: string;
  issuer_address: string;
  issuer_fiscal_condition: string;
  arca: ArcaSettings;
}

export type ArcaMode = "mock" | "sandbox" | "real";
export type ArcaFiscalEnvironment = "homologacion" | "produccion";

export interface ArcaSettings {
  enabled: boolean;
  mode: ArcaMode;
  cuit_emisor: string;
  punto_venta: number;
  certificado_alias: string;
  fiscal_environment: ArcaFiscalEnvironment;
  force_unavailable: boolean;
  allow_internal_fallback: boolean;
}

export type BarcodeScaleMode = "weight" | "total_price";

export interface BarcodeScaleSettings {
  scale_parser_enabled: boolean;
  scale_mode: BarcodeScaleMode;
  scale_prefix: string;
  code_length: number;
  plu_start: number;
  plu_length: number;
  weight_start: number;
  weight_length: number;
  weight_decimals: number;
  amount_start: number;
  amount_length: number;
  amount_decimals: number;
  ean13_enabled: boolean;
}

export interface AppearanceSettings {
  default_theme: "light" | "dark";
  accent_color: string;
  display_name: string;
  density: UiDensity;
}

export interface SystemSettings {
  show_dev_flags: boolean;
  data_provider: "mock" | "supabase";
  version: string;
  enable_mock_auth_bypass: boolean;
  allow_placeholder_export_import: boolean;
  mercado_pago: MercadoPagoSettings;
}

export type MercadoPagoMode = "mock" | "sandbox" | "real";

export interface MercadoPagoSettings {
  enabled: boolean;
  mode: MercadoPagoMode;
  access_token: string;
  public_key: string;
  force_unavailable: boolean;
}

export interface TenantSettings extends TenantScopedEntity {
  negocio: BusinessSettings;
  pos: PosSettings;
  stock: StockSettings;
  caja: CashSettings;
  facturacion: FacturacionSettings;
  codigos_balanza: BarcodeScaleSettings;
  apariencia: AppearanceSettings;
  sistema: SystemSettings;
}

export type TenantSettingsSectionKey =
  | "negocio"
  | "pos"
  | "stock"
  | "caja"
  | "facturacion"
  | "codigos_balanza"
  | "apariencia"
  | "sistema";

export interface FiscalCustomerSnapshot {
  customer_id: string | null;
  full_name: string;
  business_name: string | null;
  document_type: "dni" | "cuit" | (string & {});
  document_number: string;
  address: string | null;
  fiscal_condition: string | null;
}

export interface InvoiceItemSnapshot {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  tax_total: number;
  total: number;
}

export type InvoiceDocumentType = "A" | "B" | "C" | "PRESUPUESTO";
export type InvoiceStatus = "draft" | "issued" | "cancelled";
export type ArcaInvoiceStatus = "pending" | "not_sent" | "accepted" | "rejected";

export interface Invoice extends TenantScopedEntity {
  sale_id: string | null;
  customer_id: string | null;
  document_type: InvoiceDocumentType;
  document_number: string;
  issue_date: string;
  customer_snapshot: FiscalCustomerSnapshot | null;
  items_snapshot: InvoiceItemSnapshot[];
  subtotal: number;
  tax_total: number;
  total: number;
  status: InvoiceStatus;
  arca_status: ArcaInvoiceStatus;
  arca_reference: string | null;
  arca_message: string | null;
  notes: string | null;
}

export type CreditNoteStatus = "draft" | "issued" | "cancelled";
export type CreditNoteReason = "return" | "price_adjustment" | "cancellation" | "other";

export interface CreditNote extends TenantScopedEntity {
  invoice_id: string | null;
  sale_id: string | null;
  customer_id: string | null;
  document_number: string;
  issue_date: string;
  reason: CreditNoteReason;
  subtotal: number;
  tax_total: number;
  total: number;
  status: CreditNoteStatus;
  arca_status: ArcaInvoiceStatus;
  arca_reference: string | null;
  notes: string | null;
}

export type StockMovementType = "in" | "out" | "adjustment" | "sale" | "purchase";

export interface StockMovement extends TenantScopedEntity {
  product_id: string;
  movement_type: StockMovementType;
  quantity: number;
  reference_type: string;
  reference_id: string | null;
  notes: string | null;
  created_by?: string | null;
}

export type CashSessionStatus = "open" | "closed";

export interface CashSession extends TenantScopedEntity {
  branch_id: string | null;
  opened_by_user_id: string;
  closed_by_user_id: string | null;
  status: CashSessionStatus;
  opened_at: string;
  closed_at: string | null;
  opening_amount: number;
  closing_amount: number | null;
  expected_closing_amount: number | null;
  closing_difference: number | null;
  notes: string | null;
}

export type CashMovementType = "income" | "expense" | "sale_payment" | "adjustment";

export interface CashMovement extends TenantScopedEntity {
  cash_session_id: string;
  movement_type: CashMovementType;
  amount: number;
  currency_code: string;
  reference_type: string;
  reference_id: string | null;
  notes: string | null;
  created_by?: string | null;
}
