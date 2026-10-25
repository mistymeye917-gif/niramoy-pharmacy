import React, { useState } from 'react';
import { Language } from '../types/pharmacy';
import { getTranslation } from '../i18n/translations';
import { api } from '../services/api';
import { Lock, Shield, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';

interface LockScreenModalProps {
  isLocked: boolean;
  onUnlock: () => void;
  lang: Language;
}

export const LockScreenModal: React.FC<LockScreenModalProps> = ({
  isLocked,
  onUnlock,
  lang
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState('');

  if (!isLocked) return null;

  const t = (key: any) => getTranslation(lang, key);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter administrator password.');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await api.login(password);
      setPassword('');
      setError('');
      onUnlock();
    } catch (err: any) {
      setError(err.message || 'Invalid administrator password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryKey.trim() || !newPassword.trim()) {
      setError('Both recovery key and new password are required.');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const res = await api.recoverPassword(recoveryKey.trim(), newPassword);
      setRecoverySuccess(res.message);
      setShowRecovery(false);
      setPassword(newPassword);
    } catch (err: any) {
      setError(err.message || 'Recovery key is invalid');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Top Header Banner */}
        <div className="bg-slate-900 px-6 py-6 text-center text-white">
          <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold tracking-tight">
            {showRecovery ? 'Master Password Recovery' : t('sec_unlock')}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {showRecovery
              ? 'Enter your offline master recovery key to set a new password.'
              : 'Session locked for security. Enter administrator password.'}
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {recoverySuccess && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>{recoverySuccess}</span>
            </div>
          )}

          {!showRecovery ? (
            <form onSubmit={handleUnlock} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t('sec_enter_password')}
                </label>
                <div className="relative">
                  <input
                    type="password"
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password..."
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-mono"
                  />
                  <Shield className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? t('loading') : t('sec_login_btn')}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowRecovery(true);
                    setError('');
                  }}
                  className="text-xs text-slate-500 hover:text-emerald-600 transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Forgot password? Use offline recovery key</span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRecovery} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Master Recovery Key
                </label>
                <input
                  type="text"
                  value={recoveryKey}
                  onChange={(e) => setRecoveryKey(e.target.value)}
                  placeholder="e.g. NIRAMOY-XXXX-XXXX"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono uppercase focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 4 characters)"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowRecovery(false);
                    setError('');
                  }}
                  className="flex-1 py-2 px-3 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                >
                  Reset Password
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
