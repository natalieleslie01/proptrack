'use client';

import React, { useState, useRef, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import Papa from 'papaparse';
import BulkPhotoImport from './BulkPhotoImport';
import CSVImportValidator from './CSVImportValidator';
import { csvDebug, DB_COLUMNS } from '@/lib/csvImportDebug';
import ZipFolderPhotoImport from './ZipFolderPhotoImport';
import DeduplicatePhotos from './DeduplicatePhotos';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PropertyRow {
  property_ref: string;
  short_code?: string;
  village: string;
  area?: string;
  tower?: string;
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
  publish_dt?: string;
  asking_price?: number;
  asking_rent?: number;
  direction_view_id?: string;
  direction_id?: string;
  view_id?: string;
  furn_id?: string;
  decor_id?: boolean;
  balcony?: boolean;
  combined?: boolean;
  duplex?: boolean;
  garden?: boolean;
  openkitch?: boolean;
  pool?: boolean;
  roof?: boolean;
  terrace?: boolean;
  p_english?: string;
  p_chinese?: string;
  // DB enum: 'for-sale' | 'for-rent' | 'for-sale-and-rent' | 'self-occupy' | 'leased'
  status?: string;
  // Store original iRem numeric code for reference
  contact_status_code?: number;
}

// ─── DB-safe row type (only columns that exist in the properties table) ────────

interface DbPropertyRow {
  property_ref: string;
  village: string;
  short_code?: string;
  area?: string;
  tower?: string;
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
  publish_dt?: string;
  asking_price?: number;
  asking_rent?: number;
  direction_view_id?: string;
  direction_id?: string;
  view_id?: string;
  furn_id?: string;
  decor_id?: string;
  balcony: boolean;
  combined: boolean;
  duplex: boolean;
  garden: boolean;
  openkitch: boolean;
  pool: boolean;
  roof: boolean;
  terrace: boolean;
  p_english?: string;
  p_chinese?: string;
  status?: string;
  contact_status_code?: number;
}

interface ImportResult {
  success: number;
  skipped: number;
  errors: string[];
}

interface ExportFilter {
  status: string;
  occupancy: string;
  village: string;
}

const CSV_COLUMNS: Array<keyof PropertyRow> = [
  'property_ref', 'short_code', 'village', 'area', 'tower', 'build_year',
  'list_type', 'floor_type', 'prop_types', 'saleable_area', 'gross_area',
  'outside_sc', 'bedrooms', 'bathrooms', 'publish_dt', 'asking_price',
  'asking_rent', 'direction_view_id', 'furn_id', 'decor_id',
  'balcony', 'combined', 'duplex', 'garden', 'openkitch', 'pool', 'roof', 'terrace',
  'p_english', 'status',
];

const STATUS_OPTIONS = ['all', 'for-sale', 'for-rent', 'for-sale-and-rent', 'self-occupy', 'leased'];
const OCCUPANCY_OPTIONS = ['all', 'vacant', 'vacant-soon', 'leased', 'with-ta'];
const VILLAGE_OPTIONS = [
  'all', 'Headland', 'Seabee Lane', 'Beach', 'Parkvale', 'Parkland',
  'Coastline', 'Upper Caperidge', 'Lower Caperidge', 'Crestmont',
  'Greenvale', 'Neo Horizon', 'Woods', 'Middle Lane', 'Midvale',
  'Discovery Bay',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Maps iRem numeric status codes to the DB property_status enum values.
 * iRem codes: 0=Active, 1=Leased, 2=Self Occupy, 3=No Contact, 4=Sold, 9=Unknown, 99=Blank
 * DB enum:    'for-rent' | 'for-sale' | 'for-sale-and-rent' | 'self-occupy' | 'leased'
 *
 * When status code is 0 (Active), we also check list_type to determine the correct status:
 *   list_type "sale"         → 'for-sale'
 *   list_type "rent"         → 'for-rent'
 *   list_type "rent & sale"  → 'for-sale-and-rent'
 */
function mapIRemStatus(
  raw: string | undefined,
  listType?: string
): { status: string | undefined; contact_status_code: number | undefined } {
  if (!raw || raw.trim() === '') return { status: undefined, contact_status_code: undefined };
  const code = parseInt(raw.trim(), 10);
  if (isNaN(code)) {
    // Already a string enum value — pass through if valid
    const valid = ['for-sale', 'for-rent', 'for-sale-and-rent', 'self-occupy', 'leased'];
    return { status: valid.includes(raw.trim()) ? raw.trim() : undefined, contact_status_code: undefined };
  }
  const contact_status_code = code;

  // For active listings (code 0 or 3), derive status from list_type
  if (code === 0 || code === 3) {
    const lt = (listType || '').trim().toLowerCase();
    if (lt === 'sale') return { status: 'for-sale', contact_status_code };
    if (lt === 'rent') return { status: 'for-rent', contact_status_code };
    if (lt === 'rent & sale' || lt === 'sale & rent') return { status: 'for-sale-and-rent', contact_status_code };
    // Default active → for-rent
    return { status: 'for-rent', contact_status_code };
  }

  switch (code) {
    case 1: return { status: 'leased', contact_status_code };
    case 2: return { status: 'self-occupy', contact_status_code };
    case 4: return { status: 'for-sale', contact_status_code };
    case 9: return { status: undefined, contact_status_code };
    case 99: return { status: undefined, contact_status_code };
    default: return { status: undefined, contact_status_code };
  }
}

function sanitizeRow(raw: Record<string, string>): DbPropertyRow | null {
  // Support exact iRem CSV headers (with spaces) and legacy headers
  const ref = (
    raw['pid'] ||
    raw['property_ref'] ||
    raw['Property Ref'] ||
    ''
  ).trim();
  if (!ref) return null;

  const parseBool = (val: string | undefined): boolean => {
    if (!val) return false;
    const v = val.trim().toUpperCase();
    return v === 'Y' || v === 'YES' || v === 'TRUE' || v === '1';
  };

  const parseIntSafe = (val: string | undefined): number | undefined => {
    if (!val || val.trim() === '' || val.trim().toUpperCase() === 'NULL') return undefined;
    const n = parseInt(val.trim(), 10);
    return isNaN(n) ? undefined : n;
  };

  const parseFloatSafe = (val: string | undefined): number | undefined => {
    if (!val || val.trim() === '' || val.trim().toUpperCase() === 'NULL') return undefined;
    const n = parseFloat(val.trim());
    return isNaN(n) ? undefined : n;
  };

  const cleanStr = (val: string | undefined): string | undefined => {
    if (!val || val.trim() === '' || val.trim().toUpperCase() === 'NULL') return undefined;
    return val.trim();
  };

  /**
   * Derives floor_type from prop_type and a floor number/label.
   *
   * High rise rules:  1–6  → "low floor" | 7–12 → "middle floor" | 13+ → "high floor" * Low rise rules:   LG/G →"low floor" | 1–3  → "middle floor" | 4–5  → "high floor"
   *
   * Returns undefined when the combination cannot be determined.
   */
  function deriveFloorType(propType: string | undefined, floorRaw: string | undefined): string | undefined {
    if (!propType || !floorRaw) return undefined;
    const pt = propType.trim().toLowerCase();
    const fl = floorRaw.trim().toUpperCase();

    const isHighRise = pt.includes('high') || pt === 'hr';
    const isLowRise  = pt.includes('low')  || pt === 'lr';

    if (!isHighRise && !isLowRise) return undefined;

    if (isHighRise) {
      // Floor label may be "8", "08", "8F", "8/F" — extract leading digits
      const match = fl.match(/^(\d+)/);
      if (!match) return undefined;
      const n = parseInt(match[1], 10);
      if (n <= 6)  return 'low floor';
      if (n <= 12) return 'middle floor';
      return 'high floor';
    }

    // Low rise
    if (fl === 'LG' || fl === 'G' || fl === 'GF' || fl === 'G/F' || fl === 'LG/F') return 'low floor';
    const match = fl.match(/^(\d+)/);
    if (!match) return undefined;
    const n = parseInt(match[1], 10);
    if (n <= 3) return 'middle floor';
    if (n <= 5) return 'high floor';
    return undefined;
  }

  /**
   * Extracts the floor label from an iRem property_ref (pid).
   * iRem pid format: SHORTCODE-FLOORUNIT  e.g. "SN1-08C" → floor "08"
   * Falls back to undefined if the pattern doesn't match.
   */
  function extractFloorFromRef(ref: string): string | undefined {
    // Match digits (with optional leading zeros) immediately after the dash
    const match = ref.match(/-(\d+)/);
    return match ? match[1] : undefined;
  }

  // Normalise publish_dt: accept D/M/YYYY, DD/MM/YYYY, YYYY-MM-DD
  const normaliseDateStr = (val: string | undefined): string | undefined => {
    if (!val || val.trim() === '' || val.trim().toUpperCase() === 'NULL') return undefined;
    const v = val.trim();
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    // D/M/YYYY or DD/MM/YYYY
    const dmy = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    return undefined;
  };

  // Exact iRem CSV column names (note spaces in some headers)
  const listType = cleanStr(raw['list_type'] || raw['list type']);
  const { status, contact_status_code } = mapIRemStatus(
    raw['status'] || raw['Status'],
    listType
  );

  // direction_id and view_id are separate columns in the iRem CSV
  // The CSV header is "direction _id" (with a space before underscore) — handle both
  const directionId = cleanStr(
    raw['direction_id'] ||
    raw['direction _id'] ||
    raw['direction id'] ||
    raw['direction_view_id']
  );
  const viewId = cleanStr(raw['view_id'] || raw['view id']);

  // Combine for backward-compat direction_view_id field
  const directionViewId = directionId
    ? viewId
      ? `${directionId}/${viewId}`
      : directionId
    : viewId;

  const propType = cleanStr(raw['prop_type'] || raw['prop_types'] || raw['prop type']);

  // Build the DB row — only include fields that exist as DB columns
  // Strip undefined values so PostgREST doesn't reject the payload
  const row: DbPropertyRow = {
    property_ref: ref,
    village: cleanStr(raw['village'] || raw['Village']) || 'Discovery Bay',
    // status: undefined means blank (99=Blank fallback) — no default enum value forced
    status: status || undefined,
    balcony: parseBool(raw['balcony']),
    combined: parseBool(raw['combined']),
    duplex: parseBool(raw['duplex']),
    garden: parseBool(raw['garden']),
    openkitch: parseBool(raw['openkitchen'] || raw['openkitch'] || raw['open kitchen']),
    pool: parseBool(raw['pool']),
    roof: parseBool(raw['roof']),
    terrace: parseBool(raw['terrace']),
  };

  // Only add optional fields when they have a real value (avoids sending undefined to PostgREST)
  const sc = cleanStr(raw['short_code'] || raw['short code'] || raw['short  code']);
  if (sc !== undefined) row.short_code = sc;

  const area = cleanStr(raw['area'] || raw['Area']);
  if (area !== undefined) row.area = area;

  const tower = cleanStr(raw['tower'] || raw['Tower']);
  if (tower !== undefined) row.tower = tower;

  const buildYear = parseIntSafe(raw['build_year'] || raw['build year']);
  if (buildYear !== undefined) row.build_year = buildYear;

  row.list_type = listType ?? 'unknown';

  const floorType = cleanStr(raw['floor_type'] || raw['floor type']);
  // Also check for a dedicated floor number column in the CSV
  const floorNumRaw = cleanStr(raw['floor_no'] || raw['floor_num'] || raw['floor number'] || raw['floor']);
  // Fall back to extracting floor from the property_ref (pid)
  const floorForDerive = floorNumRaw ?? extractFloorFromRef(ref);

  if (floorType !== undefined) {
    row.floor_type = floorType;
  } else {
    // Derive floor_type from prop_type + floor number when CSV floor_type is NULL
    const derived = deriveFloorType(propType, floorForDerive);
    if (derived !== undefined) row.floor_type = derived;
  }

  if (propType !== undefined) { row.prop_types = propType; row.prop_type = propType; }

  const saleableArea = parseFloatSafe(
    raw['saleable sqft_size'] || raw['saleable_sqft_size'] || raw['saleable_s'] || raw['saleable_area']
  );
  if (saleableArea !== undefined) row.saleable_area = saleableArea;

  const grossArea = parseFloatSafe(
    raw['gross sqft_size'] || raw['gross_sqft_size'] || raw['gross_sqft'] || raw['gross_area']
  );
  if (grossArea !== undefined) row.gross_area = grossArea;

  const outsideSc = parseFloatSafe(
    raw['outside sqft_size'] || raw['outside_sqft_size'] || raw['outside_sc']
  );
  if (outsideSc !== undefined) row.outside_sc = outsideSc;

  const bedrooms = parseIntSafe(raw['bedroom'] || raw['bedrooms']);
  if (bedrooms !== undefined) row.bedrooms = bedrooms;

  const bathrooms = parseIntSafe(raw['bathroom'] || raw['bathrooms']);
  if (bathrooms !== undefined) row.bathrooms = bathrooms;

  const publishDt = normaliseDateStr(raw['publish_dt'] || raw['publish dt']);
  if (publishDt !== undefined) row.publish_dt = publishDt;

  const askingPrice = parseFloatSafe(raw['sale_price'] || raw['asking_price']);
  if (askingPrice !== undefined) row.asking_price = askingPrice;

  const askingRent = parseFloatSafe(raw['rent_price'] || raw['asking_rent']);
  if (askingRent !== undefined) row.asking_rent = askingRent;

  if (directionViewId !== undefined) row.direction_view_id = directionViewId;
  if (directionId !== undefined) row.direction_id = directionId;
  if (viewId !== undefined) row.view_id = viewId;

  const furnId = cleanStr(raw['furn_id'] || raw['furn id']);
  row.furn_id = furnId !== undefined && furnId !== null && furnId !== '' ? furnId : 'unfurnished';

  const decorId = cleanStr(raw['decor_id'] || raw['decor id']);
  if (decorId !== undefined) row.decor_id = decorId;

  const pEnglish = cleanStr(
    raw['p_english_remark'] || raw['p_english'] || raw['p english remark'] || raw['p_eng_remark']
  );
  if (pEnglish !== undefined) row.p_english = pEnglish;

  const pChinese = cleanStr(raw['p_chinese'] || raw['p_chi_remark'] || raw['p chinese remark']);
  if (pChinese !== undefined) row.p_chinese = pChinese;

  if (contact_status_code !== undefined) row.contact_status_code = contact_status_code;

  // ── Schema mismatch guard: strip any key not in the DB schema ──────────────
  const unknownKeys = Object.keys(row).filter((k) => !DB_COLUMNS.has(k));
  if (unknownKeys.length > 0) {
    console.warn('[CSV-DEBUG] sanitizeRow: stripping unknown DB keys:', unknownKeys);
    unknownKeys.forEach((k) => { delete (row as Record<string, unknown>)[k]; });
  }

  return row;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DataImportExportClient() {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<DbPropertyRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importMode, setImportMode] = useState<'upsert' | 'skip'>('upsert');
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [totalParsedRows, setTotalParsedRows] = useState<number>(0);

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportFilter, setExportFilter] = useState<ExportFilter>({ status: 'all', occupancy: 'all', village: 'all' });
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv'>('excel');

  // ── CSV Template Download ──────────────────────────────────────────────────

  const downloadTemplate = useCallback(() => {
    const csv = Papa.unparse({ fields: CSV_COLUMNS, data: [] });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, 'property_import_template.csv');
    toast.success('Template downloaded');
  }, []);

  // ── File Parsing ──────────────────────────────────────────────────────────

  const parseFile = useCallback((file: File) => {
    setImportFile(file);
    setImportResult(null);
    setImportErrors([]);
    setImportPreview([]);
    setImportProgress(null);
    setTotalParsedRows(0);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const errors: string[] = [];
        const rows: DbPropertyRow[] = [];

        // ── Debug: log CSV headers and field mapping coverage ──────────────
        const headers = results.meta.fields ?? [];
        csvDebug.logHeaders(headers);
        csvDebug.logFieldMappingCoverage(headers);

        let skippedCount = 0;
        results.data.forEach((raw, idx) => {
          const row = sanitizeRow(raw);
          if (!row) {
            errors.push(`Row ${idx + 2}: Missing required field "pid" (numeric property identifier)`);
            skippedCount++;
            // Log first 5 skipped rows for diagnosis
            if (skippedCount <= 5) csvDebug.logSanitizedRow(idx, raw, null);
          } else {
            // Log first 3 rows for spot-checking field mapping
            if (idx < 3) {
              csvDebug.logSanitizedRow(idx, raw, row as unknown as Record<string, unknown>);
              csvDebug.logSchemaMismatch(idx, row as unknown as Record<string, unknown>);
            }
            rows.push(row);
          }
        });

        if (results.errors.length > 0) {
          results.errors.slice(0, 5).forEach((e) => errors.push(`Parse error row ${e.row}: ${e.message}`));
          if (results.errors.length > 5) {
            errors.push(`…and ${results.errors.length - 5} more parse errors`);
          }
        }

        csvDebug.logParseResult(results.data.length, rows.length, skippedCount, results.errors.length);

        setTotalParsedRows(rows.length);
        setImportPreview(rows.slice(0, 10));
        setImportErrors(errors);
        if (rows.length === 0 && errors.length === 0) {
          setImportErrors(['No valid rows found in the file.']);
        }
      },
      error: (err) => {
        setImportErrors([`Failed to parse file: ${err.message}`]);
      },
    });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) {
      parseFile(file);
    } else {
      toast.error('Please drop a .csv file');
    }
  };

  // ── Import to Supabase ────────────────────────────────────────────────────

  const handleImport = useCallback(async () => {
    if (!importFile || importPreview.length === 0) return;
    setImporting(true);
    setImportResult(null);
    setImportProgress(null);

    // Re-parse full file (preview only shows first 10)
    Papa.parse<Record<string, string>>(importFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const allRows: DbPropertyRow[] = [];
        results.data.forEach((raw) => {
          const row = sanitizeRow(raw);
          if (row) allRows.push(row);
        });

        const totalRows = allRows.length;
        let success = 0;
        let skipped = 0;
        const errors: string[] = [];

        setImportProgress({ current: 0, total: totalRows });

        // Process in batches of 50 for reliability on large datasets
        const batchSize = 50;
        let aborted = false;
        for (let i = 0; i < allRows.length; i += batchSize) {
          if (aborted) break;
          const batch = allRows.slice(i, i + batchSize);
          const batchNum = Math.floor(i / batchSize) + 1;
          const rangeEnd = Math.min(i + batchSize, totalRows);
          try {
            if (importMode === 'upsert') {
              csvDebug.logBatchStart(batchNum, batch.length, i + 1, rangeEnd, 'upsert', batch[0]?.property_ref);
              csvDebug.logBatchPayloadSample(batchNum, batch[0] as unknown as Record<string, unknown>);

              // ── SQL LOGGING: pre-upsert ──────────────────────────────────
              console.log(
                `[Import][Batch ${batchNum}] UPSERT START — rows: ${batch.length}, ` +
                `range: ${i + 1}–${rangeEnd}, ` +
                `first ref: ${batch[0]?.property_ref}`
              );
              console.log(`[Import][Batch ${batchNum}] Sample payload (first row):`, JSON.stringify(batch[0]));

              const upsertResponse = await supabase
                .from('properties')
                .upsert(batch, { onConflict: 'property_ref' });

              csvDebug.logBatchResponse(
                batchNum, 'upsert',
                upsertResponse.status, upsertResponse.statusText,
                upsertResponse.error
                  ? {
                      message: upsertResponse.error.message,
                      code: (upsertResponse.error as { code?: string }).code,
                      details: (upsertResponse.error as { details?: string }).details,
                      hint: (upsertResponse.error as { hint?: string }).hint,
                    }
                  : null
              );

              // ── SQL LOGGING: post-upsert ─────────────────────────────────
              console.log(
                `[Import][Batch ${batchNum}] UPSERT RESPONSE — ` +
                `error: ${upsertResponse.error ? JSON.stringify(upsertResponse.error) : 'null'}, ` +
                `status: ${upsertResponse.status}, statusText: ${upsertResponse.statusText}`
              );

              if (upsertResponse.error) {
                console.error(`[Import] Batch ${batchNum} upsert error:`, upsertResponse.error);
                errors.push(`Batch ${batchNum} (rows ${i + 1}–${rangeEnd}): ${upsertResponse.error.message}`);
                skipped += batch.length;
                // Collect all errors instead of aborting on first failure
                toast.error(`Batch ${batchNum} failed: ${upsertResponse.error.message}`);
              } else {
                success += batch.length;

                // ── SQL LOGGING: verify rows landed in DB ────────────────
                const refs = batch.map((r) => r.property_ref);
                const { count, error: countErr } = await supabase
                  .from('properties')
                  .select('property_ref', { count: 'exact', head: true })
                  .in('property_ref', refs);

                csvDebug.logBatchVerify(batchNum, batch.length, count ?? null, countErr);
                console.log(
                  `[Import][Batch ${batchNum}] DB VERIFY — ` +
                  `expected: ${batch.length}, found in DB: ${count ?? 'unknown'}, ` +
                  `countErr: ${countErr ? JSON.stringify(countErr) : 'null'}`
                );
              }
            } else {
              // skip existing
              const refs = batch.map((r) => r.property_ref);
              const { data: existing } = await supabase
                .from('properties')
                .select('property_ref')
                .in('property_ref', refs);
              const existingRefs = new Set((existing || []).map((r: { property_ref: string }) => r.property_ref));
              const newRows = batch.filter((r) => !existingRefs.has(r.property_ref));
              skipped += batch.length - newRows.length;
              if (newRows.length > 0) {
                csvDebug.logBatchStart(batchNum, newRows.length, i + 1, rangeEnd, 'insert', newRows[0]?.property_ref);
                csvDebug.logBatchPayloadSample(batchNum, newRows[0] as unknown as Record<string, unknown>);

                // ── SQL LOGGING: pre-insert ──────────────────────────────
                console.log(
                  `[Import][Batch ${batchNum}] INSERT START — new rows: ${newRows.length}, ` +
                  `skipped existing: ${batch.length - newRows.length}, ` +
                  `first ref: ${newRows[0]?.property_ref}`
                );
                console.log(`[Import][Batch ${batchNum}] Sample payload (first row):`, JSON.stringify(newRows[0]));

                const insertResponse = await supabase.from('properties').insert(newRows);

                csvDebug.logBatchResponse(
                  batchNum, 'insert',
                  insertResponse.status, insertResponse.statusText,
                  insertResponse.error
                    ? {
                        message: insertResponse.error.message,
                        code: (insertResponse.error as { code?: string }).code,
                        details: (insertResponse.error as { details?: string }).details,
                        hint: (insertResponse.error as { hint?: string }).hint,
                      }
                    : null
                );

                // ── SQL LOGGING: post-insert ─────────────────────────────
                console.log(
                  `[Import][Batch ${batchNum}] INSERT RESPONSE — ` +
                  `error: ${insertResponse.error ? JSON.stringify(insertResponse.error) : 'null'}, ` +
                  `status: ${insertResponse.status}, statusText: ${insertResponse.statusText}`
                );

                if (insertResponse.error) {
                  console.error(`[Import] Batch ${batchNum} insert error:`, insertResponse.error);
                  errors.push(`Batch ${batchNum} (rows ${i + 1}–${rangeEnd}): ${insertResponse.error.message}`);
                  skipped += newRows.length;
                  // Collect all errors instead of aborting on first failure
                  toast.error(`Batch ${batchNum} failed: ${insertResponse.error.message}`);
                } else {
                  success += newRows.length;

                  // ── SQL LOGGING: verify rows landed in DB ────────────
                  const { count, error: countErr } = await supabase
                    .from('properties')
                    .select('property_ref', { count: 'exact', head: true })
                    .in('property_ref', newRows.map((r) => r.property_ref));

                  csvDebug.logBatchVerify(batchNum, newRows.length, count ?? null, countErr);
                  console.log(
                    `[Import][Batch ${batchNum}] DB VERIFY — ` +
                    `expected: ${newRows.length}, found in DB: ${count ?? 'unknown'}, ` +
                    `countErr: ${countErr ? JSON.stringify(countErr) : 'null'}`
                  );
                }
              } else {
                console.log(`[Import][Batch ${batchNum}] SKIP — all ${batch.length} rows already exist in DB`);
              }
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unexpected error';
            console.error(`[Import] Batch ${batchNum} exception:`, err);
            errors.push(`Batch ${batchNum}: ${msg}`);
            skipped += batch.length;
            toast.error(`Batch ${batchNum} exception: ${msg}`);
          }

          // Update progress after each batch
          setImportProgress({ current: Math.min(i + batchSize, totalRows), total: totalRows });
        }

        csvDebug.logImportSummary(totalRows, success, skipped, errors);

        setImportResult({ success, skipped, errors });
        setImportProgress(null);
        setImporting(false);
        if (success > 0) {
          toast.success(`${success.toLocaleString()} properties imported successfully`);
        }
        if (errors.length > 0) {
          toast.error(`${errors.length} batch(es) failed — check error details below`);
        }
      },
      error: () => {
        setImporting(false);
        setImportProgress(null);
        toast.error('Failed to read file');
      },
    });
  }, [importFile, importPreview, importMode, supabase]);

  // ── Export ────────────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      let query = supabase.from('properties').select('*');
      if (exportFilter.status !== 'all') query = query.eq('status', exportFilter.status);
      if (exportFilter.occupancy !== 'all') query = query.eq('occupancy', exportFilter.occupancy);
      if (exportFilter.village !== 'all') query = query.eq('village', exportFilter.village);

      const { data, error } = await query.order('property_ref');
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.warning('No properties match the selected filters');
        setExporting(false);
        return;
      }

      const timestamp = new Date().toISOString().slice(0, 10);

      if (exportFormat === 'csv') {
        const csv = Papa.unparse(data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        downloadBlob(blob, `properties_export_${timestamp}.csv`);
        toast.success(`${data.length} properties exported as CSV`);
      } else {
        // Excel via exceljs (dynamic import to avoid SSR issues)
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'PropTrack HK';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet('Properties', {
          views: [{ state: 'frozen', ySplit: 1 }],
        });

        // Header row
        const headers = CSV_COLUMNS.map((c) => ({
          header: c.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
          key: c,
          width: 20,
        }));
        sheet.columns = headers;

        // Style header
        const headerRow = sheet.getRow(1);
        headerRow.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B1A2B' } };
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = {
            bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          };
        });
        headerRow.height = 28;

        // Data rows
        data.forEach((row, idx) => {
          const dataRow = sheet.addRow(CSV_COLUMNS.map((col) => (row as Record<string, unknown>)[col] ?? ''));
          if (idx % 2 === 1) {
            dataRow.eachCell((cell) => {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } };
            });
          }
          dataRow.height = 22;
        });

        // Auto-fit columns
        sheet.columns.forEach((col) => {
          if (col.values) {
            const maxLen = Math.max(
              ...col.values.filter(Boolean).map((v) => String(v).length),
              10
            );
            col.width = Math.min(maxLen + 4, 40);
          }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        downloadBlob(blob, `properties_export_${timestamp}.xlsx`);
        toast.success(`${data.length} properties exported as Excel`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }, [exportFilter, exportFormat, supabase]);

  // ── Reset Import ──────────────────────────────────────────────────────────

  const resetImport = () => {
    setImportFile(null);
    setImportPreview([]);
    setImportErrors([]);
    setImportResult(null);
    setImportProgress(null);
    setTotalParsedRows(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(215,25%,18%)] tracking-tight">Data Import / Export</h1>
          <p className="text-sm text-[hsl(215,15%,52%)] mt-0.5">
            Sync external property data via CSV import and archive records with bulk Excel export
          </p>
        </div>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[hsl(214,20%,88%)] bg-white text-sm font-medium text-[hsl(215,25%,18%)] hover:bg-[hsl(210,15%,94%)] transition-colors"
        >
          <Icon name="DownloadIcon" size={15} />
          CSV Template
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ── Import Panel ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[hsl(214,20%,88%)] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1B4F8A]/10 flex items-center justify-center">
              <Icon name="UploadIcon" size={16} className="text-[#1B4F8A]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[hsl(215,25%,18%)]">Import from CSV</h2>
              <p className="text-xs text-[hsl(215,15%,52%)]">Upload a CSV file to add or update properties</p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Drop zone */}
            {!importFile ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-[#1B4F8A] bg-[#1B4F8A]/5'
                    : 'border-[hsl(214,20%,88%)] hover:border-[#1B4F8A]/50 hover:bg-[hsl(210,20%,97%)]'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-[hsl(210,20%,97%)] flex items-center justify-center mx-auto mb-3">
                  <Icon name="FileSpreadsheetIcon" size={22} className="text-[hsl(215,15%,52%)]" />
                </div>
                <p className="text-sm font-medium text-[hsl(215,25%,18%)]">Drop CSV file here or click to browse</p>
                <p className="text-xs text-[hsl(215,15%,52%)] mt-1">Supports .csv files up to 10 MB</p>
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
                <Icon name="FileTextIcon" size={18} className="text-[#1B4F8A] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[hsl(215,25%,18%)] truncate">{importFile.name}</p>
                  <p className="text-xs text-[hsl(215,15%,52%)]">
                    {(importFile.size / 1024).toFixed(1)} KB · {totalParsedRows > 0 ? `${totalParsedRows.toLocaleString()} rows parsed` : `${importPreview.length} rows previewed`}
                  </p>
                </div>
                <button onClick={resetImport} className="p-1.5 rounded-lg hover:bg-[hsl(214,20%,88%)] transition-colors">
                  <Icon name="XIcon" size={14} className="text-[hsl(215,15%,52%)]" />
                </button>
              </div>
            )}

            {/* Import mode */}
            <div>
              <p className="text-xs font-medium text-[hsl(215,25%,18%)] mb-2">Duplicate handling</p>
              <div className="flex gap-2">
                {(['upsert', 'skip'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setImportMode(mode)}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
                      importMode === mode
                        ? 'bg-[#1B4F8A] text-white border-[#1B4F8A]'
                        : 'bg-white text-[hsl(215,25%,18%)] border-[hsl(214,20%,88%)] hover:bg-[hsl(210,15%,94%)]'
                    }`}
                  >
                    {mode === 'upsert' ? 'Update existing' : 'Skip existing'}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[hsl(215,15%,52%)] mt-1.5">
                {importMode === 'upsert' ?'Existing properties (matched by PID) will be updated with new data.' :'Existing properties will be left unchanged; only new records will be inserted.'}
              </p>
            </div>

            {/* Parse errors */}
            {importErrors.length > 0 && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 space-y-1">
                <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
                  <Icon name="AlertCircleIcon" size={13} />
                  {importErrors.length} issue{importErrors.length > 1 ? 's' : ''} found
                </p>
                <ul className="space-y-0.5 max-h-24 overflow-y-auto">
                  {importErrors.map((e, i) => (
                    <li key={i} className="text-[11px] text-red-600">{e}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Preview table */}
            {importPreview.length > 0 && (
              <div>
                <p className="text-xs font-medium text-[hsl(215,25%,18%)] mb-2">
                  Preview (first {importPreview.length} rows)
                </p>
                <div className="overflow-x-auto rounded-lg border border-[hsl(214,20%,88%)]">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-[hsl(210,20%,97%)]">
                        {['PID', 'Village', 'Area', 'Bedrooms', 'Status', 'Short Code'].map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-semibold text-[hsl(215,25%,18%)] whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.map((row, i) => (
                        <tr key={i} className="border-t border-[hsl(214,20%,88%)] hover:bg-[hsl(210,20%,97%)]">
                          <td className="px-3 py-2 font-mono text-[#1B4F8A] whitespace-nowrap">{row.property_ref}</td>
                          <td className="px-3 py-2 text-[hsl(215,25%,18%)] whitespace-nowrap">{row.village || '—'}</td>
                          <td className="px-3 py-2 text-[hsl(215,25%,18%)]">{row.area || '—'}</td>
                          <td className="px-3 py-2 text-[hsl(215,25%,18%)]">{row.bedrooms ?? '—'}</td>
                          <td className="px-3 py-2">
                            {row.status ? (
                              <span className="px-1.5 py-0.5 rounded-full bg-[#1B4F8A]/10 text-[#1B4F8A] font-medium">
                                {row.status}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-3 py-2 text-[hsl(215,25%,18%)] whitespace-nowrap font-mono text-[10px]">{row.short_code || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Import result */}
            {importResult && (
              <div className={`rounded-lg p-3 border ${importResult.errors.length === 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon
                    name={importResult.errors.length === 0 ? 'CheckCircleIcon' : 'XCircleIcon'}
                    size={14}
                    className={importResult.errors.length === 0 ? 'text-green-600' : 'text-red-600'}
                  />
                  <p className={`text-xs font-semibold ${importResult.errors.length === 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {importResult.errors.length === 0 ? 'Import complete' : 'Import failed'}
                  </p>
                </div>
                <div className="flex gap-4 text-xs mb-2">
                  <span className="text-green-700"><strong>{importResult.success}</strong> imported</span>
                  <span className="text-[hsl(215,15%,52%)]"><strong>{importResult.skipped}</strong> skipped</span>
                  {importResult.errors.length > 0 && (
                    <span className="text-red-600"><strong>{importResult.errors.length}</strong> error{importResult.errors.length > 1 ? 's' : ''}</span>
                  )}
                </div>
                {importResult.errors.length > 0 && (
                  <ul className="space-y-1 max-h-32 overflow-y-auto">
                    {importResult.errors.map((e, i) => (
                      <li key={i} className="text-[11px] text-red-700 font-mono bg-red-100 rounded px-2 py-1 break-all">{e}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Progress bar during import */}
            {importing && importProgress && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[hsl(215,25%,18%)] font-medium flex items-center gap-1.5">
                    <Icon name="LoaderIcon" size={12} className="animate-spin text-[#1B4F8A]" />
                    Importing…
                  </span>
                  <span className="text-[hsl(215,15%,52%)]">
                    {importProgress.current.toLocaleString()} / {importProgress.total.toLocaleString()}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[hsl(214,20%,88%)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#1B4F8A] transition-all duration-300"
                    style={{ width: `${Math.round((importProgress.current / importProgress.total) * 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-[hsl(215,15%,52%)]">
                  {Math.round((importProgress.current / importProgress.total) * 100)}% complete
                </p>
              </div>
            )}

            {/* Import button */}
            <button
              onClick={handleImport}
              disabled={!importFile || importPreview.length === 0 || importing}
              className="w-full py-2.5 rounded-lg bg-[#1B4F8A] text-white text-sm font-semibold hover:bg-[#1B4F8A]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {importing ? (
                <>
                  <Icon name="LoaderIcon" size={15} className="animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  <Icon name="UploadIcon" size={15} />
                  Import Properties
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Export Panel ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[hsl(214,20%,88%)] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#8B1A2B]/10 flex items-center justify-center">
              <Icon name="DownloadIcon" size={16} className="text-[#8B1A2B]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[hsl(215,25%,18%)]">Bulk Export</h2>
              <p className="text-xs text-[hsl(215,15%,52%)]">Export filtered property records to Excel or CSV</p>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* Format selector */}
            <div>
              <p className="text-xs font-medium text-[hsl(215,25%,18%)] mb-2">Export format</p>
              <div className="flex gap-2">
                {([
                  { value: 'excel', label: 'Excel (.xlsx)', icon: 'TableIcon' },
                  { value: 'csv', label: 'CSV (.csv)', icon: 'FileTextIcon' },
                ] as const).map((fmt) => (
                  <button
                    key={fmt.value}
                    onClick={() => setExportFormat(fmt.value)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-medium border transition-colors ${
                      exportFormat === fmt.value
                        ? 'bg-[#8B1A2B] text-white border-[#8B1A2B]'
                        : 'bg-white text-[hsl(215,25%,18%)] border-[hsl(214,20%,88%)] hover:bg-[hsl(210,15%,94%)]'
                    }`}
                  >
                    <Icon name={fmt.icon} size={13} />
                    {fmt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-[hsl(215,25%,18%)]">Filter records</p>

              <div>
                <label className="text-[11px] text-[hsl(215,15%,52%)] mb-1 block">Status</label>
                <select
                  value={exportFilter.status}
                  onChange={(e) => setExportFilter((f) => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-[hsl(214,20%,88%)] text-sm text-[hsl(215,25%,18%)] bg-white focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B]"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-[hsl(215,15%,52%)] mb-1 block">Occupancy</label>
                <select
                  value={exportFilter.occupancy}
                  onChange={(e) => setExportFilter((f) => ({ ...f, occupancy: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-[hsl(214,20%,88%)] text-sm text-[hsl(215,25%,18%)] bg-white focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B]"
                >
                  {OCCUPANCY_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o === 'all' ? 'All Occupancy' : o.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-[hsl(215,15%,52%)] mb-1 block">Village</label>
                <select
                  value={exportFilter.village}
                  onChange={(e) => setExportFilter((f) => ({ ...f, village: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-[hsl(214,20%,88%)] text-sm text-[hsl(215,25%,18%)] bg-white focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B]"
                >
                  {VILLAGE_OPTIONS.map((v) => (
                    <option key={v} value={v}>{v === 'all' ? 'All Villages' : v}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Export info */}
            <div className="rounded-lg bg-[hsl(210,20%,97%)] border border-[hsl(214,20%,88%)] p-3 space-y-2">
              <p className="text-xs font-medium text-[hsl(215,25%,18%)]">Exported columns</p>
              <div className="flex flex-wrap gap-1">
                {CSV_COLUMNS.slice(0, 12).map((col) => (
                  <span key={col} className="px-1.5 py-0.5 rounded bg-white border border-[hsl(214,20%,88%)] text-[10px] text-[hsl(215,15%,52%)]">
                    {col}
                  </span>
                ))}
                <span className="px-1.5 py-0.5 rounded bg-white border border-[hsl(214,20%,88%)] text-[10px] text-[hsl(215,15%,52%)]">
                  +{CSV_COLUMNS.length - 12} more
                </span>
              </div>
              {exportFormat === 'excel' && (
                <p className="text-[11px] text-[hsl(215,15%,52%)]">
                  Excel export includes styled header row, alternating row colours, and frozen header pane.
                </p>
              )}
            </div>

            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full py-2.5 rounded-lg bg-[#8B1A2B] text-white text-sm font-semibold hover:bg-[#8B1A2B]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {exporting ? (
                <>
                  <Icon name="LoaderIcon" size={15} className="animate-spin" />
                  Exporting…
                </>
              ) : (
                <>
                  <Icon name="DownloadIcon" size={15} />
                  Export {exportFormat === 'excel' ? 'Excel' : 'CSV'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── How-to Guide ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5">
        <h3 className="text-sm font-semibold text-[hsl(215,25%,18%)] mb-3 flex items-center gap-2">
          <Icon name="InfoIcon" size={15} className="text-[hsl(215,15%,52%)]" />
          Import guide
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              step: '1',
              title: 'Download template',
              desc: 'Click "CSV Template" to get a blank file with all required column headers.',
            },
            {
              step: '2',
              title: 'Fill in your data',
              desc: 'PID (numeric property identifier) is required and must be unique. All other fields are optional.',
            },
            {
              step: '3',
              title: 'Upload & import',
              desc: 'Drop the file in the import panel, review the preview, then click Import.',
            },
          ].map((item) => (
            <div key={item.step} className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-[#1B4F8A]/10 text-[#1B4F8A] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {item.step}
              </div>
              <div>
                <p className="text-xs font-semibold text-[hsl(215,25%,18%)]">{item.title}</p>
                <p className="text-[11px] text-[hsl(215,15%,52%)] mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CSV Validator + Bulk Photo Import ─────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <CSVImportValidator />
        <BulkPhotoImport />
      </div>

      {/* ── ZIP Folder Photo Import ───────────────────────────────────────────── */}
      <ZipFolderPhotoImport />

      {/* ── Deduplicate Photos ────────────────────────────────────────────────── */}
      <DeduplicatePhotos />
    </div>
  );
}
