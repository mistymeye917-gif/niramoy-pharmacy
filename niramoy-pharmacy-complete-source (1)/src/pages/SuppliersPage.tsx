import React, { useState, useEffect } from 'react';
import { Supplier, Language, PharmacySettings } from '../types/pharmacy';
import { getTranslation } from '../i18n/translations';
import { api } from '../services/api';
import { formatBDT } from '../services/formatters';
import {
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Trash2
} from 'lucide-react';

interface SuppliersPageProps {
  lang: Language;
  settings: PharmacySettings;
}

export const SuppliersPage: React.FC<SuppliersPageProps> = ({
  lang,
  settings
}) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Add / Edit Supplier Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSupp, setNewSupp] = useState<Partial<Supplier>>({
    name: '',
    phone: '',
    address: '',
    notes: ''
  });
  const [modalError, setModalError] = useState('');

  // Make Payment Modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedSupp, setSelectedSupp] = useState<Supplier | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<'cash' | 'bkash' | 'nagad' | 'rocket' | 'card'>('cash');
  const [payRef, setPayRef] = useState('');

  // Delete Confirm Modal
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const t = (key: any) => getTranslation(lang, key);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const data = await api.getSuppliers();
      setSuppliers(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    if (!newSupp.name?.trim() || !newSupp.phone?.trim()) {
      setModalError(lang === 'bn' ? 'কোম্পানির নাম ও ফোন নম্বর অবশ্যই দিন।' : 'Company name and phone are required.');
      return;
    }
    try {
      await api.saveSupplier(newSupp);
      setShowAddModal(false);
      setNewSupp({ name: '', phone: '', address: '', notes: '' });
      setErrorMsg('');
      setMessage(
        newSupp.id
          ? (lang === 'bn' ? 'সরবরাহকারীর তথ্য আপডেট হয়েছে।' : 'Supplier details updated.')
          : (lang === 'bn' ? 'নতুন সরবরাহকারী কোম্পানি যোগ হয়েছে।' : 'Supplier company registered successfully.')
      );
      loadSuppliers();
    } catch (err: any) {
      setModalError(err.message || 'Failed to save supplier');
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    if (!selectedSupp || payAmount <= 0) {
      setModalError(lang === 'bn' ? 'সঠিক টাকার পরিমাণ দিন।' : 'Please enter a valid payment amount.');
      return;
    }
    try {
      await api.recordSupplierPayment({
        supplier_id: selectedSupp.id,
        amount: payAmount,
        payment_method: payMethod,
        reference: payRef
      });
      setShowPayModal(false);
      setErrorMsg('');
      setMessage(
        lang === 'bn'
          ? `${selectedSupp.name}-কে ${formatBDT(payAmount)} পরিশোধ করা হয়েছে।`
          : `Payment of ${formatBDT(payAmount)} sent to ${selectedSupp.name}`
      );
      loadSuppliers();
    } catch (err: any) {
      setModalError(err.message || 'Payment failed');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setErrorMsg('');
    setMessage('');
    try {
      await api.deleteSupplier(deleteTarget.id);
      setMessage(
        lang === 'bn'
          ? `"${deleteTarget.name}" মুছে ফেলা হয়েছে।`
          : `Supplier "${deleteTarget.name}" deleted.`
      );
      setDeleteTarget(null);
      loadSuppliers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete supplier');
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const totalPayables = suppliers.reduce((acc, s) => acc + (s.outstanding_balance || 0), 0);

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {t('supp_title')}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {lang === 'bn'
              ? 'ওষুধ কোম্পানি ও সরবরাহকারীদের হিসাব এবং বকেয়া পরিশোধ ব্যবস্থাপনা।'
              : 'Manage pharmaceutical companies, purchases ledger, and payments settlement.'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[11px] text-slate-500 block">Total Due Payable</span>
            <span className="text-base font-bold text-rose-700 tabular-nums">{formatBDT(totalPayables)}</span>
          </div>
          <button
            onClick={() => {
              setNewSupp({ name: '', phone: '', address: '', notes: '' });
              setModalError('');
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('supp_add')}</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{message}</span>
          </div>
          <button onClick={() => setMessage('')} className="text-emerald-600 hover:text-emerald-800 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-600 hover:text-rose-800 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Suppliers Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="p-3 text-left">{t('supp_name')}</th>
                <th className="p-3 text-left">{t('supp_phone')}</th>
                <th className="p-3 text-left">Headquarters / Depot</th>
                <th className="p-3 text-right">Total Invoiced</th>
                <th className="p-3 text-right">Total Paid</th>
                <th className="p-3 text-right">{t('supp_payable')}</th>
                <th className="p-3 text-center w-48">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">{t('loading')}</td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">{t('no_records')}</td>
                </tr>
              ) : (
                suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3 font-semibold text-slate-900">{s.name}</td>
                    <td className="p-3 text-slate-600 font-mono">{s.phone}</td>
                    <td className="p-3 text-slate-500">{s.address || '—'}</td>
                    <td className="p-3 text-right text-slate-700 tabular-nums">{formatBDT(s.total_purchased || 0)}</td>
                    <td className="p-3 text-right text-emerald-700 tabular-nums font-semibold">{formatBDT(s.total_paid || 0)}</td>
                    <td className={`p-3 text-right font-bold tabular-nums ${(s.outstanding_balance || 0) > 0 ? 'text-rose-700' : 'text-slate-500'}`}>
                      {formatBDT(s.outstanding_balance || 0)}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {(s.outstanding_balance || 0) > 0 ? (
                          <button
                            onClick={() => {
                              setSelectedSupp(s);
                              setPayAmount(s.outstanding_balance || 0);
                              setPayRef('');
                              setModalError('');
                              setShowPayModal(true);
                            }}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-semibold cursor-pointer shadow-xs"
                          >
                            {lang === 'bn' ? 'পরিশোধ' : 'Pay'}
                          </button>
                        ) : (
                          <span className="text-emerald-700 text-[11px] font-medium px-1.5">
                            {lang === 'bn' ? 'পরিশোধিত' : 'Settled'}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setNewSupp(s);
                            setModalError('');
                            setShowAddModal(true);
                          }}
                          className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                          title={lang === 'bn' ? 'তথ্য সংশোধন করুন' : 'Edit supplier'}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(s)}
                          className="p-1.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                          title={lang === 'bn' ? 'সরবরাহকারী মুছুন' : 'Delete supplier'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Supplier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                {newSupp.id ? (lang === 'bn' ? 'সরবরাহকারীর তথ্য সংশোধন' : 'Edit Supplier') : t('supp_add')}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveSupplier} className="p-5 space-y-3 text-xs">
              {modalError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('supp_name')} *</label>
                <input
                  type="text"
                  required
                  value={newSupp.name || ''}
                  onChange={(e) => setNewSupp({ ...newSupp, name: e.target.value })}
                  placeholder="e.g. Square Pharmaceuticals PLC"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('supp_phone')} *</label>
                <input
                  type="text"
                  required
                  value={newSupp.phone || ''}
                  onChange={(e) => setNewSupp({ ...newSupp, phone: e.target.value })}
                  placeholder="+880 17..."
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Depot / Office Address</label>
                <input
                  type="text"
                  value={newSupp.address || ''}
                  onChange={(e) => setNewSupp({ ...newSupp, address: e.target.value })}
                  placeholder="e.g. Mohakhali C/A, Dhaka"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                >
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Make Payment Modal */}
      {showPayModal && selectedSupp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                Pay Supplier — {selectedSupp.name}
              </h3>
              <button onClick={() => setShowPayModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRecordPayment} className="p-5 space-y-3.5 text-xs">
              {modalError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
                <span className="text-slate-600">Total Outstanding Due:</span>
                <span className="text-sm font-bold text-rose-700 tabular-nums">{formatBDT(selectedSupp.outstanding_balance || 0)}</span>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Amount (BDT) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-right tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Source</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="cash">Physical Cash (Drawn from drawer)</option>
                  <option value="bkash">bKash Merchant</option>
                  <option value="nagad">Nagad</option>
                  <option value="card">Bank Transfer / Card</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Bank / Cheque / TrxID Ref</label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="e.g. Bank Cheque #98021 or TrxID"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                >
                  Post Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl border border-slate-200 p-5 space-y-4 text-xs">
            <div className="flex items-center gap-2.5 text-rose-600">
              <Trash2 className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900">
                {lang === 'bn' ? 'সরবরাহকারী মুছে ফেলবেন?' : 'Delete Supplier?'}
              </h3>
            </div>
            <p className="text-slate-600 leading-relaxed">
              {lang === 'bn'
                ? `"${deleteTarget.name}" তালিকা থেকে মুছে ফেলা হবে। কোনো পূর্বের চালান বা পেমেন্ট থাকলে হিসাবের নিরাপত্তার জন্য মুছতে দেওয়া হবে না।`
                : `Delete "${deleteTarget.name}"? Suppliers with existing purchase invoices or payments cannot be deleted.`}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? '...' : (lang === 'bn' ? 'হ্যাঁ, মুছে ফেলুন' : 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
