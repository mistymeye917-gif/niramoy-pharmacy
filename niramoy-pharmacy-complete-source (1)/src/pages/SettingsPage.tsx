import React, { useState } from 'react';
import { PharmacySettings, Language } from '../types/pharmacy';
import { getTranslation } from '../i18n/translations';
import { api } from '../services/api';
import {
  Settings,
  Save,
  CheckCircle2,
  AlertCircle,
  Building,
  Printer,
  Shield,
  Upload,
  Globe,
  Sliders
} from 'lucide-react';

interface SettingsPageProps {
  settings: PharmacySettings;
  onUpdateSettings: (newSettings: PharmacySettings) => void;
  lang: Language;
  onOpenTestReceipt: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  onUpdateSettings,
  lang,
  onOpenTestReceipt
}) => {
  const [formData, setFormData] = useState<PharmacySettings>({ ...settings });
  const [isSaving, setIsSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [errorNotice, setErrorNotice] = useState('');

  const t = (key: any) => getTranslation(lang, key);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target?.result as string;
      setFormData(prev => ({ ...prev, pharmacy_logo: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedNotice(false);
    setErrorNotice('');

    try {
      const res = await api.updateSettings(formData);
      onUpdateSettings(res.settings);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 4000);
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {t('set_title')}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure retail pharmacy details, receipt headers, POS thresholds, and offline backup paths.
          </p>
        </div>
        <button
          onClick={handleSubmit}
          disabled={isSaving}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Saving...' : t('save')}</span>
        </button>
      </div>

      {savedNotice && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{t('set_save_success')}</span>
        </div>
      )}

      {errorNotice && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorNotice}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Pharmacy Commercial Details */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4 text-xs">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800 border-b border-slate-100 pb-3">
            <Building className="w-4 h-4 text-emerald-600" />
            <span>Pharmacy Brand & Contact Information</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t('set_pharmacy_name')} *</label>
              <input
                type="text"
                required
                value={formData.pharmacy_name}
                onChange={(e) => setFormData({ ...formData, pharmacy_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t('set_phone')} *</label>
              <input
                type="text"
                required
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t('set_address')} *</label>
            <input
              type="text"
              required
              value={formData.pharmacy_address}
              onChange={(e) => setFormData({ ...formData, pharmacy_address: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          {/* Logo Upload */}
          <div className="pt-2">
            <label className="block font-semibold text-slate-700 mb-1">{t('set_logo')}</label>
            <div className="flex items-center gap-4">
              {formData.pharmacy_logo ? (
                <div className="w-16 h-16 p-1 border border-slate-200 rounded-lg bg-slate-50 flex items-center justify-center">
                  <img src={formData.pharmacy_logo} alt="Logo Preview" className="max-h-full max-w-full object-contain" />
                </div>
              ) : (
                <div className="w-16 h-16 border border-dashed border-slate-300 rounded-lg flex items-center justify-center text-slate-400">
                  No Logo
                </div>
              )}
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                />
                <div className="text-[11px] text-slate-400 mt-1">Appears on full printed cash memos.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Operational & POS Thresholds */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4 text-xs">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800 border-b border-slate-100 pb-3">
            <Sliders className="w-4 h-4 text-emerald-600" />
            <span>POS Thresholds & Language Defaults</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t('set_low_stock_limit')}</label>
              <input
                type="number"
                min="1"
                value={formData.low_stock_threshold}
                onChange={(e) => setFormData({ ...formData, low_stock_threshold: parseInt(e.target.value, 10) || 10 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-center"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t('set_expiry_days')}</label>
              <input
                type="number"
                min="7"
                value={formData.expiry_warning_days}
                onChange={(e) => setFormData({ ...formData, expiry_warning_days: parseInt(e.target.value, 10) || 30 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-center"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t('set_inactivity_lock')}</label>
              <input
                type="number"
                min="1"
                value={formData.inactivity_lock_minutes}
                onChange={(e) => setFormData({ ...formData, inactivity_lock_minutes: parseInt(e.target.value, 10) || 15 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-center"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t('set_language')}</label>
              <select
                value={formData.default_language}
                onChange={(e) => setFormData({ ...formData, default_language: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium"
              >
                <option value="bn">বাংলা (Bengali)</option>
                <option value="en">English</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t('set_currency')}</label>
              <input
                type="text"
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
              />
            </div>
          </div>
        </div>

        {/* Printer & Receipt Formatting */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Printer className="w-4 h-4 text-emerald-600" />
              <span>Printer & Receipt Customization</span>
            </div>
            <button
              type="button"
              onClick={onOpenTestReceipt}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold cursor-pointer"
            >
              {t('set_test_print')}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t('set_receipt_layout')}</label>
              <select
                value={formData.receipt_layout}
                onChange={(e) => setFormData({ ...formData, receipt_layout: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium"
              >
                <option value="full">Full Detailed Memo (A4 or Thermal)</option>
                <option value="compact">Compact Quick Thermal (80mm / 3-inch)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t('set_receipt_lang')}</label>
              <select
                value={formData.receipt_language}
                onChange={(e) => setFormData({ ...formData, receipt_language: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium"
              >
                <option value="bn">বাংলা (Bengali Receipt)</option>
                <option value="en">English (English Receipt)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t('set_printer_name')}</label>
            <input
              type="text"
              value={formData.selected_printer}
              onChange={(e) => setFormData({ ...formData, selected_printer: e.target.value })}
              placeholder="e.g. POS-80 Thermal Printer or Microsoft Print to PDF"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
            />
          </div>
        </div>

        {/* Offline Backup Paths */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4 text-xs">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800 border-b border-slate-100 pb-3">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>Configured Offline Backup Paths</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Local Network Shared Folder</label>
              <input
                type="text"
                value={formData.shared_folder_path}
                onChange={(e) => setFormData({ ...formData, shared_folder_path: e.target.value })}
                placeholder="e.g. C:\PharmacyBackups\NetworkShare"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">USB Flash Drive Folder</label>
              <input
                type="text"
                value={formData.usb_folder_path}
                onChange={(e) => setFormData({ ...formData, usb_folder_path: e.target.value })}
                placeholder="e.g. D:\Pharmacy_USB_Backup"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isSaving ? 'Saving Changes...' : t('save')}
          </button>
        </div>
      </form>
    </div>
  );
};
