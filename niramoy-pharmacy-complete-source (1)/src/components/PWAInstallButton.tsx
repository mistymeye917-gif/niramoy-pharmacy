import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Monitor, CheckCircle2, HelpCircle, X } from 'lucide-react';
import { Language } from '../types/pharmacy';

interface PWAInstallButtonProps {
  lang: Language;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ lang }) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [showHelp, setShowHelp] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  const handleInstallClick = async () => {
    if (!isInstallable) {
      setShowHelp(true);
      return;
    }
    setIsInstalling(true);
    try {
      await install();
    } finally {
      setIsInstalling(false);
    }
  };

  if (isInstalled) {
    return (
      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-medium">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        <span>{lang === 'bn' ? 'ডেস্কটপ মোডে সক্রিয়' : 'Desktop App Active'}</span>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          onClick={handleInstallClick}
          disabled={isInstalling}
          title={lang === 'bn' ? 'আপনার কম্পিউটারে অ্যাপের মতো ইনস্টল করুন' : 'Install as Desktop App on your PC'}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all transform active:scale-95 cursor-pointer"
        >
          <Monitor className="w-3.5 h-3.5" />
          <span>{lang === 'bn' ? 'ডেস্কটপে ইনস্টল করুন' : 'Install Desktop App'}</span>
        </button>
        <button
          onClick={() => setShowHelp(true)}
          title={lang === 'bn' ? 'ইনস্টল নির্দেশিকা' : 'Installation Guide'}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </div>

      {showHelp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Monitor className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {lang === 'bn' ? 'Windows Desktop-এ ইনস্টল করার নিয়ম' : 'How to Install as Windows Desktop App'}
                  </h3>
                  <p className="text-[11px] text-slate-500">Google Chrome / Microsoft Edge PWA</p>
                </div>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">1</span>
                <div>
                  <strong className="text-slate-800">{lang === 'bn' ? 'অ্যাড্রেস বার থেকে ইনস্টল:' : 'Install via Address Bar:'}</strong>
                  <p className="text-slate-500 mt-0.5">
                    {lang === 'bn'
                      ? 'Chrome বা Edge ব্রাউজারের উপরে URL অ্যাড্রেস বারের ডানপাশে একটি ছোট কম্পিউটার বা ডাউনলোড আইকন (⊕) দেখতে পাবেন। সেখানে ক্লিক করে "Install" চাপুন।'
                      : 'Look at the right side of your Chrome/Edge address bar for the install icon (⊕ or computer icon) and click "Install".'}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">2</span>
                <div>
                  <strong className="text-slate-800">{lang === 'bn' ? 'ব্রাউজার মেনু থেকে ইনস্টল:' : 'Install via Browser Menu:'}</strong>
                  <p className="text-slate-500 mt-0.5">
                    {lang === 'bn'
                      ? 'Chrome-এর তিন ডট (⋮) মেনু → "Save and share" (বা "Install Niramoy") → "Install Niramoy Pharmacy" সিলেক্ট করুন।'
                      : 'Open Chrome three dots menu (⋮) → "Save and share" / "Install Niramoy" → select "Install Niramoy Pharmacy".'}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-800 text-[11px]">
                {lang === 'bn'
                  ? 'ইনস্টল সম্পন্ন হলে এটি আপনার Windows Desktop ও Start Menu-তে একটি পৃথক আইকন তৈরি করবে এবং কোনো ব্রাউজার ফ্রেম ছাড়াই আসল সফটওয়্যারের মতো ওপেন হবে।'
                  : 'Once installed, it will create an independent icon on your Windows Desktop & Start Menu, opening in a clean standalone window without browser tabs.'}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowHelp(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                {lang === 'bn' ? 'বুঝেছি' : 'Got it'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
