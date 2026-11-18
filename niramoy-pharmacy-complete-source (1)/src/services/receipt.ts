import { SaleInvoice, CustomerPaymentReceipt, PharmacySettings, Language } from '../types/pharmacy';
import { formatBDT, formatDateTime } from './formatters.ts';

export function generateReceiptHtml(
  invoice: SaleInvoice,
  currentSettings: PharmacySettings,
  layout: 'full' | 'compact' = 'full',
  language: Language = 'bn'
): string {
  // Use snapshot if reprinting historical receipt, else current settings
  const pharmacy = invoice.pharmacy_snapshot || {
    name: currentSettings.pharmacy_name,
    address: currentSettings.pharmacy_address,
    phone: currentSettings.phone_number,
    logo: currentSettings.pharmacy_logo
  };

  const isBn = language === 'bn';

  const labels = isBn ? {
    invoice: 'চালান নং',
    date: 'তারিখ ও সময়',
    customer: 'ক্রেতার নাম',
    phone: 'মোবাইল',
    item: 'ওষুধের বিবরণ',
    batch: 'ব্যাচ',
    qty: 'পরিমাণ',
    price: 'দর',
    total: 'মোট',
    subtotal: 'উপমোট',
    discount: 'ছাড় (ডিসকাউন্ট)',
    net_payable: 'পরিশোধযোগ্য টাকা',
    paid: 'পরিশোধিত টাকা',
    change: 'ফেরত',
    due: 'বাকি টাকা (ক্রেডিট)',
    payment_method: 'পরিশোধ মাধ্যম',
    cash: 'নগদ ক্যাশ',
    bkash: 'বিকাশ',
    nagad: 'নগদ',
    rocket: 'রকেট',
    card: 'কার্ড',
    credit: 'বাকি',
    thanks: 'আমাদের সেবা গ্রহণ করার জন্য ধন্যবাদ। সুস্থ থাকুন।',
    notice: 'ওষুধ ফেরত দিতে হলে অবশ্যই আসল রসিদ ও অক্ষত প্যাকেট সঙ্গে আনবেন।'
  } : {
    invoice: 'Invoice #',
    date: 'Date & Time',
    customer: 'Customer',
    phone: 'Phone',
    item: 'Item Description',
    batch: 'Batch',
    qty: 'Qty',
    price: 'Price',
    total: 'Total',
    subtotal: 'Subtotal',
    discount: 'Discount',
    net_payable: 'Net Payable',
    paid: 'Paid Amount',
    change: 'Change Return',
    due: 'Due Balance',
    payment_method: 'Payment Details',
    cash: 'Cash',
    bkash: 'bKash',
    nagad: 'Nagad',
    rocket: 'Rocket',
    card: 'Card',
    credit: 'Credit',
    thanks: 'Thank you for your visit. Get well soon!',
    notice: 'Returns accepted with original receipt and undamaged packaging.'
  };

  if (layout === 'compact') {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { size: 80mm auto; margin: 3mm; }
          body { font-family: 'Hind Siliguri', -apple-system, sans-serif; font-size: 11px; color: #000; width: 72mm; margin: 0 auto; line-height: 1.25; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          th { text-align: left; border-bottom: 1px solid #000; padding: 2px 0; }
          td { padding: 2px 0; vertical-align: top; }
          tr { break-inside: avoid; page-break-inside: avoid; }
          .right { text-align: right; white-space: nowrap; padding-left: 4px; }
        </style>
      </head>
      <body>
        <div class="center">
          <div class="bold" style="font-size: 14px;">${pharmacy.name}</div>
          <div>${pharmacy.phone}</div>
          <div class="divider"></div>
          <div>${labels.invoice}: <span class="bold">${invoice.invoice_number}</span></div>
          <div>${formatDateTime(invoice.created_at || invoice.sale_date, language)}</div>
        </div>
        ${invoice.customer_name && invoice.customer_name !== 'Walk-in Customer' ? `
        <div class="divider"></div>
        <div style="font-size: 10px;">
          <div>${labels.customer}: <span class="bold">${invoice.customer_name}</span>${invoice.customer_phone ? ` (${invoice.customer_phone})` : ''}</div>
        </div>` : ''}
        <div class="divider"></div>
        <table>
          <thead>
            <tr>
              <th>${labels.item}</th>
              <th class="right">${labels.qty}</th>
              <th class="right">${labels.total}</th>
            </tr>
          </thead>
          <tbody>
            ${(invoice.items || []).map(item => `
              <tr>
                <td style="word-break: break-word;">${item.brand_name}</td>
                <td class="right">${item.quantity} ${item.unit}</td>
                <td class="right">${formatBDT(item.line_total, false)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="divider"></div>
        <table>
          <tr>
            <td>${labels.subtotal}:</td>
            <td class="right">${formatBDT(invoice.subtotal)}</td>
          </tr>
          ${invoice.discount_amount > 0 ? `
          <tr>
            <td>${labels.discount}:</td>
            <td class="right">-${formatBDT(invoice.discount_amount)}</td>
          </tr>` : ''}
          <tr class="bold" style="font-size: 12px;">
            <td>${labels.net_payable}:</td>
            <td class="right">${formatBDT(invoice.final_payable)}</td>
          </tr>
          <tr>
            <td>${labels.paid}:</td>
            <td class="right">${formatBDT(invoice.paid_amount)}</td>
          </tr>
          ${invoice.credit_amount > 0 ? `
          <tr class="bold">
            <td>${labels.due}:</td>
            <td class="right">${formatBDT(invoice.credit_amount)}</td>
          </tr>` : ''}
          ${invoice.change_returned > 0 ? `
          <tr>
            <td>${labels.change}:</td>
            <td class="right">${formatBDT(invoice.change_returned)}</td>
          </tr>` : ''}
        </table>
        <div class="divider"></div>
        <div class="center" style="font-size: 9px; margin-top: 4px;">
          ${labels.thanks}
        </div>
      </body>
      </html>
    `;
  }

  // Full Receipt Layout (Thermal 80mm or A4 invoice format)
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${pharmacy.name} - ${invoice.invoice_number}</title>
      <style>
        @page { size: auto; margin: 6mm; }
        body {
          font-family: 'Hind Siliguri', 'Segoe UI', Tahoma, sans-serif;
          font-size: 12px;
          color: #1e293b;
          max-width: 80mm;
          margin: 0 auto;
          line-height: 1.35;
          padding: 4px;
        }
        .header { text-align: center; margin-bottom: 6px; }
        .logo { max-height: 48px; margin-bottom: 4px; object-fit: contain; }
        .pharmacy-title { font-size: 16px; font-weight: 700; color: #0f172a; }
        .pharmacy-sub { font-size: 11px; color: #475569; }
        .divider { border-top: 1px dashed #94a3b8; margin: 6px 0; }
        .meta-grid { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px; }
        table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 11px; }
        th { text-align: left; border-bottom: 1px solid #0f172a; padding: 4px 2px; font-weight: 600; }
        td { padding: 4px 2px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-bold { font-weight: 700; }
        .summary-table td { border-bottom: none; padding: 2px 0; }
        .payment-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 4px 6px; margin: 6px 0; font-size: 10px; }
        .footer { text-align: center; font-size: 10px; color: #64748b; margin-top: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        ${pharmacy.logo ? `<img class="logo" src="${pharmacy.logo}" alt="Logo" />` : ''}
        <div class="pharmacy-title">${pharmacy.name}</div>
        <div class="pharmacy-sub">${pharmacy.address}</div>
        <div class="pharmacy-sub">${pharmacy.phone}</div>
      </div>

      <div class="divider"></div>

      <div class="meta-grid">
        <span>${labels.invoice}: <strong style="font-family: monospace;">${invoice.invoice_number}</strong></span>
        <span>${formatDateTime(invoice.created_at || invoice.sale_date, language)}</span>
      </div>
      ${invoice.customer_name && invoice.customer_name !== 'Walk-in Customer' ? `
      <div class="meta-grid">
        <span>${labels.customer}: <strong>${invoice.customer_name}</strong></span>
        <span>${invoice.customer_phone || ''}</span>
      </div>` : ''}

      <div class="divider"></div>

      <table>
        <thead>
          <tr>
            <th>${labels.item}</th>
            <th class="text-right">${labels.qty}</th>
            <th class="text-right">${labels.price}</th>
            <th class="text-right">${labels.total}</th>
          </tr>
        </thead>
        <tbody>
          ${(invoice.items || []).map(item => `
            <tr>
              <td>
                <div class="font-bold">${item.brand_name}</div>
                <div style="font-size: 9px; color: #64748b;">${item.generic_name}</div>
              </td>
              <td class="text-right">${item.quantity} ${item.unit}</td>
              <td class="text-right">${formatBDT(item.unit_price, false)}</td>
              <td class="text-right font-bold">${formatBDT(item.line_total, false)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="divider"></div>

      <table class="summary-table">
        <tr>
          <td>${labels.subtotal}:</td>
          <td class="text-right">${formatBDT(invoice.subtotal)}</td>
        </tr>
        ${invoice.discount_amount > 0 ? `
        <tr>
          <td>${labels.discount} (${invoice.discount_type === 'percentage' ? invoice.discount_value + '%' : 'Fixed'}):</td>
          <td class="text-right">-${formatBDT(invoice.discount_amount)}</td>
        </tr>` : ''}
        <tr class="font-bold" style="font-size: 13px; color: #0f172a;">
          <td style="border-top: 1px solid #cbd5e1; padding-top: 4px;">${labels.net_payable}:</td>
          <td class="text-right" style="border-top: 1px solid #cbd5e1; padding-top: 4px;">${formatBDT(invoice.final_payable)}</td>
        </tr>
        <tr>
          <td>${labels.paid}:</td>
          <td class="text-right font-bold">${formatBDT(invoice.paid_amount)}</td>
        </tr>
        ${invoice.change_returned > 0 ? `
        <tr>
          <td>${labels.change}:</td>
          <td class="text-right">${formatBDT(invoice.change_returned)}</td>
        </tr>` : ''}
        ${invoice.credit_amount > 0 ? `
        <tr style="color: #b91c1c;" class="font-bold">
          <td>${labels.due}:</td>
          <td class="text-right">${formatBDT(invoice.credit_amount)}</td>
        </tr>` : ''}
      </table>

      ${invoice.payments && invoice.payments.length > 0 ? `
      <div class="payment-box">
        <div class="font-bold" style="margin-bottom: 2px;">${labels.payment_method}:</div>
        ${invoice.payments.map(p => `
          <div style="display: flex; justify-content: space-between;">
            <span>${p.payment_method.toUpperCase()} ${p.transaction_ref ? `(${p.transaction_ref})` : ''}</span>
            <span>${formatBDT(p.amount)}</span>
          </div>
        `).join('')}
      </div>` : ''}

      <div class="divider"></div>

      <div class="footer">
        <div class="font-bold">${labels.thanks}</div>
        <div style="margin-top: 3px;">${labels.notice}</div>
        <div style="margin-top: 4px; font-family: monospace; font-size: 8px;">NIRAMOY POS · OFFLINE VERIFIED</div>
      </div>
    </body>
    </html>
  `;
}

export function generatePaymentReceiptHtml(
  receipt: CustomerPaymentReceipt,
  currentSettings: PharmacySettings,
  layout: 'full' | 'compact' = 'full',
  language: Language = 'bn'
): string {
  const isBn = language === 'bn';
  const methodLabels: Record<string, string> = isBn
    ? {
        cash: 'নগদ ক্যাশ',
        bkash: 'বিকাশ',
        nagad: 'নগদ',
        rocket: 'রকেট',
        card: 'ব্যাংক কার্ড'
      }
    : {
        cash: 'Physical Cash',
        bkash: 'bKash',
        nagad: 'Nagad',
        rocket: 'Rocket',
        card: 'Bank Card'
      };

  const labels = isBn
    ? {
        title: 'বাকি আদায়ের রসিদ',
        receiptNo: 'রসিদ নং',
        date: 'তারিখ ও সময়',
        customer: 'গ্রাহকের নাম',
        phone: 'মোবাইল',
        address: 'ঠিকানা',
        prevDue: 'পূর্বের মোট বাকি',
        paidNow: 'আজকের পরিশোধিত টাকা',
        remDue: 'বর্তমান অবশিষ্ট বাকি',
        settled: 'সম্পূর্ণ পরিশোধিত',
        method: 'পরিশোধ মাধ্যম',
        ref: 'রেফারেন্স / ট্রানজেকশন',
        notes: 'নোট',
        thanks: 'বকেয়া পরিশোধ করার জন্য ধন্যবাদ। সুস্থ থাকুন।',
        sign: 'স্বাক্ষর (ক্যাশিয়ার)'
      }
    : {
        title: 'DUE PAYMENT RECEIPT',
        receiptNo: 'Receipt #',
        date: 'Date & Time',
        customer: 'Customer Name',
        phone: 'Phone',
        address: 'Address',
        prevDue: 'Previous Due Balance',
        paidNow: 'Paid Amount',
        remDue: 'Remaining Due Balance',
        settled: 'Fully Settled',
        method: 'Payment Method',
        ref: 'Reference / TrxID',
        notes: 'Notes',
        thanks: 'Thank you for your payment. Get well soon!',
        sign: 'Authorized Signature'
      };

  const methodText = methodLabels[receipt.payment_method] || receipt.payment_method.toUpperCase();
  const dateDisplay = formatDateTime(receipt.created_at || receipt.payment_date, language);

  if (layout === 'compact') {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { size: 80mm auto; margin: 3mm; }
          body { font-family: 'Hind Siliguri', -apple-system, sans-serif; font-size: 11px; color: #000; width: 72mm; margin: 0 auto; line-height: 1.3; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          td { padding: 3px 0; }
          .right { text-align: right; }
        </style>
      </head>
      <body>
        <div class="center">
          <div class="bold" style="font-size: 14px;">${currentSettings.pharmacy_name}</div>
          <div style="font-size: 10px;">${currentSettings.phone_number}</div>
          <div class="divider"></div>
          <div class="bold" style="font-size: 12px;">${labels.title}</div>
          <div>${labels.receiptNo}: <span class="bold">${receipt.receipt_number}</span></div>
          <div style="font-size: 10px;">${dateDisplay}</div>
        </div>
        <div class="divider"></div>
        <table>
          <tr><td>${labels.customer}:</td><td class="right bold">${receipt.customer_name}</td></tr>
          <tr><td>${labels.phone}:</td><td class="right">${receipt.customer_phone}</td></tr>
        </table>
        <div class="divider"></div>
        <table>
          <tr>
            <td>${labels.prevDue}:</td>
            <td class="right">${formatBDT(receipt.previous_balance)}</td>
          </tr>
          <tr class="bold" style="font-size: 12px;">
            <td>${labels.paidNow}:</td>
            <td class="right">-${formatBDT(receipt.amount)}</td>
          </tr>
          <tr class="bold" style="font-size: 13px; border-top: 1px solid #000;">
            <td style="padding-top: 4px;">${labels.remDue}:</td>
            <td class="right" style="padding-top: 4px;">${formatBDT(receipt.remaining_balance)}</td>
          </tr>
        </table>
        <div class="divider"></div>
        <div style="font-size: 10px;">
          <div>${labels.method}: <span class="bold">${methodText}</span></div>
          ${receipt.reference ? `<div>${labels.ref}: ${receipt.reference}</div>` : ''}
        </div>
        <div class="divider"></div>
        <div class="center" style="font-size: 9px; margin-top: 4px;">${labels.thanks}</div>
      </body>
      </html>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${currentSettings.pharmacy_name} - ${receipt.receipt_number}</title>
      <style>
        @page { size: auto; margin: 6mm; }
        body {
          font-family: 'Hind Siliguri', 'Segoe UI', Tahoma, sans-serif;
          font-size: 12px;
          color: #1e293b;
          max-width: 80mm;
          margin: 0 auto;
          line-height: 1.4;
          padding: 4px;
        }
        .header { text-align: center; margin-bottom: 6px; }
        .logo { max-height: 48px; margin-bottom: 4px; object-fit: contain; }
        .pharmacy-title { font-size: 16px; font-weight: 700; color: #0f172a; }
        .pharmacy-sub { font-size: 11px; color: #475569; }
        .badge {
          display: inline-block;
          background: #ecfdf5;
          color: #065f46;
          border: 1px solid #a7f3d0;
          font-weight: 700;
          font-size: 11px;
          padding: 2px 10px;
          border-radius: 999px;
          margin-top: 4px;
        }
        .divider { border-top: 1px dashed #94a3b8; margin: 8px 0; }
        .meta-row { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px; gap: 8px; }
        .ledger-box {
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 8px;
          margin: 8px 0;
        }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        td { padding: 4px 0; }
        .text-right { text-align: right; }
        .font-bold { font-weight: 700; }
        .footer { text-align: center; font-size: 10px; color: #64748b; margin-top: 12px; }
        .sign-line {
          margin-top: 22px;
          display: flex;
          justify-content: flex-end;
        }
        .sign-box {
          border-top: 1px solid #64748b;
          padding-top: 2px;
          font-size: 10px;
          color: #475569;
          min-width: 110px;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="header">
        ${currentSettings.pharmacy_logo ? `<img class="logo" src="${currentSettings.pharmacy_logo}" alt="Logo" />` : ''}
        <div class="pharmacy-title">${currentSettings.pharmacy_name}</div>
        <div class="pharmacy-sub">${currentSettings.pharmacy_address}</div>
        <div class="pharmacy-sub">${currentSettings.phone_number}</div>
        <div class="badge">${labels.title}</div>
      </div>

      <div class="divider"></div>

      <div class="meta-row">
        <span>${labels.receiptNo}: <strong style="font-family: monospace;">${receipt.receipt_number}</strong></span>
        <span>${dateDisplay}</span>
      </div>
      <div class="meta-row">
        <span>${labels.customer}: <strong>${receipt.customer_name}</strong></span>
        <span style="font-family: monospace;">${receipt.customer_phone}</span>
      </div>
      ${receipt.customer_address ? `
      <div class="meta-row">
        <span>${labels.address}: ${receipt.customer_address}</span>
      </div>` : ''}

      <div class="ledger-box">
        <table>
          <tr>
            <td>${labels.prevDue}:</td>
            <td class="text-right font-bold">${formatBDT(receipt.previous_balance)}</td>
          </tr>
          <tr style="color: #047857; font-size: 13px;">
            <td class="font-bold">${labels.paidNow}:</td>
            <td class="text-right font-bold">- ${formatBDT(receipt.amount)}</td>
          </tr>
          <tr style="border-top: 1px solid #cbd5e1; font-size: 14px; color: ${receipt.remaining_balance > 0 ? '#b91c1c' : '#047857'};">
            <td class="font-bold" style="padding-top: 6px;">${labels.remDue}:</td>
            <td class="text-right font-bold" style="padding-top: 6px;">
              ${formatBDT(receipt.remaining_balance)}
              ${receipt.remaining_balance <= 0 ? `<div style="font-size: 10px; color: #047857;">(${labels.settled})</div>` : ''}
            </td>
          </tr>
        </table>
      </div>

      <div style="font-size: 11px; color: #334155;">
        <div class="meta-row">
          <span>${labels.method}:</span>
          <strong>${methodText}</strong>
        </div>
        ${receipt.reference ? `
        <div class="meta-row">
          <span>${labels.ref}:</span>
          <span style="font-family: monospace;">${receipt.reference}</span>
        </div>` : ''}
        ${receipt.notes ? `
        <div class="meta-row">
          <span>${labels.notes}:</span>
          <span>${receipt.notes}</span>
        </div>` : ''}
      </div>

      <div class="sign-line">
        <div class="sign-box">${labels.sign}</div>
      </div>

      <div class="divider"></div>

      <div class="footer">
        <div class="font-bold">${labels.thanks}</div>
        <div style="margin-top: 4px; font-family: monospace; font-size: 8px;">NIRAMOY POS · DUE LEDGER RECEIPT</div>
      </div>
    </body>
    </html>
  `;
}
