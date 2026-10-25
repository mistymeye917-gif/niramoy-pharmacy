import { DatabaseSync } from 'node:sqlite';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

let dbInstance: DatabaseSync | null = null;
let currentDbPath = '';

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return dbInstance;
}

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, actualSalt, 64);
  return {
    hash: derivedKey.toString('hex'),
    salt: actualSalt
  };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), derivedKey);
}

export function initDatabase(dbFilePath?: string): DatabaseSync {
  const defaultDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true });
  }

  const targetPath = dbFilePath || path.join(defaultDir, 'pharmacy.db');
  currentDbPath = targetPath;

  const db = new DatabaseSync(targetPath);
  dbInstance = db;

  // Enforce WAL mode and foreign key integrity
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');

  // Schema creation
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      recovery_key_hash TEXT NOT NULL,
      recovery_key_display TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_name TEXT NOT NULL,
      generic_name TEXT NOT NULL,
      manufacturer TEXT NOT NULL,
      strength TEXT NOT NULL,
      dosage_form TEXT NOT NULL,
      base_unit TEXT NOT NULL,
      barcode TEXT,
      sale_price REAL NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS unit_conversions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medicine_id INTEGER NOT NULL,
      unit_name TEXT NOT NULL,
      multiplier INTEGER NOT NULL,
      FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE,
      UNIQUE (medicine_id, unit_name)
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT,
      balance REAL NOT NULL DEFAULT 0.0,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medicine_id INTEGER NOT NULL,
      batch_number TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      purchase_cost REAL NOT NULL,
      initial_qty INTEGER NOT NULL,
      remaining_qty INTEGER NOT NULL,
      stock_unit TEXT NOT NULL,
      purchase_ref TEXT,
      supplier_id INTEGER,
      date_received TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE RESTRICT,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS purchase_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      supplier_id INTEGER NOT NULL,
      purchase_date TEXT NOT NULL,
      total_amount REAL NOT NULL,
      paid_amount REAL NOT NULL,
      balance_due REAL NOT NULL,
      payment_method TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS purchase_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL,
      medicine_id INTEGER NOT NULL,
      batch_number TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit TEXT NOT NULL,
      multiplier INTEGER NOT NULL,
      purchase_cost REAL NOT NULL,
      line_total REAL NOT NULL,
      FOREIGN KEY (purchase_id) REFERENCES purchase_invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS sales_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER,
      customer_name TEXT,
      customer_phone TEXT,
      sale_date TEXT NOT NULL,
      subtotal REAL NOT NULL,
      discount_type TEXT NOT NULL DEFAULT 'percentage',
      discount_value REAL NOT NULL DEFAULT 0.0,
      discount_amount REAL NOT NULL DEFAULT 0.0,
      final_payable REAL NOT NULL,
      paid_amount REAL NOT NULL,
      change_returned REAL NOT NULL DEFAULT 0.0,
      credit_amount REAL NOT NULL DEFAULT 0.0,
      payment_status TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      notes TEXT,
      pharmacy_snapshot_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS sales_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      medicine_id INTEGER NOT NULL,
      brand_name TEXT NOT NULL,
      generic_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit TEXT NOT NULL,
      multiplier INTEGER NOT NULL,
      base_quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      line_total REAL NOT NULL,
      cost_of_goods REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales_invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS sales_batch_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      sale_line_id INTEGER NOT NULL,
      batch_id INTEGER NOT NULL,
      quantity_deducted INTEGER NOT NULL,
      unit_cost REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales_invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (sale_line_id) REFERENCES sales_lines(id) ON DELETE CASCADE,
      FOREIGN KEY (batch_id) REFERENCES inventory_batches(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS sales_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      payment_method TEXT NOT NULL,
      amount REAL NOT NULL,
      transaction_ref TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales_invoices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS customer_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      sale_id INTEGER,
      payment_date TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      reference TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS supplier_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL,
      purchase_id INTEGER,
      payment_date TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      reference TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      expense_date TEXT NOT NULL,
      description TEXT NOT NULL,
      payee TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      reference_no TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      invoice_number TEXT NOT NULL,
      return_date TEXT NOT NULL,
      total_refund_amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales_invoices(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS return_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER NOT NULL,
      sale_line_id INTEGER NOT NULL,
      medicine_id INTEGER NOT NULL,
      batch_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit TEXT NOT NULL,
      base_quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      refund_amount REAL NOT NULL,
      condition TEXT NOT NULL,
      FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE CASCADE,
      FOREIGN KEY (sale_line_id) REFERENCES sales_lines(id) ON DELETE RESTRICT,
      FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE RESTRICT,
      FOREIGN KEY (batch_id) REFERENCES inventory_batches(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medicine_id INTEGER NOT NULL,
      batch_id INTEGER NOT NULL,
      adjustment_type TEXT NOT NULL,
      quantity_delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE RESTRICT,
      FOREIGN KEY (batch_id) REFERENCES inventory_batches(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS cash_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      movement_type TEXT NOT NULL,
      amount REAL NOT NULL,
      reason TEXT NOT NULL,
      admin_user TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      checksum TEXT NOT NULL,
      backup_type TEXT NOT NULL,
      destination TEXT NOT NULL,
      record_summary_json TEXT,
      created_at TEXT NOT NULL
    );

    -- Performance and integrity indexes
    CREATE INDEX IF NOT EXISTS idx_medicines_brand ON medicines(brand_name);
    CREATE INDEX IF NOT EXISTS idx_medicines_generic ON medicines(generic_name);
    CREATE INDEX IF NOT EXISTS idx_medicines_barcode ON medicines(barcode);
    CREATE INDEX IF NOT EXISTS idx_batches_med_expiry ON inventory_batches(medicine_id, expiry_date, remaining_qty);
    CREATE INDEX IF NOT EXISTS idx_sales_invoice_no ON sales_invoices(invoice_number);
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales_invoices(sale_date);
    CREATE INDEX IF NOT EXISTS idx_purchases_invoice_no ON purchase_invoices(invoice_number);
  `);

  // Default settings
  const defaultSettings: Record<string, string> = {
    pharmacy_name: 'Niramoy Pharma & Health',
    pharmacy_address: 'House #12, Road #4, Dhanmondi, Dhaka-1205, Bangladesh',
    phone_number: '+880 1712-345678',
    pharmacy_logo: '',
    default_language: 'bn',
    currency: '৳',
    default_discount_behavior: 'percentage',
    low_stock_threshold: '10',
    expiry_warning_days: '30',
    receipt_language: 'bn',
    receipt_layout: 'full',
    selected_printer: 'POS-80 Thermal Printer',
    auto_backup_enabled: 'true',
    auto_backup_schedule: 'daily',
    shared_folder_path: 'C:\\PharmacyBackups\\NetworkShare',
    usb_folder_path: 'D:\\Pharmacy_USB_Backup',
    inactivity_lock_minutes: '15',
    database_version: '1.0.0',
    last_backup_date: ''
  };

  const getSettingStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  const insertSettingStmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');

  for (const [key, value] of Object.entries(defaultSettings)) {
    insertSettingStmt.run(key, value);
  }

  // Ensure default administrator exists
  const checkUserStmt = db.prepare('SELECT COUNT(*) as count FROM users');
  const userCount = (checkUserStmt.get() as { count: number }).count;

  if (userCount === 0) {
    const defaultPassword = 'admin';
    const { hash, salt } = hashPassword(defaultPassword);
    const recoveryKey = 'NIRAMOY-' + crypto.randomBytes(4).toString('hex').toUpperCase() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const recoveryHash = hashPassword(recoveryKey).hash;

    const insertUserStmt = db.prepare(`
      INSERT INTO users (username, password_hash, salt, recovery_key_hash, recovery_key_display, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertUserStmt.run('admin', hash, salt, recoveryHash, recoveryKey, new Date().toISOString());
  }

  // Ensure seed data is populated if empty
  populateSeedData(db);

  return db;
}

export function getCurrentDbPath(): string {
  return currentDbPath;
}

function populateSeedData(db: DatabaseSync) {
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM medicines');
  const medCount = (countStmt.get() as { count: number }).count;
  if (medCount > 0) return;

  // Real Bangladeshi Suppliers
  const insertSupplier = db.prepare(`
    INSERT INTO suppliers (name, phone, address, notes, created_at) VALUES (?, ?, ?, ?, ?)
  `);
  const now = new Date().toISOString();
  insertSupplier.run('Square Pharmaceuticals PLC', '+880 2-8833047', 'Square Centre, 48 Mohakhali C/A, Dhaka-1212', 'Primary supplier for Napa, Seclo', now);
  insertSupplier.run('Beximco Pharmaceuticals Ltd', '+880 2-58611001', '19 Dhanmondi R/A, Road 7, Dhaka-1205', 'Napa Extra, Ace, Maxpro supplier', now);
  insertSupplier.run('Incepta Pharmaceuticals Ltd', '+880 2-8891688', '40 Shahid Tajuddin Ahmed Sarani, Tejgaon, Dhaka', 'Monas, Pantonix supplier', now);
  insertSupplier.run('Renata PLC', '+880 2-8001450', 'Plot # 1, Milk Vita Road, Section-7, Mirpur, Dhaka', 'Maxpro, Fexo, Rolac supplier', now);
  insertSupplier.run('The ACME Laboratories Ltd', '+880 2-9004194', 'Court de la ACME, 1/4 Kallayanpur, Mirpur Road, Dhaka', 'Tenoloc, Ometid, Fast supplier', now);

  // Common Bangladeshi Customers
  const insertCustomer = db.prepare(`
    INSERT INTO customers (name, phone, address, balance, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertCustomer.run('Rafiqul Islam', '+880 1819-234567', 'House 45, Road 8, Dhanmondi', 0.0, 'Regular neighborhood customer', now);
  insertCustomer.run('Shamima Akter', '+880 1711-876543', 'Flat 3B, Lake View Apt, Dhanmondi', 240.0, 'Monthly chronic prescription buyer', now);
  insertCustomer.run('Kabir Hossain', '+880 1912-349876', '120 Green Road, Farmgate, Dhaka', 0.0, 'Corporate client', now);

  // Realistic Bangladesh Top Medicines
  const medicinesData = [
    {
      brand: 'Napa 500mg',
      generic: 'Paracetamol',
      company: 'Beximco Pharmaceuticals Ltd',
      strength: '500 mg',
      dosage: 'Tablet',
      base_unit: 'Tablet',
      barcode: '8901234567890',
      sale_price: 1.20,
      conversions: [{ name: 'Strip', multiplier: 10 }, { name: 'Box', multiplier: 500 }],
      batches: [
        { batch_no: 'NPA-24B01', expiry: getFutureDate(365), cost: 0.95, qty: 1000, supplier_id: 2 },
        { batch_no: 'NPA-23K09', expiry: getFutureDate(180), cost: 0.92, qty: 450, supplier_id: 2 }
      ]
    },
    {
      brand: 'Napa Extra',
      generic: 'Paracetamol 500mg + Caffeine 65mg',
      company: 'Beximco Pharmaceuticals Ltd',
      strength: '500mg + 65mg',
      dosage: 'Tablet',
      base_unit: 'Tablet',
      barcode: '8901234567891',
      sale_price: 2.50,
      conversions: [{ name: 'Strip', multiplier: 10 }, { name: 'Box', multiplier: 200 }],
      batches: [
        { batch_no: 'NX-2401', expiry: getFutureDate(400), cost: 2.00, qty: 600, supplier_id: 2 }
      ]
    },
    {
      brand: 'Seclo 20mg',
      generic: 'Omeprazole',
      company: 'Square Pharmaceuticals PLC',
      strength: '20 mg',
      dosage: 'Capsule',
      base_unit: 'Capsule',
      barcode: '8901234567892',
      sale_price: 6.00,
      conversions: [{ name: 'Strip', multiplier: 10 }, { name: 'Box', multiplier: 100 }],
      batches: [
        { batch_no: 'SCL-2405', expiry: getFutureDate(280), cost: 4.80, qty: 300, supplier_id: 1 },
        { batch_no: 'SCL-2311', expiry: getFutureDate(25), cost: 4.70, qty: 80, supplier_id: 1 } // Near expiry for testing
      ]
    },
    {
      brand: 'Sergel 20mg',
      generic: 'Esomeprazole',
      company: 'Healthcare Pharmaceuticals Ltd',
      strength: '20 mg',
      dosage: 'Capsule',
      base_unit: 'Capsule',
      barcode: '8901234567893',
      sale_price: 7.00,
      conversions: [{ name: 'Strip', multiplier: 10 }, { name: 'Box', multiplier: 100 }],
      batches: [
        { batch_no: 'SRG-9801', expiry: getFutureDate(450), cost: 5.60, qty: 400, supplier_id: 1 }
      ]
    },
    {
      brand: 'Monas 10mg',
      generic: 'Montelukast',
      company: 'Acme Laboratories Ltd',
      strength: '10 mg',
      dosage: 'Tablet',
      base_unit: 'Tablet',
      barcode: '8901234567894',
      sale_price: 16.00,
      conversions: [{ name: 'Strip', multiplier: 10 }, { name: 'Box', multiplier: 30 }],
      batches: [
        { batch_no: 'MNS-2408', expiry: getFutureDate(320), cost: 13.00, qty: 150, supplier_id: 5 }
      ]
    },
    {
      brand: 'Fexo 120mg',
      generic: 'Fexofenadine HCl',
      company: 'Square Pharmaceuticals PLC',
      strength: '120 mg',
      dosage: 'Tablet',
      base_unit: 'Tablet',
      barcode: '8901234567895',
      sale_price: 9.00,
      conversions: [{ name: 'Strip', multiplier: 10 }, { name: 'Box', multiplier: 50 }],
      batches: [
        { batch_no: 'FXO-24A', expiry: getFutureDate(500), cost: 7.20, qty: 250, supplier_id: 1 }
      ]
    },
    {
      brand: 'Ceevit 250mg',
      generic: 'Ascorbic Acid (Vitamin C)',
      company: 'Square Pharmaceuticals PLC',
      strength: '250 mg',
      dosage: 'Tablet',
      base_unit: 'Tablet',
      barcode: '8901234567896',
      sale_price: 2.00,
      conversions: [{ name: 'Strip', multiplier: 10 }, { name: 'Box', multiplier: 200 }],
      batches: [
        { batch_no: 'CVT-2403', expiry: getFutureDate(380), cost: 1.50, qty: 500, supplier_id: 1 }
      ]
    },
    {
      brand: 'Zimax 500mg',
      generic: 'Azithromycin',
      company: 'Beximco Pharmaceuticals Ltd',
      strength: '500 mg',
      dosage: 'Tablet',
      base_unit: 'Tablet',
      barcode: '8901234567897',
      sale_price: 35.00,
      conversions: [{ name: 'Strip', multiplier: 6 }, { name: 'Box', multiplier: 18 }],
      batches: [
        { batch_no: 'ZMX-2490', expiry: getFutureDate(360), cost: 28.00, qty: 90, supplier_id: 2 }
      ]
    },
    {
      brand: 'Tofen Syrup',
      generic: 'Ketotifen',
      company: 'Beximco Pharmaceuticals Ltd',
      strength: '1 mg / 5 ml (100ml)',
      dosage: 'Syrup',
      base_unit: 'Bottle',
      barcode: '8901234567898',
      sale_price: 75.00,
      conversions: [{ name: 'Pack of 6', multiplier: 6 }],
      batches: [
        { batch_no: 'TFN-24B', expiry: getFutureDate(240), cost: 60.00, qty: 35, supplier_id: 2 }
      ]
    },
    {
      brand: 'Alatrol 10mg',
      generic: 'Cetirizine Dihydrochloride',
      company: 'Square Pharmaceuticals PLC',
      strength: '10 mg',
      dosage: 'Tablet',
      base_unit: 'Tablet',
      barcode: '8901234567899',
      sale_price: 3.50,
      conversions: [{ name: 'Strip', multiplier: 10 }, { name: 'Box', multiplier: 100 }],
      batches: [
        { batch_no: 'ALT-2402', expiry: getFutureDate(420), cost: 2.70, qty: 300, supplier_id: 1 }
      ]
    },
    {
      brand: 'Low Stock Test Item (Ace 500mg)',
      generic: 'Paracetamol',
      company: 'Square Pharmaceuticals PLC',
      strength: '500 mg',
      dosage: 'Tablet',
      base_unit: 'Tablet',
      barcode: '8901234567800',
      sale_price: 1.20,
      conversions: [{ name: 'Strip', multiplier: 10 }],
      batches: [
        { batch_no: 'ACE-LOW', expiry: getFutureDate(200), cost: 0.90, qty: 5, supplier_id: 1 } // Low stock threshold test (< 10)
      ]
    },
    {
      brand: 'Expired Test Batch Item',
      generic: 'Expired Antibiotic',
      company: 'Incepta Pharmaceuticals Ltd',
      strength: '250 mg',
      dosage: 'Capsule',
      base_unit: 'Capsule',
      barcode: '8901234567801',
      sale_price: 15.00,
      conversions: [{ name: 'Strip', multiplier: 10 }],
      batches: [
        { batch_no: 'EXP-TEST-99', expiry: getFutureDate(-45), cost: 10.00, qty: 20, supplier_id: 3 } // Already expired
      ]
    }
  ];

  const insertMedStmt = db.prepare(`
    INSERT INTO medicines (brand_name, generic_name, manufacturer, strength, dosage_form, base_unit, barcode, sale_price, active, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, '', ?, ?)
  `);

  const insertConvStmt = db.prepare(`
    INSERT INTO unit_conversions (medicine_id, unit_name, multiplier) VALUES (?, ?, ?)
  `);

  const insertBatchStmt = db.prepare(`
    INSERT INTO inventory_batches (medicine_id, batch_number, expiry_date, purchase_cost, initial_qty, remaining_qty, stock_unit, purchase_ref, supplier_id, date_received, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const m of medicinesData) {
    insertMedStmt.run(m.brand, m.generic, m.company, m.strength, m.dosage, m.base_unit, m.barcode, m.sale_price, now, now);
    const medId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    for (const conv of m.conversions) {
      insertConvStmt.run(medId, conv.name, conv.multiplier);
    }

    for (const b of m.batches) {
      const isExpired = new Date(b.expiry) < new Date();
      insertBatchStmt.run(
        medId,
        b.batch_no,
        b.expiry,
        b.cost,
        b.qty,
        b.qty,
        m.base_unit,
        'INIT-STOCK',
        b.supplier_id,
        now,
        isExpired ? 'expired' : 'active'
      );
    }
  }

  // Pre-seed some initial expense records
  const insertExp = db.prepare(`
    INSERT INTO expenses (category, amount, expense_date, description, payee, payment_method, reference_no, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertExp.run('Utilities', 3200.00, new Date().toISOString().split('T')[0], 'Electricity bill (DESCO)', 'DESCO Dhaka', 'bkash', 'TXN-DESCO-992', now);
  insertExp.run('Packaging & Bags', 850.00, new Date().toISOString().split('T')[0], 'Pharmacy medicine bags & envelopes', 'City Paper Store', 'cash', '', now);

  // Initial cash drawer float
  const insertCash = db.prepare(`
    INSERT INTO cash_movements (movement_type, amount, reason, admin_user, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertCash.run('deposit', 5000.00, 'Initial daily drawer cash opening float', 'admin', now);

  // Audit log entry
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (user_action, entity_type, entity_id, details, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertAudit.run('SYSTEM_INIT', 'SYSTEM', '0', 'Initial database schema and Bangladesh pharmaceutical catalog provisioned', now);
}

function getFutureDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
}
