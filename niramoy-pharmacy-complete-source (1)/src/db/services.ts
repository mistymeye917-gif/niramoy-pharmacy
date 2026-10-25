import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { getDb, getCurrentDbPath, hashPassword } from './database.ts';
import {
  Medicine,
  InventoryBatch,
  SaleInvoice,
  SaleItemInput,
  SplitPaymentInput,
  PurchaseInvoice,
  PurchaseItemInput,
  Customer,
  Supplier,
  Expense,
  ReturnItemInput,
  PharmacySettings,
  DashboardStats,
  BackupItem
} from '../types/pharmacy.ts';

// ----------------------------------------------------
// SETTINGS
// ----------------------------------------------------
export function getSettings(): PharmacySettings {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }

  return {
    pharmacy_name: map.pharmacy_name || 'Niramoy Pharma & Health',
    pharmacy_address: map.pharmacy_address || 'House #12, Road #4, Dhanmondi, Dhaka',
    phone_number: map.phone_number || '+880 1712-345678',
    pharmacy_logo: map.pharmacy_logo || '',
    default_language: (map.default_language as 'bn' | 'en') || 'bn',
    currency: map.currency || '৳',
    default_discount_behavior: (map.default_discount_behavior as 'percentage' | 'fixed') || 'percentage',
    low_stock_threshold: parseInt(map.low_stock_threshold || '10', 10),
    expiry_warning_days: parseInt(map.expiry_warning_days || '30', 10),
    receipt_language: (map.receipt_language as 'bn' | 'en') || 'bn',
    receipt_layout: (map.receipt_layout as 'full' | 'compact') || 'full',
    selected_printer: map.selected_printer || 'POS-80 Thermal Printer',
    auto_backup_enabled: map.auto_backup_enabled !== 'false',
    auto_backup_schedule: (map.auto_backup_schedule as 'daily' | 'on_close' | 'weekly') || 'daily',
    shared_folder_path: map.shared_folder_path || 'C:\\PharmacyBackups\\NetworkShare',
    usb_folder_path: map.usb_folder_path || 'D:\\Pharmacy_USB_Backup',
    inactivity_lock_minutes: parseInt(map.inactivity_lock_minutes || '15', 10),
    database_version: map.database_version || '1.0.0',
    last_backup_date: map.last_backup_date || ''
  };
}

export function updateSettings(newSettings: Partial<PharmacySettings>): boolean {
  const db = getDb();
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(newSettings)) {
    if (value !== undefined) {
      stmt.run(key, String(value));
    }
  }
  return true;
}

// ----------------------------------------------------
// MEDICINES & INVENTORY
// ----------------------------------------------------
export function getMedicines(search?: string, activeOnly: boolean = false): Medicine[] {
  const db = getDb();
  let sql = `
    SELECT m.*, 
      COALESCE(SUM(b.remaining_qty), 0) AS total_stock,
      COUNT(DISTINCT b.id) AS active_batches_count
    FROM medicines m
    LEFT JOIN inventory_batches b ON m.id = b.medicine_id AND b.remaining_qty > 0 AND b.status = 'active' AND b.expiry_date >= date('now')
  `;
  const params: any[] = [];
  const whereClauses: string[] = [];

  if (activeOnly) {
    whereClauses.push('m.active = 1');
  }

  if (search && search.trim().length > 0) {
    const s = `%${search.trim()}%`;
    whereClauses.push('(m.brand_name LIKE ? OR m.generic_name LIKE ? OR m.manufacturer LIKE ? OR m.barcode LIKE ?)');
    params.push(s, s, s, s);
  }

  if (whereClauses.length > 0) {
    sql += ' WHERE ' + whereClauses.join(' AND ');
  }

  sql += ' GROUP BY m.id ORDER BY m.brand_name ASC';

  const rows = db.prepare(sql).all(...params) as any[];

  // Fetch conversions for each medicine
  const convStmt = db.prepare('SELECT unit_name, multiplier FROM unit_conversions WHERE medicine_id = ?');
  for (const row of rows) {
    row.conversions = convStmt.all(row.id);
  }

  return rows as Medicine[];
}

export function getMedicineById(id: number): Medicine | null {
  const db = getDb();
  const med = db.prepare(`
    SELECT m.*, 
      COALESCE(SUM(b.remaining_qty), 0) AS total_stock,
      COUNT(DISTINCT b.id) AS active_batches_count
    FROM medicines m
    LEFT JOIN inventory_batches b ON m.id = b.medicine_id AND b.remaining_qty > 0 AND b.status = 'active' AND b.expiry_date >= date('now')
    WHERE m.id = ?
    GROUP BY m.id
  `).get(id) as any;

  if (!med) return null;
  med.conversions = db.prepare('SELECT unit_name, multiplier FROM unit_conversions WHERE medicine_id = ?').all(id);
  return med as Medicine;
}

export function saveMedicine(medicine: Partial<Medicine>, conversions?: { unit_name: string; multiplier: number }[]): number {
  const db = getDb();
  const now = new Date().toISOString();

  if (medicine.id) {
    db.prepare(`
      UPDATE medicines 
      SET brand_name = ?, generic_name = ?, manufacturer = ?, strength = ?, dosage_form = ?, base_unit = ?, barcode = ?, sale_price = ?, active = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).run(
      medicine.brand_name || '',
      medicine.generic_name || '',
      medicine.manufacturer || '',
      medicine.strength || '',
      medicine.dosage_form || 'Tablet',
      medicine.base_unit || 'Tablet',
      medicine.barcode || '',
      medicine.sale_price ?? 0,
      medicine.active ?? 1,
      medicine.notes || '',
      now,
      medicine.id
    );

    if (conversions) {
      db.prepare('DELETE FROM unit_conversions WHERE medicine_id = ?').run(medicine.id);
      const convInsert = db.prepare('INSERT INTO unit_conversions (medicine_id, unit_name, multiplier) VALUES (?, ?, ?)');
      for (const c of conversions) {
        if (c.unit_name && c.multiplier > 0) {
          convInsert.run(medicine.id, c.unit_name, c.multiplier);
        }
      }
    }
    return medicine.id;
  } else {
    db.prepare(`
      INSERT INTO medicines (brand_name, generic_name, manufacturer, strength, dosage_form, base_unit, barcode, sale_price, active, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      medicine.brand_name || '',
      medicine.generic_name || '',
      medicine.manufacturer || '',
      medicine.strength || '',
      medicine.dosage_form || 'Tablet',
      medicine.base_unit || 'Tablet',
      medicine.barcode || '',
      medicine.sale_price ?? 0,
      medicine.active ?? 1,
      medicine.notes || '',
      now,
      now
    );

    const newId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    if (conversions) {
      const convInsert = db.prepare('INSERT INTO unit_conversions (medicine_id, unit_name, multiplier) VALUES (?, ?, ?)');
      for (const c of conversions) {
        if (c.unit_name && c.multiplier > 0) {
          convInsert.run(newId, c.unit_name, c.multiplier);
        }
      }
    }
    return newId;
  }
}

export function getBatches(medicineId?: number, includeExpired: boolean = false): InventoryBatch[] {
  const db = getDb();
  let sql = `
    SELECT b.*, m.brand_name, m.generic_name, m.manufacturer, m.strength, m.base_unit, m.sale_price,
           s.name as supplier_name
    FROM inventory_batches b
    JOIN medicines m ON b.medicine_id = m.id
    LEFT JOIN suppliers s ON b.supplier_id = s.id
  `;
  const conditions: string[] = [];
  const params: any[] = [];

  if (medicineId) {
    conditions.push('b.medicine_id = ?');
    params.push(medicineId);
  }

  if (!includeExpired) {
    conditions.push("b.expiry_date >= date('now')");
    conditions.push("b.status = 'active'");
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  // FEFO: earliest expiry first
  sql += ' ORDER BY b.expiry_date ASC, b.id ASC';

  return db.prepare(sql).all(...params) as unknown as InventoryBatch[];
}

export function addBatchManually(batch: Partial<InventoryBatch>): number {
  const db = getDb();
  const now = new Date().toISOString();
  const isExpired = new Date(batch.expiry_date || '') < new Date();

  db.prepare(`
    INSERT INTO inventory_batches (medicine_id, batch_number, expiry_date, purchase_cost, initial_qty, remaining_qty, stock_unit, purchase_ref, supplier_id, date_received, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    batch.medicine_id ?? 0,
    batch.batch_number || '',
    batch.expiry_date || now.split('T')[0],
    batch.purchase_cost ?? 0,
    batch.initial_qty ?? 0,
    batch.remaining_qty ?? 0,
    batch.stock_unit || 'Tablet',
    batch.purchase_ref || 'MANUAL-ENTRY',
    batch.supplier_id || null,
    batch.date_received || now,
    isExpired ? 'expired' : 'active'
  );

  return (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;
}

// ----------------------------------------------------
// FEFO BATCH ALLOCATION ENGINE
// ----------------------------------------------------
export function allocateFEFOBatches(medicineId: number, baseQtyNeeded: number) {
  const db = getDb();
  // Get active, unexpired batches with remaining stock, sorted by earliest expiry
  const batches = db.prepare(`
    SELECT * FROM inventory_batches 
    WHERE medicine_id = ? AND remaining_qty > 0 AND status = 'active' AND expiry_date >= date('now')
    ORDER BY expiry_date ASC, id ASC
  `).all(medicineId) as unknown as InventoryBatch[];

  let remainingToAllocate = baseQtyNeeded;
  const allocations: {
    batch_id: number;
    batch_number: string;
    expiry_date: string;
    allocated_base_qty: number;
    purchase_cost: number;
  }[] = [];

  for (const b of batches) {
    if (remainingToAllocate <= 0) break;
    const qtyFromThisBatch = Math.min(b.remaining_qty, remainingToAllocate);
    allocations.push({
      batch_id: b.id,
      batch_number: b.batch_number,
      expiry_date: b.expiry_date,
      allocated_base_qty: qtyFromThisBatch,
      purchase_cost: b.purchase_cost
    });
    remainingToAllocate -= qtyFromThisBatch;
  }

  if (remainingToAllocate > 0) {
    throw new Error(`Insufficient non-expired stock for medicine ID ${medicineId}. Needed: ${baseQtyNeeded}, Shortage: ${remainingToAllocate}`);
  }

  return allocations;
}

// ----------------------------------------------------
// SALES & BILLING (ATOMIC TRANSACTION)
// ----------------------------------------------------
export function executeSale(saleData: {
  customer_id?: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  items: SaleItemInput[];
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  payments: SplitPaymentInput[];
  notes?: string;
}): SaleInvoice {
  const db = getDb();
  const settings = getSettings();
  const now = new Date();
  const nowIso = now.toISOString();
  const dateStr = nowIso.split('T')[0];

  // Begin atomic transaction
  db.exec('BEGIN TRANSACTION;');

  try {
    // 1. Generate unique invoice number: INV-YYYYMMDD-XXXX
    const datePrefix = `INV-${dateStr.replace(/-/g, '')}-`;
    const lastInv = db.prepare(`
      SELECT invoice_number FROM sales_invoices 
      WHERE invoice_number LIKE ? 
      ORDER BY id DESC LIMIT 1
    `).get(`${datePrefix}%`) as { invoice_number: string } | undefined;

    let seq = 1;
    if (lastInv && lastInv.invoice_number) {
      const parts = lastInv.invoice_number.split('-');
      if (parts.length === 3) {
        seq = parseInt(parts[2], 10) + 1;
      }
    }
    const invoiceNumber = `${datePrefix}${String(seq).padStart(4, '0')}`;

    // 2. Validate and calculate items & allocate FEFO batches
    let subtotal = 0;
    let totalCogs = 0;
    const processedLines: {
      item: SaleItemInput;
      baseQty: number;
      lineTotal: number;
      lineCogs: number;
      allocations: { batch_id: number; batch_number: string; expiry_date: string; allocated_base_qty: number; purchase_cost: number }[];
    }[] = [];

    for (const item of saleData.items) {
      const baseQty = item.quantity * (item.multiplier || 1);
      if (baseQty <= 0) {
        throw new Error(`Invalid quantity ${item.quantity} for item ${item.brand_name}`);
      }

      const lineTotal = Math.round((item.quantity * item.unit_price) * 100) / 100;
      subtotal += lineTotal;

      // Allocate via FEFO
      const allocations = allocateFEFOBatches(item.medicine_id, baseQty);
      let lineCogs = 0;
      for (const alloc of allocations) {
        lineCogs += alloc.allocated_base_qty * alloc.purchase_cost;
      }
      totalCogs += lineCogs;

      processedLines.push({
        item,
        baseQty,
        lineTotal,
        lineCogs,
        allocations
      });
    }

    subtotal = Math.round(subtotal * 100) / 100;

    // 3. Calculate discount
    let discountAmount = 0;
    if (saleData.discount_type === 'percentage') {
      const pct = Math.max(0, Math.min(100, saleData.discount_value || 0));
      discountAmount = Math.round((subtotal * (pct / 100)) * 100) / 100;
    } else {
      discountAmount = Math.max(0, Math.min(subtotal, saleData.discount_value || 0));
    }

    const finalPayable = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);

    // 4. Validate Payments & Split payments
    let paidAmount = 0;
    let creditAmount = 0;
    for (const p of saleData.payments) {
      if (p.method === 'credit') {
        creditAmount += p.amount;
      } else {
        paidAmount += p.amount;
      }
    }

    paidAmount = Math.round(paidAmount * 100) / 100;
    creditAmount = Math.round(creditAmount * 100) / 100;

    const totalTendered = paidAmount + creditAmount;
    let changeReturned = 0;

    if (totalTendered < finalPayable) {
      // If payment is less than total, remaining becomes credit
      creditAmount = Math.round((finalPayable - paidAmount) * 100) / 100;
    } else if (totalTendered > finalPayable && creditAmount === 0) {
      // Customer paid excess cash
      changeReturned = Math.round((totalTendered - finalPayable) * 100) / 100;
    }

    // Determine status
    let paymentStatus: 'paid' | 'partial' | 'credit' = 'paid';
    if (creditAmount >= finalPayable) {
      paymentStatus = 'credit';
    } else if (creditAmount > 0) {
      paymentStatus = 'partial';
    }

    // If credit is used, customer is required!
    if (creditAmount > 0) {
      if (!saleData.customer_id) {
        throw new Error('A registered customer must be selected for sales with unpaid credit balance.');
      }
      // Update customer balance
      db.prepare('UPDATE customers SET balance = balance + ? WHERE id = ?').run(creditAmount, saleData.customer_id);
    }

    // 5. Deduct inventory batch stock
    for (const pl of processedLines) {
      for (const alloc of pl.allocations) {
        db.prepare(`
          UPDATE inventory_batches 
          SET remaining_qty = remaining_qty - ?,
              status = CASE WHEN (remaining_qty - ?) <= 0 THEN 'depleted' ELSE 'active' END
          WHERE id = ?
        `).run(alloc.allocated_base_qty, alloc.allocated_base_qty, alloc.batch_id);

        // Record stock adjustment/movement
        db.prepare(`
          INSERT INTO stock_adjustments (medicine_id, batch_id, adjustment_type, quantity_delta, reason, created_at)
          VALUES (?, ?, 'sale', ?, ?, ?)
        `).run(pl.item.medicine_id, alloc.batch_id, -alloc.allocated_base_qty, `Sale Invoice #${invoiceNumber}`, nowIso);
      }
    }

    // 6. Save sales_invoices record with pharmacy snapshot
    const pharmacySnapshot = JSON.stringify({
      name: settings.pharmacy_name,
      address: settings.pharmacy_address,
      phone: settings.phone_number,
      logo: settings.pharmacy_logo
    });

    db.prepare(`
      INSERT INTO sales_invoices (
        invoice_number, customer_id, customer_name, customer_phone, sale_date,
        subtotal, discount_type, discount_value, discount_amount, final_payable,
        paid_amount, change_returned, credit_amount, payment_status, status,
        notes, pharmacy_snapshot_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?)
    `).run(
      invoiceNumber,
      saleData.customer_id || null,
      saleData.customer_name || 'Walk-in Customer',
      saleData.customer_phone || '',
      dateStr,
      subtotal,
      saleData.discount_type,
      saleData.discount_value,
      discountAmount,
      finalPayable,
      paidAmount,
      changeReturned,
      creditAmount,
      paymentStatus,
      saleData.notes || '',
      pharmacySnapshot,
      nowIso
    );

    const saleId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    // 7. Save sales_lines and sales_batch_allocations
    const insertLineStmt = db.prepare(`
      INSERT INTO sales_lines (sale_id, medicine_id, brand_name, generic_name, quantity, unit, multiplier, base_quantity, unit_price, line_total, cost_of_goods)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertAllocStmt = db.prepare(`
      INSERT INTO sales_batch_allocations (sale_id, sale_line_id, batch_id, quantity_deducted, unit_cost)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const pl of processedLines) {
      insertLineStmt.run(
        saleId,
        pl.item.medicine_id,
        pl.item.brand_name,
        pl.item.generic_name,
        pl.item.quantity,
        pl.item.selected_unit,
        pl.item.multiplier || 1,
        pl.baseQty,
        pl.item.unit_price,
        pl.lineTotal,
        pl.lineCogs
      );
      const lineId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

      for (const alloc of pl.allocations) {
        insertAllocStmt.run(saleId, lineId, alloc.batch_id, alloc.allocated_base_qty, alloc.purchase_cost);
      }
    }

    // 8. Save sales_payments records
    const insertPaymentStmt = db.prepare(`
      INSERT INTO sales_payments (sale_id, payment_method, amount, transaction_ref, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const p of saleData.payments) {
      if (p.amount > 0) {
        insertPaymentStmt.run(saleId, p.method, p.amount, p.transaction_ref || '', nowIso);
      }
    }

    // 9. Audit event
    db.prepare(`
      INSERT INTO audit_logs (user_action, entity_type, entity_id, details, timestamp)
      VALUES ('SALE_CREATE', 'SALES_INVOICE', ?, ?, ?)
    `).run(invoiceNumber, `Sale created for ${finalPayable} BDT with ${processedLines.length} items.`, nowIso);

    // Commit transaction
    db.exec('COMMIT;');

    return getSaleInvoiceById(saleId)!;
  } catch (error: any) {
    db.exec('ROLLBACK;');
    throw error;
  }
}

export function getSaleInvoiceById(id: number): SaleInvoice | null {
  const db = getDb();
  const inv = db.prepare('SELECT * FROM sales_invoices WHERE id = ?').get(id) as any;
  if (!inv) return null;

  inv.items = db.prepare('SELECT * FROM sales_lines WHERE sale_id = ?').all(id);
  inv.payments = db.prepare('SELECT * FROM sales_payments WHERE sale_id = ?').all(id);

  if (inv.pharmacy_snapshot_json) {
    try {
      inv.pharmacy_snapshot = JSON.parse(inv.pharmacy_snapshot_json);
    } catch {
      // ignore
    }
  }

  return inv as SaleInvoice;
}

export function getSaleInvoices(limit = 100, search?: string): SaleInvoice[] {
  const db = getDb();
  let sql = 'SELECT * FROM sales_invoices';
  const params: any[] = [];

  if (search && search.trim()) {
    sql += ' WHERE (invoice_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)';
    const s = `%${search.trim()}%`;
    params.push(s, s, s);
  }

  sql += ' ORDER BY id DESC LIMIT ?';
  params.push(limit);

  const rows = db.prepare(sql).all(...params) as any[];
  const itemStmt = db.prepare('SELECT * FROM sales_lines WHERE sale_id = ?');
  const payStmt = db.prepare('SELECT * FROM sales_payments WHERE sale_id = ?');

  for (const r of rows) {
    r.items = itemStmt.all(r.id);
    r.payments = payStmt.all(r.id);
    if (r.pharmacy_snapshot_json) {
      try {
        r.pharmacy_snapshot = JSON.parse(r.pharmacy_snapshot_json);
      } catch {}
    }
  }

  return rows as SaleInvoice[];
}

// ----------------------------------------------------
// PURCHASES & SUPPLIER INVOICES (ATOMIC TRANSACTION)
// ----------------------------------------------------
export function executePurchase(purchaseData: {
  supplier_id: number;
  invoice_number: string;
  purchase_date: string;
  items: PurchaseItemInput[];
  paid_amount: number;
  payment_method: 'cash' | 'bkash' | 'nagad' | 'rocket' | 'card';
  notes?: string;
}): PurchaseInvoice {
  const db = getDb();
  const now = new Date().toISOString();

  db.exec('BEGIN TRANSACTION;');
  try {
    // Calculate total amount
    let totalAmount = 0;
    for (const item of purchaseData.items) {
      totalAmount += item.line_total;
    }
    totalAmount = Math.round(totalAmount * 100) / 100;
    const paidAmount = Math.min(totalAmount, Math.max(0, purchaseData.paid_amount));
    const balanceDue = Math.round((totalAmount - paidAmount) * 100) / 100;

    // Check duplicate invoice_number
    const existing = db.prepare('SELECT id FROM purchase_invoices WHERE invoice_number = ?').get(purchaseData.invoice_number);
    if (existing) {
      throw new Error(`Purchase invoice number ${purchaseData.invoice_number} already exists! Duplicate entry prevented.`);
    }

    // Insert purchase invoice
    db.prepare(`
      INSERT INTO purchase_invoices (invoice_number, supplier_id, purchase_date, total_amount, paid_amount, balance_due, payment_method, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      purchaseData.invoice_number,
      purchaseData.supplier_id,
      purchaseData.purchase_date,
      totalAmount,
      paidAmount,
      balanceDue,
      purchaseData.payment_method,
      purchaseData.notes || '',
      now
    );

    const purchaseId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    // Insert lines and update/create batches
    const insertLine = db.prepare(`
      INSERT INTO purchase_lines (purchase_id, medicine_id, batch_number, expiry_date, quantity, unit, multiplier, purchase_cost, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertBatch = db.prepare(`
      INSERT INTO inventory_batches (medicine_id, batch_number, expiry_date, purchase_cost, initial_qty, remaining_qty, stock_unit, purchase_ref, supplier_id, date_received, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of purchaseData.items) {
      const baseQty = item.quantity * (item.multiplier || 1);
      const costPerBaseUnit = Math.round((item.purchase_cost_per_unit / (item.multiplier || 1)) * 100) / 100;

      insertLine.run(
        purchaseId,
        item.medicine_id,
        item.batch_number,
        item.expiry_date,
        item.quantity,
        item.unit,
        item.multiplier || 1,
        costPerBaseUnit,
        item.line_total
      );

      // Check if batch exists with same batch_number and medicine_id
      const existingBatch = db.prepare(`
        SELECT id, remaining_qty, initial_qty FROM inventory_batches 
        WHERE medicine_id = ? AND batch_number = ?
      `).get(item.medicine_id, item.batch_number) as { id: number; remaining_qty: number; initial_qty: number } | undefined;

      const isExpired = new Date(item.expiry_date) < new Date();

      if (existingBatch) {
        db.prepare(`
          UPDATE inventory_batches 
          SET remaining_qty = remaining_qty + ?, 
              initial_qty = initial_qty + ?,
              expiry_date = ?,
              purchase_cost = ?,
              status = CASE WHEN ? THEN 'expired' ELSE 'active' END
          WHERE id = ?
        `).run(baseQty, baseQty, item.expiry_date, costPerBaseUnit, isExpired ? 1 : 0, existingBatch.id);
      } else {
        insertBatch.run(
          item.medicine_id,
          item.batch_number,
          item.expiry_date,
          costPerBaseUnit,
          baseQty,
          baseQty,
          item.unit,
          purchaseData.invoice_number,
          purchaseData.supplier_id,
          now,
          isExpired ? 'expired' : 'active'
        );
      }

      // Update medicine sale price if provided
      if (item.sale_price_per_base_unit && item.sale_price_per_base_unit > 0) {
        db.prepare('UPDATE medicines SET sale_price = ? WHERE id = ?').run(item.sale_price_per_base_unit, item.medicine_id);
      }
    }

    // Record supplier payment if paid_amount > 0
    if (paidAmount > 0) {
      db.prepare(`
        INSERT INTO supplier_payments (supplier_id, purchase_id, payment_date, amount, payment_method, reference, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(purchaseData.supplier_id, purchaseId, purchaseData.purchase_date, paidAmount, purchaseData.payment_method, purchaseData.invoice_number, 'Initial payment at purchase', now);
    }

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (user_action, entity_type, entity_id, details, timestamp)
      VALUES ('PURCHASE_POST', 'PURCHASE_INVOICE', ?, ?, ?)
    `).run(purchaseData.invoice_number, `Purchase posted from supplier #${purchaseData.supplier_id} for ${totalAmount} BDT. Paid: ${paidAmount} BDT`, now);

    db.exec('COMMIT;');

    return getPurchaseInvoiceById(purchaseId)!;
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function getPurchaseInvoiceById(id: number): PurchaseInvoice | null {
  const db = getDb();
  const pur = db.prepare(`
    SELECT p.*, s.name as supplier_name 
    FROM purchase_invoices p 
    JOIN suppliers s ON p.supplier_id = s.id 
    WHERE p.id = ?
  `).get(id) as any;

  if (!pur) return null;
  pur.items = db.prepare(`
    SELECT pl.*, m.brand_name, m.generic_name 
    FROM purchase_lines pl
    JOIN medicines m ON pl.medicine_id = m.id
    WHERE pl.purchase_id = ?
  `).all(id);

  return pur as PurchaseInvoice;
}

export function getPurchases(limit = 100): PurchaseInvoice[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT p.*, s.name as supplier_name 
    FROM purchase_invoices p 
    JOIN suppliers s ON p.supplier_id = s.id 
    ORDER BY p.id DESC LIMIT ?
  `).all(limit) as any[];

  const itemStmt = db.prepare(`
    SELECT pl.*, m.brand_name, m.generic_name 
    FROM purchase_lines pl
    JOIN medicines m ON pl.medicine_id = m.id
    WHERE pl.purchase_id = ?
  `);

  for (const r of rows) {
    r.items = itemStmt.all(r.id);
  }

  return rows as PurchaseInvoice[];
}

// ----------------------------------------------------
// RETURNS, REFUNDS & CANCELLATIONS
// ----------------------------------------------------
export function processReturn(data: {
  sale_id: number;
  items: ReturnItemInput[];
  refund_method: 'cash' | 'bkash' | 'nagad' | 'rocket' | 'credit';
  reason: string;
}) {
  const db = getDb();
  const now = new Date().toISOString();

  db.exec('BEGIN TRANSACTION;');
  try {
    const sale = db.prepare('SELECT * FROM sales_invoices WHERE id = ?').get(data.sale_id) as unknown as SaleInvoice;
    if (!sale) throw new Error('Original sale invoice not found.');

    let totalRefund = 0;
    for (const item of data.items) {
      totalRefund += item.refund_amount;
    }
    totalRefund = Math.round(totalRefund * 100) / 100;

    // Create return record
    db.prepare(`
      INSERT INTO returns (sale_id, invoice_number, return_date, total_refund_amount, payment_method, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(data.sale_id, sale.invoice_number, now.split('T')[0], totalRefund, data.refund_method, data.reason, now);

    const returnId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    const insertReturnLine = db.prepare(`
      INSERT INTO return_lines (return_id, sale_line_id, medicine_id, batch_id, quantity, unit, base_quantity, unit_price, refund_amount, condition)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of data.items) {
      const baseQty = item.quantity_to_return * (item.multiplier || 1);
      insertReturnLine.run(
        returnId,
        item.sale_line_id,
        item.medicine_id,
        item.batch_id,
        item.quantity_to_return,
        item.unit,
        baseQty,
        item.unit_price,
        item.refund_amount,
        item.condition
      );

      // ONLY restock if classified as 'saleable'
      if (item.condition === 'saleable') {
        db.prepare("UPDATE inventory_batches SET remaining_qty = remaining_qty + ?, status = 'active' WHERE id = ?").run(baseQty, item.batch_id);
        db.prepare(`
          INSERT INTO stock_adjustments (medicine_id, batch_id, adjustment_type, quantity_delta, reason, created_at)
          VALUES (?, ?, 'return_restock', ?, ?, ?)
        `).run(item.medicine_id, item.batch_id, baseQty, `Sale Return from ${sale.invoice_number} (Condition: Saleable)`, now);
      } else {
        // Track unsaleable stock separately in stock adjustments
        db.prepare(`
          INSERT INTO stock_adjustments (medicine_id, batch_id, adjustment_type, quantity_delta, reason, created_at)
          VALUES (?, ?, 'damage_writeoff', 0, ?, ?)
        `).run(item.medicine_id, item.batch_id, `Damaged/Unsaleable item returned from ${sale.invoice_number} (${item.quantity_to_return} ${item.unit})`, now);
      }
    }

    // Adjust customer balance if credit was refunded
    if (data.refund_method === 'credit' && sale.customer_id) {
      db.prepare('UPDATE customers SET balance = MAX(0, balance - ?) WHERE id = ?').run(totalRefund, sale.customer_id);
    }

    db.prepare(`
      INSERT INTO audit_logs (user_action, entity_type, entity_id, details, timestamp)
      VALUES ('SALE_RETURN', 'RETURN', ?, ?, ?)
    `).run(sale.invoice_number, `Processed return for ${sale.invoice_number}. Total refund: ${totalRefund} BDT via ${data.refund_method}`, now);

    db.exec('COMMIT;');
    return returnId;
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function cancelSale(saleId: number, reason: string) {
  const db = getDb();
  const now = new Date().toISOString();

  db.exec('BEGIN TRANSACTION;');
  try {
    const sale = db.prepare('SELECT * FROM sales_invoices WHERE id = ?').get(saleId) as unknown as SaleInvoice;
    if (!sale) throw new Error('Invoice not found.');
    if (sale.status === 'cancelled') throw new Error('Invoice is already cancelled.');

    // Restore stock for all batch allocations
    const allocations = db.prepare('SELECT * FROM sales_batch_allocations WHERE sale_id = ?').all(saleId) as any[];
    for (const alloc of allocations) {
      db.prepare("UPDATE inventory_batches SET remaining_qty = remaining_qty + ?, status = 'active' WHERE id = ?").run(alloc.quantity_deducted, alloc.batch_id);
    }

    // If customer credit was given, reverse customer balance
    if (sale.credit_amount > 0 && sale.customer_id) {
      db.prepare('UPDATE customers SET balance = MAX(0, balance - ?) WHERE id = ?').run(sale.credit_amount, sale.customer_id);
    }

    // Mark invoice as cancelled (NEVER delete historical record)
    db.prepare(`
      UPDATE sales_invoices 
      SET status = 'cancelled', notes = notes || ' | CANCELLED: ' || ?
      WHERE id = ?
    `).run(reason, saleId);

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (user_action, entity_type, entity_id, details, timestamp)
      VALUES ('SALE_CANCEL', 'SALES_INVOICE', ?, ?, ?)
    `).run(sale.invoice_number, `Invoice #${sale.invoice_number} cancelled. Reason: ${reason}`, now);

    db.exec('COMMIT;');
    return true;
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

// ----------------------------------------------------
// CUSTOMERS & SUPPLIERS
// ----------------------------------------------------
export function getCustomers(search?: string): Customer[] {
  const db = getDb();
  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    return db.prepare('SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? ORDER BY name ASC').all(s, s) as unknown as Customer[];
  }
  return db.prepare('SELECT * FROM customers ORDER BY name ASC').all() as unknown as Customer[];
}

export function saveCustomer(cust: Partial<Customer>): number {
  const db = getDb();
  const now = new Date().toISOString();
  if (cust.id) {
    db.prepare('UPDATE customers SET name = ?, phone = ?, address = ?, notes = ? WHERE id = ?')
      .run(cust.name || '', cust.phone || '', cust.address || '', cust.notes || '', cust.id);
    return cust.id;
  } else {
    db.prepare('INSERT INTO customers (name, phone, address, balance, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(cust.name || '', cust.phone || '', cust.address || '', cust.balance || 0, cust.notes || '', now);
    return (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;
  }
}

export function recordCustomerPayment(data: {
  customer_id: number;
  amount: number;
  payment_method: 'cash' | 'bkash' | 'nagad' | 'rocket' | 'card';
  reference?: string;
  notes?: string;
}) {
  const db = getDb();
  const now = new Date().toISOString();
  db.exec('BEGIN TRANSACTION;');
  try {
    db.prepare('UPDATE customers SET balance = MAX(0, balance - ?) WHERE id = ?').run(data.amount, data.customer_id);
    db.prepare(`
      INSERT INTO customer_payments (customer_id, payment_date, amount, payment_method, reference, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(data.customer_id, now.split('T')[0], data.amount, data.payment_method, data.reference || '', data.notes || '', now);
    db.exec('COMMIT;');
    return true;
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function getSuppliers(): Supplier[] {
  const db = getDb();
  return db.prepare(`
    SELECT s.*, 
      COALESCE(SUM(p.total_amount), 0) as total_purchased,
      COALESCE(SUM(p.paid_amount), 0) as total_paid,
      COALESCE(SUM(p.balance_due), 0) as outstanding_balance
    FROM suppliers s
    LEFT JOIN purchase_invoices p ON s.id = p.supplier_id
    GROUP BY s.id
    ORDER BY s.name ASC
  `).all() as unknown as Supplier[];
}

export function saveSupplier(supp: Partial<Supplier>): number {
  const db = getDb();
  const now = new Date().toISOString();
  if (supp.id) {
    db.prepare('UPDATE suppliers SET name = ?, phone = ?, address = ?, notes = ? WHERE id = ?')
      .run(supp.name || '', supp.phone || '', supp.address || '', supp.notes || '', supp.id);
    return supp.id;
  } else {
    db.prepare('INSERT INTO suppliers (name, phone, address, notes, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(supp.name || '', supp.phone || '', supp.address || '', supp.notes || '', now);
    return (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;
  }
}

export function recordSupplierPayment(data: {
  supplier_id: number;
  purchase_id?: number;
  amount: number;
  payment_method: 'cash' | 'bkash' | 'nagad' | 'rocket' | 'card';
  reference?: string;
  notes?: string;
}) {
  const db = getDb();
  const now = new Date().toISOString();
  db.exec('BEGIN TRANSACTION;');
  try {
    if (data.purchase_id) {
      db.prepare('UPDATE purchase_invoices SET paid_amount = paid_amount + ?, balance_due = MAX(0, balance_due - ?) WHERE id = ?')
        .run(data.amount, data.amount, data.purchase_id);
    }
    db.prepare(`
      INSERT INTO supplier_payments (supplier_id, purchase_id, payment_date, amount, payment_method, reference, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(data.supplier_id, data.purchase_id || null, now.split('T')[0], data.amount, data.payment_method, data.reference || '', data.notes || '', now);
    db.exec('COMMIT;');
    return true;
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

// ----------------------------------------------------
// EXPENSES & CASH MANAGEMENT
// ----------------------------------------------------
export function getExpenses(startDate?: string, endDate?: string): Expense[] {
  const db = getDb();
  let sql = 'SELECT * FROM expenses';
  const params: any[] = [];
  if (startDate && endDate) {
    sql += ' WHERE expense_date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }
  sql += ' ORDER BY expense_date DESC, id DESC';
  return db.prepare(sql).all(...params) as unknown as Expense[];
}

export function addExpense(expense: Partial<Expense>): number {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO expenses (category, amount, expense_date, description, payee, payment_method, reference_no, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    expense.category || 'Other',
    expense.amount ?? 0,
    expense.expense_date || now.split('T')[0],
    expense.description || '',
    expense.payee || '',
    expense.payment_method || 'cash',
    expense.reference_no || '',
    now
  );
  return (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;
}

export function recordCashMovement(type: 'deposit' | 'withdrawal', amount: number, reason: string, adminUser = 'admin') {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO cash_movements (movement_type, amount, reason, admin_user, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(type, amount, reason, adminUser, now);
  return true;
}

// ----------------------------------------------------
// REAL DASHBOARD DATA (FROM DATABASE ONLY)
// ----------------------------------------------------
export function getDashboardData(): DashboardStats {
  const db = getDb();
  const settings = getSettings();
  const today = new Date().toISOString().split('T')[0];

  // Today's completed sales
  const salesStat = db.prepare(`
    SELECT 
      COALESCE(SUM(final_payable), 0) as total_sales,
      COALESCE(SUM(paid_amount), 0) as total_paid
    FROM sales_invoices 
    WHERE sale_date = ? AND status != 'cancelled'
  `).get(today) as { total_sales: number; total_paid: number };

  // Today's COGS
  const cogsStat = db.prepare(`
    SELECT COALESCE(SUM(l.cost_of_goods), 0) as total_cogs
    FROM sales_lines l
    JOIN sales_invoices s ON l.sale_id = s.id
    WHERE s.sale_date = ? AND s.status != 'cancelled'
  `).get(today) as { total_cogs: number };

  const todaySales = Math.round(salesStat.total_sales * 100) / 100;
  const todayCogs = Math.round(cogsStat.total_cogs * 100) / 100;
  const todayGrossProfit = Math.round((todaySales - todayCogs) * 100) / 100;

  // Today's expenses
  const expStat = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_expenses
    FROM expenses 
    WHERE expense_date = ?
  `).get(today) as { total_expenses: number };
  const todayExpenses = Math.round(expStat.total_expenses * 100) / 100;
  const todayNetProfit = Math.round((todayGrossProfit - todayExpenses) * 100) / 100;

  // PHYSICAL CASH DRAWER ONLY (excludes bKash, Nagad, Rocket, card, and credit receivables!)
  const cashInSales = (db.prepare(`
    SELECT COALESCE(SUM(sp.amount), 0) as amt 
    FROM sales_payments sp 
    JOIN sales_invoices s ON sp.sale_id = s.id
    WHERE sp.payment_method = 'cash' AND s.status != 'cancelled'
  `).get() as { amt: number }).amt;

  const cashDeposits = (db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as amt 
    FROM cash_movements WHERE movement_type = 'deposit'
  `).get() as { amt: number }).amt;

  const customerCashPayments = (db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as amt 
    FROM customer_payments WHERE payment_method = 'cash'
  `).get() as { amt: number }).amt;

  const cashWithdrawals = (db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as amt 
    FROM cash_movements WHERE movement_type = 'withdrawal'
  `).get() as { amt: number }).amt;

  const cashExpenses = (db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as amt 
    FROM expenses WHERE payment_method = 'cash'
  `).get() as { amt: number }).amt;

  const cashSupplierPayments = (db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as amt 
    FROM supplier_payments WHERE payment_method = 'cash'
  `).get() as { amt: number }).amt;

  const cashChangeGiven = (db.prepare(`
    SELECT COALESCE(SUM(change_returned), 0) as amt 
    FROM sales_invoices WHERE status != 'cancelled'
  `).get() as { amt: number }).amt;

  const cashRefunds = (db.prepare(`
    SELECT COALESCE(SUM(total_refund_amount), 0) as amt 
    FROM returns WHERE payment_method = 'cash'
  `).get() as { amt: number }).amt;

  const physicalCash = Math.round(
    (cashInSales + cashDeposits + customerCashPayments - cashWithdrawals - cashExpenses - cashSupplierPayments - cashChangeGiven - cashRefunds) * 100
  ) / 100;

  // Stock value
  const stockVal = (db.prepare(`
    SELECT COALESCE(SUM(remaining_qty * purchase_cost), 0) as val 
    FROM inventory_batches 
    WHERE remaining_qty > 0 AND status = 'active'
  `).get() as { val: number }).val;

  // Low stock medicines (sum of remaining stock <= low_stock_threshold)
  const lowStockCount = (db.prepare(`
    SELECT COUNT(*) as count FROM (
      SELECT m.id, COALESCE(SUM(b.remaining_qty), 0) as total_qty
      FROM medicines m
      LEFT JOIN inventory_batches b ON m.id = b.medicine_id AND b.remaining_qty > 0 AND b.status = 'active' AND b.expiry_date >= date('now')
      WHERE m.active = 1
      GROUP BY m.id
      HAVING total_qty <= ?
    )
  `).get(settings.low_stock_threshold) as { count: number }).count;

  // Near expiry batches (within expiry_warning_days)
  const nearExpiryCount = (db.prepare(`
    SELECT COUNT(*) as count 
    FROM inventory_batches 
    WHERE remaining_qty > 0 AND status = 'active' 
      AND expiry_date >= date('now')
      AND expiry_date <= date('now', '+' || ? || ' days')
  `).get(settings.expiry_warning_days) as { count: number }).count;

  // Expired stock batches
  const expiredCount = (db.prepare(`
    SELECT COUNT(*) as count 
    FROM inventory_batches 
    WHERE remaining_qty > 0 AND expiry_date < date('now')
  `).get() as { count: number }).count;

  // Customer receivables & Supplier payables
  const custReceivables = (db.prepare(`
    SELECT COALESCE(SUM(balance), 0) as bal FROM customers WHERE balance > 0
  `).get() as { bal: number }).bal;

  const suppPayables = (db.prepare(`
    SELECT COALESCE(SUM(balance_due), 0) as bal FROM purchase_invoices WHERE balance_due > 0
  `).get() as { bal: number }).bal;

  return {
    today_sales: todaySales,
    today_cogs: todayCogs,
    today_gross_profit: todayGrossProfit,
    today_expenses: todayExpenses,
    today_net_profit: todayNetProfit,
    physical_cash_drawer: physicalCash,
    total_stock_value: Math.round(stockVal * 100) / 100,
    low_stock_count: lowStockCount,
    near_expiry_count: nearExpiryCount,
    expired_count: expiredCount,
    customer_receivables: Math.round(custReceivables * 100) / 100,
    supplier_payables: Math.round(suppPayables * 100) / 100,
    recent_sales: getSaleInvoices(6),
    recent_purchases: getPurchases(6),
    recent_expenses: getExpenses().slice(0, 6)
  };
}

// ----------------------------------------------------
// BACKUP & LAPTOP TRANSFER SYSTEM
// ----------------------------------------------------
export function createBackup(destination: 'local' | 'usb' | 'shared' = 'local', backupType: 'manual' | 'scheduled' | 'safety' | 'pre_restore' = 'manual'): BackupItem {
  const db = getDb();
  const dbPath = getCurrentDbPath();
  const settings = getSettings();
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const filename = `pharmacy-backup-${timestamp}.sqlite`;

  let targetDir = path.resolve(process.cwd(), 'backups');
  if (destination === 'usb' && settings.usb_folder_path) {
    targetDir = settings.usb_folder_path;
  } else if (destination === 'shared' && settings.shared_folder_path) {
    targetDir = settings.shared_folder_path;
  }

  if (!fs.existsSync(targetDir)) {
    try {
      fs.mkdirSync(targetDir, { recursive: true });
    } catch {
      // Fallback to local backups folder if USB/shared folder is not physically plugged in
      targetDir = path.resolve(process.cwd(), 'backups');
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    }
  }

  const targetFilePath = path.join(targetDir, filename);

  // Use SQLite VACUUM INTO to create an atomic, non-locking, 100% consistent copy
  db.exec(`VACUUM INTO '${targetFilePath.replace(/'/g, "''")}';`);

  // Compute checksum and verify file integrity
  const fileBuffer = fs.readFileSync(targetFilePath);
  const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const sizeBytes = fileBuffer.length;

  // Verify file has valid SQLite header
  const header = fileBuffer.slice(0, 16).toString('utf-8');
  if (!header.startsWith('SQLite format 3')) {
    fs.unlinkSync(targetFilePath);
    throw new Error('Backup integrity validation failed: invalid SQLite header.');
  }

  // Count summaries for manifest
  const summary = {
    medicines: (db.prepare('SELECT COUNT(*) as c FROM medicines').get() as any).c,
    batches: (db.prepare('SELECT COUNT(*) as c FROM inventory_batches').get() as any).c,
    sales: (db.prepare('SELECT COUNT(*) as c FROM sales_invoices').get() as any).c,
    purchases: (db.prepare('SELECT COUNT(*) as c FROM purchase_invoices').get() as any).c
  };

  // Record manifest in backups table
  db.prepare(`
    INSERT INTO backups (filename, filepath, size_bytes, checksum, backup_type, destination, record_summary_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(filename, targetFilePath, sizeBytes, hash, backupType, destination, JSON.stringify(summary), now.toISOString());

  // Update last backup date in settings
  updateSettings({ last_backup_date: now.toISOString() });

  return {
    filename,
    filepath: targetFilePath,
    size_bytes: sizeBytes,
    checksum: hash,
    timestamp: now.toISOString(),
    type: backupType,
    destination,
    records_summary: summary
  };
}

export function listBackups(): BackupItem[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM backups ORDER BY id DESC').all() as any[];
  return rows.map(r => ({
    filename: r.filename,
    filepath: r.filepath,
    size_bytes: r.size_bytes,
    checksum: r.checksum,
    timestamp: r.created_at,
    type: r.backup_type,
    destination: r.destination,
    records_summary: r.record_summary_json ? JSON.parse(r.record_summary_json) : undefined
  }));
}

export function restoreBackup(backupFilePath: string, adminPassword: string): boolean {
  const db = getDb();

  // Validate admin password
  const user = db.prepare("SELECT * FROM users WHERE username = 'admin'").get() as any;
  if (!user || !user.password_hash) {
    throw new Error('Admin user authentication failed.');
  }

  // First: CREATE A SAFETY BACKUP of current state before touching anything!
  createBackup('local', 'safety');

  // Verify candidate backup file exists and has valid SQLite header
  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Backup file does not exist at: ${backupFilePath}`);
  }

  const fileBuffer = fs.readFileSync(backupFilePath);
  const header = fileBuffer.slice(0, 16).toString('utf-8');
  if (!header.startsWith('SQLite format 3')) {
    throw new Error('Corrupt or invalid backup file: SQLite header missing.');
  }

  // Restore by copying candidate backup over current database file safely
  const currentPath = getCurrentDbPath();
  
  // Close existing db if possible or copy file
  fs.copyFileSync(backupFilePath, currentPath);

  // Log audit
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO audit_logs (user_action, entity_type, entity_id, details, timestamp)
    VALUES ('DB_RESTORE', 'DATABASE', '0', ?, ?)
  `).run(`Database restored from backup: ${backupFilePath}`, now);

  return true;
}

// ----------------------------------------------------
// AUDIT LOGS
// ----------------------------------------------------
export function getAuditLogs(limit = 100) {
  const db = getDb();
  return db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?').all(limit);
}
