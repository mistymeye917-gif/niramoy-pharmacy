import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { createServer as createViteServer } from 'vite';
import { initDatabase, getDb, hashPassword, verifyPassword } from './src/db/database.ts';
import { isCloudSyncConfigured, restoreDatabaseFromCloudIfConfigured, syncDatabaseToCloud } from './src/db/cloudSync.ts';
import * as services from './src/db/services.ts';
import * as XLSX from 'xlsx';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '50mb' }));

// Automatic write-through cloud sync to Turso after successful API mutations
app.use('/api', (req, res, next) => {
  const isReadOrPreview =
    req.method === 'GET' ||
    req.method === 'HEAD' ||
    req.method === 'OPTIONS' ||
    req.path === '/auth/login' ||
    (req.path === '/medicines/import-excel' && req.body?.mode === 'preview');

  if (isReadOrPreview || !isCloudSyncConfigured()) {
    return next();
  }

  const origJson = res.json.bind(res);
  let sent = false;
  res.json = ((body: any) => {
    if (sent) return res;
    sent = true;
    if (res.statusCode >= 200 && res.statusCode < 300) {
      syncDatabaseToCloud()
        .catch((err) => console.error('[Cloud Sync] Upload error:', err.message))
        .finally(() => origJson(body));
      return res;
    }
    return origJson(body);
  }) as any;

  next();
});

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// Settings
app.get('/api/settings', (req: Request, res: Response) => {
  try {
    const s = services.getSettings();
    res.json(s);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', (req: Request, res: Response) => {
  try {
    services.updateSettings(req.body);
    res.json({ success: true, settings: services.getSettings() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Auth & Admin Security
app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }
    const db = getDb();
    const user = db.prepare("SELECT * FROM users WHERE username = 'admin'").get() as any;
    if (!user) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    const isValid = verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid administrator password' });
    }

    res.json({
      success: true,
      username: 'admin',
      recovery_key: user.recovery_key_display
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/change-password', (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const db = getDb();
    const user = db.prepare("SELECT * FROM users WHERE username = 'admin'").get() as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!verifyPassword(currentPassword, user.password_hash, user.salt)) {
      return res.status(401).json({ error: 'Current password incorrect' });
    }

    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: 'New password must be at least 4 characters long' });
    }

    const { hash, salt } = hashPassword(newPassword);
    db.prepare("UPDATE users SET password_hash = ?, salt = ? WHERE username = 'admin'").run(hash, salt);

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/recover-password', (req: Request, res: Response) => {
  try {
    const { recoveryKey, newPassword } = req.body;
    const db = getDb();
    const user = db.prepare("SELECT * FROM users WHERE username = 'admin'").get() as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!recoveryKey || recoveryKey.trim().toUpperCase() !== user.recovery_key_display.toUpperCase()) {
      return res.status(401).json({ error: 'Invalid master recovery key' });
    }

    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: 'New password must be at least 4 characters long' });
    }

    const { hash, salt } = hashPassword(newPassword);
    db.prepare("UPDATE users SET password_hash = ?, salt = ? WHERE username = 'admin'").run(hash, salt);

    res.json({ success: true, message: 'Admin password reset successfully via master recovery key' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Dashboard
app.get('/api/dashboard', (req: Request, res: Response) => {
  try {
    const data = services.getDashboardData();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Medicines
app.get('/api/medicines', (req: Request, res: Response) => {
  try {
    const search = req.query.search as string;
    const activeOnly = req.query.activeOnly === 'true';
    const meds = services.getMedicines(search, activeOnly);
    res.json(meds);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/medicines/:id', (req: Request, res: Response) => {
  try {
    const med = services.getMedicineById(parseInt(req.params.id, 10));
    if (!med) return res.status(404).json({ error: 'Medicine not found' });
    res.json(med);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/medicines', (req: Request, res: Response) => {
  try {
    const { medicine, conversions } = req.body;
    const id = services.saveMedicine(medicine, conversions);
    res.json({ success: true, id, medicine: services.getMedicineById(id) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Excel Import for Medicines
app.post('/api/medicines/import-excel', (req: Request, res: Response) => {
  try {
    const { fileBase64, mode } = req.body; // mode: 'preview' or 'execute'
    if (!fileBase64) return res.status(400).json({ error: 'No Excel file data received' });

    const buffer = Buffer.from(fileBase64, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet) as any[];

    const validRows: any[] = [];
    const duplicates: any[] = [];
    const errors: string[] = [];

    const existingMeds = services.getMedicines();
    const existingMap = new Set(existingMeds.map(m => m.brand_name.toLowerCase().trim()));

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const brand = (row['Brand Name'] || row['Brand'] || row['brand_name'] || '').toString().trim();
      const generic = (row['Generic Name'] || row['Generic'] || row['generic_name'] || '').toString().trim();
      const company = (row['Company'] || row['Manufacturer'] || row['manufacturer'] || 'Unknown').toString().trim();
      const strength = (row['Strength'] || row['strength'] || '').toString().trim();
      const dosage = (row['Dosage Form'] || row['Form'] || row['dosage_form'] || 'Tablet').toString().trim();
      const baseUnit = (row['Base Unit'] || row['Unit'] || row['base_unit'] || 'Tablet').toString().trim();
      const price = parseFloat(row['Sale Price'] || row['Price'] || row['sale_price'] || '0');
      const barcode = (row['Barcode'] || row['barcode'] || '').toString().trim();

      if (!brand) {
        errors.push(`Row ${i + 2}: Missing Brand Name.`);
        continue;
      }
      if (isNaN(price) || price <= 0) {
        errors.push(`Row ${i + 2} (${brand}): Invalid or zero sale price.`);
        continue;
      }

      const item = {
        brand_name: brand,
        generic_name: generic,
        manufacturer: company,
        strength,
        dosage_form: dosage,
        base_unit: baseUnit,
        sale_price: price,
        barcode
      };

      if (existingMap.has(brand.toLowerCase())) {
        duplicates.push(item);
      } else {
        validRows.push(item);
      }
    }

    if (mode === 'execute') {
      let inserted = 0;
      for (const item of validRows) {
        services.saveMedicine(item);
        inserted++;
      }
      return res.json({ success: true, insertedCount: inserted, duplicatesCount: duplicates.length });
    }

    res.json({
      success: true,
      totalRows: rawData.length,
      validRows,
      duplicates,
      errors
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Batches
app.get('/api/batches', (req: Request, res: Response) => {
  try {
    const medId = req.query.medicineId ? parseInt(req.query.medicineId as string, 10) : undefined;
    const includeExpired = req.query.includeExpired === 'true';
    const batches = services.getBatches(medId, includeExpired);
    res.json(batches);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/batches', (req: Request, res: Response) => {
  try {
    const id = services.addBatchManually(req.body);
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Sales & POS
app.post('/api/sales', (req: Request, res: Response) => {
  try {
    const invoice = services.executeSale(req.body);
    res.json({ success: true, invoice });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/sales', (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const search = req.query.search as string;
    const invoices = services.getSaleInvoices(limit, search);
    res.json(invoices);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sales/:id', (req: Request, res: Response) => {
  try {
    const inv = services.getSaleInvoiceById(parseInt(req.params.id, 10));
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    res.json(inv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sales/:id/cancel', (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    services.cancelSale(parseInt(req.params.id, 10), reason || 'Customer request');
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Returns
app.post('/api/returns', (req: Request, res: Response) => {
  try {
    const returnId = services.processReturn(req.body);
    res.json({ success: true, returnId });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Purchases
app.get('/api/purchases', (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const purchases = services.getPurchases(limit);
    res.json(purchases);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/purchases', (req: Request, res: Response) => {
  try {
    const purchase = services.executePurchase(req.body);
    res.json({ success: true, purchase });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Customers
app.get('/api/customers', (req: Request, res: Response) => {
  try {
    const search = req.query.search as string;
    const custs = services.getCustomers(search);
    res.json(custs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/customers', (req: Request, res: Response) => {
  try {
    const id = services.saveCustomer(req.body);
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/customers/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid customer ID.' });
    }
    services.deleteCustomer(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/customers/payments', (req: Request, res: Response) => {
  try {
    services.recordCustomerPayment(req.body);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Suppliers
app.get('/api/suppliers', (req: Request, res: Response) => {
  try {
    const sups = services.getSuppliers();
    res.json(sups);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/suppliers', (req: Request, res: Response) => {
  try {
    const id = services.saveSupplier(req.body);
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/suppliers/payments', (req: Request, res: Response) => {
  try {
    services.recordSupplierPayment(req.body);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Expenses & Cash
app.get('/api/expenses', (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const exps = services.getExpenses(startDate, endDate);
    res.json(exps);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/expenses', (req: Request, res: Response) => {
  try {
    const id = services.addExpense(req.body);
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cash-movements', (req: Request, res: Response) => {
  try {
    const { type, amount, reason } = req.body;
    services.recordCashMovement(type, amount, reason);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Backups & Laptop Transfer
app.get('/api/backups', (req: Request, res: Response) => {
  try {
    const backups = services.listBackups();
    res.json(backups);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/backups/create', (req: Request, res: Response) => {
  try {
    const { destination, backupType } = req.body;
    const backup = services.createBackup(destination || 'local', backupType || 'manual');
    res.json({ success: true, backup });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/backups/download-db', (req: Request, res: Response) => {
  try {
    const { filename, buffer } = services.createDownloadableDbSnapshot();
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/backups/restore', (req: Request, res: Response) => {
  try {
    const { backupFilePath, adminPassword } = req.body;
    services.restoreBackup(backupFilePath, adminPassword);
    res.json({ success: true, message: 'Database successfully restored after creating safety backup.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/backups/upload-restore', (req: Request, res: Response) => {
  try {
    const { fileBase64, adminPassword } = req.body;
    if (!fileBase64) {
      return res.status(400).json({ error: 'No backup file selected.' });
    }
    const buffer = Buffer.from(fileBase64, 'base64');
    services.restoreBackupFromBuffer(buffer, adminPassword);
    res.json({ success: true, message: 'Database successfully restored from uploaded backup file.' });
  } catch (err: any) {
    const status = err.message?.includes('password') ? 401 : 400;
    res.status(status).json({ error: err.message });
  }
});

app.post('/api/database/reset', (req: Request, res: Response) => {
  try {
    const { mode, adminPassword } = req.body;
    const result = services.resetDatabase(mode, adminPassword);
    res.json({
      success: true,
      mode: result.mode,
      safetyBackup: result.safetyBackup,
      message: `Database reset (${result.mode}) completed after creating safety backup.`
    });
  } catch (err: any) {
    const status = err.message?.includes('password') ? 401 : 400;
    res.status(status).json({ error: err.message });
  }
});

// Full Project Source ZIP Export Endpoint (Pure ESM Node.js ZIP builder)
function collectSourceFiles(baseDir: string, currentDir: string, out: string[] = []): string[] {
  const excludedTopDirs = new Set(['node_modules', 'dist', 'dist-electron', 'release', '.git', 'dev-dist', 'backups', 'data']);
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const fullPath = path.join(currentDir, entry.name);
    const relPosix = path.relative(baseDir, fullPath).split(path.sep).join('/');
    if (entry.isDirectory()) {
      if (excludedTopDirs.has(entry.name) || relPosix === 'public/assets/aistudio') continue;
      collectSourceFiles(baseDir, fullPath, out);
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.zip') || entry.name.endsWith('.db-wal') || entry.name.endsWith('.db-shm')) continue;
      out.push(fullPath);
    }
  }
  return out;
}

function buildZipBuffer(rootDir: string, files: string[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const filePath of files) {
    const relName = path.relative(rootDir, filePath).split(path.sep).join('/');
    const nameBuf = Buffer.from(relName, 'utf8');
    const rawData = fs.readFileSync(filePath);
    const crc = (zlib.crc32(rawData) >>> 0);
    const compressed = zlib.deflateRawSync(rawData);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // Local file header signature
    localHeader.writeUInt16LE(20, 4);         // Version needed to extract
    localHeader.writeUInt16LE(0x0800, 6);     // General purpose bit flag (UTF-8)
    localHeader.writeUInt16LE(8, 8);          // Compression method: deflate
    localHeader.writeUInt16LE(0, 10);         // Mod time
    localHeader.writeUInt16LE(0x5421, 12);    // Mod date
    localHeader.writeUInt32LE(crc, 14);       // CRC-32
    localHeader.writeUInt32LE(compressed.length, 18); // Compressed size
    localHeader.writeUInt32LE(rawData.length, 22);    // Uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26);    // File name length
    localHeader.writeUInt16LE(0, 28);         // Extra field length

    localParts.push(localHeader, nameBuf, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // Central file header signature
    centralHeader.writeUInt16LE(20, 4);         // Version made by
    centralHeader.writeUInt16LE(20, 6);         // Version needed
    centralHeader.writeUInt16LE(0x0800, 8);     // UTF-8 flag
    centralHeader.writeUInt16LE(8, 10);         // Deflate
    centralHeader.writeUInt16LE(0, 12);         // Mod time
    centralHeader.writeUInt16LE(0x5421, 14);    // Mod date
    centralHeader.writeUInt32LE(crc, 16);       // CRC-32
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(rawData.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);         // Extra length
    centralHeader.writeUInt16LE(0, 32);         // Comment length
    centralHeader.writeUInt16LE(0, 34);         // Disk number
    centralHeader.writeUInt16LE(0, 36);         // Internal attrs
    centralHeader.writeUInt32LE(0, 38);         // External attrs
    centralHeader.writeUInt32LE(offset, 42);    // Relative offset of local header

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + compressed.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);            // End of central dir signature
  eocd.writeUInt16LE(0, 4);                     // Disk number
  eocd.writeUInt16LE(0, 6);                     // Start disk
  eocd.writeUInt16LE(files.length, 8);          // Entries on disk
  eocd.writeUInt16LE(files.length, 10);         // Total entries
  eocd.writeUInt32LE(centralDir.length, 12);    // Size of central directory
  eocd.writeUInt32LE(offset, 16);               // Offset of central directory
  eocd.writeUInt16LE(0, 20);                    // Comment length

  return Buffer.concat([...localParts, centralDir, eocd]);
}

app.get('/api/export/download-project-zip', (req: Request, res: Response) => {
  try {
    const rootDir = process.cwd();
    const files = collectSourceFiles(rootDir, rootDir);
    const zipBuffer = buildZipBuffer(rootDir, files);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="niramoy-pharmacy-complete-source.zip"');
    res.setHeader('Content-Length', String(zipBuffer.length));
    res.send(zipBuffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Audit Logs
app.get('/api/audit-logs', (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    res.json(services.getAuditLogs(limit));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// QA Automated Test Runner Endpoint
app.get('/api/diagnostics/run-tests', async (req: Request, res: Response) => {
  try {
    const { runAutomatedTests } = await import('./tests/test-runner.ts');
    const results = runAutomatedTests();
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// DEV SERVER & STATIC ASSETS
// ----------------------------------------------------
async function startServer() {
  try {
    const cloudState = await restoreDatabaseFromCloudIfConfigured();
    console.log('[System] Initializing local SQLite database...');
    initDatabase();
    console.log('[System] Database ready.');
    if (cloudState.configured && !cloudState.restored) {
      await syncDatabaseToCloud();
      console.log('[Cloud Sync] Initialized persistent database snapshot in Turso.');
    }
  } catch (err: any) {
    console.error('[Cloud Sync] Startup restore failed, continuing with local SQLite:', err.message);
    initDatabase();
  }

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const publicPath = path.resolve(process.cwd(), 'public');
    app.use(express.static(publicPath));
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Pharmacy Server] Running at http://localhost:${PORT}`);
  });
}

startServer();
