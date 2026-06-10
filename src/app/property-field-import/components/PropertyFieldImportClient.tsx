'use client';

import React, { useState, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import Icon from '@/components/ui/AppIcon';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ParsedRow {
  pid: string;
  build_year?: number | null;
  list_type?: string | null;
  prop_types?: string | null;
  floor_type?: string | null;
  saleable_area?: number | null;
  gross_area?: number | null;
  outside_sc?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  direction_id?: string | null;
  view_id?: string | null;
  decor_id?: string | null;
  balcony?: boolean;
  combined?: boolean;
  duplex?: boolean;
  garden?: boolean;
  openkitch?: boolean;
  pool?: boolean;
  roof?: boolean;
  terrace?: boolean;
  _rawRow: Record<string, string>;
  _warnings: string[];
}

interface ImportResult {
  pid: string;
  status: 'updated' | 'not_found' | 'error';
  error?: string;
}

interface ImportSummary {
  total: number;
  updated: number;
  notFound: number;
  errors: number;
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

// ─── Field Mapping Helpers ───────────────────────────────────────────────────

/** Get a value from a raw CSV row, trying multiple possible column name variants */
function getCol(row: Record<string, string>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()];
    if (v !== undefined && v !== null) return String(v).trim();
  }
  return undefined;
}

function parseIntVal(v: string | undefined): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === '' || v.toLowerCase() === 'null' || v === '---') return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

function parseFloatVal(v: string | undefined): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === '' || v.toLowerCase() === 'null' || v === '---') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function parseBool(v: string | undefined): boolean | undefined {
  if (v === undefined) return undefined;
  const lower = v.toLowerCase().trim();
  if (lower === '1' || lower === 'true' || lower === 'yes' || lower === 'y') return true;
  if (lower === '0' || lower === 'false' || lower === 'no' || lower === 'n' || lower === '') return false;
  return undefined;
}

/** Normalise direction codes to DB values */
function normaliseDirection(v: string | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === '' || v === '---') return null;
  const map: Record<string, string> = {
    n: 'N', north: 'N',
    ne: 'NE', 'north east': 'NE', 'north-east': 'NE', northeast: 'NE',
    e: 'E', east: 'E',
    s: 'S', south: 'S',
    se: 'SE', 'south east': 'SE', 'south-east': 'SE', southeast: 'SE',
    w: 'W', west: 'W',
    sw: 'SW', 'south west': 'SW', 'south-west': 'SW', southwest: 'SW',
    nw: 'NW', 'north west': 'NW', 'north-west': 'NW', northwest: 'NW',
  };
  return map[v.toLowerCase()] ?? v.toUpperCase();
}

/** Normalise view codes to DB values */
function normaliseView(v: string | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === '' || v === '---') return null;
  const map: Record<string, string> = {
    sea: 'SEA', 'sea view': 'SEA', seaview: 'SEA',
    green: 'GREEN', 'green view': 'GREEN', greenview: 'GREEN',
    city: 'CITY', 'city view': 'CITY', cityview: 'CITY',
    mountain: 'MTN', mtn: 'MTN', 'mountain view': 'MTN', mountainview: 'MTN',
    pool: 'POOL', 'pool view': 'POOL', poolview: 'POOL',
    garden: 'GARDEN', 'garden view': 'GARDEN', gardenview: 'GARDEN',
    street: 'STREET', 'street view': 'STREET', streetview: 'STREET',
    open: 'OPEN', 'open view': 'OPEN', openview: 'OPEN',
  };
  return map[v.toLowerCase()] ?? v.toUpperCase();
}

/** Normalise decor codes to DB values */
function normaliseDecor(v: string | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === '' || v === '---') return null;
  const map: Record<string, string> = {
    deluxe: 'DELUXE', 'deluxe condition': 'DELUXE',
    good: 'GOOD', 'good condition': 'GOOD',
    fair: 'FAIR', 'fair condition': 'FAIR',
    original: 'ORIGINAL', 'original condition': 'ORIGINAL',
    null: '---', unknown: '---', '---': '---',
  };
  return map[v.toLowerCase()] ?? v;
}

/** Normalise list_type */
function normaliseListType(v: string | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === '' || v === '---') return null;
  const lower = v.toLowerCase().trim();
  if (lower === 'sale' || lower === 'for sale' || lower === 'for-sale') return 'Sale';
  if (lower === 'rent' || lower === 'for rent' || lower === 'for-rent') return 'Rent';
  if (lower === 'rent & sale' || lower === 'sale & rent' || lower === 'for-sale-and-rent') return 'Rent & Sale';
  return v;
}

/** Normalise floor_type */
function normaliseFloorType(v: string | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === '' || v === '---') return null;
  const lower = v.toLowerCase().trim();
  if (lower === 'low floor' || lower === 'low') return 'low floor';
  if (lower === 'middle floor' || lower === 'mid floor' || lower === 'mid' || lower === 'medium') return 'middle floor';
  if (lower === 'high floor' || lower === 'high') return 'high floor';
  if (lower === 'ground floor' || lower === 'ground' || lower === 'g') return 'ground floor';
  return v.toLowerCase();
}

/** Normalise property type */
function normalisePropType(v: string | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === '' || v === '---') return null;
  const lower = v.toLowerCase().trim();
  if (lower === 'hr' || lower === 'high rise' || lower === 'high-rise' || lower === 'highrise') return 'High Rise';
  if (lower === 'lr' || lower === 'low rise' || lower === 'low-rise' || lower === 'lowrise') return 'Low Rise';
  if (lower === 'house' || lower === 'h') return 'House';
  return v;
}

/** Parse a single raw CSV row into a typed ParsedRow */
function parseRow(raw: Record<string, string>): ParsedRow {
  const warnings: string[] = [];

  // PID — try multiple column names
  const pid = getCol(raw, 'PID', 'Pid', 'pid', 'Property_ref', 'property_ref', 'PropertyRef', 'PROPERTY_REF') ?? '';

  if (!pid) warnings.push('Missing PID — row will be skipped');

  const build_year = parseIntVal(getCol(raw, 'Build_year', 'build_year', 'BuildYear', 'BUILD_YEAR', 'Year Built', 'year_built'));
  const list_type = normaliseListType(getCol(raw, 'List_type', 'list_type', 'ListType', 'LIST_TYPE'));
  const prop_types = normalisePropType(getCol(raw, 'Property_type', 'property_type', 'PropertyType', 'PROPERTY_TYPE', 'prop_types', 'prop_type'));
  const floor_type = normaliseFloorType(getCol(raw, 'Floor_type', 'floor_type', 'FloorType', 'FLOOR_TYPE'));
  const saleable_area = parseFloatVal(getCol(raw, 'Saleable_size', 'saleable_size', 'SaleableSize', 'SALEABLE_SIZE', 'saleable_area', 'Saleable_area'));
  const gross_area = parseFloatVal(getCol(raw, 'Gross_size', 'gross_size', 'GrossSize', 'GROSS_SIZE', 'gross_area', 'Gross_area'));
  const outside_sc = parseFloatVal(getCol(raw, 'Outside_size', 'outside_size', 'OutsideSize', 'OUTSIDE_SIZE', 'outside_sc', 'Outside_sc'));
  const bedrooms = parseIntVal(getCol(raw, 'Bedroom', 'bedroom', 'Bedrooms', 'bedrooms', 'BEDROOM', 'BEDROOMS'));
  const bathrooms = parseIntVal(getCol(raw, 'Bathroom', 'bathroom', 'Bathrooms', 'bathrooms', 'BATHROOM', 'BATHROOMS'));
  const direction_id = normaliseDirection(getCol(raw, 'Direction', 'direction', 'Direction_id', 'direction_id', 'DIRECTION'));
  const view_id = normaliseView(getCol(raw, 'View_id', 'view_id', 'View', 'view', 'VIEW_ID', 'VIEW'));
  const decor_id = normaliseDecor(getCol(raw, 'Decor_id', 'decor_id', 'Decor', 'decor', 'DECOR_ID', 'DECOR'));

  // Boolean features
  const balcony = parseBool(getCol(raw, 'Balcony', 'balcony', 'BALCONY'));
  const combined = parseBool(getCol(raw, 'Combined', 'combined', 'COMBINED'));
  const duplex = parseBool(getCol(raw, 'Duplex', 'duplex', 'DUPLEX'));
  const garden = parseBool(getCol(raw, 'Garden', 'garden', 'GARDEN'));
  const openkitch = parseBool(getCol(raw, 'openkitchen', 'openkitch', 'OpenKitchen', 'open_kitchen', 'OPENKITCHEN', 'OPENKITCH'));
  const pool = parseBool(getCol(raw, 'Pool', 'pool', 'POOL'));
  const roof = parseBool(getCol(raw, 'Roof', 'roof', 'ROOF'));
  const terrace = parseBool(getCol(raw, 'Terrace', 'terrace', 'TERRACE'));

  const result: ParsedRow = { pid, _rawRow: raw, _warnings: warnings };

  if (build_year !== undefined) result.build_year = build_year;
  if (list_type !== undefined) result.list_type = list_type;
  if (prop_types !== undefined) result.prop_types = prop_types;
  if (floor_type !== undefined) result.floor_type = floor_type;
  if (saleable_area !== undefined) result.saleable_area = saleable_area;
  if (gross_area !== undefined) result.gross_area = gross_area;
  if (outside_sc !== undefined) result.outside_sc = outside_sc;
  if (bedrooms !== undefined) result.bedrooms = bedrooms;
  if (bathrooms !== undefined) result.bathrooms = bathrooms;
  if (direction_id !== undefined) result.direction_id = direction_id;
  if (view_id !== undefined) result.view_id = view_id;
  if (decor_id !== undefined) result.decor_id = decor_id;
  if (balcony !== undefined) result.balcony = balcony;
  if (combined !== undefined) result.combined = combined;
  if (duplex !== undefined) result.duplex = duplex;
  if (garden !== undefined) result.garden = garden;
  if (openkitch !== undefined) result.openkitch = openkitch;
  if (pool !== undefined) result.pool = pool;
  if (roof !== undefined) result.roof = roof;
  if (terrace !== undefined) result.terrace = terrace;

  return result;
}

// ─── Field display helpers ───────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  build_year: 'Build Year',
  list_type: 'List Type',
  prop_types: 'Property Type',
  floor_type: 'Floor Type',
  saleable_area: 'Saleable Size',
  gross_area: 'Gross Size',
  outside_sc: 'Outside Size',
  bedrooms: 'Bedrooms',
  bathrooms: 'Bathrooms',
  direction_id: 'Direction',
  view_id: 'View',
  decor_id: 'Decor',
  balcony: 'Balcony',
  combined: 'Combined',
  duplex: 'Duplex',
  garden: 'Garden',
  openkitch: 'Open Kitchen',
  pool: 'Pool',
  roof: 'Roof',
  terrace: 'Terrace',
};

const FIELD_KEYS = Object.keys(FIELD_LABELS);

function displayVal(v: unknown): string {
  if (v === undefined) return '—';
  if (v === null) return 'null';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PropertyFieldImportClient() {
  const [step, setStep] = useState<Step>('upload');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'warnings'>('all');
  const [resultFilter, setResultFilter] = useState<'all' | 'updated' | 'not_found' | 'error'>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert('Please upload a CSV file.');
      return;
    }
    setFileName(file.name);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const cols = result.meta.fields ?? [];
        setDetectedColumns(cols);
        const rows = result.data.map((r) => parseRow(r));
        setParsedRows(rows);
        setStep('preview');
      },
      error: (err) => {
        alert('Failed to parse CSV: ' + err.message);
      },
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const validRows = parsedRows.filter((r) => r.pid && r._warnings.length === 0);
  const warningRows = parsedRows.filter((r) => r._warnings.length > 0);

  const handleImport = async () => {
    const rowsToSend = validRows.map(({ _rawRow, _warnings, ...rest }) => rest);
    if (rowsToSend.length === 0) return;

    setImporting(true);
    setStep('importing');
    setProgress(0);

    const CHUNK = 100;
    const allResults: ImportResult[] = [];

    for (let i = 0; i < rowsToSend.length; i += CHUNK) {
      const chunk = rowsToSend.slice(i, i + CHUNK);
      try {
        const res = await fetch('/api/property-field-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: chunk }),
        });
        const data = await res.json();
        if (data.results) {
          allResults.push(...data.results);
        }
      } catch (err) {
        chunk.forEach((r) => allResults.push({ pid: r.pid, status: 'error', error: 'Network error' }));
      }
      setProgress(Math.round(((i + CHUNK) / rowsToSend.length) * 100));
    }

    const updated = allResults.filter((r) => r.status === 'updated').length;
    const notFound = allResults.filter((r) => r.status === 'not_found').length;
    const errors = allResults.filter((r) => r.status === 'error').length;

    setResults(allResults);
    setSummary({ total: rowsToSend.length, updated, notFound, errors });
    setImporting(false);
    setStep('done');
  };

  const reset = () => {
    setStep('upload');
    setParsedRows([]);
    setFileName('');
    setDetectedColumns([]);
    setResults([]);
    setSummary(null);
    setProgress(0);
    setExpandedRow(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Filtered preview rows
  const filteredPreview =
    previewFilter === 'valid'
      ? parsedRows.filter((r) => r.pid && r._warnings.length === 0)
      : previewFilter === 'warnings'
      ? parsedRows.filter((r) => r._warnings.length > 0)
      : parsedRows;

  // ── Filtered result rows
  const filteredResults =
    resultFilter === 'all'
      ? results
      : results.filter((r) => r.status === resultFilter);

  // ── Detected mapped fields (which FIELD_KEYS appear in at least one row)
  const mappedFields = FIELD_KEYS.filter((k) =>
    parsedRows.some((r) => (r as Record<string, unknown>)[k] !== undefined)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <Icon name="UploadIcon" className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Property Field Import</h1>
              <p className="text-sm text-gray-500">Update property fields by PID — bypasses all existing pipelines</p>
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-4">
            {(['upload', 'preview', 'importing', 'done'] as Step[]).map((s, idx) => (
              <React.Fragment key={s}>
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                  step === s ? 'bg-blue-600 text-white' :
                  (['upload', 'preview', 'importing', 'done'].indexOf(step) > idx) ? 'bg-green-100 text-green-700' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {step === s && s === 'importing' ? (
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse inline-block" />
                  ) : null}
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </div>
                {idx < 3 && <div className="w-6 h-px bg-gray-300" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ── STEP: UPLOAD ── */}
        {step === 'upload' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8">
            <div
              className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              <Icon name="FileTextIcon" className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-700 mb-1">Drop your CSV here or click to browse</p>
              <p className="text-sm text-gray-400">Must contain a PID column (property_ref)</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>

            {/* Field reference */}
            <div className="mt-8">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Supported CSV Columns</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { csv: 'PID / property_ref', db: 'property_ref (required)' },
                  { csv: 'Build_year', db: 'build_year' },
                  { csv: 'List_type', db: 'list_type' },
                  { csv: 'Property_type', db: 'prop_types / prop_type' },
                  { csv: 'Floor_type', db: 'floor_type' },
                  { csv: 'Saleable_size', db: 'saleable_area' },
                  { csv: 'Gross_size', db: 'gross_area' },
                  { csv: 'Outside_size', db: 'outside_sc' },
                  { csv: 'Bedroom', db: 'bedrooms' },
                  { csv: 'Bathroom', db: 'bathrooms' },
                  { csv: 'Direction', db: 'direction_id' },
                  { csv: 'View_id', db: 'view_id' },
                  { csv: 'Decor_id', db: 'decor_id' },
                  { csv: 'Balcony', db: 'balcony (boolean)' },
                  { csv: 'Combined', db: 'combined (boolean)' },
                  { csv: 'Duplex', db: 'duplex (boolean)' },
                  { csv: 'Garden', db: 'garden (boolean)' },
                  { csv: 'openkitchen', db: 'openkitch (boolean)' },
                  { csv: 'Pool', db: 'pool (boolean)' },
                  { csv: 'Roof', db: 'roof (boolean)' },
                  { csv: 'Terrace', db: 'terrace (boolean)' },
                ].map((f) => (
                  <div key={f.csv} className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                    <p className="text-xs font-mono font-semibold text-blue-700">{f.csv}</p>
                    <p className="text-xs text-gray-400 mt-0.5">→ {f.db}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Column names are case-insensitive. Only columns present in your CSV will be updated — missing columns are ignored.
              </p>
            </div>
          </div>
        )}

        {/* ── STEP: PREVIEW ── */}
        {step === 'preview' && (
          <div className="space-y-6">
            {/* Summary bar */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">File: <span className="font-medium text-gray-700">{fileName}</span></p>
                  <div className="flex gap-4">
                    <span className="text-sm"><span className="font-bold text-gray-900">{parsedRows.length}</span> <span className="text-gray-500">total rows</span></span>
                    <span className="text-sm"><span className="font-bold text-green-600">{validRows.length}</span> <span className="text-gray-500">ready to import</span></span>
                    {warningRows.length > 0 && (
                      <span className="text-sm"><span className="font-bold text-amber-600">{warningRows.length}</span> <span className="text-gray-500">will be skipped</span></span>
                    )}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={reset} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                    Upload Different File
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={validRows.length === 0}
                    className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Import {validRows.length} Properties
                  </button>
                </div>
              </div>

              {/* Detected mapped fields */}
              {mappedFields.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-2">Fields detected in CSV:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {mappedFields.map((f) => (
                      <span key={f} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100 font-medium">
                        {FIELD_LABELS[f]}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2">
              {(['all', 'valid', 'warnings'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setPreviewFilter(f)}
                  className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                    previewFilter === f ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {f === 'all' ? `All (${parsedRows.length})` : f === 'valid' ? `Ready (${validRows.length})` : `Skipped (${warningRows.length})`}
                </button>
              ))}
            </div>

            {/* Preview table */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">PID</th>
                      {mappedFields.map((f) => (
                        <th key={f} className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">
                          {FIELD_LABELS[f]}
                        </th>
                      ))}
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPreview.slice(0, 200).map((row, idx) => (
                      <tr
                        key={idx}
                        className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${row._warnings.length > 0 ? 'bg-amber-50' : ''}`}
                        onClick={() => setExpandedRow(expandedRow === row.pid + idx ? null : row.pid + idx)}
                      >
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold text-gray-800 whitespace-nowrap">
                          {row.pid || <span className="text-red-500 italic">missing</span>}
                        </td>
                        {mappedFields.map((f) => {
                          const v = (row as Record<string, unknown>)[f];
                          return (
                            <td key={f} className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                              {v === undefined ? <span className="text-gray-300">—</span> : displayVal(v)}
                            </td>
                          );
                        })}
                        <td className="px-4 py-2.5">
                          {row._warnings.length > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                              <Icon name="AlertTriangleIcon" className="w-3 h-3" />
                              Skip
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                              <Icon name="CheckIcon" className="w-3 h-3" />
                              Ready
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredPreview.length > 200 && (
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400 text-center">
                  Showing first 200 of {filteredPreview.length} rows
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP: IMPORTING ── */}
        {step === 'importing' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-6">
              <Icon name="UploadIcon" className="w-8 h-8 text-blue-600 animate-pulse" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Importing {validRows.length} properties…</h2>
            <p className="text-sm text-gray-500 mb-6">Updating fields directly in Supabase. Do not close this tab.</p>
            <div className="max-w-sm mx-auto">
              <div className="w-full bg-gray-100 rounded-full h-3 mb-2">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <p className="text-sm text-gray-500">{Math.min(progress, 100)}% complete</p>
            </div>
          </div>
        )}

        {/* ── STEP: DONE ── */}
        {step === 'done' && summary && (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Sent', value: summary.total, color: 'blue' },
                { label: 'Updated', value: summary.updated, color: 'green' },
                { label: 'Not Found', value: summary.notFound, color: 'amber' },
                { label: 'Errors', value: summary.errors, color: 'red' },
              ].map((card) => (
                <div key={card.label} className={`bg-white rounded-2xl border p-5 ${
                  card.color === 'green' ? 'border-green-200' :
                  card.color === 'amber' ? 'border-amber-200' :
                  card.color === 'red'? 'border-red-200' : 'border-gray-200'
                }`}>
                  <p className="text-xs text-gray-500 mb-1">{card.label}</p>
                  <p className={`text-3xl font-bold ${
                    card.color === 'green' ? 'text-green-600' :
                    card.color === 'amber' ? 'text-amber-600' :
                    card.color === 'red'? 'text-red-600' : 'text-gray-900'
                  }`}>{card.value}</p>
                </div>
              ))}
            </div>

            {/* Success banner */}
            {summary.updated > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                <Icon name="CheckCircleIcon" className="w-5 h-5 text-green-600 flex-shrink-0" />
                <p className="text-sm text-green-800 font-medium">
                  {summary.updated} propert{summary.updated === 1 ? 'y' : 'ies'} successfully updated in Supabase.
                  Open any property in Property Management to verify the changes.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={reset} className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
                Import Another File
              </button>
              <a href="/property-management" className="px-5 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 inline-flex items-center gap-2">
                <Icon name="HomeIcon" className="w-4 h-4" />
                Go to Property Management
              </a>
            </div>

            {/* Result filter tabs */}
            <div className="flex gap-2">
              {(['all', 'updated', 'not_found', 'error'] as const).map((f) => {
                const count = f === 'all' ? results.length : results.filter((r) => r.status === f).length;
                return (
                  <button
                    key={f}
                    onClick={() => setResultFilter(f)}
                    className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                      resultFilter === f ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {f === 'all' ? `All (${count})` : f === 'updated' ? `Updated (${count})` : f === 'not_found' ? `Not Found (${count})` : `Errors (${count})`}
                  </button>
                );
              })}
            </div>

            {/* Results table */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">PID</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Result</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.slice(0, 500).map((r, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold text-gray-800">{r.pid}</td>
                        <td className="px-4 py-2.5">
                          {r.status === 'updated' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                              <Icon name="CheckIcon" className="w-3 h-3" /> Updated
                            </span>
                          )}
                          {r.status === 'not_found' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                              <Icon name="SearchIcon" className="w-3 h-3" /> Not Found
                            </span>
                          )}
                          {r.status === 'error' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                              <Icon name="XIcon" className="w-3 h-3" /> Error
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-400">
                          {r.status === 'not_found' ? 'No property with this PID exists in the database' : r.error ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredResults.length > 500 && (
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400 text-center">
                  Showing first 500 of {filteredResults.length} results
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
