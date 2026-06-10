'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type RowStatus = 'clean' | 'failed' | 'fixed';
type ErrorType = 'null_field' | 'validation' | 'format' | 'reference';

interface FieldIssue {
  field: string;
  label: string;
  type: ErrorType;
  message: string;
  value?: string;
}

interface BatchRow {
  id: string;
  rowNumber: number;
  propertyRef: string;
  status: RowStatus;
  issues: FieldIssue[];
  data: Record<string, string>;
  fixedData?: Record<string, string>;
}

interface BatchMeta {
  id: string;
  filename: string;
  importedAt: string;
  importedBy: string;
  totalRecords: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_BATCHES: Record<string, { meta: BatchMeta; rows: BatchRow[] }> = {
  'imp-001': {
    meta: {
      id: 'imp-001',
      filename: 'discovery_bay_properties_batch1.csv',
      importedAt: '2026-05-01T09:14:22Z',
      importedBy: 'admin@homesrus.hk',
      totalRecords: 2450,
      successCount: 2438,
      errorCount: 4,
      skippedCount: 8,
    },
    rows: [
      {
        id: 'r-001-1',
        rowNumber: 1,
        propertyRef: 'DB-PH1-001',
        status: 'clean',
        issues: [],
        data: { property_ref: 'DB-PH1-001', asking_rent: '28000', lease_start: '2026-06-01', lease_end: '2027-05-31', status: 'available', furn_id: 'furnished', floor_type: 'high floor' },
      },
      {
        id: 'r-001-2',
        rowNumber: 2,
        propertyRef: 'DB-PH1-002',
        status: 'clean',
        issues: [],
        data: { property_ref: 'DB-PH1-002', asking_rent: '32000', lease_start: '2026-07-01', lease_end: '2027-06-30', status: 'available', furn_id: 'unfurnished', floor_type: 'low floor' },
      },
      {
        id: 'r-001-142',
        rowNumber: 142,
        propertyRef: 'DB-PH1-142',
        status: 'failed',
        issues: [
          { field: 'lease_end', label: 'Lease End', type: 'validation', message: 'lease_end (2025-05-31) is before lease_start (2026-06-01)', value: '2025-05-31' },
          { field: 'asking_rent', label: 'Asking Rent', type: 'format', message: 'Value "HK$25,000" contains non-numeric characters', value: 'HK$25,000' },
        ],
        data: { property_ref: 'DB-PH1-142', asking_rent: 'HK$25,000', lease_start: '2026-06-01', lease_end: '2025-05-31', status: 'available', furn_id: 'furnished', floor_type: 'high floor' },
      },
      {
        id: 'r-001-389',
        rowNumber: 389,
        propertyRef: 'DB-PH3-389',
        status: 'failed',
        issues: [
          { field: 'floor_type', label: 'Floor Type', type: 'null_field', message: 'floor_type is null — auto-derive from prop_type + floor number', value: undefined },
        ],
        data: { property_ref: 'DB-PH3-389', asking_rent: '22000', lease_start: '2026-08-01', lease_end: '2027-07-31', status: 'available', furn_id: 'unfurnished', floor_type: '' },
      },
      {
        id: 'r-001-712',
        rowNumber: 712,
        propertyRef: 'DB-PH5-712',
        status: 'failed',
        issues: [
          { field: 'landlord_email', label: 'Landlord Email', type: 'validation', message: 'Invalid email format: "not-an-email"', value: 'not-an-email' },
        ],
        data: { property_ref: 'DB-PH5-712', asking_rent: '18500', lease_start: '2026-09-01', lease_end: '2027-08-31', status: 'available', furn_id: 'furnished', landlord_email: 'not-an-email' },
      },
      {
        id: 'r-001-1901',
        rowNumber: 1901,
        propertyRef: 'DB-PH8-1901',
        status: 'failed',
        issues: [
          { field: 'status', label: 'Status', type: 'validation', message: 'Unrecognised status "pending" — must be: available, let, under_offer, withdrawn, sold', value: 'pending' },
          { field: 'build_year', label: 'Build Year', type: 'null_field', message: 'build_year is null', value: undefined },
          { field: 'direction_id', label: 'Direction', type: 'null_field', message: 'direction_id is null', value: undefined },
        ],
        data: { property_ref: 'DB-PH8-1901', asking_rent: '35000', lease_start: '2026-10-01', lease_end: '2027-09-30', status: 'pending', furn_id: 'furnished', build_year: '', direction_id: '' },
      },
    ],
  },
  'imp-004': {
    meta: {
      id: 'imp-004',
      filename: 'tenancy_updates_may2026.csv',
      importedAt: '2026-05-02T14:22:44Z',
      importedBy: 'admin@homesrus.hk',
      totalRecords: 580,
      successCount: 0,
      errorCount: 580,
      skippedCount: 0,
    },
    rows: [
      {
        id: 'r-004-23',
        rowNumber: 23,
        propertyRef: '(missing)',
        status: 'failed',
        issues: [
          { field: 'property_ref', label: 'Property Ref', type: 'null_field', message: 'Required column "property_ref" is empty', value: '' },
        ],
        data: { property_ref: '', asking_rent: '20000', lease_start: '2026-06-01', lease_end: '2027-05-31', status: 'available', furn_id: 'unfurnished' },
      },
      {
        id: 'r-004-88',
        rowNumber: 88,
        propertyRef: 'DB-PH2-088',
        status: 'failed',
        issues: [
          { field: 'asking_rent', label: 'Asking Rent', type: 'validation', message: 'Must be a positive number — received "-500"', value: '-500' },
          { field: 'lease_start', label: 'Lease Start', type: 'format', message: 'Invalid date format "not-a-date" — use YYYY-MM-DD', value: 'not-a-date' },
        ],
        data: { property_ref: 'DB-PH2-088', asking_rent: '-500', lease_start: 'not-a-date', lease_end: '2027-05-31', status: 'available', furn_id: 'furnished' },
      },
      {
        id: 'r-004-201',
        rowNumber: 201,
        propertyRef: 'DB-PH4-201',
        status: 'failed',
        issues: [
          { field: 'furn_id', label: 'Furnishing', type: 'null_field', message: 'furn_id is null — defaulted to "unfurnished"', value: undefined },
          { field: 'floor_type', label: 'Floor Type', type: 'null_field', message: 'floor_type is null — auto-derived', value: undefined },
        ],
        data: { property_ref: 'DB-PH4-201', asking_rent: '24000', lease_start: '2026-07-01', lease_end: '2027-06-30', status: 'available', furn_id: '', floor_type: '' },
      },
    ],
  },
};

const ALL_BATCHES = Object.values(MOCK_BATCHES).map((b) => b.meta);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-HK', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function errorTypeConfig(type: ErrorType) {
  switch (type) {
    case 'null_field':
      return { label: 'Null', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };
    case 'validation':
      return { label: 'Validation', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
    case 'format':
      return { label: 'Format', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    case 'reference':
      return { label: 'Reference', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' };
  }
}

function downloadCSV(rows: BatchRow[], filename: string) {
  if (rows.length === 0) return;
  const allKeys = Array.from(new Set(rows.flatMap((r) => Object.keys(r.fixedData ?? r.data))));
  const header = ['row_number', 'property_ref', 'row_status', ...allKeys].join(',');
  const lines = rows.map((r) => {
    const d = r.fixedData ?? r.data;
    const vals = allKeys.map((k) => {
      const v = d[k] ?? '';
      return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
    });
    return [r.rowNumber, r.propertyRef, r.status, ...vals].join(',');
  });
  const csv = [header, ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Inline Fix Modal ─────────────────────────────────────────────────────────

function InlineFixModal({
  row,
  onSave,
  onClose,
}: {
  row: BatchRow;
  onSave: (id: string, fixedData: Record<string, string>) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({ ...(row.fixedData ?? row.data) });
  const problemFields = new Set(row.issues.map((i) => i.field));

  function handleChange(field: string, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[hsl(214,20%,88%)]">
          <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
            <Icon name="PencilIcon" size={16} className="text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-[hsl(215,25%,18%)]">Inline Fix — Row {row.rowNumber}</h2>
            <p className="text-xs text-[hsl(215,15%,52%)] font-mono">{row.propertyRef}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors">
            <Icon name="XIcon" size={16} className="text-[hsl(215,15%,52%)]" />
          </button>
        </div>

        {/* Issues summary */}
        <div className="px-6 py-3 bg-amber-50/60 border-b border-amber-100">
          <p className="text-xs font-medium text-amber-700 mb-2 flex items-center gap-1.5">
            <Icon name="AlertTriangleIcon" size={13} />
            {row.issues.length} issue{row.issues.length !== 1 ? 's' : ''} to resolve — highlighted fields below
          </p>
          <div className="flex flex-wrap gap-1.5">
            {row.issues.map((issue, i) => {
              const cfg = errorTypeConfig(issue.type);
              return (
                <span key={i} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                  {issue.label}: {issue.message.split('—')[0].trim()}
                </span>
              );
            })}
          </div>
        </div>

        {/* Fields */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(draft).map(([field, value]) => {
              const isProblem = problemFields.has(field);
              const issue = row.issues.find((i) => i.field === field);
              const cfg = issue ? errorTypeConfig(issue.type) : null;
              return (
                <div key={field} className={`flex flex-col gap-1 ${isProblem ? 'col-span-2' : ''}`}>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-[hsl(215,25%,30%)]">
                    {field}
                    {isProblem && cfg && (
                      <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                        {cfg.label}
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => handleChange(field, e.target.value)}
                    className={`w-full px-3 py-2 text-sm rounded-lg border transition-colors focus:outline-none focus:ring-2 ${
                      isProblem
                        ? 'border-amber-300 bg-amber-50/40 focus:ring-amber-200 focus:border-amber-400' :'border-[hsl(214,20%,88%)] bg-white focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B]/40'
                    }`}
                    placeholder={isProblem ? 'Enter corrected value…' : ''}
                  />
                  {isProblem && issue && (
                    <p className="text-xs text-amber-600 leading-relaxed">{issue.message}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[hsl(214,20%,88%)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[hsl(215,25%,30%)] bg-white border border-[hsl(214,20%,88%)] rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { onSave(row.id, draft); onClose(); }}
            className="px-4 py-2 text-sm font-medium text-white bg-[#8B1A2B] rounded-lg hover:bg-[#7a1726] transition-colors flex items-center gap-1.5"
          >
            <Icon name="CheckIcon" size={14} />
            Apply Fix
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Row card ─────────────────────────────────────────────────────────────────

function RowCard({
  row,
  selected,
  onSelect,
  onFix,
}: {
  row: BatchRow;
  selected: boolean;
  onSelect: (id: string) => void;
  onFix: (row: BatchRow) => void;
}) {
  const statusConfig = {
    clean: { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', label: 'Clean' },
    failed: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500', label: 'Failed' },
    fixed: { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500', label: 'Fixed' },
  }[row.status];

  return (
    <div className={`rounded-xl border transition-all ${statusConfig.border} ${selected ? 'ring-2 ring-[#8B1A2B]/30' : ''}`}>
      <div className={`flex items-center gap-3 px-4 py-3 ${statusConfig.bg} rounded-xl`}>
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onSelect(row.id)}
          className="w-4 h-4 rounded border-[hsl(214,20%,70%)] accent-[#8B1A2B] flex-shrink-0 cursor-pointer"
        />
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusConfig.dot}`} />
        <div className="w-8 h-8 rounded-lg bg-white/70 border border-white/50 flex items-center justify-center flex-shrink-0">
          <Icon name="FileTextIcon" size={15} className="text-[hsl(215,15%,52%)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[hsl(215,25%,18%)]">Row {row.rowNumber}</span>
            <span className="text-xs text-[hsl(215,15%,52%)] font-mono bg-white/60 px-1.5 py-0.5 rounded border border-white/40">
              {row.propertyRef}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusConfig.badge}`}>
              {statusConfig.label}
            </span>
            {row.fixedData && (
              <span className="text-xs text-blue-600 flex items-center gap-1">
                <Icon name="CheckCircleIcon" size={11} />
                Edited
              </span>
            )}
          </div>
          {row.issues.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {row.issues.map((issue, i) => {
                const cfg = errorTypeConfig(issue.type);
                return (
                  <span key={i} className={`text-xs px-1.5 py-0.5 rounded border font-medium ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                    {issue.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {row.status === 'failed' || row.status === 'fixed' ? (
            <button
              onClick={() => onFix(row)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
            >
              <Icon name="PencilIcon" size={12} />
              Fix
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BatchExportFixClient() {
  const searchParams = useSearchParams();
  const initialBatch = searchParams.get('batch') ?? 'imp-001';

  const [selectedBatchId, setSelectedBatchId] = useState(initialBatch);
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [meta, setMeta] = useState<BatchMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<'all' | 'clean' | 'failed' | 'fixed'>('all');
  const [fixingRow, setFixingRow] = useState<BatchRow | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadBatch(selectedBatchId);
  }, [selectedBatchId]);

  async function loadBatch(batchId: string) {
    setLoading(true);
    setSelectedIds(new Set());
    try {
      const supabase = createClient();
      const { data: batchRow } = await supabase
        .from('import_history')
        .select('*')
        .eq('id', batchId)
        .single();

      if (batchRow) {
        const errors: Array<{ row?: number; field?: string; message: string }> = batchRow.errors ?? [];
        const failedRows: BatchRow[] = errors
          .filter((e) => e.row !== undefined)
          .map((e, idx) => ({
            id: `${batchId}-${idx}`,
            rowNumber: e.row!,
            propertyRef: `Row ${e.row}`,
            status: 'failed' as RowStatus,
            issues: [{ field: e.field ?? 'unknown', label: e.field ?? 'Unknown', type: 'validation' as ErrorType, message: e.message }],
            data: { property_ref: `Row ${e.row}`, [e.field ?? 'unknown']: '' },
          }));
        setMeta({
          id: batchRow.id,
          filename: batchRow.filename,
          importedAt: batchRow.imported_at,
          importedBy: batchRow.imported_by ?? 'system',
          totalRecords: batchRow.total_records ?? 0,
          successCount: batchRow.success_count ?? 0,
          errorCount: batchRow.error_count ?? 0,
          skippedCount: batchRow.skipped_count ?? 0,
        });
        setRows(failedRows);
      } else {
        // Fallback to mock
        const mock = MOCK_BATCHES[batchId];
        if (mock) {
          setMeta(mock.meta);
          setRows(mock.rows);
        } else {
          const first = Object.values(MOCK_BATCHES)[0];
          setMeta(first.meta);
          setRows(first.rows);
        }
      }
    } catch {
      const mock = MOCK_BATCHES[batchId] ?? Object.values(MOCK_BATCHES)[0];
      setMeta(mock.meta);
      setRows(mock.rows);
    } finally {
      setLoading(false);
    }
  }

  const filteredRows = rows.filter((r) => filterStatus === 'all' || r.status === filterStatus);
  const cleanRows = rows.filter((r) => r.status === 'clean');
  const failedRows = rows.filter((r) => r.status === 'failed');
  const fixedRows = rows.filter((r) => r.status === 'fixed');

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredRows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRows.map((r) => r.id)));
    }
  }

  function applyFix(id: string, fixedData: Record<string, string>) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, fixedData, status: 'fixed' as RowStatus } : r
      )
    );
  }

  function handleExportClean() {
    const toExport = selectedIds.size > 0
      ? cleanRows.filter((r) => selectedIds.has(r.id))
      : cleanRows;
    if (toExport.length === 0) return;
    downloadCSV(toExport, `${selectedBatchId}_clean_records.csv`);
    showSuccess(`Exported ${toExport.length} clean record${toExport.length !== 1 ? 's' : ''}`);
  }

  function handleExportFixed() {
    const toExport = selectedIds.size > 0
      ? fixedRows.filter((r) => selectedIds.has(r.id))
      : fixedRows;
    if (toExport.length === 0) return;
    downloadCSV(toExport, `${selectedBatchId}_fixed_records.csv`);
    showSuccess(`Exported ${toExport.length} fixed record${toExport.length !== 1 ? 's' : ''}`);
  }

  function handleExportAll() {
    const toExport = selectedIds.size > 0
      ? rows.filter((r) => selectedIds.has(r.id))
      : rows;
    if (toExport.length === 0) return;
    downloadCSV(toExport, `${selectedBatchId}_all_records.csv`);
    showSuccess(`Exported ${toExport.length} record${toExport.length !== 1 ? 's' : ''}`);
  }

  function showSuccess(msg: string) {
    setExportSuccess(msg);
    setTimeout(() => setExportSuccess(null), 3000);
  }

  const selectedCount = selectedIds.size;
  const allSelected = filteredRows.length > 0 && selectedIds.size === filteredRows.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Icon name="LoaderIcon" size={28} className="text-[#8B1A2B] animate-spin" />
          <p className="text-sm text-[hsl(215,15%,52%)]">Loading batch records…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Toast */}
      {exportSuccess && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-top-2">
          <Icon name="CheckCircleIcon" size={16} />
          {exportSuccess}
        </div>
      )}

      {/* Inline fix modal */}
      {fixingRow && (
        <InlineFixModal
          row={fixingRow}
          onSave={applyFix}
          onClose={() => setFixingRow(null)}
        />
      )}

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/data-validation" className="text-xs text-[hsl(215,15%,52%)] hover:text-[#8B1A2B] transition-colors flex items-center gap-1">
              <Icon name="ChevronLeftIcon" size={12} />
              Data Validation
            </Link>
            <span className="text-xs text-[hsl(215,15%,62%)]">/</span>
            <span className="text-xs text-[hsl(215,25%,30%)] font-medium">Batch Export & Fix</span>
          </div>
          <h1 className="text-xl font-bold text-[hsl(215,25%,18%)]">Batch Export & Inline Fix</h1>
          <p className="text-sm text-[hsl(215,15%,52%)] mt-0.5">
            Bulk-export clean records or fix failed rows directly from import batch details
          </p>
        </div>
        <Link
          href="/import-batch-detail"
          className="flex items-center gap-1.5 text-xs font-medium text-[hsl(215,25%,30%)] bg-white border border-[hsl(214,20%,88%)] px-3 py-2 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors"
        >
          <Icon name="EyeIcon" size={13} />
          View Batch Detail
        </Link>
      </div>

      {/* Batch selector */}
      <div className="bg-white rounded-2xl border border-[hsl(214,20%,88%)] p-5">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Icon name="DatabaseIcon" size={16} className="text-[hsl(215,15%,52%)]" />
            <span className="text-sm font-medium text-[hsl(215,25%,18%)]">Import Batch</span>
          </div>
          <select
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
            className="flex-1 min-w-48 px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B]/40"
          >
            {ALL_BATCHES.map((b) => (
              <option key={b.id} value={b.id}>
                {b.id} — {b.filename}
              </option>
            ))}
          </select>
          {meta && (
            <div className="flex items-center gap-1.5 text-xs text-[hsl(215,15%,52%)]">
              <Icon name="CalendarIcon" size={12} />
              {formatDate(meta.importedAt)}
              <span className="mx-1 text-[hsl(214,20%,80%)]">·</span>
              <Icon name="UserIcon" size={12} />
              {meta.importedBy}
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      {meta && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Records', value: meta.totalRecords.toLocaleString(), icon: 'FileTextIcon', color: 'text-[hsl(215,25%,18%)]', bg: 'bg-[hsl(210,15%,96%)]', border: 'border-[hsl(214,20%,88%)]' },
            { label: 'Clean', value: cleanRows.length.toLocaleString(), icon: 'CheckCircleIcon', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
            { label: 'Failed', value: failedRows.length.toLocaleString(), icon: 'XCircleIcon', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
            { label: 'Fixed', value: fixedRows.length.toLocaleString(), icon: 'WrenchIcon', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border ${s.border} ${s.bg} px-4 py-3 flex items-center gap-3`}>
              <Icon name={s.icon as Parameters<typeof Icon>[0]['name']} size={18} className={s.color} />
              <div>
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-[hsl(215,15%,52%)]">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-[hsl(214,20%,88%)] px-4 py-3 flex items-center gap-3 flex-wrap">
        {/* Filter */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Icon name="FilterIcon" size={14} className="text-[hsl(215,15%,52%)]" />
          <span className="text-xs font-medium text-[hsl(215,25%,30%)]">Filter:</span>
        </div>
        {(['all', 'clean', 'failed', 'fixed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => { setFilterStatus(f); setSelectedIds(new Set()); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors capitalize ${
              filterStatus === f
                ? 'bg-[#8B1A2B] text-white border-[#8B1A2B]'
                : 'bg-white text-[hsl(215,25%,30%)] border-[hsl(214,20%,88%)] hover:bg-[hsl(210,15%,94%)]'
            }`}
          >
            {f === 'all' ? `All (${rows.length})` : f === 'clean' ? `Clean (${cleanRows.length})` : f === 'failed' ? `Failed (${failedRows.length})` : `Fixed (${fixedRows.length})`}
          </button>
        ))}

        <div className="flex-1" />

        {/* Selection info */}
        {selectedCount > 0 && (
          <span className="text-xs text-[hsl(215,15%,52%)] flex items-center gap-1">
            <Icon name="CheckSquareIcon" size={13} />
            {selectedCount} selected
          </span>
        )}

        {/* Export actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportClean}
            disabled={cleanRows.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Icon name="DownloadIcon" size={13} />
            Export Clean
          </button>
          <button
            onClick={handleExportFixed}
            disabled={fixedRows.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Icon name="DownloadIcon" size={13} />
            Export Fixed
          </button>
          <button
            onClick={handleExportAll}
            disabled={rows.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#8B1A2B] border border-[#8B1A2B] rounded-lg hover:bg-[#7a1726] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Icon name="DownloadIcon" size={13} />
            Export All
          </button>
        </div>
      </div>

      {/* Rows list */}
      <div className="bg-white rounded-2xl border border-[hsl(214,20%,88%)] overflow-hidden">
        {/* List header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(214,20%,88%)] bg-[hsl(210,15%,97%)]">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
            className="w-4 h-4 rounded border-[hsl(214,20%,70%)] accent-[#8B1A2B] cursor-pointer"
          />
          <span className="text-xs font-semibold text-[hsl(215,25%,30%)] uppercase tracking-wide">
            {filteredRows.length} row{filteredRows.length !== 1 ? 's' : ''}
            {filterStatus !== 'all' ? ` · ${filterStatus}` : ''}
          </span>
          {selectedCount > 0 && (
            <span className="ml-auto text-xs text-[hsl(215,15%,52%)]">
              {selectedCount} of {filteredRows.length} selected
            </span>
          )}
        </div>

        {filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[hsl(210,15%,94%)] flex items-center justify-center">
              <Icon name="InboxIcon" size={22} className="text-[hsl(215,15%,62%)]" />
            </div>
            <p className="text-sm font-medium text-[hsl(215,25%,30%)]">No rows match this filter</p>
            <p className="text-xs text-[hsl(215,15%,52%)]">Try selecting a different status filter above</p>
          </div>
        ) : (
          <div className="divide-y divide-[hsl(214,20%,92%)]">
            {filteredRows.map((row) => (
              <div key={row.id} className="px-4 py-2">
                <RowCard
                  row={row}
                  selected={selectedIds.has(row.id)}
                  onSelect={toggleSelect}
                  onFix={(r) => setFixingRow(r)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom export summary */}
      {(cleanRows.length > 0 || fixedRows.length > 0) && (
        <div className="bg-[hsl(210,15%,97%)] rounded-2xl border border-[hsl(214,20%,88%)] px-5 py-4">
          <p className="text-xs font-semibold text-[hsl(215,25%,30%)] uppercase tracking-wide mb-3">Export Summary</p>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-sm text-[hsl(215,25%,18%)]">
                <strong>{cleanRows.length}</strong> clean record{cleanRows.length !== 1 ? 's' : ''} ready to export
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-sm text-[hsl(215,25%,18%)]">
                <strong>{failedRows.length}</strong> failed row{failedRows.length !== 1 ? 's' : ''} need fixing
              </span>
            </div>
            {fixedRows.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-sm text-[hsl(215,25%,18%)]">
                  <strong>{fixedRows.length}</strong> row{fixedRows.length !== 1 ? 's' : ''} fixed — ready to re-import
                </span>
              </div>
            )}
          </div>
          {fixedRows.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[hsl(214,20%,88%)] flex items-center gap-2">
              <Icon name="InfoIcon" size={13} className="text-blue-500 flex-shrink-0" />
              <p className="text-xs text-[hsl(215,15%,52%)]">
                Export fixed rows as CSV, then re-import via <Link href="/data-import-export" className="text-[#8B1A2B] hover:underline font-medium">Data Import / Export</Link> to apply corrections.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
