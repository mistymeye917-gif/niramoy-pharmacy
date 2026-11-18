import React from 'react';
import { Language, PharmacySettings } from '../types/pharmacy';
import { getTranslation } from '../i18n/translations';
import { Lock, ShieldCheck } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  currentTab: string;
  lang: Language;
  onLanguageChange: (lang: Language) => void;
  onLockSession: () => void;
  settings: PharmacySettings | null;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  lang,
  onLanguageChange,
  onLockSession,
  settings
}) => {
  const t = (key: any) => getTranslation(lang, key);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-6 shrink-0 z-10">
      {/* Zone 1: Contextual Title & Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-base font-semibold text-slate-800 tracking-tight whitespace-nowrap truncate">
          {settings?.pharmacy_name || t('app_title')}
        </h1>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-medium text-emerald-700 whitespace-nowrap truncate">
          {t(`nav_${currentTab}` as any) || currentTab}
        </span>
      </div>

      {/* Zone 2: Language Segmented Toggle */}
      <div className="hidden md:flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
        <button
          onClick={() => onLanguageChange('bn')}
          className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            lang === 'bn' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          বাংলা
        </button>
        <button
          onClick={() => onLanguageChange('en')}
          className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            lang === 'en' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          English
        </button>
      </div>

      {/* Zone 3: Admin Session & Lock Action */}
      <div className="flex items-center gap-3 shrink-0">
        <PWAInstallButton lang={lang} />

        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 whitespace-nowrap">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span className="font-medium">{t('admin_session')}</span>
        </div>
        <button
          onClick={onLockSession}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          title="Lock screen immediately"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>{t('lock_session')}</span>
        </button>
      </div>
    </header>
  );
};
