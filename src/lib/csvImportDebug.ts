/**
 * CSV Import Debug Logger
 *
 * Provides structured, end-to-end debug logging for the CSV parser and
 * batch ingestion pipeline. All output is prefixed with [CSV-DEBUG] so it
 * can be filtered in the browser console.
 *
 * Usage:
 *   import { csvDebug } from '@/lib/csvImportDebug';
 *   csvDebug.enable();   // turn on verbose logging
 *   csvDebug.disable();  // silence (default in production)
 */

// ─── Known DB columns (properties table) ─────────────────────────────────────

export const DB_COLUMNS = new Set([
  'property_ref', 'short_code', 'village', 'phase', 'area', 'building_name', 'tower', 'build_year',
  'list_type', 'floor_type', 'prop_types', 'prop_type',
  'saleable_area', 'gross_area', 'outside_sc',
  'bedrooms', 'bathrooms', 'publish_dt',
  'asking_price', 'asking_rent',
  'direction_view_id', 'direction_id', 'view_id',
  'furn_id', 'decor_id',
  'balcony', 'combined', 'duplex', 'garden', 'openkitch', 'pool', 'roof', 'terrace',
  'p_english', 'p_chinese', 'p_eng_res',
  'status', 'contact_status_code',
  'floor', 'unit',
]);

// ─── Known CSV → DB field mappings ───────────────────────────────────────────

export const CSV_TO_DB_MAP: Record<string, string> = {
  // Core identifier
  pid: 'property_ref',
  property_ref: 'property_ref',

  // Short code — CSV uses hyphen: "short-code"
  'short-code': 'short_code',
  'short_code': 'short_code',
  'short code': 'short_code',
  'short  code': 'short_code',

  // Location fields
  village: 'village',
  'Phase': 'phase',
  phase: 'phase',
  area: 'area',
  'Area': 'area',

  // Building name — CSV uses hyphen: "building-name"
  'building-name': 'building_name',
  'building_name': 'building_name',
  'building name': 'building_name',
  tower: 'tower',
  'Tower': 'tower',

  // Property details
  build_year: 'build_year',
  'Build_year': 'build_year',
  'build year': 'build_year',
  list_type: 'list_type',
  'List_type': 'list_type',
  'list type': 'list_type',
  floor_type: 'floor_type',
  'Floor_type': 'floor_type',
  'floor type': 'floor_type',
  prop_type: 'prop_type',
  'Property_type': 'prop_type',
  'prop type': 'prop_type',
  prop_types: 'prop_types',

  // Size fields — CSV uses: s_size, g_size, o_size OR Saleable_size, Gross_size, Outside_size
  // Also supports: "gross sqft", "net sqft", "outside sqft" column names
  'saleable_size': 'saleable_area',
  'Saleable_size': 'saleable_area',
  's_size': 'saleable_area',
  'saleable sqft_size': 'saleable_area',
  saleable_sqft_size: 'saleable_area',
  saleable_s: 'saleable_area',
  saleable_area: 'saleable_area',
  'net sqft': 'saleable_area',
  'net_sqft': 'saleable_area',
  'nett sqft': 'saleable_area',
  'nett_sqft': 'saleable_area',
  'saleable sqft': 'saleable_area',
  'saleable_sqft': 'saleable_area',
  'gross_size': 'gross_area',
  'Gross_size': 'gross_area',
  'g_size': 'gross_area',
  'gross sqft_size': 'gross_area',
  gross_sqft_size: 'gross_area',
  gross_sqft: 'gross_area',
  gross_area: 'gross_area',
  'gross sqft': 'gross_area',
  'gross_sf': 'gross_area',
  'outside_size': 'outside_sc',
  'Outside_size': 'outside_sc',
  'o_size': 'outside_sc',
  'outside sqft_size': 'outside_sc',
  outside_sqft_size: 'outside_sc',
  outside_sc: 'outside_sc',
  'outside sqft': 'outside_sc',
  'outdoor sqft': 'outside_sc',
  'outside_sqft': 'outside_sc',
  'outdoor_sqft': 'outside_sc',
  'outside sf': 'outside_sc',
  'outdoor sf': 'outside_sc',

  // Rooms — CSV uses: room, bath_rm OR Bedroom, Bathroom
  room: 'bedrooms',
  bedroom: 'bedrooms',
  'Bedroom': 'bedrooms',
  bedrooms: 'bedrooms',
  bath_rm: 'bathrooms',
  bathroom: 'bathrooms',
  'Bathroom': 'bathrooms',
  bathrooms: 'bathrooms',

  // Dates
  publish_dt: 'publish_dt',
  'publish dt': 'publish_dt',

  // Prices — CSV uses: s_price, r_price
  's_price': 'asking_price',
  sale_price: 'asking_price',
  asking_price: 'asking_price',
  'r_price': 'asking_rent',
  rent_price: 'asking_rent',
  asking_rent: 'asking_rent',

  // Direction/view
  direction_view_id: 'direction_view_id',
  'direction _id': 'direction_id',
  'direction id': 'direction_id',
  direction_id: 'direction_id',
  direction: 'direction_id',
  'Direction': 'direction_id',
  view_id: 'view_id',
  'View_id': 'view_id',
  'view id': 'view_id',

  // Furnishing/decor
  furn_id: 'furn_id',
  'furn id': 'furn_id',
  decor_id: 'decor_id',
  'Decor_id': 'decor_id',
  'decor id': 'decor_id',

  // Boolean features
  balcony: 'balcony',
  combined: 'combined',
  duplex: 'duplex',
  garden: 'garden',
  openkitchen: 'openkitch',
  openkitch: 'openkitch',
  'open kitchen': 'openkitch',
  pool: 'pool',
  roof: 'roof',
  terrace: 'terrace',

  // Remarks — CSV uses: p_eng_res
  'p_eng_res': 'p_eng_res',
  p_english_remark: 'p_english',
  p_english: 'p_english',
  'p english remark': 'p_english',
  p_eng_remark: 'p_english',
  p_chinese: 'p_chinese',
  p_chi_remark: 'p_chinese',
  'p chinese remark': 'p_chinese',

  // Status
  status: 'status',

  // Floor and unit
  floor: 'floor',
  floor_no: 'floor',
  floor_num: 'floor',
  'floor number': 'floor',
  unit: 'unit',
  flat: 'unit',
  flat_no: 'unit',
  flat_number: 'unit',
  'flat number': 'unit',
};

// ─── Logger state ─────────────────────────────────────────────────────────────

let _enabled = process.env.NODE_ENV !== 'production';

const TAG = '[CSV-DEBUG]';

function log(level: 'info' | 'warn' | 'error', ...args: unknown[]) {
  if (!_enabled) return;
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(TAG, ...args);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const csvDebug = {
  enable() { _enabled = true; },
  disable() { _enabled = false; },
  isEnabled() { return _enabled; },

  // ── Parse phase ────────────────────────────────────────────────────────────

  /** Log raw CSV headers and detect unmapped / unknown columns */
  logHeaders(headers: string[]) {
    if (!_enabled) return;
    log('info', `── CSV Headers (${headers.length} columns) ──`);

    const mapped: string[] = [];
    const unmapped: string[] = [];

    headers.forEach((h) => {
      const dbCol = CSV_TO_DB_MAP[h] ?? CSV_TO_DB_MAP[h.toLowerCase()];
      if (dbCol) {
        mapped.push(`  ✓ "${h}" → ${dbCol}`);
      } else {
        unmapped.push(`  ✗ "${h}" (no DB mapping)`);
      }
    });

    if (mapped.length) log('info', 'Mapped columns:\n' + mapped.join('\n'));
    if (unmapped.length) log('warn', `Unmapped columns (${unmapped.length}) — will be ignored:\n` + unmapped.join('\n'));
  },

  /** Log a summary of the full parse result */
  logParseResult(totalRaw: number, validRows: number, skippedRows: number, parseErrors: number) {
    if (!_enabled) return;
    log('info', `── Parse Complete ──`);
    log('info', `  Total raw rows : ${totalRaw}`);
    log('info', `  Valid rows     : ${validRows}`);
    log('info', `  Skipped (no ref): ${skippedRows}`);
    log('info', `  PapaParse errors: ${parseErrors}`);
  },

  /** Log a single sanitized row for spot-checking field mapping */
  logSanitizedRow(rowIndex: number, raw: Record<string, string>, db: Record<string, unknown> | null) {
    if (!_enabled) return;
    if (db === null) {
      log('warn', `Row ${rowIndex + 2}: sanitizeRow returned null — missing "pid"/"property_ref". Raw:`, raw);
      return;
    }
    log('info', `Row ${rowIndex + 2} mapped:`, db);

    // Detect fields in raw that were silently dropped
    const droppedFields: string[] = [];
    Object.keys(raw).forEach((csvCol) => {
      const val = (raw[csvCol] || '').trim();
      if (!val || val.toUpperCase() === 'NULL') return; // blank — expected drop
      const dbCol = CSV_TO_DB_MAP[csvCol] ?? CSV_TO_DB_MAP[csvCol.toLowerCase()];
      if (!dbCol) droppedFields.push(`"${csvCol}" = "${val}"`);
    });
    if (droppedFields.length) {
      log('warn', `Row ${rowIndex + 2}: ${droppedFields.length} non-empty CSV field(s) have no DB mapping and were dropped:`, droppedFields);
    }
  },

  /** Detect schema mismatches: DB row keys that are NOT in DB_COLUMNS */
  logSchemaMismatch(rowIndex: number, dbRow: Record<string, unknown>) {
    if (!_enabled) return;
    const unknownKeys = Object.keys(dbRow).filter((k) => !DB_COLUMNS.has(k));
    if (unknownKeys.length) {
      log('error', `Row ${rowIndex + 2}: DB row contains keys NOT in schema — will cause PostgREST 400:`, unknownKeys);
    }
  },

  // ── Batch phase ────────────────────────────────────────────────────────────

  /** Log the start of a batch upsert */
  logBatchStart(batchIndex: number, start: number, end: number) {
    if (!_enabled) return;
    log('info', `── Batch ${batchIndex + 1}: rows ${start + 1}–${end} ──`);
  },

  /** Log the result of a batch upsert */
  logBatchResult(batchIndex: number, error: { message: string; details?: string; hint?: string; code?: string } | null, count: number) {
    if (!_enabled) return;
    if (error) {
      log('error', `Batch ${batchIndex + 1} FAILED:`, {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
    } else {
      log('info', `Batch ${batchIndex + 1} OK — ${count} rows upserted`);
    }
  },

  /** Log field-mapping coverage: which CSV headers map to DB columns */
  logFieldMappingCoverage(headers: string[]) {
    if (!_enabled) return;
    const coverage = headers.map((h) => {
      const dbCol = CSV_TO_DB_MAP[h] ?? CSV_TO_DB_MAP[h.toLowerCase()];
      return { csv: h, db: dbCol ?? '(unmapped)' };
    });
    log('info', 'Field mapping coverage:', coverage);
  },
};
