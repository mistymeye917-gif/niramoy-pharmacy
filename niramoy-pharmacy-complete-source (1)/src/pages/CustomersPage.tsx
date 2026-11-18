import React, { useState, useEffect } from 'react';
import { Customer, Language, PharmacySettings } from '../types/pharmacy';
import { getTranslation } from '../i18n/translations';
import { api } from '../services/api';
import { formatBDT } from '../services/formatters';
import {
  Users,
  Plus,
  Search,
  Phone,
  MapPin,
  X,
  CheckCircle2,
  AlertCircle,
  Camera,
  CreditCard,
  Eye,
  Edit3,
  Trash2,
  UserCheck
} from 'lucide-react';

interface CustomersPageProps {
  lang: Language;
  settings: PharmacySettings;
}

function compressImageFile(file: File, maxDim = 560, quality = 0.74): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const emptyCustomerForm = (): Partial<Customer> => ({
  name: '',
  phone: '',
  address: '',
  nid_number: '',
  photo_data: '',
  nid_photo_data: '',
  nid_back_photo_data: '',
  balance: 0.0,
  notes: ''
});

export const CustomersPage: React.FC<CustomersPageProps> = ({
  lang,
  settings
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Add / Edit Customer Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Partial<Customer>>(emptyCustomerForm());
  const [formError, setFormError] = useState('');
  const [isSavingCust, setIsSavingCust] = useState(false);

  // View Customer Profile & Photo/NID Modal
  const [viewCust, setViewCust] = useState<Customer | null>(null);

  // Receive Payment Modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedCust, setSelectedCust] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<'cash' | 'bkash' | 'nagad' | 'rocket' | 'card'>('cash');
  const [payRef, setPayRef] = useState('');
  const [payError, setPayError] = useState('');
  const [message, setMessage] = useState('');

  const t = (key: any) => getTranslation(lang, key);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await api.getCustomers(search);
      setCustomers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [search]);

  const handleOpenAddModal = (cust?: Customer) => {
    setFormError('');
    if (cust) {
      setEditingCustomer({ ...cust });
    } else {
      setEditingCustomer(emptyCustomerForm());
    }
    setShowAddModal(true);
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'photo_data' | 'nid_photo_data' | 'nid_back_photo_data'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormError('');
    try {
      const compressed = await compressImageFile(file);
      setEditingCustomer(prev => ({ ...prev, [field]: compressed }));
    } catch (err: any) {
      setFormError(err.message || (lang === 'bn' ? 'ছবি আপলোড করা যায়নি।' : 'Failed to process image.'));
    }
    e.target.value = '';
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer.name?.trim() || !editingCustomer.phone?.trim()) {
      setFormError(
        lang === 'bn'
          ? 'গ্রাহকের নাম এবং ফোন নম্বর অবশ্যই লিখতে হবে।'
          : 'Customer name and phone number are required.'
      );
      return;
    }
    setIsSavingCust(true);
    setFormError('');
    try {
      const isEdit = Boolean(editingCustomer.id);
      await api.saveCustomer({
        ...editingCustomer,
        name: editingCustomer.name.trim(),
        phone: editingCustomer.phone.trim(),
        address: editingCustomer.address?.trim() || '',
        nid_number: editingCustomer.nid_number?.trim() || '',
        notes: editingCustomer.notes?.trim() || ''
      });
      setShowAddModal(false);
      setEditingCustomer(emptyCustomerForm());
      setMessage(
        isEdit
          ? (lang === 'bn' ? 'গ্রাহকের তথ্য, ছবি ও NID আপডেট হয়েছে।' : 'Customer profile updated successfully.')
          : (lang === 'bn' ? 'নতুন গ্রাহক (ছবি ও NID সহ) সফলভাবে যুক্ত হয়েছে।' : 'Customer registered successfully.')
      );
      loadCustomers();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save customer');
    } finally {
      setIsSavingCust(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCust || payAmount <= 0) {
      setPayError(lang === 'bn' ? 'সঠিক টাকার পরিমাণ লিখুন।' : 'Please enter valid repayment amount.');
      return;
    }
    setPayError('');
    try {
      await api.recordCustomerPayment({
        customer_id: selectedCust.id,
        amount: payAmount,
        payment_method: payMethod,
        reference: payRef
      });
      setShowPayModal(false);
      setPayRef('');
      setMessage(
        lang === 'bn'
          ? `${selectedCust.name}-এর কাছ থেকে ${formatBDT(payAmount)} বাকি আদায় হয়েছে।`
          : `Payment of ${formatBDT(payAmount)} received from ${selectedCust.name}`
      );
      loadCustomers();
    } catch (err: any) {
      setPayError(err.message || 'Payment recording failed');
    }
  };

  const totalReceivables = customers.reduce((acc, c) => acc + (c.balance > 0 ? c.balance : 0), 0);

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {t('cust_title')}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {lang === 'bn'
              ? 'বাকি কাস্টমারের নাম, ফোন, ছবি, জাতীয় পরিচয়পত্র (NID) নম্বর ও বকেয়া হিসাব সংরক্ষণ করুন।'
              : 'Track customer receivables, credit accounts, photos, NID details, and partial/full repayments.'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[11px] text-slate-500 block">
              {lang === 'bn' ? 'মোট পাওনা (বাকি)' : 'Total Due Balance'}
            </span>
            <span className="text-base font-bold text-rose-700 tabular-nums">{formatBDT(totalReceivables)}</span>
          </div>
          <button
            onClick={() => handleOpenAddModal()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('cust_add')}</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{message}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              lang === 'bn'
                ? 'কাস্টমারের নাম, ফোন নম্বর বা NID নম্বর দিয়ে খুঁজুন...'
                : 'Search by customer name, phone number, or NID...'
            }
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="p-3 text-left">{t('cust_name')}</th>
                <th className="p-3 text-left">{t('cust_phone')}</th>
                <th className="p-3 text-left">{lang === 'bn' ? 'NID ও তথ্য' : 'NID & Verification'}</th>
                <th className="p-3 text-left">{t('cust_address')}</th>
                <th className="p-3 text-right">{t('cust_balance')}</th>
                <th className="p-3 text-center w-56">{lang === 'bn' ? 'কার্যক্রম' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">{t('loading')}</td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">{t('no_records')}</td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        {c.photo_data ? (
                          <button
                            type="button"
                            onClick={() => setViewCust(c)}
                            className="w-9 h-9 rounded-full overflow-hidden border border-slate-200 shrink-0 cursor-pointer hover:ring-2 hover:ring-emerald-500"
                            title={lang === 'bn' ? 'ছবি বড় করে দেখুন' : 'View Photo'}
                          >
                            <img src={c.photo_data} alt={c.name} className="w-full h-full object-cover" />
                          </button>
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-200">
                            {c.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-slate-900">{c.name}</div>
                          {c.notes && (
                            <div className="text-[11px] text-slate-400 truncate max-w-[160px]">{c.notes}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-slate-700 font-mono">{c.phone}</td>
                    <td className="p-3">
                      <div className="space-y-1">
                        {c.nid_number ? (
                          <div className="font-mono text-[11px] text-slate-800 font-semibold">{c.nid_number}</div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                        {(c.nid_photo_data || c.nid_back_photo_data) && (
                          <button
                            type="button"
                            onClick={() => setViewCust(c)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold cursor-pointer hover:bg-emerald-100"
                          >
                            <UserCheck className="w-3 h-3" />
                            <span>
                              {c.nid_photo_data && c.nid_back_photo_data
                                ? (lang === 'bn' ? 'NID ২ পাশ ✓' : 'NID Front+Back')
                                : (lang === 'bn' ? 'NID ছবি আছে' : 'NID Photo')}
                            </span>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-slate-500">{c.address || '—'}</td>
                    <td className="p-3 text-right font-bold tabular-nums">
                      <span className={c.balance > 0 ? 'text-rose-700' : 'text-emerald-700'}>
                        {formatBDT(c.balance)}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewCust(c)}
                          className="p-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                          title={lang === 'bn' ? 'ছবি ও NID দেখুন' : 'View Profile & NID'}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenAddModal(c)}
                          className="p-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-indigo-700 cursor-pointer"
                          title={lang === 'bn' ? 'তথ্য/ছবি এডিট করুন' : 'Edit Customer'}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {c.balance > 0 ? (
                          <button
                            onClick={() => {
                              setSelectedCust(c);
                              setPayAmount(c.balance);
                              setPayError('');
                              setShowPayModal(true);
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold cursor-pointer shadow-xs whitespace-nowrap"
                          >
                            {lang === 'bn' ? 'বাকি আদায়' : 'Receive Payment'}
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px] px-1">
                            {lang === 'bn' ? 'পরিশোধিত' : 'Clear'}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>
                  {editingCustomer.id
                    ? (lang === 'bn' ? 'গ্রাহকের তথ্য, ছবি ও NID আপডেট করুন' : 'Edit Customer Profile')
                    : t('cust_add')}
                </span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-5 space-y-4 text-xs overflow-y-auto">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2 font-semibold">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('cust_name')} *</label>
                  <input
                    type="text"
                    required
                    value={editingCustomer.name || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                    placeholder={lang === 'bn' ? 'যেমন: রফিকুল ইসলাম' : 'e.g. Rafiqul Islam'}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('cust_phone')} *</label>
                  <input
                    type="text"
                    required
                    value={editingCustomer.phone || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                    placeholder="017..."
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {lang === 'bn' ? 'জাতীয় পরিচয়পত্র (NID) নম্বর' : 'National ID (NID) Number'}
                  </label>
                  <input
                    type="text"
                    value={editingCustomer.nid_number || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, nid_number: e.target.value })}
                    placeholder={lang === 'bn' ? 'যেমন: 1990261234567' : '10 / 13 / 17 digit NID'}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('cust_address')}</label>
                  <input
                    type="text"
                    value={editingCustomer.address || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, address: e.target.value })}
                    placeholder={lang === 'bn' ? 'বাড়ি/গ্রাম, এলাকা' : 'e.g. House 4, Dhanmondi, Dhaka'}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Photo & Both-Side NID Card Upload Boxes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {/* Customer Portrait Photo */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{lang === 'bn' ? 'কাস্টমারের ছবি' : 'Customer Photo'}</span>
                  </div>
                  {editingCustomer.photo_data ? (
                    <div className="relative w-full h-32 rounded-lg overflow-hidden border border-slate-300 bg-white">
                      <img
                        src={editingCustomer.photo_data}
                        alt="Customer preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setEditingCustomer(prev => ({ ...prev, photo_data: '' }))}
                        className="absolute top-1.5 right-1.5 p-1 bg-rose-600 text-white rounded-full shadow cursor-pointer hover:bg-rose-700"
                        title={lang === 'bn' ? 'ছবি মুছুন' : 'Remove photo'}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-32 rounded-lg border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-slate-400 text-[11px] px-2 text-center">
                      <Camera className="w-6 h-6 mb-1 text-slate-300" />
                      <span>{lang === 'bn' ? 'কাস্টমারের ছবি দেওয়া হয়নি' : 'No customer photo'}</span>
                    </div>
                  )}
                  <label className="w-full py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-center font-semibold text-slate-700 cursor-pointer block transition-colors text-[11px]">
                    <span>
                      {editingCustomer.photo_data
                        ? (lang === 'bn' ? 'ছবি পরিবর্তন করুন' : 'Change Photo')
                        : (lang === 'bn' ? 'ছবি তুলুন / আপলোড' : 'Upload / Take Photo')}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'photo_data')}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* NID Card Front Side */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{lang === 'bn' ? 'NID সামনের পাশ' : 'NID Front Side'}</span>
                  </div>
                  {editingCustomer.nid_photo_data ? (
                    <div className="relative w-full h-32 rounded-lg overflow-hidden border border-slate-300 bg-white">
                      <img
                        src={editingCustomer.nid_photo_data}
                        alt="NID Front preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setEditingCustomer(prev => ({ ...prev, nid_photo_data: '' }))}
                        className="absolute top-1.5 right-1.5 p-1 bg-rose-600 text-white rounded-full shadow cursor-pointer hover:bg-rose-700"
                        title={lang === 'bn' ? 'ছবি মুছুন' : 'Remove NID front photo'}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-32 rounded-lg border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-slate-400 text-[11px] px-2 text-center">
                      <CreditCard className="w-6 h-6 mb-1 text-slate-300" />
                      <span>{lang === 'bn' ? 'সামনের পাশ দেওয়া হয়নি' : 'No NID front photo'}</span>
                    </div>
                  )}
                  <label className="w-full py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-center font-semibold text-slate-700 cursor-pointer block transition-colors text-[11px]">
                    <span>
                      {editingCustomer.nid_photo_data
                        ? (lang === 'bn' ? 'সামনের ছবি বদলান' : 'Change Front')
                        : (lang === 'bn' ? 'সামনের পাশ আপলোড' : 'Upload Front Side')}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'nid_photo_data')}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* NID Card Back Side */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-amber-600" />
                    <span>{lang === 'bn' ? 'NID পেছনের পাশ' : 'NID Back Side'}</span>
                  </div>
                  {editingCustomer.nid_back_photo_data ? (
                    <div className="relative w-full h-32 rounded-lg overflow-hidden border border-slate-300 bg-white">
                      <img
                        src={editingCustomer.nid_back_photo_data}
                        alt="NID Back preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setEditingCustomer(prev => ({ ...prev, nid_back_photo_data: '' }))}
                        className="absolute top-1.5 right-1.5 p-1 bg-rose-600 text-white rounded-full shadow cursor-pointer hover:bg-rose-700"
                        title={lang === 'bn' ? 'ছবি মুছুন' : 'Remove NID back photo'}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-32 rounded-lg border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-slate-400 text-[11px] px-2 text-center">
                      <CreditCard className="w-6 h-6 mb-1 text-slate-300" />
                      <span>{lang === 'bn' ? 'পেছনের পাশ দেওয়া হয়নি' : 'No NID back photo'}</span>
                    </div>
                  )}
                  <label className="w-full py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-center font-semibold text-slate-700 cursor-pointer block transition-colors text-[11px]">
                    <span>
                      {editingCustomer.nid_back_photo_data
                        ? (lang === 'bn' ? 'পেছনের ছবি বদলান' : 'Change Back')
                        : (lang === 'bn' ? 'পেছনের পাশ আপলোড' : 'Upload Back Side')}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'nid_back_photo_data')}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {lang === 'bn' ? 'নোট / অতিরিক্ত তথ্য (ঐচ্ছিক)' : 'Notes (Optional)'}
                </label>
                <input
                  type="text"
                  value={editingCustomer.notes || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, notes: e.target.value })}
                  placeholder={lang === 'bn' ? 'যেমন: নিয়মিত ক্রেতা / রেফারেন্স' : 'Optional note...'}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSavingCust}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSavingCust ? t('loading') : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Customer Profile / Photo & NID Modal */}
      {viewCust && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col text-xs">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>{lang === 'bn' ? 'গ্রাহকের সম্পূর্ণ প্রোফাইল ও NID' : 'Customer Profile & NID'}</span>
              </h3>
              <button onClick={() => setViewCust(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="flex items-center justify-between gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="space-y-1">
                  <div className="text-base font-bold text-slate-900">{viewCust.name}</div>
                  <div className="font-mono text-slate-700 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{viewCust.phone}</span>
                  </div>
                  <div className="font-mono text-slate-700 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                    <span>NID: {viewCust.nid_number || (lang === 'bn' ? 'দেওয়া হয়নি' : 'Not provided')}</span>
                  </div>
                  {viewCust.address && (
                    <div className="text-slate-500 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{viewCust.address}</span>
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] text-slate-500">{lang === 'bn' ? 'বর্তমান বাকি' : 'Due Balance'}</div>
                  <div className={`text-lg font-bold tabular-nums ${viewCust.balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {formatBDT(viewCust.balance)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <div className="font-semibold text-slate-700">{lang === 'bn' ? 'কাস্টমারের ছবি' : 'Customer Photo'}</div>
                  {viewCust.photo_data ? (
                    <img
                      src={viewCust.photo_data}
                      alt={viewCust.name}
                      className="w-full h-44 object-cover rounded-lg border border-slate-200 bg-slate-50"
                    />
                  ) : (
                    <div className="w-full h-44 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400">
                      {lang === 'bn' ? 'কোনো ছবি নেই' : 'No photo uploaded'}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="font-semibold text-slate-700">{lang === 'bn' ? 'NID সামনের পাশ' : 'NID Front Side'}</div>
                  {viewCust.nid_photo_data ? (
                    <img
                      src={viewCust.nid_photo_data}
                      alt="NID Front"
                      className="w-full h-44 object-cover rounded-lg border border-slate-200 bg-slate-50"
                    />
                  ) : (
                    <div className="w-full h-44 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400">
                      {lang === 'bn' ? 'সামনের ছবি নেই' : 'No front photo'}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="font-semibold text-slate-700">{lang === 'bn' ? 'NID পেছনের পাশ' : 'NID Back Side'}</div>
                  {viewCust.nid_back_photo_data ? (
                    <img
                      src={viewCust.nid_back_photo_data}
                      alt="NID Back"
                      className="w-full h-44 object-cover rounded-lg border border-slate-200 bg-slate-50"
                    />
                  ) : (
                    <div className="w-full h-44 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400">
                      {lang === 'bn' ? 'পেছনের ছবি নেই' : 'No back photo'}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    const c = viewCust;
                    setViewCust(null);
                    handleOpenAddModal(c);
                  }}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold cursor-pointer"
                >
                  {lang === 'bn' ? 'তথ্য / ছবি এডিট করুন' : 'Edit Profile'}
                </button>
                <button
                  type="button"
                  onClick={() => setViewCust(null)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receive Payment Modal */}
      {showPayModal && selectedCust && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                Receive Payment — {selectedCust.name}
              </h3>
              <button onClick={() => setShowPayModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRecordPayment} className="p-5 space-y-3.5 text-xs">
              {payError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-semibold">
                  {payError}
                </div>
              )}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
                <span className="text-slate-600">Total Outstanding Balance:</span>
                <span className="text-sm font-bold text-rose-700 tabular-nums">{formatBDT(selectedCust.balance)}</span>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Repayment Amount (BDT) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-right tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="cash">Physical Cash</option>
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="rocket">Rocket</option>
                  <option value="card">Bank Card</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Transaction Ref / Note</label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="e.g. bKash TrxID or Cash Receipt"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                >
                  Confirm & Deduct Balance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
