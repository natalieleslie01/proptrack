'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

// ─── Types ────────────────────────────────────────────────────────────────────

type WorkflowType = 'tenancy' | 'sales';

interface StepSummary {
  id: string;
  label: string;
  status: 'completed' | 'skipped' | 'pending';
  completedAt?: string;
  notes?: string;
  documents?: string[];
}

interface FormSummary {
  name: string;
  submittedAt: string;
  reference?: string;
}

interface KeyDate {
  label: string;
  date: string;
  icon: string;
  highlight?: boolean;
}

interface WorkflowSummaryData {
  workflowType: WorkflowType;
  referenceNumber: string;
  propertyAddress: string;
  completedAt: string;
  agent: string;

  // Tenancy-specific
  tenantName?: string;
  landlordName?: string;
  monthlyRent?: string;
  leaseStart?: string;
  leaseEnd?: string;
  depositMethod?: string;
  depositAmount?: string;

  // Sales-specific
  vendorName?: string;
  purchaserName?: string;
  salePrice?: string;
  completionDate?: string;
  depositPercent?: string;
  vendorSolicitor?: string;
  purchaserSolicitor?: string;

  steps: StepSummary[];
  forms: FormSummary[];
  keyDates: KeyDate[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const TENANCY_SUMMARY: WorkflowSummaryData = {
  workflowType: 'tenancy',
  referenceNumber: 'TEN-2025-0042',
  propertyAddress: 'Flat 12B, Discovery Bay Plaza, 11 Siena Avenue, Discovery Bay, Lantau Island',
  completedAt: '2025-04-28T10:30:00',
  agent: 'Sarah Chen',
  tenantName: 'Mr. James Wong & Mrs. Linda Wong',
  landlordName: 'Mr. David Lam',
  monthlyRent: 'HKD 28,000',
  leaseStart: '2025-05-01',
  leaseEnd: '2026-04-30',
  depositAmount: 'HKD 28,000',
  depositMethod: 'Transfer',
  steps: [
    { id: 'landsearch', label: 'Landsearch', status: 'completed', completedAt: '2025-04-10', documents: ['landsearch_DB12B.pdf'] },
    { id: 'rv', label: 'R&V', status: 'completed', completedAt: '2025-04-10', documents: ['rv_DB12B.pdf'] },
    { id: 'id-uploads', label: 'ID Documents', status: 'completed', completedAt: '2025-04-11', documents: ['landlord_hkid.pdf', 'tenant_hkid_james.pdf', 'tenant_hkid_linda.pdf'] },
    { id: 'front-page', label: 'Tenancy Details', status: 'completed', completedAt: '2025-04-11' },
    { id: 'form2', label: 'Form 2', status: 'completed', completedAt: '2025-04-12', documents: ['form2_signed.pdf'] },
    { id: 'forms56', label: 'Forms 5 & 6', status: 'completed', completedAt: '2025-04-14', documents: ['form5_signed.pdf', 'form6_signed.pdf'] },
    { id: 'provisional-ta', label: 'Provisional TA', status: 'completed', completedAt: '2025-04-15', documents: ['provisional_ta_signed.pdf'], notes: '1-month deposit received via bank transfer' },
    { id: 'tenancy-agreement', label: 'Tenancy Agreement', status: 'completed', completedAt: '2025-04-20', documents: ['formal_ta_signed.pdf'] },
    { id: 'stamp-duty', label: 'Stamp Duty', status: 'completed', completedAt: '2025-04-22', notes: 'Submitted via IRD portal. Reference: SD-2025-88421' },
    { id: 'cr109', label: 'CR109', status: 'completed', completedAt: '2025-04-23', documents: ['cr109_submitted.pdf'] },
    { id: 'handover', label: 'Handover', status: 'completed', completedAt: '2025-04-28', documents: ['handover_photos.zip', 'handover_form.pdf', 'invoice.pdf', 'receipt.pdf'] },
  ],
  forms: [
    { name: 'Form 2 — Leasing Information Form', submittedAt: '2025-04-12', reference: 'F2-2025-0042' },
    { name: 'Form 5 — Estate Agency Agreement (Landlord)', submittedAt: '2025-04-14', reference: 'F5-2025-0042' },
    { name: 'Form 6 — Estate Agency Agreement (Tenant)', submittedAt: '2025-04-14', reference: 'F6-2025-0042' },
    { name: 'CR109 — Notice of New Letting', submittedAt: '2025-04-23', reference: 'CR109-2025-0042' },
    { name: 'Stamp Duty — IRD Submission', submittedAt: '2025-04-22', reference: 'SD-2025-88421' },
  ],
  keyDates: [
    { label: 'Workflow Started', date: '2025-04-10', icon: 'PlayCircleIcon' },
    { label: 'Provisional TA Signed', date: '2025-04-15', icon: 'FileSignatureIcon' },
    { label: 'Formal TA Signed', date: '2025-04-20', icon: 'FileCheckIcon' },
    { label: 'Stamp Duty Submitted', date: '2025-04-22', icon: 'ExternalLinkIcon' },
    { label: 'Lease Commencement', date: '2025-05-01', icon: 'KeyIcon', highlight: true },
    { label: 'Lease Expiry', date: '2026-04-30', icon: 'CalendarIcon' },
    { label: 'Handover Completed', date: '2025-04-28', icon: 'CheckCircleIcon', highlight: true },
  ],
};

const SALES_SUMMARY: WorkflowSummaryData = {
  workflowType: 'sales',
  referenceNumber: 'SAL-2025-0018',
  propertyAddress: 'House 7, Siena Two, Discovery Bay, Lantau Island',
  completedAt: '2025-04-25T14:00:00',
  agent: 'Michael Yip',
  vendorName: 'Mr. Robert Chan',
  purchaserName: 'Ms. Emily Ng',
  salePrice: 'HKD 12,800,000',
  completionDate: '2025-05-15',
  depositPercent: '5% — HKD 640,000',
  vendorSolicitor: 'Deacons (Hong Kong)',
  purchaserSolicitor: 'Mayer Brown LLP',
  steps: [
    { id: 'landsearch', label: 'Landsearch', status: 'completed', completedAt: '2025-04-01', documents: ['landsearch_S7.pdf'] },
    { id: 'rv', label: 'R&V', status: 'completed', completedAt: '2025-04-01', documents: ['rv_S7.pdf'] },
    { id: 'id-uploads', label: 'ID Documents', status: 'completed', completedAt: '2025-04-02', documents: ['vendor_hkid.pdf', 'purchaser_hkid.pdf'] },
    { id: 'sale-details', label: 'Sale Details', status: 'completed', completedAt: '2025-04-02' },
    { id: 'form1', label: 'Form 1', status: 'completed', completedAt: '2025-04-03', documents: ['form1_signed.pdf'] },
    { id: 'form3-4', label: 'Form 3 & 4', status: 'completed', completedAt: '2025-04-05', documents: ['form3_signed.pdf', 'form4_signed.pdf'] },
    { id: 'pasp', label: 'PASP', status: 'completed', completedAt: '2025-04-10', documents: ['pasp_signed.pdf'], notes: '5% deposit HKD 640,000 received via cheque' },
    { id: 'stamp-duty', label: 'Stamp Duty', status: 'completed', completedAt: '2025-04-12', notes: 'Submitted via IRD portal within 30-day deadline. Reference: SD-2025-44210' },
    { id: 'pre-completion', label: 'Pre-Completion', status: 'completed', completedAt: '2025-05-08', notes: 'Final inspection done. Water: 04821 (1234 m³), CLP: 88421 (5678 kWh), Gas: 22110 (890 MJ). DBRC debenture transfer papers signed.' },
    { id: 'invoice', label: 'Invoice & Receipt', status: 'completed', completedAt: '2025-05-15', documents: ['commission_invoice.pdf', 'receipt.pdf'] },
    { id: 'management-office', label: 'Management Office', status: 'completed', completedAt: '2025-05-15', notes: 'Purchaser accompanied to management office. Octopus card form submitted, details updated.' },
  ],
  forms: [
    { name: 'Form 1 — Property Information Form', submittedAt: '2025-04-03', reference: 'F1-2025-0018' },
    { name: 'Form 3 — Estate Agency Agreement (Vendor)', submittedAt: '2025-04-05', reference: 'F3-2025-0018' },
    { name: 'Form 4 — Estate Agency Agreement (Purchaser)', submittedAt: '2025-04-05', reference: 'F4-2025-0018' },
    { name: 'PASP — Provisional Agreement for Sale & Purchase', submittedAt: '2025-04-10', reference: 'PASP-2025-0018' },
    { name: 'Stamp Duty — IRD Submission', submittedAt: '2025-04-12', reference: 'SD-2025-44210' },
  ],
  keyDates: [
    { label: 'Workflow Started', date: '2025-04-01', icon: 'PlayCircleIcon' },
    { label: 'PASP Signed', date: '2025-04-10', icon: 'FileSignatureIcon' },
    { label: 'Stamp Duty Submitted', date: '2025-04-12', icon: 'ExternalLinkIcon' },
    { label: 'Final Inspection', date: '2025-05-08', icon: 'SearchIcon' },
    { label: 'Completion / Key Handover', date: '2025-05-15', icon: 'KeyIcon', highlight: true },
    { label: 'Management Office Visit', date: '2025-05-15', icon: 'BuildingIcon' },
    { label: 'Closing Completed', date: '2025-04-25', icon: 'CheckCircleIcon', highlight: true },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-HK', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-HK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Step Status Icon ─────────────────────────────────────────────────────────

function StepStatusIcon({ status }: { status: StepSummary['status'] }) {
  if (status === 'completed') return (
    <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
      <Icon name="CheckIcon" size={14} className="text-emerald-600" />
    </div>
  );
  if (status === 'skipped') return (
    <div className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
      <Icon name="MinusIcon" size={14} className="text-amber-500" />
    </div>
  );
  return (
    <div className="w-7 h-7 rounded-full bg-[hsl(210,15%,94%)] flex items-center justify-center flex-shrink-0">
      <Icon name="ClockIcon" size={14} className="text-[hsl(215,15%,52%)]" />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WorkflowSummaryClient() {
  const [activeType, setActiveType] = useState<WorkflowType>('tenancy');
  const [printing, setPrinting] = useState(false);

  const data = activeType === 'tenancy' ? TENANCY_SUMMARY : SALES_SUMMARY;

  const completedSteps = data.steps.filter((s) => s.status === 'completed').length;
  const skippedSteps = data.steps.filter((s) => s.status === 'skipped').length;
  const totalSteps = data.steps.length;

  function handlePrint() {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 100);
  }

  return (
    <div className="min-h-screen bg-[hsl(210,20%,97%)]">
      {/* Header */}
      <div className="bg-white border-b border-[hsl(214,20%,88%)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#8B1A2B]/10 flex items-center justify-center">
            <Icon name="FileCheckIcon" size={18} className="text-[#8B1A2B]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[hsl(215,25%,18%)]">Workflow Summary</h1>
            <p className="text-xs text-[hsl(215,15%,52%)]">Final closing document — handover & completion record</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            disabled={printing}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[hsl(215,25%,18%)] border border-[hsl(214,20%,88%)] rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors"
          >
            <Icon name="PrinterIcon" size={15} />
            Print / Export PDF
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

        {/* Workflow Type Selector */}
        <div className="flex gap-2 p-1 bg-white border border-[hsl(214,20%,88%)] rounded-xl w-fit">
          <button
            onClick={() => setActiveType('tenancy')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeType === 'tenancy' ?'bg-[#8B1A2B] text-white shadow-sm' :'text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)]'
            }`}
          >
            <Icon name="KeyIcon" size={15} />
            Tenancy Handover
          </button>
          <button
            onClick={() => setActiveType('sales')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeType === 'sales' ?'bg-[#1B4F8A] text-white shadow-sm' :'text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)]'
            }`}
          >
            <Icon name="HomeIcon" size={15} />
            Sales Closing
          </button>
        </div>

        {/* Summary Header Card */}
        <div className={`rounded-2xl border p-6 ${
          activeType === 'tenancy' ?'bg-gradient-to-br from-[#8B1A2B]/5 to-white border-[#8B1A2B]/20' :'bg-gradient-to-br from-[#1B4F8A]/5 to-white border-[#1B4F8A]/20'
        }`}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                  activeType === 'tenancy' ?'bg-[#8B1A2B] text-white' :'bg-[#1B4F8A] text-white'
                }`}>
                  <Icon name="CheckCircleIcon" size={12} />
                  {activeType === 'tenancy' ? 'Tenancy Handover Complete' : 'Sales Closing Complete'}
                </span>
                <span className="text-xs text-[hsl(215,15%,52%)] font-mono">{data.referenceNumber}</span>
              </div>
              <h2 className="text-xl font-bold text-[hsl(215,25%,18%)] leading-tight">{data.propertyAddress}</h2>
              <p className="text-sm text-[hsl(215,15%,52%)]">
                Completed {formatDateTime(data.completedAt)} · Handled by {data.agent}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center px-4 py-2 bg-white rounded-xl border border-[hsl(214,20%,88%)] shadow-sm">
                <p className="text-2xl font-bold text-emerald-600">{completedSteps}</p>
                <p className="text-[10px] text-[hsl(215,15%,52%)] font-medium uppercase tracking-wide">Steps Done</p>
              </div>
              {skippedSteps > 0 && (
                <div className="text-center px-4 py-2 bg-white rounded-xl border border-[hsl(214,20%,88%)] shadow-sm">
                  <p className="text-2xl font-bold text-amber-500">{skippedSteps}</p>
                  <p className="text-[10px] text-[hsl(215,15%,52%)] font-medium uppercase tracking-wide">Skipped</p>
                </div>
              )}
              <div className="text-center px-4 py-2 bg-white rounded-xl border border-[hsl(214,20%,88%)] shadow-sm">
                <p className="text-2xl font-bold text-[hsl(215,25%,18%)]">{data.forms.length}</p>
                <p className="text-[10px] text-[hsl(215,15%,52%)] font-medium uppercase tracking-wide">Forms Filed</p>
              </div>
            </div>
          </div>

          {/* Party Details */}
          <div className="mt-5 pt-5 border-t border-[hsl(214,20%,88%)]/60 grid grid-cols-2 md:grid-cols-4 gap-4">
            {activeType === 'tenancy' ? (
              <>
                <div>
                  <p className="text-[10px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-0.5">Tenant</p>
                  <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">{data.tenantName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-0.5">Landlord</p>
                  <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">{data.landlordName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-0.5">Monthly Rent</p>
                  <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">{data.monthlyRent}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-0.5">Deposit</p>
                  <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">{data.depositAmount} <span className="text-[hsl(215,15%,52%)] font-normal">({data.depositMethod})</span></p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-[10px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-0.5">Vendor</p>
                  <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">{data.vendorName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-0.5">Purchaser</p>
                  <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">{data.purchaserName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-0.5">Sale Price</p>
                  <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">{data.salePrice}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-0.5">Deposit</p>
                  <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">{data.depositPercent}</p>
                </div>
              </>
            )}
          </div>

          {/* Solicitors (sales only) */}
          {activeType === 'sales' && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-0.5">Vendor&apos;s Solicitor</p>
                <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">{data.vendorSolicitor}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-0.5">Purchaser&apos;s Solicitor</p>
                <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">{data.purchaserSolicitor}</p>
              </div>
            </div>
          )}

          {/* Lease dates (tenancy only) */}
          {activeType === 'tenancy' && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-0.5">Lease Start</p>
                <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">{data.leaseStart ? formatDate(data.leaseStart) : '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-0.5">Lease End</p>
                <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">{data.leaseEnd ? formatDate(data.leaseEnd) : '—'}</p>
              </div>
            </div>
          )}
        </div>

        {/* Two-column layout: Steps + Key Dates */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Completed Steps — 2/3 width */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-[hsl(214,20%,88%)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[hsl(214,20%,88%)] flex items-center gap-2">
              <Icon name="ListChecksIcon" size={16} className="text-[hsl(215,15%,52%)]" />
              <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Completed Steps</h3>
              <span className="ml-auto text-xs text-[hsl(215,15%,52%)]">{completedSteps} / {totalSteps} steps</span>
            </div>
            <div className="divide-y divide-[hsl(214,20%,88%)]">
              {data.steps.map((step, idx) => (
                <div key={step.id} className="px-5 py-3.5 flex items-start gap-3">
                  <StepStatusIcon status={step.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[hsl(215,25%,18%)]">
                        {idx + 1}. {step.label}
                      </span>
                      {step.status === 'skipped' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 font-semibold">Bypassed</span>
                      )}
                      {step.completedAt && (
                        <span className="text-[10px] text-[hsl(215,15%,52%)] ml-auto">{formatDate(step.completedAt)}</span>
                      )}
                    </div>
                    {step.notes && (
                      <p className="text-[11px] text-[hsl(215,15%,52%)] mt-0.5 leading-relaxed">{step.notes}</p>
                    )}
                    {step.documents && step.documents.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {step.documents.map((doc) => (
                          <span key={doc} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-[hsl(210,20%,97%)] border border-[hsl(214,20%,88%)] text-[hsl(215,15%,52%)] font-medium">
                            <Icon name="PaperclipIcon" size={9} />
                            {doc}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Key Dates — 1/3 width */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-[hsl(214,20%,88%)] overflow-hidden">
              <div className="px-5 py-4 border-b border-[hsl(214,20%,88%)] flex items-center gap-2">
                <Icon name="CalendarIcon" size={16} className="text-[hsl(215,15%,52%)]" />
                <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Key Dates</h3>
              </div>
              <div className="divide-y divide-[hsl(214,20%,88%)]">
                {data.keyDates.map((kd) => (
                  <div key={kd.label} className={`px-5 py-3 flex items-center gap-3 ${kd.highlight ? 'bg-emerald-50/50' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                      kd.highlight ? 'bg-emerald-100' : 'bg-[hsl(210,15%,94%)]'
                    }`}>
                      <Icon name={kd.icon as Parameters<typeof Icon>[0]['name']} size={13} className={kd.highlight ? 'text-emerald-600' : 'text-[hsl(215,15%,52%)]'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${kd.highlight ? 'text-emerald-700' : 'text-[hsl(215,25%,18%)]'}`}>{kd.label}</p>
                      <p className="text-[10px] text-[hsl(215,15%,52%)]">{formatDate(kd.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Submitted Forms */}
        <div className="bg-white rounded-2xl border border-[hsl(214,20%,88%)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[hsl(214,20%,88%)] flex items-center gap-2">
            <Icon name="FileTextIcon" size={16} className="text-[hsl(215,15%,52%)]" />
            <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Submitted Forms & Filings</h3>
            <span className="ml-auto text-xs text-[hsl(215,15%,52%)]">{data.forms.length} forms</span>
          </div>
          <div className="divide-y divide-[hsl(214,20%,88%)]">
            {data.forms.map((form) => (
              <div key={form.name} className="px-5 py-3.5 flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-[#8B1A2B]/8 flex items-center justify-center flex-shrink-0">
                  <Icon name="FileCheckIcon" size={15} className="text-[#8B1A2B]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[hsl(215,25%,18%)] truncate">{form.name}</p>
                  {form.reference && (
                    <p className="text-[10px] text-[hsl(215,15%,52%)] font-mono">{form.reference}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-[hsl(215,15%,52%)]">Submitted</p>
                  <p className="text-xs font-semibold text-emerald-600">{formatDate(form.submittedAt)}</p>
                </div>
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Icon name="CheckIcon" size={12} className="text-emerald-600" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <div className="flex items-center gap-3 px-5 py-4 bg-white rounded-2xl border border-[hsl(214,20%,88%)]">
          <Icon name="InfoIcon" size={16} className="text-[hsl(215,15%,52%)] flex-shrink-0" />
          <p className="text-xs text-[hsl(215,15%,52%)] leading-relaxed">
            This summary was automatically generated by PropTrack HK upon workflow completion. All dates, documents, and form references are recorded at the time of submission. For official records, refer to the original signed documents stored in the property file.
          </p>
        </div>

      </div>
    </div>
  );
}
