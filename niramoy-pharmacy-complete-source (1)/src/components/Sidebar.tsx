import React from 'react';
import { Language, PharmacySettings } from '../types/pharmacy';
import { getTranslation } from '../i18n/translations';
import {
  LayoutDashboard,
  ShoppingCart,
  Pill,
  Truck,
  Users,
  Building2,
  Banknote,
  RotateCcw,
  BarChart3,
  HardDriveDownload,
  Settings,
  ShieldAlert,
  TestTube2
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  lang: Language;
  settings: PharmacySettings | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  lang,
  settings
}) => {
  const t = (key: any) => getTranslation(lang, key);

  const navItems = [
    { id: 'dashboard', label: t('nav_dashboard'), icon: LayoutDashboard },
    { id: 'pos', label: t('nav_pos'), icon: ShoppingCart, highlight: true },
    { id: 'medicines', label: t('nav_medicines'), icon: Pill },
    { id: 'purchases', label: t('nav_purchases'), icon: Truck },
    { id: 'customers', label: t('nav_customers'), icon: Users },
    { id: 'suppliers', label: t('nav_suppliers'), icon: Building2 },
    { id: 'expenses', label: t('nav_expenses'), icon: Banknote },
    { id: 'returns', label: t('nav_returns'), icon: RotateCcw },
    { id: 'reports', label: t('nav_reports'), icon: BarChart3 },
    { id: 'backups', label: t('nav_backups'), icon: HardDriveDownload },
    { id: 'settings', label: t('nav_settings'), icon: Settings },
    { id: 'diagnostics', label: t('nav_diagnostics'), icon: TestTube2 }
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 select-none">
      {/* Brand & Emblem Lockup */}
      <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-800/80 bg-slate-950/40">
        <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-inner">
          <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4v16m-8-8h16" />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-white tracking-tight truncate">
            {settings?.pharmacy_name || 'Niramoy Pharmacy'}
          </div>
          <div className="text-[11px] font-mono text-emerald-400/90 tracking-wide uppercase">
            Bangladesh Retail POS
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all text-left group ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                  : item.highlight
                  ? 'text-emerald-300 bg-emerald-950/30 hover:bg-emerald-900/40 hover:text-white border border-emerald-800/40'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'text-white' : item.highlight ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="truncate">{item.label}</span>
              {item.highlight && !isActive && (
                <span className="ml-auto text-[10px] font-mono uppercase bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
                  POS
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Info & Desktop App Version */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 text-[11px] text-slate-400 space-y-2">
        <div className="flex items-center justify-between text-slate-400 px-1">
          <span>Version</span>
          <span className="font-mono text-slate-300">v1.0.0 (Win64)</span>
        </div>
        <div className="p-2 rounded-md bg-slate-900 border border-slate-800 text-[10px] leading-relaxed text-slate-400">
          <div className="flex items-center gap-1.5 text-emerald-400 font-medium mb-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Offline Ready</span>
          </div>
          <span>No internet or cloud server needed. All data stored locally in SQLite.</span>
        </div>
      </div>
    </aside>
  );
};
