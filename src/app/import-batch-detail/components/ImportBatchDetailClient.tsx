'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type ErrorType = 'null_field' | 'validation' | 'format' | 'reference';
type RowSeverity = 'critical' | 'warn' | 'info';

interface FieldIssue {
  field: string;
  label: string;
  type: ErrorType;
  message: string;
  value?: string;
}

interface ProblematicRow {
  id: string;
  rowNumber: number;
  propertyRef: string;
  issues: FieldIssue[];
  severity: RowSeverity;
  nullFields: string[];
  validationErrors: string[];
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
  notes?: string;
}

interface NullSummary {
  field: string;
  label: string;
  count: number;
  pct: number;
}

// ─── Mock data per batch ──────────────────────────────────────────────────────

const MOCK_BATCHES: Record<string, { meta: BatchMeta; rows: ProblematicRow[]; nullSummary: NullSummary[] }> = {
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
      notes: 'First bulk import — Discovery Bay Phase 1–8',
    },
    rows: [
      {
        id: 'r-001-142',
        rowNumber: 142,
        propertyRef: 'DB-PH1-142',
        severity: 'critical',
        nullFields: [],
        validationErrors: ['lease_end', 'asking_rent'],
        issues: [
          { field: 'lease_end', label: 'Lease End', type: 'validation', message: 'lease_end (2025-05-31) is before lease_start (2026-06-01)', value: '2025-05-31' },
          { field: 'asking_rent', label: 'Asking Rent', type: 'format', message: 'Value "HK$25,000" contains non-numeric characters — strip currency symbols before import', value: 'HK$25,000' },
        ],
      },
      {
        id: 'r-001-389',
        rowNumber: 389,
        propertyRef: 'DB-PH3-389',
        severity: 'warn',
        nullFields: ['floor_type'],
        validationErrors: [],
        issues: [
          { field: 'floor_type', label: 'Floor Type', type: 'null_field', message: 'floor_type is null — auto-derived from prop_type + floor number', value: null as unknown as string },
        ],
      },
      {
        id: 'r-001-712',
        rowNumber: 712,
        propertyRef: 'DB-PH5-712',
        severity: 'warn',
        nullFields: [],
        validationErrors: ['landlord_email'],
        issues: [
          { field: 'landlord_email', label: 'Landlord Email', type: 'validation', message: 'Invalid email format: "not-an-email"', value: 'not-an-email' },
        ],
      },
      {
        id: 'r-001-1901',
        rowNumber: 1901,
        propertyRef: 'DB-PH8-1901',
        severity: 'critical',
        nullFields: ['build_year', 'direction_id'],
        validationErrors: ['status'],
        issues: [
          { field: 'status', label: 'Status', type: 'validation', message: 'Unrecognised status value "pending" — must be: available, let, under_offer, withdrawn, sold', value: 'pending' },
          { field: 'build_year', label: 'Build Year', type: 'null_field', message: 'build_year is null — will be updated manually', value: null as unknown as string },
          { field: 'direction_id', label: 'Direction', type: 'null_field', message: 'direction_id is null — no direction data in source file', value: null as unknown as string },
        ],
      },
    ],
    nullSummary: [
      { field: 'build_year', label: 'Build Year', count: 2450, pct: 100 },
      { field: 'direction_id', label: 'Direction', count: 1180, pct: 48.2 },
      { field: 'view_id', label: 'View', count: 980, pct: 40.0 },
      { field: 'floor_type', label: 'Floor Type', count: 320, pct: 13.1 },
      { field: 'asking_price', label: 'Asking Price', count: 1225, pct: 50.0 },
      { field: 'p_english', label: 'English Desc.', count: 2100, pct: 85.7 },
    ],
  },
  'imp-002': {
    meta: {
      id: 'imp-002',
      filename: 'db_photos_batch1.zip',
      importedAt: '2026-05-01T11:30:05Z',
      importedBy: 'admin@homesrus.hk',
      totalRecords: 1820,
      successCount: 1743,
      errorCount: 35,
      skippedCount: 42,
      notes: 'Photos matched by filename short code',
    },
    rows: [
      {
        id: 'r-002-1',
        rowNumber: 1,
        propertyRef: 'AMF99-photo1.jpg',
        severity: 'critical',
        nullFields: [],
        validationErrors: ['short_code'],
        issues: [
          { field: 'short_code', label: 'Short Code', type: 'reference', message: 'No matching property found for short code "AMF99" — property may not exist in database', value: 'AMF99' },
        ],
      },
      {
        id: 'r-002-2',
        rowNumber: 2,
        propertyRef: 'BAY_exterior.jpg',
        severity: 'critical',
        nullFields: ['short_code'],
        validationErrors: [],
        issues: [
          { field: 'short_code', label: 'Short Code', type: 'null_field', message: 'Filename "BAY_exterior.jpg" does not contain a recognisable short code prefix', value: 'BAY_exterior.jpg' },
        ],
      },
      {
        id: 'r-002-3',
        rowNumber: 3,
        propertyRef: '35 oversized files',
        severity: 'warn',
        nullFields: [],
        validationErrors: ['file_size'],
        issues: [
          { field: 'file_size', label: 'File Size', type: 'validation', message: '35 photos exceeded the 5 MB size limit and were skipped — compress images before re-import', value: '>5 MB' },
        ],
      },
    ],
    nullSummary: [
      { field: 'short_code', label: 'Short Code', count: 1, pct: 0.1 },
    ],
  },
  'imp-003': {
    meta: {
      id: 'imp-003',
      filename: 'discovery_bay_properties_batch2.csv',
      importedAt: '2026-05-02T08:05:11Z',
      importedBy: 'admin@homesrus.hk',
      totalRecords: 3100,
      successCount: 3100,
      errorCount: 0,
      skippedCount: 0,
    },
    rows: [],
    nullSummary: [
      { field: 'build_year', label: 'Build Year', count: 3100, pct: 100 },
      { field: 'p_english', label: 'English Desc.', count: 2100, pct: 67.7 },
      { field: 'asking_price', label: 'Asking Price', count: 1875, pct: 60.5 },
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
        severity: 'critical',
        nullFields: ['property_ref'],
        validationErrors: [],
        issues: [
          { field: 'property_ref', label: 'Property Ref', type: 'null_field', message: 'Required column "property_ref" is empty — cannot match to existing property', value: '' },
        ],
      },
      {
        id: 'r-004-88',
        rowNumber: 88,
        propertyRef: 'DB-PH2-088',
        severity: 'critical',
        nullFields: [],
        validationErrors: ['asking_rent', 'lease_start'],
        issues: [
          { field: 'asking_rent', label: 'Asking Rent', type: 'validation', message: 'Must be a positive number — received "-500"', value: '-500' },
          { field: 'lease_start', label: 'Lease Start', type: 'format', message: 'Invalid date format "not-a-date" — use YYYY-MM-DD', value: 'not-a-date' },
        ],
      },
      {
        id: 'r-004-201',
        rowNumber: 201,
        propertyRef: 'DB-PH4-201',
        severity: 'warn',
        nullFields: ['furn_id', 'floor_type'],
        validationErrors: [],
        issues: [
          { field: 'furn_id', label: 'Furnishing', type: 'null_field', message: 'furn_id is null — defaulted to "unfurnished"', value: null as unknown as string },
          { field: 'floor_type', label: 'Floor Type', type: 'null_field', message: 'floor_type is null — auto-derived from prop_type + floor number', value: null as unknown as string },
        ],
      },
      {
        id: 'r-004-445',
        rowNumber: 445,
        propertyRef: 'DB-PH6-445',
        severity: 'warn',
        nullFields: ['list_type'],
        validationErrors: [],
        issues: [
          { field: 'list_type', label: 'List Type', type: 'null_field', message: 'list_type is null — defaulted to "unknown"', value: null as unknown as string },
        ],
      },
    ],
    nullSummary: [
      { field: 'property_ref', label: 'Property Ref', count: 23, pct: 4.0 },
      { field: 'furn_id', label: 'Furnishing', count: 145, pct: 25.0 },
      { field: 'list_type', label: 'List Type', count: 210, pct: 36.2 },
      { field: 'floor_type', label: 'Floor Type', count: 180, pct: 31.0 },
      { field: 'build_year', label: 'Build Year', count: 580, pct: 100 },
    ],
  },
  'imp-005': {
    meta: {
      id: 'imp-005',
      filename: 'db_photos_batch2.zip',
      importedAt: '2026-05-02T16:45:00Z',
      importedBy: 'admin@homesrus.hk',
      totalRecords: 960,
      successCount: 960,
      errorCount: 0,
      skippedCount: 0,
    },
    rows: [],
    nullSummary: [],
  },
};

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
      return { label: 'Null Field', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', icon: 'MinusCircleIcon', iconColor: 'text-slate-500' };
    case 'validation':
      return { label: 'Validation', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: 'AlertCircleIcon', iconColor: 'text-red-500' };
    case 'format':
      return { label: 'Format', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: 'AlertTriangleIcon', iconColor: 'text-amber-500' };
    case 'reference':
      return { label: 'Reference', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', icon: 'LinkIcon', iconColor: 'text-purple-500' };
  }
}

function severityConfig(s: RowSeverity) {
  switch (s) {
    case 'critical':
      return { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500', label: 'Critical' };
    case 'warn':
      return { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-400', label: 'Warning' };
    case 'info':
      return { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-400', label: 'Info' };
  }
}

// ─── Row detail card ──────────────────────────────────────────────────────────

function RowDetailCard({ row, expanded, onToggle }: {
  row: ProblematicRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const sev = severityConfig(row.severity);
  const nullCount = row.issues.filter((i) => i.type === 'null_field').length;
  const errCount = row.issues.filter((i) => i.type !== 'null_field').length;

  return (
    <div className={`rounded-xl border ${sev.border} overflow-hidden transition-all`}>
      {/* Row header — always visible */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:brightness-95 transition-all ${sev.bg}`}
      >
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sev.dot}`} />
        <div className="w-8 h-8 rounded-lg bg-white/70 border border-white/50 flex items-center justify-center flex-shrink-0">
          <Icon name="FileTextIcon" size={15} className="text-[hsl(215,15%,52%)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[hsl(215,25%,18%)]">Row {row.rowNumber}</span>
            <span className="text-xs text-[hsl(215,15%,52%)] font-mono bg-white/60 px-1.5 py-0.5 rounded border border-white/40">
              {row.propertyRef}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${sev.badge}`}>
              {sev.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {nullCount > 0 && (
              <span className="text-xs text-slate-600 flex items-center gap-1">
                <Icon name="MinusCircleIcon" size={11} />
                {nullCount} null {nullCount === 1 ? 'field' : 'fields'}
              </span>
            )}
            {errCount > 0 && (
              <span className="text-xs text-red-600 flex items-center gap-1">
                <Icon name="AlertCircleIcon" size={11} />
                {errCount} validation {errCount === 1 ? 'error' : 'errors'}
              </span>
            )}
          </div>
        </div>
        <Icon
          name={expanded ? 'ChevronUpIcon' : 'ChevronDownIcon'}
          size={16}
          className="text-[hsl(215,15%,52%)] flex-shrink-0"
        />
      </button>

      {/* Expanded issues */}
      {expanded && (
        <div className="bg-white border-t border-[hsl(214,20%,92%)] px-4 py-4">
          <div className="flex flex-col gap-2.5">
            {row.issues.map((issue, idx) => {
              const cfg = errorTypeConfig(issue.type);
              return (
                <div
                  key={idx}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${cfg.bg} ${cfg.border}`}
                >
                  <Icon name={cfg.icon as Parameters<typeof Icon>[0]['name']} size={15} className={`${cfg.iconColor} mt-0.5 flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-semibold ${cfg.text}`}>{issue.label}</span>
                      <span className="text-xs text-[hsl(215,15%,62%)] font-mono">({issue.field})</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-[hsl(215,25%,30%)] leading-relaxed">{issue.message}</p>
                    {issue.value !== undefined && issue.value !== null && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-xs text-[hsl(215,15%,52%)]">Value in file:</span>
                        <code className="text-xs bg-white border border-[hsl(214,20%,88%)] px-1.5 py-0.5 rounded text-[hsl(215,25%,18%)]">
                          {issue.value === '' ? <em className="text-[hsl(215,15%,62%)]">(empty)</em> : issue.value}
                        </code>
                      </div>
                    )}
                    {(issue.value === null || issue.value === undefined) && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-xs text-[hsl(215,15%,52%)]">Value in file:</span>
                        <code className="text-xs bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded text-slate-500 italic">NULL</code>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Null summary bar ─────────────────────────────────────────────────────────

function NullBar({ stat }: { stat: NullSummary }) {
  const pct = stat.pct;
  const color = pct > 50 ? 'bg-red-500' : pct > 20 ? 'bg-amber-400' : 'bg-slate-400';
  const textColor = pct > 50 ? 'text-red-700' : pct > 20 ? 'text-amber-700' : 'text-slate-600';

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-32 flex-shrink-0">
        <span className="text-xs font-medium text-[hsl(215,25%,18%)]">{stat.label}</span>
        <span className="block text-xs text-[hsl(215,15%,62%)] font-mono">{stat.field}</span>
      </div>
      <div className="flex-1 bg-[hsl(210,15%,94%)] rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <div className="w-32 flex-shrink-0 flex items-center justify-end gap-2">
        <span className={`text-xs font-bold ${textColor}`}>{pct.toFixed(1)}%</span>
        <span className="text-xs text-[hsl(215,15%,52%)]">{stat.count.toLocaleString()} rows</span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ImportBatchDetailClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const batchId = searchParams.get('batch') ?? 'imp-001';

  const [batchData, setBatchData] = useState<typeof MOCK_BATCHES[string] | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'rows' | 'nulls'>('rows');
  const [filterType, setFilterType] = useState<'all' | 'null_field' | 'validation' | 'format' | 'reference'>('all');
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'critical' | 'warn'>('all');

  useEffect(() => {
    loadBatchDetail();
  }, [batchId]);

  async function loadBatchDetail() {
    setLoading(true);
    try {
      const supabase = createClient();

      // Try to fetch from import_history table
      const { data: batchRow } = await supabase
        .from('import_history')
        .select('*')
        .eq('id', batchId)
        .single();

      if (batchRow) {
        // Build from real data — errors array contains the row-level issues
        const errors: Array<{ row?: number; field?: string; message: string }> = batchRow.errors ?? [];
        const rows: ProblematicRow[] = errors
          .filter((e) => e.row !== undefined)
          .map((e, idx) => ({
            id: `${batchId}-${idx}`,
            rowNumber: e.row!,
            propertyRef: `Row ${e.row}`,
            severity: 'critical' as RowSeverity,
            nullFields: [],
            validationErrors: e.field ? [e.field] : [],
            issues: [{
              field: e.field ?? 'unknown',
              label: e.field ?? 'Unknown Field',
              type: 'validation' as ErrorType,
              message: e.message,
              value: undefined,
            }],
          }));

        setBatchData({
          meta: {
            id: batchRow.id,
            filename: batchRow.filename,
            importedAt: batchRow.imported_at,
            importedBy: batchRow.imported_by ?? 'system',
            totalRecords: batchRow.total_records ?? 0,
            successCount: batchRow.success_count ?? 0,
            errorCount: batchRow.error_count ?? 0,
            skippedCount: batchRow.skipped_count ?? 0,
            notes: batchRow.notes,
          },
          rows,
          nullSummary: [],
        });
        return;
      }
    } catch {
      // fall through to mock
    }

    // Fallback to mock data
    const mock = MOCK_BATCHES[batchId] ?? MOCK_BATCHES['imp-001'];
    setBatchData(mock);
    // Auto-expand first row
    if (mock.rows.length > 0) {
      setExpandedRows(new Set([mock.rows[0].id]));
    }
    setLoading(false);
  }

  useEffect(() => {
    if (batchData) setLoading(false);
  }, [batchData]);

  const toggleRow = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = () => {
    if (!batchData) return;
    setExpandedRows(new Set(batchData.rows.map((r) => r.id)));
  };

  const collapseAll = () => setExpandedRows(new Set());

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Icon name="LoaderIcon" size={28} className="text-[#8B1A2B] animate-spin" />
          <p className="text-sm text-[hsl(215,15%,52%)]">Loading batch details…</p>
        </div>
      </div>
    );
  }

  if (!batchData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Icon name="AlertCircleIcon" size={32} className="text-red-400" />
        <p className="text-sm text-[hsl(215,15%,52%)]">Batch not found.</p>
        <Link href="/data-validation" className="text-sm text-[#8B1A2B] hover:underline">
          ← Back to Data Validation
        </Link>
      </div>
    );
  }

  const { meta, rows, nullSummary } = batchData;

  // Filter rows
  const filteredRows = rows.filter((row) => {
    if (filterSeverity !== 'all' && row.severity !== filterSeverity) return false;
    if (filterType !== 'all') {
      return row.issues.some((i) => i.type === filterType);
    }
    return true;
  });

  const criticalCount = rows.filter((r) => r.severity === 'critical').length;
  const warnCount = rows.filter((r) => r.severity === 'warn').length;
  const nullFieldCount = rows.reduce((s, r) => s + r.issues.filter((i) => i.type === 'null_field').length, 0);
  const validationErrCount = rows.reduce((s, r) => s + r.issues.filter((i) => i.type !== 'null_field').length, 0);

  const successPct = meta.totalRecords > 0
    ? Math.round((meta.successCount / meta.totalRecords) * 100)
    : 0;

  const tabs = [
    { id: 'rows' as const, label: `Failed Rows (${rows.length})`, icon: 'AlertCircleIcon' },
    { id: 'nulls' as const, label: `Null Field Summary (${nullSummary.length})`, icon: 'MinusCircleIcon' },
  ];

  return (
    <div className="flex flex-col h-full bg-[hsl(210,20%,97%)]">
      {/* Header */}
      <div className="bg-white border-b border-[hsl(214,20%,88%)] px-6 py-4 flex-shrink-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-[hsl(215,15%,52%)] mb-3">
          <Link href="/data-validation" className="hover:text-[#8B1A2B] transition-colors flex items-center gap-1">
            <Icon name="ShieldCheckIcon" size={12} />
            Data Validation
          </Link>
          <Icon name="ChevronRightIcon" size={12} />
          <span className="text-[hsl(215,25%,18%)] font-medium truncate max-w-xs">{meta.filename}</span>
        </div>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.errorCount > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
              <Icon
                name={meta.filename.endsWith('.zip') ? 'ImageIcon' : 'FileSpreadsheetIcon'}
                size={20}
                className={meta.errorCount > 0 ? 'text-red-500' : 'text-emerald-600'}
              />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[hsl(215,25%,18%)] truncate max-w-lg">{meta.filename}</h1>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                <span className="text-xs text-[hsl(215,15%,52%)] flex items-center gap-1">
                  <Icon name="CalendarIcon" size={11} />
                  {formatDate(meta.importedAt)}
                </span>
                <span className="text-xs text-[hsl(215,15%,52%)] flex items-center gap-1">
                  <Icon name="UserIcon" size={11} />
                  {meta.importedBy}
                </span>
                {meta.notes && (
                  <span className="text-xs text-[hsl(215,15%,52%)] flex items-center gap-1">
                    <Icon name="InfoIcon" size={11} />
                    {meta.notes}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Link
            href="/data-validation"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[hsl(215,25%,18%)] bg-white border border-[hsl(214,20%,88%)] rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors flex-shrink-0"
          >
            <Icon name="ArrowLeftIcon" size={14} />
            Back
          </Link>
        </div>

        {/* Batch stats bar */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[hsl(210,20%,97%)] rounded-lg border border-[hsl(214,20%,88%)] px-3 py-2.5 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Icon name="DatabaseIcon" size={14} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-[hsl(215,25%,18%)]">{meta.totalRecords.toLocaleString()}</p>
              <p className="text-xs text-[hsl(215,15%,52%)]">Total Rows</p>
            </div>
          </div>
          <div className="bg-[hsl(210,20%,97%)] rounded-lg border border-[hsl(214,20%,88%)] px-3 py-2.5 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <Icon name="CheckCircleIcon" size={14} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-700">{meta.successCount.toLocaleString()}</p>
              <p className="text-xs text-[hsl(215,15%,52%)]">Succeeded ({successPct}%)</p>
            </div>
          </div>
          <div className="bg-[hsl(210,20%,97%)] rounded-lg border border-[hsl(214,20%,88%)] px-3 py-2.5 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-red-50 flex items-center justify-center flex-shrink-0">
              <Icon name="XCircleIcon" size={14} className="text-red-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-red-700">{meta.errorCount.toLocaleString()}</p>
              <p className="text-xs text-[hsl(215,15%,52%)]">Errors</p>
            </div>
          </div>
          <div className="bg-[hsl(210,20%,97%)] rounded-lg border border-[hsl(214,20%,88%)] px-3 py-2.5 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-amber-50 flex items-center justify-center flex-shrink-0">
              <Icon name="MinusCircleIcon" size={14} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-700">{meta.skippedCount.toLocaleString()}</p>
              <p className="text-xs text-[hsl(215,15%,52%)]">Skipped</p>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 flex h-2 rounded-full overflow-hidden bg-[hsl(210,15%,94%)] gap-0.5">
          {meta.totalRecords > 0 && (
            <>
              <div className="bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${(meta.successCount / meta.totalRecords) * 100}%` }} />
              {meta.skippedCount > 0 && (
                <div className="bg-amber-400 rounded-full" style={{ width: `${(meta.skippedCount / meta.totalRecords) * 100}%` }} />
              )}
              {meta.errorCount > 0 && (
                <div className="bg-red-500 rounded-full" style={{ width: `${(meta.errorCount / meta.totalRecords) * 100}%` }} />
              )}
            </>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#8B1A2B]/10 text-[#8B1A2B]'
                  : 'text-[hsl(215,15%,52%)] hover:bg-[hsl(210,15%,94%)]'
              }`}
            >
              <Icon name={tab.icon as Parameters<typeof Icon>[0]['name']} size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* ── FAILED ROWS TAB ── */}
        {activeTab === 'rows' && (
          <div className="flex flex-col gap-4">
            {/* Issue type summary chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-white border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2">
                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                <span className="text-xs font-medium text-[hsl(215,25%,18%)]">{criticalCount} Critical</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                <span className="text-xs font-medium text-[hsl(215,25%,18%)]">{warnCount} Warnings</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2">
                <Icon name="MinusCircleIcon" size={13} className="text-slate-500" />
                <span className="text-xs font-medium text-[hsl(215,25%,18%)]">{nullFieldCount} Null Fields</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2">
                <Icon name="AlertCircleIcon" size={13} className="text-red-500" />
                <span className="text-xs font-medium text-[hsl(215,25%,18%)]">{validationErrCount} Validation Errors</span>
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] py-16 flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
                  <Icon name="CheckCircleIcon" size={28} className="text-emerald-500" />
                </div>
                <p className="text-base font-semibold text-[hsl(215,25%,18%)]">No failed rows</p>
                <p className="text-sm text-[hsl(215,15%,52%)]">All {meta.totalRecords.toLocaleString()} rows imported successfully.</p>
              </div>
            ) : (
              <>
                {/* Toolbar */}
                <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] px-4 py-3 flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Icon name="FilterIcon" size={14} className="text-[hsl(215,15%,52%)]" />
                    <span className="text-xs text-[hsl(215,15%,52%)]">Severity:</span>
                    {(['all', 'critical', 'warn'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setFilterSeverity(s)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors capitalize ${
                          filterSeverity === s
                            ? 'bg-[#8B1A2B]/10 text-[#8B1A2B] border-[#8B1A2B]/20'
                            : 'bg-white text-[hsl(215,15%,52%)] border-[hsl(214,20%,88%)] hover:bg-[hsl(210,15%,94%)]'
                        }`}
                      >
                        {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div className="h-4 w-px bg-[hsl(214,20%,88%)]" />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[hsl(215,15%,52%)]">Type:</span>
                    {(['all', 'null_field', 'validation', 'format', 'reference'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setFilterType(t)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                          filterType === t
                            ? 'bg-[#8B1A2B]/10 text-[#8B1A2B] border-[#8B1A2B]/20'
                            : 'bg-white text-[hsl(215,15%,52%)] border-[hsl(214,20%,88%)] hover:bg-[hsl(210,15%,94%)]'
                        }`}
                      >
                        {t === 'all' ? 'All' : t === 'null_field' ? 'Null Fields' : t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={expandAll}
                      className="text-xs text-[hsl(215,15%,52%)] hover:text-[#8B1A2B] transition-colors"
                    >
                      Expand all
                    </button>
                    <span className="text-[hsl(214,20%,88%)]">·</span>
                    <button
                      onClick={collapseAll}
                      className="text-xs text-[hsl(215,15%,52%)] hover:text-[#8B1A2B] transition-colors"
                    >
                      Collapse all
                    </button>
                    <span className="text-xs text-[hsl(215,15%,52%)] ml-2">
                      {filteredRows.length} of {rows.length} rows
                    </span>
                  </div>
                </div>

                {/* Row cards */}
                <div className="flex flex-col gap-2.5">
                  {filteredRows.length === 0 ? (
                    <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] py-10 flex flex-col items-center gap-2">
                      <Icon name="SearchIcon" size={24} className="text-[hsl(215,15%,72%)]" />
                      <p className="text-sm text-[hsl(215,15%,52%)]">No rows match the current filters.</p>
                    </div>
                  ) : (
                    filteredRows.map((row) => (
                      <RowDetailCard
                        key={row.id}
                        row={row}
                        expanded={expandedRows.has(row.id)}
                        onToggle={() => toggleRow(row.id)}
                      />
                    ))
                  )}
                </div>

                {/* Fix guidance */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
                  <Icon name="InfoIcon" size={15} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <span className="font-semibold">To fix these rows:</span> Correct the highlighted fields in your source CSV, then re-import the file via{' '}
                    <Link href="/data-import-export" className="underline hover:text-blue-900">Data Import &amp; Export</Link>.
                    Rows with only null fields (auto-defaulted) were still imported — no action needed.
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── NULL FIELD SUMMARY TAB ── */}
        {activeTab === 'nulls' && (
          <div className="flex flex-col gap-4">
            {nullSummary.length === 0 ? (
              <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] py-16 flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
                  <Icon name="CheckCircleIcon" size={28} className="text-emerald-500" />
                </div>
                <p className="text-base font-semibold text-[hsl(215,25%,18%)]">No null field issues</p>
                <p className="text-sm text-[hsl(215,15%,52%)]">All fields were populated in this batch.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[hsl(214,20%,88%)]">
                  <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">Null Fields in This Batch</p>
                  <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">
                    Fields with null/missing values across {meta.totalRecords.toLocaleString()} rows in <span className="font-medium">{meta.filename}</span>
                  </p>
                </div>
                <div className="divide-y divide-[hsl(214,20%,92%)] px-5">
                  {[...nullSummary]
                    .sort((a, b) => b.pct - a.pct)
                    .map((stat) => (
                      <NullBar key={stat.field} stat={stat} />
                    ))}
                </div>
                <div className="px-5 py-3 bg-[hsl(210,20%,97%)] border-t border-[hsl(214,20%,88%)]">
                  <p className="text-xs text-[hsl(215,15%,52%)]">
                    <span className="font-medium text-amber-700">Note:</span> Fields with &gt;50% null rate are shown in red. Fields auto-defaulted (furn_id → unfurnished, list_type → unknown, floor_type → derived) are expected to appear here.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
