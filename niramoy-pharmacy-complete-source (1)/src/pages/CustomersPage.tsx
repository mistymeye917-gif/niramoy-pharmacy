import React, { useState, useEffect } from 'react';
import { Customer, Language, PharmacySettings } from '../types/pharmacy';
import { getTranslation } from '../i18n/translations';
import { api } from '../services/api';
import { formatBDT, formatDate } from '../services/formatters';
import {
  Users,
  Plus,
  Search,
  DollarSign,
  Phone,
  MapPin,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface CustomersPageProps {
  lang: Language;
  settings: PharmacySettings;
}

export const CustomersPage: React.FC<CustomersPageProps> = ({
  lang,
  settings
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Add Customer Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCust, setNewCust] = useState<Partial<Customer>>({
    name: '',
    phone: '',
    address: '',
    balance: 0.0,
    notes: ''
  });

  // Receive Payment Modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedCust, setSelectedCust] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<'cash' | 'bkash' | 'nagad' | 'rocket' | 'card'>('cash');
  const [payRef, setPayRef] = useState('');
  const [message, setMessage] = useState('');

  const t = (key: any) => getTranslation(lang, key);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await api.getCustomers(search);
      setCustomers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [search]);

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCust.name || !newCust.phone) {
      alert('Name and phone number are required.');
      return;
    }
    try {
      await api.saveCustomer(newCust);
      setShowAddModal(false);
      setNewCust({ name: '', phone: '', address: '', balance: 0.0, notes: '' });
      setMessage('Customer registered successfully');
      loadCustomers();
    } catch (err: any) {
      alert(err.message || 'Failed to save customer');
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCust || payAmount <= 0) {
      alert('Please enter valid repayment amount.');
      return;
    }
    try {
      await api.recordCustomerPayment({
        customer_id: selectedCust.id,
        amount: payAmount,
        payment_method: payMethod,
        reference: payRef
      });
      setShowPayModal(false);
      setMessage(`Payment of ${formatBDT(payAmount)} received from ${selectedCust.name}`);
      loadCustomers();
    } catch (err: any) {
      alert(err.message || 'Payment recording failed');
    }
  };

  const totalReceivables = customers.reduce((acc, c) => acc + (c.balance > 0 ? c.balance : 0), 0);

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {t('cust_title')}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track customer receivables, credit sales accounts, and partial/full repayments.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[11px] text-slate-500 block">Total Due Balance</span>
            <span className="text-base font-bold text-rose-700 tabular-nums">{formatBDT(totalReceivables)}</span>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('cust_add')}</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{message}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer name or phone number..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
              <th className="p-3 text-left">{t('cust_name')}</th>
              <th className="p-3 text-left">{t('cust_phone')}</th>
              <th className="p-3 text-left">{t('cust_address')}</th>
              <th className="p-3 text-right">{t('cust_balance')}</th>
              <th className="p-3 text-center w-36">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400">{t('loading')}</td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400">{t('no_records')}</td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3 font-semibold text-slate-900">{c.name}</td>
                  <td className="p-3 text-slate-600 font-mono">{c.phone}</td>
                  <td className="p-3 text-slate-500">{c.address || '—'}</td>
                  <td className="p-3 text-right font-bold tabular-nums">
                    <span className={c.balance > 0 ? 'text-rose-700' : 'text-emerald-700'}>
                      {formatBDT(c.balance)}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    {c.balance > 0 ? (
                      <button
                        onClick={() => {
                          setSelectedCust(c);
                          setPayAmount(c.balance);
                          setShowPayModal(true);
                        }}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold cursor-pointer shadow-xs"
                      >
                        Receive Payment
                      </button>
                    ) : (
                      <span className="text-slate-400 text-[11px]">Clear</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">{t('cust_add')}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveCustomer} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('cust_name')} *</label>
                <input
                  type="text"
                  required
                  value={newCust.name || ''}
                  onChange={(e) => setNewCust({ ...newCust, name: e.target.value })}
                  placeholder="e.g. Rafiqul Islam"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('cust_phone')} *</label>
                <input
                  type="text"
                  required
                  value={newCust.phone || ''}
                  onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })}
                  placeholder="+880 1..."
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('cust_address')}</label>
                <input
                  type="text"
                  value={newCust.address || ''}
                  onChange={(e) => setNewCust({ ...newCust, address: e.target.value })}
                  placeholder="e.g. House 4, Dhanmondi, Dhaka"
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

      {/* Receive Payment Modal */}
      {showPayModal && selectedCust && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                Receive Payment — {selectedCust.name}
              </h3>
              <button onClick={() => setShowPayModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRecordPayment} className="p-5 space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
                <span className="text-slate-600">Total Outstanding Balance:</span>
                <span className="text-sm font-bold text-rose-700 tabular-nums">{formatBDT(selectedCust.balance)}</span>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Repayment Amount (BDT) *</label>
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
                <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="cash">Physical Cash</option>
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="rocket">Rocket</option>
                  <option value="card">Bank Card</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Transaction Ref / Note</label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="e.g. bKash TrxID or Cash Receipt"
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
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                >
                  Confirm & Deduct Balance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
