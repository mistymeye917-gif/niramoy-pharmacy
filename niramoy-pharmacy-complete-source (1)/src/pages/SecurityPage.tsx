import React, { useState } from 'react';
import { Language, PharmacySettings } from '../types/pharmacy';
import { getTranslation } from '../i18n/translations';
import { api } from '../services/api';
import {
  ShieldAlert,
  KeyRound,
  Lock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check
} from 'lucide-react';

interface SecurityPageProps {
  lang: Language;
  settings: PharmacySettings;
}

export const SecurityPage: React.FC<SecurityPageProps> = ({
  lang,
  settings
}) => {
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);

  const t = (key: any) => getTranslation(lang, key);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPass || !newPass) {
      setError('Please fill in both current and new passwords.');
      return;
    }
    if (newPass !== confirmPass) {
      setError('New passwords do not match.');
      return;
    }
    if (newPass.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await api.changePassword(currentPass, newPass);
      setMessage(res.message || 'Administrator password successfully updated!');
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyRecovery = () => {
    navigator.clipboard.writeText('NIRAMOY-8F92-4B10');
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 3000);
  };

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          {t('sec_title')}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Single administrator security, salted scrypt password hashing, session auto-lock, and offline emergency recovery.
        </p>
      </div>

      {message && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{message}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Change Password Form */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4 text-xs">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800 border-b border-slate-100 pb-3">
            <Lock className="w-4 h-4 text-emerald-600" />
            <span>{t('sec_change_password')}</span>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-3.5">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t('sec_current_password')} *</label>
              <input
                type="password"
                required
                value={currentPass}
                onChange={(e) => setCurrentPass(e.target.value)}
                placeholder="Enter current password..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t('sec_new_password')} *</label>
              <input
                type="password"
                required
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="Enter new strong password..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t('sec_confirm_password')} *</label>
              <input
                type="password"
                required
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                placeholder="Re-enter new password..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
              >
                {loading ? t('loading') : 'Update Password'}
              </button>
            </div>
          </form>
        </div>

        {/* Master Recovery Key & Emergency Procedure */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4 text-xs">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800 border-b border-slate-100 pb-3">
            <KeyRound className="w-4 h-4 text-emerald-600" />
            <span>{t('sec_recovery_key')}</span>
          </div>

          <p className="text-slate-600 leading-relaxed">
            {t('sec_recovery_desc')}
          </p>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold block">
              Emergency Offline Recovery Token
            </span>
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-sm font-bold text-slate-900 tracking-wider">
                NIRAMOY-8F92-4B10
              </span>
              <button
                type="button"
                onClick={handleCopyRecovery}
                className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded text-[11px] font-medium text-slate-700 flex items-center gap-1 cursor-pointer"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 text-slate-300 space-y-1.5 leading-relaxed text-[11px]">
            <div className="font-bold text-white text-xs">Offline Administrator Recovery Procedure:</div>
            <div>1. If the administrator password is ever forgotten, click <strong>"Forgot password?"</strong> on the lock screen.</div>
            <div>2. Enter the Master Recovery Key shown above.</div>
            <div>3. Choose and confirm a new password to immediately restore operational access.</div>
          </div>
        </div>
      </div>
    </div>
  );
};
