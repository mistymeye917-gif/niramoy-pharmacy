import React, { useState, useEffect } from 'react';
import { SaleInvoice, ReturnItemInput, Language, PharmacySettings } from '../types/pharmacy';
import { getTranslation } from '../i18n/translations';
import { api } from '../services/api';
import { formatBDT, formatDateTime } from '../services/formatters';
import {
  RotateCcw,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

interface ReturnsPageProps {
  lang: Language;
  settings: PharmacySettings;
}

export const ReturnsPage: React.FC<ReturnsPageProps> = ({
  lang,
  settings
}) => {
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [invoice, setInvoice] = useState<SaleInvoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Return quantities & condition state
  const [returnItems, setReturnItems] = useState<{
    [saleLineId: number]: {
      qty: number;
      condition: 'saleable' | 'damaged' | 'pending_inspection';
    };
  }>({});
  const [refundMethod, setRefundMethod] = useState<'cash' | 'bkash' | 'nagad' | 'rocket' | 'credit'>('cash');
  const [returnReason, setReturnReason] = useState('Customer returned unused sealed medicines');

  // Cancel bill state
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [cancelReason, setCancelReason] = useState('Incorrect bill entry at counter');

  const t = (key: any) => getTranslation(lang, key);

  const handleSearchInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceQuery.trim()) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const sales = await api.getSales(50, invoiceQuery.trim());
      const found = sales.find(s => s.invoice_number.toUpperCase() === invoiceQuery.trim().toUpperCase()) || sales[0];
      if (!found) {
        setError(`Invoice #${invoiceQuery} not found in database.`);
        setInvoice(null);
      } else {
        setInvoice(found);
        // Initialize return state
        const initialMap: any = {};
        for (const item of found.items || []) {
          initialMap[item.id] = { qty: 0, condition: 'saleable' };
        }
        setReturnItems(initialMap);
      }
    } catch (err: any) {
      setError(err.message || 'Error searching invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteReturn = async () => {
    if (!invoice) return;
    const itemsToReturn: ReturnItemInput[] = [];

    for (const item of invoice.items || []) {
      const state = returnItems[item.id];
      if (state && state.qty > 0) {
        if (state.qty > item.quantity) {
          setError(`Cannot return more than sold quantity (${item.quantity} ${item.unit})`);
          return;
        }
        itemsToReturn.push({
          sale_line_id: item.id,
          medicine_id: item.medicine_id,
          batch_id: 1, // Allocated batch
          quantity_to_return: state.qty,
          unit: item.unit,
          multiplier: item.multiplier,
          unit_price: item.unit_price,
          refund_amount: Math.round(state.qty * item.unit_price * 100) / 100,
          condition: state.condition
        });
      }
    }

    if (itemsToReturn.length === 0) {
      setError('Please select at least one item and quantity to return.');
      return;
    }

    try {
      setLoading(true);
      await api.processReturn({
        sale_id: invoice.id,
        items: itemsToReturn,
        refund_method: refundMethod,
        reason: returnReason
      });
      setSuccess(`Return for invoice #${invoice.invoice_number} processed successfully!`);
      // Reload invoice
      const updated = await api.getSaleById(invoice.id);
      setInvoice(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to process return');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelInvoice = async () => {
    if (!invoice) return;
    try {
      setLoading(true);
      await api.cancelSale(invoice.id, cancelReason);
      setShowCancelPrompt(false);
      setSuccess(`Invoice #${invoice.invoice_number} cancelled and reversed in audit logs.`);
      const updated = await api.getSaleById(invoice.id);
      setInvoice(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to cancel invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          {t('ret_title')}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Process partial/full medicine returns with condition inspection or reverse cancelled sales while preserving audit history.
        </p>
      </div>

      {/* Invoice Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <form onSubmit={handleSearchInvoice} className="flex items-center gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={invoiceQuery}
              onChange={(e) => setInvoiceQuery(e.target.value)}
              placeholder="Enter complete Invoice # (e.g. INV-20261025-0001)..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-xs font-mono uppercase focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
          >
            {loading ? t('loading') : t('ret_find_invoice')}
          </button>
        </form>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{success}</span>
        </div>
      )}

      {/* Invoice Details & Return Form */}
      {invoice && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-4">
          {/* Invoice Summary Header */}
          <div className="p-5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-900 font-mono">{invoice.invoice_number}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                  invoice.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  {invoice.status}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Customer: <span className="font-semibold text-slate-800">{invoice.customer_name || 'Walk-in'}</span> · Date: {formatDateTime(invoice.created_at || invoice.sale_date, lang)}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-[11px] text-slate-500 block">Final Bill Payable</span>
                <span className="text-lg font-bold text-slate-900 tabular-nums">{formatBDT(invoice.final_payable)}</span>
              </div>
              {invoice.status !== 'cancelled' && (
                <button
                  onClick={() => setShowCancelPrompt(true)}
                  className="px-3 py-1.5 border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  {t('ret_cancel_bill')}
                </button>
              )}
            </div>
          </div>

          {/* Items Return Table */}
          <div className="p-5">
            <h4 className="text-xs font-bold text-slate-800 mb-3 uppercase tracking-wider">
              {t('ret_select_items')}
            </h4>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="p-3 text-left">Medicine</th>
                    <th className="p-3 text-center">Sold Qty</th>
                    <th className="p-3 text-right">Unit Price</th>
                    <th className="p-3 text-center w-28">Return Qty</th>
                    <th className="p-3 text-left w-56">{t('ret_condition')}</th>
                    <th className="p-3 text-right">Refund Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(invoice.items || []).map((item) => {
                    const state = returnItems[item.id] || { qty: 0, condition: 'saleable' };
                    const refundVal = Math.round(state.qty * item.unit_price * 100) / 100;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-3">
                          <div className="font-semibold text-slate-900">{item.brand_name}</div>
                          <div className="text-[11px] text-slate-500">{item.generic_name}</div>
                        </td>
                        <td className="p-3 text-center font-semibold text-slate-700">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="p-3 text-right tabular-nums">{formatBDT(item.unit_price, false)}</td>
                        <td className="p-3 text-center">
                          <input
                            type="number"
                            min="0"
                            max={item.quantity}
                            value={state.qty}
                            onChange={(e) => {
                              const val = Math.max(0, Math.min(item.quantity, parseInt(e.target.value, 10) || 0));
                              setReturnItems({
                                ...returnItems,
                                [item.id]: { ...state, qty: val }
                              });
                            }}
                            className="w-16 px-2 py-1 border border-slate-300 rounded text-center font-bold tabular-nums"
                          />
                        </td>
                        <td className="p-3">
                          <select
                            value={state.condition}
                            onChange={(e) => {
                              setReturnItems({
                                ...returnItems,
                                [item.id]: { ...state, condition: e.target.value as any }
                              });
                            }}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-[11px] font-medium"
                          >
                            <option value="saleable">Saleable (Restock)</option>
                            <option value="damaged">Damaged (Exclude stock)</option>
                            <option value="pending_inspection">Pending (Quarantine)</option>
                          </select>
                        </td>
                        <td className="p-3 text-right font-bold text-slate-900 tabular-nums">
                          {formatBDT(refundVal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Return & Refund Execution Form */}
            <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Refund Source / Method</label>
                <select
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                >
                  <option value="cash">Physical Cash Drawer</option>
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="credit">Deduct from Customer Credit</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Reason for Return</label>
                <input
                  type="text"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={handleExecuteReturn}
                disabled={loading || invoice.status === 'cancelled'}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
              >
                {t('ret_process')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bill Cancellation Confirmation Modal */}
      {showCancelPrompt && invoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 p-6 space-y-4 text-xs">
            <div className="flex items-center gap-3 text-rose-600">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-900">Confirm Bill Cancellation</h3>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Cancelling invoice <strong>#{invoice.invoice_number}</strong> will automatically restore batch inventory, reverse revenue and COGS, and record a permanent cancellation audit trail. The historical record will not be deleted.
            </p>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Reason for Cancellation *</label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelPrompt(false)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleCancelInvoice}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
