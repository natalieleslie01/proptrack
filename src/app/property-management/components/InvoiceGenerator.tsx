'use client';

import React, { useState, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

export type InvoiceType = 'tenancy' | 'sale';
export type DocumentType = 'invoice' | 'receipt';

export interface AdHocItem {
  id: string;
  description: string;
  amount: string;
  payableBy: 'landlord' | 'tenant' | 'vendor' | 'purchaser';
}

export interface InvoiceData {
  invoiceType: InvoiceType;
  documentType: DocumentType;
  invoiceNumber: string;
  invoiceDate: string;
  // Property
  propertyAddress: string;
  // Vendor / Landlord
  ownerName: string;
  // Purchaser / Tenant
  counterpartyName: string;
  // Financial
  commissionAmount: string;
  commissionDescription: string;
  stampDutyAmount: string;
  adHocItems: AdHocItem[];
}

interface InvoiceGeneratorProps {
  invoiceType: InvoiceType;
  ownerName: string;       // landlord.name or vendor name
  counterpartyName: string; // tenant.name or purchaser name
  propertyAddress: string;
  monthlyRent?: string;
  salePrice?: string;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateInvoiceNumber(type: InvoiceType, docType: DocumentType): string {
  const prefix = docType === 'receipt' ? 'REC' : 'INV';
  const typeCode = type === 'sale' ? 'S' : 'T';
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `${prefix}-${typeCode}${yy}${mm}-${seq}`;
}

function formatHKD(value: string): string {
  const num = parseFloat(value.replace(/,/g, ''));
  if (isNaN(num)) return '—';
  return `HK$${num.toLocaleString('en-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function calcTotal(data: InvoiceData): number {
  const commission = parseFloat(data.commissionAmount.replace(/,/g, '')) || 0;
  const stampDuty = parseFloat(data.stampDutyAmount.replace(/,/g, '')) || 0;
  const adHoc = data.adHocItems.reduce((sum, item) => sum + (parseFloat(item.amount.replace(/,/g, '')) || 0), 0);
  return commission + stampDuty + adHoc;
}

// ─── Print / PDF helper ───────────────────────────────────────────────────────

function printInvoice(data: InvoiceData) {
  const total = calcTotal(data);
  const isReceipt = data.documentType === 'receipt';
  const ownerLabel = data.invoiceType === 'sale' ? 'Vendor' : 'Landlord';
  const counterLabel = data.invoiceType === 'sale' ? 'Purchaser' : 'Tenant';
  const today = new Date(data.invoiceDate).toLocaleDateString('en-HK', { day: '2-digit', month: 'long', year: 'numeric' });

  const rows: string[] = [];

  if (data.commissionAmount && parseFloat(data.commissionAmount) > 0) {
    rows.push(`
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e8ecf0;">${data.commissionDescription || 'Agency Commission'}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e8ecf0;text-align:right;font-weight:600;">${formatHKD(data.commissionAmount)}</td>
      </tr>`);
  }

  if (data.stampDutyAmount && parseFloat(data.stampDutyAmount) > 0) {
    rows.push(`
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e8ecf0;">Stamp Duty</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e8ecf0;text-align:right;font-weight:600;">${formatHKD(data.stampDutyAmount)}</td>
      </tr>`);
  }

  data.adHocItems.forEach((item) => {
    if (item.description && item.amount) {
      rows.push(`
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e8ecf0;">${item.description}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e8ecf0;text-align:right;font-weight:600;">${formatHKD(item.amount)}</td>
        </tr>`);
    }
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>${isReceipt ? 'Receipt' : 'Invoice'} ${data.invoiceNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #1a2332; background: #fff; }
    .page { max-width: 760px; margin: 0 auto; padding: 48px 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; }
    .company-name { font-size: 22px; font-weight: 800; color: #1B4F8A; letter-spacing: -0.5px; }
    .company-sub { font-size: 11px; color: #6b7a8d; margin-top: 4px; }
    .doc-title { text-align: right; }
    .doc-title h1 { font-size: 28px; font-weight: 800; color: #1B4F8A; text-transform: uppercase; letter-spacing: 2px; }
    .doc-title .inv-num { font-size: 12px; color: #6b7a8d; margin-top: 4px; }
    .divider { border: none; border-top: 2px solid #1B4F8A; margin: 0 0 28px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
    .meta-block label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #8a96a3; display: block; margin-bottom: 4px; }
    .meta-block p { font-size: 13px; font-weight: 600; color: #1a2332; }
    .meta-block .sub { font-size: 11px; color: #6b7a8d; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
    thead tr { background: #1B4F8A; }
    thead th { padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #fff; }
    thead th:last-child { text-align: right; }
    tbody tr:nth-child(even) { background: #f7f9fc; }
    .total-row td { padding: 12px; font-weight: 800; font-size: 14px; background: #1B4F8A; color: #fff; }
    .total-row td:last-child { text-align: right; }
    .payment-box { margin-top: 28px; background: #f0f4fa; border: 1px solid #c8d6e8; border-radius: 8px; padding: 18px 20px; }
    .payment-box h3 { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #1B4F8A; margin-bottom: 10px; }
    .payment-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
    .payment-row span:first-child { font-size: 12px; color: #6b7a8d; }
    .payment-row span:last-child { font-size: 12px; font-weight: 600; color: #1a2332; }
    .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #e8ecf0; display: flex; justify-content: space-between; align-items: center; }
    .footer p { font-size: 10px; color: #a0aab4; }
    .stamp { font-size: 11px; font-weight: 700; color: #1B4F8A; text-transform: uppercase; letter-spacing: 1px; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="company-name">Homes R Us Limited</div>
      <div class="company-sub">Room 527 Block D, DB Plaza, Discovery Bay, Lantau Island, Hong Kong</div>
      <div class="company-sub">Tel: +852 2987 8000 &nbsp;|&nbsp; Email: info@homesrus.hk</div>
    </div>
    <div class="doc-title">
      <h1>${isReceipt ? 'Receipt' : 'Invoice'}</h1>
      <div class="inv-num">${data.invoiceNumber}</div>
      <div class="inv-num">Date: ${today}</div>
    </div>
  </div>
  <hr class="divider"/>
  <div class="meta-grid">
    <div class="meta-block">
      <label>${ownerLabel}</label>
      <p>${data.ownerName || '—'}</p>
    </div>
    <div class="meta-block">
      <label>${counterLabel}</label>
      <p>${data.counterpartyName || '—'}</p>
    </div>
    <div class="meta-block" style="grid-column:1/-1;">
      <label>Property</label>
      <p>${data.propertyAddress}</p>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align:right;">Amount (HKD)</th>
      </tr>
    </thead>
    <tbody>
      ${rows.join('')}
      <tr class="total-row">
        <td>Total ${isReceipt ? 'Received' : 'Due'}</td>
        <td>HK$${total.toLocaleString('en-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    </tbody>
  </table>
  ${!isReceipt ? `
  <div class="payment-box">
    <h3>Payment Details</h3>
    <div class="payment-row"><span>Payable to</span><span>Homes R Us Limited</span></div>
    <div class="payment-row"><span>Bank</span><span>HSBC</span></div>
    <div class="payment-row"><span>Account Number</span><span>848-761631-838</span></div>
  </div>` : ''}
  <div class="footer">
    <p>This document was generated by PropTrack &mdash; Homes R Us Limited</p>
    <div class="stamp">${isReceipt ? '✓ Payment Received' : 'Please retain for your records'}</div>
  </div>
</div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) { toast.error('Pop-up blocked — please allow pop-ups and try again'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InvoiceGenerator({
  invoiceType,
  ownerName,
  counterpartyName,
  propertyAddress,
  monthlyRent,
  salePrice,
  onClose,
}: InvoiceGeneratorProps) {
  const [docType, setDocType] = useState<DocumentType>('invoice');
  const [data, setData] = useState<InvoiceData>({
    invoiceType,
    documentType: 'invoice',
    invoiceNumber: generateInvoiceNumber(invoiceType, 'invoice'),
    invoiceDate: new Date().toISOString().slice(0, 10),
    propertyAddress,
    ownerName,
    counterpartyName,
    commissionAmount: '',
    commissionDescription: invoiceType === 'sale' ? 'Agency Commission — Sale' : 'Agency Commission — Tenancy',
    stampDutyAmount: '',
    adHocItems: [],
  });

  function updateData(patch: Partial<InvoiceData>) {
    setData((prev) => ({ ...prev, ...patch }));
  }

  function switchDocType(dt: DocumentType) {
    setDocType(dt);
    updateData({
      documentType: dt,
      invoiceNumber: generateInvoiceNumber(invoiceType, dt),
    });
  }

  function addAdHocItem() {
    const newItem: AdHocItem = {
      id: `ah-${Date.now()}`,
      description: '',
      amount: '',
      payableBy: invoiceType === 'sale' ? 'vendor' : 'landlord',
    };
    updateData({ adHocItems: [...data.adHocItems, newItem] });
  }

  function updateAdHocItem(id: string, patch: Partial<AdHocItem>) {
    updateData({
      adHocItems: data.adHocItems.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  }

  function removeAdHocItem(id: string) {
    updateData({ adHocItems: data.adHocItems.filter((item) => item.id !== id) });
  }

  const total = calcTotal(data);
  const ownerLabel = invoiceType === 'sale' ? 'Vendor' : 'Landlord';
  const counterLabel = invoiceType === 'sale' ? 'Purchaser' : 'Tenant';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(214,20%,88%)] bg-[hsl(210,20%,98%)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1B4F8A]/10 flex items-center justify-center">
              <Icon name="FileTextIcon" size={18} className="text-[#1B4F8A]" />
            </div>
            <div>
              <p className="text-sm font-bold text-[hsl(215,25%,18%)]">
                Generate {docType === 'receipt' ? 'Receipt' : 'Invoice'}
              </p>
              <p className="text-[10px] text-[hsl(215,15%,52%)]">
                {invoiceType === 'sale' ? 'Sale Transaction' : 'Tenancy Transaction'} · {data.invoiceNumber}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors">
            <Icon name="XIcon" size={16} className="text-[hsl(215,15%,52%)]" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Doc type toggle */}
          <div>
            <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-2">Document Type</label>
            <div className="flex gap-2">
              {(['invoice', 'receipt'] as DocumentType[]).map((dt) => (
                <button
                  key={dt}
                  onClick={() => switchDocType(dt)}
                  className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold border transition-colors ${
                    docType === dt
                      ? 'bg-[#1B4F8A] text-white border-[#1B4F8A]'
                      : 'bg-white text-[hsl(215,25%,18%)] border-[hsl(214,20%,88%)] hover:border-[#1B4F8A]'
                  }`}
                >
                  <Icon name={dt === 'invoice' ? 'FileTextIcon' : 'CheckSquareIcon'} size={14} className="inline mr-1.5" />
                  {dt === 'invoice' ? 'Invoice' : 'Receipt'}
                </button>
              ))}
            </div>
          </div>

          {/* Date & Invoice No */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1">
                {docType === 'receipt' ? 'Receipt' : 'Invoice'} Number
              </label>
              <input
                type="text"
                value={data.invoiceNumber}
                onChange={(e) => updateData({ invoiceNumber: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1">Date</label>
              <input
                type="date"
                value={data.invoiceDate}
                onChange={(e) => updateData({ invoiceDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]"
              />
            </div>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1">{ownerLabel} Name</label>
              <input
                type="text"
                value={data.ownerName}
                onChange={(e) => updateData({ ownerName: e.target.value })}
                placeholder={`${ownerLabel} full name`}
                className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1">{counterLabel} Name</label>
              <input
                type="text"
                value={data.counterpartyName}
                onChange={(e) => updateData({ counterpartyName: e.target.value })}
                placeholder={`${counterLabel} full name`}
                className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]"
              />
            </div>
          </div>

          {/* Property */}
          <div>
            <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1">Property Address</label>
            <input
              type="text"
              value={data.propertyAddress}
              onChange={(e) => updateData({ propertyAddress: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]"
            />
          </div>

          {/* Commission */}
          <div className="border border-[hsl(214,20%,88%)] rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-[hsl(215,25%,18%)] uppercase tracking-wider flex items-center gap-1.5">
              <Icon name="PercentIcon" size={13} className="text-[#1B4F8A]" />
              Commission
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1">Description</label>
                <input
                  type="text"
                  value={data.commissionDescription}
                  onChange={(e) => updateData({ commissionDescription: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1">Amount (HKD)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={data.commissionAmount}
                  onChange={(e) => updateData({ commissionAmount: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]"
                />
              </div>
            </div>
          </div>

          {/* Stamp Duty */}
          <div className="border border-[hsl(214,20%,88%)] rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-[hsl(215,25%,18%)] uppercase tracking-wider flex items-center gap-1.5">
              <Icon name="StampIcon" size={13} className="text-[#1B4F8A]" />
              Stamp Duty
            </p>
            <div>
              <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1">Amount (HKD)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={data.stampDutyAmount}
                onChange={(e) => updateData({ stampDutyAmount: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]"
              />
            </div>
          </div>

          {/* Ad-hoc items */}
          <div className="border border-[hsl(214,20%,88%)] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-[hsl(215,25%,18%)] uppercase tracking-wider flex items-center gap-1.5">
                <Icon name="PlusCircleIcon" size={13} className="text-[#1B4F8A]" />
                Additional Items
              </p>
              <button
                onClick={addAdHocItem}
                className="flex items-center gap-1 text-xs font-semibold text-[#1B4F8A] hover:text-[#163d6e] transition-colors"
              >
                <Icon name="PlusIcon" size={12} />
                Add Item
              </button>
            </div>
            {data.adHocItems.length === 0 && (
              <p className="text-xs text-[hsl(215,15%,62%)] italic">
                No additional items. Click "Add Item" to add aircon cleaning, general cleaning, or other rechargeable costs.
              </p>
            )}
            {data.adHocItems.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_120px_auto] gap-2 items-start">
                <div>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateAdHocItem(item.id, { description: e.target.value })}
                    placeholder="e.g. Aircon cleaning, General cleaning..."
                    className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.amount}
                    onChange={(e) => updateAdHocItem(item.id, { amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/20 focus:border-[#1B4F8A]"
                  />
                </div>
                <button
                  onClick={() => removeAdHocItem(item.id)}
                  className="p-2 rounded-lg hover:bg-red-50 transition-colors mt-0.5"
                >
                  <Icon name="TrashIcon" size={14} className="text-red-400" />
                </button>
              </div>
            ))}
          </div>

          {/* Total preview */}
          <div className="bg-[#1B4F8A]/5 border border-[#1B4F8A]/20 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-[hsl(215,25%,18%)]">
                Total {docType === 'receipt' ? 'Received' : 'Due'}
              </p>
              <p className="text-lg font-extrabold text-[#1B4F8A]">
                {total > 0 ? `HK$${total.toLocaleString('en-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
              </p>
            </div>
            {docType === 'invoice' && (
              <div className="mt-3 pt-3 border-t border-[#1B4F8A]/10 space-y-1">
                <p className="text-[10px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">Payment Details</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  {[
                    { label: 'Payable to', value: 'Homes R Us Limited' },
                    { label: 'Bank', value: 'HSBC' },
                    { label: 'Account No.', value: '848-761631-838' },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center gap-2">
                      <span className="text-[10px] text-[hsl(215,15%,52%)] w-20 flex-shrink-0">{row.label}</span>
                      <span className="text-[11px] font-semibold text-[hsl(215,25%,18%)]">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-[hsl(214,20%,88%)] bg-[hsl(210,20%,98%)] flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!data.ownerName.trim() || !data.counterpartyName.trim()) {
                toast.error('Please fill in both party names before generating');
                return;
              }
              if (total <= 0) {
                toast.error('Please enter at least one amount before generating');
                return;
              }
              printInvoice(data);
              toast.success(`${docType === 'receipt' ? 'Receipt' : 'Invoice'} opened for printing / saving as PDF`);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1B4F8A] text-white rounded-xl text-sm font-semibold hover:bg-[#163d6e] transition-colors shadow-md"
          >
            <Icon name="PrinterIcon" size={15} />
            Generate &amp; Print {docType === 'receipt' ? 'Receipt' : 'Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}
