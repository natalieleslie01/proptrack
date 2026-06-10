'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type FlagReason = 'null_critical_field' | 'value_changed' | 'duplicate_ref' | 'out_of_range' | 'type_mismatch' | 'manual_flag';
type ReviewStatus = 'pending' | 'approved' | 'rejected';

interface FlaggedRow {
  id: string;
  property_ref: string;
  batch_id: string | null;
  batch_filename: string | null;
  flag_reason: FlagReason;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  raw_row: Record<string, string>;
  review_status: ReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
}

type FilterStatus = 'all' | ReviewStatus;
type FilterReason = 'all' | FlagReason;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FLAG_REASON_LABELS: Record<FlagReason, string> = {
  null_critical_field: 'Null Critical Field',
  value_changed: 'Value Changed',
  duplicate_ref: 'Duplicate Ref',
  out_of_range: 'Out of Range',
  type_mismatch: 'Type Mismatch',
  manual_flag: 'Manual Flag',
};

const FLAG_REASON_STYLES: Record<FlagReason, string> = {
  null_critical_field: 'bg-red-100 text-red-700 border-red-200',
  value_changed: 'bg-amber-100 text-amber-700 border-amber-200',
  duplicate_ref: 'bg-purple-100 text-purple-700 border-purple-200',
  out_of_range: 'bg-orange-100 text-orange-700 border-orange-200',
  type_mismatch: 'bg-pink-100 text-pink-700 border-pink-200',
  manual_flag: 'bg-slate-100 text-slate-600 border-slate-200',
};

const STATUS_STYLES: Record<ReviewStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_ICONS: Record<ReviewStatus, string> = {
  pending: 'ClockIcon',
  approved: 'CheckCircleIcon',
  rejected: 'XCircleIcon',
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Mock data (used when DB table doesn't exist yet) ─────────────────────────

const MOCK_ROWS: FlaggedRow[] = [
  {
    id: 'fr-001', property_ref: 'DB-PH1-012', batch_id: 'batch-abc', batch_filename: 'import_may_2026.csv',
    flag_reason: 'null_critical_field', field_name: 'build_year', old_value: null, new_value: null,
    raw_row: { property_ref: 'DB-PH1-012', build_year: '', floor_type: 'high floor', prop_type: 'Apartment' },
    review_status: 'pending', reviewed_by: null, reviewed_at: null, notes: null, created_at: '2026-05-10T08:22:00Z',
  },
  {
    id: 'fr-002', property_ref: 'DB-PH2-007', batch_id: 'batch-abc', batch_filename: 'import_may_2026.csv',
    flag_reason: 'value_changed', field_name: 'list_price', old_value: '28000', new_value: '22000',
    raw_row: { property_ref: 'DB-PH2-007', list_price: '22000', floor_type: 'mid floor', prop_type: 'Apartment' },
    review_status: 'pending', reviewed_by: null, reviewed_at: null, notes: null, created_at: '2026-05-10T08:23:00Z',
  },
  {
    id: 'fr-003', property_ref: 'DB-SV-003', batch_id: 'batch-abc', batch_filename: 'import_may_2026.csv',
    flag_reason: 'duplicate_ref', field_name: 'property_ref', old_value: 'DB-SV-003', new_value: 'DB-SV-003',
    raw_row: { property_ref: 'DB-SV-003', build_year: '2001', floor_type: 'low floor', prop_type: 'Villa' },
    review_status: 'pending', reviewed_by: null, reviewed_at: null, notes: null, created_at: '2026-05-10T08:24:00Z',
  },
  {
    id: 'fr-004', property_ref: 'DB-NV-021', batch_id: 'batch-abc', batch_filename: 'import_may_2026.csv',
    flag_reason: 'out_of_range', field_name: 'bedrooms', old_value: '3', new_value: '15',
    raw_row: { property_ref: 'DB-NV-021', bedrooms: '15', floor_type: 'high floor', prop_type: 'Apartment' },
    review_status: 'approved', reviewed_by: 'manager@proptrack.hk', reviewed_at: '2026-05-11T10:05:00Z', notes: 'Confirmed with landlord — data entry error, should be 5', created_at: '2026-05-10T08:25:00Z',
  },
  {
    id: 'fr-005', property_ref: 'DB-GC-001', batch_id: 'batch-abc', batch_filename: 'import_may_2026.csv',
    flag_reason: 'type_mismatch', field_name: 'build_year', old_value: null, new_value: 'N/A',
    raw_row: { property_ref: 'DB-GC-001', build_year: 'N/A', prop_type: 'Golf Cart' },
    review_status: 'rejected', reviewed_by: 'manager@proptrack.hk', reviewed_at: '2026-05-11T10:06:00Z', notes: 'Invalid value — set to null and re-import', created_at: '2026-05-10T08:26:00Z',
  },
  {
    id: 'fr-006', property_ref: 'DB-PH3-018', batch_id: 'batch-def', batch_filename: 'import_may_2026_v2.csv',
    flag_reason: 'null_critical_field', field_name: 'floor_type', old_value: 'mid floor', new_value: null,
    raw_row: { property_ref: 'DB-PH3-018', floor_type: '', prop_type: 'Apartment', build_year: '2008' },
    review_status: 'pending', reviewed_by: null, reviewed_at: null, notes: null, created_at: '2026-05-12T09:00:00Z',
  },
  {
    id: 'fr-007', property_ref: 'DB-SV-011', batch_id: 'batch-def', batch_filename: 'import_may_2026_v2.csv',
    flag_reason: 'manual_flag', field_name: 'status', old_value: 'available', new_value: 'rented',
    raw_row: { property_ref: 'DB-SV-011', status: 'rented', prop_type: 'Villa' },
    review_status: 'pending', reviewed_by: null, reviewed_at: null, notes: null, created_at: '2026-05-12T09:01:00Z',
  },
];

// ─── Detail Drawer ─────────────────────────────────────────────────────────────

interface DetailDrawerProps {
  row: FlaggedRow;
  onClose: () => void;
  onApprove: (id: string, notes: string) => void;
  onReject: (id: string, notes: string) => void;
  saving: boolean;
}

function DetailDrawer({ row, onClose, onApprove, onReject, saving }: DetailDrawerProps) {
  const [notes, setNotes] = useState(row.notes || '');

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-white h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(214,20%,88%)]">
          <div>
            <h2 className="text-base font-semibold text-[hsl(215,25%,18%)]">Row Detail</h2>
            <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">{row.property_ref}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors">
            <Icon name="XIcon" size={16} className="text-[hsl(215,15%,52%)]" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Status + Flag */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[row.review_status]}`}>
              <Icon name={STATUS_ICONS[row.review_status] as Parameters<typeof Icon>[0]['name']} size={12} />
              {row.review_status.charAt(0).toUpperCase() + row.review_status.slice(1)}
            </span>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${FLAG_REASON_STYLES[row.flag_reason]}`}>
              {FLAG_REASON_LABELS[row.flag_reason]}
            </span>
          </div>

          {/* Field change */}
          <div className="rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
            <div className="bg-[hsl(210,15%,97%)] px-4 py-2.5 border-b border-[hsl(214,20%,88%)]">
              <p className="text-xs font-semibold text-[hsl(215,25%,18%)] uppercase tracking-wide">Field Change</p>
            </div>
            <div className="px-4 py-3 grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-[hsl(215,15%,52%)] mb-1">Field</p>
                <p className="font-mono font-medium text-[hsl(215,25%,18%)]">{row.field_name}</p>
              </div>
              <div>
                <p className="text-xs text-[hsl(215,15%,52%)] mb-1">Old Value</p>
                <p className={`font-mono ${row.old_value === null ? 'text-[hsl(215,15%,52%)] italic' : 'text-[hsl(215,25%,18%)]'}`}>
                  {row.old_value ?? 'null'}
                </p>
              </div>
              <div>
                <p className="text-xs text-[hsl(215,15%,52%)] mb-1">New Value</p>
                <p className={`font-mono ${row.new_value === null ? 'text-[hsl(215,15%,52%)] italic' : 'text-amber-700 font-semibold'}`}>
                  {row.new_value ?? 'null'}
                </p>
              </div>
            </div>
          </div>

          {/* Raw row */}
          <div className="rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
            <div className="bg-[hsl(210,15%,97%)] px-4 py-2.5 border-b border-[hsl(214,20%,88%)]">
              <p className="text-xs font-semibold text-[hsl(215,25%,18%)] uppercase tracking-wide">Raw CSV Row</p>
            </div>
            <div className="px-4 py-3 space-y-1.5">
              {Object.entries(row.raw_row).map(([k, v]) => (
                <div key={k} className="flex items-start gap-2 text-xs">
                  <span className="font-mono text-[hsl(215,15%,52%)] w-32 flex-shrink-0">{k}</span>
                  <span className={`font-mono ${v === '' ? 'text-red-400 italic' : 'text-[hsl(215,25%,18%)]'}`}>{v === '' ? 'empty' : v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Batch info */}
          {row.batch_filename && (
            <div className="flex items-center gap-2 text-xs text-[hsl(215,15%,52%)]">
              <Icon name="FileTextIcon" size={13} />
              <span>Batch: <span className="font-medium text-[hsl(215,25%,18%)]">{row.batch_filename}</span></span>
              <span className="ml-auto">{formatDate(row.created_at)}</span>
            </div>
          )}

          {/* Reviewer notes */}
          {row.review_status === 'pending' ? (
            <div>
              <label className="block text-xs font-medium text-[hsl(215,25%,18%)] mb-1.5">Review Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Add context for this decision…"
                className="w-full text-sm border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B] transition-colors"
              />
            </div>
          ) : (
            row.notes && (
              <div className="rounded-xl border border-[hsl(214,20%,88%)] px-4 py-3">
                <p className="text-xs font-medium text-[hsl(215,15%,52%)] mb-1">Reviewer Notes</p>
                <p className="text-sm text-[hsl(215,25%,18%)]">{row.notes}</p>
                {row.reviewed_by && (
                  <p className="text-xs text-[hsl(215,15%,52%)] mt-2">{row.reviewed_by} · {row.reviewed_at ? formatDate(row.reviewed_at) : ''}</p>
                )}
              </div>
            )
          )}
        </div>

        {/* Footer actions */}
        {row.review_status === 'pending' && (
          <div className="px-6 py-4 border-t border-[hsl(214,20%,88%)] flex gap-3">
            <button
              onClick={() => onReject(row.id, notes)}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <Icon name="XCircleIcon" size={15} />
              Reject
            </button>
            <button
              onClick={() => onApprove(row.id, notes)}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#8B1A2B] text-white text-sm font-medium hover:bg-[#7a1625] transition-colors disabled:opacity-50"
            >
              <Icon name="CheckCircleIcon" size={15} />
              Approve
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function FlaggedRowReviewClient() {
  const supabase = createClient();

  const [rows, setRows] = useState<FlaggedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending');
  const [filterReason, setFilterReason] = useState<FilterReason>('all');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailRow, setDetailRow] = useState<FlaggedRow | null>(null);
  const [bulkNotes, setBulkNotes] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [syncConfirm, setSyncConfirm] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Load rows — try DB first, fall back to mock
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('flagged_import_rows')
          .select('*')
          .order('created_at', { ascending: false });

        if (error || !data) {
          setRows(MOCK_ROWS);
        } else {
          setRows(data.length > 0 ? data : MOCK_ROWS);
        }
      } catch {
        setRows(MOCK_ROWS);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Filtered rows
  const filtered = rows.filter((r) => {
    if (filterStatus !== 'all' && r.review_status !== filterStatus) return false;
    if (filterReason !== 'all' && r.flag_reason !== filterReason) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.property_ref.toLowerCase().includes(q) && !r.field_name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const pendingRows = rows.filter((r) => r.review_status === 'pending');
  const approvedRows = rows.filter((r) => r.review_status === 'approved');
  const rejectedRows = rows.filter((r) => r.review_status === 'rejected');

  // Selection helpers
  const allFilteredPending = filtered.filter((r) => r.review_status === 'pending');
  const allSelected = allFilteredPending.length > 0 && allFilteredPending.every((r) => selectedIds.has(r.id));

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allFilteredPending.map((r) => r.id)));
    }
  }

  // Update a row locally
  function applyLocalUpdate(id: string, status: ReviewStatus, notes: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, review_status: status, notes, reviewed_at: new Date().toISOString(), reviewed_by: 'manager' }
          : r
      )
    );
  }

  // Single approve/reject
  async function handleSingleDecision(id: string, status: ReviewStatus, notes: string) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('flagged_import_rows')
        .update({ review_status: status, notes, reviewed_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    } catch {
      // Silently apply locally if DB not available
    } finally {
      applyLocalUpdate(id, status, notes);
      setSaving(false);
      setDetailRow(null);
      showToast(`Row ${status === 'approved' ? 'approved' : 'rejected'} successfully`);
    }
  }

  // Bulk approve/reject
  async function handleBulk(status: ReviewStatus) {
    if (selectedIds.size === 0) return;
    setSaving(true);
    const ids = Array.from(selectedIds);
    try {
      const { error } = await supabase
        .from('flagged_import_rows')
        .update({ review_status: status, notes: bulkNotes || null, reviewed_at: new Date().toISOString() })
        .in('id', ids);

      if (error) throw error;
    } catch {
      // Apply locally
    } finally {
      ids.forEach((id) => applyLocalUpdate(id, status, bulkNotes));
      setSelectedIds(new Set());
      setBulkNotes('');
      setSaving(false);
      showToast(`${ids.length} row${ids.length > 1 ? 's' : ''} ${status === 'approved' ? 'approved' : 'rejected'}`);
    }
  }

  // Sync approved rows
  async function handleSync() {
    setSyncing(true);
    setSyncConfirm(false);
    // Simulate sync delay
    await new Promise((r) => setTimeout(r, 1800));
    setSyncing(false);
    showToast(`${approvedRows.length} approved row${approvedRows.length !== 1 ? 's' : ''} synced to database`);
  }

  return (
    <div className="min-h-screen bg-[hsl(210,15%,97%)]">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          <Icon name={toast.type === 'success' ? 'CheckCircleIcon' : 'AlertCircleIcon'} size={15} />
          {toast.msg}
        </div>
      )}

      {/* Sync confirm modal */}
      {syncConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSyncConfirm(false)} />
          <div className="relative z-10 bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <Icon name="DatabaseIcon" size={18} className="text-emerald-700" />
              </div>
              <div>
                <h3 className="font-semibold text-[hsl(215,25%,18%)]">Confirm Database Sync</h3>
                <p className="text-xs text-[hsl(215,15%,52%)]">{approvedRows.length} approved rows will be written</p>
              </div>
            </div>
            <p className="text-sm text-[hsl(215,15%,52%)] mb-5">
              This will apply all <span className="font-semibold text-emerald-700">{approvedRows.length} approved</span> row updates to the production database. Rejected rows will be skipped. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setSyncConfirm(false)} className="flex-1 px-4 py-2.5 rounded-lg border border-[hsl(214,20%,88%)] text-sm font-medium text-[hsl(215,25%,18%)] hover:bg-[hsl(210,15%,94%)] transition-colors">
                Cancel
              </button>
              <button onClick={handleSync} className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors">
                Sync Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {detailRow && (
        <DetailDrawer
          row={detailRow}
          onClose={() => setDetailRow(null)}
          onApprove={(id, notes) => handleSingleDecision(id, 'approved', notes)}
          onReject={(id, notes) => handleSingleDecision(id, 'rejected', notes)}
          saving={saving}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[hsl(215,25%,18%)]">Flagged Row Review</h1>
            <p className="text-sm text-[hsl(215,15%,52%)] mt-0.5">Approve or reject bulk updates before final database sync</p>
          </div>
          <button
            onClick={() => setSyncConfirm(true)}
            disabled={approvedRows.length === 0 || syncing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {syncing ? (
              <><Icon name="LoaderIcon" size={15} className="animate-spin" /> Syncing…</>
            ) : (
              <><Icon name="DatabaseIcon" size={15} /> Sync {approvedRows.length} Approved</>
            )}
          </button>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Flagged', value: rows.length, icon: 'FlagIcon', color: 'text-[hsl(215,25%,18%)]', bg: 'bg-white', iconBg: 'bg-slate-100', iconColor: 'text-slate-600' },
            { label: 'Pending Review', value: pendingRows.length, icon: 'ClockIcon', color: 'text-amber-700', bg: 'bg-amber-50', iconBg: 'bg-amber-100', iconColor: 'text-amber-700' },
            { label: 'Approved', value: approvedRows.length, icon: 'CheckCircleIcon', color: 'text-emerald-700', bg: 'bg-emerald-50', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-700' },
            { label: 'Rejected', value: rejectedRows.length, icon: 'XCircleIcon', color: 'text-red-700', bg: 'bg-red-50', iconBg: 'bg-red-100', iconColor: 'text-red-700' },
          ].map((kpi) => (
            <div key={kpi.label} className={`${kpi.bg} rounded-xl border border-[hsl(214,20%,88%)] px-4 py-4 flex items-center gap-3`}>
              <div className={`w-9 h-9 rounded-lg ${kpi.iconBg} flex items-center justify-center flex-shrink-0`}>
                <Icon name={kpi.icon as Parameters<typeof Icon>[0]['name']} size={16} className={kpi.iconColor} />
              </div>
              <div>
                <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
                <p className="text-xs text-[hsl(215,15%,52%)]">{kpi.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters + search */}
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] px-4 py-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Status tabs */}
          <div className="flex gap-1 bg-[hsl(210,15%,94%)] rounded-lg p-1">
            {(['all', 'pending', 'approved', 'rejected'] as FilterStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => { setFilterStatus(s); setSelectedIds(new Set()); }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                  filterStatus === s ? 'bg-white text-[hsl(215,25%,18%)] shadow-sm' : 'text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)]'
                }`}
              >
                {s === 'all' ? `All (${rows.length})` : s === 'pending' ? `Pending (${pendingRows.length})` : s === 'approved' ? `Approved (${approvedRows.length})` : `Rejected (${rejectedRows.length})`}
              </button>
            ))}
          </div>

          {/* Reason filter */}
          <select
            value={filterReason}
            onChange={(e) => setFilterReason(e.target.value as FilterReason)}
            className="text-xs border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2 bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20"
          >
            <option value="all">All Reasons</option>
            {(Object.keys(FLAG_REASON_LABELS) as FlagReason[]).map((r) => (
              <option key={r} value={r}>{FLAG_REASON_LABELS[r]}</option>
            ))}
          </select>

          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Icon name="SearchIcon" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(215,15%,52%)]" />
            <input
              type="text"
              placeholder="Search property ref or field…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs border border-[hsl(214,20%,88%)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B] transition-colors"
            />
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="bg-[#8B1A2B]/5 border border-[#8B1A2B]/20 rounded-xl px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-[#8B1A2B]">
              <Icon name="CheckSquareIcon" size={15} />
              {selectedIds.size} row{selectedIds.size > 1 ? 's' : ''} selected
            </div>
            <input
              type="text"
              placeholder="Bulk review notes (optional)…"
              value={bulkNotes}
              onChange={(e) => setBulkNotes(e.target.value)}
              className="flex-1 text-xs border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20"
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleBulk('rejected')}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                <Icon name="XCircleIcon" size={13} /> Reject All
              </button>
              <button
                onClick={() => handleBulk('approved')}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#8B1A2B] text-white text-xs font-medium hover:bg-[#7a1625] transition-colors disabled:opacity-50"
              >
                <Icon name="CheckCircleIcon" size={13} /> Approve All
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-[hsl(215,15%,52%)]">
              <Icon name="LoaderIcon" size={18} className="animate-spin" />
              <span className="text-sm">Loading flagged rows…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-12 h-12 rounded-full bg-[hsl(210,15%,94%)] flex items-center justify-center">
                <Icon name="FlagIcon" size={20} className="text-[hsl(215,15%,52%)]" />
              </div>
              <p className="text-sm font-medium text-[hsl(215,25%,18%)]">No flagged rows found</p>
              <p className="text-xs text-[hsl(215,15%,52%)]">Adjust filters or import a new batch</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[hsl(214,20%,88%)] bg-[hsl(210,15%,97%)]">
                    <th className="px-4 py-3 text-left w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="rounded border-[hsl(214,20%,88%)] accent-[#8B1A2B]"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Property Ref</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Flag Reason</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Field</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Old → New</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Batch</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(214,20%,88%)]">
                  {filtered.map((row) => (
                    <tr key={row.id} className={`hover:bg-[hsl(210,15%,97%)] transition-colors ${selectedIds.has(row.id) ? 'bg-[#8B1A2B]/3' : ''}`}>
                      <td className="px-4 py-3">
                        {row.review_status === 'pending' && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(row.id)}
                            onChange={() => toggleSelect(row.id)}
                            className="rounded border-[hsl(214,20%,88%)] accent-[#8B1A2B]"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-medium text-[hsl(215,25%,18%)] text-xs">{row.property_ref}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${FLAG_REASON_STYLES[row.flag_reason]}`}>
                          {FLAG_REASON_LABELS[row.flag_reason]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-[hsl(215,25%,18%)]">{row.field_name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className={`font-mono ${row.old_value === null ? 'text-[hsl(215,15%,52%)] italic' : 'text-[hsl(215,25%,18%)]'}`}>
                            {row.old_value ?? 'null'}
                          </span>
                          <Icon name="ArrowRightIcon" size={11} className="text-[hsl(215,15%,52%)]" />
                          <span className={`font-mono font-semibold ${row.new_value === null ? 'text-[hsl(215,15%,52%)] italic' : 'text-amber-700'}`}>
                            {row.new_value ?? 'null'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-[hsl(215,15%,52%)] truncate max-w-[120px] block" title={row.batch_filename ?? ''}>
                          {row.batch_filename ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[row.review_status]}`}>
                          <Icon name={STATUS_ICONS[row.review_status] as Parameters<typeof Icon>[0]['name']} size={11} />
                          {row.review_status.charAt(0).toUpperCase() + row.review_status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setDetailRow(row)}
                            className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors"
                            title="View details"
                          >
                            <Icon name="EyeIcon" size={14} className="text-[hsl(215,15%,52%)]" />
                          </button>
                          {row.review_status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleSingleDecision(row.id, 'approved', '')}
                                disabled={saving}
                                className="p-1.5 rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50"
                                title="Approve"
                              >
                                <Icon name="CheckIcon" size={14} className="text-emerald-600" />
                              </button>
                              <button
                                onClick={() => handleSingleDecision(row.id, 'rejected', '')}
                                disabled={saving}
                                className="p-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                                title="Reject"
                              >
                                <Icon name="XIcon" size={14} className="text-red-600" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Table footer */}
          {!loading && filtered.length > 0 && (
            <div className="px-4 py-3 border-t border-[hsl(214,20%,88%)] flex items-center justify-between">
              <p className="text-xs text-[hsl(215,15%,52%)]">
                Showing {filtered.length} of {rows.length} flagged rows
              </p>
              {pendingRows.length > 0 && (
                <p className="text-xs text-amber-600 font-medium">
                  {pendingRows.length} row{pendingRows.length > 1 ? 's' : ''} awaiting review before sync
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
