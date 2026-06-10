'use client';

import React, { useState, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldError = {
  field: string;
  message: string;
};

type RowStatus = 'failed' | 'editing' | 'fixed' | 'retrying' | 'resolved';

interface FailedRow {
  id: string;
  rowNumber: number;
  importFile: string;
  importId: string;
  data: Record<string, string>;
  errors: FieldError[];
  status: RowStatus;
}

// ─── Field validation rules ───────────────────────────────────────────────────

const FIELD_VALIDATORS: Record<string, (val: string) => string | null> = {
  property_ref: (v) => v.trim() ? null : 'Property reference is required',
  asking_rent: (v) => {
    if (!v.trim()) return 'Asking rent is required';
    const n = parseFloat(v.replace(/[^0-9.]/g, ''));
    if (isNaN(n) || n <= 0) return 'Must be a positive number (e.g. 25000)';
    return null;
  },
  landlord_email: (v) => {
    if (!v.trim()) return null; // optional
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Invalid email format';
  },
  lease_start: (v) => {
    if (!v.trim()) return 'Lease start date is required';
    return isNaN(Date.parse(v)) ? 'Invalid date format (use YYYY-MM-DD)' : null;
  },
  lease_end: (v, row?: Record<string, string>) => {
    if (!v.trim()) return 'Lease end date is required';
    if (isNaN(Date.parse(v))) return 'Invalid date format (use YYYY-MM-DD)';
    if (row?.lease_start && new Date(v) <= new Date(row.lease_start)) {
      return 'Lease end must be after lease start';
    }
    return null;
  },
  status: (v) => {
    const valid = ['available', 'let', 'under_offer', 'withdrawn', 'sold'];
    return valid.includes(v.toLowerCase()) ? null : `Must be one of: ${valid.join(', ')}`;
  },
};

function validateField(field: string, value: string, row: Record<string, string>): string | null {
  const validator = FIELD_VALIDATORS[field];
  if (!validator) return null;
  return validator(value, row);
}

function validateRow(data: Record<string, string>): FieldError[] {
  const errors: FieldError[] = [];
  for (const [field, value] of Object.entries(data)) {
    const msg = validateField(field, value, data);
    if (msg) errors.push({ field, message: msg });
  }
  return errors;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_FAILED_ROWS: FailedRow[] = [
  {
    id: 'row-001',
    rowNumber: 142,
    importFile: 'discovery_bay_properties_batch1.csv',
    importId: 'imp-001',
    data: {
      property_ref: 'DB-PH1-142',
      asking_rent: '25000',
      lease_start: '2026-06-01',
      lease_end: '2025-05-31',
      status: 'available',
      landlord_email: 'owner@example.com',
    },
    errors: [{ field: 'lease_end', message: 'lease_end is before lease_start' }],
    status: 'failed',
  },
  {
    id: 'row-002',
    rowNumber: 389,
    importFile: 'discovery_bay_properties_batch1.csv',
    importId: 'imp-001',
    data: {
      property_ref: 'DB-PH3-389',
      asking_rent: 'HK$25,000',
      lease_start: '2026-07-01',
      lease_end: '2027-06-30',
      status: 'available',
      landlord_email: 'landlord@db.hk',
    },
    errors: [{ field: 'asking_rent', message: 'Invalid number format: "HK$25,000"' }],
    status: 'failed',
  },
  {
    id: 'row-003',
    rowNumber: 712,
    importFile: 'discovery_bay_properties_batch1.csv',
    importId: 'imp-001',
    data: {
      property_ref: 'DB-PH5-712',
      asking_rent: '32000',
      lease_start: '2026-08-01',
      lease_end: '2027-07-31',
      status: 'available',
      landlord_email: 'not-an-email',
    },
    errors: [{ field: 'landlord_email', message: 'Invalid email format' }],
    status: 'failed',
  },
  {
    id: 'row-004',
    rowNumber: 1901,
    importFile: 'discovery_bay_properties_batch1.csv',
    importId: 'imp-001',
    data: {
      property_ref: 'DB-PH8-1901',
      asking_rent: '18500',
      lease_start: '2026-09-01',
      lease_end: '2027-08-31',
      status: 'pending',
      landlord_email: 'owner8@db.hk',
    },
    errors: [{ field: 'status', message: 'Unrecognised status value: "pending"' }],
    status: 'failed',
  },
  {
    id: 'row-005',
    rowNumber: 23,
    importFile: 'tenancy_updates_may2026.csv',
    importId: 'imp-003',
    data: {
      property_ref: '',
      asking_rent: '22000',
      lease_start: '2026-06-15',
      lease_end: '2027-06-14',
      status: 'let',
      landlord_email: 'owner23@db.hk',
    },
    errors: [{ field: 'property_ref', message: 'Required column "property_ref" is missing' }],
    status: 'failed',
  },
  {
    id: 'row-006',
    rowNumber: 88,
    importFile: 'tenancy_updates_may2026.csv',
    importId: 'imp-003',
    data: {
      property_ref: 'DB-PH2-088',
      asking_rent: '-500',
      lease_start: 'not-a-date',
      lease_end: '2027-01-01',
      status: 'available',
      landlord_email: 'owner88@db.hk',
    },
    errors: [
      { field: 'asking_rent', message: 'Must be a positive number' },
      { field: 'lease_start', message: 'Invalid date format (use YYYY-MM-DD)' },
    ],
    status: 'failed',
  },
];

const FIELD_LABELS: Record<string, string> = {
  property_ref: 'Property Ref',
  asking_rent: 'Asking Rent (HKD)',
  lease_start: 'Lease Start',
  lease_end: 'Lease End',
  status: 'Status',
  landlord_email: 'Landlord Email',
};

// ─── Row component ────────────────────────────────────────────────────────────

interface RowCardProps {
  row: FailedRow;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onEdit: (id: string, field: string, value: string) => void;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
}

function RowCard({ row, selected, onToggleSelect, onEdit, onRetry, onDiscard }: RowCardProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [localData, setLocalData] = useState<Record<string, string>>(row.data);
  const [liveErrors, setLiveErrors] = useState<Record<string, string>>({});

  const errorFields = new Set(row.errors.map((e) => e.field));

  const handleFieldChange = (field: string, value: string) => {
    const updated = { ...localData, [field]: value };
    setLocalData(updated);
    const msg = validateField(field, value, updated);
    setLiveErrors((prev) => {
      const next = { ...prev };
      if (msg) next[field] = msg;
      else delete next[field];
      return next;
    });
  };

  const handleFieldBlur = (field: string) => {
    setEditingField(null);
    onEdit(row.id, field, localData[field]);
  };

  const isResolved = row.status === 'resolved';
  const isRetrying = row.status === 'retrying';

  const statusConfig = {
    failed: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700', label: 'Failed' },
    editing: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', label: 'Editing' },
    fixed: { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700', label: 'Ready' },
    retrying: { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700', label: 'Retrying…' },
    resolved: { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', label: 'Resolved' },
  }[row.status];

  return (
    <div className={`rounded-xl border ${statusConfig.border} ${statusConfig.bg} overflow-hidden transition-all`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(row.id)}
          disabled={isResolved}
          className="w-4 h-4 rounded border-gray-300 text-[#8B1A2B] focus:ring-[#8B1A2B] cursor-pointer"
        />
        <div className="w-8 h-8 rounded-lg bg-white border border-[hsl(214,20%,88%)] flex items-center justify-center flex-shrink-0">
          <Icon name="FileTextIcon" size={16} className="text-[hsl(215,15%,52%)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[hsl(215,25%,18%)]">Row {row.rowNumber}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusConfig.badge}`}>{statusConfig.label}</span>
            {row.errors.length > 1 && (
              <span className="text-xs text-red-600 font-medium">{row.errors.length} errors</span>
            )}
          </div>
          <p className="text-xs text-[hsl(215,15%,52%)] truncate mt-0.5">{row.importFile}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!isResolved && (
            <>
              <button
                onClick={() => onRetry(row.id)}
                disabled={isRetrying || Object.keys(liveErrors).length > 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#8B1A2B] text-white rounded-lg hover:bg-[#7a1726] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Icon name="RefreshCwIcon" size={12} />
                {isRetrying ? 'Retrying…' : 'Retry'}
              </button>
              <button
                onClick={() => onDiscard(row.id)}
                className="p-1.5 rounded-lg hover:bg-white/60 transition-colors"
                title="Discard row"
              >
                <Icon name="XIcon" size={14} className="text-[hsl(215,15%,52%)]" />
              </button>
            </>
          )}
          {isResolved && (
            <Icon name="CheckCircleIcon" size={18} className="text-emerald-600" />
          )}
        </div>
      </div>

      {/* Fields grid */}
      {!isResolved && (
        <div className="px-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(localData).map(([field, value]) => {
              const hasError = errorFields.has(field) || !!liveErrors[field];
              const errorMsg = liveErrors[field] || row.errors.find((e) => e.field === field)?.message;
              const isActive = editingField === field;

              return (
                <div key={field} className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[hsl(215,15%,52%)] flex items-center gap-1">
                    {FIELD_LABELS[field] || field}
                    {hasError && <Icon name="AlertCircleIcon" size={11} className="text-red-500" />}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={value}
                      onFocus={() => setEditingField(field)}
                      onChange={(e) => handleFieldChange(field, e.target.value)}
                      onBlur={() => handleFieldBlur(field)}
                      className={`w-full text-sm px-3 py-2 rounded-lg border transition-all outline-none ${
                        hasError
                          ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-1 focus:ring-red-200'
                          : isActive
                          ? 'border-[#8B1A2B] bg-white focus:ring-1 focus:ring-[#8B1A2B]/20'
                          : 'border-[hsl(214,20%,88%)] bg-white hover:border-[hsl(214,20%,75%)]'
                      }`}
                    />
                    {hasError && !isActive && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <Icon name="AlertCircleIcon" size={14} className="text-red-400" />
                      </div>
                    )}
                    {!hasError && value.trim() && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <Icon name="CheckIcon" size={14} className="text-emerald-500" />
                      </div>
                    )}
                  </div>
                  {hasError && errorMsg && (
                    <p className="text-xs text-red-600 flex items-start gap-1">
                      <Icon name="AlertCircleIcon" size={11} className="mt-0.5 flex-shrink-0" />
                      {errorMsg}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FailedRowsClient() {
  const [rows, setRows] = useState<FailedRow[]>(MOCK_FAILED_ROWS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterFile, setFilterFile] = useState<string>('all');
  const [bulkRetrying, setBulkRetrying] = useState(false);
  const [retryComplete, setRetryComplete] = useState(false);

  const importFiles = Array.from(new Set(rows.map((r) => r.importFile)));

  const filteredRows = filterFile === 'all'
    ? rows
    : rows.filter((r) => r.importFile === filterFile);

  const activeRows = filteredRows.filter((r) => r.status !== 'resolved');
  const resolvedRows = filteredRows.filter((r) => r.status === 'resolved');

  const allActiveSelected = activeRows.length > 0 && activeRows.every((r) => selectedIds.has(r.id));

  const toggleSelectAll = () => {
    if (allActiveSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(activeRows.map((r) => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleEdit = useCallback((rowId: string, field: string, value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const updatedData = { ...r.data, [field]: value };
        const newErrors = validateRow(updatedData);
        return {
          ...r,
          data: updatedData,
          errors: newErrors,
          status: newErrors.length === 0 ? 'fixed' : 'editing',
        };
      })
    );
  }, []);

  const handleRetry = useCallback((rowId: string) => {
    setRows((prev) =>
      prev.map((r) => r.id === rowId ? { ...r, status: 'retrying' } : r)
    );
    setTimeout(() => {
      setRows((prev) =>
        prev.map((r) => r.id === rowId ? { ...r, status: 'resolved' } : r)
      );
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(rowId);
        return next;
      });
    }, 1200);
  }, []);

  const handleDiscard = useCallback((rowId: string) => {
    setRows((prev) => prev.filter((r) => r.id !== rowId));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(rowId);
      return next;
    });
  }, []);

  const handleBulkRetry = async () => {
    const toRetry = [...selectedIds];
    if (toRetry.length === 0) return;
    setBulkRetrying(true);

    // Mark all as retrying
    setRows((prev) =>
      prev.map((r) => toRetry.includes(r.id) ? { ...r, status: 'retrying' } : r)
    );

    // Simulate staggered resolution
    for (let i = 0; i < toRetry.length; i++) {
      await new Promise((res) => setTimeout(res, 400));
      const id = toRetry[i];
      setRows((prev) =>
        prev.map((r) => r.id === id ? { ...r, status: 'resolved' } : r)
      );
    }

    setSelectedIds(new Set());
    setBulkRetrying(false);
    setRetryComplete(true);
    setTimeout(() => setRetryComplete(false), 3000);
  };

  const totalFailed = rows.filter((r) => r.status !== 'resolved').length;
  const totalResolved = rows.filter((r) => r.status === 'resolved').length;
  const totalFixed = rows.filter((r) => r.status === 'fixed').length;
  const selectedCount = selectedIds.size;

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(215,25%,18%)]">Failed Import Rows</h1>
          <p className="text-sm text-[hsl(215,15%,52%)] mt-1">
            Review and correct rows that failed validation before re-uploading
          </p>
        </div>
        <div className="flex items-center gap-2">
          {retryComplete && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
              <Icon name="CheckCircleIcon" size={14} />
              Retry complete
            </span>
          )}
          <button
            onClick={handleBulkRetry}
            disabled={selectedCount === 0 || bulkRetrying}
            className="flex items-center gap-2 px-4 py-2 bg-[#8B1A2B] text-white text-sm font-medium rounded-lg hover:bg-[#7a1726] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Icon name="RefreshCwIcon" size={15} />
            {bulkRetrying ? `Retrying ${selectedCount}…` : `Bulk Retry${selectedCount > 0 ? ` (${selectedCount})` : ''}`}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
            <Icon name="XCircleIcon" size={18} className="text-red-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-[hsl(215,25%,18%)]">{totalFailed}</p>
            <p className="text-xs text-[hsl(215,15%,52%)]">Still Failed</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Icon name="PencilIcon" size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-[hsl(215,25%,18%)]">{totalFixed}</p>
            <p className="text-xs text-[hsl(215,15%,52%)]">Ready to Retry</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <Icon name="CheckCircleIcon" size={18} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-[hsl(215,25%,18%)]">{totalResolved}</p>
            <p className="text-xs text-[hsl(215,15%,52%)]">Resolved</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#8B1A2B]/10 flex items-center justify-center flex-shrink-0">
            <Icon name="ListChecksIcon" size={18} className="text-[#8B1A2B]" />
          </div>
          <div>
            <p className="text-xl font-bold text-[hsl(215,25%,18%)]">{selectedCount}</p>
            <p className="text-xs text-[hsl(215,15%,52%)]">Selected</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={allActiveSelected}
            onChange={toggleSelectAll}
            className="w-4 h-4 rounded border-gray-300 text-[#8B1A2B] focus:ring-[#8B1A2B] cursor-pointer"
          />
          <span className="text-sm text-[hsl(215,15%,52%)]">
            {selectedCount > 0 ? `${selectedCount} selected` : 'Select all'}
          </span>
        </div>
        <div className="h-4 w-px bg-[hsl(214,20%,88%)]" />
        <div className="flex items-center gap-2">
          <Icon name="FilterIcon" size={14} className="text-[hsl(215,15%,52%)]" />
          <select
            value={filterFile}
            onChange={(e) => setFilterFile(e.target.value)}
            className="text-sm border border-[hsl(214,20%,88%)] rounded-lg px-2 py-1.5 text-[hsl(215,25%,18%)] focus:outline-none focus:ring-1 focus:ring-[#8B1A2B]/30 bg-white"
          >
            <option value="all">All files ({rows.length} rows)</option>
            {importFiles.map((f) => (
              <option key={f} value={f}>
                {f} ({rows.filter((r) => r.importFile === f).length})
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-[hsl(215,15%,52%)]">
            Showing {filteredRows.length} of {rows.length} rows
          </span>
        </div>
      </div>

      {/* Validation legend */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
        <Icon name="InfoIcon" size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-amber-800">
          <span className="font-semibold">How to fix:</span> Click any highlighted field to edit it inline. Errors clear in real-time as you type.
          Once all errors are resolved, the row turns blue (Ready) and can be retried individually or via Bulk Retry.
        </div>
      </div>

      {/* Active rows */}
      {activeRows.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-[hsl(215,25%,18%)] flex items-center gap-2">
            <Icon name="AlertCircleIcon" size={15} className="text-red-500" />
            Needs Attention ({activeRows.length})
          </h2>
          {activeRows.map((row) => (
            <RowCard
              key={row.id}
              row={row}
              selected={selectedIds.has(row.id)}
              onToggleSelect={toggleSelect}
              onEdit={handleEdit}
              onRetry={handleRetry}
              onDiscard={handleDiscard}
            />
          ))}
        </div>
      )}

      {/* Resolved rows */}
      {resolvedRows.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-[hsl(215,25%,18%)] flex items-center gap-2">
            <Icon name="CheckCircleIcon" size={15} className="text-emerald-500" />
            Resolved ({resolvedRows.length})
          </h2>
          {resolvedRows.map((row) => (
            <RowCard
              key={row.id}
              row={row}
             
              onToggleSelect={() => {}}
              onEdit={() => {}}
              onRetry={() => {}}
              onDiscard={handleDiscard}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {filteredRows.length === 0 && (
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] py-16 flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
            <Icon name="CheckCircleIcon" size={28} className="text-emerald-500" />
          </div>
          <p className="text-base font-semibold text-[hsl(215,25%,18%)]">No failed rows</p>
          <p className="text-sm text-[hsl(215,15%,52%)]">All rows have been resolved or discarded.</p>
        </div>
      )}
    </div>
  );
}
