import React, { useState, useEffect, useRef } from 'react';
import {
  Medicine,
  SaleItemInput,
  SplitPaymentInput,
  Customer,
  PharmacySettings,
  Language,
  SaleInvoice,
  PaymentMethod
} from '../types/pharmacy';
import { getTranslation } from '../i18n/translations';
import { api } from '../services/api';
import { formatBDT } from '../services/formatters';
import { compressImageFile } from '../utils/imageCompress';
import {
  Search,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  CreditCard,
  Wallet,
  Coins,
  QrCode,
  ShieldCheck,
  Printer,
  Sparkles,
  ArrowRight,
  UserPlus,
  Camera,
  X
} from 'lucide-react';

interface PosBillingPageProps {
  lang: Language;
  settings: PharmacySettings;
  onOpenReceipt: (invoice: SaleInvoice) => void;
}

export const PosBillingPage: React.FC<PosBillingPageProps> = ({
  lang,
  settings,
  onOpenReceipt
}) => {
  const t = (key: any) => getTranslation(lang, key);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Medicine[]>([]);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string>('Tablet');
  const [multiplier, setMultiplier] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);

  // Cart / Bill state
  const [cartItems, setCartItems] = useState<SaleItemInput[]>([]);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>(settings.default_discount_behavior || 'percentage');
  const [discountValue, setDiscountValue] = useState<number>(0);

  // Customer state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');

  // Payment state
  const [primaryMethod, setPrimaryMethod] = useState<PaymentMethod>('cash');
  const [splitPaymentMode, setSplitPaymentMode] = useState(false);
  const [splitPayments, setSplitPayments] = useState<{ method: PaymentMethod; amount: number; transaction_ref: string }[]>([
    { method: 'cash', amount: 0, transaction_ref: '' },
    { method: 'bkash', amount: 0, transaction_ref: '' }
  ]);
  const [tenderedAmount, setTenderedAmount] = useState<number>(0);

  // Execution state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successInvoice, setSuccessInvoice] = useState<SaleInvoice | null>(null);

  // Quick Add New Customer Modal (keeps cart items intact)
  const [showQuickCustModal, setShowQuickCustModal] = useState(false);
  const [quickCust, setQuickCust] = useState({
    name: '',
    phone: '',
    address: '',
    nid_number: '',
    photo_data: '',
    nid_photo_data: '',
    nid_back_photo_data: ''
  });
  const [quickCustError, setQuickCustError] = useState('');
  const [isSavingQuickCust, setIsSavingQuickCust] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load initial customers and medicines
  useEffect(() => {
    api.getCustomers().then(setCustomers).catch(console.error);
  }, []);

  // Keyboard shortcuts (F2 to focus search, F10 to confirm sale)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F10' && cartItems.length > 0 && !isSubmitting) {
        e.preventDefault();
        handleConfirmSale();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cartItems, isSubmitting]);

  // Debounced medicine search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      api.getMedicines(searchQuery.trim(), true).then((res) => {
        setSearchResults(res);
      }).catch(console.error);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle selecting a medicine from search suggestions
  const handleSelectMedicine = (med: Medicine) => {
    setSelectedMedicine(med);
    setSelectedUnit(med.base_unit);
    setMultiplier(1);
    setUnitPrice(med.sale_price);
    setQuantity(1);
    setSearchQuery('');
    setSearchResults([]);
    setErrorMessage('');
  };

  // Handle unit conversion change
  const handleUnitChange = (unitName: string) => {
    if (!selectedMedicine) return;
    setSelectedUnit(unitName);
    if (unitName === selectedMedicine.base_unit) {
      setMultiplier(1);
      setUnitPrice(selectedMedicine.sale_price);
    } else {
      const conv = selectedMedicine.conversions?.find(c => c.unit_name === unitName);
      if (conv) {
        setMultiplier(conv.multiplier);
        setUnitPrice(Math.round(selectedMedicine.sale_price * conv.multiplier * 100) / 100);
      }
    }
  };

  // Add item to cart
  const handleAddToCart = () => {
    if (!selectedMedicine) return;
    if (quantity <= 0) {
      setErrorMessage('Quantity must be greater than zero');
      return;
    }

    const baseQtyRequired = quantity * multiplier;
    if ((selectedMedicine.total_stock || 0) < baseQtyRequired) {
      setErrorMessage(`Insufficient stock for ${selectedMedicine.brand_name}. Available: ${selectedMedicine.total_stock} ${selectedMedicine.base_unit}`);
      return;
    }

    const lineTotal = Math.round(quantity * unitPrice * 100) / 100;

    const newItem: SaleItemInput = {
      medicine_id: selectedMedicine.id,
      brand_name: selectedMedicine.brand_name,
      generic_name: selectedMedicine.generic_name,
      strength: selectedMedicine.strength,
      dosage_form: selectedMedicine.dosage_form,
      base_unit: selectedMedicine.base_unit,
      selected_unit: selectedUnit,
      multiplier,
      quantity,
      unit_price: unitPrice,
      line_total: lineTotal,
      available_base_qty: selectedMedicine.total_stock
    };

    setCartItems(prev => [...prev, newItem]);
    setSelectedMedicine(null);
    setQuantity(1);
    setErrorMessage('');
    searchInputRef.current?.focus();
  };

  const handleRemoveItem = (index: number) => {
    setCartItems(prev => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const subtotal = Math.round(cartItems.reduce((acc, item) => acc + item.line_total, 0) * 100) / 100;
  
  let discountAmount = 0;
  if (discountType === 'percentage') {
    discountAmount = Math.round((subtotal * ((discountValue || 0) / 100)) * 100) / 100;
  } else {
    discountAmount = Math.min(subtotal, Math.max(0, discountValue || 0));
  }
  const finalPayable = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);

  // Update tendered default when subtotal changes
  useEffect(() => {
    if (!splitPaymentMode) {
      setTenderedAmount(finalPayable);
    }
  }, [finalPayable, splitPaymentMode]);

  // Handle Confirm & Complete Sale
  const handleConfirmSale = async () => {
    if (cartItems.length === 0) {
      setErrorMessage('Please add at least one medicine to the bill.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      // Build payments payload
      let paymentsPayload: SplitPaymentInput[] = [];

      if (splitPaymentMode) {
        paymentsPayload = splitPayments.filter(p => p.amount > 0).map(p => ({
          method: p.method,
          amount: p.amount,
          transaction_ref: p.transaction_ref
        }));
      } else {
        paymentsPayload = [{
          method: primaryMethod,
          amount: tenderedAmount > 0 ? tenderedAmount : finalPayable
        }];
      }

      // Check if credit or partial cash payment will create a due balance
      const isPartialCash = !splitPaymentMode && primaryMethod === 'cash' && tenderedAmount > 0 && tenderedAmount < finalPayable;
      const isCredit = primaryMethod === 'credit' || isPartialCash || paymentsPayload.some(p => p.method === 'credit');
      if (isCredit && !selectedCustomerId) {
        throw new Error(
          lang === 'bn'
            ? 'বাকি রাখতে হলে ডানদিকের উপরে "গ্রাহক নির্বাচন" থেকে গ্রাহক বেছে নিন অথবা "+ নতুন গ্রাহক" বাটনে ক্লিক করে এখনই যোগ করুন।'
            : 'A customer must be selected (or added via "+ New Customer") for credit or partial sales.'
        );
      }

      const res = await api.executeSale({
        customer_id: selectedCustomerId,
        customer_name: customerName || 'Walk-in Customer',
        customer_phone: customerPhone || '',
        items: cartItems,
        discount_type: discountType,
        discount_value: discountValue,
        payments: paymentsPayload
      });

      setSuccessInvoice(res.invoice);
      setCartItems([]);
      setDiscountValue(0);
      setSplitPaymentMode(false);
      setSelectedCustomerId(null);
      setCustomerName('');
      setCustomerPhone('');
      api.getCustomers().then(setCustomers).catch(console.error);

      // Open receipt automatically
      onOpenReceipt(res.invoice);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to complete sale transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'photo_data' | 'nid_photo_data' | 'nid_back_photo_data'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setQuickCustError('');
    try {
      const compressed = await compressImageFile(file);
      setQuickCust(prev => ({ ...prev, [field]: compressed }));
    } catch (err: any) {
      setQuickCustError(err.message || (lang === 'bn' ? 'ছবি আপলোড করা যায়নি।' : 'Failed to process image.'));
    }
    e.target.value = '';
  };

  const handleSaveQuickCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCust.name.trim() || !quickCust.phone.trim()) {
      setQuickCustError(
        lang === 'bn'
          ? 'গ্রাহকের নাম এবং মোবাইল নম্বর অবশ্যই দিতে হবে।'
          : 'Customer name and phone number are required.'
      );
      return;
    }
    setIsSavingQuickCust(true);
    setQuickCustError('');
    try {
      const res = await api.saveCustomer({
        name: quickCust.name.trim(),
        phone: quickCust.phone.trim(),
        address: quickCust.address.trim(),
        nid_number: quickCust.nid_number.trim(),
        photo_data: quickCust.photo_data,
        nid_photo_data: quickCust.nid_photo_data,
        nid_back_photo_data: quickCust.nid_back_photo_data,
        balance: 0
      });
      const updatedList = await api.getCustomers();
      setCustomers(updatedList);
      setSelectedCustomerId(res.id);
      setCustomerName(quickCust.name.trim());
      setCustomerPhone(quickCust.phone.trim());
      setShowQuickCustModal(false);
      setQuickCust({
        name: '',
        phone: '',
        address: '',
        nid_number: '',
        photo_data: '',
        nid_photo_data: '',
        nid_back_photo_data: ''
      });
      setErrorMessage('');
    } catch (err: any) {
      setQuickCustError(err.message || 'Failed to save customer');
    } finally {
      setIsSavingQuickCust(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden bg-slate-50">
      {/* Left Workspace: Search, Item Selection, and Cart Grid (70% width) */}
      <div className="flex-1 flex flex-col p-5 overflow-y-auto space-y-4">
        {/* Medicine Search Box with Barcode scanner support */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs relative">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('pos_search_placeholder')}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>
            <div className="text-[11px] font-mono text-slate-500 px-2 py-1 bg-slate-100 rounded border border-slate-200 hidden sm:block">
              Press [F2]
            </div>
          </div>

          {/* Autocomplete Suggestions Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-4 right-4 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 divide-y divide-slate-100 z-30 max-h-64 overflow-y-auto">
              {searchResults.map((med) => (
                <div
                  key={med.id}
                  onClick={() => handleSelectMedicine(med)}
                  className="p-3 hover:bg-emerald-50/70 flex items-center justify-between text-xs cursor-pointer transition-colors"
                >
                  <div>
                    <div className="font-bold text-slate-800 flex items-center gap-2">
                      <span>{med.brand_name}</span>
                      <span className="text-[11px] font-normal text-slate-500">({med.strength})</span>
                      <span className="text-[10px] text-slate-400 uppercase bg-slate-100 px-1 rounded">{med.dosage_form}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {med.generic_name} · <span className="text-slate-400">{med.manufacturer}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-emerald-700 tabular-nums">
                      {formatBDT(med.sale_price)} / {med.base_unit}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Stock: <span className="font-semibold">{med.total_stock}</span> {med.base_unit}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Medicine Quick Configuration Bar */}
        {selectedMedicine && (
          <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>{selectedMedicine.brand_name}</span>
                <span className="text-xs text-slate-500 font-normal">({selectedMedicine.strength})</span>
              </div>
              <div className="text-xs text-slate-600">
                {selectedMedicine.generic_name} · Stock: <span className="font-semibold text-emerald-700">{selectedMedicine.total_stock}</span> {selectedMedicine.base_unit}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Unit Selector */}
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">{t('pos_unit')}</label>
                <select
                  value={selectedUnit}
                  onChange={(e) => handleUnitChange(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                >
                  <option value={selectedMedicine.base_unit}>{selectedMedicine.base_unit} (Base)</option>
                  {(selectedMedicine.conversions || []).map(c => (
                    <option key={c.unit_name} value={c.unit_name}>
                      {c.unit_name} ({c.multiplier} {selectedMedicine.base_unit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div className="w-20">
                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">{t('pos_qty')}</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-center"
                />
              </div>

              {/* Price */}
              <div className="w-24">
                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">{t('pos_price')}</label>
                <input
                  type="number"
                  step="0.01"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold tabular-nums text-right"
                />
              </div>

              {/* Add Button */}
              <button
                onClick={handleAddToCart}
                className="mt-4 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('pos_add_to_cart')}</span>
              </button>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Cart Items Table */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              {t('pos_cart_items')} ({cartItems.length})
            </span>
            <div className="flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t('pos_fefo_badge')}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {cartItems.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                {t('pos_empty_cart')}
              </div>
            ) : (
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-medium bg-slate-50/50">
                    <th className="text-left p-3">#</th>
                    <th className="text-left p-3">{t('med_brand_name')}</th>
                    <th className="text-center p-3">{t('pos_unit')}</th>
                    <th className="text-center p-3">{t('pos_qty')}</th>
                    <th className="text-right p-3">{t('pos_price')}</th>
                    <th className="text-right p-3">{t('pos_line_total')}</th>
                    <th className="text-center p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cartItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-900">{item.brand_name}</div>
                        <div className="text-[11px] text-slate-500">{item.generic_name} ({item.strength})</div>
                      </td>
                      <td className="p-3 text-center text-slate-600">
                        {item.selected_unit}
                        {item.multiplier > 1 && (
                          <span className="text-[10px] text-slate-400 block font-mono">({item.multiplier} {item.base_unit})</span>
                        )}
                      </td>
                      <td className="p-3 text-center font-bold text-slate-800 tabular-nums">{item.quantity}</td>
                      <td className="p-3 text-right text-slate-700 tabular-nums">{formatBDT(item.unit_price, false)}</td>
                      <td className="p-3 text-right font-bold text-slate-900 tabular-nums">{formatBDT(item.line_total)}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Right Sidebar: Checkout, Customer Selection, Discounts & Payments (30% width) */}
      <div className="w-full lg:w-96 bg-white border-l border-slate-200 flex flex-col p-5 overflow-y-auto shadow-xs space-y-4">
        {/* Customer Select + Quick Add New Customer */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="block text-xs font-semibold text-slate-700">
              {t('pos_select_customer')}
            </label>
            <button
              type="button"
              onClick={() => {
                setQuickCustError('');
                setShowQuickCustModal(true);
              }}
              className="px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-semibold flex items-center gap-1 cursor-pointer shrink-0"
            >
              <UserPlus className="w-3 h-3" />
              <span>{lang === 'bn' ? '+ নতুন গ্রাহক' : '+ New Customer'}</span>
            </button>
          </div>
          <select
            value={selectedCustomerId || ''}
            onChange={(e) => {
              const val = e.target.value ? parseInt(e.target.value, 10) : null;
              setSelectedCustomerId(val);
              if (val) {
                const c = customers.find(x => x.id === val);
                if (c) {
                  setCustomerName(c.name);
                  setCustomerPhone(c.phone);
                }
              } else {
                setCustomerName('');
                setCustomerPhone('');
              }
            }}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
          >
            <option value="">{t('pos_walkin_customer')}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.phone}) {c.balance > 0 ? `· ${lang === 'bn' ? 'বাকি' : 'Due'}: ${formatBDT(c.balance)}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Invoice Summary Box */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
          <div className="flex items-center justify-between text-slate-600">
            <span>{t('pos_subtotal')}</span>
            <span className="font-semibold text-slate-800 tabular-nums">{formatBDT(subtotal)}</span>
          </div>

          {/* Discount Field */}
          <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
            <span className="text-slate-600">{t('pos_discount')}</span>
            <div className="flex items-center gap-1.5">
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as any)}
                className="px-1.5 py-1 bg-white border border-slate-300 rounded text-xs"
              >
                <option value="percentage">%</option>
                <option value="fixed">৳</option>
              </select>
              <input
                type="number"
                min="0"
                value={discountValue}
                onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                className="w-16 px-1.5 py-1 bg-white border border-slate-300 rounded text-xs text-right tabular-nums font-semibold"
              />
            </div>
          </div>

          {discountAmount > 0 && (
            <div className="flex items-center justify-between text-emerald-700 font-medium">
              <span>Discount Amount</span>
              <span className="tabular-nums">-{formatBDT(discountAmount)}</span>
            </div>
          )}

          {/* Final Payable */}
          <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900">{t('pos_final_payable')}</span>
            <span className="text-xl font-bold text-emerald-700 tabular-nums">{formatBDT(finalPayable)}</span>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700">{t('pos_payment_methods')}</label>
            <button
              onClick={() => setSplitPaymentMode(!splitPaymentMode)}
              className="text-[11px] text-emerald-700 font-semibold hover:underline cursor-pointer"
            >
              {splitPaymentMode ? 'Single Method' : t('pos_split_payment')}
            </button>
          </div>

          {!splitPaymentMode ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-xs">
                {(['cash', 'bkash', 'nagad', 'rocket', 'card', 'credit'] as PaymentMethod[]).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPrimaryMethod(method)}
                    className={`py-2 px-1.5 rounded-lg border text-center font-medium transition-all cursor-pointer truncate ${
                      primaryMethod === method
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {t(`pm_${method}` as any)}
                  </button>
                ))}
              </div>

              {primaryMethod === 'cash' && (
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    {lang === 'bn' ? 'নগদ জমা (কম লিখলে বাকি হবে)' : 'Cash Tendered'}
                  </label>
                  <input
                    type="number"
                    value={tenderedAmount}
                    onChange={(e) => setTenderedAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-right tabular-nums"
                  />
                  {tenderedAmount > finalPayable && (
                    <div className="mt-1 text-xs text-emerald-700 font-semibold flex items-center justify-between">
                      <span>{t('pos_change_due')}:</span>
                      <span>{formatBDT(tenderedAmount - finalPayable)}</span>
                    </div>
                  )}
                  {finalPayable > 0 && tenderedAmount > 0 && tenderedAmount < finalPayable && (
                    <div className="mt-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 space-y-1">
                      <div className="flex items-center justify-between font-bold text-rose-700">
                        <span>{lang === 'bn' ? 'বাকি থাকবে (ক্রেডিট):' : 'Remaining Due (Credit):'}</span>
                        <span>{formatBDT(finalPayable - tenderedAmount)}</span>
                      </div>
                      {!selectedCustomerId && (
                        <div className="text-[10px] text-amber-800">
                          {lang === 'bn'
                            ? 'বাকি রাখতে উপরে গ্রাহক সিলেক্ট করুন অথবা "+ নতুন গ্রাহক" চাপুন।'
                            : 'Select a customer above or click "+ New Customer" to record due.'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Split payment fields */
            <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              {splitPayments.map((p, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={p.method}
                    onChange={(e) => {
                      const newArr = [...splitPayments];
                      newArr[idx].method = e.target.value as any;
                      setSplitPayments(newArr);
                    }}
                    className="w-24 px-1.5 py-1 bg-white border border-slate-300 rounded font-medium"
                  >
                    <option value="cash">Cash</option>
                    <option value="bkash">bKash</option>
                    <option value="nagad">Nagad</option>
                    <option value="rocket">Rocket</option>
                    <option value="card">Card</option>
                    <option value="credit">Credit</option>
                  </select>
                  <input
                    type="number"
                    value={p.amount}
                    onChange={(e) => {
                      const newArr = [...splitPayments];
                      newArr[idx].amount = parseFloat(e.target.value) || 0;
                      setSplitPayments(newArr);
                    }}
                    placeholder="Amount"
                    className="flex-1 px-2 py-1 bg-white border border-slate-300 rounded text-right font-bold tabular-nums"
                  />
                </div>
              ))}
              <div className="text-[11px] text-slate-500 pt-1 flex justify-between">
                <span>Total Allocated:</span>
                <span className="font-bold tabular-nums">
                  {formatBDT(splitPayments.reduce((acc, x) => acc + x.amount, 0))}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Confirm Sale Button */}
        <div className="pt-2">
          <button
            onClick={handleConfirmSale}
            disabled={cartItems.length === 0 || isSubmitting}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-sm font-bold shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{isSubmitting ? t('loading') : t('pos_confirm_sale')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <div className="text-center text-[10px] text-slate-400 mt-1 font-mono">
            Press [F10] to confirm
          </div>
        </div>
      </div>

      {/* Quick Add New Customer Modal (preserves active cart) */}
      {showQuickCustModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-600" />
                <span>
                  {lang === 'bn'
                    ? 'নতুন বাকি গ্রাহক দ্রুত যোগ করুন (ওষুধের লিস্ট ঠিক থাকবে)'
                    : 'Quick Add New Customer (Keeps Cart Intact)'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setShowQuickCustModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickCustomer} className="p-5 space-y-3.5 text-xs overflow-y-auto">
              {quickCustError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{quickCustError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {lang === 'bn' ? 'গ্রাহকের নাম *' : 'Customer Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={quickCust.name}
                    onChange={(e) => setQuickCust({ ...quickCust, name: e.target.value })}
                    placeholder={lang === 'bn' ? 'যেমন: রফিকুল ইসলাম' : 'e.g. Rafiqul Islam'}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {lang === 'bn' ? 'মোবাইল নম্বর *' : 'Phone Number *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={quickCust.phone}
                    onChange={(e) => setQuickCust({ ...quickCust, phone: e.target.value })}
                    placeholder="017..."
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {lang === 'bn' ? 'NID নম্বর (ঐচ্ছিক)' : 'NID Number (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={quickCust.nid_number}
                    onChange={(e) => setQuickCust({ ...quickCust, nid_number: e.target.value })}
                    placeholder={lang === 'bn' ? 'জাতীয় পরিচয়পত্র নম্বর' : '10 / 13 / 17 digit NID'}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {lang === 'bn' ? 'ঠিকানা (ঐচ্ছিক)' : 'Address (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={quickCust.address}
                    onChange={(e) => setQuickCust({ ...quickCust, address: e.target.value })}
                    placeholder={lang === 'bn' ? 'বাড়ি / গ্রাম / এলাকা' : 'Area / Village'}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Optional Quick Photos (Customer + NID Front + NID Back) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <label className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer flex items-center gap-2">
                  <Camera className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-700 truncate">
                      {quickCust.photo_data ? 'গ্রাহকের ছবি ✓' : (lang === 'bn' ? 'কাস্টমারের ছবি' : 'Customer Photo')}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {quickCust.photo_data ? (lang === 'bn' ? 'যুক্ত হয়েছে' : 'Uploaded') : (lang === 'bn' ? 'ঐচ্ছিক' : 'Optional')}
                    </div>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleQuickImageUpload(e, 'photo_data')}
                    className="hidden"
                  />
                </label>

                <label className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-700 truncate">
                      {quickCust.nid_photo_data ? 'NID সামনের পাশ ✓' : (lang === 'bn' ? 'NID সামনের পাশ' : 'NID Front')}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {quickCust.nid_photo_data ? (lang === 'bn' ? 'যুক্ত হয়েছে' : 'Uploaded') : (lang === 'bn' ? 'ঐচ্ছিক' : 'Optional')}
                    </div>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleQuickImageUpload(e, 'nid_photo_data')}
                    className="hidden"
                  />
                </label>

                <label className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-amber-600 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-700 truncate">
                      {quickCust.nid_back_photo_data ? 'NID পেছনের পাশ ✓' : (lang === 'bn' ? 'NID পেছনের পাশ' : 'NID Back')}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {quickCust.nid_back_photo_data ? (lang === 'bn' ? 'যুক্ত হয়েছে' : 'Uploaded') : (lang === 'bn' ? 'ঐচ্ছিক' : 'Optional')}
                    </div>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleQuickImageUpload(e, 'nid_back_photo_data')}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowQuickCustModal(false)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSavingQuickCust}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSavingQuickCust
                    ? t('loading')
                    : (lang === 'bn' ? 'সেভ ও বিলে যুক্ত করুন' : 'Save & Select Customer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
