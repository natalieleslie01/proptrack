'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type ImportType = 'csv' | 'photo';
type ImportStatus = 'completed' | 'partial' | 'failed' | 'rolled_back';

interface ImportError {
  row?: number;
  field?: string;
  message: string;
}

interface ImportRecord {
  id: string;
  import_type: ImportType;
  filename: string;
  status: ImportStatus;
  total_records: number;
  success_count: number;
  skipped_count: number;
  error_count: number;
  errors: ImportError[];
  imported_at: string;
  imported_by: string;
  rolled_back_at?: string;
  rolled_back_by?: string;
  notes?: string;
}

// ─── Mock data (used when no DB table exists yet) ─────────────────────────────

const MOCK_IMPORTS: ImportRecord[] = [
  {
    id: 'imp-001',
    import_type: 'csv',
    filename: 'discovery_bay_properties_batch1.csv',
    status: 'completed',
    total_records: 2450,
    success_count: 2438,
    skipped_count: 8,
    error_count: 4,
    errors: [
      { row: 142, field: 'lease_end', message: 'lease_end is before lease_start' },
      { row: 389, field: 'asking_rent', message: 'Invalid number format: "HK$25,000"' },
      { row: 712, field: 'landlord_email', message: 'Invalid email format' },
      { row: 1901, field: 'status', message: 'Unrecognised status value: "pending"' },
    ],
    imported_at: '2026-05-01T09:14:22Z',
    imported_by: 'admin@homesrus.hk',
    notes: 'First bulk import — Discovery Bay Phase 1–8',
  },
  {
    id: 'imp-002',
    import_type: 'photo',
    filename: 'db_photos_batch1.zip',
    status: 'partial',
    total_records: 1820,
    success_count: 1743,
    skipped_count: 42,
    error_count: 35,
    errors: [
      { message: 'AMF99-photo1.jpg — no matching property short code AMF99' },
      { message: 'BAY_exterior.jpg — filename missing short code prefix' },
      { message: '35 photos exceeded 5 MB size limit and were skipped' },
    ],
    imported_at: '2026-05-01T11:30:05Z',
    imported_by: 'admin@homesrus.hk',
    notes: 'Photos matched by filename short code',
  },
  {
    id: 'imp-003',
    import_type: 'csv',
    filename: 'discovery_bay_properties_batch2.csv',
    status: 'completed',
    total_records: 3100,
    success_count: 3100,
    skipped_count: 0,
    error_count: 0,
    errors: [],
    imported_at: '2026-05-02T08:05:11Z',
    imported_by: 'manager@homesrus.hk',
    notes: 'Discovery Bay Phase 9–14 — clean import',
  },
  {
    id: 'imp-004',
    import_type: 'csv',
    filename: 'tenancy_updates_may2026.csv',
    status: 'failed',
    total_records: 580,
    success_count: 0,
    skipped_count: 0,
    error_count: 580,
    errors: [
      { row: 1, field: 'property_ref', message: 'Required column "property_ref" is missing from CSV header' },
    ],
    imported_at: '2026-05-02T14:22:44Z',
    imported_by: 'manager@homesrus.hk',
    notes: 'Aborted — missing required column',
  },
  {
    id: 'imp-005',
    import_type: 'photo',
    filename: 'db_photos_batch2.zip',
    status: 'rolled_back',
    total_records: 960,
    success_count: 960,
    skipped_count: 0,
    error_count: 0,
    errors: [],
    imported_at: '2026-05-02T16:45:00Z',
    imported_by: 'admin@homesrus.hk',
    rolled_back_at: '2026-05-02T17:10:00Z',
    rolled_back_by: 'admin@homesrus.hk',
    notes: 'Wrong photo set uploaded — rolled back',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-HK', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function statusConfig(status: ImportStatus) {
  switch (status) {
    case 'completed':
      return { label: 'Completed', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' };
    case 'partial':
      return { label: 'Partial', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' };
    case 'failed':
      return { label: 'Failed', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' };
    case 'rolled_back':
      return { label: 'Rolled Back', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' };
  }
}

function typeConfig(type: ImportType) {
  return type === 'csv'
    ? { label: 'CSV', icon: 'FileSpreadsheetIcon' as const, color: 'text-blue-600', bg: 'bg-blue-50' }
    : { label: 'Photos', icon: 'ImageIcon' as const, color: 'text-purple-600', bg: 'bg-purple-50' };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color }: { label: string; value: number | string; icon: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon name={icon as Parameters<typeof Icon>[0]['name']} size={20} />
      </div>
      <div>
        <p className="text-2xl font-bold text-[hsl(215,25%,18%)]">{value}</p>
        <p className="text-xs text-[hsl(215,15%,52%)]">{label}</p>
      </div>
    </div>
  );
}

interface ErrorPanelProps {
  errors: ImportError[];
}

function ErrorPanel({ errors }: ErrorPanelProps) {
  if (errors.length === 0) return <p className="text-sm text-[hsl(215,15%,52%)] italic">No errors recorded.</p>;
  return (
    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
      {errors.map((e, i) => (
        <div key={i} className="flex items-start gap-2 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <Icon name="AlertCircleIcon" size={13} className="text-red-500 mt-0.5 flex-shrink-0" />
          <span className="text-red-700">
            {e.row !== undefined && <span className="font-semibold">Row {e.row}{e.field ? ` · ${e.field}` : ''}: </span>}
            {e.message}
          </span>
        </div>
      ))}
    </div>
  );
}

interface ImportRowProps {
  record: ImportRecord;
  onRollback: (id: string) => void;
  rollingBack: string | null;
}

function ImportRow({ record, onRollback, rollingBack }: ImportRowProps) {
  const [expanded, setExpanded] = useState(false);
  const sc = statusConfig(record.status);
  const tc = typeConfig(record.import_type);
  const successPct = record.total_records > 0 ? Math.round((record.success_count / record.total_records) * 100) : 0;
  const canRollback = record.status === 'completed' || record.status === 'partial';

  return (
    <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden transition-shadow hover:shadow-sm">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Type badge */}
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${tc.bg}`}>
          <Icon name={tc.icon} size={18} className={tc.color} />
        </div>

        {/* Filename + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[hsl(215,25%,18%)] truncate max-w-xs">{record.filename}</span>
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${sc.bg} ${sc.text} ${sc.border}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
              {sc.label}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tc.bg} ${tc.color}`}>{tc.label}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-xs text-[hsl(215,15%,52%)]">{formatDate(record.imported_at)}</span>
            <span className="text-xs text-[hsl(215,15%,52%)]">by {record.imported_by}</span>
            {record.rolled_back_at && (
              <span className="text-xs text-slate-500 italic">
                Rolled back {formatDate(record.rolled_back_at)} by {record.rolled_back_by}
              </span>
            )}
          </div>
        </div>

        {/* Record counts */}
        <div className="hidden md:flex items-center gap-4 flex-shrink-0">
          <div className="text-center">
            <p className="text-sm font-bold text-[hsl(215,25%,18%)]">{record.total_records.toLocaleString()}</p>
            <p className="text-xs text-[hsl(215,15%,52%)]">Total</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-emerald-600">{record.success_count.toLocaleString()}</p>
            <p className="text-xs text-[hsl(215,15%,52%)]">Success</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-amber-600">{record.skipped_count.toLocaleString()}</p>
            <p className="text-xs text-[hsl(215,15%,52%)]">Skipped</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-red-600">{record.error_count.toLocaleString()}</p>
            <p className="text-xs text-[hsl(215,15%,52%)]">Errors</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {canRollback && (
            <button
              onClick={() => onRollback(record.id)}
              disabled={rollingBack === record.id}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[hsl(214,20%,88%)] text-[hsl(215,15%,52%)] hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {rollingBack === record.id ? (
                <Icon name="LoaderIcon" size={13} className="animate-spin" />
              ) : (
                <Icon name="RotateCcwIcon" size={13} />
              )}
              Rollback
            </button>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <Icon name={expanded ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={16} className="text-[hsl(215,15%,52%)]" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-2">
        <div className="w-full h-1.5 bg-[hsl(210,15%,94%)] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${record.status === 'failed' ? 'bg-red-400' : record.status === 'rolled_back' ? 'bg-slate-300' : successPct === 100 ? 'bg-emerald-500' : 'bg-amber-400'}`}
            style={{ width: `${successPct}%` }}
          />
        </div>
        <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">{successPct}% success rate</p>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-[hsl(214,20%,88%)] px-4 py-3 bg-[hsl(210,15%,97%)] space-y-3">
          {/* Mobile counts */}
          <div className="flex md:hidden items-center gap-4">
            <div className="text-center"><p className="text-sm font-bold text-[hsl(215,25%,18%)]">{record.total_records.toLocaleString()}</p><p className="text-xs text-[hsl(215,15%,52%)]">Total</p></div>
            <div className="text-center"><p className="text-sm font-bold text-emerald-600">{record.success_count.toLocaleString()}</p><p className="text-xs text-[hsl(215,15%,52%)]">Success</p></div>
            <div className="text-center"><p className="text-sm font-bold text-amber-600">{record.skipped_count.toLocaleString()}</p><p className="text-xs text-[hsl(215,15%,52%)]">Skipped</p></div>
            <div className="text-center"><p className="text-sm font-bold text-red-600">{record.error_count.toLocaleString()}</p><p className="text-xs text-[hsl(215,15%,52%)]">Errors</p></div>
          </div>

          {record.notes && (
            <div className="flex items-start gap-2 text-xs text-[hsl(215,15%,52%)]">
              <Icon name="InfoIcon" size={13} className="mt-0.5 flex-shrink-0" />
              <span>{record.notes}</span>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-[hsl(215,25%,18%)] mb-1.5">Error Details</p>
            <ErrorPanel errors={record.errors} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ImportHistoryClient() {
  const supabase = createClient();
  const [records, setRecords] = useState<ImportRecord[]>(MOCK_IMPORTS);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<'all' | ImportType>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | ImportStatus>('all');
  const [search, setSearch] = useState('');
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [confirmRollback, setConfirmRollback] = useState<string | null>(null);

  // Totals
  const totalImports = records.length;
  const totalRecords = records.reduce((s, r) => s + r.total_records, 0);
  const totalSuccess = records.reduce((s, r) => s + r.success_count, 0);
  const totalErrors = records.reduce((s, r) => s + r.error_count, 0);

  // Filtered list
  const filtered = records.filter((r) => {
    if (filterType !== 'all' && r.import_type !== filterType) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (search && !r.filename.toLowerCase().includes(search.toLowerCase()) && !r.imported_by.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleRollbackConfirm = useCallback(async (id: string) => {
    setConfirmRollback(null);
    setRollingBack(id);
    // Simulate rollback (in production this would call a Supabase function / API)
    await new Promise((res) => setTimeout(res, 1500));
    setRecords((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, status: 'rolled_back' as ImportStatus, rolled_back_at: new Date().toISOString(), rolled_back_by: 'current-user@homesrus.hk' }
          : r
      )
    );
    setRollingBack(null);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto bg-[hsl(210,15%,97%)] p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(215,25%,18%)]">Import History</h1>
          <p className="text-sm text-[hsl(215,15%,52%)] mt-0.5">Track all bulk CSV and photo imports — status, errors, record counts, and rollback options.</p>
        </div>
        <a
          href="/data-import-export"
          className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-[#8B1A2B] text-white hover:bg-[#7a1726] transition-colors"
        >
          <Icon name="UploadIcon" size={15} />
          New Import
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Imports" value={totalImports} icon="HistoryIcon" color="bg-blue-50 text-blue-600" />
        <StatCard label="Records Processed" value={totalRecords.toLocaleString()} icon="DatabaseIcon" color="bg-indigo-50 text-indigo-600" />
        <StatCard label="Successfully Imported" value={totalSuccess.toLocaleString()} icon="CheckCircleIcon" color="bg-emerald-50 text-emerald-600" />
        <StatCard label="Total Errors" value={totalErrors.toLocaleString()} icon="AlertCircleIcon" color="bg-red-50 text-red-600" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] px-4 py-3 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Icon name="SearchIcon" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(215,15%,52%)]" />
          <input
            type="text"
            placeholder="Search by filename or user…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B]"
          />
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-1 bg-[hsl(210,15%,94%)] rounded-lg p-1">
          {(['all', 'csv', 'photo'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${filterType === t ? 'bg-white text-[hsl(215,25%,18%)] shadow-sm' : 'text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)]'}`}
            >
              {t === 'all' ? 'All Types' : t === 'csv' ? 'CSV' : 'Photos'}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as 'all' | ImportStatus)}
          className="text-sm border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B] bg-white"
        >
          <option value="all">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="partial">Partial</option>
          <option value="failed">Failed</option>
          <option value="rolled_back">Rolled Back</option>
        </select>

        <span className="text-xs text-[hsl(215,15%,52%)] ml-auto">{filtered.length} import{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Import list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Icon name="LoaderIcon" size={28} className="animate-spin text-[#8B1A2B]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] flex flex-col items-center justify-center py-16 gap-3">
          <Icon name="InboxIcon" size={40} className="text-[hsl(215,15%,70%)]" />
          <p className="text-sm text-[hsl(215,15%,52%)]">No imports match your filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((record) => (
            <ImportRow
              key={record.id}
              record={record}
              onRollback={(id) => setConfirmRollback(id)}
              rollingBack={rollingBack}
            />
          ))}
        </div>
      )}

      {/* Rollback confirmation modal */}
      {confirmRollback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Icon name="RotateCcwIcon" size={20} className="text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-[hsl(215,25%,18%)]">Confirm Rollback</p>
                <p className="text-xs text-[hsl(215,15%,52%)]">This will mark the import as rolled back and flag all associated records.</p>
              </div>
            </div>
            <p className="text-sm text-[hsl(215,15%,52%)]">
              Rolling back <span className="font-medium text-[hsl(215,25%,18%)]">{records.find((r) => r.id === confirmRollback)?.filename}</span> cannot be undone automatically. You may need to manually remove imported records.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmRollback(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-[hsl(214,20%,88%)] text-[hsl(215,15%,52%)] hover:bg-[hsl(210,15%,94%)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRollbackConfirm(confirmRollback)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Yes, Rollback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
