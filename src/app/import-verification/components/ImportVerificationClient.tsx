'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type ImportStatus = 'completed' | 'partial' | 'failed' | 'rolled_back';

interface ImportError {
  row?: number;
  field?: string;
  message: string;
}

interface ImportRecord {
  id: string;
  import_type: 'csv' | 'photo';
  filename: string;
  status: ImportStatus;
  total_records: number;
  success_count: number;
  skipped_count: number;
  error_count: number;
  errors: ImportError[];
  imported_at: string;
  imported_by: string;
  notes?: string;
}

// ─── Mock fallback ────────────────────────────────────────────────────────────

const MOCK_RECORDS: ImportRecord[] = [
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
    id: 'imp-003',
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
    id: 'imp-004',
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
    imported_at: '2026-05-03T11:30:05Z',
    imported_by: 'admin@homesrus.hk',
    notes: 'Photos matched by filename short code',
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

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildCSVReport(records: ImportRecord[]): string {
  const lines: string[] = [];
  const now = new Date().toISOString();

  lines.push('PropTrack HK — Import Verification Report');
  lines.push(`Generated: ${now}`);
  lines.push('');

  // Summary totals
  const totalRows = records.reduce((s, r) => s + r.total_records, 0);
  const totalSuccess = records.reduce((s, r) => s + r.success_count, 0);
  const totalSkipped = records.reduce((s, r) => s + r.skipped_count, 0);
  const totalErrors = records.reduce((s, r) => s + r.error_count, 0);

  lines.push('=== SUMMARY ===');
  lines.push(`Total Imports,${records.length}`);
  lines.push(`Total Rows,${totalRows}`);
  lines.push(`Successful,${totalSuccess}`);
  lines.push(`Skipped,${totalSkipped}`);
  lines.push(`Failed,${totalErrors}`);
  lines.push('');

  // Per-import detail
  lines.push('=== IMPORT DETAIL ===');
  lines.push('Import ID,Filename,Type,Status,Total Rows,Success,Skipped,Errors,Imported At,Imported By,Notes');
  for (const r of records) {
    const row = [
      r.id,
      `"${r.filename}"`,
      r.import_type,
      r.status,
      r.total_records,
      r.success_count,
      r.skipped_count,
      r.error_count,
      r.imported_at,
      r.imported_by,
      `"${r.notes || ''}"`,
    ].join(',');
    lines.push(row);
  }
  lines.push('');

  // Error detail
  const withErrors = records.filter((r) => r.errors.length > 0);
  if (withErrors.length > 0) {
    lines.push('=== ERROR DETAIL ===');
    lines.push('Import ID,Filename,Row,Field,Message');
    for (const r of withErrors) {
      for (const e of r.errors) {
        const row = [
          r.id,
          `"${r.filename}"`,
          e.row ?? '',
          e.field ?? '',
          `"${e.message}"`,
        ].join(',');
        lines.push(row);
      }
    }
  }

  return lines.join('\n');
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({
  label, value, icon, iconBg, valueColor,
}: {
  label: string; value: string | number; icon: string; iconBg: string; valueColor?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon name={icon as Parameters<typeof Icon>[0]['name']} size={20} />
      </div>
      <div>
        <p className={`text-2xl font-bold ${valueColor ?? 'text-[hsl(215,25%,18%)]'}`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        <p className="text-xs text-[hsl(215,15%,52%)]">{label}</p>
      </div>
    </div>
  );
}

interface VerificationRowProps {
  record: ImportRecord;
}

function VerificationRow({ record }: VerificationRowProps) {
  const [expanded, setExpanded] = useState(false);
  const sc = statusConfig(record.status);
  const successPct = record.total_records > 0
    ? Math.round((record.success_count / record.total_records) * 100)
    : 0;

  const barColor =
    record.status === 'completed' ? 'bg-emerald-500' :
    record.status === 'partial' ? 'bg-amber-500' :
    record.status === 'failed' ? 'bg-red-500' : 'bg-slate-400';

  return (
    <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden hover:shadow-sm transition-shadow">
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Type icon */}
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${record.import_type === 'csv' ? 'bg-blue-50' : 'bg-purple-50'}`}>
          <Icon
            name={record.import_type === 'csv' ? 'FileSpreadsheetIcon' : 'ImageIcon'}
            size={18}
            className={record.import_type === 'csv' ? 'text-blue-600' : 'text-purple-600'}
          />
        </div>

        {/* Filename + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[hsl(215,25%,18%)] truncate max-w-xs">{record.filename}</span>
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${sc.bg} ${sc.text} ${sc.border}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
              {sc.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-xs text-[hsl(215,15%,52%)] flex items-center gap-1">
              <Icon name="ClockIcon" size={11} />
              {formatDate(record.imported_at)}
            </span>
            <span className="text-xs text-[hsl(215,15%,52%)]">by {record.imported_by}</span>
          </div>
        </div>

        {/* Counts */}
        <div className="hidden md:flex items-center gap-5 flex-shrink-0">
          <div className="text-center min-w-[48px]">
            <p className="text-sm font-bold text-[hsl(215,25%,18%)]">{record.total_records.toLocaleString()}</p>
            <p className="text-xs text-[hsl(215,15%,52%)]">Total</p>
          </div>
          <div className="text-center min-w-[48px]">
            <p className="text-sm font-bold text-emerald-600">{record.success_count.toLocaleString()}</p>
            <p className="text-xs text-[hsl(215,15%,52%)]">Success</p>
          </div>
          <div className="text-center min-w-[48px]">
            <p className="text-sm font-bold text-amber-600">{record.skipped_count.toLocaleString()}</p>
            <p className="text-xs text-[hsl(215,15%,52%)]">Skipped</p>
          </div>
          <div className="text-center min-w-[48px]">
            <p className="text-sm font-bold text-red-600">{record.error_count.toLocaleString()}</p>
            <p className="text-xs text-[hsl(215,15%,52%)]">Errors</p>
          </div>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors flex-shrink-0"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <Icon name={expanded ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={16} className="text-[hsl(215,15%,52%)]" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-[hsl(210,15%,94%)] rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${successPct}%` }} />
          </div>
          <span className="text-xs font-medium text-[hsl(215,15%,52%)] w-10 text-right">{successPct}%</span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-[hsl(214,20%,88%)] px-4 py-3 bg-[hsl(210,15%,97%)] space-y-3">
          {/* Mobile counts */}
          <div className="flex items-center gap-4 md:hidden">
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

          {record.notes && (
            <p className="text-xs text-[hsl(215,15%,52%)] italic">{record.notes}</p>
          )}

          {/* Errors */}
          {record.errors.length > 0 ? (
            <div>
              <p className="text-xs font-semibold text-[hsl(215,25%,18%)] mb-1.5">
                Error Detail ({record.errors.length})
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {record.errors.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    <Icon name="AlertCircleIcon" size={12} className="text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-red-700">
                      {e.row !== undefined && (
                        <span className="font-semibold">Row {e.row}{e.field ? ` · ${e.field}` : ''}: </span>
                      )}
                      {e.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-emerald-600 flex items-center gap-1">
              <Icon name="CheckCircleIcon" size={13} />
              No errors — all rows imported successfully
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ImportVerificationClient() {
  const supabase = useRef(createClient()).current;
  const [records, setRecords] = useState<ImportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | ImportStatus>('all');
  const [generatedAt] = useState(() => new Date().toISOString());

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('import_logs')
        .select('*')
        .order('imported_at', { ascending: false });

      if (error || !data || data.length === 0) {
        setRecords(MOCK_RECORDS);
      } else {
        setRecords(data as ImportRecord[]);
      }
    } catch {
      setRecords(MOCK_RECORDS);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Aggregated totals
  const totalImports = records.length;
  const totalRows = records.reduce((s, r) => s + r.total_records, 0);
  const totalSuccess = records.reduce((s, r) => s + r.success_count, 0);
  const totalSkipped = records.reduce((s, r) => s + r.skipped_count, 0);
  const totalErrors = records.reduce((s, r) => s + r.error_count, 0);
  const overallPct = totalRows > 0 ? Math.round((totalSuccess / totalRows) * 100) : 0;

  const filtered = filterStatus === 'all'
    ? records
    : records.filter((r) => r.status === filterStatus);

  const handleDownload = () => {
    const csv = buildCSVReport(records);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    downloadBlob(blob, `import-verification-report-${ts}.csv`);
  };

  const STATUS_FILTERS: Array<{ value: 'all' | ImportStatus; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'completed', label: 'Completed' },
    { value: 'partial', label: 'Partial' },
    { value: 'failed', label: 'Failed' },
    { value: 'rolled_back', label: 'Rolled Back' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(215,25%,18%)]">Import Verification</h1>
          <p className="text-sm text-[hsl(215,15%,52%)] mt-0.5">
            Post-import audit — verify row counts, success/failure rates, and download the full report
          </p>
          <p className="text-xs text-[hsl(215,15%,52%)] mt-1 flex items-center gap-1">
            <Icon name="ClockIcon" size={12} />
            Report generated: {formatDate(generatedAt)}
          </p>
        </div>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 bg-[#8B1A2B] text-white text-sm font-medium rounded-lg hover:bg-[#7a1726] transition-colors"
        >
          <Icon name="DownloadIcon" size={16} />
          Download Report
        </button>
      </div>

      {/* Summary cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-4 h-20 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <SummaryCard label="Total Imports" value={totalImports} icon="UploadIcon" iconBg="bg-blue-50" />
          <SummaryCard label="Total Rows" value={totalRows} icon="TableIcon" iconBg="bg-slate-100" />
          <SummaryCard label="Successful" value={totalSuccess} icon="CheckCircleIcon" iconBg="bg-emerald-50" valueColor="text-emerald-600" />
          <SummaryCard label="Skipped" value={totalSkipped} icon="SkipForwardIcon" iconBg="bg-amber-50" valueColor="text-amber-600" />
          <SummaryCard label="Errors" value={totalErrors} icon="XCircleIcon" iconBg="bg-red-50" valueColor="text-red-600" />
        </div>
      )}

      {/* Overall success rate bar */}
      {!loading && totalRows > 0 && (
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-[hsl(215,25%,18%)]">Overall Success Rate</span>
            <span className="text-sm font-bold text-emerald-600">{overallPct}%</span>
          </div>
          <div className="h-3 bg-[hsl(210,15%,94%)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-700"
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-[hsl(215,15%,52%)]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> {totalSuccess.toLocaleString()} succeeded</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> {totalSkipped.toLocaleString()} skipped</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> {totalErrors.toLocaleString()} failed</span>
          </div>
        </div>
      )}

      {/* Filter tabs + list */}
      <div>
        {/* Filter tabs */}
        <div className="flex items-center gap-1 mb-4 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilterStatus(f.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filterStatus === f.value
                  ? 'bg-[#8B1A2B] text-white'
                  : 'bg-white border border-[hsl(214,20%,88%)] text-[hsl(215,15%,52%)] hover:bg-[hsl(210,15%,94%)]'
              }`}
            >
              {f.label}
              {f.value !== 'all' && (
                <span className="ml-1.5 opacity-70">
                  ({records.filter((r) => r.status === f.value).length})
                </span>
              )}
            </button>
          ))}
          <span className="ml-auto text-xs text-[hsl(215,15%,52%)]">
            {filtered.length} import{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Records */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-[hsl(214,20%,88%)] h-20 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-12 text-center">
            <Icon name="InboxIcon" size={32} className="text-[hsl(215,15%,52%)] mx-auto mb-3" />
            <p className="text-sm text-[hsl(215,15%,52%)]">No imports match this filter.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((record) => (
              <VerificationRow key={record.id} record={record} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
