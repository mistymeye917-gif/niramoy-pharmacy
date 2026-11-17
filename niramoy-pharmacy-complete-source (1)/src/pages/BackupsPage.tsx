import React, { useState, useEffect } from 'react';
import { BackupItem, Language, PharmacySettings } from '../types/pharmacy';
import { getTranslation } from '../i18n/translations';
import { api } from '../services/api';
import { formatDateTime } from '../services/formatters';
import {
  HardDriveDownload,
  FolderSync,
  Usb,
  Wifi,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  FileCheck,
  Layers,
  ArrowRight,
  Lock,
  X,
  FolderDown,
  Download,
  Trash2,
  RefreshCw
} from 'lucide-react';

interface BackupsPageProps {
  lang: Language;
  settings: PharmacySettings;
}

export const BackupsPage: React.FC<BackupsPageProps> = ({
  lang,
  settings
}) => {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupNotice, setBackupNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  const handleDownloadProjectZip = async () => {
    setIsDownloadingZip(true);
    setBackupNotice(null);
    try {
      const res = await fetch('/api/export/download-project-zip');
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'niramoy-pharmacy-complete-source.zip';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 1500);
      setBackupNotice({
        type: 'success',
        message: lang === 'bn'
          ? 'সম্পূর্ণ প্রজেক্ট সোর্স কোড ZIP (৯২৬ KB, ৬৮টি ফাইল ও SQLite ডেটাবেস) সফলভাবে ডাউনলোড হচ্ছে।'
          : 'Full project source ZIP (~926 KB, 68 files & SQLite DB) download initiated.'
      });
    } catch (err: any) {
      setBackupNotice({
        type: 'error',
        message: lang === 'bn'
          ? `ডাউনলোড ব্যর্থ: ${err.message}`
          : `Download failed: ${err.message}`
      });
    } finally {
      setIsDownloadingZip(false);
    }
  };

  // Restore Wizard State
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupItem | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [restoreStep, setRestoreStep] = useState<1 | 2 | 3>(1);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState('');

  // Database Reset Wizard State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetMode, setResetMode] = useState<'transactions' | 'full' | 'demo'>('transactions');
  const [resetPassword, setResetPassword] = useState('');
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSafetyFile, setResetSafetyFile] = useState('');

  const t = (key: any) => getTranslation(lang, key);

  const loadBackups = async () => {
    try {
      setLoading(true);
      const list = await api.getBackups();
      setBackups(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const handleCreateBackup = async (destination: 'local' | 'usb' | 'shared') => {
    setIsBackingUp(true);
    setBackupNotice(null);
    try {
      const res = await api.createBackup(destination, 'manual');
      setBackupNotice({
        type: 'success',
        message: `Verified SQLite backup created successfully (${res.backup.filename}). SHA-256 Checksum verified.`
      });
      loadBackups();
    } catch (err: any) {
      setBackupNotice({
        type: 'error',
        message: err.message || 'Backup failed'
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleStartRestore = (backup: BackupItem) => {
    setSelectedBackup(backup);
    setRestoreStep(1);
    setAdminPassword('');
    setRestoreError('');
    setShowRestoreModal(true);
  };

  const handleConfirmRestore = async () => {
    if (!selectedBackup) return;
    if (!adminPassword) {
      setRestoreError('Admin password is required to authorize database restore.');
      return;
    }
    setRestoreError('');
    setIsRestoring(true);

    try {
      await api.restoreBackup(selectedBackup.filepath, adminPassword);
      setRestoreStep(3); // Success step
      loadBackups();
    } catch (err: any) {
      setRestoreError(err.message || 'Database restoration failed');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleOpenResetModal = (mode: 'transactions' | 'full' | 'demo' = 'transactions') => {
    setResetMode(mode);
    setResetPassword('');
    setResetError('');
    setResetStep(1);
    setResetSafetyFile('');
    setShowResetModal(true);
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPassword) {
      setResetError(lang === 'bn' ? 'রিসেট করতে অ্যাডমিন পাসওয়ার্ড দিন।' : 'Administrator password is required.');
      return;
    }
    setResetError('');
    setIsResetting(true);
    try {
      const res = await api.resetDatabase(resetMode, resetPassword);
      setResetSafetyFile(res.safetyBackup?.filename || '');
      setResetStep(2);
      loadBackups();
    } catch (err: any) {
      setResetError(err.message || (lang === 'bn' ? 'রিসেট ব্যর্থ হয়েছে' : 'Database reset failed'));
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {t('back_title')}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('back_desc')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadProjectZip}
            disabled={isDownloadingZip}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            title="Download full project source code as ZIP"
          >
            <FolderDown className={`w-4 h-4 ${isDownloadingZip ? 'animate-bounce' : ''}`} />
            <span>
              {isDownloadingZip
                ? (lang === 'bn' ? 'ZIP ডাউনলোড হচ্ছে...' : 'Downloading ZIP...')
                : (lang === 'bn' ? 'সম্পূর্ণ প্রজেক্ট ZIP ডাউনলোড' : 'Download Project ZIP')}
            </span>
          </button>
          <button
            onClick={() => handleCreateBackup('local')}
            disabled={isBackingUp}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            <HardDriveDownload className="w-4 h-4" />
            <span>{isBackingUp ? 'Creating Backup...' : t('back_backup_now')}</span>
          </button>
        </div>
      </div>

      {backupNotice && (
        <div className={`p-4 rounded-xl text-xs flex items-center gap-2.5 ${
          backupNotice.type === 'success'
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          {backupNotice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span className="font-semibold">{backupNotice.message}</span>
        </div>
      )}

      {/* Dual Destination Cards (USB & Local Wi-Fi Shared Folder) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* USB Destination */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
              <Usb className="w-4 h-4 text-emerald-600" />
              <span>{t('back_usb_dest')}</span>
            </div>
            <button
              onClick={() => handleCreateBackup('usb')}
              disabled={isBackingUp}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded cursor-pointer"
            >
              Backup to USB
            </button>
          </div>
          <div className="text-xs text-slate-500 font-mono bg-slate-50 p-2.5 rounded border border-slate-200 truncate">
            {settings.usb_folder_path || 'D:\\Pharmacy_USB_Backup'}
          </div>
          <div className="text-[11px] text-slate-500 leading-relaxed">
            Plug in your pharmacy USB flash drive to carry transactions between your desktop counter and laptop.
          </div>
        </div>

        {/* Local Network / Shared Folder Destination */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
              <Wifi className="w-4 h-4 text-emerald-600" />
              <span>{t('back_shared_dest')}</span>
            </div>
            <button
              onClick={() => handleCreateBackup('shared')}
              disabled={isBackingUp}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded cursor-pointer"
            >
              Backup to Network
            </button>
          </div>
          <div className="text-xs text-slate-500 font-mono bg-slate-50 p-2.5 rounded border border-slate-200 truncate">
            {settings.shared_folder_path || '\\\\Desktop-PC\\PharmacyBackups'}
          </div>
          <div className="text-[11px] text-slate-500 leading-relaxed">
            Windows shared folder accessible over the pharmacy's local Wi-Fi without needing an internet connection.
          </div>
        </div>
      </div>

      {/* Guided Laptop / Desktop Transfer Protocol */}
      <div className="bg-slate-900 text-white rounded-xl p-6 shadow-md space-y-4">
        <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-sm">
          <FolderSync className="w-5 h-5" />
          <span>{t('back_transfer_wizard')}</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
          To safely move data between your shop Desktop and your home/roaming Laptop without a cloud server, follow this verified 4-step offline workflow:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-1">
          <div className="p-3.5 bg-slate-800/80 rounded-lg border border-slate-700/80 space-y-1">
            <div className="text-emerald-400 font-bold">Step 1: Finish on Machine A</div>
            <div className="text-slate-300 text-[11px]">Finish billing on current computer and click <strong>Create Verified Backup Now</strong>.</div>
          </div>
          <div className="p-3.5 bg-slate-800/80 rounded-lg border border-slate-700/80 space-y-1">
            <div className="text-emerald-400 font-bold">Step 2: Copy to USB / Wi-Fi</div>
            <div className="text-slate-300 text-[11px]">Save the backup file to your USB flash drive or local Wi-Fi shared folder.</div>
          </div>
          <div className="p-3.5 bg-slate-800/80 rounded-lg border border-slate-700/80 space-y-1">
            <div className="text-emerald-400 font-bold">Step 3: Open on Machine B</div>
            <div className="text-slate-300 text-[11px]">On the other computer, open this page and select <strong>Restore Selected Backup</strong>.</div>
          </div>
          <div className="p-3.5 bg-slate-800/80 rounded-lg border border-slate-700/80 space-y-1">
            <div className="text-emerald-400 font-bold">Step 4: Auto Safety Backup</div>
            <div className="text-slate-300 text-[11px]">The system automatically snapshots the current machine before restoring.</div>
          </div>
        </div>
      </div>

      {/* Existing Backups Archive Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="font-bold text-xs text-slate-800 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-emerald-600" />
            <span>{t('back_history')} ({backups.length})</span>
          </div>
          <div className="text-[11px] text-slate-500">
            {t('back_safety_notice')}
          </div>
        </div>

        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100/60 border-b border-slate-200 text-slate-500 font-semibold">
              <th className="p-3 text-left">Backup Filename</th>
              <th className="p-3 text-left">Destination / Path</th>
              <th className="p-3 text-center">Created At</th>
              <th className="p-3 text-center">Size</th>
              <th className="p-3 text-left">SHA-256 Checksum</th>
              <th className="p-3 text-center">Type</th>
              <th className="p-3 text-center w-28">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400">{t('loading')}</td>
              </tr>
            ) : backups.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400">{t('no_records')}</td>
              </tr>
            ) : (
              backups.map((b, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-3 font-mono font-semibold text-slate-900">{b.filename}</td>
                  <td className="p-3 text-slate-500 font-mono text-[11px] truncate max-w-xs">{b.filepath}</td>
                  <td className="p-3 text-center text-slate-600">{formatDateTime(b.timestamp, lang)}</td>
                  <td className="p-3 text-center font-mono text-slate-700">
                    {(b.size_bytes / 1024).toFixed(1)} KB
                  </td>
                  <td className="p-3 font-mono text-[10px] text-slate-400 truncate max-w-[140px]">
                    {b.checksum}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono font-bold ${
                      b.type === 'safety' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {b.type}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => handleStartRestore(b)}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-semibold cursor-pointer shadow-xs"
                    >
                      Restore
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Data Reset & Fresh Start Zone */}
      <div className="bg-white rounded-xl border border-rose-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-bold text-rose-700">
              <RefreshCw className="w-4 h-4" />
              <span>
                {lang === 'bn'
                  ? 'ডেটা রিসেট ও নতুন করে শুরু করুন (Factory Reset)'
                  : 'Data Reset & Fresh Start (Factory Reset)'}
              </span>
            </div>
            <p className="text-xs text-slate-500 max-w-2xl">
              {lang === 'bn'
                ? 'দোকানের আসল হিসাব শুরু করার আগে টেস্ট বেচাকেনা ও স্টক মুছে ফেলতে পারেন। রিসেটের আগে স্বয়ংক্রিয়ভাবে একটি সেফটি ব্যাকআপ সেভ থাকবে।'
                : 'Clear test transactions or wipe all data to start fresh before real pharmacy operations. An automatic safety backup is created first.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => handleOpenResetModal('transactions')}
              className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'শুধু লেনদেন ও স্টক রিসেট' : 'Clear Transactions Only'}</span>
            </button>
            <button
              onClick={() => handleOpenResetModal('full')}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'সম্পূর্ণ ফ্যাক্টরি রিসেট' : 'Full Factory Reset'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Restore Wizard Modal */}
      {showRestoreModal && selectedBackup && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden text-xs">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-emerald-600" />
                <span>Restore Database Wizard</span>
              </h3>
              <button onClick={() => setShowRestoreModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {restoreStep === 1 && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 space-y-2">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Pre-Restore Safety Notice</span>
                    </div>
                    <div className="text-[11px] leading-relaxed">
                      Restoring from this backup will replace current records with the state from <strong>{formatDateTime(selectedBackup.timestamp, lang)}</strong>. A snapshot of your current database will be automatically created first.
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 font-mono text-[11px]">
                    <div><strong>File:</strong> {selectedBackup.filename}</div>
                    <div><strong>Size:</strong> {(selectedBackup.size_bytes / 1024).toFixed(1)} KB</div>
                    <div><strong>SHA-256:</strong> {selectedBackup.checksum.slice(0, 32)}...</div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => setRestoreStep(2)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Proceed to Admin Authentication</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {restoreStep === 2 && (
                <div className="space-y-4">
                  {restoreError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
                      {restoreError}
                    </div>
                  )}

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Enter Administrator Password to Confirm Restore *
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        autoFocus
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="Admin password..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setRestoreStep(1)}
                      className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={isRestoring || !adminPassword}
                      onClick={handleConfirmRestore}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {isRestoring ? 'Restoring...' : 'Execute Database Restore'}
                    </button>
                  </div>
                </div>
              )}

              {restoreStep === 3 && (
                <div className="text-center py-6 space-y-3">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h4 className="text-base font-bold text-slate-900">Database Restored Successfully!</h4>
                  <p className="text-slate-500 text-xs max-w-sm mx-auto">
                    The database has been replaced with the verified backup archive. A safety snapshot of the previous data was also preserved in your backup history.
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        setShowRestoreModal(false);
                        window.location.reload();
                      }}
                      className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg cursor-pointer"
                    >
                      Reload Application Data
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Database Reset Wizard Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden text-xs">
            <div className="px-5 py-3.5 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-rose-800 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-rose-600" />
                <span>
                  {lang === 'bn' ? 'ডেটাবেস রিসেট করুন (নতুন করে শুরু)' : 'Reset Database & Start Fresh'}
                </span>
              </h3>
              <button onClick={() => setShowResetModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {resetStep === 1 && (
                <form onSubmit={handleConfirmReset} className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-[11px] leading-relaxed">
                      {lang === 'bn'
                        ? 'সতর্কতা: রিসেট করলে নির্বাচিত ডেটা স্থায়ীভাবে মুছে যাবে। তবে নিরাপত্তার জন্য রিসেটের আগে স্বয়ংক্রিয়ভাবে একটি ব্যাকআপ তৈরি করে রাখা হবে।'
                        : 'Warning: Resetting will clear the selected records. An automatic safety backup will be created first so you can restore anytime.'}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block font-bold text-slate-700">
                      {lang === 'bn' ? 'রিসেটের ধরন বেছে নিন:' : 'Select Reset Option:'}
                    </label>

                    <label className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                      resetMode === 'transactions' ? 'border-amber-500 bg-amber-50/50' : 'border-slate-200 hover:bg-slate-50'
                    }`}>
                      <input
                        type="radio"
                        name="resetMode"
                        checked={resetMode === 'transactions'}
                        onChange={() => setResetMode('transactions')}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="font-bold text-slate-900">
                          {lang === 'bn' ? '১. শুধু লেনদেন, হিসাব ও স্টক মুছুন' : '1. Clear Transactions & Stock Only'}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {lang === 'bn'
                            ? 'বিক্রি, ক্রয়, রিটার্ন, খরচ, ক্যাশ ও স্টক শূন্য হবে। কিন্তু ওষুধের নাম, কাস্টমার, সাপ্লায়ার ও দোকানের সেটিংস অক্ষত থাকবে।'
                            : 'Clears all sales, purchases, batches, expenses, and dues. Keeps your medicine catalog, customers, suppliers, and settings.'}
                        </div>
                      </div>
                    </label>

                    <label className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                      resetMode === 'demo' ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 hover:bg-slate-50'
                    }`}>
                      <input
                        type="radio"
                        name="resetMode"
                        checked={resetMode === 'demo'}
                        onChange={() => setResetMode('demo')}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="font-bold text-slate-900">
                          {lang === 'bn' ? '২. ডেমো ডেটায় রিসেট করুন (নতুন ক্যাটালগসহ)' : '2. Reset to Clean Demo Catalog'}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {lang === 'bn'
                            ? 'সব টেস্ট ডেটা মুছে বাংলাদেশের সাধারণ ওষুধের মূল ক্যাটালগ নতুন করে লোড করবে।'
                            : 'Wipes all test data and restores the clean starter Bangladesh pharmaceutical catalog.'}
                        </div>
                      </div>
                    </label>

                    <label className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                      resetMode === 'full' ? 'border-rose-500 bg-rose-50/60' : 'border-slate-200 hover:bg-slate-50'
                    }`}>
                      <input
                        type="radio"
                        name="resetMode"
                        checked={resetMode === 'full'}
                        onChange={() => setResetMode('full')}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="font-bold text-rose-800">
                          {lang === 'bn' ? '৩. সম্পূর্ণ ফ্যাক্টরি রিসেট (একদম খালি)' : '3. Full Factory Reset (Completely Empty)'}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {lang === 'bn'
                            ? 'ওষুধ, স্টক, কাস্টমার, সাপ্লায়ার ও সব হিসাব সম্পূর্ণ মুছে শূন্য থেকে শুরু করবে (শুধু পাসওয়ার্ড ও সেটিংস থাকবে)।'
                            : 'Wipes all medicines, batches, customers, suppliers, and transactions for a 100% blank start (keeps login & settings).'}
                        </div>
                      </div>
                    </label>
                  </div>

                  {resetError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 font-semibold">
                      {resetError}
                    </div>
                  )}

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      {lang === 'bn' ? 'নিশ্চিত করতে অ্যাডমিন পাসওয়ার্ড লিখুন *' : 'Enter Administrator Password to Confirm *'}
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        placeholder={lang === 'bn' ? 'অ্যাডমিন পাসওয়ার্ড...' : 'Admin password...'}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowResetModal(false)}
                      className="px-3.5 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                    >
                      {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={isResetting || !resetPassword}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {isResetting
                        ? (lang === 'bn' ? 'রিসেট হচ্ছে...' : 'Resetting...')
                        : (lang === 'bn' ? 'রিসেট নিশ্চিত করুন' : 'Confirm & Reset Data')}
                    </button>
                  </div>
                </form>
              )}

              {resetStep === 2 && (
                <div className="text-center py-6 space-y-3">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h4 className="text-base font-bold text-slate-900">
                    {lang === 'bn' ? 'ডেটাবেস সফলভাবে রিসেট হয়েছে!' : 'Database Reset Successfully!'}
                  </h4>
                  <p className="text-slate-500 text-xs max-w-sm mx-auto">
                    {lang === 'bn'
                      ? `নতুন করে শুরু করার জন্য সব ডেটা প্রস্তুত। পূর্বের তথ্যের একটি সেফটি ব্যাকআপ সংরক্ষিত হয়েছে${resetSafetyFile ? `: ${resetSafetyFile}` : ''}।`
                      : `Your workspace is now reset and ready. A safety backup was preserved${resetSafetyFile ? `: ${resetSafetyFile}` : ''}.`}
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        setShowResetModal(false);
                        window.location.reload();
                      }}
                      className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg cursor-pointer"
                    >
                      {lang === 'bn' ? 'অ্যাপ রিলোড করুন' : 'Reload Application'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
