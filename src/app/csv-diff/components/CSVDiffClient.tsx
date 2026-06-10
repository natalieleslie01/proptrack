'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface DbPropertyRow {
  property_ref: string;
  village?: string;
  short_code?: string;
  build_year?: number;
  list_type?: string;
  floor_type?: string;
  prop_types?: string;
  prop_type?: string;
  saleable_area?: number;
  gross_area?: number;
  outside_sc?: number;
  bedrooms?: number;
  bathrooms?: number;
  direction_id?: string;
  view_id?: string;
  decor_id?: string;
  furn_id?: string;
  asking_price?: number;
  asking_rent?: number;
  status?: string;
  floor?: string;
  unit?: string;
  building_name?: string;
  [key: string]: unknown;
}

interface FieldDiff {
  field: string;
  label: string;
  incoming: string | number | null | undefined;
  current: string | number | null | undefined;
  changed: boolean;
}

interface RowDiff {
  property_ref: string;
  isNew: boolean;
  fields: FieldDiff[];
  changedCount: number;
}

// Fields to compare and their display labels
const DIFF_FIELDS: Array<{ key: keyof DbPropertyRow; label: string }> = [
  { key: 'build_year', label: 'Build Year' },
  { key: 'list_type', label: 'Listing Type' },
  { key: 'prop_types', label: 'Building Type' },
  { key: 'floor_type', label: 'Floor Type' },
  { key: 'saleable_area', label: 'Net SQFT' },
  { key: 'gross_area', label: 'Gross SQFT' },
  { key: 'outside_sc', label: 'Outdoor SQFT' },
  { key: 'bedrooms', label: 'Bedrooms' },
  { key: 'bathrooms', label: 'Bathrooms' },
  { key: 'direction_id', label: 'Direction' },
  { key: 'view_id', label: 'View' },
  { key: 'decor_id', label: 'Decoration' },
  { key: 'furn_id', label: 'Furnishing' },
  { key: 'asking_rent', label: 'Asking Rent' },
  { key: 'asking_price', label: 'Asking Price' },
  { key: 'status', label: 'Status' },
  { key: 'floor', label: 'Floor' },
  { key: 'unit', label: 'Unit / Flat' },
  { key: 'building_name', label: 'Building Name' },
  { key: 'village', label: 'Village' },
];

function formatVal(val: unknown): string {
  if (val === null || val === undefined || val === '') return '—';
  return String(val);
}

function valuesEqual(a: unknown, b: unknown): boolean {
  const fa = formatVal(a);
  const fb = formatVal(b);
  return fa === fb;
}

function buildRowDiff(incoming: DbPropertyRow, current: DbPropertyRow | undefined): RowDiff {
  const isNew = !current;
  const fields: FieldDiff[] = DIFF_FIELDS
    .filter((f) => incoming[f.key] !== undefined) // only show fields present in CSV
    .map((f) => {
      const inc = incoming[f.key] as string | number | null | undefined;
      const cur = current ? (current[f.key] as string | number | null | undefined) : undefined;
      const changed = isNew ? true : !valuesEqual(inc, cur);
      return { field: f.key, label: f.label, incoming: inc, current: cur, changed };
    });

  const changedCount = fields.filter((f) => f.changed).length;
  return { property_ref: incoming.property_ref, isNew, fields, changedCount };
}

type FilterMode = 'all' | 'changed' | 'new' | 'unchanged';

export default function CSVDiffClient() {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const [diffs, setDiffs] = useState<RowDiff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>('changed');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showOnlyChanged, setShowOnlyChanged] = useState(true);
  const [page, setPage] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmResult, setConfirmResult] = useState<{ success: number; errors: string[] } | null>(null);
  const [incomingRows, setIncomingRows] = useState<DbPropertyRow[]>([]);

  const PAGE_SIZE = 50;

  // Load pending rows from sessionStorage (set by CSVUploadClient before navigating here)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('csv_diff_pending_rows');
      if (!raw) {
        setError('No pending CSV data found. Please go back to the CSV Upload page and re-upload your file.');
        setLoading(false);
        return;
      }
      const rows: DbPropertyRow[] = JSON.parse(raw);
      setIncomingRows(rows);
      loadDiffs(rows);
    } catch {
      setError('Failed to load pending CSV data. Please go back and re-upload.');
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDiffs = useCallback(async (rows: DbPropertyRow[]) => {
    setLoading(true);
    setError(null);
    try {
      const refs = rows.map((r) => r.property_ref);
      // Fetch current DB records for all PIDs in the CSV
      const { data: currentRows, error: dbErr } = await supabase
        .from('properties')
        .select('*')
        .in('property_ref', refs);

      if (dbErr) throw new Error(dbErr.message);

      const currentMap = new Map<string, DbPropertyRow>();
      (currentRows ?? []).forEach((r: DbPropertyRow) => {
        currentMap.set(r.property_ref, r);
      });

      const rowDiffs = rows.map((incoming) => buildRowDiff(incoming, currentMap.get(incoming.property_ref)));
      setDiffs(rowDiffs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load diff data');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const toggleRow = (ref: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  };

  const filteredDiffs = diffs.filter((d) => {
    if (filter === 'changed') return !d.isNew && d.changedCount > 0;
    if (filter === 'new') return d.isNew;
    if (filter === 'unchanged') return !d.isNew && d.changedCount === 0;
    return true;
  });

  const totalPages = Math.ceil(filteredDiffs.length / PAGE_SIZE);
  const pageRows = filteredDiffs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const newCount = diffs.filter((d) => d.isNew).length;
  const changedCount = diffs.filter((d) => !d.isNew && d.changedCount > 0).length;
  const unchangedCount = diffs.filter((d) => !d.isNew && d.changedCount === 0).length;

  const expandAll = () => setExpandedRows(new Set(filteredDiffs.map((d) => d.property_ref)));
  const collapseAll = () => setExpandedRows(new Set());

  // Confirm and run the upsert
  const handleConfirmUpsert = useCallback(async () => {
    if (incomingRows.length === 0) return;
    setConfirming(true);
    setConfirmError(null);
    const BATCH = 50;
    let success = 0;
    const errors: string[] = [];
    for (let i = 0; i < incomingRows.length; i += BATCH) {
      const batch = incomingRows.slice(i, i + BATCH);
      const { error: upsertErr } = await supabase
        .from('properties')
        .upsert(batch, { onConflict: 'property_ref' });
      if (upsertErr) {
        errors.push(`Batch ${Math.floor(i / BATCH) + 1}: ${upsertErr.message}`);
      } else {
        success += batch.length;
      }
    }
    setConfirmResult({ success, errors });
    setConfirmed(true);
    setConfirming(false);
    // Clear session storage after successful upsert
    if (errors.length === 0) {
      sessionStorage.removeItem('csv_diff_pending_rows');
    }
  }, [incomingRows, supabase]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[hsl(210,15%,97%)]">
      {/* Header */}
      <div className="bg-white border-b border-[hsl(214,20%,88%)] px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/csv-upload"
            className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors"
          >
            <Icon name="ArrowLeftIcon" size={18} className="text-[hsl(215,15%,52%)]" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[hsl(215,25%,18%)]">CSV Import — Row Diff Review</h1>
            <p className="text-sm text-[hsl(215,15%,52%)]">
              Compare incoming CSV data against current property records before confirming bulk upsert
            </p>
          </div>
          {!loading && !confirmed && (
            <div className="ml-auto flex items-center gap-3">
              <button
                onClick={handleConfirmUpsert}
                disabled={confirming || incomingRows.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#8B1A2B] text-white text-sm font-semibold rounded-lg hover:bg-[#7a1726] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {confirming ? (
                  <Icon name="LoaderIcon" size={15} className="animate-spin" />
                ) : (
                  <Icon name="CheckIcon" size={15} />
                )}
                {confirming ? 'Upserting…' : `Confirm & Upsert ${incomingRows.length.toLocaleString()} rows`}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* ── Loading ── */}
        {loading && (
          <div className="bg-white border border-[hsl(214,20%,88%)] rounded-xl p-16 flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-[#8B1A2B]/20 border-t-[#8B1A2B] animate-spin" />
            <p className="text-sm font-medium text-[hsl(215,25%,18%)]">Fetching current database records…</p>
            <p className="text-xs text-[hsl(215,15%,52%)]">Comparing {incomingRows.length} CSV rows against live property data</p>
          </div>
        )}

        {/* ── Error ── */}
        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
            <Icon name="AlertCircleIcon" size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800 mb-1">Failed to load diff data</p>
              <p className="text-xs text-red-700">{error}</p>
              <Link href="/csv-upload" className="inline-flex items-center gap-1 mt-3 text-xs text-red-700 underline hover:text-red-900">
                <Icon name="ArrowLeftIcon" size={11} /> Back to CSV Upload
              </Link>
            </div>
          </div>
        )}

        {/* ── Confirmed result ── */}
        {confirmed && confirmResult && (
          <div className={`border rounded-xl p-6 flex items-start gap-4 ${confirmResult.errors.length === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${confirmResult.errors.length === 0 ? 'bg-emerald-100' : 'bg-amber-100'}`}>
              <Icon name={confirmResult.errors.length === 0 ? 'CheckCircleIcon' : 'AlertTriangleIcon'} size={20} className={confirmResult.errors.length === 0 ? 'text-emerald-600' : 'text-amber-600'} />
            </div>
            <div className="flex-1">
              <p className={`text-base font-bold mb-1 ${confirmResult.errors.length === 0 ? 'text-emerald-800' : 'text-amber-800'}`}>
                {confirmResult.errors.length === 0 ? 'Upsert completed successfully' : 'Upsert completed with errors'}
              </p>
              <p className={`text-sm mb-3 ${confirmResult.errors.length === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                {confirmResult.success.toLocaleString()} rows written to database
                {confirmResult.errors.length > 0 && ` · ${confirmResult.errors.length} batch error${confirmResult.errors.length > 1 ? 's' : ''}`}
              </p>
              {confirmResult.errors.length > 0 && (
                <ul className="space-y-1 mb-3">
                  {confirmResult.errors.map((e, i) => (
                    <li key={i} className="text-xs text-amber-700 font-mono bg-amber-100 px-2 py-1 rounded">{e}</li>
                  ))}
                </ul>
              )}
              <div className="flex items-center gap-3">
                <Link
                  href="/property-management"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#8B1A2B] text-white text-sm font-semibold rounded-lg hover:bg-[#7a1726] transition-colors"
                >
                  <Icon name="HomeIcon" size={14} />
                  View Properties
                </Link>
                <Link
                  href="/csv-upload"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[hsl(215,15%,52%)] border border-[hsl(214,20%,88%)] rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors"
                >
                  <Icon name="UploadIcon" size={14} />
                  Upload Another CSV
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ── Stats bar ── */}
        {!loading && !error && diffs.length > 0 && (
          <>
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Total CSV Rows', value: diffs.length, icon: 'FileTextIcon', color: 'text-[hsl(215,25%,18%)]', bg: 'bg-[hsl(210,15%,94%)]' },
                { label: 'New Properties', value: newCount, icon: 'PlusCircleIcon', color: 'text-emerald-700', bg: 'bg-emerald-50' },
                { label: 'Fields Changed', value: changedCount, icon: 'EditIcon', color: 'text-blue-700', bg: 'bg-blue-50' },
                { label: 'No Changes', value: unchangedCount, icon: 'CheckCircleIcon', color: 'text-[hsl(215,15%,52%)]', bg: 'bg-[hsl(210,15%,97%)]' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white border border-[hsl(214,20%,88%)] rounded-xl p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon name={stat.icon} size={18} className={stat.color} />
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value.toLocaleString()}</p>
                    <p className="text-xs text-[hsl(215,15%,52%)]">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Filter tabs + controls */}
            <div className="bg-white border border-[hsl(214,20%,88%)] rounded-xl px-5 py-3 flex items-center gap-4">
              <div className="flex items-center gap-1 bg-[hsl(210,15%,97%)] rounded-lg p-1">
                {([
                  { id: 'all', label: `All (${diffs.length})` },
                  { id: 'changed', label: `Changed (${changedCount})` },
                  { id: 'new', label: `New (${newCount})` },
                  { id: 'unchanged', label: `Unchanged (${unchangedCount})` },
                ] as Array<{ id: FilterMode; label: string }>).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => { setFilter(f.id); setPage(0); }}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === f.id ? 'bg-white text-[#8B1A2B] shadow-sm border border-[hsl(214,20%,88%)]' : 'text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)]'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={expandAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[hsl(215,15%,52%)] border border-[hsl(214,20%,88%)] rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors"
                >
                  <Icon name="ChevronDownIcon" size={12} /> Expand All
                </button>
                <button
                  onClick={collapseAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[hsl(215,15%,52%)] border border-[hsl(214,20%,88%)] rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors"
                >
                  <Icon name="ChevronUpIcon" size={12} /> Collapse All
                </button>
                <label className="flex items-center gap-2 text-xs text-[hsl(215,15%,52%)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showOnlyChanged}
                    onChange={(e) => setShowOnlyChanged(e.target.checked)}
                    className="rounded border-[hsl(214,20%,82%)] text-[#8B1A2B] focus:ring-[#8B1A2B]"
                  />
                  Show only changed fields
                </label>
              </div>
            </div>

            {/* Diff rows */}
            <div className="space-y-2">
              {pageRows.length === 0 && (
                <div className="bg-white border border-[hsl(214,20%,88%)] rounded-xl p-10 text-center text-sm text-[hsl(215,15%,52%)]">
                  No rows match the current filter.
                </div>
              )}
              {pageRows.map((row) => {
                const isExpanded = expandedRows.has(row.property_ref);
                const displayFields = showOnlyChanged ? row.fields.filter((f) => f.changed) : row.fields;

                return (
                  <div
                    key={row.property_ref}
                    className={`bg-white border rounded-xl overflow-hidden transition-all ${
                      row.isNew
                        ? 'border-emerald-200'
                        : row.changedCount > 0
                        ? 'border-blue-200' :'border-[hsl(214,20%,88%)]'
                    }`}
                  >
                    {/* Row header */}
                    <button
                      onClick={() => toggleRow(row.property_ref)}
                      className="w-full px-5 py-3.5 flex items-center gap-3 hover:bg-[hsl(210,15%,97%)] transition-colors text-left"
                    >
                      {/* Status badge */}
                      {row.isNew ? (
                        <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                          <Icon name="PlusIcon" size={10} /> NEW
                        </span>
                      ) : row.changedCount > 0 ? (
                        <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                          <Icon name="EditIcon" size={10} /> {row.changedCount} change{row.changedCount !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[hsl(210,15%,94%)] text-[hsl(215,15%,52%)]">
                          <Icon name="CheckIcon" size={10} /> No changes
                        </span>
                      )}

                      {/* PID */}
                      <span className="font-mono font-semibold text-sm text-[hsl(215,25%,18%)]">{row.property_ref}</span>

                      {/* Field count */}
                      <span className="text-xs text-[hsl(215,15%,52%)]">
                        {row.fields.length} field{row.fields.length !== 1 ? 's' : ''} in CSV
                      </span>

                      <div className="ml-auto">
                        <Icon
                          name={isExpanded ? 'ChevronUpIcon' : 'ChevronDownIcon'}
                          size={16}
                          className="text-[hsl(215,15%,52%)]"
                        />
                      </div>
                    </button>

                    {/* Expanded diff table */}
                    {isExpanded && (
                      <div className="border-t border-[hsl(214,20%,88%)]">
                        {displayFields.length === 0 ? (
                          <div className="px-5 py-4 text-xs text-[hsl(215,15%,52%)] italic">
                            No changed fields to display.
                          </div>
                        ) : (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-[hsl(210,15%,97%)]">
                                <th className="px-5 py-2 text-left font-semibold text-[hsl(215,15%,52%)] w-40">Field</th>
                                <th className="px-5 py-2 text-left font-semibold text-[hsl(215,15%,52%)]">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-[hsl(214,20%,82%)] inline-block" />
                                    Current (DB)
                                  </span>
                                </th>
                                <th className="px-5 py-2 text-left font-semibold text-[hsl(215,15%,52%)]">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-[#8B1A2B] inline-block" />
                                    Incoming (CSV)
                                  </span>
                                </th>
                                <th className="px-5 py-2 text-center font-semibold text-[hsl(215,15%,52%)] w-24">Diff</th>
                              </tr>
                            </thead>
                            <tbody>
                              {displayFields.map((f) => (
                                <tr
                                  key={f.field}
                                  className={`border-t border-[hsl(214,20%,88%)] ${f.changed ? (row.isNew ? 'bg-emerald-50/40' : 'bg-blue-50/40') : ''}`}
                                >
                                  <td className="px-5 py-2.5 font-medium text-[hsl(215,25%,18%)] whitespace-nowrap">{f.label}</td>
                                  <td className="px-5 py-2.5">
                                    {row.isNew ? (
                                      <span className="text-[hsl(215,15%,52%)] italic">— (new record)</span>
                                    ) : (
                                      <span className={`font-mono ${f.changed ? 'text-red-600 line-through opacity-70' : 'text-[hsl(215,25%,18%)]'}`}>
                                        {formatVal(f.current)}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-5 py-2.5">
                                    <span className={`font-mono font-semibold ${f.changed ? (row.isNew ? 'text-emerald-700' : 'text-blue-700') : 'text-[hsl(215,25%,18%)]'}`}>
                                      {formatVal(f.incoming)}
                                    </span>
                                  </td>
                                  <td className="px-5 py-2.5 text-center">
                                    {f.changed ? (
                                      row.isNew ? (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
                                          <Icon name="PlusIcon" size={9} /> New
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                                          <Icon name="ArrowRightIcon" size={9} /> Updated
                                        </span>
                                      )
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-[hsl(210,15%,94%)] text-[hsl(215,15%,52%)]">
                                        <Icon name="MinusIcon" size={9} /> Same
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white border border-[hsl(214,20%,88%)] rounded-xl px-5 py-3 flex items-center justify-between">
                <span className="text-xs text-[hsl(215,15%,52%)]">
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredDiffs.length)} of {filteredDiffs.length.toLocaleString()} rows
                </span>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setPage(0)} disabled={page === 0} className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,94%)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <Icon name="ChevronsLeftIcon" size={14} className="text-[hsl(215,15%,52%)]" />
                  </button>
                  <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,94%)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <Icon name="ChevronLeftIcon" size={14} className="text-[hsl(215,15%,52%)]" />
                  </button>
                  <span className="px-3 py-1 text-xs font-medium text-[hsl(215,25%,18%)] bg-[hsl(210,15%,97%)] rounded-lg border border-[hsl(214,20%,88%)]">
                    {page + 1} / {totalPages}
                  </span>
                  <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,94%)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <Icon name="ChevronRightIcon" size={14} className="text-[hsl(215,15%,52%)]" />
                  </button>
                  <button onClick={() => setPage(totalPages - 1)} disabled={page === totalPages - 1} className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,94%)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <Icon name="ChevronsRightIcon" size={14} className="text-[hsl(215,15%,52%)]" />
                  </button>
                </div>
              </div>
            )}

            {/* Bottom confirm bar */}
            {!confirmed && (
              <div className="bg-white border border-[hsl(214,20%,88%)] rounded-xl px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">Ready to apply changes?</p>
                  <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">
                    This will upsert <strong>{incomingRows.length.toLocaleString()}</strong> rows —{' '}
                    <strong className="text-emerald-700">{newCount} new</strong>,{' '}
                    <strong className="text-blue-700">{changedCount} updated</strong>,{' '}
                    <strong>{unchangedCount} unchanged</strong>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href="/csv-upload"
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[hsl(215,15%,52%)] border border-[hsl(214,20%,88%)] rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors"
                  >
                    <Icon name="ArrowLeftIcon" size={14} /> Cancel
                  </Link>
                  <button
                    onClick={handleConfirmUpsert}
                    disabled={confirming}
                    className="flex items-center gap-2 px-6 py-2.5 bg-[#8B1A2B] text-white text-sm font-semibold rounded-lg hover:bg-[#7a1726] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {confirming ? (
                      <Icon name="LoaderIcon" size={15} className="animate-spin" />
                    ) : (
                      <Icon name="CheckIcon" size={15} />
                    )}
                    {confirming ? 'Upserting…' : 'Confirm Bulk Upsert'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
