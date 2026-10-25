import {
  Medicine,
  InventoryBatch,
  SaleInvoice,
  PurchaseInvoice,
  Customer,
  Supplier,
  Expense,
  PharmacySettings,
  DashboardStats,
  BackupItem,
  AuditEvent,
  UnitConversion
} from '../types/pharmacy.ts';

const API_BASE = '/api';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error || `HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  // Settings
  async getSettings(): Promise<PharmacySettings> {
    const res = await fetch(`${API_BASE}/settings`);
    return handleResponse<PharmacySettings>(res);
  },
  async updateSettings(settings: Partial<PharmacySettings>): Promise<{ success: boolean; settings: PharmacySettings }> {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    return handleResponse(res);
  },

  // Auth
  async login(password: string): Promise<{ success: boolean; username: string; recovery_key: string }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    return handleResponse(res);
  },
  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    return handleResponse(res);
  },
  async recoverPassword(recoveryKey: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/auth/recover-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recoveryKey, newPassword })
    });
    return handleResponse(res);
  },

  // Dashboard
  async getDashboard(): Promise<DashboardStats> {
    const res = await fetch(`${API_BASE}/dashboard`);
    return handleResponse<DashboardStats>(res);
  },

  // Medicines
  async getMedicines(search?: string, activeOnly = false): Promise<Medicine[]> {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (activeOnly) params.set('activeOnly', 'true');
    const res = await fetch(`${API_BASE}/medicines?${params.toString()}`);
    return handleResponse<Medicine[]>(res);
  },
  async getMedicine(id: number): Promise<Medicine> {
    const res = await fetch(`${API_BASE}/medicines/${id}`);
    return handleResponse<Medicine>(res);
  },
  async saveMedicine(medicine: Partial<Medicine>, conversions?: UnitConversion[]): Promise<{ success: boolean; id: number; medicine: Medicine }> {
    const res = await fetch(`${API_BASE}/medicines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medicine, conversions })
    });
    return handleResponse(res);
  },
  async importExcelMedicines(fileBase64: string, mode: 'preview' | 'execute') {
    const res = await fetch(`${API_BASE}/medicines/import-excel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileBase64, mode })
    });
    return handleResponse<{
      success: boolean;
      totalRows?: number;
      validRows?: any[];
      duplicates?: any[];
      errors?: string[];
      insertedCount?: number;
      duplicatesCount?: number;
    }>(res);
  },

  // Batches
  async getBatches(medicineId?: number, includeExpired = false): Promise<InventoryBatch[]> {
    const params = new URLSearchParams();
    if (medicineId) params.set('medicineId', String(medicineId));
    if (includeExpired) params.set('includeExpired', 'true');
    const res = await fetch(`${API_BASE}/batches?${params.toString()}`);
    return handleResponse<InventoryBatch[]>(res);
  },
  async addBatch(batch: Partial<InventoryBatch>): Promise<{ success: boolean; id: number }> {
    const res = await fetch(`${API_BASE}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch)
    });
    return handleResponse(res);
  },

  // Sales
  async executeSale(saleData: any): Promise<{ success: boolean; invoice: SaleInvoice }> {
    const res = await fetch(`${API_BASE}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(saleData)
    });
    return handleResponse(res);
  },
  async getSales(limit = 100, search?: string): Promise<SaleInvoice[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (search) params.set('search', search);
    const res = await fetch(`${API_BASE}/sales?${params.toString()}`);
    return handleResponse<SaleInvoice[]>(res);
  },
  async getSaleById(id: number): Promise<SaleInvoice> {
    const res = await fetch(`${API_BASE}/sales/${id}`);
    return handleResponse<SaleInvoice>(res);
  },
  async cancelSale(id: number, reason: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/sales/${id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    return handleResponse(res);
  },

  // Returns
  async processReturn(data: any): Promise<{ success: boolean; returnId: number }> {
    const res = await fetch(`${API_BASE}/returns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  // Purchases
  async getPurchases(limit = 100): Promise<PurchaseInvoice[]> {
    const res = await fetch(`${API_BASE}/purchases?limit=${limit}`);
    return handleResponse<PurchaseInvoice[]>(res);
  },
  async executePurchase(purchaseData: any): Promise<{ success: boolean; purchase: PurchaseInvoice }> {
    const res = await fetch(`${API_BASE}/purchases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(purchaseData)
    });
    return handleResponse(res);
  },

  // Customers
  async getCustomers(search?: string): Promise<Customer[]> {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    const res = await fetch(`${API_BASE}/customers?${params.toString()}`);
    return handleResponse<Customer[]>(res);
  },
  async saveCustomer(cust: Partial<Customer>): Promise<{ success: boolean; id: number }> {
    const res = await fetch(`${API_BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cust)
    });
    return handleResponse(res);
  },
  async recordCustomerPayment(data: { customer_id: number; amount: number; payment_method: string; reference?: string; notes?: string }) {
    const res = await fetch(`${API_BASE}/customers/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  // Suppliers
  async getSuppliers(): Promise<Supplier[]> {
    const res = await fetch(`${API_BASE}/suppliers`);
    return handleResponse<Supplier[]>(res);
  },
  async saveSupplier(supp: Partial<Supplier>): Promise<{ success: boolean; id: number }> {
    const res = await fetch(`${API_BASE}/suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(supp)
    });
    return handleResponse(res);
  },
  async recordSupplierPayment(data: { supplier_id: number; purchase_id?: number; amount: number; payment_method: string; reference?: string; notes?: string }) {
    const res = await fetch(`${API_BASE}/suppliers/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  // Expenses & Cash
  async getExpenses(startDate?: string, endDate?: string): Promise<Expense[]> {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const res = await fetch(`${API_BASE}/expenses?${params.toString()}`);
    return handleResponse<Expense[]>(res);
  },
  async addExpense(expense: Partial<Expense>): Promise<{ success: boolean; id: number }> {
    const res = await fetch(`${API_BASE}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expense)
    });
    return handleResponse(res);
  },
  async recordCashMovement(type: 'deposit' | 'withdrawal', amount: number, reason: string) {
    const res = await fetch(`${API_BASE}/cash-movements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, amount, reason })
    });
    return handleResponse(res);
  },

  // Backups
  async getBackups(): Promise<BackupItem[]> {
    const res = await fetch(`${API_BASE}/backups`);
    return handleResponse<BackupItem[]>(res);
  },
  async createBackup(destination: 'local' | 'usb' | 'shared' = 'local', backupType = 'manual'): Promise<{ success: boolean; backup: BackupItem }> {
    const res = await fetch(`${API_BASE}/backups/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination, backupType })
    });
    return handleResponse(res);
  },
  async restoreBackup(backupFilePath: string, adminPassword: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/backups/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backupFilePath, adminPassword })
    });
    return handleResponse(res);
  },

  // Diagnostics & Tests
  async runDiagnostics(): Promise<any> {
    const res = await fetch(`${API_BASE}/diagnostics/run-tests`);
    return handleResponse(res);
  },
  async getAuditLogs(limit = 100): Promise<AuditEvent[]> {
    const res = await fetch(`${API_BASE}/audit-logs?limit=${limit}`);
    return handleResponse<AuditEvent[]>(res);
  }
};
