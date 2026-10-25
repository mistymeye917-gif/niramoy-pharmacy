# Niramoy Pharmacy Management System (নিরাময় ফার্মেসি ম্যানেজমেন্ট)
### Professional Offline Retail Pharmacy & POS Desktop Software for Bangladesh

Niramoy Pharmacy Management System is an enterprise-grade, 100% offline desktop application engineered specifically for retail pharmacies in Bangladesh. It incorporates First Expiry, First Out (FEFO) batch inventory, multi-method split payments (Cash, bKash, Nagad, Rocket, Card, Customer Credit), customer credit ledger, supplier payables, operating expense accounting, thermal 80mm & A4 receipt printing, and a dual-channel (USB & local Wi-Fi shared folder) desktop-to-laptop transfer & backup system.

---

## 🌟 Key Architecture & Capabilities

1. **100% Offline Operation**:
   - Built on local embedded **SQLite** with Write-Ahead Logging (WAL) and strict relational foreign-key integrity.
   - Zero mandatory internet connection or cloud subscriptions required. All transactions, catalogs, batches, and ledgers remain private on your computer.

2. **FEFO Inventory & Expiry Safeguards**:
   - First Expiry, First Out automatically assigns non-expired batches with earliest expiry first.
   - Strictly prohibits the sale of expired medicine batches.
   - Automatic near-expiry warnings (30 days threshold) and low-stock alerts (&le; 10 base units).
   - Packaging unit conversions per medicine (e.g., 1 Box = 10 Strips = 100 Tablets).

3. **High-Speed Counter Billing & Split Payments**:
   - Keyboard shortcut **[F2]** for rapid autocomplete search by Brand, Generic, Company, or Barcode scanner.
   - Keyboard shortcut **[F10]** to confirm atomic sale transactions.
   - Split payments across Cash, bKash, Nagad, Rocket, POS Card, and Customer Credit within a single invoice.
   - Integer-safe monetary calculations in Bangladeshi Taka (৳ / BDT).
   - Zero VAT calculations in compliance with retail pharmacy regulations.

4. **Accounting & Cash Drawer Isolation**:
   - Physical drawer cash is strictly isolated from mobile wallets (bKash/Nagad/Rocket), card payments, and unpaid credit receivables.
   - Cost of Goods Sold (COGS) calculated from the exact purchase cost of specific batches sold, generating real Gross Profit and Net Profit figures.

5. **Customer & Supplier Accounts Ledger**:
   - Customer credit balance tracking with partial and full repayments.
   - Supplier payables ledger with purchase chalan history and payment postings.

6. **Bilingual Bengali & English UI & Thermal Receipts**:
   - Complete Bengali (বাংলা) and English translations with Unicode Bengali font rendering (`Hind Siliguri`).
   - Configurable **Full** (detailed with company & payment breakdown) and **Compact** (80mm thermal paper) receipt layouts.
   - Historical invoice snapshots ensuring re-printed receipts match original sale details.

7. **Dual-Channel Offline Backup & Laptop Transfer Wizard**:
   - Scheduled automatic timestamped SQLite backups with SHA-256 integrity checksums.
   - Support for USB flash drives and local Wi-Fi shared network folders.
   - Guided Desktop &harr; Laptop Transfer Wizard with automatic pre-restore safety snapshots.

8. **Automated QA Test Suite**:
   - 22 comprehensive automated tests verifying all business logic, transactions, conversions, and integrity checks.

---

## 💻 System Requirements

- **Operating System**: Windows 10 (64-bit or 32-bit) / Windows 11
- **Processor**: Intel Core i3 (2.0 GHz) or AMD equivalent minimum
- **RAM**: 4 GB minimum (8 GB recommended)
- **Disk Space**: 500 MB free storage
- **Printers Supported**: 80mm / 58mm Thermal Receipt Printers (POS-80 / ESC/POS) or standard A4 laser/inkjet printers
- **Barcode Scanners**: USB keyboard-wedge barcode scanners supported out-of-the-box

---

## 🚀 Development & Local Execution

### 1. Install Dependencies
```bash
npm install
```

### 2. Run in Development Mode
To start the full-stack server (Node.js + Express + SQLite + Vite):
```bash
npm run dev
```
The application will launch and be accessible at `http://localhost:3000`.

### 3. Run the Automated QA Test Suite
Execute the 22 automated verification tests from the terminal:
```bash
npm test
```
Or run directly:
```bash
node tests/pharmacy-tests.mjs
```
You can also run all tests interactively from the **Diagnostics & QA Tests** page in the application.

---

## 📦 Building the Windows Desktop Installer

The project contains complete Electron desktop configuration (`electron/main.ts`, `electron/preload.ts`, and `electron-builder.yml`).

### To build the Windows `.exe` Installer:
1. Compile the React and TypeScript production build:
   ```bash
   npm run build
   ```
2. Build the Electron desktop distribution with electron-builder:
   ```bash
   npx electron-builder --win nsis:x64
   ```
3. The generated installer will be located in the `release/` directory:
   ```
   release/Niramoy Pharmacy Management System Setup 1.0.0.exe
   ```

### Installer Features:
- Installs into Windows Programs directory.
- Adds Desktop Shortcut and Start Menu entry.
- Bundles the local SQLite database and preloaded Bangladesh medicine catalog.
- Fully offline launch without browser tabs.

---

## 🔄 Desktop &harr; Laptop Data Transfer Workflow

When operating with one computer at the counter (Desktop) and one at home or roaming (Laptop):

1. **On Machine A (Source)**:
   - Complete all sales and purchases for the day.
   - Go to **Backup & Laptop Transfer** &rarr; click **Create Verified Backup Now**.
   - Copy the generated `.sqlite` backup file to your USB flash drive or local network folder.
2. **On Machine B (Destination)**:
   - Insert the USB drive or access the network folder.
   - Open **Backup & Laptop Transfer** &rarr; locate the backup in the history table (or click **Restore Selected Backup**).
   - Enter your Administrator password to confirm.
   - The system automatically creates a safety backup of Machine B's existing data before overwriting.
   - The verified database will reload with all latest transactions intact.

---

## 🖨️ Thermal Printer Setup & Bengali Font Troubleshooting

1. **Printer Selection**:
   - Go to **Pharmacy Settings** &rarr; **Printer & Receipt Customization**.
   - Set the installed Windows printer name (e.g. `POS-80` or `XP-80C`).
2. **Bengali Text Rendering on Thermal Printers**:
   - Ensure the printer driver has graphics/spool printing enabled in Windows Devices & Printers settings.
   - In **Receipt Print Preview**, you can switch between **বাংলা** and **English** receipt text independently of the main UI language.
   - Click **Print Test Receipt** to verify paper alignment and font rendering before counter billing.

---

## 🔐 Administrator Recovery Procedure

If the administrator password is ever forgotten:
1. On the session lock screen, click **"Forgot password? Use offline recovery key"**.
2. Enter the Master Recovery Key generated during database provisioning (e.g., `NIRAMOY-8F92-4B10`).
3. Enter and confirm a new password to immediately restore administrative access.

---

### Copyright & License
Copyright © 2026 Niramoy Health Ltd, Bangladesh. All rights reserved.
Developed for professional retail pharmacy operations.
