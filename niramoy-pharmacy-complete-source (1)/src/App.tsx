import React, { useState, useEffect, useRef } from 'react';
import { Language, PharmacySettings, SaleInvoice } from './types/pharmacy';
import { api } from './services/api';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { LockScreenModal } from './components/LockScreenModal';
import { ReceiptModal } from './components/ReceiptModal';

// Pages
import { DashboardPage } from './pages/DashboardPage';
import { PosBillingPage } from './pages/PosBillingPage';
import { MedicinesPage } from './pages/MedicinesPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { CustomersPage } from './pages/CustomersPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { ReturnsPage } from './pages/ReturnsPage';
import { ReportsPage } from './pages/ReportsPage';
import { BackupsPage } from './pages/BackupsPage';
import { SettingsPage } from './pages/SettingsPage';
import { DiagnosticsPage } from './pages/DiagnosticsPage';
import { SecurityPage } from './pages/SecurityPage';

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [settings, setSettings] = useState<PharmacySettings | null>(null);
  const [lang, setLang] = useState<Language>('bn');
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [previewInvoice, setPreviewInvoice] = useState<SaleInvoice | null>(null);

  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load initial pharmacy settings
  useEffect(() => {
    api.getSettings().then((s) => {
      setSettings(s);
      setLang(s.default_language || 'bn');
    }).catch(console.error);
  }, []);

  // Listen for Electron backup trigger if running in desktop mode
  useEffect(() => {
    if ((window as any).electronAPI?.onTriggerBackup) {
      (window as any).electronAPI.onTriggerBackup(() => {
        api.createBackup('local', 'manual');
      });
    }
  }, []);

  // Inactivity auto-lock listener
  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    const lockMinutes = settings?.inactivity_lock_minutes || 15;
    inactivityTimerRef.current = setTimeout(() => {
      setIsLocked(true);
    }, lockMinutes * 60 * 1000);
  };

  useEffect(() => {
    const handleActivity = () => resetInactivityTimer();
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    resetInactivityTimer();

    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
    };
  }, [settings?.inactivity_lock_minutes]);

  // Global keyboard shortcut: F2 jumps directly to POS billing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        setCurrentTab('pos');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang);
    if (settings) {
      api.updateSettings({ default_language: newLang });
    }
  };

  // Test receipt generator
  const handleOpenTestReceipt = () => {
    const testInvoice: SaleInvoice = {
      id: 9999,
      invoice_number: 'INV-TEST-RECEIPT',
      customer_name: 'Mr. Rafiqul Islam',
      customer_phone: '+880 1819-234567',
      sale_date: new Date().toISOString().split('T')[0],
      subtotal: 350.0,
      discount_type: 'percentage',
      discount_value: 5,
      discount_amount: 17.5,
      final_payable: 332.5,
      paid_amount: 332.5,
      change_returned: 0,
      credit_amount: 0,
      payment_status: 'paid',
      status: 'completed',
      created_at: new Date().toISOString(),
      items: [
        {
          id: 1,
          sale_id: 9999,
          medicine_id: 1,
          brand_name: 'Napa 500mg',
          generic_name: 'Paracetamol',
          quantity: 2,
          unit: 'Strip',
          multiplier: 10,
          base_quantity: 20,
          unit_price: 12.0,
          line_total: 24.0,
          cost_of_goods: 19.0
        },
        {
          id: 2,
          sale_id: 9999,
          medicine_id: 2,
          brand_name: 'Seclo 20mg',
          generic_name: 'Omeprazole',
          quantity: 2,
          unit: 'Strip',
          multiplier: 10,
          base_quantity: 20,
          unit_price: 60.0,
          line_total: 120.0,
          cost_of_goods: 96.0
        },
        {
          id: 3,
          sale_id: 9999,
          medicine_id: 3,
          brand_name: 'Zimax 500mg',
          generic_name: 'Azithromycin',
          quantity: 1,
          unit: 'Strip',
          multiplier: 6,
          base_quantity: 6,
          unit_price: 210.0,
          line_total: 210.0,
          cost_of_goods: 168.0
        }
      ],
      payments: [
        { id: 1, sale_id: 9999, payment_method: 'cash', amount: 200.0, created_at: new Date().toISOString() },
        { id: 2, sale_id: 9999, payment_method: 'bkash', amount: 132.5, transaction_ref: 'TXN-BKASH-991', created_at: new Date().toISOString() }
      ]
    };
    setPreviewInvoice(testInvoice);
  };

  if (!settings) {
    return (
      <div className="h-screen w-screen bg-slate-900 flex items-center justify-center text-white text-xs font-mono">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div>Initializing Niramoy Local SQLite Architecture...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-slate-100 font-sans antialiased text-slate-900">
      {/* Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        lang={lang}
        settings={settings}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header */}
        <Header
          currentTab={currentTab}
          lang={lang}
          onLanguageChange={handleLanguageChange}
          onLockSession={() => setIsLocked(true)}
          settings={settings}
          onOpenTestReceipt={handleOpenTestReceipt}
        />

        {/* Dynamic Page Views */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {currentTab === 'dashboard' && (
            <DashboardPage
              lang={lang}
              settings={settings}
              onNavigate={setCurrentTab}
              onReprintReceipt={setPreviewInvoice}
            />
          )}

          {currentTab === 'pos' && (
            <PosBillingPage
              lang={lang}
              settings={settings}
              onOpenReceipt={setPreviewInvoice}
            />
          )}

          {currentTab === 'medicines' && (
            <MedicinesPage
              lang={lang}
              settings={settings}
            />
          )}

          {currentTab === 'purchases' && (
            <PurchasesPage
              lang={lang}
              settings={settings}
            />
          )}

          {currentTab === 'customers' && (
            <CustomersPage
              lang={lang}
              settings={settings}
            />
          )}

          {currentTab === 'suppliers' && (
            <SuppliersPage
              lang={lang}
              settings={settings}
            />
          )}

          {currentTab === 'expenses' && (
            <ExpensesPage
              lang={lang}
              settings={settings}
            />
          )}

          {currentTab === 'returns' && (
            <ReturnsPage
              lang={lang}
              settings={settings}
            />
          )}

          {currentTab === 'reports' && (
            <ReportsPage
              lang={lang}
              settings={settings}
            />
          )}

          {currentTab === 'backups' && (
            <BackupsPage
              lang={lang}
              settings={settings}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsPage
              settings={settings}
              onUpdateSettings={setSettings}
              lang={lang}
              onOpenTestReceipt={handleOpenTestReceipt}
            />
          )}

          {currentTab === 'diagnostics' && (
            <DiagnosticsPage
              lang={lang}
              settings={settings}
            />
          )}

          {currentTab === 'security' && (
            <SecurityPage
              lang={lang}
              settings={settings}
            />
          )}
        </main>
      </div>

      {/* Security Inactivity / Manual Lock Modal */}
      <LockScreenModal
        isLocked={isLocked}
        onUnlock={() => setIsLocked(false)}
        lang={lang}
      />

      {/* Thermal & A4 Receipt Print Preview Modal */}
      <ReceiptModal
        invoice={previewInvoice}
        settings={settings}
        lang={lang}
        onClose={() => setPreviewInvoice(null)}
      />
    </div>
  );
}
