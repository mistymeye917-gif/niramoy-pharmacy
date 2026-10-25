import React, { useEffect, useState } from 'react';
import { Language, DashboardStats, PharmacySettings, SaleInvoice } from '../types/pharmacy';
import { getTranslation } from '../i18n/translations';
import { api } from '../services/api';
import { formatBDT, formatDate, formatDateTime } from '../services/formatters';
import {
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Clock,
  Package,
  Wallet,
  Users,
  Building2,
  ShoppingCart,
  PlusCircle,
  RotateCcw,
  Printer,
  ChevronRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

interface DashboardPageProps {
  lang: Language;
  settings: PharmacySettings;
  onNavigate: (tab: string) => void;
  onReprintReceipt: (invoice: SaleInvoice) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  lang,
  settings,
  onNavigate,
  onReprintReceipt
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const t = (key: any) => getTranslation(lang, key);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await api.getDashboard();
      setStats(data);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <div className="text-sm font-medium text-slate-600">{t('loading')}</div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex-1 p-8">
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          Failed to load live data: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto space-y-6">
      {/* Top Banner / Quick Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {t('nav_dashboard')}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time financial and inventory telemetry from local SQLite database.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onNavigate('pos')}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Open POS Counter (F2)</span>
          </button>
          <button
            onClick={() => onNavigate('purchases')}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Purchase</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Grid (60-30-10 Color Discipline) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">{t('dash_today_sales')}</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {formatBDT(stats.today_sales)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>COGS: {formatBDT(stats.today_cogs)}</span>
            <span className="font-semibold text-emerald-700">GP: {formatBDT(stats.today_gross_profit)}</span>
          </div>
        </div>

        {/* Physical Cash Drawer */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">{t('dash_cash_drawer')}</span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {formatBDT(stats.physical_cash_drawer)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Physical drawer cash (excludes bKash/Nagad/Credit)
          </div>
        </div>

        {/* Today's Net Profit */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">{t('dash_net_profit')}</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className={`text-2xl font-bold tabular-nums ${stats.today_net_profit >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
            {formatBDT(stats.today_net_profit)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Operating expenses today: {formatBDT(stats.today_expenses)}
          </div>
        </div>

        {/* Stock Valuation */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">{t('dash_stock_value')}</span>
            <Package className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {formatBDT(stats.total_stock_value)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Calculated at batch purchase costs
          </div>
        </div>
      </div>

      {/* Alerts & Critical Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Low Stock Alert */}
        <div
          onClick={() => onNavigate('medicines')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            stats.low_stock_count > 0 ? 'bg-amber-50/60 border-amber-200 hover:border-amber-300' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-700">{t('dash_low_stock')}</div>
            <AlertTriangle className={`w-4 h-4 ${stats.low_stock_count > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
            {stats.low_stock_count} <span className="text-xs font-normal text-slate-500">medicines</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Threshold: &le; {settings.low_stock_threshold} units</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </div>
        </div>

        {/* Near Expiry Alert */}
        <div
          onClick={() => onNavigate('reports')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            stats.near_expiry_count > 0 ? 'bg-amber-50/60 border-amber-200 hover:border-amber-300' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-700">{t('dash_near_expiry')}</div>
            <Clock className={`w-4 h-4 ${stats.near_expiry_count > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
            {stats.near_expiry_count} <span className="text-xs font-normal text-slate-500">batches</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Within next {settings.expiry_warning_days} days</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </div>
        </div>

        {/* Customer Receivables */}
        <div
          onClick={() => onNavigate('customers')}
          className="p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-700">{t('dash_receivables')}</div>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
            {formatBDT(stats.customer_receivables)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Outstanding credit due</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </div>
        </div>

        {/* Supplier Payables */}
        <div
          onClick={() => onNavigate('suppliers')}
          className="p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-700">{t('dash_payables')}</div>
            <Building2 className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
            {formatBDT(stats.supplier_payables)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Outstanding to companies</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Recent Transactions Split Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sales Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-emerald-600" />
              <span>{t('dash_recent_sales')}</span>
            </h3>
            <button
              onClick={() => onNavigate('reports')}
              className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
            >
              View All Invoices &rarr;
            </button>
          </div>
          <div className="divide-y divide-slate-100 overflow-x-auto">
            {stats.recent_sales.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                {t('no_records')}
              </div>
            ) : (
              stats.recent_sales.map((sale) => (
                <div key={sale.id} className="p-3.5 hover:bg-slate-50/80 flex items-center justify-between gap-4 text-xs transition-colors">
                  <div>
                    <div className="font-semibold text-slate-800 font-mono">
                      {sale.invoice_number}
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      {sale.customer_name || 'Walk-in Customer'} · {formatDateTime(sale.created_at || sale.sale_date, lang)}
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div>
                      <div className="font-bold text-slate-900 tabular-nums">
                        {formatBDT(sale.final_payable)}
                      </div>
                      <div className="text-[10px] uppercase font-mono text-slate-500">
                        {sale.payment_status}
                      </div>
                    </div>
                    <button
                      onClick={() => onReprintReceipt(sale)}
                      className="p-1.5 rounded-md hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                      title="Reprint receipt"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Purchases Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-600" />
              <span>{t('dash_recent_purchases')}</span>
            </h3>
            <button
              onClick={() => onNavigate('purchases')}
              className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
            >
              View Purchases &rarr;
            </button>
          </div>
          <div className="divide-y divide-slate-100 overflow-x-auto">
            {stats.recent_purchases.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                {t('no_records')}
              </div>
            ) : (
              stats.recent_purchases.map((pur) => (
                <div key={pur.id} className="p-3.5 hover:bg-slate-50/80 flex items-center justify-between gap-4 text-xs transition-colors">
                  <div>
                    <div className="font-semibold text-slate-800 font-mono">
                      {pur.invoice_number}
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      {pur.supplier_name || 'Supplier'} · {formatDate(pur.purchase_date, lang)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900 tabular-nums">
                      {formatBDT(pur.total_amount)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Paid: {formatBDT(pur.paid_amount)} | Due: {formatBDT(pur.balance_due)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
