import React, { useState } from 'react';
import { CustomerPaymentReceipt, PharmacySettings, Language } from '../types/pharmacy';
import { getTranslation } from '../i18n/translations';
import { generatePaymentReceiptHtml } from '../services/receipt';
import { Printer, X, Layout, Globe, Check } from 'lucide-react';

interface PaymentReceiptModalProps {
  receipt: CustomerPaymentReceipt | null;
  settings: PharmacySettings;
  lang: Language;
  onClose: () => void;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  receipt,
  settings,
  lang,
  onClose
}) => {
  const [receiptLayout, setReceiptLayout] = useState<'full' | 'compact'>(settings.receipt_layout || 'full');
  const [receiptLang, setReceiptLang] = useState<Language>(settings.receipt_language || lang || 'bn');
  const [isPrinting, setIsPrinting] = useState(false);
  const [printSuccess, setPrintSuccess] = useState(false);

  if (!receipt) return null;

  const t = (key: any) => getTranslation(lang, key);
  const html = generatePaymentReceiptHtml(receipt, settings, receiptLayout, receiptLang);

  const handlePrint = async () => {
    setIsPrinting(true);
    setPrintSuccess(false);

    try {
      if ((window as any).electronAPI?.printThermalReceipt) {
        await (window as any).electronAPI.printThermalReceipt(html, settings.selected_printer);
      } else {
        const printFrame = document.createElement('iframe');
        printFrame.style.position = 'fixed';
        printFrame.style.right = '0';
        printFrame.style.bottom = '0';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        printFrame.style.border = '0';
        document.body.appendChild(printFrame);

        const doc = printFrame.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(html);
          doc.close();
          setTimeout(() => {
            printFrame.contentWindow?.focus();
            printFrame.contentWindow?.print();
            setTimeout(() => {
              document.body.removeChild(printFrame);
            }, 1000);
          }, 300);
        }
      }
      setPrintSuccess(true);
      setTimeout(() => setPrintSuccess(false), 3000);
    } catch (e) {
      console.error('Payment receipt print error:', e);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Top Header */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-800">
              {lang === 'bn' ? 'বাকি আদায়ের রসিদ প্রিন্ট' : 'Due Payment Receipt Preview'} — {receipt.receipt_number}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Controls Bar */}
        <div className="px-5 py-2.5 bg-slate-100/60 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Layout className="w-3.5 h-3.5" /> Layout:
            </span>
            <button
              onClick={() => setReceiptLayout('full')}
              className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                receiptLayout === 'full' ? 'bg-white shadow-xs text-emerald-700 font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Full (A4 / Thermal)
            </button>
            <button
              onClick={() => setReceiptLayout('compact')}
              className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                receiptLayout === 'compact' ? 'bg-white shadow-xs text-emerald-700 font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Compact (80mm)
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Globe className="w-3.5 h-3.5" /> Language:
            </span>
            <button
              onClick={() => setReceiptLang('bn')}
              className={`px-2 py-1 rounded font-medium cursor-pointer ${
                receiptLang === 'bn' ? 'bg-white shadow-xs text-emerald-700 font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              বাংলা
            </button>
            <button
              onClick={() => setReceiptLang('en')}
              className={`px-2 py-1 rounded font-medium cursor-pointer ${
                receiptLang === 'en' ? 'bg-white shadow-xs text-emerald-700 font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              English
            </button>
          </div>
        </div>

        {/* Receipt HTML Preview */}
        <div className="flex-1 p-6 overflow-y-auto bg-slate-200/50 flex justify-center">
          <div className="bg-white p-6 rounded-lg shadow-md border border-slate-300 w-full max-w-[380px]">
            <div
              dangerouslySetInnerHTML={{ __html: html }}
              className="receipt-rendered-content text-slate-800"
            />
          </div>
        </div>

        {/* Action Footer */}
        <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {lang === 'bn' ? 'নির্বাচিত প্রিন্টার:' : 'Selected Printer:'}{' '}
            <span className="font-medium text-slate-700">{settings.selected_printer || 'Standard System Printer'}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-3.5 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              {t('close')}
            </button>
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {printSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>{lang === 'bn' ? 'প্রিন্ট হয়েছে' : 'Printed'}</span>
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  <span>{isPrinting ? (lang === 'bn' ? 'প্রিন্ট হচ্ছে...' : 'Printing...') : t('print')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
