import React, { useState, useEffect } from 'react';
import { Medicine, InventoryBatch, UnitConversion, Language, PharmacySettings } from '../types/pharmacy';
import { getTranslation } from '../i18n/translations';
import { api } from '../services/api';
import { formatBDT, formatDate, getDaysUntilExpiry } from '../services/formatters';
import {
  Search,
  Plus,
  FileSpreadsheet,
  AlertTriangle,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
  Upload,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Trash2,
  Power
} from 'lucide-react';

interface MedicinesPageProps {
  lang: Language;
  settings: PharmacySettings;
}

export const MedicinesPage: React.FC<MedicinesPageProps> = ({
  lang,
  settings
}) => {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedMedId, setExpandedMedId] = useState<number | null>(null);
  const [batchesMap, setBatchesMap] = useState<Record<number, InventoryBatch[]>>({});

  // Add/Edit Medicine Modal
  const [showMedModal, setShowMedModal] = useState(false);
  const [editingMed, setEditingMed] = useState<Partial<Medicine>>({
    brand_name: '',
    generic_name: '',
    manufacturer: '',
    strength: '',
    dosage_form: 'Tablet',
    base_unit: 'Tablet',
    sale_price: 1.0,
    barcode: '',
    notes: '',
    active: 1
  });
  const [conversions, setConversions] = useState<{ unit_name: string; multiplier: number }[]>([
    { unit_name: 'Strip', multiplier: 10 }
  ]);

  // Add Batch Modal
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedMedForBatch, setSelectedMedForBatch] = useState<Medicine | null>(null);
  const [newBatch, setNewBatch] = useState<Partial<InventoryBatch>>({
    batch_number: '',
    expiry_date: '',
    purchase_cost: 0.8,
    initial_qty: 100,
    remaining_qty: 100
  });

  // Excel Import Modal
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelPreview, setExcelPreview] = useState<{
    totalRows?: number;
    validRows?: any[];
    duplicates?: any[];
    errors?: string[];
  } | null>(null);
  const [excelBase64, setExcelBase64] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<string>('');

  // Inline feedback & confirmation modals
  const [notice, setNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [modalError, setModalError] = useState('');
  const [editingBatch, setEditingBatch] = useState<InventoryBatch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'medicine' | 'batch'; id: number; medId?: number; label: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const t = (key: any) => getTranslation(lang, key);

  const loadMedicines = async () => {
    try {
      setLoading(true);
      const data = await api.getMedicines(search);
      setMedicines(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load medicines');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMedicines();
  }, [search]);

  // Load batches for an expanded medicine
  const toggleExpand = async (medId: number) => {
    if (expandedMedId === medId) {
      setExpandedMedId(null);
      return;
    }
    setExpandedMedId(medId);
    if (!batchesMap[medId]) {
      try {
        const b = await api.getBatches(medId, true);
        setBatchesMap(prev => ({ ...prev, [medId]: b }));
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Save Medicine
  const handleSaveMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    if (!editingMed.brand_name?.trim() || !editingMed.generic_name?.trim() || !editingMed.sale_price) {
      setModalError(lang === 'bn' ? 'দয়া করে ব্র্যান্ড, জেনেরিক ও বিক্রয় মূল্য পূরণ করুন।' : 'Please fill all required medicine fields.');
      return;
    }

    try {
      await api.saveMedicine(editingMed, conversions.filter(c => c.unit_name && c.multiplier > 0));
      setShowMedModal(false);
      setErrorMsg('');
      setNotice(
        editingMed.id
          ? (lang === 'bn' ? `"${editingMed.brand_name}" আপডেট হয়েছে।` : `"${editingMed.brand_name}" updated.`)
          : (lang === 'bn' ? `নতুন ওষুধ "${editingMed.brand_name}" যোগ হয়েছে।` : `Added "${editingMed.brand_name}".`)
      );
      loadMedicines();
    } catch (err: any) {
      setModalError(err.message || 'Failed to save medicine');
    }
  };

  // Add Batch
  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    if (!selectedMedForBatch || !newBatch.batch_number?.trim() || !newBatch.expiry_date) {
      setModalError(lang === 'bn' ? 'ব্যাচ নম্বর ও মেয়াদের তারিখ অবশ্যই দিন।' : 'Batch number and expiry date are required.');
      return;
    }

    try {
      await api.addBatch({
        ...newBatch,
        medicine_id: selectedMedForBatch.id,
        stock_unit: selectedMedForBatch.base_unit
      });
      setShowBatchModal(false);
      setErrorMsg('');
      setNotice(lang === 'bn' ? `নতুন ব্যাচ "${newBatch.batch_number}" যোগ হয়েছে।` : `Batch "${newBatch.batch_number}" added.`);
      const b = await api.getBatches(selectedMedForBatch.id, true);
      setBatchesMap(prev => ({ ...prev, [selectedMedForBatch.id]: b }));
      loadMedicines();
    } catch (err: any) {
      setModalError(err.message || 'Failed to add batch');
    }
  };

  // Update Batch
  const handleUpdateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBatch) return;
    setModalError('');
    if (!editingBatch.batch_number?.trim() || !editingBatch.expiry_date) {
      setModalError(lang === 'bn' ? 'ব্যাচ নম্বর ও মেয়াদ অবশ্যই দিন।' : 'Batch number and expiry date are required.');
      return;
    }
    try {
      await api.updateBatch(editingBatch.id, {
        batch_number: editingBatch.batch_number,
        expiry_date: editingBatch.expiry_date,
        purchase_cost: editingBatch.purchase_cost,
        remaining_qty: editingBatch.remaining_qty
      });
      const medId = editingBatch.medicine_id;
      setEditingBatch(null);
      setErrorMsg('');
      setNotice(lang === 'bn' ? 'ব্যাচের তথ্য ও স্টক সংশোধন হয়েছে।' : 'Batch updated successfully.');
      const b = await api.getBatches(medId, true);
      setBatchesMap(prev => ({ ...prev, [medId]: b }));
      loadMedicines();
    } catch (err: any) {
      setModalError(err.message || 'Failed to update batch');
    }
  };

  // Toggle Active Status
  const handleToggleActive = async (med: Medicine) => {
    setErrorMsg('');
    setNotice('');
    try {
      const nextActive = med.active === 1 ? false : true;
      await api.setMedicineActive(med.id, nextActive);
      setNotice(
        lang === 'bn'
          ? `"${med.brand_name}" ${nextActive ? 'চালু' : 'বন্ধ (Inactive)'} করা হয়েছে।`
          : `"${med.brand_name}" marked ${nextActive ? 'active' : 'inactive'}.`
      );
      loadMedicines();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update status');
    }
  };

  // Delete Medicine or Batch
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setErrorMsg('');
    setNotice('');
    try {
      if (deleteTarget.type === 'medicine') {
        await api.deleteMedicine(deleteTarget.id);
        setNotice(lang === 'bn' ? `"${deleteTarget.label}" তালিকা থেকে মুছে ফেলা হয়েছে।` : `Deleted "${deleteTarget.label}".`);
        loadMedicines();
      } else {
        await api.deleteBatch(deleteTarget.id);
        setNotice(lang === 'bn' ? `ব্যাচ "${deleteTarget.label}" মুছে ফেলা হয়েছে।` : `Deleted batch "${deleteTarget.label}".`);
        if (deleteTarget.medId) {
          const b = await api.getBatches(deleteTarget.medId, true);
          setBatchesMap(prev => ({ ...prev, [deleteTarget.medId!]: b }));
        }
        loadMedicines();
      }
      setDeleteTarget(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Delete failed');
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Excel File Selection
  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setModalError('');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const base64 = (evt.target?.result as string).split(',')[1];
      setExcelBase64(base64);
      try {
        setIsImporting(true);
        const res = await api.importExcelMedicines(base64, 'preview');
        setExcelPreview(res);
      } catch (err: any) {
        setModalError(err.message || 'Error parsing Excel file');
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Execute Excel Import
  const handleExecuteImport = async () => {
    if (!excelBase64) return;
    setModalError('');
    try {
      setIsImporting(true);
      const res = await api.importExcelMedicines(excelBase64, 'execute');
      setImportSummary(`Successfully imported ${res.insertedCount} new medicines.`);
      loadMedicines();
    } catch (err: any) {
      setModalError(err.message || 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {t('med_title')}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage brands, generics, strip/box unit conversion multipliers, and FEFO inventory batches.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setExcelPreview(null);
              setImportSummary('');
              setModalError('');
              setShowExcelModal(true);
            }}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>{t('med_import_excel')}</span>
          </button>
          <button
            onClick={() => {
              setEditingMed({
                brand_name: '',
                generic_name: '',
                manufacturer: 'Square Pharmaceuticals PLC',
                strength: '500 mg',
                dosage_form: 'Tablet',
                base_unit: 'Tablet',
                sale_price: 2.0,
                barcode: '',
                notes: '',
                active: 1
              });
              setConversions([{ unit_name: 'Strip', multiplier: 10 }]);
              setModalError('');
              setShowMedModal(true);
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('med_add_medicine')}</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{notice}</span>
          </div>
          <button onClick={() => setNotice('')} className="text-emerald-600 hover:text-emerald-800 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-600 hover:text-rose-800 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Search Input Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by brand name, generic formula, manufacturer, or barcode..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
      </div>

      {/* Medicines Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="p-3 text-left w-10"></th>
                <th className="p-3 text-left">{t('med_brand_name')}</th>
                <th className="p-3 text-left">{t('med_generic_name')}</th>
                <th className="p-3 text-left">{t('med_manufacturer')}</th>
                <th className="p-3 text-center">{t('med_dosage_form')}</th>
                <th className="p-3 text-right">{t('med_sale_price')}</th>
                <th className="p-3 text-center">{t('med_remaining_qty')}</th>
                <th className="p-3 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    {t('loading')}
                  </td>
                </tr>
              ) : medicines.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    {t('no_records')}
                  </td>
                </tr>
              ) : (
                medicines.map((med) => {
                  const isExpanded = expandedMedId === med.id;
                  const isLow = (med.total_stock || 0) <= settings.low_stock_threshold;
                  const batches = batchesMap[med.id] || [];

                  return (
                    <React.Fragment key={med.id}>
                      <tr className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 text-center">
                          <button
                            onClick={() => toggleExpand(med.id)}
                            className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="p-3 font-semibold text-slate-900">
                          <span className={med.active === 0 ? 'line-through text-slate-400' : ''}>
                            {med.brand_name}
                          </span>
                          <span className="text-slate-500 font-normal ml-1">({med.strength})</span>
                          {med.active === 0 && (
                            <span className="ml-1.5 text-[10px] font-mono bg-slate-200 text-slate-600 px-1 rounded">
                              Inactive
                            </span>
                          )}
                          {med.barcode && (
                            <span className="ml-2 font-mono text-[10px] bg-slate-100 text-slate-600 px-1 rounded">
                              {med.barcode}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-slate-600">{med.generic_name}</td>
                        <td className="p-3 text-slate-500">{med.manufacturer}</td>
                        <td className="p-3 text-center text-slate-600">{med.dosage_form}</td>
                        <td className="p-3 text-right font-bold text-slate-900 tabular-nums">
                          {formatBDT(med.sale_price)} / {med.base_unit}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded font-bold tabular-nums text-[11px] ${
                            isLow ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {med.total_stock} {med.base_unit}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                setSelectedMedForBatch(med);
                                setNewBatch({
                                  batch_number: '',
                                  expiry_date: '',
                                  purchase_cost: Math.round(med.sale_price * 0.8 * 100) / 100,
                                  initial_qty: 100,
                                  remaining_qty: 100
                                });
                                setModalError('');
                                setShowBatchModal(true);
                              }}
                              className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                            >
                              + Batch
                            </button>
                            <button
                              onClick={() => {
                                setEditingMed(med);
                                setConversions(med.conversions || []);
                                setModalError('');
                                setShowMedModal(true);
                              }}
                              className="p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded cursor-pointer"
                              title={lang === 'bn' ? 'সংশোধন করুন' : 'Edit'}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleActive(med)}
                              className={`p-1.5 rounded cursor-pointer ${
                                med.active === 1
                                  ? 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700'
                                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              }`}
                              title={med.active === 1 ? (lang === 'bn' ? 'বন্ধ করুন (POS থেকে লুকান)' : 'Deactivate') : (lang === 'bn' ? 'পুনরায় চালু করুন' : 'Activate')}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ type: 'medicine', id: med.id, label: med.brand_name })}
                              className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded cursor-pointer"
                              title={lang === 'bn' ? 'ওষুধ মুছুন' : 'Delete medicine'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Batches Drawer */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-y border-slate-200">
                          <td colSpan={8} className="p-4">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                  <Layers className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Inventory Batches for {med.brand_name} (FEFO Ordered)</span>
                                </h4>
                                <div className="text-[11px] text-slate-500">
                                  Conversions: {med.conversions?.map(c => `1 ${c.unit_name} = ${c.multiplier} ${med.base_unit}`).join(', ') || 'None'}
                                </div>
                              </div>

                              {batches.length === 0 ? (
                                <div className="text-xs text-slate-400 py-2">No batches recorded for this medicine yet.</div>
                              ) : (
                                <table className="w-full border-collapse bg-white rounded-lg border border-slate-200 text-[11px]">
                                  <thead>
                                    <tr className="border-b border-slate-200 bg-slate-100/60 text-slate-500 font-semibold">
                                      <th className="p-2 text-left">Batch No</th>
                                      <th className="p-2 text-left">Expiry Date</th>
                                      <th className="p-2 text-center">Days to Expiry</th>
                                      <th className="p-2 text-right">Purchase Cost</th>
                                      <th className="p-2 text-right">Remaining Stock</th>
                                      <th className="p-2 text-center">Status</th>
                                      <th className="p-2 text-center w-20">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {batches.map((b) => {
                                      const days = getDaysUntilExpiry(b.expiry_date);
                                      const isExp = days <= 0;
                                      const isNear = days > 0 && days <= settings.expiry_warning_days;

                                      return (
                                        <tr key={b.id} className="hover:bg-slate-50">
                                          <td className="p-2 font-mono font-semibold text-slate-800">{b.batch_number}</td>
                                          <td className="p-2 text-slate-600">{formatDate(b.expiry_date, lang)}</td>
                                          <td className="p-2 text-center">
                                            {isExp ? (
                                              <span className="text-rose-700 font-bold">Expired</span>
                                            ) : isNear ? (
                                              <span className="text-amber-700 font-semibold">{days} days left</span>
                                            ) : (
                                              <span className="text-slate-600">{days} days</span>
                                            )}
                                          </td>
                                          <td className="p-2 text-right font-mono tabular-nums">{formatBDT(b.purchase_cost)}</td>
                                          <td className="p-2 text-right font-bold tabular-nums">{b.remaining_qty} {b.stock_unit}</td>
                                          <td className="p-2 text-center">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-mono font-semibold ${
                                              b.status === 'active' && !isExp
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : 'bg-rose-100 text-rose-800'
                                            }`}>
                                              {isExp ? 'Expired' : b.status}
                                            </span>
                                          </td>
                                          <td className="p-2 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setEditingBatch({ ...b });
                                                  setModalError('');
                                                }}
                                                className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                                                title={lang === 'bn' ? 'ব্যাচ সংশোধন করুন' : 'Edit batch'}
                                              >
                                                <Pencil className="w-3 h-3" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setDeleteTarget({ type: 'batch', id: b.id, medId: med.id, label: b.batch_number })}
                                                className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                                                title={lang === 'bn' ? 'ব্যাচ মুছুন' : 'Delete batch'}
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Medicine Modal */}
      {showMedModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                {editingMed.id ? 'Edit Medicine' : t('med_add_medicine')}
              </h3>
              <button onClick={() => setShowMedModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMedicine} className="p-5 space-y-3.5 text-xs">
              {modalError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('med_brand_name')} *</label>
                  <input
                    type="text"
                    required
                    value={editingMed.brand_name || ''}
                    onChange={(e) => setEditingMed({ ...editingMed, brand_name: e.target.value })}
                    placeholder="e.g. Napa 500mg"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('med_generic_name')} *</label>
                  <input
                    type="text"
                    required
                    value={editingMed.generic_name || ''}
                    onChange={(e) => setEditingMed({ ...editingMed, generic_name: e.target.value })}
                    placeholder="e.g. Paracetamol"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('med_strength')}</label>
                  <input
                    type="text"
                    value={editingMed.strength || ''}
                    onChange={(e) => setEditingMed({ ...editingMed, strength: e.target.value })}
                    placeholder="e.g. 500 mg"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('med_dosage_form')}</label>
                  <select
                    value={editingMed.dosage_form}
                    onChange={(e) => setEditingMed({ ...editingMed, dosage_form: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="Tablet">Tablet</option>
                    <option value="Capsule">Capsule</option>
                    <option value="Syrup">Syrup</option>
                    <option value="Suspension">Suspension</option>
                    <option value="Injection">Injection</option>
                    <option value="Cream">Cream</option>
                    <option value="Drops">Drops</option>
                    <option value="Inhaler">Inhaler</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('med_base_unit')}</label>
                  <input
                    type="text"
                    value={editingMed.base_unit || 'Tablet'}
                    onChange={(e) => setEditingMed({ ...editingMed, base_unit: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('med_manufacturer')}</label>
                  <input
                    type="text"
                    value={editingMed.manufacturer || ''}
                    onChange={(e) => setEditingMed({ ...editingMed, manufacturer: e.target.value })}
                    placeholder="e.g. Square Pharmaceuticals PLC"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('med_sale_price')} *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editingMed.sale_price || 0}
                    onChange={(e) => setEditingMed({ ...editingMed, sale_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-right tabular-nums"
                  />
                </div>
              </div>

              {/* Unit conversions list */}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-slate-700">{t('med_conversions')}</label>
                  <button
                    type="button"
                    onClick={() => setConversions([...conversions, { unit_name: 'Box', multiplier: 100 }])}
                    className="text-emerald-700 hover:underline text-[11px] font-semibold"
                  >
                    + Add Conversion
                  </button>
                </div>
                <div className="space-y-2">
                  {conversions.map((conv, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-slate-500">1</span>
                      <input
                        type="text"
                        value={conv.unit_name}
                        onChange={(e) => {
                          const arr = [...conversions];
                          arr[idx].unit_name = e.target.value;
                          setConversions(arr);
                        }}
                        placeholder="Unit (e.g. Strip)"
                        className="w-24 px-2 py-1 border border-slate-300 rounded text-xs"
                      />
                      <span className="text-slate-500">=</span>
                      <input
                        type="number"
                        min="1"
                        value={conv.multiplier}
                        onChange={(e) => {
                          const arr = [...conversions];
                          arr[idx].multiplier = parseInt(e.target.value, 10) || 1;
                          setConversions(arr);
                        }}
                        placeholder="Multiplier"
                        className="w-20 px-2 py-1 border border-slate-300 rounded text-xs font-mono text-center"
                      />
                      <span className="text-slate-500">{editingMed.base_unit || 'Tablets'}</span>
                      <button
                        type="button"
                        onClick={() => setConversions(conversions.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowMedModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                >
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Batch Modal */}
      {showBatchModal && selectedMedForBatch && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                {t('med_add_batch')} — {selectedMedForBatch.brand_name}
              </h3>
              <button onClick={() => setShowBatchModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBatch} className="p-5 space-y-3.5 text-xs">
              {modalError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('med_batch_no')} *</label>
                <input
                  type="text"
                  required
                  value={newBatch.batch_number || ''}
                  onChange={(e) => setNewBatch({ ...newBatch, batch_number: e.target.value })}
                  placeholder="e.g. BATCH-2026-X"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('med_expiry')} *</label>
                  <input
                    type="date"
                    required
                    value={newBatch.expiry_date || ''}
                    onChange={(e) => setNewBatch({ ...newBatch, expiry_date: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('med_purchase_cost')} (Per {selectedMedForBatch.base_unit})</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newBatch.purchase_cost || 0}
                    onChange={(e) => setNewBatch({ ...newBatch, purchase_cost: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs text-right tabular-nums font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Stock Quantity (In {selectedMedForBatch.base_unit})
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={newBatch.initial_qty || 100}
                  onChange={(e) => {
                    const q = parseInt(e.target.value, 10) || 0;
                    setNewBatch({ ...newBatch, initial_qty: q, remaining_qty: q });
                  }}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-center"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                >
                  {t('confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      {showExcelModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>{t('med_excel_preview')}</span>
              </h3>
              <button onClick={() => setShowExcelModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
              {modalError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}
              {!excelPreview && !importSummary && (
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50/50 transition-colors">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <div className="font-semibold text-slate-700 mb-1">
                    Select Excel Spreadsheet (.xlsx)
                  </div>
                  <div className="text-slate-500 text-[11px] mb-4">
                    Columns: Brand Name, Generic Name, Company, Strength, Dosage Form, Base Unit, Sale Price, Barcode
                  </div>
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleExcelFileChange}
                    className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                  />
                </div>
              )}

              {excelPreview && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                      <div className="text-slate-600">Valid Rows Ready</div>
                      <div className="text-lg font-bold text-emerald-800">{excelPreview.validRows?.length || 0}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                      <div className="text-slate-600">Duplicates Skipped</div>
                      <div className="text-lg font-bold text-amber-800">{excelPreview.duplicates?.length || 0}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-rose-50 border border-rose-200">
                      <div className="text-slate-600">Invalid / Error Rows</div>
                      <div className="text-lg font-bold text-rose-800">{excelPreview.errors?.length || 0}</div>
                    </div>
                  </div>

                  {excelPreview.validRows && excelPreview.validRows.length > 0 && (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="px-3 py-1.5 bg-slate-100 font-semibold text-slate-700">Preview Data</div>
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="p-2 text-left">Brand</th>
                            <th className="p-2 text-left">Generic</th>
                            <th className="p-2 text-left">Company</th>
                            <th className="p-2 text-right">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {excelPreview.validRows.slice(0, 5).map((r, i) => (
                            <tr key={i} className="border-b border-slate-100">
                              <td className="p-2 font-medium">{r.brand_name}</td>
                              <td className="p-2 text-slate-600">{r.generic_name}</td>
                              <td className="p-2 text-slate-500">{r.manufacturer}</td>
                              <td className="p-2 text-right font-bold">{formatBDT(r.sale_price)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {importSummary && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="font-semibold">{importSummary}</span>
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowExcelModal(false)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                {t('close')}
              </button>
              {excelPreview && (excelPreview.validRows?.length || 0) > 0 && !importSummary && (
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={handleExecuteImport}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isImporting ? 'Importing...' : t('med_excel_confirm_import')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Batch Modal */}
      {editingBatch && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                {lang === 'bn' ? 'ব্যাচ তথ্য ও স্টক সংশোধন' : 'Edit Batch'} — {editingBatch.batch_number}
              </h3>
              <button onClick={() => setEditingBatch(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateBatch} className="p-5 space-y-3.5 text-xs">
              {modalError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t('med_batch_no')} *</label>
                <input
                  type="text"
                  required
                  value={editingBatch.batch_number}
                  onChange={(e) => setEditingBatch({ ...editingBatch, batch_number: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('med_expiry')} *</label>
                  <input
                    type="date"
                    required
                    value={editingBatch.expiry_date}
                    onChange={(e) => setEditingBatch({ ...editingBatch, expiry_date: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t('med_purchase_cost')}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editingBatch.purchase_cost}
                    onChange={(e) => setEditingBatch({ ...editingBatch, purchase_cost: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs text-right tabular-nums font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {lang === 'bn' ? 'অবশিষ্ট স্টক পরিমাণ' : 'Remaining Stock Qty'} ({editingBatch.stock_unit})
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={editingBatch.remaining_qty}
                  onChange={(e) => setEditingBatch({ ...editingBatch, remaining_qty: parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-center tabular-nums"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingBatch(null)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                >
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Medicine / Batch Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl border border-slate-200 p-5 space-y-4 text-xs">
            <div className="flex items-center gap-2.5 text-rose-600">
              <Trash2 className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900">
                {deleteTarget.type === 'medicine'
                  ? (lang === 'bn' ? 'ওষুধ মুছে ফেলবেন?' : 'Delete Medicine?')
                  : (lang === 'bn' ? 'ব্যাচ মুছে ফেলবেন?' : 'Delete Batch?')}
              </h3>
            </div>
            <p className="text-slate-600 leading-relaxed">
              {deleteTarget.type === 'medicine'
                ? (lang === 'bn'
                  ? `"${deleteTarget.label}" তালিকা থেকে স্থায়ীভাবে মুছে ফেলা হবে। যদি কোনো স্টক বা বিক্রি আগে থেকেই যুক্ত থাকে, তবে তা মুছবে না — সেক্ষেত্রে পাশের বন্ধ (Power) বাটন দিয়ে লুকিয়ে রাখতে পারবেন।`
                  : `Permanently delete "${deleteTarget.label}"? Medicines with batches or sales cannot be deleted; use Deactivate instead.`)
                : (lang === 'bn'
                  ? `ব্যাচ "${deleteTarget.label}" মুছে ফেলা হবে। যদি এই ব্যাচ থেকে আগে বিক্রি হয়ে থাকে, তবে Edit করে স্টক ০ করে দিন।`
                  : `Delete batch "${deleteTarget.label}"? Batches with recorded sales cannot be deleted.`)}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? '...' : (lang === 'bn' ? 'হ্যাঁ, মুছে ফেলুন' : 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
