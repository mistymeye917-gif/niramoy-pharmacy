import { Language } from '../types/pharmacy';

export function formatBDT(amount: number, showSymbol = true): string {
  const val = isNaN(amount) ? 0 : amount;
  const formatted = val.toLocaleString('en-BD', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return showSymbol ? `৳ ${formatted}` : formatted;
}

export function formatDate(dateString?: string, lang: Language = 'en'): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString?: string, lang: Language = 'en'): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
}

export function getBangladeshTodayClient(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

export function getDaysUntilExpiry(expiryDateString: string): number {
  if (!expiryDateString) return 0;
  const parts = expiryDateString.split('T')[0].split('-').map(Number);
  const todayParts = getBangladeshTodayClient().split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    const exp = new Date(expiryDateString);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    exp.setHours(0, 0, 0, 0);
    return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }
  const expUtc = Date.UTC(parts[0], parts[1] - 1, parts[2]);
  const todayUtc = Date.UTC(todayParts[0], todayParts[1] - 1, todayParts[2]);
  return Math.round((expUtc - todayUtc) / (1000 * 60 * 60 * 24));
}
