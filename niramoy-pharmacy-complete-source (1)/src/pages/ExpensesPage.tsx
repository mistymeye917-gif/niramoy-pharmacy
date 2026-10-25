import React, { useState, useEffect } from 'react';
import { Expense, Language, PharmacySettings } from '../types/pharmacy';
import { getTranslation } from '../i18n/translations';
import { api } from '../services/api';
import { formatBDT, formatDate } from '../services/formatters';
import {
  Banknote,
  Plus,
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
  X,
  CheckCircle2
} from 'lucide-react';

interface ExpensesPageProps {
  lang: Language;
  settings: PharmacySettings;
}

export const ExpensesPage: React.FC<ExpensesPageProps> = ({
  lang,
  settings
}) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [cashOnHand, setCashOnHand] = useState<number>(0);

  // New Expense Modal
  const [showExpModal, setShowExpModal] = useState(false);
  const [newExp, setNewExp] = useState<Partial<Expense>>({
    category: 'Rent',
    amount: 1000,
    expense_date: new Date().toISOString().split('T')[0],
    description: '',
    payee: '',
    payment_method: 'cash',
    reference_no: ''
  });

  // Cash Movement Modal (Deposit / Withdrawal)
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashType, setCashType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [cashAmount, setCashAmount] = useState<number>(1000);
  const [cashReason, setCashReason] = useState('');
  const [notice, setNotice] = useState('');

  const t = (key: any) => getTranslation(lang, key);

  const loadData = async () => {
    try {
      setLoading(true);
      const [exps, dash] = await Promise.all([
        api.getExpenses(),
        api.getDashboard()
      ]);
      setExpenses(exps);
      setCashOnHand(dash.physical_cash_drawer);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExp.category || !newExp.amount || !newExp.description || !newExp.payee) {
      alert('Please fill all expense fields.');
      return;
    }
    try {
      await api.addExpense(newExp);
      setShowExpModal(false);
      setNotice(`Expense of ${formatBDT(newExp.amount || 0)} recorded`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to record expense');
    }
  };

  const handleCashMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cashAmount <= 0 || !cashReason.trim()) {
      alert('Please enter valid amount and reason.');
      return;
    }
    try {
      await api.recordCashMovement(cashType, cashAmount, cashReason.trim());
      setShowCashModal(false);
      setNotice(`Cash ${cashType} of ${formatBDT(cashAmount)} recorded successfully`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Cash movement failed');
    }
  };

  const totalExpenseAmount = expenses.reduce((acc, e) => acc + e.amount, 0);

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {t('exp_title')}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Operating overhead, daily utilities, staff, and isolated physical drawer cash auditing.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setCashType('deposit');
              setCashAmount(1000);
              setCashReason('Cash opening float or bank withdrawal deposit');
              setShowCashModal(true);
            }}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Wallet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Cash In/Out</span>
          </button>
          <button
            onClick={() => setShowExpModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('exp_add')}</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{notice}</span>
        </div>
      )}

      {/* Cash Drawer Isolation Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">{t('dash_cash_drawer')}</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1">{formatBDT(cashOnHand)}</div>
          <div className="text-[11px] text-slate-500 mt-1">Physical notes & coins in drawer</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Total Operating Overhead</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1">{formatBDT(totalExpenseAmount)}</div>
          <div className="text-[11px] text-slate-500 mt-1">All recorded shop expenses</div>
        </div>
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 shadow-xs">
          <div className="text-xs text-emerald-800 font-medium">Strict Accounting Separation</div>
          <div className="text-xs text-emerald-700 mt-1 leading-relaxed">
            bKash, Nagad, Rocket, card receipts, and credit sales are never commingled into physical cash-on-hand.
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 font-bold text-xs text-slate-700 bg-slate-50">
          Expense Records Ledger
        </div>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
              <th className="p-3 text-left">{t('exp_category')}</th>
              <th className="p-3 text-left">{t('exp_description')}</th>
              <th className="p-3 text-left">{t('exp_payee')}</th>
              <th className="p-3 text-center">{t('date')}</th>
              <th className="p-3 text-center">{t('exp_method')}</th>
              <th className="p-3 text-right">{t('exp_amount')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400">{t('loading')}</td>
              </tr>
            ) : expenses.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400">{t('no_records')}</td>
              </tr>
            ) : (
              expenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3 font-semibold text-slate-900">{exp.category}</td>
                  <td className="p-3 text-slate-600">{exp.description}</td>
                  <td className="p-3 text-slate-700">{exp.payee}</td>
                  <td className="p-3 text-center text-slate-500">{formatDate(exp.expense_date, lang)}</td>
                  <td className="p-3 text-center">
                    <span className="font-mono uppercase text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                      {exp.payment_method}
                    </span>
                  </td>
                  <td className="p-3 text-right font-bold text-slate-900 tabular-nums">
                    {formatBDT(exp.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Expense Modal */}
      {showExpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">{t('exp_add')}</h3>
              <button onClick={() => setShowExpModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveExpense} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('exp_category')} *</label>
                  <select
                    value={newExp.category}
                    onChange={(e) => setNewExp({ ...newExp, category: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="Rent">Shop Rent</option>
                    <option value="Utilities">Utilities (DESCO / WASA)</option>
                    <option value="Staff Salary">Staff / Employee Salary</option>
                    <option value="Packaging & Bags">Packaging Bags / Polythene</option>
                    <option value="Tea & Snacks">Tea & Refreshments</option>
                    <option value="Cleaning & Sanitation">Cleaning & Sanitizer</option>
                    <option value="Maintenance">Shop Maintenance & Repair</option>
                    <option value="Other">Other Operating Expense</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('exp_amount')} (BDT) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newExp.amount || 0}
                    onChange={(e) => setNewExp({ ...newExp, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-right tabular-nums"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('exp_payee')} *</label>
                <input
                  type="text"
                  required
                  value={newExp.payee || ''}
                  onChange={(e) => setNewExp({ ...newExp, payee: e.target.value })}
                  placeholder="e.g. Building Landlord / Electrician"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('exp_description')} *</label>
                <input
                  type="text"
                  required
                  value={newExp.description || ''}
                  onChange={(e) => setNewExp({ ...newExp, description: e.target.value })}
                  placeholder="e.g. Monthly shop electrical bill for October"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Paid From Account</label>
                  <select
                    value={newExp.payment_method}
                    onChange={(e) => setNewExp({ ...newExp, payment_method: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="cash">Physical Cash Drawer</option>
                    <option value="bkash">bKash</option>
                    <option value="nagad">Nagad</option>
                    <option value="card">Bank / Card</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Expense Date</label>
                  <input
                    type="date"
                    value={newExp.expense_date}
                    onChange={(e) => setNewExp({ ...newExp, expense_date: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowExpModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                >
                  Record Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cash Movement Modal */}
      {showCashModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">{t('exp_add_cash_movement')}</h3>
              <button onClick={() => setShowCashModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCashMovement} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Movement Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCashType('deposit')}
                    className={`py-2 px-3 rounded-lg border font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                      cashType === 'deposit' ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <ArrowDownCircle className="w-4 h-4 text-emerald-600" />
                    <span>Cash Deposit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCashType('withdrawal')}
                    className={`py-2 px-3 rounded-lg border font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                      cashType === 'withdrawal' ? 'bg-rose-50 border-rose-300 text-rose-800' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <ArrowUpCircle className="w-4 h-4 text-rose-600" />
                    <span>Cash Withdrawal</span>
                  </button>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amount (BDT) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={cashAmount}
                  onChange={(e) => setCashAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-right tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Audit Reason / Justification *</label>
                <input
                  type="text"
                  required
                  value={cashReason}
                  onChange={(e) => setCashReason(e.target.value)}
                  placeholder="e.g. Bank deposit of excess drawer cash"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCashModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                >
                  Confirm Movement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
