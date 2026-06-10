'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import { mockProperties, Property, agentNames } from '@/app/property-management/components/mockData';
import { createClient } from '@/lib/supabase/client';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface HandoverForm {
  propertyRef: string;
  actualEndDate: string;
  handoverNotes: string;
  depositReturned: boolean;
  keysReturned: boolean;
  utilitiesSettled: boolean;
}

interface CompletedTenancy {
  id: string;
  property_ref: string;
  property_address: string;
  tenant_name: string;
  landlord_name: string | null;
  lease_start: string | null;
  lease_end: string | null;
  actual_end_date: string;
  monthly_rent: number | null;
  handover_notes: string | null;
  deposit_returned: boolean;
  keys_returned: boolean;
  utilities_settled: boolean;
  agent_name: string | null;
  archived_at: string;
}

interface FormErrors {
  propertyRef?: string;
  actualEndDate?: string;
  handoverNotes?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getActiveTenancies(properties: Property[]) {
  return properties.filter(
    (p) => p.occupancyStatus === 'leased' || p.occupancyStatus === 'with-ta' || p.status === 'leased'
  );
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCurrency(amount: number | null) {
  if (!amount) return '—';
  return `HK$${amount.toLocaleString()}`;
}

// ─── Checklist Item ────────────────────────────────────────────────────────────

function ChecklistItem({
  checked,
  onChange,
  label,
  icon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  icon: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all cursor-pointer w-full text-left ${
        checked
          ? 'border-emerald-400 bg-emerald-50 text-emerald-700' :'border-[hsl(214,20%,88%)] bg-white text-[hsl(215,15%,52%)] hover:border-[hsl(214,20%,75%)]'
      }`}
    >
      <Icon
        name={checked ? 'CheckCircleIcon' : ('CircleIcon' as Parameters<typeof Icon>[0]['name'])}
        size={18}
        className={checked ? 'text-emerald-500' : 'text-[hsl(215,15%,65%)]'}
      />
      <Icon name={icon as Parameters<typeof Icon>[0]['name']} size={15} />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function TenancyHandoverClient() {
  const supabase = createClient();

  const activeTenancies = useMemo(() => getActiveTenancies(mockProperties), []);

  const [form, setForm] = useState<HandoverForm>({
    propertyRef: '',
    actualEndDate: '',
    handoverNotes: '',
    depositReturned: false,
    keysReturned: false,
    utilitiesSettled: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [submitError, setSubmitError] = useState('');

  const [completed, setCompleted] = useState<CompletedTenancy[]>([]);
  const [loadingCompleted, setLoadingCompleted] = useState(true);
  const [archiveSearch, setArchiveSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Load completed tenancies from Supabase
  useEffect(() => {
    async function fetchCompleted() {
      setLoadingCompleted(true);
      const { data, error } = await supabase
        .from('completed_tenancies')
        .select('*')
        .order('archived_at', { ascending: false });
      if (!error && data) setCompleted(data as CompletedTenancy[]);
      setLoadingCompleted(false);
    }
    fetchCompleted();
  }, []);

  const selectedProperty = useMemo(
    () => activeTenancies.find((p) => p.ref === form.propertyRef || p.unit === form.propertyRef),
    [activeTenancies, form.propertyRef]
  );

  function validate(): boolean {
    const errs: FormErrors = {};
    if (!form.propertyRef) errs.propertyRef = 'Please select a tenancy to close.';
    if (!form.actualEndDate) errs.actualEndDate = 'Actual end date is required.';
    if (!form.handoverNotes.trim()) errs.handoverNotes = 'Handover notes are required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMsg('');
    setSubmitError('');
    if (!validate()) return;

    setSubmitting(true);
    const prop = selectedProperty;
    const payload = {
      property_ref: prop?.ref ?? form.propertyRef,
      property_address: prop ? `${prop.unit}, ${prop.building}` : form.propertyRef,
      tenant_name: prop?.tenant?.name ?? 'Unknown',
      landlord_name: prop?.landlord?.name ?? null,
      lease_start: prop?.tenant?.leaseStart ?? null,
      lease_end: prop?.tenant?.leaseEnd ?? null,
      actual_end_date: form.actualEndDate,
      monthly_rent: prop?.monthlyRent ?? null,
      handover_notes: form.handoverNotes.trim(),
      deposit_returned: form.depositReturned,
      keys_returned: form.keysReturned,
      utilities_settled: form.utilitiesSettled,
      agent_name: prop?.updatedBy ?? agentNames[0],
    };

    const { data, error } = await supabase
      .from('completed_tenancies')
      .insert(payload)
      .select()
      .single();

    if (error) {
      setSubmitError(error.message);
    } else {
      setCompleted((prev) => [data as CompletedTenancy, ...prev]);
      setSuccessMsg(`Tenancy for ${payload.property_address} has been archived successfully.`);
      setForm({
        propertyRef: '',
        actualEndDate: '',
        handoverNotes: '',
        depositReturned: false,
        keysReturned: false,
        utilitiesSettled: false,
      });
      setErrors({});
    }
    setSubmitting(false);
  }

  const filteredCompleted = useMemo(() => {
    if (!archiveSearch.trim()) return completed;
    const q = archiveSearch.toLowerCase();
    return completed.filter(
      (c) =>
        c.property_ref.toLowerCase().includes(q) ||
        c.property_address.toLowerCase().includes(q) ||
        c.tenant_name.toLowerCase().includes(q) ||
        (c.agent_name ?? '').toLowerCase().includes(q)
    );
  }, [completed, archiveSearch]);

  const checklistComplete =
    form.depositReturned && form.keysReturned && form.utilitiesSettled;

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        {/* ── Header ── */}
        <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-[hsl(214,20%,88%)] bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-[hsl(215,25%,18%)]">Tenancy Handover</h1>
              <p className="text-sm text-[hsl(215,15%,52%)] mt-0.5">
                Close active tenancies, capture handover notes and archive to Completed Tenancies
              </p>
            </div>
            <Link
              href="/active-tenancies"
              className="inline-flex items-center gap-1.5 text-sm text-[#8B1A2B] hover:text-[#6d1522] font-medium transition-colors"
            >
              <Icon name="ArrowLeftIcon" size={14} />
              Active Tenancies
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: 'Active Tenancies', value: activeTenancies.length, icon: 'KeyIcon', color: 'text-[#8B1A2B]', bg: 'bg-[#8B1A2B]/6' },
              { label: 'Completed This Year', value: completed.filter((c) => new Date(c.archived_at).getFullYear() === new Date().getFullYear()).length, icon: 'CheckCircleIcon', color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Total Archived', value: completed.length, icon: 'ArchiveIcon', color: 'text-[hsl(215,25%,18%)]', bg: 'bg-[hsl(210,15%,96%)]' },
            ].map((s) => (
              <div key={s.label} className={`${s.bg} rounded-xl px-4 py-3 flex items-center gap-3`}>
                <Icon name={s.icon as Parameters<typeof Icon>[0]['name']} size={18} className={s.color} />
                <div>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-[hsl(215,15%,52%)]">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">

          {/* ── Handover Form ── */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-[#8B1A2B] flex items-center justify-center">
                <Icon name="ClipboardListIcon" size={14} className="text-white" />
              </div>
              <h2 className="text-base font-bold text-[hsl(215,25%,18%)]">Close a Tenancy</h2>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div className="bg-white border border-[hsl(214,20%,88%)] rounded-2xl p-6 space-y-6">

                {/* Success / Error banners */}
                {successMsg && (
                  <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                    <Icon name="CheckCircleIcon" size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-emerald-700">{successMsg}</p>
                  </div>
                )}
                {submitError && (
                  <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <Icon name="AlertCircleIcon" size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-700">{submitError}</p>
                  </div>
                )}

                {/* Row 1: Property + End Date */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Select Tenancy */}
                  <div>
                    <label className="block text-xs font-semibold text-[hsl(215,25%,18%)] mb-1.5 uppercase tracking-wide">
                      Select Tenancy <span className="text-[#8B1A2B]">*</span>
                    </label>
                    <select
                      value={form.propertyRef}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, propertyRef: e.target.value }));
                        setErrors((er) => ({ ...er, propertyRef: undefined }));
                      }}
                      className={`w-full px-3 py-2.5 rounded-xl border text-sm bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/30 transition-colors ${
                        errors.propertyRef ? 'border-red-400' : 'border-[hsl(214,20%,88%)]'
                      }`}
                    >
                      <option value="">— Choose active tenancy —</option>
                      {activeTenancies.map((p) => (
                        <option key={p.ref ?? p.unit} value={p.ref ?? p.unit}>
                          {p.unit}, {p.building} — {p.tenant?.name ?? 'Unknown Tenant'}
                        </option>
                      ))}
                    </select>
                    {errors.propertyRef && (
                      <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                        <Icon name="AlertCircleIcon" size={11} /> {errors.propertyRef}
                      </p>
                    )}

                    {/* Property summary card */}
                    {selectedProperty && (
                      <div className="mt-3 bg-[hsl(210,15%,97%)] rounded-xl px-4 py-3 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Icon name="HomeIcon" size={13} className="text-[#8B1A2B]" />
                          <span className="text-xs font-semibold text-[hsl(215,25%,18%)]">
                            {selectedProperty.unit}, {selectedProperty.building}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[hsl(215,15%,52%)]">
                          <span>Tenant: <strong className="text-[hsl(215,25%,18%)]">{selectedProperty.tenant?.name ?? '—'}</strong></span>
                          <span>Rent: <strong className="text-[hsl(215,25%,18%)]">{formatCurrency(selectedProperty.monthlyRent ?? null)}/mo</strong></span>
                          <span>Lease start: <strong className="text-[hsl(215,25%,18%)]">{formatDate(selectedProperty.tenant?.leaseStart ?? '')}</strong></span>
                          <span>Lease end: <strong className="text-[hsl(215,25%,18%)]">{formatDate(selectedProperty.tenant?.leaseEnd ?? '')}</strong></span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actual End Date */}
                  <div>
                    <label className="block text-xs font-semibold text-[hsl(215,25%,18%)] mb-1.5 uppercase tracking-wide">
                      Actual Handover Date <span className="text-[#8B1A2B]">*</span>
                    </label>
                    <input
                      type="date"
                      value={form.actualEndDate}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, actualEndDate: e.target.value }));
                        setErrors((er) => ({ ...er, actualEndDate: undefined }));
                      }}
                      className={`w-full px-3 py-2.5 rounded-xl border text-sm bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/30 transition-colors ${
                        errors.actualEndDate ? 'border-red-400' : 'border-[hsl(214,20%,88%)]'
                      }`}
                    />
                    {errors.actualEndDate && (
                      <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                        <Icon name="AlertCircleIcon" size={11} /> {errors.actualEndDate}
                      </p>
                    )}

                    {/* Checklist */}
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-semibold text-[hsl(215,25%,18%)] uppercase tracking-wide mb-2">
                        Handover Checklist
                      </p>
                      <ChecklistItem
                        checked={form.depositReturned}
                        onChange={(v) => setForm((f) => ({ ...f, depositReturned: v }))}
                        label="Deposit returned to tenant"
                        icon="BanknoteIcon"
                      />
                      <ChecklistItem
                        checked={form.keysReturned}
                        onChange={(v) => setForm((f) => ({ ...f, keysReturned: v }))}
                        label="Keys returned by tenant"
                        icon="KeyIcon"
                      />
                      <ChecklistItem
                        checked={form.utilitiesSettled}
                        onChange={(v) => setForm((f) => ({ ...f, utilitiesSettled: v }))}
                        label="Utilities & bills settled"
                        icon="ZapIcon"
                      />
                    </div>
                  </div>
                </div>

                {/* Handover Notes */}
                <div>
                  <label className="block text-xs font-semibold text-[hsl(215,25%,18%)] mb-1.5 uppercase tracking-wide">
                    Handover Notes <span className="text-[#8B1A2B]">*</span>
                  </label>
                  <textarea
                    rows={5}
                    value={form.handoverNotes}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, handoverNotes: e.target.value }));
                      setErrors((er) => ({ ...er, handoverNotes: undefined }));
                    }}
                    placeholder="Record the condition of the property, any outstanding issues, items left behind, meter readings, special agreements, etc."
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm bg-white text-[hsl(215,25%,18%)] placeholder-[hsl(215,15%,65%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/30 transition-colors resize-none ${
                      errors.handoverNotes ? 'border-red-400' : 'border-[hsl(214,20%,88%)]'
                    }`}
                  />
                  {errors.handoverNotes && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                      <Icon name="AlertCircleIcon" size={11} /> {errors.handoverNotes}
                    </p>
                  )}
                </div>

                {/* Submit */}
                <div className="flex items-center justify-between pt-2 border-t border-[hsl(214,20%,92%)]">
                  <div className="flex items-center gap-2">
                    {checklistComplete ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                        <Icon name="CheckCircleIcon" size={13} /> All checklist items complete
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-[hsl(215,15%,52%)]">
                        <Icon name="AlertCircleIcon" size={13} />
                        {[!form.depositReturned, !form.keysReturned, !form.utilitiesSettled].filter(Boolean).length} checklist item(s) pending
                      </span>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#8B1A2B] hover:bg-[#6d1522] text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <Icon name="LoaderIcon" size={14} className="animate-spin" />
                        Archiving…
                      </>
                    ) : (
                      <>
                        <Icon name="ArchiveIcon" size={14} />
                        Close & Archive Tenancy
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </section>

          {/* ── Completed Tenancies Archive ── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center">
                  <Icon name="ArchiveIcon" size={14} className="text-white" />
                </div>
                <h2 className="text-base font-bold text-[hsl(215,25%,18%)]">
                  Completed Tenancies
                  {completed.length > 0 && (
                    <span className="ml-2 text-xs font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                      {completed.length}
                    </span>
                  )}
                </h2>
              </div>
              <div className="relative">
                <Icon name="SearchIcon" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(215,15%,52%)]" />
                <input
                  type="text"
                  placeholder="Search archive…"
                  value={archiveSearch}
                  onChange={(e) => setArchiveSearch(e.target.value)}
                  className="pl-8 pr-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-xl bg-white text-[hsl(215,25%,18%)] placeholder-[hsl(215,15%,65%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 w-52"
                />
              </div>
            </div>

            {loadingCompleted ? (
              <div className="bg-white border border-[hsl(214,20%,88%)] rounded-2xl p-10 flex items-center justify-center gap-3 text-[hsl(215,15%,52%)]">
                <Icon name="LoaderIcon" size={18} className="animate-spin" />
                <span className="text-sm">Loading archive…</span>
              </div>
            ) : filteredCompleted.length === 0 ? (
              <div className="bg-white border border-[hsl(214,20%,88%)] rounded-2xl p-10 text-center">
                <Icon name="ArchiveIcon" size={32} className="text-[hsl(215,15%,75%)] mx-auto mb-3" />
                <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">
                  {archiveSearch ? 'No results found' : 'No completed tenancies yet'}
                </p>
                <p className="text-xs text-[hsl(215,15%,52%)] mt-1">
                  {archiveSearch ? 'Try a different search term.' : 'Closed tenancies will appear here once archived.'}
                </p>
              </div>
            ) : (
              <div className="bg-white border border-[hsl(214,20%,88%)] rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[hsl(214,20%,92%)] bg-[hsl(210,15%,97%)]">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Property</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Tenant</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Lease Period</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Handover Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Checklist</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Agent</th>
                      <th className="px-4 py-3 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompleted.map((c, idx) => {
                      const isExpanded = expandedId === c.id;
                      const checkCount = [c.deposit_returned, c.keys_returned, c.utilities_settled].filter(Boolean).length;
                      return (
                        <React.Fragment key={c.id}>
                          <tr
                            className={`border-b border-[hsl(214,20%,92%)] hover:bg-[hsl(210,15%,98%)] transition-colors ${
                              idx % 2 === 0 ? '' : 'bg-[hsl(210,15%,99%)]'
                            }`}
                          >
                            <td className="px-4 py-3">
                              <p className="font-semibold text-[hsl(215,25%,18%)]">{c.property_address}</p>
                              <p className="text-xs text-[hsl(215,15%,52%)]">{c.property_ref}</p>
                            </td>
                            <td className="px-4 py-3 text-[hsl(215,25%,18%)]">{c.tenant_name}</td>
                            <td className="px-4 py-3 text-[hsl(215,15%,52%)] text-xs">
                              <span>{formatDate(c.lease_start ?? '')}</span>
                              <span className="mx-1">→</span>
                              <span>{formatDate(c.lease_end ?? '')}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                                <Icon name="CheckCircleIcon" size={11} />
                                {formatDate(c.actual_end_date)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                {[
                                  { done: c.deposit_returned, title: 'Deposit' },
                                  { done: c.keys_returned, title: 'Keys' },
                                  { done: c.utilities_settled, title: 'Utilities' },
                                ].map((item) => (
                                  <span
                                    key={item.title}
                                    title={item.title}
                                    className={`w-5 h-5 rounded-full flex items-center justify-center ${
                                      item.done ? 'bg-emerald-100 text-emerald-600' : 'bg-[hsl(214,20%,92%)] text-[hsl(215,15%,65%)]'
                                    }`}
                                  >
                                    <Icon name="CheckIcon" size={10} />
                                  </span>
                                ))}
                                <span className="ml-1 text-xs text-[hsl(215,15%,52%)]">{checkCount}/3</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-[hsl(215,15%,52%)]">{c.agent_name ?? '—'}</td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => setExpandedId(isExpanded ? null : c.id)}
                                className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,93%)] transition-colors"
                                aria-label={isExpanded ? 'Collapse' : 'Expand'}
                              >
                                <Icon
                                  name={isExpanded ? 'ChevronUpIcon' : 'ChevronDownIcon'}
                                  size={14}
                                  className="text-[hsl(215,15%,52%)]"
                                />
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="border-b border-[hsl(214,20%,92%)] bg-[hsl(210,15%,97%)]">
                              <td colSpan={7} className="px-6 py-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div className="md:col-span-2">
                                    <p className="text-xs font-semibold text-[hsl(215,25%,18%)] uppercase tracking-wide mb-2">
                                      Handover Notes
                                    </p>
                                    <p className="text-sm text-[hsl(215,15%,40%)] leading-relaxed whitespace-pre-wrap bg-white border border-[hsl(214,20%,88%)] rounded-xl px-4 py-3">
                                      {c.handover_notes || <span className="italic text-[hsl(215,15%,65%)]">No notes recorded.</span>}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-[hsl(215,25%,18%)] uppercase tracking-wide mb-2">
                                      Details
                                    </p>
                                    <div className="space-y-1.5 text-xs text-[hsl(215,15%,52%)]">
                                      <div className="flex justify-between">
                                        <span>Monthly Rent</span>
                                        <span className="font-semibold text-[hsl(215,25%,18%)]">{formatCurrency(c.monthly_rent)}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Landlord</span>
                                        <span className="font-semibold text-[hsl(215,25%,18%)]">{c.landlord_name ?? '—'}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Archived</span>
                                        <span className="font-semibold text-[hsl(215,25%,18%)]">{formatDate(c.archived_at)}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Deposit returned</span>
                                        <span className={c.deposit_returned ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'}>
                                          {c.deposit_returned ? 'Yes' : 'No'}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Keys returned</span>
                                        <span className={c.keys_returned ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'}>
                                          {c.keys_returned ? 'Yes' : 'No'}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Utilities settled</span>
                                        <span className={c.utilities_settled ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'}>
                                          {c.utilities_settled ? 'Yes' : 'No'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
