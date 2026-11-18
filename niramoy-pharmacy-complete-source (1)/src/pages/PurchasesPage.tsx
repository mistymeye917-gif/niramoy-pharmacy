import React, { useState, useEffect } from 'react';
import {
  PurchaseInvoice,
  PurchaseItemInput,
  Supplier,
  Medicine,
  Language,
  PharmacySettings
} from '../types/pharmacy';
import { getTranslation } from '../i18n/translations';
import { api } from '../services/api';
import { formatBDT, formatDate } from '../services/formatters';
import {
  Truck,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Calendar,
  X,
  Building2,
  FileText
} from 'lucide-react';

interface PurchasesPageProps {
  lang: Language;
  settings: PharmacySettings;
}

export const PurchasesPage: React.FC<PurchasesPageProps> = ({
  lang,
  settings
}) => {
  const [purchases, setPurchases] = useState<PurchaseInvoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);

  // New Purchase Modal
  const [showModal, setShowModal] = useState(false);
  const [supplierId, setSupplierId] = useState<number>(0);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bkash' | 'nagad' | 'rocket' | 'card'>('cash');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PurchaseItemInput[]>([]);

  // Inline Quick-Add Supplier
  const [showQuickSupplier, setShowQuickSupplier] = useState(false);
  const [quickSuppName, setQuickSuppName] = useState('');
  const [quickSuppPhone, setQuickSuppPhone] = useState('');
  const [quickSuppAddress, setQuickSuppAddress] = useState('');
  const [isSavingQuickSupp, setIsSavingQuickSupp] = useState(false);

  // Inline Quick-Add Medicine
  const [showQuickMed, setShowQuickMed] = useState(false);
  const [quickMedBrand, setQuickMedBrand] = useState('');
  const [quickMedGeneric, setQuickMedGeneric] = useState('');
  const [quickMedCompany, setQuickMedCompany] = useState('');
  const [quickMedStrength, setQuickMedStrength] = useState('');
  const [quickMedForm, setQuickMedForm] = useState('Tablet');
  const [quickMedSalePrice, setQuickMedSalePrice] = useState<number>(0);
  const [isSavingQuickMed, setIsSavingQuickMed] = useState(false);

  // Item input row
  const [selectedMedId, setSelectedMedId] = useState<number>(0);
  const [batchNo, setBatchNo] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [qty, setQty] = useState<number>(100);
  const [unitCost, setUnitCost] = useState<number>(1.0);
  const [selectedUnit, setSelectedUnit] = useState<string>('Tablet');

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const t = (key: any) => getTranslation(lang, key);

  const loadData = async () => {
    try {
      setLoading(true);
      const [p, s, m] = await Promise.all([
        api.getPurchases(),
        api.getSuppliers(),
        api.getMedicines()
      ]);
      setPurchases(p);
      setSuppliers(s);
      setMedicines(m);
      if (s.length > 0 && (!supplierId || !s.some(x => x.id === supplierId))) {
        setSupplierId(s[0].id);
      } else if (s.length === 0) {
        setSupplierId(0);
      }
      if (m.length > 0 && (!selectedMedId || !m.some(x => x.id === selectedMedId))) {
        setSelectedMedId(m[0].id);
        setSelectedUnit(m[0].base_unit);
        setUnitCost(Math.round(m[0].sale_price * 0.8 * 100) / 100);
      } else if (m.length === 0) {
        setSelectedMedId(0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update unit and default cost when medicine changes
  const handleMedChange = (id: number) => {
    setSelectedMedId(id);
    const m = medicines.find(x => x.id === id);
    if (m) {
      setSelectedUnit(m.base_unit);
      setUnitCost(Math.round(m.sale_price * 0.8 * 100) / 100);
    }
  };

  const handleQuickSaveSupplier = async () => {
    if (!quickSuppName.trim() || !quickSuppPhone.trim()) {
      setErrorMessage(
        lang === 'bn'
          ? 'নতুন সরবরাহকারীর কোম্পানির নাম এবং ফোন নম্বর দিন।'
          : 'Please enter supplier company name and phone number.'
      );
      return;
    }
    setIsSavingQuickSupp(true);
    setErrorMessage('');
    try {
      const res = await api.saveSupplier({
        name: quickSuppName.trim(),
        phone: quickSuppPhone.trim(),
        address: quickSuppAddress.trim()
      });
      const updatedSuppliers = await api.getSuppliers();
      setSuppliers(updatedSuppliers);
      setSupplierId(res.id);
      setQuickSuppName('');
      setQuickSuppPhone('');
      setQuickSuppAddress('');
      setShowQuickSupplier(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save supplier');
    } finally {
      setIsSavingQuickSupp(false);
    }
  };

  const handleQuickSaveMedicine = async () => {
    if (!quickMedBrand.trim() || quickMedSalePrice <= 0) {
      setErrorMessage(
        lang === 'bn'
          ? 'নতুন ওষুধের নাম (Brand Name) এবং বিক্রয় মূল্য (০-এর বেশি) দিন।'
          : 'Please enter medicine brand name and valid sale price (> 0).'
      );
      return;
    }
    setIsSavingQuickMed(true);
    setErrorMessage('');
    try {
      const selectedSuppName = suppliers.find(s => s.id === supplierId)?.name || 'Local Supplier';
      const baseUnit = quickMedForm === 'Syrup' || quickMedForm === 'Drop' ? 'Bottle'
        : quickMedForm === 'Injection' || quickMedForm === 'Vial' ? 'Piece'
        : quickMedForm;
      const res = await api.saveMedicine({
        brand_name: quickMedBrand.trim(),
        generic_name: quickMedGeneric.trim() || quickMedBrand.trim(),
        manufacturer: quickMedCompany.trim() || selectedSuppName,
        strength: quickMedStrength.trim() || '-',
        dosage_form: quickMedForm,
        base_unit: baseUnit,
        sale_price: quickMedSalePrice,
        active: 1
      });
      const updatedMeds = await api.getMedicines();
      setMedicines(updatedMeds);
      setSelectedMedId(res.id);
      setSelectedUnit(baseUnit);
      setUnitCost(Math.round(quickMedSalePrice * 0.8 * 100) / 100);
      setQuickMedBrand('');
      setQuickMedGeneric('');
      setQuickMedCompany('');
      setQuickMedStrength('');
      setQuickMedSalePrice(0);
      setShowQuickMed(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save medicine');
    } finally {
      setIsSavingQuickMed(false);
    }
  };

  const handleAddItem = () => {
    if (!selectedMedId) {
      setErrorMessage(
        lang === 'bn'
          ? 'অনুগ্রহ করে প্রথমে তালিকা থেকে ওষুধ নির্বাচন করুন (তালিকা খালি থাকলে "+ নতুন ওষুধ" ক্লিক করে যোগ করুন)।'
          : 'Please select a medicine first (or click "+ New Medicine" if the list is empty).'
      );
      return;
    }
    if (!batchNo.trim() || !expiryDate || qty <= 0 || unitCost <= 0) {
      setErrorMessage(
        lang === 'bn'
          ? 'অনুগ্রহ করে Batch No, মেয়াদের তারিখ, Qty এবং Cost সঠিকভাবে পূরণ করুন।'
          : 'Please fill all item fields with valid positive values.'
      );
      return;
    }

    const med = medicines.find(m => m.id === selectedMedId);
    if (!med) return;

    const lineTotal = Math.round(qty * unitCost * 100) / 100;

    setItems(prev => [
      ...prev,
      {
        medicine_id: selectedMedId,
        brand_name: med.brand_name,
        batch_number: batchNo.trim().toUpperCase(),
        expiry_date: expiryDate,
        quantity: qty,
        unit: selectedUnit,
        multiplier: 1,
        purchase_cost_per_unit: unitCost,
        sale_price_per_base_unit: med.sale_price,
        line_total: lineTotal
      }
    ]);

    setBatchNo('');
    setErrorMessage('');
  };

  const handleRemoveItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const totalAmount = Math.round(items.reduce((acc, i) => acc + i.line_total, 0) * 100) / 100;

  useEffect(() => {
    setPaidAmount(totalAmount);
  }, [totalAmount]);

  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      setErrorMessage(
        lang === 'bn'
          ? 'অনুগ্রহ করে প্রথমে সরবরাহকারী নির্বাচন বা "+ নতুন" দিয়ে যোগ করুন।'
          : 'Please select or create a supplier first.'
      );
      return;
    }
    if (!invoiceNumber.trim()) {
      setErrorMessage('Please enter supplier invoice number.');
      return;
    }
    if (items.length === 0) {
      setErrorMessage('Please add at least one purchase item.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await api.executePurchase({
        supplier_id: supplierId,
        invoice_number: invoiceNumber.trim(),
        purchase_date: purchaseDate,
        items,
        paid_amount: paidAmount,
        payment_method: paymentMethod,
        notes
      });

      setSuccessMessage(`Purchase invoice ${invoiceNumber} posted successfully. Stock updated!`);
      setShowModal(false);
      setItems([]);
      setInvoiceNumber('');
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to post purchase');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {t('pur_title')}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Post company invoices, update batches, calculate supplier payables, and increase inventory.
          </p>
        </div>
        <button
          onClick={() => {
            setInvoiceNumber('CHALAN-' + Date.now().toString().slice(-6));
            setItems([]);
            setErrorMessage('');
            setSuccessMessage('');
            setShowQuickSupplier(false);
            setShowQuickMed(false);
            loadData();
            setShowModal(true);
          }}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('pur_new_purchase')}</span>
        </button>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      {/* Purchases List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="p-3 text-left">Invoice / Chalan #</th>
                <th className="p-3 text-left">{t('pur_select_supplier')}</th>
                <th className="p-3 text-center">{t('pur_date')}</th>
                <th className="p-3 text-right">{t('pur_total_amount')}</th>
                <th className="p-3 text-right">{t('pur_paid_amount')}</th>
                <th className="p-3 text-right">{t('pur_due_amount')}</th>
                <th className="p-3 text-center">Items Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    {t('loading')}
                  </td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    {t('no_records')}
                  </td>
                </tr>
              ) : (
                purchases.map((pur) => (
                  <tr key={pur.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3 font-mono font-semibold text-slate-900">{pur.invoice_number}</td>
                    <td className="p-3 font-medium text-slate-800">{pur.supplier_name}</td>
                    <td className="p-3 text-center text-slate-500">{formatDate(pur.purchase_date, lang)}</td>
                    <td className="p-3 text-right font-bold text-slate-900 tabular-nums">{formatBDT(pur.total_amount)}</td>
                    <td className="p-3 text-right font-semibold text-emerald-700 tabular-nums">{formatBDT(pur.paid_amount)}</td>
                    <td className={`p-3 text-right font-bold tabular-nums ${pur.balance_due > 0 ? 'text-rose-700' : 'text-slate-400'}`}>
                      {formatBDT(pur.balance_due)}
                    </td>
                    <td className="p-3 text-center text-slate-600 font-mono">
                      {pur.items?.length || 0}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Purchase Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-600" />
                <span>{t('pur_new_purchase')}</span>
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitPurchase} className="flex-1 flex flex-col overflow-hidden">
              <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
                {errorMessage && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Helpful hint when empty after reset */}
                {(suppliers.length === 0 || medicines.length === 0) && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2 text-[11px]">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">
                        {lang === 'bn'
                          ? 'এগুলো নির্বাচন তালিকা (Dropdown) — সরাসরি লেখা যায় না:'
                          : 'These fields are dropdown selectors — not text inputs:'}
                      </span>{' '}
                      {lang === 'bn'
                        ? 'ফুল রিসেটের পর তালিকা খালি থাকায় নিচে কিছু দেখা যাচ্ছে না। পাশের "+ নতুন" ও "+ নতুন ওষুধ" বাটনে ক্লিক করে সরাসরি এখান থেকেই আপনার কোম্পানী ও ওষুধ যোগ করুন।'
                        : 'Since the database was reset, these lists are currently empty. Use the "+ New" buttons right next to each dropdown to register your supplier and medicine.'}
                    </div>
                  </div>
                )}

                {/* Top Parameters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-700">{t('pur_select_supplier')} *</label>
                      <button
                        type="button"
                        onClick={() => setShowQuickSupplier(v => !v)}
                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 cursor-pointer"
                      >
                        {showQuickSupplier ? (lang === 'bn' ? 'বন্ধ করুন' : 'Close') : (lang === 'bn' ? '+ নতুন' : '+ New')}
                      </button>
                    </div>
                    <select
                      value={supplierId}
                      onChange={(e) => setSupplierId(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                    >
                      <option value={0}>
                        {suppliers.length === 0
                          ? (lang === 'bn' ? '-- কোনো সরবরাহকারী নেই (+ নতুন ক্লিক করুন) --' : '-- No suppliers yet (click + New) --')
                          : (lang === 'bn' ? '-- সরবরাহকারী নির্বাচন করুন --' : '-- Select supplier --')}
                      </option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{t('pur_invoice_no')} *</label>
                    <input
                      type="text"
                      required
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="e.g. INV-SQR-9901"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{t('pur_date')} *</label>
                    <input
                      type="date"
                      required
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Inline Quick-Add Supplier Panel */}
                {showQuickSupplier && (
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2.5">
                    <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-emerald-700" />
                      <span>{lang === 'bn' ? 'নতুন সরবরাহকারী (কোম্পানি) যোগ করুন' : 'Quick Add Supplier Company'}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={quickSuppName}
                        onChange={(e) => setQuickSuppName(e.target.value)}
                        placeholder={lang === 'bn' ? 'কোম্পানির নাম * (যেমন: Square Pharma)' : 'Company Name *'}
                        className="px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        value={quickSuppPhone}
                        onChange={(e) => setQuickSuppPhone(e.target.value)}
                        placeholder={lang === 'bn' ? 'ফোন নম্বর * (যেমন: 017...)' : 'Phone Number *'}
                        className="px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        value={quickSuppAddress}
                        onChange={(e) => setQuickSuppAddress(e.target.value)}
                        placeholder={lang === 'bn' ? 'ঠিকানা (ঐচ্ছিক)' : 'Address (Optional)'}
                        className="px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowQuickSupplier(false)}
                        className="px-2.5 py-1 bg-white border border-slate-300 rounded text-xs text-slate-600 cursor-pointer"
                      >
                        {t('cancel')}
                      </button>
                      <button
                        type="button"
                        onClick={handleQuickSaveSupplier}
                        disabled={isSavingQuickSupp}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold cursor-pointer disabled:opacity-50"
                      >
                        {isSavingQuickSupp ? '...' : (lang === 'bn' ? 'সরবরাহকারী সেভ করুন' : 'Save Supplier')}
                      </button>
                    </div>
                  </div>
                )}

                {/* Add Item Form Bar */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-slate-800">Add Item to Purchase Invoice</div>
                    <button
                      type="button"
                      onClick={() => setShowQuickMed(v => !v)}
                      className="text-[11px] font-bold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-0.5 rounded border border-indigo-200 cursor-pointer"
                    >
                      {showQuickMed ? (lang === 'bn' ? 'বন্ধ করুন' : 'Close') : (lang === 'bn' ? '+ নতুন ওষুধ যোগ করুন' : '+ New Medicine')}
                    </button>
                  </div>

                  {/* Inline Quick-Add Medicine Panel */}
                  {showQuickMed && (
                    <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg space-y-2">
                      <div className="font-bold text-indigo-900">
                        {lang === 'bn' ? 'নতুন ওষুধ রেজিস্টার করুন' : 'Quick Register New Medicine'}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={quickMedBrand}
                          onChange={(e) => setQuickMedBrand(e.target.value)}
                          placeholder={lang === 'bn' ? 'ওষুধের নাম * (যেমন: Napa 500mg)' : 'Brand Name * (e.g. Napa 500mg)'}
                          className="px-2 py-1.5 bg-white border border-indigo-300 rounded text-xs"
                        />
                        <input
                          type="text"
                          value={quickMedGeneric}
                          onChange={(e) => setQuickMedGeneric(e.target.value)}
                          placeholder={lang === 'bn' ? 'জেনেরিক (যেমন: Paracetamol)' : 'Generic (e.g. Paracetamol)'}
                          className="px-2 py-1.5 bg-white border border-indigo-300 rounded text-xs"
                        />
                        <input
                          type="text"
                          value={quickMedStrength}
                          onChange={(e) => setQuickMedStrength(e.target.value)}
                          placeholder={lang === 'bn' ? 'পাওয়ার (যেমন: 500 mg)' : 'Strength (e.g. 500 mg)'}
                          className="px-2 py-1.5 bg-white border border-indigo-300 rounded text-xs"
                        />
                        <input
                          type="text"
                          value={quickMedCompany}
                          onChange={(e) => setQuickMedCompany(e.target.value)}
                          placeholder={lang === 'bn' ? 'কোম্পানি (যেমন: Beximco)' : 'Manufacturer'}
                          className="px-2 py-1.5 bg-white border border-indigo-300 rounded text-xs"
                        />
                        <select
                          value={quickMedForm}
                          onChange={(e) => setQuickMedForm(e.target.value)}
                          className="px-2 py-1.5 bg-white border border-indigo-300 rounded text-xs"
                        >
                          <option value="Tablet">Tablet</option>
                          <option value="Capsule">Capsule</option>
                          <option value="Syrup">Syrup (Bottle)</option>
                          <option value="Injection">Injection (Piece)</option>
                          <option value="Drop">Drop (Bottle)</option>
                          <option value="Piece">Piece / Other</option>
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={quickMedSalePrice || ''}
                          onChange={(e) => setQuickMedSalePrice(parseFloat(e.target.value) || 0)}
                          placeholder={lang === 'bn' ? 'বিক্রয় মূল্য ৳ * (প্রতি পিস)' : 'Sale Price ৳ * (per unit)'}
                          className="px-2 py-1.5 bg-white border border-indigo-300 rounded text-xs"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowQuickMed(false)}
                          className="px-2.5 py-1 bg-white border border-slate-300 rounded text-xs text-slate-600 cursor-pointer"
                        >
                          {t('cancel')}
                        </button>
                        <button
                          type="button"
                          onClick={handleQuickSaveMedicine}
                          disabled={isSavingQuickMed}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold cursor-pointer disabled:opacity-50"
                        >
                          {isSavingQuickMed ? '...' : (lang === 'bn' ? 'ওষুধ সেভ করুন' : 'Save Medicine')}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-slate-500 mb-0.5">Medicine</label>
                      <select
                        value={selectedMedId}
                        onChange={(e) => handleMedChange(parseInt(e.target.value, 10) || 0)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                      >
                        <option value={0}>
                          {medicines.length === 0
                            ? (lang === 'bn' ? '-- কোনো ওষুধ নেই (+ নতুন ওষুধ ক্লিক করুন) --' : '-- No medicines yet (click + New Medicine) --')
                            : (lang === 'bn' ? '-- ওষুধ নির্বাচন করুন --' : '-- Select medicine --')}
                        </option>
                        {medicines.map(m => (
                          <option key={m.id} value={m.id}>{m.brand_name} ({m.strength})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-0.5">Batch No</label>
                      <input
                        type="text"
                        value={batchNo}
                        onChange={(e) => setBatchNo(e.target.value)}
                        placeholder="e.g. B-2026A"
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-0.5">Expiry Date</label>
                      <input
                        type="date"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-0.5">Qty</label>
                        <input
                          type="number"
                          min="1"
                          value={qty}
                          onChange={(e) => setQty(parseInt(e.target.value, 10) || 1)}
                          className="w-full px-1.5 py-1 bg-white border border-slate-300 rounded text-xs text-center font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-0.5">Cost</label>
                        <input
                          type="number"
                          step="0.01"
                          value={unitCost}
                          onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
                          className="w-full px-1.5 py-1 bg-white border border-slate-300 rounded text-xs text-right tabular-nums font-semibold"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add to List</span>
                    </button>
                  </div>
                </div>

                {/* Items List Table */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <th className="p-2 text-left">Medicine</th>
                        <th className="p-2 text-left">Batch No</th>
                        <th className="p-2 text-left">Expiry</th>
                        <th className="p-2 text-center">Qty</th>
                        <th className="p-2 text-right">Cost</th>
                        <th className="p-2 text-right">Total</th>
                        <th className="p-2 text-center w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-4 text-center text-slate-400">
                            No items added yet. Use form above.
                          </td>
                        </tr>
                      ) : (
                        items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="p-2 font-semibold text-slate-900">{item.brand_name}</td>
                            <td className="p-2 font-mono text-slate-700">{item.batch_number}</td>
                            <td className="p-2 text-slate-600">{item.expiry_date}</td>
                            <td className="p-2 text-center font-bold">{item.quantity}</td>
                            <td className="p-2 text-right tabular-nums">{formatBDT(item.purchase_cost_per_unit, false)}</td>
                            <td className="p-2 text-right font-bold tabular-nums">{formatBDT(item.line_total)}</td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-slate-400 hover:text-rose-600 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Payment Breakdown */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-500 block mb-0.5">Total Chalan Amount</span>
                    <span className="text-lg font-bold text-slate-900 tabular-nums">{formatBDT(totalAmount)}</span>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-0.5">{t('pur_paid_amount')}</label>
                    <input
                      type="number"
                      step="0.01"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded font-bold text-right tabular-nums"
                    />
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">{t('pur_due_amount')}</span>
                    <span className={`text-lg font-bold tabular-nums ${totalAmount - paidAmount > 0 ? 'text-rose-700' : 'text-slate-700'}`}>
                      {formatBDT(Math.max(0, totalAmount - paidAmount))}
                    </span>
                  </div>
                </div>
              </div>

              <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || items.length === 0}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? t('loading') : t('pur_confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
