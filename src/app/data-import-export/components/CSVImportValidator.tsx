'use client';

import React, { useState, useRef, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import Papa from 'papaparse';
import { createClient } from '@/lib/supabase/client';
import { csvDebug } from '@/lib/csvImportDebug';

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = 'error' | 'warning' | 'info';

interface ValidationIssue {
  row: number;
  column: string;
  value: string;
  message: string;
  severity: Severity;
}

interface ValidationResult {
  totalRows: number;
  validRows: number;
  errors: number;
  warnings: number;
  issues: ValidationIssue[];
  duplicatesInFile: string[];
  duplicatesInDB: string[];
}

// ─── Validation Rules ─────────────────────────────────────────────────────────

// Required: pid (maps to property_ref)
const REQUIRED_FIELDS = ['pid'];

// Status codes: 0=Active,1=Leased,2=Self Occupy,3=No Contact,4=Sold,9=Unknown,99=Blank
const VALID_STATUS_CODES = ['0', '1', '2', '3', '4', '9', '99'];

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isNumeric(val: string): boolean {
  return val.trim() !== '' && !isNaN(Number(val));
}

function isValidDate(val: string): boolean {
  if (!DATE_REGEX.test(val)) return false;
  const d = new Date(val);
  return !isNaN(d.getTime());
}

function isBooleanLike(val: string): boolean {
  const v = val.trim().toUpperCase();
  return ['Y', 'N', 'YES', 'NO', 'TRUE', 'FALSE', '1', '0', ''].includes(v);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CSVImportValidator() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState(false);
  const [validating, setValidating] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // ── Validate ───────────────────────────────────────────────────────────────

  const validateFile = useCallback(async (file: File) => {
    setValidating(true);
    setResult(null);
    setFileName(file.name);
    setActiveFilter('all');
    setExpandedRows(new Set());

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (parsed) => {
        // ── Debug: log headers and field mapping coverage ──────────────────
        const headers = parsed.meta.fields ?? [];
        csvDebug.logHeaders(headers);
        csvDebug.logFieldMappingCoverage(headers);

        const issues: ValidationIssue[] = [];
        const seenRefs = new Map<string, number>();
        const duplicatesInFile: string[] = [];
        let validRows = 0;

        parsed.data.forEach((row, idx) => {
          const rowNum = idx + 2;
          let rowHasError = false;

          // ── Required fields ──────────────────────────────────────────────
          REQUIRED_FIELDS.forEach((field) => {
            const val = (row[field] || '').trim();
            if (!val) {
              issues.push({
                row: rowNum,
                column: field,
                value: '',
                message: `Required field "${field}" is missing or empty`,
                severity: 'error',
              });
              rowHasError = true;
            }
          });

          const ref = (row['pid'] || '').trim();

          // ── Duplicate detection in file ──────────────────────────────────
          if (ref) {
            if (seenRefs.has(ref)) {
              duplicatesInFile.push(ref);
              issues.push({
                row: rowNum,
                column: 'pid',
                value: ref,
                message: `Duplicate pid "${ref}" — first seen on row ${seenRefs.get(ref)}`,
                severity: 'error',
              });
              rowHasError = true;
            } else {
              seenRefs.set(ref, rowNum);
            }
          }

          // ── Status validation ────────────────────────────────────────────
          const status = (row['status'] || '').trim();
          if (status && !VALID_STATUS_CODES.includes(status)) {
            issues.push({
              row: rowNum,
              column: 'status',
              value: status,
              message: `Unrecognised status "${status}". Expected: 0=Active, 1=Leased, 2=Self Occupy, 3=No Contact, 4=Sold, 9=Unknown, 99=Blank`,
              severity: 'error',
            });
            rowHasError = true;
          }

          // ── Numeric fields ───────────────────────────────────────────────
          const numericFields = [
            { col: 'room', label: 'room (bedrooms)' },
            { col: 'bath_rm', label: 'bath_rm (bathrooms)' },
            { col: 's_size', label: 's_size (saleable area)' },
            { col: 'g_size', label: 'g_size (gross area)' },
            { col: 'o_size', label: 'o_size (outside area)' },
            { col: 's_price', label: 's_price (sale price)' },
            { col: 'r_price', label: 'r_price (rent price)' },
            { col: 'build_year', label: 'build_year' },
            // Legacy fallbacks
            { col: 'bedroom', label: 'bedroom' },
            { col: 'bathroom', label: 'bathroom' },
            { col: 'saleable sqft_size', label: 'saleable sqft_size (saleable area)' },
            { col: 'gross sqft_size', label: 'gross sqft_size (gross area)' },
            { col: 'outside sqft_size', label: 'outside sqft_size (outside area)' },
            { col: 'sale_price', label: 'sale_price' },
            { col: 'rent_price', label: 'rent_price' },
          ];
          numericFields.forEach(({ col, label }) => {
            const val = (row[col] || '').trim();
            if (val && val.toUpperCase() !== 'NULL' && !isNumeric(val)) {
              issues.push({
                row: rowNum,
                column: col,
                value: val,
                message: `"${label}" must be a number, got "${val}"`,
                severity: 'error',
              });
              rowHasError = true;
            }
            if (val && val.toUpperCase() !== 'NULL' && isNumeric(val) && Number(val) < 0) {
              issues.push({
                row: rowNum,
                column: col,
                value: val,
                message: `"${label}" cannot be negative`,
                severity: 'warning',
              });
            }
          });

          // ── Date fields ──────────────────────────────────────────────────
          // publish_dt in iRem CSV is D/M/YYYY format — accept that too
          const dateFields = ['publish_dt'];
          dateFields.forEach((field) => {
            const val = (row[field] || '').trim();
            if (val && val.toUpperCase() !== 'NULL') {
              const isISODate = /^\d{4}-\d{2}-\d{2}$/.test(val);
              const isDMY = /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(val);
              if (!isISODate && !isDMY) {
                issues.push({
                  row: rowNum,
                  column: field,
                  value: val,
                  message: `"${field}" must be in YYYY-MM-DD or D/M/YYYY format, got "${val}"`,
                  severity: 'error',
                });
                rowHasError = true;
              }
            }
          });

          // ── Boolean feature fields ───────────────────────────────────────
          // iRem CSV uses "Y" or empty — both are valid
          const boolFields = ['balcony', 'combined', 'duplex', 'garden', 'openkitch', 'pool', 'roof', 'terrace'];
          boolFields.forEach((field) => {
            const val = (row[field] || '').trim();
            if (val && !isBooleanLike(val)) {
              issues.push({
                row: rowNum,
                column: field,
                value: val,
                message: `"${field}" should be Y/N or blank, got "${val}"`,
                severity: 'warning',
              });
            }
          });

          // ── Bedroom/bathroom sanity ──────────────────────────────────────
          const beds = Number(row['room'] || row['bedroom'] || 0);
          const baths = Number(row['bath_rm'] || row['bathroom'] || 0);
          if (beds > 0 && baths === 0) {
            issues.push({
              row: rowNum,
              column: 'bathroom',
              value: row['bathroom'] || '',
              message: `Property has ${beds} bedroom(s) but 0 bathrooms — check if this is correct`,
              severity: 'info',
            });
          }

          if (!rowHasError) validRows++;
        });

        // ── Check for duplicates already in DB ───────────────────────────
        const allRefs = Array.from(seenRefs.keys());
        let duplicatesInDB: string[] = [];

        if (allRefs.length > 0) {
          try {
            const { data: existing } = await supabase
              .from('properties')
              .select('property_ref')
              .in('property_ref', allRefs);

            duplicatesInDB = (existing || []).map((r: { property_ref: string }) => r.property_ref);

            duplicatesInDB.forEach((ref) => {
              const rowNum = seenRefs.get(ref);
              if (rowNum) {
                issues.push({
                  row: rowNum,
                  column: 'pid',
                  value: ref,
                  message: `"${ref}" already exists in the database — will be updated (upsert) or skipped depending on import mode`,
                  severity: 'info',
                });
              }
            });
          } catch {
            // DB check failed silently — not critical
          }
        }

        // Sort issues by row then severity
        const severityOrder: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
        issues.sort((a, b) => a.row - b.row || severityOrder[a.severity] - severityOrder[b.severity]);

        setResult({
          totalRows: parsed.data.length,
          validRows,
          errors: issues.filter((i) => i.severity === 'error').length,
          warnings: issues.filter((i) => i.severity === 'warning').length,
          issues,
          duplicatesInFile: [...new Set(duplicatesInFile)],
          duplicatesInDB,
        });

        setValidating(false);
      },
      error: () => {
        setValidating(false);
      },
    });
  }, [supabase]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) {
      validateFile(file);
    }
  };

  const reset = () => {
    setResult(null);
    setFileName(null);
    setActiveFilter('all');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleRow = (row: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(row)) next.delete(row);
      else next.add(row);
      return next;
    });
  };

  // ── Filtered issues ────────────────────────────────────────────────────────

  const filteredIssues = result?.issues.filter((i) =>
    activeFilter === 'all' ? true : i.severity === activeFilter
  ) || [];

  // Group by row
  const issuesByRow = filteredIssues.reduce<Record<number, ValidationIssue[]>>((acc, issue) => {
    if (!acc[issue.row]) acc[issue.row] = [];
    acc[issue.row].push(issue);
    return acc;
  }, {});

  const severityConfig: Record<Severity, { color: string; bg: string; icon: string; label: string }> = {
    error: { color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: 'XCircleIcon', label: 'Error' },
    warning: { color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: 'AlertTriangleIcon', label: 'Warning' },
    info: { color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', icon: 'InfoIcon', label: 'Info' },
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[hsl(214,20%,88%)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#8B1A2B]/10 flex items-center justify-center">
            <Icon name="ShieldCheckIcon" size={16} className="text-[#8B1A2B]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[hsl(215,25%,18%)]">CSV Import Validator</h2>
            <p className="text-xs text-[hsl(215,15%,52%)]">
              Scan your CSV for errors before importing — fix issues first, then use the Import panel above
            </p>
          </div>
        </div>
        {result && (
          <button
            onClick={reset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(214,20%,88%)] text-xs text-[hsl(215,15%,52%)] hover:bg-[hsl(210,15%,94%)] transition-colors"
          >
            <Icon name="RefreshCwIcon" size={12} />
            New file
          </button>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Drop zone */}
        {!fileName ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-[#8B1A2B] bg-[#8B1A2B]/5'
                : 'border-[hsl(214,20%,88%)] hover:border-[#8B1A2B]/50 hover:bg-[hsl(210,20%,97%)]'
            }`}
          >
            <div className="w-14 h-14 rounded-full bg-[hsl(210,20%,97%)] flex items-center justify-center mx-auto mb-3">
              <Icon name="FileSearchIcon" size={26} className="text-[hsl(215,15%,52%)]" />
            </div>
            <p className="text-sm font-medium text-[hsl(215,25%,18%)]">Drop your CSV here to validate it</p>
            <p className="text-xs text-[hsl(215,15%,52%)] mt-1">
              Checks required fields, data formats, duplicates, and unrecognised values
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(210,20%,97%)] border border-[hsl(214,20%,88%)]">
            <Icon name="FileTextIcon" size={18} className="text-[#8B1A2B] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[hsl(215,25%,18%)] truncate">{fileName}</p>
              {validating && (
                <p className="text-xs text-[hsl(215,15%,52%)] flex items-center gap-1">
                  <Icon name="LoaderIcon" size={11} className="animate-spin" />
                  Validating…
                </p>
              )}
              {result && !validating && (
                <p className="text-xs text-[hsl(215,15%,52%)]">
                  {result.totalRows} rows · {result.errors} errors · {result.warnings} warnings
                </p>
              )}
            </div>
          </div>
        )}

        {/* Results summary */}
        {result && !validating && (
          <>
            {/* Score bar */}
            <div className={`rounded-lg p-4 border ${
              result.errors === 0
                ? 'bg-green-50 border-green-200' :'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon
                  name={result.errors === 0 ? 'CheckCircleIcon' : 'AlertCircleIcon'}
                  size={16}
                  className={result.errors === 0 ? 'text-green-600' : 'text-red-600'}
                />
                <p className={`text-sm font-semibold ${result.errors === 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {result.errors === 0
                    ? result.warnings === 0
                      ? 'All clear — file is ready to import'
                      : `Ready to import with ${result.warnings} warning${result.warnings !== 1 ? 's' : ''} to review`
                    : `${result.errors} error${result.errors !== 1 ? 's' : ''} must be fixed before importing`}
                </p>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Total rows', value: result.totalRows, color: 'text-[hsl(215,25%,18%)]' },
                  { label: 'Clean rows', value: result.validRows, color: 'text-green-700' },
                  { label: 'Errors', value: result.errors, color: 'text-red-600' },
                  { label: 'Warnings', value: result.warnings, color: 'text-amber-600' },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-[hsl(215,15%,52%)]">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* DB duplicates notice */}
            {result.duplicatesInDB.length > 0 && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 flex gap-2">
                <Icon name="DatabaseIcon" size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-blue-700 mb-1">
                    {result.duplicatesInDB.length} propert{result.duplicatesInDB.length !== 1 ? 'ies' : 'y'} already exist in the database
                  </p>
                  <p className="text-[11px] text-blue-600">
                    These will be <strong>updated</strong> if you use "Update existing" mode, or <strong>skipped</strong> if you use "Skip existing" mode.
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {result.duplicatesInDB.slice(0, 8).map((ref) => (
                      <span key={ref} className="px-1.5 py-0.5 rounded bg-white border border-blue-200 text-[10px] font-mono text-blue-700">{ref}</span>
                    ))}
                    {result.duplicatesInDB.length > 8 && (
                      <span className="px-1.5 py-0.5 rounded bg-white border border-blue-200 text-[10px] text-blue-600">
                        +{result.duplicatesInDB.length - 8} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Filter tabs */}
            {result.issues.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-[hsl(215,25%,18%)]">Issue details</p>
                  <div className="flex gap-1">
                    {(['all', 'error', 'warning', 'info'] as const).map((f) => {
                      const count = f === 'all'
                        ? result.issues.length
                        : result.issues.filter((i) => i.severity === f).length;
                      if (count === 0 && f !== 'all') return null;
                      return (
                        <button
                          key={f}
                          onClick={() => setActiveFilter(f)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                            activeFilter === f
                              ? f === 'error' ? 'bg-red-600 text-white'
                              : f === 'warning' ? 'bg-amber-500 text-white'
                              : f === 'info'? 'bg-blue-600 text-white' :'bg-[hsl(215,25%,18%)] text-white' :'bg-[hsl(210,20%,97%)] text-[hsl(215,25%,18%)] hover:bg-[hsl(214,20%,88%)]'
                          }`}
                        >
                          {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Issues list grouped by row */}
                <div className="max-h-80 overflow-y-auto rounded-lg border border-[hsl(214,20%,88%)] divide-y divide-[hsl(214,20%,88%)]">
                  {Object.entries(issuesByRow).map(([rowStr, rowIssues]) => {
                    const rowNum = Number(rowStr);
                    const isExpanded = expandedRows.has(rowNum);
                    const hasError = rowIssues.some((i) => i.severity === 'error');
                    const hasWarning = rowIssues.some((i) => i.severity === 'warning');

                    return (
                      <div key={rowNum}>
                        <button
                          onClick={() => toggleRow(rowNum)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[hsl(210,20%,97%)] transition-colors text-left"
                        >
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                            hasError ? 'bg-red-100' : hasWarning ? 'bg-amber-100' : 'bg-blue-100'
                          }`}>
                            <Icon
                              name={hasError ? 'XCircleIcon' : hasWarning ? 'AlertTriangleIcon' : 'InfoIcon'}
                              size={12}
                              className={hasError ? 'text-red-600' : hasWarning ? 'text-amber-600' : 'text-blue-600'}
                            />
                          </span>
                          <span className="text-xs font-semibold text-[hsl(215,25%,18%)]">Row {rowNum}</span>
                          <span className="flex gap-1 flex-1">
                            {rowIssues.map((issue, i) => (
                              <span
                                key={i}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  issue.severity === 'error' ? 'bg-red-100 text-red-700'
                                  : issue.severity === 'warning'? 'bg-amber-100 text-amber-700' :'bg-blue-100 text-blue-700'
                                }`}
                              >
                                {issue.column}
                              </span>
                            ))}
                          </span>
                          <Icon
                            name={isExpanded ? 'ChevronUpIcon' : 'ChevronDownIcon'}
                            size={13}
                            className="text-[hsl(215,15%,52%)] flex-shrink-0"
                          />
                        </button>

                        {isExpanded && (
                          <div className="px-3 pb-3 space-y-1.5 bg-[hsl(210,20%,97%)]">
                            {rowIssues.map((issue, i) => {
                              const cfg = severityConfig[issue.severity];
                              return (
                                <div key={i} className={`rounded-lg p-2.5 border ${cfg.bg} flex gap-2`}>
                                  <Icon name={cfg.icon as 'InfoIcon'} size={13} className={`${cfg.color} flex-shrink-0 mt-0.5`} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className={`text-[10px] font-bold uppercase tracking-wide ${cfg.color}`}>
                                        {cfg.label}
                                      </span>
                                      <span className="text-[10px] font-mono text-[hsl(215,15%,52%)] bg-white px-1 rounded border border-[hsl(214,20%,88%)]">
                                        {issue.column}
                                      </span>
                                      {issue.value && (
                                        <span className="text-[10px] font-mono text-[hsl(215,15%,52%)] truncate max-w-[120px]">
                                          = &quot;{issue.value}&quot;
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-[hsl(215,25%,18%)]">{issue.message}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {filteredIssues.length === 0 && (
                    <div className="px-4 py-6 text-center text-xs text-[hsl(215,15%,52%)]">
                      No {activeFilter === 'all' ? '' : activeFilter} issues found
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* No issues */}
            {result.issues.length === 0 && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
                <Icon name="CheckCircleIcon" size={24} className="text-green-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-green-700">No issues found</p>
                <p className="text-xs text-green-600 mt-0.5">
                  Your CSV passed all validation checks. You can safely import it using the Import panel.
                </p>
              </div>
            )}
          </>
        )}

        {/* What we check */}
        {!result && !validating && (
          <div className="rounded-lg bg-[hsl(210,20%,97%)] border border-[hsl(214,20%,88%)] p-4">
            <p className="text-xs font-semibold text-[hsl(215,25%,18%)] mb-3">What the validator checks</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: 'AlertCircleIcon', color: 'text-red-500', label: 'Missing required fields', desc: 'PID (numeric property identifier) must be present in every row' },
                { icon: 'HashIcon', color: 'text-red-500', label: 'Wrong data formats', desc: 'Numbers, dates (YYYY-MM-DD), Y/N booleans' },
                { icon: 'CopyIcon', color: 'text-red-500', label: 'Duplicates in file', desc: 'Same PID appearing twice' },
                { icon: 'DatabaseIcon', color: 'text-blue-500', label: 'Existing in database', desc: 'Records that will be updated/skipped' },
                { icon: 'TagIcon', color: 'text-amber-500', label: 'Unrecognised status codes', desc: '0=Active, 1=Leased, 2=Self Occupy, 4=Sold…' },
                { icon: 'CheckSquareIcon', color: 'text-amber-500', label: 'Feature flag values', desc: 'balcony, pool, garden etc. must be Y/N' },
              ].map((item) => (
                <div key={item.label} className="flex gap-2">
                  <Icon name={item.icon as 'InfoIcon'} size={13} className={`${item.color} flex-shrink-0 mt-0.5`} />
                  <div>
                    <p className="text-[11px] font-semibold text-[hsl(215,25%,18%)]">{item.label}</p>
                    <p className="text-[10px] text-[hsl(215,15%,52%)]">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
