'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import AppLayout from '@/components/AppLayout';
import { createClient } from '@/lib/supabase/client';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TenancyRecord {
  id: string;
  propertyRef: string;
  unit: string | null;
  block: string | null;
  phase: string | null;
  village: string;
  address: string | null;
  district: string;
  tenantName: string;
  leaseStart: string | null;
  leaseEnd: string | null;
  monthlyRent: number | null;
  deposit: number | null;
  occupancy: string;
  daysUntilExpiry: number | null;
  leaseStatus: 'active' | 'expiring-soon' | 'expired' | 'pending';
  renewalStatus: RenewalStatus | null;
  renewalId: string | null;
  renewalNotes: string | null;
  proposedRent: number | null;
  agreedRent: number | null;
}

type RenewalStatus = 'pending' | 'negotiating' | 'agreed' | 'documents_sent' | 'signed' | 'declined';

type LeaseStatusFilter = 'all' | 'active' | 'expiring-soon' | 'expired' | 'pending';
type ExpiryFilter = 'all' | '30' | '60' | '90';

const RENEWAL_STATUS_CONFIG: Record<RenewalStatus, { label: string; color: string; bg: string; border: string }> = {
  pending:        { label: 'Pending',       color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  negotiating:    { label: 'Negotiating',   color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  agreed:         { label: 'Agreed',        color: '#059669', bg: '#f0fdf4', border: '#a7f3d0' },
  documents_sent: { label: 'Docs Sent',     color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  signed:         { label: 'Signed',        color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4' },
  declined:       { label: 'Declined',      color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
};

const LEASE_STATUS_CONFIG = {
  'active':        { label: 'Active',         color: '#059669', bg: '#f0fdf4', border: '#a7f3d0' },
  'expiring-soon': { label: 'Expiring Soon',  color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  'expired':       { label: 'Expired',        color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  'pending':       { label: 'No Dates',       color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function parseDateText(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  // Try DD/MM/YYYY
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts.map(Number);
    if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y, m - 1, d);
  }
  // Try ISO
  const iso = new Date(dateStr);
  if (!isNaN(iso.getTime())) return iso;
  return null;
}

function calcDaysUntilExpiry(leaseEnd: string | null): number | null {
  const end = parseDateText(leaseEnd);
  if (!end) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getLeaseStatus(days: number | null): TenancyRecord['leaseStatus'] {
  if (days === null) return 'pending';
  if (days < 0) return 'expired';
  if (days <= 90) return 'expiring-soon';
  return 'active';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return dateStr;
}

function formatCurrency(val: number | null): string {
  if (!val) return '—';
  return `HK$${val.toLocaleString()}`;
}

function deriveDistrict(village: string, phase: string | null): string {
  if (village) return village;
  if (phase) return phase;
  return 'Discovery Bay';
}

// ─── Inline Renewal Panel ──────────────────────────────────────────────────────

interface RenewalPanelProps {
  record: TenancyRecord;
  onSave: (recordId: string, status: RenewalStatus, notes: string, agreedRent: string) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

function RenewalPanel({ record, onSave, onClose, saving }: RenewalPanelProps) {
  const [status, setStatus] = useState<RenewalStatus>(record.renewalStatus ?? 'pending');
  const [notes, setNotes] = useState(record.renewalNotes ?? '');
  const [agreedRent, setAgreedRent] = useState(record.agreedRent?.toString() ?? '');

  return (
    <div className="bg-[hsl(210,20%,97%)] border-t border-[hsl(214,20%,88%)] px-6 py-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[hsl(215,25%,18%)] flex items-center gap-2">
          <Icon name="RefreshCwIcon" size={14} className="text-[#8B1A2B]" />
          Lease Renewal Workflow — {record.tenantName}
        </h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-[hsl(214,20%,88%)] transition-colors">
          <Icon name="XIcon" size={14} className="text-[hsl(215,15%,52%)]" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Status */}
        <div>
          <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] mb-1.5 uppercase tracking-wide">
            Renewal Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as RenewalStatus)}
            className="w-full text-sm border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2 bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/30"
          >
            {(Object.keys(RENEWAL_STATUS_CONFIG) as RenewalStatus[]).map((s) => (
              <option key={s} value={s}>{RENEWAL_STATUS_CONFIG[s].label}</option>
            ))}
          </select>
        </div>

        {/* Agreed Rent */}
        <div>
          <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] mb-1.5 uppercase tracking-wide">
            Agreed New Rent (HKD)
          </label>
          <input
            type="number"
            value={agreedRent}
            onChange={(e) => setAgreedRent(e.target.value)}
            placeholder={record.monthlyRent?.toString() ?? 'Enter amount'}
            className="w-full text-sm border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2 bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/30"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] mb-1.5 uppercase tracking-wide">
            Notes
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Renewal notes..."
            className="w-full text-sm border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2 bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/30"
          />
        </div>
      </div>

      {/* Info row */}
      <div className="flex items-center gap-4 mt-3 text-xs text-[hsl(215,15%,52%)]">
        <span>Current rent: <strong className="text-[hsl(215,25%,18%)]">{formatCurrency(record.monthlyRent)}</strong></span>
        {record.proposedRent && (
          <span>Proposed: <strong className="text-[hsl(215,25%,18%)]">{formatCurrency(record.proposedRent)}</strong></span>
        )}
        <span>Lease ends: <strong className="text-[hsl(215,25%,18%)]">{formatDate(record.leaseEnd)}</strong></span>
        {record.daysUntilExpiry !== null && (
          <span className={record.daysUntilExpiry <= 30 ? 'text-red-600 font-semibold' : ''}>
            {record.daysUntilExpiry < 0 ? `${Math.abs(record.daysUntilExpiry)}d overdue` : `${record.daysUntilExpiry}d remaining`}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={() => onSave(record.id, status, notes, agreedRent)}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#8B1A2B] text-white text-xs font-semibold rounded-lg hover:bg-[#6d1522] transition-colors disabled:opacity-50"
        >
          {saving ? <Icon name="LoaderIcon" size={13} className="animate-spin" /> : <Icon name="SaveIcon" size={13} />}
          {saving ? 'Saving…' : 'Save Renewal'}
        </button>
        <Link
          href="/lease-renewals"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-[hsl(214,20%,88%)] text-[hsl(215,25%,18%)] text-xs font-semibold rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors"
        >
          <Icon name="ExternalLinkIcon" size={13} />
          Full Renewals Screen
        </Link>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function TenancyRecordsClient() {
  const [records, setRecords] = useState<TenancyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('all');
  const [leaseStatusFilter, setLeaseStatusFilter] = useState<LeaseStatusFilter>('all');
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>('all');

  // Inline renewal
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch leased properties
      const { data: props, error: propErr } = await supabase
        .from('properties')
        .select('id, property_ref, unit, block, phase, village, address, tenant_name, lease_start, lease_end, asking_rent, management_fee, occupancy')
        .in('occupancy', ['leased', 'with-ta'])
        .not('tenant_name', 'is', null)
        .order('lease_end', { ascending: true })
        .limit(500);

      if (propErr) throw propErr;

      // Fetch existing renewal records
      const { data: renewals } = await supabase
        .from('lease_renewals')
        .select('id, property_ref, status, notes, agreed_new_rent, proposed_new_rent');

      const renewalMap = new Map<string, { id: string; status: RenewalStatus; notes: string | null; agreedRent: number | null; proposedRent: number | null }>();
      (renewals ?? []).forEach((r) => {
        renewalMap.set(r.property_ref, {
          id: r.id,
          status: r.status as RenewalStatus,
          notes: r.notes,
          agreedRent: r.agreed_new_rent,
          proposedRent: r.proposed_new_rent,
        });
      });

      const mapped: TenancyRecord[] = (props ?? []).map((p) => {
        const days = calcDaysUntilExpiry(p.lease_end);
        const renewal = renewalMap.get(p.property_ref);
        return {
          id: p.id,
          propertyRef: p.property_ref,
          unit: p.unit,
          block: p.block,
          phase: p.phase,
          village: p.village ?? 'Discovery Bay',
          address: p.address,
          district: deriveDistrict(p.village ?? 'Discovery Bay', p.phase),
          tenantName: p.tenant_name ?? 'Unknown',
          leaseStart: p.lease_start,
          leaseEnd: p.lease_end,
          monthlyRent: p.asking_rent,
          deposit: p.asking_rent ? Math.round(p.asking_rent * 2) : null,
          occupancy: p.occupancy,
          daysUntilExpiry: days,
          leaseStatus: getLeaseStatus(days),
          renewalStatus: renewal?.status ?? null,
          renewalId: renewal?.id ?? null,
          renewalNotes: renewal?.notes ?? null,
          proposedRent: renewal?.proposedRent ?? null,
          agreedRent: renewal?.agreedRent ?? null,
        };
      });

      setRecords(mapped);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load tenancy records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Derived filter options
  const districts = useMemo(() => {
    const set = new Set(records.map((r) => r.district));
    return Array.from(set).sort();
  }, [records]);

  // Filtered records
  const filtered = useMemo(() => {
    let list = [...records];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.tenantName.toLowerCase().includes(q) ||
          r.propertyRef.toLowerCase().includes(q) ||
          (r.unit ?? '').toLowerCase().includes(q) ||
          (r.address ?? '').toLowerCase().includes(q) ||
          r.district.toLowerCase().includes(q)
      );
    }

    if (propertyFilter.trim()) {
      const q = propertyFilter.toLowerCase();
      list = list.filter(
        (r) =>
          r.propertyRef.toLowerCase().includes(q) ||
          (r.unit ?? '').toLowerCase().includes(q) ||
          (r.block ?? '').toLowerCase().includes(q)
      );
    }

    if (districtFilter !== 'all') {
      list = list.filter((r) => r.district === districtFilter);
    }

    if (leaseStatusFilter !== 'all') {
      list = list.filter((r) => r.leaseStatus === leaseStatusFilter);
    }

    if (expiryFilter !== 'all') {
      const days = parseInt(expiryFilter);
      list = list.filter((r) => r.daysUntilExpiry !== null && r.daysUntilExpiry >= 0 && r.daysUntilExpiry <= days);
    }

    return list;
  }, [records, search, propertyFilter, districtFilter, leaseStatusFilter, expiryFilter]);

  // Stats
  const stats = useMemo(() => ({
    total: records.length,
    active: records.filter((r) => r.leaseStatus === 'active').length,
    expiringSoon: records.filter((r) => r.leaseStatus === 'expiring-soon').length,
    expired: records.filter((r) => r.leaseStatus === 'expired').length,
    withRenewal: records.filter((r) => r.renewalStatus !== null).length,
  }), [records]);

  async function handleSaveRenewal(recordId: string, status: RenewalStatus, notes: string, agreedRentStr: string) {
    setSaving(true);
    setSaveMsg(null);
    try {
      const record = records.find((r) => r.id === recordId);
      if (!record) return;

      const agreedRent = agreedRentStr ? parseFloat(agreedRentStr) : null;

      if (record.renewalId) {
        // Update existing
        const { error } = await supabase
          .from('lease_renewals')
          .update({ status, notes, agreed_new_rent: agreedRent, updated_at: new Date().toISOString() })
          .eq('id', record.renewalId);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('lease_renewals')
          .insert({
            property_ref: record.propertyRef,
            property_address: record.address ?? `${record.unit ?? ''} ${record.village}`.trim(),
            tenant_name: record.tenantName,
            current_lease_end: record.leaseEnd ? parseDateText(record.leaseEnd)?.toISOString().split('T')[0] : null,
            proposed_new_rent: record.monthlyRent ? Math.round(record.monthlyRent * 1.05) : null,
            agreed_new_rent: agreedRent,
            status,
            notes,
          });
        if (error) throw error;
      }

      setSaveMsg('Saved successfully');
      setExpandedId(null);
      await fetchData();
    } catch (e: unknown) {
      setSaveMsg(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        {/* ── Header ── */}
        <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-[hsl(214,20%,88%)] bg-white">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h1 className="text-xl font-bold text-[hsl(215,25%,18%)]">Tenancy Records</h1>
              <p className="text-sm text-[hsl(215,15%,52%)] mt-0.5">
                All active tenancies — lease dates, deposits, status, and inline renewal workflows
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchData}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-[hsl(215,15%,52%)] border border-[hsl(214,20%,88%)] rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors"
              >
                <Icon name="RefreshCwIcon" size={14} />
                Refresh
              </button>
              <Link
                href="/lease-renewals"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-[#8B1A2B] rounded-lg hover:bg-[#6d1522] transition-colors font-semibold"
              >
                <Icon name="RefreshCwIcon" size={14} />
                Renewals
              </Link>
            </div>
          </div>

          {/* ── Stats ── */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
            {[
              { label: 'Total Tenancies', value: stats.total, icon: 'FileTextIcon', color: 'text-[hsl(215,25%,18%)]', bg: 'bg-[hsl(210,15%,96%)]' },
              { label: 'Active', value: stats.active, icon: 'CheckCircleIcon', color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Expiring ≤90d', value: stats.expiringSoon, icon: 'ClockIcon', color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Expired', value: stats.expired, icon: 'AlertCircleIcon', color: 'text-red-600', bg: 'bg-red-50' },
              { label: 'With Renewal', value: stats.withRenewal, icon: 'RefreshCwIcon', color: 'text-[#8B1A2B]', bg: 'bg-[#8B1A2B]/6' },
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

        {/* ── Filters ── */}
        <div className="flex-shrink-0 px-6 py-3 border-b border-[hsl(214,20%,88%)] bg-white">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-48">
              <Icon name="SearchIcon" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(215,15%,52%)]" />
              <input
                type="text"
                placeholder="Search tenant, property ref, address…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/30"
              />
            </div>

            {/* Property filter */}
            <div className="relative min-w-40">
              <Icon name="BuildingIcon" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(215,15%,52%)]" />
              <input
                type="text"
                placeholder="Filter by property…"
                value={propertyFilter}
                onChange={(e) => setPropertyFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/30"
              />
            </div>

            {/* District */}
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="text-sm border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2 bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/30"
            >
              <option value="all">All Districts</option>
              {districts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            {/* Lease status */}
            <select
              value={leaseStatusFilter}
              onChange={(e) => setLeaseStatusFilter(e.target.value as LeaseStatusFilter)}
              className="text-sm border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2 bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/30"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="expiring-soon">Expiring Soon</option>
              <option value="expired">Expired</option>
              <option value="pending">No Dates</option>
            </select>

            {/* Expiry date filter */}
            <select
              value={expiryFilter}
              onChange={(e) => setExpiryFilter(e.target.value as ExpiryFilter)}
              className="text-sm border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2 bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/30"
            >
              <option value="all">Any Expiry</option>
              <option value="30">Expiring ≤ 30 days</option>
              <option value="60">Expiring ≤ 60 days</option>
              <option value="90">Expiring ≤ 90 days</option>
            </select>

            {/* Result count */}
            <span className="text-xs text-[hsl(215,15%,52%)] ml-auto whitespace-nowrap">
              {filtered.length} of {records.length} records
            </span>
          </div>
        </div>

        {/* ── Save message ── */}
        {saveMsg && (
          <div className={`mx-6 mt-3 px-4 py-2 rounded-lg text-sm font-medium ${saveMsg.includes('success') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {saveMsg}
          </div>
        )}

        {/* ── Table ── */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Icon name="LoaderIcon" size={24} className="animate-spin text-[#8B1A2B]" />
              <span className="ml-3 text-sm text-[hsl(215,15%,52%)]">Loading tenancy records…</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Icon name="AlertCircleIcon" size={32} className="text-red-400" />
              <p className="text-sm text-red-600">{error}</p>
              <button onClick={fetchData} className="text-sm text-[#8B1A2B] underline">Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Icon name="FileTextIcon" size={32} className="text-[hsl(215,15%,65%)]" />
              <p className="text-sm text-[hsl(215,15%,52%)]">No tenancy records match your filters</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[hsl(210,20%,97%)] border-b border-[hsl(214,20%,88%)]">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Tenant</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Property</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide hidden md:table-cell">District</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide hidden sm:table-cell">Lease Start</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Lease End</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide hidden lg:table-cell">Deposit</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide hidden lg:table-cell">Rent/mo</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide hidden md:table-cell">Renewal</th>
                      <th className="px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[hsl(214,20%,88%)]">
                    {filtered.map((record) => {
                      const lsCfg = LEASE_STATUS_CONFIG[record.leaseStatus];
                      const isExpanded = expandedId === record.id;

                      return (
                        <React.Fragment key={record.id}>
                          <tr className={`hover:bg-[hsl(210,20%,97%)] transition-colors ${isExpanded ? 'bg-[hsl(210,20%,97%)]' : ''}`}>
                            {/* Tenant */}
                            <td className="px-4 py-3">
                              <p className="font-semibold text-[hsl(215,25%,18%)] text-xs">{record.tenantName}</p>
                              <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">{record.propertyRef}</p>
                            </td>

                            {/* Property */}
                            <td className="px-4 py-3">
                              <p className="text-xs font-medium text-[hsl(215,25%,18%)]">
                                {[record.unit, record.block].filter(Boolean).join(', ') || record.address || '—'}
                              </p>
                              <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">{record.village}</p>
                            </td>

                            {/* District */}
                            <td className="px-4 py-3 hidden md:table-cell">
                              <span className="text-xs text-[hsl(215,25%,18%)]">{record.district}</span>
                            </td>

                            {/* Lease Start */}
                            <td className="px-4 py-3 hidden sm:table-cell">
                              <span className="text-xs text-[hsl(215,25%,18%)]">{formatDate(record.leaseStart)}</span>
                            </td>

                            {/* Lease End */}
                            <td className="px-4 py-3">
                              <p className="text-xs text-[hsl(215,25%,18%)]">{formatDate(record.leaseEnd)}</p>
                              {record.daysUntilExpiry !== null && (
                                <p className={`text-xs mt-0.5 font-medium ${
                                  record.daysUntilExpiry < 0 ? 'text-red-500' :
                                  record.daysUntilExpiry <= 30 ? 'text-red-500' :
                                  record.daysUntilExpiry <= 90 ? 'text-amber-500' : 'text-[hsl(215,15%,52%)]'
                                }`}>
                                  {record.daysUntilExpiry < 0
                                    ? `${Math.abs(record.daysUntilExpiry)}d overdue`
                                    : `${record.daysUntilExpiry}d left`}
                                </p>
                              )}
                            </td>

                            {/* Deposit */}
                            <td className="px-4 py-3 hidden lg:table-cell">
                              <span className="text-xs text-[hsl(215,25%,18%)]">{formatCurrency(record.deposit)}</span>
                            </td>

                            {/* Rent */}
                            <td className="px-4 py-3 hidden lg:table-cell">
                              <span className="text-xs font-semibold text-[hsl(215,25%,18%)]">{formatCurrency(record.monthlyRent)}</span>
                            </td>

                            {/* Lease Status */}
                            <td className="px-4 py-3">
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border"
                                style={{ color: lsCfg.color, backgroundColor: lsCfg.bg, borderColor: lsCfg.border }}
                              >
                                {lsCfg.label}
                              </span>
                            </td>

                            {/* Renewal Status */}
                            <td className="px-4 py-3 hidden md:table-cell">
                              {record.renewalStatus ? (
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border"
                                  style={{
                                    color: RENEWAL_STATUS_CONFIG[record.renewalStatus].color,
                                    backgroundColor: RENEWAL_STATUS_CONFIG[record.renewalStatus].bg,
                                    borderColor: RENEWAL_STATUS_CONFIG[record.renewalStatus].border,
                                  }}
                                >
                                  {RENEWAL_STATUS_CONFIG[record.renewalStatus].label}
                                </span>
                              ) : (
                                <span className="text-xs text-[hsl(215,15%,65%)]">—</span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => setExpandedId(isExpanded ? null : record.id)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                  isExpanded
                                    ? 'bg-[#8B1A2B] text-white'
                                    : 'bg-[#8B1A2B]/8 text-[#8B1A2B] hover:bg-[#8B1A2B]/15 border border-[#8B1A2B]/20'
                                }`}
                                title="Manage lease renewal"
                              >
                                <Icon name="RefreshCwIcon" size={11} />
                                <span className="hidden sm:inline">Renew</span>
                              </button>
                            </td>
                          </tr>

                          {/* Inline Renewal Panel */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={10} className="p-0">
                                <RenewalPanel
                                  record={record}
                                  onSave={handleSaveRenewal}
                                  onClose={() => setExpandedId(null)}
                                  saving={saving}
                                />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
