import React, { useState, useEffect } from 'react';
import { Language, PharmacySettings, SaleInvoice, PurchaseInvoice, Expense, Medicine, InventoryBatch } from '../types/pharmacy';
import { getTranslation } from '../i18n/translations';
import { api } from '../services/api';
import { formatBDT, formatDate, formatDateTime, getDaysUntilExpiry } from '../services/formatters';
import * as XLSX from 'xlsx';
import {
  BarChart3,
  FileSpreadsheet,
  Download,
  Printer,
  Calendar,
  Filter,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Clock,
  Package
} from 'lucide-react';

interface ReportsPageProps {
  lang: Language;
  settings: PharmacySettings;
}

type ReportType = 
  | 'daily_sales' 
  | 'profit_loss' 
  | 'stock_valuation' 
  | 'expiry_register' 
  | 'low_stock' 
  | 'expenses' 
  | 'receivables_payables'
  | 'audit_log';

export const ReportsPage: React.FC<ReportsPageProps> = ({
  lang,
  settings
}) => {
  const [reportType, setReportType] = useState<ReportType>('daily_sales');
  const [sales, setSales] = useState<SaleInvoice[]>([]);
  const [purchases, setPurchases] = useState<PurchaseInvoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const t = (key: any) => getTranslation(lang, key);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);
        const [s, p, e, m, b, a] = await Promise.all([
          api.getSales(200),
          api.getPurchases(200),
          api.getExpenses(),
          api.getMedicines(),
          api.getBatches(undefined, true),
          api.getAuditLogs(100)
        ]);
        setSales(s);
        setPurchases(p);
        setExpenses(e);
        setMedicines(m);
        setBatches(b);
        setAuditLogs(a);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, []);

  // Filter sales by date range
  const filteredSales = sales.filter(s => {
    const d = s.sale_date;
    return d >= startDate && d <= endDate;
  });

  const totalSalesRevenue = filteredSales.filter(s => s.status !== 'cancelled').reduce((acc, s) => acc + s.final_payable, 0);
  const totalCogs = filteredSales.filter(s => s.status !== 'cancelled').reduce((acc, s) => {
    return acc + (s.items?.reduce((lAcc, l) => lAcc + l.cost_of_goods, 0) || 0);
  }, 0);
  const grossProfit = Math.round((totalSalesRevenue - totalCogs) * 100) / 100;

  const filteredExpenses = expenses.filter(e => e.expense_date >= startDate && e.expense_date <= endDate);
  const totalPeriodExpenses = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
  const netProfit = Math.round((grossProfit - totalPeriodExpenses) * 100) / 100;

  // Export current report table to Excel (.xlsx)
  const handleExportExcel = () => {
    let sheetData: any[] = [];
    let reportFilename = `Report-${reportType}-${today}.xlsx`;

    if (reportType === 'daily_sales') {
      sheetData = filteredSales.map(s => ({
        'Invoice Number': s.invoice_number,
        'Date': s.sale_date,
        'Customer': s.customer_name || 'Walk-in',
        'Subtotal (BDT)': s.subtotal,
        'Discount (BDT)': s.discount_amount,
        'Final Payable (BDT)': s.final_payable,
        'Paid (BDT)': s.paid_amount,
        'Credit Due (BDT)': s.credit_amount,
        'Status': s.status
      }));
    } else if (reportType === 'profit_loss') {
      sheetData = [
        { 'Metric': 'Sales Revenue', 'Amount (BDT)': totalSalesRevenue },
        { 'Metric': 'Cost of Goods Sold (Batch Purchase Cost)', 'Amount (BDT)': totalCogs },
        { 'Metric': 'Gross Profit', 'Amount (BDT)': grossProfit },
        { 'Metric': 'Total Operating Overhead', 'Amount (BDT)': totalPeriodExpenses },
        { 'Metric': 'Net Business Profit', 'Amount (BDT)': netProfit }
      ];
    } else if (reportType === 'stock_valuation') {
      sheetData = medicines.map(m => ({
        'Brand Name': m.brand_name,
        'Generic Name': m.generic_name,
        'Manufacturer': m.manufacturer,
        'Base Unit': m.base_unit,
        'Total Remaining Units': m.total_stock,
        'Unit Sale Price (BDT)': m.sale_price,
        'Estimated Retail Value (BDT)': (m.total_stock || 0) * m.sale_price
      }));
    } else if (reportType === 'expiry_register') {
      sheetData = batches.map(b => ({
        'Medicine': b.brand_name,
        'Batch Number': b.batch_number,
        'Expiry Date': b.expiry_date,
        'Days Left': getDaysUntilExpiry(b.expiry_date),
        'Remaining Qty': b.remaining_qty,
        'Cost Per Unit (BDT)': b.purchase_cost,
        'Total Cost Value (BDT)': b.remaining_qty * b.purchase_cost,
        'Status': b.status
      }));
    } else if (reportType === 'expenses') {
      sheetData = filteredExpenses.map(e => ({
        'Category': e.category,
        'Description': e.description,
        'Payee': e.payee,
        'Date': e.expense_date,
        'Payment Method': e.payment_method,
        'Amount (BDT)': e.amount
      }));
    } else if (reportType === 'audit_log') {
      sheetData = auditLogs.map(a => ({
        'Action': a.user_action,
        'Entity': a.entity_type,
        'Details': a.details,
        'Timestamp': a.timestamp
      }));
    }

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, reportFilename);
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {t('rep_title')}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit-grade financial and operational reports with instant Excel (.xlsx) and print export.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('export_excel')}</span>
          </button>
          <button
            onClick={handlePrintReport}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print View</span>
          </button>
        </div>
      </div>

      {/* Navigation Filter Tabs & Date Range Selector */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Report Tabs */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs font-medium">
          {[
            { id: 'daily_sales', label: t('rep_daily_sales') },
            { id: 'profit_loss', label: t('rep_profit_loss') },
            { id: 'stock_valuation', label: t('rep_stock_val') },
            { id: 'expiry_register', label: t('rep_expiry_report') },
            { id: 'low_stock', label: t('rep_low_stock') },
            { id: 'expenses', label: t('rep_expenses') },
            { id: 'audit_log', label: t('rep_audit_trail') }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setReportType(tab.id as any)}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer whitespace-nowrap ${
                reportType === tab.id
                  ? 'bg-white text-emerald-800 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2 text-xs">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono"
          />
        </div>
      </div>

      {/* Report Content Panels */}
      {reportType === 'daily_sales' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs font-bold text-slate-700">
            <span>Sales Invoices ({filteredSales.length})</span>
            <span>Total Filtered Revenue: {formatBDT(totalSalesRevenue)}</span>
          </div>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/60 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="p-3 text-left">Invoice #</th>
                <th className="p-3 text-left">Customer</th>
                <th className="p-3 text-center">Date & Time</th>
                <th className="p-3 text-right">Subtotal</th>
                <th className="p-3 text-right">Discount</th>
                <th className="p-3 text-right">Net Payable</th>
                <th className="p-3 text-right">Paid</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="p-3 font-mono font-semibold text-slate-900">{s.invoice_number}</td>
                  <td className="p-3 text-slate-700">{s.customer_name || 'Walk-in'}</td>
                  <td className="p-3 text-center text-slate-500">{formatDateTime(s.created_at || s.sale_date, lang)}</td>
                  <td className="p-3 text-right tabular-nums">{formatBDT(s.subtotal)}</td>
                  <td className="p-3 text-right tabular-nums text-emerald-700">-{formatBDT(s.discount_amount)}</td>
                  <td className="p-3 text-right tabular-nums font-bold text-slate-900">{formatBDT(s.final_payable)}</td>
                  <td className="p-3 text-right tabular-nums font-semibold text-emerald-700">{formatBDT(s.paid_amount)}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${
                      s.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reportType === 'profit_loss' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
          <h3 className="text-base font-bold text-slate-900">
            Statement of Profit & Loss (Batch Purchase Cost Based)
          </h3>
          <div className="max-w-xl divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden text-xs">
            <div className="p-4 flex justify-between bg-slate-50 font-bold text-slate-800">
              <span>Financial Metric</span>
              <span>Amount (BDT)</span>
            </div>
            <div className="p-3.5 flex justify-between text-slate-700">
              <span>Gross Sales Revenue</span>
              <span className="font-semibold tabular-nums">{formatBDT(totalSalesRevenue)}</span>
            </div>
            <div className="p-3.5 flex justify-between text-slate-700">
              <span>Cost of Goods Sold (COGS from batches sold)</span>
              <span className="font-semibold text-rose-700 tabular-nums">-{formatBDT(totalCogs)}</span>
            </div>
            <div className="p-3.5 flex justify-between bg-emerald-50/60 font-bold text-emerald-900">
              <span>Gross Profit</span>
              <span className="tabular-nums text-sm">{formatBDT(grossProfit)}</span>
            </div>
            <div className="p-3.5 flex justify-between text-slate-700">
              <span>Operating Expenses (Overhead & Utilities)</span>
              <span className="font-semibold text-rose-700 tabular-nums">-{formatBDT(totalPeriodExpenses)}</span>
            </div>
            <div className="p-4 flex justify-between bg-slate-900 text-white font-bold text-sm">
              <span>Net Profit (for selected period)</span>
              <span className="tabular-nums text-emerald-400">{formatBDT(netProfit)}</span>
            </div>
          </div>
        </div>
      )}

      {reportType === 'stock_valuation' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700">
            Current Stock Valuation by Medicine
          </div>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/60 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="p-3 text-left">Brand Name</th>
                <th className="p-3 text-left">Generic Formula</th>
                <th className="p-3 text-left">Company</th>
                <th className="p-3 text-center">Remaining Stock</th>
                <th className="p-3 text-right">Unit Sale Price</th>
                <th className="p-3 text-right">Retail Valuation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {medicines.map(m => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="p-3 font-semibold text-slate-900">{m.brand_name} ({m.strength})</td>
                  <td className="p-3 text-slate-600">{m.generic_name}</td>
                  <td className="p-3 text-slate-500">{m.manufacturer}</td>
                  <td className="p-3 text-center font-bold">{m.total_stock} {m.base_unit}</td>
                  <td className="p-3 text-right tabular-nums">{formatBDT(m.sale_price)}</td>
                  <td className="p-3 text-right font-bold text-emerald-800 tabular-nums">
                    {formatBDT((m.total_stock || 0) * m.sale_price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reportType === 'expiry_register' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700">
            Comprehensive Batch Expiry Register (FEFO Priority)
          </div>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/60 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="p-3 text-left">Medicine</th>
                <th className="p-3 text-left">Batch No</th>
                <th className="p-3 text-left">Expiry Date</th>
                <th className="p-3 text-center">Days Left</th>
                <th className="p-3 text-right">Stock Qty</th>
                <th className="p-3 text-right">Unit Cost</th>
                <th className="p-3 text-center">Batch Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batches.map(b => {
                const days = getDaysUntilExpiry(b.expiry_date);
                const isExp = days <= 0;
                return (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-slate-900">{b.brand_name}</td>
                    <td className="p-3 font-mono text-slate-700">{b.batch_number}</td>
                    <td className="p-3 text-slate-600">{formatDate(b.expiry_date, lang)}</td>
                    <td className="p-3 text-center">
                      <span className={`font-semibold ${isExp ? 'text-rose-700' : days <= 30 ? 'text-amber-700' : 'text-slate-600'}`}>
                        {isExp ? 'EXPIRED' : `${days} days`}
                      </span>
                    </td>
                    <td className="p-3 text-right font-bold tabular-nums">{b.remaining_qty} {b.stock_unit}</td>
                    <td className="p-3 text-right tabular-nums">{formatBDT(b.purchase_cost)}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono font-bold ${
                        isExp ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {isExp ? 'Expired' : b.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {reportType === 'low_stock' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700">
            Low Stock Alert Items (&le; {settings.low_stock_threshold} units)
          </div>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/60 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="p-3 text-left">Brand</th>
                <th className="p-3 text-left">Generic</th>
                <th className="p-3 text-left">Company</th>
                <th className="p-3 text-center">Current Stock</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {medicines.filter(m => (m.total_stock || 0) <= settings.low_stock_threshold).map(m => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="p-3 font-semibold text-slate-900">{m.brand_name} ({m.strength})</td>
                  <td className="p-3 text-slate-600">{m.generic_name}</td>
                  <td className="p-3 text-slate-500">{m.manufacturer}</td>
                  <td className="p-3 text-center font-bold text-amber-700">{m.total_stock} {m.base_unit}</td>
                  <td className="p-3 text-center">
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold text-[10px] uppercase">
                      Reorder Needed
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reportType === 'expenses' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700">
            Operating Expenses ({filteredExpenses.length}) · Total: {formatBDT(totalPeriodExpenses)}
          </div>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/60 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="p-3 text-left">Category</th>
                <th className="p-3 text-left">Description</th>
                <th className="p-3 text-left">Payee</th>
                <th className="p-3 text-center">Date</th>
                <th className="p-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.map(e => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="p-3 font-semibold text-slate-900">{e.category}</td>
                  <td className="p-3 text-slate-600">{e.description}</td>
                  <td className="p-3 text-slate-700">{e.payee}</td>
                  <td className="p-3 text-center text-slate-500">{formatDate(e.expense_date, lang)}</td>
                  <td className="p-3 text-right font-bold text-slate-900 tabular-nums">{formatBDT(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reportType === 'audit_log' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700">
            System Security & Transaction Audit Trail
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {auditLogs.map(a => (
              <div key={a.id} className="p-3.5 hover:bg-slate-50 flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-slate-900 font-mono text-[11px] text-emerald-700">
                    [{a.user_action}] {a.entity_type} {a.entity_id ? `(#${a.entity_id})` : ''}
                  </div>
                  <div className="text-slate-600 text-[11px] mt-0.5">{a.details}</div>
                </div>
                <div className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
                  {formatDateTime(a.timestamp, lang)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
