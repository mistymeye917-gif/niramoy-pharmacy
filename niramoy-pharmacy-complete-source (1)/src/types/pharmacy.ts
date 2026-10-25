export type Language = 'bn' | 'en';

export type PaymentMethod = 'cash' | 'bkash' | 'nagad' | 'rocket' | 'card' | 'credit';

export type DosageForm = 
  | 'Tablet' 
  | 'Capsule' 
  | 'Syrup' 
  | 'Suspension' 
  | 'Injection' 
  | 'Cream' 
  | 'Ointment' 
  | 'Drops' 
  | 'Inhaler' 
  | 'Suppository' 
  | 'Powder' 
  | 'Other';

export interface Medicine {
  id: number;
  brand_name: string;
  generic_name: string;
  manufacturer: string;
  strength: string;
  dosage_form: DosageForm | string;
  base_unit: string; // e.g. 'Tablet', 'Piece', 'Bottle'
  barcode?: string;
  sale_price: number; // Sale price per base unit in BDT
  active: number; // 1 or 0
  notes?: string;
  created_at?: string;
  updated_at?: string;
  // Computed aggregations
  total_stock?: number;
  active_batches_count?: number;
  conversions?: UnitConversion[];
}

export interface UnitConversion {
  id?: number;
  medicine_id?: number;
  unit_name: string; // e.g., 'Strip', 'Box', 'Pack'
  multiplier: number; // How many base units are in this unit (e.g., 10 tablets in 1 strip)
}

export interface InventoryBatch {
  id: number;
  medicine_id: number;
  batch_number: string;
  expiry_date: string; // YYYY-MM-DD
  purchase_cost: number; // Cost per base unit in BDT
  initial_qty: number; // In base units
  remaining_qty: number; // In base units
  stock_unit: string;
  purchase_ref?: string;
  supplier_id?: number;
  supplier_name?: string;
  date_received: string;
  status: 'active' | 'expired' | 'depleted' | 'damaged';
  // Joined medicine fields
  brand_name?: string;
  generic_name?: string;
  manufacturer?: string;
  strength?: string;
  base_unit?: string;
  sale_price?: number;
}

export interface Supplier {
  id: number;
  name: string;
  phone: string;
  address?: string;
  notes?: string;
  total_purchased?: number;
  total_paid?: number;
  outstanding_balance?: number;
  created_at?: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  address?: string;
  notes?: string;
  balance: number; // Positive = customer owes money (receivable)
  created_at?: string;
}

export interface PurchaseItemInput {
  medicine_id: number;
  brand_name?: string;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  unit: string;
  multiplier: number; // multiplier to base units
  purchase_cost_per_unit: number; // cost per purchase unit
  sale_price_per_base_unit?: number;
  line_total: number;
}

export interface PurchaseInvoice {
  id: number;
  invoice_number: string;
  supplier_id: number;
  supplier_name?: string;
  purchase_date: string;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  payment_method: PaymentMethod;
  notes?: string;
  created_at?: string;
  items?: PurchaseLine[];
}

export interface PurchaseLine {
  id: number;
  purchase_id: number;
  medicine_id: number;
  brand_name?: string;
  generic_name?: string;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  unit: string;
  multiplier: number;
  purchase_cost: number;
  line_total: number;
}

export interface SaleItemInput {
  medicine_id: number;
  brand_name: string;
  generic_name: string;
  strength: string;
  dosage_form: string;
  base_unit: string;
  selected_unit: string;
  multiplier: number;
  quantity: number; // in selected unit
  unit_price: number; // price per selected unit
  line_total: number;
  available_base_qty?: number;
  batch_allocations?: {
    batch_id: number;
    batch_number: string;
    expiry_date: string;
    allocated_base_qty: number;
    purchase_cost: number;
  }[];
}

export interface SplitPaymentInput {
  method: PaymentMethod;
  amount: number;
  transaction_ref?: string;
}

export interface SaleInvoice {
  id: number;
  invoice_number: string;
  customer_id?: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  sale_date: string;
  subtotal: number;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  discount_amount: number;
  final_payable: number;
  paid_amount: number;
  change_returned: number;
  credit_amount: number;
  payment_status: 'paid' | 'partial' | 'credit';
  status: 'completed' | 'cancelled' | 'returned';
  notes?: string;
  created_at?: string;
  items?: SaleLine[];
  payments?: SalePaymentRecord[];
  // Snapshot of pharmacy details at sale time for authentic reprint
  pharmacy_snapshot?: {
    name: string;
    address: string;
    phone: string;
    logo?: string;
  };
}

export interface SaleLine {
  id: number;
  sale_id: number;
  medicine_id: number;
  brand_name: string;
  generic_name: string;
  quantity: number;
  unit: string;
  multiplier: number;
  base_quantity: number;
  unit_price: number;
  line_total: number;
  cost_of_goods: number;
}

export interface SalePaymentRecord {
  id: number;
  sale_id: number;
  payment_method: PaymentMethod;
  amount: number;
  transaction_ref?: string;
  created_at: string;
}

export interface CustomerPayment {
  id: number;
  customer_id: number;
  customer_name?: string;
  sale_id?: number | null;
  payment_date: string;
  amount: number;
  payment_method: PaymentMethod;
  reference?: string;
  notes?: string;
  created_at?: string;
}

export interface SupplierPayment {
  id: number;
  supplier_id: number;
  supplier_name?: string;
  purchase_id?: number | null;
  payment_date: string;
  amount: number;
  payment_method: PaymentMethod;
  reference?: string;
  notes?: string;
  created_at?: string;
}

export interface Expense {
  id: number;
  category: string;
  amount: number;
  expense_date: string;
  description: string;
  payee: string;
  payment_method: PaymentMethod;
  reference_no?: string;
  created_at?: string;
}

export interface ReturnItemInput {
  sale_line_id: number;
  medicine_id: number;
  batch_id: number;
  quantity_to_return: number; // in sale unit
  unit: string;
  multiplier: number;
  unit_price: number;
  refund_amount: number;
  condition: 'saleable' | 'damaged' | 'pending_inspection';
}

export interface ReturnRecord {
  id: number;
  sale_id: number;
  invoice_number: string;
  return_date: string;
  total_refund_amount: number;
  payment_method: PaymentMethod;
  reason: string;
  created_at: string;
  items?: ReturnLine[];
}

export interface ReturnLine {
  id: number;
  return_id: number;
  sale_line_id: number;
  medicine_id: number;
  brand_name?: string;
  batch_id: number;
  batch_number?: string;
  quantity: number;
  unit: string;
  base_quantity: number;
  unit_price: number;
  refund_amount: number;
  condition: 'saleable' | 'damaged' | 'pending_inspection';
}

export interface StockAdjustment {
  id: number;
  medicine_id: number;
  brand_name?: string;
  batch_id: number;
  batch_number?: string;
  adjustment_type: 'damage_writeoff' | 'expiry_writeoff' | 'audit_correction' | 'return_restock';
  quantity_delta: number; // negative for reduction, positive for addition
  reason: string;
  created_at: string;
}

export interface PharmacySettings {
  pharmacy_name: string;
  pharmacy_address: string;
  phone_number: string;
  pharmacy_logo?: string;
  default_language: Language;
  currency: string;
  default_discount_behavior: 'percentage' | 'fixed';
  low_stock_threshold: number;
  expiry_warning_days: number;
  receipt_language: Language;
  receipt_layout: 'full' | 'compact';
  selected_printer?: string;
  auto_backup_enabled: boolean;
  auto_backup_schedule: 'daily' | 'on_close' | 'weekly';
  shared_folder_path: string;
  usb_folder_path: string;
  inactivity_lock_minutes: number;
  admin_password_hash?: string;
  admin_recovery_key?: string;
  database_version: string;
  last_backup_date?: string;
}

export interface DashboardStats {
  today_sales: number;
  today_cogs: number;
  today_gross_profit: number;
  today_expenses: number;
  today_net_profit: number;
  physical_cash_drawer: number;
  total_stock_value: number;
  low_stock_count: number;
  near_expiry_count: number;
  expired_count: number;
  customer_receivables: number;
  supplier_payables: number;
  recent_sales: SaleInvoice[];
  recent_purchases: PurchaseInvoice[];
  recent_expenses: Expense[];
}

export interface BackupItem {
  filename: string;
  filepath: string;
  size_bytes: number;
  checksum: string;
  timestamp: string;
  type: 'manual' | 'scheduled' | 'safety' | 'pre_restore';
  destination: 'local' | 'usb' | 'shared';
  records_summary?: {
    medicines: number;
    batches: number;
    sales: number;
    purchases: number;
  };
}

export interface AuditEvent {
  id: number;
  user_action: string;
  entity_type: string;
  entity_id?: string | number;
  details: string;
  timestamp: string;
}
