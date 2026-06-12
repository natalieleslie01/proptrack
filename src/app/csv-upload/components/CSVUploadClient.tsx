'use client';

import React, { useState, useRef, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import Papa from 'papaparse';
import { csvDebug, DB_COLUMNS } from '@/lib/csvImportDebug';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { trackEvent } from '@/lib/eventTracker';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface DbPropertyRow {
  property_ref: string;
  village: string;
  short_code?: string;
  phase?: string;
  area?: string;
  building_name?: string;
  tower?: string;
  build_year?: number;
  list_type?: string;
  floor_type?: string;
  floor?: string;
  unit?: string;
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
  p_eng_res?: string;
  status?: string;
  contact_status_code?: number;
}

interface BatchStatus {
  batchNum: number;
  start: number;
  end: number;
  status: 'pending' | 'processing' | 'success' | 'error';
  count: number;
  error?: string;
}

interface ImportSummary {
  totalRows: number;
  success: number;
  skipped: number;
  errors: string[];
  duration: number;
  deleted?: number;
}

// NEW: Pre-import summary types
interface BuildingCodeSummary {
  prefix: string;
  buildingName: string | null; // null = not found in building_codes table
  count: number;
}

interface ParsedFloorSummary {
  property_ref: string;
  short_code: string;
  floor: string | undefined;
  unit: string | undefined;
  source: 'csv_column' | 'short_code_parsed' | 'none';
}

// NEW: Duplicate detection types
interface DuplicateEntry {
  value: string;
  csvRows: string[];       // property_refs of CSV rows that share this value
  existsInDb: boolean;     // true if this value already exists in the DB
}

interface DuplicateSummary {
  shortCodes: DuplicateEntry[];
  buildingNames: DuplicateEntry[];
  propertyRefs: DuplicateEntry[];
}

interface PreImportSummary {
  totalRows: number;
  buildingCodes: BuildingCodeSummary[];
  unmappedPrefixes: string[];
  floorParsed: number;       // rows where floor was auto-extracted from short_code
  floorFromCSV: number;      // rows where floor came from explicit CSV column
  floorMissing: number;      // rows with no floor at all
  unitParsed: number;
  unitFromCSV: number;
  unitMissing: number;
  statusCounts: Record<string, number>;
  sampleParsed: ParsedFloorSummary[]; // first 10 rows for display
  duplicates: DuplicateSummary;
}

// ─── Pricing CSV row type ─────────────────────────────────────────────────────

interface PricingUpdateRow {
  short_code: string;
  publish_dt?: string;
  asking_price?: number | null;   // null = explicitly blank (was 0/NULL)
  asking_rent?: number | null;    // null = explicitly blank (was 0/NULL)
  p_english?: string;
  status?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function mapIRemStatus(
  raw: string | undefined,
  listType?: string
): { status: string | undefined; contact_status_code: number | undefined } {
  if (!raw || raw.trim() === '') return { status: undefined, contact_status_code: undefined };
  const code = parseInt(raw.trim(), 10);
  if (isNaN(code)) {
    const valid = ['for-sale', 'for-rent', 'for-sale-and-rent', 'self-occupy', 'leased'];
    return { status: valid.includes(raw.trim()) ? raw.trim() : undefined, contact_status_code: undefined };
  }
  const contact_status_code = code;
  // Map numeric codes to DB status enum values
  // 0 = Active (use list_type to determine for-sale/for-rent)
  // 1 = Leased
  // 2 = Self Occupy
  // 3 = No Contact (use list_type to determine for-sale/for-rent)
  // 4 = Sold
  // 9 = Unknown
  // 99 = ---
  if (code === 0 || code === 3) {
    const lt = (listType || '').trim().toLowerCase();
    if (lt === 'sale') return { status: 'for-sale', contact_status_code };
    if (lt === 'rent') return { status: 'for-rent', contact_status_code };
    if (lt === 'rent & sale' || lt === 'sale & rent') return { status: 'for-sale-and-rent', contact_status_code };
    return { status: 'for-rent', contact_status_code };
  }
  switch (code) {
    case 1: return { status: 'leased', contact_status_code };
    case 2: return { status: 'self-occupy', contact_status_code };
    case 4: return { status: 'for-sale', contact_status_code };
    case 9: return { status: 'for-rent', contact_status_code };   // Unknown → keep as for-rent, code preserved
    case 99: return { status: 'for-rent', contact_status_code };  // --- → keep as for-rent, code preserved
    default: return { status: undefined, contact_status_code };
  }
}

function deriveFloorType(propType: string | undefined, floorRaw: string | undefined): string | undefined {
  if (!propType || !floorRaw) return undefined;
  const pt = propType.trim().toLowerCase();
  const fl = floorRaw.trim().toUpperCase();
  const isHighRise = pt.includes('high') || pt === 'hr';
  const isLowRise = pt.includes('low') || pt === 'lr';
  if (!isHighRise && !isLowRise) return undefined;
  if (isHighRise) {
    const match = fl.match(/^(\d+)/);
    if (!match) return undefined;
    const n = parseInt(match[1], 10);
    if (n <= 6) return 'low floor';
    if (n <= 12) return 'middle floor';
    return 'high floor';
  }
  if (fl === 'LG' || fl === 'G' || fl === 'GF' || fl === 'G/F' || fl === 'LG/F') return 'low floor';
  const match = fl.match(/^(\d+)/);
  if (!match) return undefined;
  const n = parseInt(match[1], 10);
  if (n <= 3) return 'middle floor';
  if (n <= 5) return 'high floor';
  return undefined;
}

function extractFloorFromRef(ref: string): string | undefined {
  const match = ref.match(/-(\d+)/);
  return match ? match[1] : undefined;
}

/**
 * Parse floor/block number and flat/unit from a short code.
 *
 * Patterns supported:
 *   WGC0011C   → Woodgreen floor 11 flat C          { floor: "11",            unit: "C"  }
 *   SBL0001A   → Seabird Lane block 1 flat A         { floor: "Lower Ground Floor", unit: "A" }
 *   SBL0001G   → Seabird Lane block 1 flat G         { floor: "2nd Floor",     unit: "G" }
 *   SHL0002C   → block 2 flat C                      { floor: "Upper Ground Floor", unit: "C" }
 *   SEL0003F   → block 3 flat F                      { floor: "1st Floor",     unit: "F" }
 *   SEL00053   → Seabee Lane house 53                { floor: "53",            unit: ""   }
 *   SN100017   → Siena One house 17                  { floor: "17",            unit: ""   }
 *   SN1580GB   → Siena One block 58 ground flat B    { floor: "58",            unit: "GB" }
 *   PAV0303A   → Pavilion block 3 floor 3 flat A     { floor: "Floor 3",       unit: "Block 3 Flat A" }
 *   CSL0603B   → CSL block 6 floor 3 flat B          { floor: "Floor 3",       unit: "Block 6 Flat B" }
 *   CSL0600A   → CSL block 6 ground floor flat A     { floor: "Ground Floor",  unit: "Block 6 Flat A" }
 *
 * Returns null if the pattern does not match.
 */
function parseShortCode(shortCode: string): { floor: string; unit: string } | null {
  if (!shortCode) return null;
  const sc = shortCode.trim().toUpperCase();

  // For SBL, SHL, SEL: digits = block number, flat letter determines floor
  const sblMatch = sc.match(/^(SBL|SHL|SEL)(\d{2,6})([A-H])$/);
  if (sblMatch) {
    const blockNumber = String(parseInt(sblMatch[2], 10));
    const flatLetter = sblMatch[3];
    const flatFloorMap: Record<string, string> = {
      A: 'Lower Ground Floor',
      B: 'Lower Ground Floor',
      C: 'Upper Ground Floor',
      D: 'Upper Ground Floor',
      E: '1st Floor',
      F: '1st Floor',
      G: '2nd Floor',
      H: '2nd Floor',
    };
    const floor = flatFloorMap[flatLetter];
    // unit = block number + flat letter (e.g. "1A")
    const unit = `${blockNumber}${flatLetter}`;
    return { floor, unit };
  }

  // For PAV: PAV + 2-digit block (zero-padded) + 2-digit floor (zero-padded) + 1 letter flat
  // E.g. PAV0303A = Block 3, Floor 3, Flat A
  const pavMatch = sc.match(/^PAV(\d{2})(\d{2})([A-Z])$/);
  if (pavMatch) {
    const blockNumber = String(parseInt(pavMatch[1], 10));
    const floorNumber = String(parseInt(pavMatch[2], 10));
    const flatLetter = pavMatch[3];
    const floor = `Floor ${floorNumber}`;
    const unit = `Block ${blockNumber} Flat ${flatLetter}`;
    return { floor, unit };
  }

  // For CSL: CSL + 2-digit block (zero-padded) + 2-digit floor (zero-padded) + 1 letter flat
  // E.g. CSL0603B = Block 6, Floor 3, Flat B
  // E.g. CSL0600A = Block 6, Ground Floor, Flat A (floor digits = 00)
  const cslMatch = sc.match(/^CSL(\d{2})(\d{2})([A-Z])$/);
  if (cslMatch) {
    const blockNumber = String(parseInt(cslMatch[1], 10));
    const floorDigits = parseInt(cslMatch[2], 10);
    const flatLetter = cslMatch[3];
    const floor = floorDigits === 0 ? 'Ground Floor' : `Floor ${floorDigits}`;
    const unit = `Block ${blockNumber} Flat ${flatLetter}`;
    return { floor, unit };
  }

  // Pattern 1: PREFIX + DIGITS + LETTERS  (e.g. WGC0011C, SN1580GB)
  const withUnit = sc.match(/^[A-Z]{2,5}(\d{2,6})([A-Z]{1,3})$/);
  if (withUnit) {
    const floor = String(parseInt(withUnit[1], 10));
    const unit = withUnit[2];
    return { floor, unit };
  }

  // Pattern 2: PREFIX + DIGITS only  (e.g. SEL00053, SN100017 — house/villa number)
  const houseOnly = sc.match(/^[A-Z]{2,5}(\d{2,6})$/);
  if (houseOnly) {
    const floor = String(parseInt(houseOnly[1], 10));
    return { floor, unit: '' };
  }

  return null;
}

function normaliseDateStr(val: string | undefined): string | undefined {
  if (!val || val.trim() === '' || val.trim().toUpperCase() === 'NULL') return undefined;
  const v = val.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const dmy = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return undefined;
}

function sanitizeRow(raw: Record<string, string>): DbPropertyRow | null {
  const scRaw = (raw['short-code'] || raw['short_code'] || raw['short code'] || raw['short  code'] || '').trim();
  const ref = (raw['pid'] || raw['property_ref'] || raw['Property Ref'] || scRaw || '').trim();
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

  // Determine which column keys are actually present in this CSV row
  const presentKeys = new Set(Object.keys(raw));
  const hasCol = (...names: string[]): boolean => names.some((n) => presentKeys.has(n));

  // list_type: NULL/unknown → store as 'unknown' (displayed as '----' in UI)
  const listTypeRaw = cleanStr(raw['list_type'] || raw['List_type'] || raw['list type']);
  const listType = listTypeRaw;
  const { status, contact_status_code } = mapIRemStatus(raw['status'] || raw['Status'], listType);
  // Direction: support both direction_id and Direction column names
  const directionId = cleanStr(raw['direction'] || raw['Direction'] || raw['direction_id'] || raw['direction _id'] || raw['direction id'] || raw['direction_view_id']);
  const viewId = cleanStr(raw['view_id'] || raw['View_id'] || raw['view id']);
  const directionViewId = directionId ? (viewId ? `${directionId}/${viewId}` : directionId) : viewId;
  // Property_type: support both prop_type and Property_type column names
  const propType = cleanStr(raw['property_type'] || raw['Property_type'] || raw['prop_type'] || raw['prop_types'] || raw['prop type']);

  const PROP_TYPE_MAP: Record<string, string> = {
    'DBC': 'Golf Cart',
  };
  const mappedPropType = propType !== undefined ? (PROP_TYPE_MAP[propType.toUpperCase()] ?? propType) : undefined;

  // Start with only the required identifier fields
  const row: DbPropertyRow = {
    property_ref: ref,
    village: cleanStr(raw['village'] || raw['Village']) || 'Discovery Bay',
    status: status || undefined,
    // Boolean feature flags — only include if the column is actually present in the CSV
    balcony: hasCol('balcony', 'Balcony') ? parseBool(raw['balcony'] || raw['Balcony']) : (undefined as unknown as boolean),
    combined: hasCol('combined', 'Combined') ? parseBool(raw['combined'] || raw['Combined']) : (undefined as unknown as boolean),
    duplex: hasCol('duplex', 'Duplex') ? parseBool(raw['duplex'] || raw['Duplex']) : (undefined as unknown as boolean),
    garden: hasCol('garden', 'Garden') ? parseBool(raw['garden'] || raw['Garden']) : (undefined as unknown as boolean),
    openkitch: hasCol('openkitchen', 'openkitch', 'open kitchen', 'Openkitchen') ? parseBool(raw['openkitchen'] || raw['openkitch'] || raw['open kitchen'] || raw['Openkitchen']) : (undefined as unknown as boolean),
    pool: hasCol('pool', 'Pool') ? parseBool(raw['pool'] || raw['Pool']) : (undefined as unknown as boolean),
    roof: hasCol('roof', 'Roof') ? parseBool(raw['roof'] || raw['Roof']) : (undefined as unknown as boolean),
    terrace: hasCol('terrace', 'Terrace') ? parseBool(raw['terrace'] || raw['Terrace']) : (undefined as unknown as boolean),
  };

  // Remove boolean fields that are undefined (column not present in CSV)
  // so the upsert doesn't overwrite existing DB values with false
  (['balcony', 'combined', 'duplex', 'garden', 'openkitch', 'pool', 'roof', 'terrace'] as const).forEach((key) => {
    if ((row as Record<string, unknown>)[key] === undefined) {
      delete (row as Record<string, unknown>)[key];
    }
  });

  // Remove village if not in CSV (don't overwrite existing DB value)
  if (!hasCol('village', 'Village')) {
    delete (row as Record<string, unknown>)['village'];
  }

  // Remove status if not in CSV (don't overwrite existing DB value)
  if (!hasCol('status', 'Status') && !status) {
    delete (row as Record<string, unknown>)['status'];
  }

  // short-code (CSV uses hyphen)
  const sc = cleanStr(raw['short-code'] || raw['short_code'] || raw['short code'] || raw['short  code']);
  if (sc !== undefined) row.short_code = sc;

  // Phase
  const phase = cleanStr(raw['Phase'] || raw['phase']);
  if (phase !== undefined) row.phase = phase;

  const area = cleanStr(raw['area'] || raw['Area']);
  if (area !== undefined) row.area = area;

  // building-name (CSV uses hyphen)
  const buildingName = cleanStr(
    raw['building-name'] ||
    raw['building_name'] ||
    raw['building name'] ||
    raw['Building Name'] ||
    raw['Building-Name'] ||
    raw['Building_Name'] ||
    raw['BUILDING NAME'] ||
    raw['BUILDING_NAME'] ||
    raw['BUILDING-NAME']
  );
  if (buildingName !== undefined) row.building_name = buildingName;

  const tower = cleanStr(raw['tower'] || raw['Tower']);
  if (tower !== undefined) row.tower = tower;

  const buildYear = parseIntSafe(raw['build_year'] || raw['Build_year'] || raw['build year']);
  if (buildYear !== undefined) row.build_year = buildYear;

  // list_type: if the column is present in CSV, always write it
  // NULL/unknown/empty → 'unknown' (UI shows as '----')
  if (hasCol('list_type', 'List_type', 'list type')) {
    row.list_type = listType ?? 'unknown';
  }

  const floorType = cleanStr(raw['floor_type'] || raw['Floor_type'] || raw['floor type']);
  const floorNumRaw = cleanStr(raw['floor_no'] || raw['floor_num'] || raw['floor number'] || raw['floor']);
  const floorForDerive = floorNumRaw ?? extractFloorFromRef(ref);
  if (floorType !== undefined) {
    row.floor_type = floorType;
  } else {
    const derived = deriveFloorType(propType, floorForDerive);
    if (derived !== undefined) row.floor_type = derived;
  }

  // floor — actual floor number stored directly (e.g. "5", "G", "LG")
  if (floorNumRaw !== undefined) row.floor = floorNumRaw;

  // unit — flat/unit identifier (e.g. "01A", "B")
  const unitRaw = cleanStr(raw['unit'] || raw['flat'] || raw['flat_no'] || raw['flat_number'] || raw['flat number']);
  if (unitRaw !== undefined) row.unit = unitRaw;

  // Auto-extract floor and unit from short_code when not explicitly provided
  if ((row.floor === undefined || row.unit === undefined) && sc !== undefined) {
    const parsed = parseShortCode(sc);
    if (parsed) {
      if (row.floor === undefined) row.floor = parsed.floor;
      if (row.unit === undefined) row.unit = parsed.unit;
    }
  }

  if (propType !== undefined) { row.prop_types = mappedPropType; row.prop_type = mappedPropType; }

  // Size fields — CSV uses s_size, g_size, o_size OR Saleable_size, Gross_size, Outside_size
  const saleableArea = parseFloatSafe(raw['saleable_size'] || raw['Saleable_size'] || raw['s_size'] || raw['saleable sqft_size'] || raw['saleable_sqft_size'] || raw['saleable_s'] || raw['saleable_area'] || raw['net sqft'] || raw['net_sqft'] || raw['nett sqft'] || raw['nett_sqft'] || raw['saleable sqft'] || raw['saleable_sqft']);
  if (saleableArea !== undefined) row.saleable_area = saleableArea;
  const grossArea = parseFloatSafe(raw['gross_size'] || raw['Gross_size'] || raw['g_size'] || raw['gross sqft_size'] || raw['gross_sqft_size'] || raw['gross_sqft'] || raw['gross_area'] || raw['gross sqft'] || raw['gross_sf']);
  if (grossArea !== undefined) row.gross_area = grossArea;
  const outsideSc = parseFloatSafe(raw['outside_size'] || raw['Outside_size'] || raw['o_size'] || raw['outside sqft_size'] || raw['outside_sqft_size'] || raw['outside_sc'] || raw['outside sqft'] || raw['outdoor sqft'] || raw['outside_sqft'] || raw['outdoor_sqft'] || raw['outside sf'] || raw['outdoor sf']);
  if (outsideSc !== undefined) row.outside_sc = outsideSc;

  // Rooms — CSV uses room, bath_rm OR Bedroom, Bathroom
  const bedrooms = parseIntSafe(raw['bedroom'] || raw['Bedroom'] || raw['room'] || raw['bedrooms']);
  if (bedrooms !== undefined) row.bedrooms = bedrooms;
  const bathrooms = parseIntSafe(raw['bathroom'] || raw['Bathroom'] || raw['bath_rm'] || raw['bathrooms']);
  if (bathrooms !== undefined) row.bathrooms = bathrooms;

  const publishDt = normaliseDateStr(raw['publish_dt'] || raw['publish dt']);
  if (publishDt !== undefined) row.publish_dt = publishDt;

  // Prices — CSV uses s_price, r_price
  let askingPrice = parseFloatSafe(raw['s_price'] || raw['sale_price'] || raw['asking_price']);
  if (askingPrice !== undefined) row.asking_price = askingPrice;
  let askingRent = parseFloatSafe(raw['r_price'] || raw['rent_price'] || raw['asking_rent']);
  if (askingRent !== undefined) row.asking_rent = askingRent;

  if (directionViewId !== undefined) row.direction_view_id = directionViewId;
  if (directionId !== undefined) row.direction_id = directionId;
  if (viewId !== undefined) row.view_id = viewId;

  // furn_id: only set if column is present in CSV
  if (hasCol('furn_id', 'furn id')) {
    const furnId = cleanStr(raw['furn_id'] || raw['furn id']);
    row.furn_id = furnId !== undefined && furnId !== null && furnId !== '' ? furnId : 'unfurnished';
  }

  // decor_id: NULL/unknown → '---'
  if (hasCol('decor_id', 'Decor_id', 'decor id')) {
    const decorRaw = (raw['decor_id'] || raw['Decor_id'] || raw['decor id'] || '').trim();
    if (decorRaw === '' || decorRaw.toUpperCase() === 'NULL' || decorRaw.toLowerCase() === 'unknown') {
      row.decor_id = '---';
    } else {
      row.decor_id = decorRaw;
    }
  }

  // p_eng_res (CSV column name) → p_eng_res DB column
  const pEngRes = cleanStr(raw['p_eng_res']);
  if (pEngRes !== undefined) row.p_eng_res = pEngRes;

  // Legacy remark fields
  const pEnglish = cleanStr(raw['p_english_remark'] || raw['p_english'] || raw['p english remark'] || raw['p_eng_remark']);
  if (pEnglish !== undefined) row.p_english = pEnglish;
  const pChinese = cleanStr(raw['p_chinese'] || raw['p_chi_remark'] || raw['p chinese remark']);
  if (pChinese !== undefined) row.p_chinese = pChinese;
  if (contact_status_code !== undefined) row.contact_status_code = contact_status_code;

  const unknownKeys = Object.keys(row).filter((k) => !DB_COLUMNS.has(k));
  if (unknownKeys.length > 0) {
    unknownKeys.forEach((k) => { delete (row as Record<string, unknown>)[k]; });
  }

  return row;
}

// ─── Component ─────────────────────────────────────────────────────────────────

type UploadStep = 'idle' | 'preview' | 'summary' | 'importing' | 'done';
type ImportMode = 'upsert' | 'skip' | 'replace' | 'pricing-update' | 'update-by-shortcode';

const BATCH_SIZE = 50;

export default function CSVUploadClient() {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const [step, setStep] = useState<UploadStep>('idle');
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<DbPropertyRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<ImportMode>('upsert');
  const [batches, setBatches] = useState<BatchStatus[]>([]);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [abortRef] = useState({ aborted: false });
  const [preImportSummary, setPreImportSummary] = useState<PreImportSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [parsedRowsPage, setParsedRowsPage] = useState(0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [pricingRows, setPricingRows] = useState<PricingUpdateRow[]>([]);
  const [isPricingCsv, setIsPricingCsv] = useState(false);

  // ── File handling ──────────────────────────────────────────────────────────

  const processFile = useCallback((f: File) => {
    if (!f.name.endsWith('.csv')) {
      alert('Please select a .csv file');
      return;
    }
    setFile(f);
    setParseErrors([]);
    setParsedRows([]);
    setPricingRows([]);
    setIsPricingCsv(false);
    setSummary(null);
    setBatches([]);
    setCurrentBatch(0);
    setStep('preview');

    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim().toLowerCase(),
      complete: (results) => {
        const headers = results.meta.fields ?? [];
        csvDebug.logHeaders(headers);
        csvDebug.logFieldMappingCoverage(headers);

        const rows: DbPropertyRow[] = [];
        const errors: string[] = [];

        // Detect if this looks like a short-code CSV (has Short Code column but no pid/property_ref)
        const hasShortCodeCol = headers.some(h =>
          ['short code', 'shortcode', 'short_code', 'short-code'].includes(h.trim().toLowerCase())
        );
        const hasPidCol = headers.some(h =>
          ['pid', 'property_ref', 'property ref'].includes(h.trim().toLowerCase())
        );

        // Detect contacts CSV (has Type/Contact-Person/Contact-Number columns)
        const hasContactCols = headers.some(h =>
          ['type', 'contact-person', 'contact person', 'contact_person'].includes(h.trim().toLowerCase())
        );

        if (hasContactCols) {
          errors.push(
            'This looks like a Contacts CSV (Short Code / PID / Type / Contact-Person / Contact-Number). ' +
            'Please use the Bulk Data Editor → "Contacts CSV" tab to upload this file.'
          );
          setParsedRows([]);
          setParseErrors(errors);
          return;
        }

        // ── Detect pricing/status update CSV ──────────────────────────────
        // A pricing CSV has short_code + at least one of: s_price, r_price, p_eng_remark, publish_dt, status
        // AND does NOT have full property columns like bedrooms, bathrooms, saleable_size etc.
        const hasPricingCols = headers.some(h => ['s_price', 'r_price', 'p_eng_remark'].includes(h.trim().toLowerCase()));
        const hasFullPropertyCols = headers.some(h => ['bedroom', 'bedrooms', 'room', 'saleable_size', 's_size', 'gross_size', 'g_size'].includes(h.trim().toLowerCase()));
        const looksLikePricingCsv = hasShortCodeCol && hasPricingCols && !hasFullPropertyCols && !hasPidCol;

        if (looksLikePricingCsv) {
          // Parse as pricing update rows
          const pRows: PricingUpdateRow[] = [];
          results.data.forEach((raw, idx) => {
            const sc = (
              raw['short-code'] || raw['short_code'] || raw['short code'] || raw['short  code'] || ''
            ).trim();
            if (!sc) {
              errors.push(`Row ${idx + 2}: Missing short_code — skipped`);
              return;
            }

            // s_price: in millions → multiply by 1,000,000; 0 or NULL → null (blank)
            let askingPrice: number | null | undefined = undefined;
            const sPriceRaw = (raw['s_price'] || '').trim();
            if (sPriceRaw !== '' && sPriceRaw.toUpperCase() !== 'NULL') {
              const v = parseFloat(sPriceRaw);
              askingPrice = (!isNaN(v) && v > 0) ? Math.round(v * 1_000_000) : null;
            }

            // r_price: in thousands → multiply by 1,000; 0 or NULL → null (blank)
            let askingRent: number | null | undefined = undefined;
            const rPriceRaw = (raw['r_price'] || '').trim();
            if (rPriceRaw !== '' && rPriceRaw.toUpperCase() !== 'NULL') {
              const v = parseFloat(rPriceRaw);
              askingRent = (!isNaN(v) && v > 0) ? Math.round(v * 1_000) : null;
            }

            // p_eng_remark → p_english (advertising remarks)
            const pEngRemark = (raw['p_eng_remark'] || '').trim() || undefined;

            // publish_dt
            const publishDt = normaliseDateStr(raw['publish_dt'] || raw['publish dt']);

            // status
            const listTypeRaw = (raw['list_type'] || raw['list type'] || '').trim() || undefined;
            const { status } = mapIRemStatus(raw['status'] || raw['Status'], listTypeRaw);

            const pRow: PricingUpdateRow = { short_code: sc };
            if (askingPrice !== undefined) pRow.asking_price = askingPrice;
            if (askingRent !== undefined) pRow.asking_rent = askingRent;
            if (pEngRemark !== undefined) pRow.p_english = pEngRemark;
            if (publishDt !== undefined) pRow.publish_dt = publishDt;
            if (status !== undefined) pRow.status = status;

            pRows.push(pRow);
          });

          results.errors.slice(0, 5).forEach((e) => errors.push(`Parse error row ${e.row}: ${e.message}`));
          setPricingRows(pRows);
          setIsPricingCsv(true);
          setImportMode('pricing-update');
          setParseErrors(errors);
          return;
        }

        results.data.forEach((raw, idx) => {
          const row = sanitizeRow(raw);
          if (!row) {
            errors.push(`Row ${idx + 2}: Missing required field "pid" or "short-code" (property identifier)`);
          } else {
            rows.push(row);
          }
        });
        results.errors.slice(0, 5).forEach((e) => errors.push(`Parse error row ${e.row}: ${e.message}`));
        setParsedRows(rows);
        setParseErrors(errors);

        // ── Auto-select update-by-shortcode mode when CSV has short_code but no pid ──
        // This prevents duplicate creation — only updates existing records matched by short_code
        if (hasShortCodeCol && !hasPidCol) {
          setImportMode('update-by-shortcode');
        }
      },
      error: (err) => {
        setParseErrors([`Failed to parse file: ${err.message}`]);
      },
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  }, [processFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  // ── Build pre-import summary ───────────────────────────────────────────────

  const buildPreImportSummary = useCallback(async (rows: DbPropertyRow[]) => {
    setSummaryLoading(true);

    // 1. Collect unique short_code prefixes (leading letters)
    const prefixMap = new Map<string, number>(); // prefix → count
    rows.forEach((row) => {
      if (row.short_code) {
        const m = row.short_code.trim().match(/^([A-Z]{2,4})/i);
        const prefix = m ? m[1].toUpperCase() : row.short_code.toUpperCase().slice(0, 3);
        prefixMap.set(prefix, (prefixMap.get(prefix) ?? 0) + 1);
      }
    });

    // 2. Fetch building_codes from Supabase for those prefixes
    const prefixes = Array.from(prefixMap.keys());
    let buildingCodeMap = new Map<string, string>(); // prefix → building_name
    if (prefixes.length > 0) {
      // Fetch ALL building codes, then match by prefix
      // The table stores full codes like CHI01, AH1, SN1 etc.
      // We need to find if any stored code starts with our extracted prefix
      const { data } = await supabase
        .from('building_codes')
        .select('short_code_prefix, building_name');
      if (data) {
        // For each CSV prefix (e.g. "CHI"), find the first building_code row
        // whose short_code_prefix starts with that prefix (e.g. "CHI01")
        // OR whose short_code_prefix IS that prefix (exact match, legacy rows)
        prefixes.forEach((prefix) => {
          const match = data.find((bc: { short_code_prefix: string; building_name: string }) => {
            const stored = bc.short_code_prefix.toUpperCase();
            return stored === prefix || stored.startsWith(prefix);
          });
          if (match) {
            // Use the building name from the first matched code for this prefix
            buildingCodeMap.set(prefix, match.building_name);
          }
        });
      }
    }

    // 3. Build building code summary rows
    const buildingCodes: BuildingCodeSummary[] = prefixes.map((prefix) => ({
      prefix,
      buildingName: buildingCodeMap.get(prefix) ?? null,
      count: prefixMap.get(prefix) ?? 0,
    })).sort((a, b) => b.count - a.count);

    const unmappedPrefixes = buildingCodes.filter((b) => b.buildingName === null).map((b) => b.prefix);

    // 4. Analyse floor/unit parsing
    let floorParsed = 0, floorFromCSV = 0, floorMissing = 0;
    let unitParsed = 0, unitFromCSV = 0, unitMissing = 0;

    const sampleParsed: ParsedFloorSummary[] = [];

    rows.forEach((row, idx) => {
      const hasShortCode = !!row.short_code;
      const parsed = hasShortCode ? parseShortCode(row.short_code!) : null;

      let floorSource: 'csv_column' | 'short_code_parsed' | 'none' = 'none';
      if (row.floor !== undefined) {
        if (parsed && parsed.floor === row.floor) {
          floorSource = 'short_code_parsed';
          floorParsed++;
        } else {
          floorSource = 'csv_column';
          floorFromCSV++;
        }
      } else {
        floorMissing++;
      }

      if (row.unit !== undefined) {
        if (parsed && parsed.unit === row.unit) {
          unitParsed++;
        } else {
          unitFromCSV++;
        }
      } else {
        unitMissing++;
      }

      if (idx < 10) {
        sampleParsed.push({
          property_ref: row.property_ref,
          short_code: row.short_code ?? '—',
          floor: row.floor,
          unit: row.unit,
          source: floorSource,
        });
      }
    });

    // 5. Status counts
    const statusCounts: Record<string, number> = {};
    rows.forEach((row) => {
      const s = row.status ?? 'unknown';
      statusCounts[s] = (statusCounts[s] ?? 0) + 1;
    });

    // 6. ── Duplicate detection ──────────────────────────────────────────────

    // 6a. Within-CSV duplicates: group by value → list of property_refs
    const csvShortCodeMap = new Map<string, string[]>();
    const csvBuildingNameMap = new Map<string, string[]>();
    const csvPropertyRefMap = new Map<string, string[]>();

    rows.forEach((row) => {
      const ref = row.property_ref;
      if (row.short_code) {
        const sc = row.short_code.trim().toUpperCase();
        csvShortCodeMap.set(sc, [...(csvShortCodeMap.get(sc) ?? []), ref]);
      }
      if (row.building_name) {
        const bn = row.building_name.trim().toLowerCase();
        csvBuildingNameMap.set(bn, [...(csvBuildingNameMap.get(bn) ?? []), ref]);
      }
      const refKey = ref.trim().toUpperCase();
      csvPropertyRefMap.set(refKey, [...(csvPropertyRefMap.get(refKey) ?? []), ref]);
    });

    // Only keep entries that appear more than once in CSV
    const csvDupShortCodes = Array.from(csvShortCodeMap.entries()).filter(([, refs]) => refs.length > 1);
    const csvDupBuildingNames = Array.from(csvBuildingNameMap.entries()).filter(([, refs]) => refs.length > 1);
    const csvDupPropertyRefs = Array.from(csvPropertyRefMap.entries()).filter(([, refs]) => refs.length > 1);

    // 6b. Collect all unique values to check against DB
    const allShortCodes = rows.map((r) => r.short_code).filter(Boolean) as string[];
    const allBuildingNames = rows.map((r) => r.building_name).filter(Boolean) as string[];
    const allPropertyRefs = rows.map((r) => r.property_ref);

    // 6c. Query DB for existing matches
    const [dbScResult, dbBnResult, dbRefResult] = await Promise.all([
      allShortCodes.length > 0
        ? supabase.from('properties').select('short_code').in('short_code', allShortCodes)
        : Promise.resolve({ data: [] }),
      allBuildingNames.length > 0
        ? supabase.from('properties').select('building_name').in('building_name', allBuildingNames)
        : Promise.resolve({ data: [] }),
      allPropertyRefs.length > 0
        ? supabase.from('properties').select('property_ref').in('property_ref', allPropertyRefs)
        : Promise.resolve({ data: [] }),
    ]);

    const dbShortCodes = new Set<string>(
      ((dbScResult.data ?? []) as { short_code: string }[]).map((r) => r.short_code?.trim().toUpperCase()).filter(Boolean)
    );
    const dbBuildingNames = new Set<string>(
      ((dbBnResult.data ?? []) as { building_name: string }[]).map((r) => r.building_name?.trim().toLowerCase()).filter(Boolean)
    );
    const dbPropertyRefs = new Set<string>(
      ((dbRefResult.data ?? []) as { property_ref: string }[]).map((r) => r.property_ref?.trim().toUpperCase()).filter(Boolean)
    );

    // 6d. Build DuplicateEntry arrays
    // For short codes: include CSV dups + any single-occurrence CSV value that exists in DB
    const shortCodeEntries = new Map<string, DuplicateEntry>();
    csvDupShortCodes.forEach(([val, refs]) => {
      shortCodeEntries.set(val, { value: val, csvRows: refs, existsInDb: dbShortCodes.has(val) });
    });
    // Single-occurrence CSV short codes that exist in DB
    Array.from(csvShortCodeMap.entries()).forEach(([val, refs]) => {
      if (refs.length === 1 && dbShortCodes.has(val) && !shortCodeEntries.has(val)) {
        shortCodeEntries.set(val, { value: val, csvRows: refs, existsInDb: true });
      }
    });

    const buildingNameEntries = new Map<string, DuplicateEntry>();
    csvDupBuildingNames.forEach(([val, refs]) => {
      buildingNameEntries.set(val, { value: val, csvRows: refs, existsInDb: dbBuildingNames.has(val) });
    });
    Array.from(csvBuildingNameMap.entries()).forEach(([val, refs]) => {
      if (refs.length === 1 && dbBuildingNames.has(val) && !buildingNameEntries.has(val)) {
        buildingNameEntries.set(val, { value: val, csvRows: refs, existsInDb: true });
      }
    });

    const propertyRefEntries = new Map<string, DuplicateEntry>();
    csvDupPropertyRefs.forEach(([val, refs]) => {
      propertyRefEntries.set(val, { value: val, csvRows: refs, existsInDb: dbPropertyRefs.has(val) });
    });
    Array.from(csvPropertyRefMap.entries()).forEach(([val, refs]) => {
      if (refs.length === 1 && dbPropertyRefs.has(val) && !propertyRefEntries.has(val)) {
        propertyRefEntries.set(val, { value: val, csvRows: refs, existsInDb: true });
      }
    });

    const duplicates: DuplicateSummary = {
      shortCodes: Array.from(shortCodeEntries.values()),
      buildingNames: Array.from(buildingNameEntries.values()),
      propertyRefs: Array.from(propertyRefEntries.values()),
    };

    setPreImportSummary({
      totalRows: rows.length,
      buildingCodes,
      unmappedPrefixes,
      floorParsed,
      floorFromCSV,
      floorMissing,
      unitParsed,
      unitFromCSV,
      unitMissing,
      statusCounts,
      sampleParsed,
      duplicates,
    });
    setSummaryLoading(false);
    setStep('summary');
  }, [supabase]);

  const handleReviewSummary = useCallback(() => {
    if (parsedRows.length === 0) return;
    setParsedRowsPage(0);
    buildPreImportSummary(parsedRows);
  }, [parsedRows, buildPreImportSummary]);

  const handleReviewRowChanges = useCallback(() => {
    if (parsedRows.length === 0) return;
    sessionStorage.setItem('csv_diff_pending_rows', JSON.stringify(parsedRows));
    router.push('/csv-diff');
  }, [parsedRows, router]);

  // ── Import ─────────────────────────────────────────────────────────────────

  const handleImport = useCallback(async () => {
    if (!file || parsedRows.length === 0) return;
    abortRef.aborted = false;
    setStep('importing');
    setSummary(null);

    const totalRows = parsedRows.length;
    const totalBatches = Math.ceil(totalRows / BATCH_SIZE);
    const initialBatches: BatchStatus[] = Array.from({ length: totalBatches }, (_, i) => ({
      batchNum: i + 1,
      start: i * BATCH_SIZE + 1,
      end: Math.min((i + 1) * BATCH_SIZE, totalRows),
      status: 'pending',
      count: Math.min(BATCH_SIZE, totalRows - i * BATCH_SIZE),
    }));
    setBatches(initialBatches);

    let success = 0;
    let skipped = 0;
    const errors: string[] = [];
    const startTime = Date.now();

    // ── update-by-shortcode mode: UPDATE only, never INSERT ──────────────────
    if (importMode === 'update-by-shortcode') {
      for (let i = 0; i < totalBatches; i++) {
        if (abortRef.aborted) break;
        const batch = parsedRows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        setCurrentBatch(i + 1);
        setBatches((prev) => prev.map((b) => b.batchNum === i + 1 ? { ...b, status: 'processing' } : b));

        const batchErrors: string[] = [];
        let batchSuccess = 0;
        let batchSkipped = 0;

        await Promise.all(batch.map(async (row) => {
          const sc = row.short_code;
          if (!sc) {
            batchSkipped++;
            return;
          }

          // Build update payload — exclude property_ref (the PID from IReM) and short_code itself
          // Only include fields that are actually present/meaningful in this row
          const { property_ref: _ref, short_code: _sc, ...updateFields } = row;

          // Remove undefined values so we don't overwrite DB data with nulls
          const updatePayload: Record<string, unknown> = {};
          Object.entries(updateFields).forEach(([k, v]) => {
            if (v !== undefined) updatePayload[k] = v;
          });

          if (Object.keys(updatePayload).length === 0) {
            batchSkipped++;
            return;
          }

          const { error, count } = await supabase
            .from('properties')
            .update(updatePayload)
            .eq('short_code', sc)
            .select('id', { count: 'exact', head: true });

          if (error) {
            batchErrors.push(`${sc}: ${error.message}`);
            batchSkipped++;
          } else if ((count ?? 0) === 0) {
            batchErrors.push(`${sc}: no matching property found — skipped (not inserted)`);
            batchSkipped++;
          } else {
            batchSuccess++;
          }
        }));

        success += batchSuccess;
        skipped += batchSkipped;
        if (batchErrors.length > 0) {
          errors.push(...batchErrors.slice(0, 5));
          if (batchErrors.length > 5) errors.push(`…and ${batchErrors.length - 5} more in batch ${i + 1}`);
          setBatches((prev) => prev.map((b) => b.batchNum === i + 1 ? { ...b, status: 'error', error: `${batchErrors.length} row(s) skipped` } : b));
        } else {
          setBatches((prev) => prev.map((b) => b.batchNum === i + 1 ? { ...b, status: 'success' } : b));
        }
      }

      const duration = Math.round((Date.now() - startTime) / 1000);
      setSummary({ totalRows, success, skipped, errors, duration });
      setStep('done');
      trackEvent('csv_upload', {
        total_rows: totalRows,
        success_rows: success,
        skipped_rows: skipped,
        error_count: errors.length,
        duration_seconds: duration,
        import_mode: importMode,
        file_name: file?.name ?? null,
      });
      return;
    }

    for (let i = 0; i < totalBatches; i++) {
      if (abortRef.aborted) break;
      const batch = parsedRows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
      setCurrentBatch(i + 1);
      setBatches((prev) => prev.map((b) => b.batchNum === i + 1 ? { ...b, status: 'processing' } : b));

      try {
        if (importMode === 'upsert' || importMode === 'replace') {
          const { error } = await supabase.from('properties').upsert(batch, { onConflict: 'property_ref' });
          if (error) {
            errors.push(`Batch ${i + 1} (rows ${i * BATCH_SIZE + 1}–${Math.min((i + 1) * BATCH_SIZE, totalRows)}): ${error.message}`);
            skipped += batch.length;
            setBatches((prev) => prev.map((b) => b.batchNum === i + 1 ? { ...b, status: 'error', error: error.message } : b));
          } else {
            success += batch.length;
            setBatches((prev) => prev.map((b) => b.batchNum === i + 1 ? { ...b, status: 'success' } : b));
          }
        } else {
          const refs = batch.map((r) => r.property_ref);
          const { data: existing } = await supabase.from('properties').select('property_ref').in('property_ref', refs);
          const existingRefs = new Set((existing || []).map((r: { property_ref: string }) => r.property_ref));
          const newRows = batch.filter((r) => !existingRefs.has(r.property_ref));
          skipped += batch.length - newRows.length;
          if (newRows.length > 0) {
            const { error } = await supabase.from('properties').insert(newRows);
            if (error) {
              errors.push(`Batch ${i + 1}: ${error.message}`);
              skipped += newRows.length;
              setBatches((prev) => prev.map((b) => b.batchNum === i + 1 ? { ...b, status: 'error', error: error.message } : b));
            } else {
              success += newRows.length;
              setBatches((prev) => prev.map((b) => b.batchNum === i + 1 ? { ...b, status: 'success' } : b));
            }
          } else {
            setBatches((prev) => prev.map((b) => b.batchNum === i + 1 ? { ...b, status: 'success' } : b));
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unexpected error';
        errors.push(`Batch ${i + 1}: ${msg}`);
        skipped += batch.length;
        setBatches((prev) => prev.map((b) => b.batchNum === i + 1 ? { ...b, status: 'error', error: msg } : b));
      }
    }

    // ── Replace mode: delete all properties NOT in the CSV ──────────────────
    let deleted = 0;
    if (importMode === 'replace' && !abortRef.aborted) {
      try {
        const csvRefs = parsedRows.map((r) => r.property_ref);
        // Delete in chunks to avoid query size limits
        const CHUNK = 500;
        // First, fetch all property_refs currently in the DB
        const { data: allDbRefs, error: fetchErr } = await supabase
          .from('properties')
          .select('property_ref');
        if (fetchErr) {
          errors.push(`Replace cleanup fetch error: ${fetchErr.message}`);
        } else {
          const csvRefSet = new Set(csvRefs);
          const refsToDelete = (allDbRefs ?? [])
            .map((r: { property_ref: string }) => r.property_ref)
            .filter((ref: string) => !csvRefSet.has(ref));

          for (let i = 0; i < refsToDelete.length; i += CHUNK) {
            const chunk = refsToDelete.slice(i, i + CHUNK);
            const { error: delErr } = await supabase
              .from('properties')
              .delete()
              .in('property_ref', chunk);
            if (delErr) {
              errors.push(`Replace cleanup delete error: ${delErr.message}`);
            } else {
              deleted += chunk.length;
            }
          }
        }
      } catch (err) {
        errors.push(`Replace cleanup error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    setSummary({ totalRows, success, skipped, errors, duration, deleted: importMode === 'replace' ? deleted : undefined });
    setStep('done');
    // Track CSV upload completion
    trackEvent('csv_upload', {
      total_rows: totalRows,
      success_rows: success,
      skipped_rows: skipped,
      error_count: errors.length,
      duration_seconds: duration,
      import_mode: importMode,
      file_name: file?.name ?? null,
    });
  }, [file, parsedRows, importMode, supabase, abortRef]);

  // ── Pricing & Status Update import ────────────────────────────────────────

  const handlePricingUpdate = useCallback(async () => {
    if (!file || pricingRows.length === 0) return;
    abortRef.aborted = false;
    setStep('importing');
    setSummary(null);

    const totalRows = pricingRows.length;
    const totalBatches = Math.ceil(totalRows / BATCH_SIZE);
    const initialBatches: BatchStatus[] = Array.from({ length: totalBatches }, (_, i) => ({
      batchNum: i + 1,
      start: i * BATCH_SIZE + 1,
      end: Math.min((i + 1) * BATCH_SIZE, totalRows),
      status: 'pending',
      count: Math.min(BATCH_SIZE, totalRows - i * BATCH_SIZE),
    }));
    setBatches(initialBatches);

    let success = 0;
    let skipped = 0;
    const errors: string[] = [];
    const startTime = Date.now();

    for (let i = 0; i < totalBatches; i++) {
      if (abortRef.aborted) break;
      const batch = pricingRows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
      setCurrentBatch(i + 1);
      setBatches((prev) => prev.map((b) => b.batchNum === i + 1 ? { ...b, status: 'processing' } : b));

      try {
        // For each row in the batch, update the matching property by short_code
        const batchErrors: string[] = [];
        let batchSuccess = 0;
        let batchSkipped = 0;

        await Promise.all(batch.map(async (pRow) => {
          // Build the update payload — only include fields that are present
          const updatePayload: Record<string, unknown> = {};
          if ('asking_price' in pRow) updatePayload.asking_price = pRow.asking_price; // null clears it
          if ('asking_rent' in pRow) updatePayload.asking_rent = pRow.asking_rent;   // null clears it
          if (pRow.p_english !== undefined) updatePayload.p_english = pRow.p_english;
          if (pRow.publish_dt !== undefined) updatePayload.publish_dt = pRow.publish_dt;
          if (pRow.status !== undefined) updatePayload.status = pRow.status;

          if (Object.keys(updatePayload).length === 0) {
            batchSkipped++;
            return;
          }

          const { error, count } = await supabase
            .from('properties')
            .update(updatePayload)
            .eq('short_code', pRow.short_code)
            .select('id', { count: 'exact', head: true });

          if (error) {
            batchErrors.push(`${pRow.short_code}: ${error.message}`);
            batchSkipped++;
          } else if ((count ?? 0) === 0) {
            batchErrors.push(`${pRow.short_code}: no matching property found`);
            batchSkipped++;
          } else {
            batchSuccess++;
          }
        }));

        success += batchSuccess;
        skipped += batchSkipped;
        if (batchErrors.length > 0) {
          errors.push(...batchErrors.slice(0, 5));
          if (batchErrors.length > 5) errors.push(`…and ${batchErrors.length - 5} more in batch ${i + 1}`);
          setBatches((prev) => prev.map((b) => b.batchNum === i + 1 ? { ...b, status: 'error', error: `${batchErrors.length} row(s) failed` } : b));
        } else {
          setBatches((prev) => prev.map((b) => b.batchNum === i + 1 ? { ...b, status: 'success' } : b));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unexpected error';
        errors.push(`Batch ${i + 1}: ${msg}`);
        skipped += batch.length;
        setBatches((prev) => prev.map((b) => b.batchNum === i + 1 ? { ...b, status: 'error', error: msg } : b));
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    setSummary({ totalRows, success, skipped, errors, duration });
    setStep('done');
    trackEvent('csv_pricing_update', {
      total_rows: totalRows,
      success_rows: success,
      skipped_rows: skipped,
      error_count: errors.length,
      duration_seconds: duration,
      file_name: file?.name ?? null,
    });
  }, [file, pricingRows, supabase, abortRef]);

  // ── Clear all properties then import ──────────────────────────────────────

  const handleClearAndImport = useCallback(async () => {
    setClearing(true);
    setShowClearConfirm(false);
    try {
      // Delete all rows from properties table
      const { error } = await supabase.from('properties').delete().neq('property_ref', '__never__');
      if (error) {
        alert(`Failed to clear properties: ${error.message}`);
        setClearing(false);
        return;
      }
    } catch (err) {
      alert(`Unexpected error clearing properties: ${err instanceof Error ? err.message : String(err)}`);
      setClearing(false);
      return;
    }
    setClearing(false);
    // Now run the normal import
    handleImport();
  }, [supabase, handleImport]);

  const handleReset = () => {
    setStep('idle');
    setFile(null);
    setParsedRows([]);
    setPricingRows([]);
    setIsPricingCsv(false);
    setParseErrors([]);
    setBatches([]);
    setCurrentBatch(0);
    setSummary(null);
    setPreImportSummary(null);
    setSummaryLoading(false);
    setParsedRowsPage(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Progress calculation ───────────────────────────────────────────────────

  const totalBatches = batches.length;
  const completedBatches = batches.filter((b) => b.status === 'success' || b.status === 'error').length;
  const progressPct = totalBatches > 0 ? Math.round((completedBatches / totalBatches) * 100) : 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[hsl(210,15%,97%)]">
      {/* Header */}
      <div className="bg-white border-b border-[hsl(214,20%,88%)] px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/data-import-export" className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors">
            <Icon name="ArrowLeftIcon" size={18} className="text-[hsl(215,15%,52%)]" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[hsl(215,25%,18%)]">CSV Property Upload</h1>
            <p className="text-sm text-[hsl(215,15%,52%)]">Drag and drop or select a CSV file to import property data</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {step !== 'idle' && step !== 'importing' && (
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[hsl(215,15%,52%)] border border-[hsl(214,20%,88%)] rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors"
              >
                <Icon name="RotateCcwIcon" size={15} />
                Start Over
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Step indicator */}
        <div className="flex items-center gap-0">
          {(['Upload', 'Preview', 'Summary', 'Import', 'Done'] as const).map((label, idx) => {
            const stepMap: Record<string, number> = { idle: 0, preview: 1, summary: 2, importing: 3, done: 4 };
            const currentIdx = stepMap[step];
            const isActive = idx === currentIdx;
            const isDone = idx < currentIdx;
            return (
              <React.Fragment key={label}>
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    isDone ? 'bg-[#8B1A2B] text-white' : isActive ? 'bg-[#8B1A2B]/10 text-[#8B1A2B] border-2 border-[#8B1A2B]' : 'bg-[hsl(210,15%,94%)] text-[hsl(215,15%,52%)]'
                  }`}>
                    {isDone ? <Icon name="CheckIcon" size={13} /> : idx + 1}
                  </div>
                  <span className={`text-sm font-medium ${isActive ? 'text-[#8B1A2B]' : isDone ? 'text-[hsl(215,25%,18%)]' : 'text-[hsl(215,15%,52%)]'}`}>{label}</span>
                </div>
                {idx < 4 && <div className={`flex-1 h-px mx-3 ${idx < currentIdx ? 'bg-[#8B1A2B]' : 'bg-[hsl(214,20%,88%)]'}`} />}
              </React.Fragment>
            );
          })}
        </div>

        {/* ── STEP: IDLE — Drop Zone ── */}
        {step === 'idle' && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-16 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
              dragOver
                ? 'border-[#8B1A2B] bg-[#8B1A2B]/5 scale-[1.01]'
                : 'border-[hsl(214,20%,82%)] bg-white hover:border-[#8B1A2B]/50 hover:bg-[#8B1A2B]/[0.02]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-colors ${dragOver ? 'bg-[#8B1A2B]/10' : 'bg-[hsl(210,15%,94%)]'}`}>
              <Icon name="UploadCloudIcon" size={32} className={dragOver ? 'text-[#8B1A2B]' : 'text-[hsl(215,15%,52%)]'} />
            </div>
            <p className="text-lg font-semibold text-[hsl(215,25%,18%)] mb-1">
              {dragOver ? 'Drop your CSV file here' : 'Drag & drop your CSV file'}
            </p>
            <p className="text-sm text-[hsl(215,15%,52%)] mb-5">or click to browse — accepts .csv files only</p>
            <div className="flex items-center gap-4 text-xs text-[hsl(215,15%,52%)]">
              <span className="flex items-center gap-1.5"><Icon name="CheckCircleIcon" size={13} className="text-emerald-500" /> iRem CSV format supported</span>
              <span className="flex items-center gap-1.5"><Icon name="CheckCircleIcon" size={13} className="text-emerald-500" /> Batch processing in groups of 50</span>
              <span className="flex items-center gap-1.5"><Icon name="CheckCircleIcon" size={13} className="text-emerald-500" /> Upsert or insert-only mode</span>
            </div>
          </div>
        )}

        {/* ── STEP: PREVIEW ── */}
        {step === 'preview' && (
          <div className="space-y-4">
            {/* File info card */}
            <div className="bg-white border border-[hsl(214,20%,88%)] rounded-xl p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-[#8B1A2B]/10 flex items-center justify-center flex-shrink-0">
                <Icon name="FileTextIcon" size={22} className="text-[#8B1A2B]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[hsl(215,25%,18%)] truncate">{file?.name}</p>
                <p className="text-sm text-[hsl(215,15%,52%)]">
                  {isPricingCsv
                    ? pricingRows.length > 0
                      ? `${pricingRows.length.toLocaleString()} pricing/status rows detected`
                      : 'Parsing…'
                    : parsedRows.length > 0
                      ? `${parsedRows.length.toLocaleString()} valid rows ready to import`
                      : 'Parsing…'}
                  {parseErrors.length > 0 && ` · ${parseErrors.length} parse error${parseErrors.length > 1 ? 's' : ''}`}
                </p>
              </div>
              <button onClick={handleReset} className="p-2 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors">
                <Icon name="XIcon" size={16} className="text-[hsl(215,15%,52%)]" />
              </button>
            </div>

            {/* Pricing CSV detected banner */}
            {isPricingCsv && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <Icon name="CurrencyDollarIcon" size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-800 mb-1">Pricing &amp; Status Update CSV detected</p>
                  <p className="text-xs text-blue-700">
                    This file will update <strong>publish date, sale price, rent price, advertising remarks, and status</strong> on existing properties matched by <strong>short code</strong>.
                    Sale prices (s_price) are in millions — e.g. 5.35 → HK$5,350,000. Rent prices (r_price) are in thousands — e.g. 21 → HK$21,000. Zero or blank values will clear the field.
                  </p>
                </div>
              </div>
            )}

            {/* Parse errors */}
            {parseErrors.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="AlertTriangleIcon" size={16} className="text-amber-600" />
                  <span className="text-sm font-semibold text-amber-800">{parseErrors.length} row{parseErrors.length > 1 ? 's' : ''} skipped during parsing</span>
                </div>
                <ul className="space-y-1 max-h-32 overflow-y-auto">
                  {parseErrors.slice(0, 10).map((e, i) => (
                    <li key={i} className="text-xs text-amber-700 font-mono">{e}</li>
                  ))}
                  {parseErrors.length > 10 && <li className="text-xs text-amber-600">…and {parseErrors.length - 10} more</li>}
                </ul>
              </div>
            )}

            {/* Import options — hide for pricing-update mode */}
            {!isPricingCsv && (
            <div className="bg-white border border-[hsl(214,20%,88%)] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-[hsl(215,25%,18%)] mb-3">Import Mode</h3>
              {importMode === 'update-by-shortcode' && (
                <div className="mb-3 flex items-start gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                  <Icon name="InformationCircleIcon" size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    <strong>Update by Short Code mode auto-selected:</strong> This CSV has a <code className="font-mono bg-blue-100 px-1 rounded">short_code</code> column but no <code className="font-mono bg-blue-100 px-1 rounded">pid</code>. Only existing properties matched by short code will be updated — no new properties will be created.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setImportMode('update-by-shortcode')}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${importMode === 'update-by-shortcode' ? 'border-[#8B1A2B] bg-[#8B1A2B]/5' : 'border-[hsl(214,20%,88%)] hover:border-[#8B1A2B]/30'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon name="PencilSquareIcon" size={15} className={importMode === 'update-by-shortcode' ? 'text-[#8B1A2B]' : 'text-[hsl(215,15%,52%)]'} />
                    <span className={`text-sm font-semibold ${importMode === 'update-by-shortcode' ? 'text-[#8B1A2B]' : 'text-[hsl(215,25%,18%)]'}`}>Update by Short Code</span>
                    {importMode === 'update-by-shortcode' && <span className="ml-auto text-xs font-medium px-1.5 py-0.5 rounded-full bg-[#8B1A2B] text-white">Recommended</span>}
                  </div>
                  <p className="text-xs text-[hsl(215,15%,52%)]">Updates existing properties matched by <strong>short_code</strong> only. <strong className="text-[hsl(215,25%,18%)]">Never creates new properties.</strong> Unmatched rows are skipped.</p>
                </button>
                <button
                  onClick={() => setImportMode('upsert')}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${importMode === 'upsert' ? 'border-[#8B1A2B] bg-[#8B1A2B]/5' : 'border-[hsl(214,20%,88%)] hover:border-[#8B1A2B]/30'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon name="RefreshCwIcon" size={15} className={importMode === 'upsert' ? 'text-[#8B1A2B]' : 'text-[hsl(215,15%,52%)]'} />
                    <span className={`text-sm font-semibold ${importMode === 'upsert' ? 'text-[#8B1A2B]' : 'text-[hsl(215,25%,18%)]'}`}>Upsert — Merge &amp; Update</span>
                  </div>
                  <p className="text-xs text-[hsl(215,15%,52%)]">Merges new data into existing properties and inserts any new ones. <strong className="text-[hsl(215,25%,18%)]">Does not delete anything.</strong></p>
                </button>
                <button
                  onClick={() => setImportMode('skip')}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${importMode === 'skip' ? 'border-[#8B1A2B] bg-[#8B1A2B]/5' : 'border-[hsl(214,20%,88%)] hover:border-[#8B1A2B]/30'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon name="PlusCircleIcon" size={15} className={importMode === 'skip' ? 'text-[#8B1A2B]' : 'text-[hsl(215,15%,52%)]'} />
                    <span className={`text-sm font-semibold ${importMode === 'skip' ? 'text-[#8B1A2B]' : 'text-[hsl(215,25%,18%)]'}`}>Insert Only (Skip Existing)</span>
                  </div>
                  <p className="text-xs text-[hsl(215,15%,52%)]">Only adds new records. Existing properties are left unchanged.</p>
                </button>
                <button
                  onClick={() => setImportMode('replace')}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${importMode === 'replace' ? 'border-orange-500 bg-orange-50' : 'border-[hsl(214,20%,88%)] hover:border-orange-300'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon name="ReplaceIcon" size={15} className={importMode === 'replace' ? 'text-orange-600' : 'text-[hsl(215,15%,52%)]'} />
                    <span className={`text-sm font-semibold ${importMode === 'replace' ? 'text-orange-700' : 'text-[hsl(215,25%,18%)]'}`}>Replace All</span>
                    {importMode === 'replace' && <span className="ml-auto text-xs font-medium px-1.5 py-0.5 rounded-full bg-orange-500 text-white">Destructive</span>}
                  </div>
                  <p className="text-xs text-[hsl(215,15%,52%)]">Imports all CSV rows, then <strong className="text-orange-700">deletes any properties not in this CSV</strong>. Database will match the CSV exactly.</p>
                </button>
              </div>
              {importMode === 'replace' && (
                <div className="mt-3 flex items-start gap-2 px-3 py-2.5 bg-orange-50 border border-orange-200 rounded-lg">
                  <Icon name="AlertTriangleIcon" size={14} className="text-orange-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-orange-700">
                    <strong>Replace All mode:</strong> After importing {parsedRows.length.toLocaleString()} records from this CSV, all other properties in the database will be permanently deleted. The database will contain only the {parsedRows.length.toLocaleString()} records from this file.
                  </p>
                </div>
              )}
            </div>
            )}

            {/* Pricing preview table */}
            {isPricingCsv && pricingRows.length > 0 && (
              <div className="bg-white border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-[hsl(214,20%,88%)] flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[hsl(215,25%,18%)]">Preview (first 10 rows)</h3>
                  <span className="text-xs text-[hsl(215,15%,52%)]">{pricingRows.length.toLocaleString()} total rows</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[hsl(210,15%,97%)]">
                        {['Short Code', 'Publish Date', 'Sale Price', 'Rent Price', 'Status', 'Adv. Remarks'].map((col) => (
                          <th key={col} className="px-4 py-2.5 text-left font-semibold text-[hsl(215,15%,52%)] whitespace-nowrap">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pricingRows.slice(0, 10).map((row, i) => (
                        <tr key={i} className="border-t border-[hsl(214,20%,88%)] hover:bg-[hsl(210,15%,97%)]">
                          <td className="px-4 py-2.5 font-mono font-semibold text-[hsl(215,25%,18%)]">{row.short_code}</td>
                          <td className="px-4 py-2.5 text-[hsl(215,15%,52%)]">{row.publish_dt ?? '—'}</td>
                          <td className="px-4 py-2.5 text-[hsl(215,15%,52%)]">
                            {row.asking_price === null
                              ? <span className="text-[hsl(215,15%,70%)] italic">clear</span>
                              : row.asking_price !== undefined
                                ? `HK$${row.asking_price.toLocaleString()}`
                                : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-[hsl(215,15%,52%)]">
                            {row.asking_rent === null
                              ? <span className="text-[hsl(215,15%,70%)] italic">clear</span>
                              : row.asking_rent !== undefined
                                ? `HK$${row.asking_rent.toLocaleString()}`
                                : '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            {row.status ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#8B1A2B]/10 text-[#8B1A2B]">{row.status}</span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-[hsl(215,15%,52%)] max-w-[200px] truncate">{row.p_english ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Standard preview table */}
            {!isPricingCsv && parsedRows.length > 0 && (
              <div className="bg-white border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-[hsl(214,20%,88%)] flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[hsl(215,25%,18%)]">Preview (first 5 rows)</h3>
                  <span className="text-xs text-[hsl(215,15%,52%)]">{parsedRows.length.toLocaleString()} total rows</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[hsl(210,15%,97%)]">
                        {['property_ref', 'village', 'status', 'bedrooms', 'bathrooms', 'asking_rent', 'asking_price'].map((col) => (
                          <th key={col} className="px-4 py-2.5 text-left font-semibold text-[hsl(215,15%,52%)] whitespace-nowrap">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-t border-[hsl(214,20%,88%)] hover:bg-[hsl(210,15%,97%)]">
                          <td className="px-4 py-2.5 font-mono text-[hsl(215,25%,18%)]">{row.property_ref}</td>
                          <td className="px-4 py-2.5 text-[hsl(215,15%,52%)]">{row.village || '—'}</td>
                          <td className="px-4 py-2.5">
                            {row.status ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#8B1A2B]/10 text-[#8B1A2B]">{row.status}</span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-[hsl(215,15%,52%)]">{row.bedrooms ?? '—'}</td>
                          <td className="px-4 py-2.5 text-[hsl(215,15%,52%)]">{row.bathrooms ?? '—'}</td>
                          <td className="px-4 py-2.5 text-[hsl(215,15%,52%)]">{row.asking_rent ? `$${row.asking_rent.toLocaleString()}` : '—'}</td>
                          <td className="px-4 py-2.5 text-[hsl(215,15%,52%)]">{row.asking_price ? `$${row.asking_price.toLocaleString()}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Action */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-[hsl(215,15%,52%)]">
                {isPricingCsv
                  ? <>Will update <strong className="text-[hsl(215,25%,18%)]">{pricingRows.length.toLocaleString()}</strong> properties matched by short code</>
                  : <>Will process <strong className="text-[hsl(215,25%,18%)]">{parsedRows.length.toLocaleString()}</strong> rows in <strong className="text-[hsl(215,25%,18%)]">{Math.ceil(parsedRows.length / BATCH_SIZE)}</strong> batch{Math.ceil(parsedRows.length / BATCH_SIZE) !== 1 ? 'es' : ''} of {BATCH_SIZE}</>
                }
              </p>
              {isPricingCsv ? (
                <button
                  onClick={handlePricingUpdate}
                  disabled={pricingRows.length === 0}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#8B1A2B] text-white text-sm font-semibold rounded-lg hover:bg-[#7a1726] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Icon name="ArrowUpCircleIcon" size={16} />
                  Update Pricing &amp; Status
                </button>
              ) : (
                <button
                  onClick={handleReviewSummary}
                  disabled={parsedRows.length === 0 || summaryLoading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#8B1A2B] text-white text-sm font-semibold rounded-lg hover:bg-[#7a1726] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {summaryLoading ? (
                    <Icon name="LoaderIcon" size={16} className="animate-spin" />
                  ) : (
                    <Icon name="ClipboardListIcon" size={16} />
                  )}
                  {summaryLoading ? 'Analysing…' : 'Review Summary'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── STEP: SUMMARY — Pre-import review ── */}
        {step === 'summary' && preImportSummary && (
          <div className="space-y-5">
            {/* Header banner */}
            <div className="bg-white border border-[hsl(214,20%,88%)] rounded-xl p-5">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-xl bg-[#8B1A2B]/10 flex items-center justify-center flex-shrink-0">
                  <Icon name="ClipboardListIcon" size={20} className="text-[#8B1A2B]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[hsl(215,25%,18%)]">Pre-Import Summary</h2>
                  <p className="text-sm text-[hsl(215,15%,52%)]">Review all parsed data before writing to the database</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-2xl font-bold text-[#8B1A2B]">{preImportSummary.totalRows.toLocaleString()}</p>
                  <p className="text-xs text-[hsl(215,15%,52%)]">total rows</p>
                </div>
              </div>
            </div>

            {/* Unmapped warning */}
            {preImportSummary.unmappedPrefixes.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <Icon name="AlertTriangleIcon" size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800 mb-1">
                    {preImportSummary.unmappedPrefixes.length} building code prefix{preImportSummary.unmappedPrefixes.length > 1 ? 'es' : ''} not found in Building Code Mapper
                  </p>
                  <p className="text-xs text-amber-700 mb-2">
                    These short code prefixes have no mapped building name. Properties will still import but <strong>building_name</strong> will be blank for these rows.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {preImportSummary.unmappedPrefixes.map((p) => (
                      <span key={p} className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-mono rounded-md border border-amber-300">{p}</span>
                    ))}
                  </div>
                  <Link href="/building-codes" className="inline-flex items-center gap-1 mt-2 text-xs text-amber-700 underline hover:text-amber-900">
                    <Icon name="ExternalLinkIcon" size={11} />
                    Add missing codes in Building Code Mapper
                  </Link>
                </div>
              </div>
            )}

            {/* Building codes table */}
            <div className="bg-white border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[hsl(214,20%,88%)] flex items-center gap-2">
                <Icon name="BuildingIcon" size={15} className="text-[#8B1A2B]" />
                <h3 className="text-sm font-semibold text-[hsl(215,25%,18%)]">Building Code Mapping</h3>
                <span className="ml-auto text-xs text-[hsl(215,15%,52%)]">{preImportSummary.buildingCodes.length} unique prefix{preImportSummary.buildingCodes.length !== 1 ? 'es' : ''}</span>
              </div>
              {preImportSummary.buildingCodes.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-[hsl(215,15%,52%)]">No short codes found in this file</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[hsl(210,15%,97%)]">
                      <th className="px-5 py-2.5 text-left text-xs font-semibold text-[hsl(215,15%,52%)]">Short Code Prefix</th>
                      <th className="px-5 py-2.5 text-left text-xs font-semibold text-[hsl(215,15%,52%)]">Mapped Building Name</th>
                      <th className="px-5 py-2.5 text-right text-xs font-semibold text-[hsl(215,15%,52%)]">Properties</th>
                      <th className="px-5 py-2.5 text-center text-xs font-semibold text-[hsl(215,15%,52%)]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preImportSummary.buildingCodes.map((bc) => (
                      <tr key={bc.prefix} className="border-t border-[hsl(214,20%,88%)] hover:bg-[hsl(210,15%,97%)]">
                        <td className="px-5 py-3 font-mono font-semibold text-[hsl(215,25%,18%)]">{bc.prefix}</td>
                        <td className="px-5 py-3 text-[hsl(215,25%,18%)]">
                          {bc.buildingName ?? <span className="text-[hsl(215,15%,52%)] italic">Not mapped</span>}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-[hsl(215,25%,18%)]">{bc.count}</td>
                        <td className="px-5 py-3 text-center">
                          {bc.buildingName ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                              <Icon name="CheckCircleIcon" size={11} /> Mapped
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                              <Icon name="AlertCircleIcon" size={11} /> Missing
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Floor / Flat parsing stats */}
            <div className="bg-white border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[hsl(214,20%,88%)] flex items-center gap-2">
                <Icon name="LayersIcon" size={15} className="text-[#8B1A2B]" />
                <h3 className="text-sm font-semibold text-[hsl(215,25%,18%)]">Floor &amp; Flat Auto-Extraction</h3>
              </div>
              <div className="grid grid-cols-2 divide-x divide-[hsl(214,20%,88%)]">
                {/* Floor column */}
                <div className="p-5">
                  <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-3">Floor Number</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm text-[hsl(215,25%,18%)]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#8B1A2B] inline-block" />
                        Auto-parsed from short code
                      </span>
                      <span className="font-bold text-[hsl(215,25%,18%)]">{preImportSummary.floorParsed}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm text-[hsl(215,25%,18%)]">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" />
                        From CSV column
                      </span>
                      <span className="font-bold text-[hsl(215,25%,18%)]">{preImportSummary.floorFromCSV}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm text-[hsl(215,15%,52%)]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[hsl(214,20%,82%)] inline-block" />
                        Not available
                      </span>
                      <span className="font-bold text-[hsl(215,15%,52%)]">{preImportSummary.floorMissing}</span>
                    </div>
                  </div>
                  {/* Mini bar */}
                  <div className="mt-3 h-2 rounded-full bg-[hsl(210,15%,94%)] overflow-hidden flex">
                    {preImportSummary.totalRows > 0 && (
                      <>
                        <div className="h-full bg-[#8B1A2B]" style={{ width: `${(preImportSummary.floorParsed / preImportSummary.totalRows) * 100}%` }} />
                        <div className="h-full bg-blue-400" style={{ width: `${(preImportSummary.floorFromCSV / preImportSummary.totalRows) * 100}%` }} />
                      </>
                    )}
                  </div>
                </div>
                {/* Unit/Flat column */}
                <div className="p-5">
                  <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-3">Flat / Unit</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm text-[hsl(215,25%,18%)]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#8B1A2B] inline-block" />
                        Auto-parsed from short code
                      </span>
                      <span className="font-bold text-[hsl(215,25%,18%)]">{preImportSummary.unitParsed}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm text-[hsl(215,25%,18%)]">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" />
                        From CSV column
                      </span>
                      <span className="font-bold text-[hsl(215,25%,18%)]">{preImportSummary.unitFromCSV}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm text-[hsl(215,15%,52%)]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[hsl(214,20%,82%)] inline-block" />
                        Not available
                      </span>
                      <span className="font-bold text-[hsl(215,15%,52%)]">{preImportSummary.unitMissing}</span>
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-[hsl(210,15%,94%)] overflow-hidden flex">
                    {preImportSummary.totalRows > 0 && (
                      <>
                        <div className="h-full bg-[#8B1A2B]" style={{ width: `${(preImportSummary.unitParsed / preImportSummary.totalRows) * 100}%` }} />
                        <div className="h-full bg-blue-400" style={{ width: `${(preImportSummary.unitFromCSV / preImportSummary.totalRows) * 100}%` }} />
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Sample parsed rows */}
            {preImportSummary.sampleParsed.length > 0 && (
              <div className="bg-white border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-[hsl(214,20%,88%)] flex items-center gap-2">
                  <Icon name="SearchIcon" size={15} className="text-[#8B1A2B]" />
                  <h3 className="text-sm font-semibold text-[hsl(215,25%,18%)]">Parsed Properties Sample (first 10)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[hsl(210,15%,97%)]">
                        <th className="px-4 py-2.5 text-left font-semibold text-[hsl(215,15%,52%)]">PID</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-[hsl(215,15%,52%)]">Short Code</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-[hsl(215,15%,52%)]">Floor</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-[hsl(215,15%,52%)]">Flat / Unit</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-[hsl(215,15%,52%)]">Floor Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preImportSummary.sampleParsed.map((row, i) => (
                        <tr key={i} className="border-t border-[hsl(214,20%,88%)] hover:bg-[hsl(210,15%,97%)]">
                          <td className="px-4 py-2.5 font-mono text-[hsl(215,25%,18%)]">{row.property_ref}</td>
                          <td className="px-4 py-2.5 font-mono text-[hsl(215,25%,18%)]">{row.short_code}</td>
                          <td className="px-4 py-2.5 font-semibold text-[hsl(215,25%,18%)]">{row.floor ?? <span className="text-[hsl(215,15%,52%)]">—</span>}</td>
                          <td className="px-4 py-2.5 font-semibold text-[hsl(215,25%,18%)]">{row.unit ?? <span className="text-[hsl(215,15%,52%)]">—</span>}</td>
                          <td className="px-4 py-2.5">
                            {row.source === 'short_code_parsed' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#8B1A2B]/10 text-[#8B1A2B]">
                                <Icon name="ZapIcon" size={10} /> Auto-parsed
                              </span>
                            ) : row.source === 'csv_column' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                <Icon name="FileTextIcon" size={10} /> CSV column
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[hsl(210,15%,94%)] text-[hsl(215,15%,52%)]">
                                <Icon name="MinusIcon" size={10} /> None
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── ALL PARSED ROWS — Full verification table ── */}
            {(() => {
              const PAGE_SIZE = 50;
              const totalPages = Math.ceil(parsedRows.length / PAGE_SIZE);
              const pageRows = parsedRows.slice(parsedRowsPage * PAGE_SIZE, (parsedRowsPage + 1) * PAGE_SIZE);
              return (
                <div className="bg-white border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-[hsl(214,20%,88%)] flex items-center gap-2">
                    <Icon name="TableIcon" size={15} className="text-[#8B1A2B]" />
                    <h3 className="text-sm font-semibold text-[hsl(215,25%,18%)]">All Parsed Rows — Verify Before Commit</h3>
                    <span className="ml-auto text-xs text-[hsl(215,15%,52%)]">{parsedRows.length.toLocaleString()} rows total</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-[hsl(210,15%,97%)]">
                          <th className="px-4 py-2.5 text-left font-semibold text-[hsl(215,15%,52%)] whitespace-nowrap">#</th>
                          <th className="px-4 py-2.5 text-left font-semibold text-[hsl(215,15%,52%)] whitespace-nowrap">PID</th>
                          <th className="px-4 py-2.5 text-left font-semibold text-[hsl(215,15%,52%)] whitespace-nowrap">Short Code</th>
                          <th className="px-4 py-2.5 text-left font-semibold text-[hsl(215,15%,52%)] whitespace-nowrap">Building</th>
                          <th className="px-4 py-2.5 text-left font-semibold text-[hsl(215,15%,52%)] whitespace-nowrap">Block</th>
                          <th className="px-4 py-2.5 text-left font-semibold text-[hsl(215,15%,52%)] whitespace-nowrap">Floor</th>
                          <th className="px-4 py-2.5 text-left font-semibold text-[hsl(215,15%,52%)] whitespace-nowrap">Unit / Flat</th>
                          <th className="px-4 py-2.5 text-right font-semibold text-[hsl(215,15%,52%)] whitespace-nowrap">Rent (HKD)</th>
                          <th className="px-4 py-2.5 text-center font-semibold text-[hsl(215,15%,52%)] whitespace-nowrap">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((row, i) => {
                          const globalIdx = parsedRowsPage * PAGE_SIZE + i;
                          // Extract block from unit field if it contains "Block X" pattern
                          const blockMatch = row.unit?.match(/^Block\s+(\S+)/i);
                          const blockDisplay = blockMatch ? blockMatch[1] : (row.short_code ? row.short_code.replace(/^[A-Z]+/i, '').replace(/[A-Z]+$/i, '').replace(/^0+/, '') || '—' : '—');
                          const unitDisplay = blockMatch
                            ? row.unit?.replace(/^Block\s+\S+\s+/i, '') ?? '—'
                            : row.unit ?? '—';
                          const hasFloor = !!row.floor;
                          const hasUnit = !!row.unit;
                          return (
                            <tr key={globalIdx} className={`border-t border-[hsl(214,20%,88%)] hover:bg-[hsl(210,15%,97%)] ${(!hasFloor || !hasUnit) ? 'bg-amber-50/40' : ''}`}>
                              <td className="px-4 py-2.5 text-[hsl(215,15%,52%)] tabular-nums">{globalIdx + 1}</td>
                              <td className="px-4 py-2.5 font-mono text-[hsl(215,25%,18%)] whitespace-nowrap">{row.property_ref}</td>
                              <td className="px-4 py-2.5 font-mono text-[hsl(215,25%,18%)] whitespace-nowrap">{row.short_code ?? <span className="text-[hsl(215,15%,52%)]">—</span>}</td>
                              <td className="px-4 py-2.5 text-[hsl(215,25%,18%)] whitespace-nowrap max-w-[140px] truncate" title={row.building_name}>{row.building_name ?? <span className="text-[hsl(215,15%,52%)]">—</span>}</td>
                              <td className="px-4 py-2.5 font-semibold text-[hsl(215,25%,18%)]">{blockDisplay}</td>
                              <td className="px-4 py-2.5">
                                {hasFloor ? (
                                  <span className="font-semibold text-[hsl(215,25%,18%)]">{row.floor}</span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                                    <Icon name="AlertCircleIcon" size={9} /> Missing
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5">
                                {hasUnit ? (
                                  <span className="font-semibold text-[hsl(215,25%,18%)]">{unitDisplay}</span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                                    <Icon name="AlertCircleIcon" size={9} /> Missing
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right font-semibold text-[hsl(215,25%,18%)] tabular-nums whitespace-nowrap">
                                {row.asking_rent ? `$${row.asking_rent.toLocaleString()}` : <span className="text-[hsl(215,15%,52%)] font-normal">—</span>}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                {row.status ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#8B1A2B]/10 text-[#8B1A2B] whitespace-nowrap">{row.status}</span>
                                ) : (
                                  <span className="text-[hsl(215,15%,52%)]">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="px-5 py-3 border-t border-[hsl(214,20%,88%)] flex items-center justify-between">
                      <span className="text-xs text-[hsl(215,15%,52%)]">
                        Showing rows {parsedRowsPage * PAGE_SIZE + 1}–{Math.min((parsedRowsPage + 1) * PAGE_SIZE, parsedRows.length)} of {parsedRows.length.toLocaleString()}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setParsedRowsPage(0)}
                          disabled={parsedRowsPage === 0}
                          className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,94%)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          title="First page"
                        >
                          <Icon name="ChevronsLeftIcon" size={14} className="text-[hsl(215,15%,52%)]" />
                        </button>
                        <button
                          onClick={() => setParsedRowsPage((p) => Math.max(0, p - 1))}
                          disabled={parsedRowsPage === 0}
                          className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,94%)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          title="Previous page"
                        >
                          <Icon name="ChevronLeftIcon" size={14} className="text-[hsl(215,15%,52%)]" />
                        </button>
                        <span className="px-3 py-1 text-xs font-medium text-[hsl(215,25%,18%)] bg-[hsl(210,15%,97%)] rounded-lg border border-[hsl(214,20%,88%)]">
                          {parsedRowsPage + 1} / {totalPages}
                        </span>
                        <button
                          onClick={() => setParsedRowsPage((p) => Math.min(totalPages - 1, p + 1))}
                          disabled={parsedRowsPage === totalPages - 1}
                          className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,94%)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          title="Next page"
                        >
                          <Icon name="ChevronRightIcon" size={14} className="text-[hsl(215,15%,52%)]" />
                        </button>
                        <button
                          onClick={() => setParsedRowsPage(totalPages - 1)}
                          disabled={parsedRowsPage === totalPages - 1}
                          className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,94%)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          title="Last page"
                        >
                          <Icon name="ChevronsRightIcon" size={14} className="text-[hsl(215,15%,52%)]" />
                        </button>
                      </div>
                    </div>
                  )}
                  {/* Missing data legend */}
                  <div className="px-5 py-2.5 border-t border-[hsl(214,20%,88%)] bg-[hsl(210,15%,97%)] flex items-center gap-4 text-xs text-[hsl(215,15%,52%)]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-amber-50 border border-amber-200 inline-block" />
                      Row highlighted = missing floor or unit
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Icon name="AlertCircleIcon" size={11} className="text-amber-600" />
                      Missing badge = field not parsed from short code or CSV
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Status counts */}
            <div className="bg-white border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[hsl(214,20%,88%)] flex items-center gap-2">
                <Icon name="PieChartIcon" size={15} className="text-[#8B1A2B]" />
                <h3 className="text-sm font-semibold text-[hsl(215,25%,18%)]">Property Status Breakdown</h3>
              </div>
              <div className="p-5 flex flex-wrap gap-3">
                {Object.entries(preImportSummary.statusCounts).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
                  <div key={status} className="flex items-center gap-2 px-3 py-2 bg-[hsl(210,15%,97%)] rounded-lg border border-[hsl(214,20%,88%)]">
                    <span className="text-sm font-semibold text-[hsl(215,25%,18%)]">{count}</span>
                    <span className="text-xs text-[hsl(215,15%,52%)]">{status}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Duplicate Detection Panel ── */}
            {(() => {
              const { shortCodes, buildingNames, propertyRefs } = preImportSummary.duplicates;
              const totalDups = shortCodes.length + buildingNames.length + propertyRefs.length;
              const csvOnlyDups = [
                ...shortCodes.filter((d) => d.csvRows.length > 1 && !d.existsInDb),
                ...buildingNames.filter((d) => d.csvRows.length > 1 && !d.existsInDb),
                ...propertyRefs.filter((d) => d.csvRows.length > 1 && !d.existsInDb),
              ].length;
              const dbConflicts = [
                ...shortCodes.filter((d) => d.existsInDb),
                ...buildingNames.filter((d) => d.existsInDb),
                ...propertyRefs.filter((d) => d.existsInDb),
              ].length;

              return (
                <div className="bg-white border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-[hsl(214,20%,88%)] flex items-center gap-2">
                    <Icon name="CopyIcon" size={15} className="text-[#8B1A2B]" />
                    <h3 className="text-sm font-semibold text-[hsl(215,25%,18%)]">Duplicate Detection</h3>
                    <div className="ml-auto flex items-center gap-2">
                      {totalDups === 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                          <Icon name="CheckCircleIcon" size={11} /> No duplicates found
                        </span>
                      ) : (
                        <>
                          {csvOnlyDups > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                              <Icon name="AlertCircleIcon" size={11} /> {csvOnlyDups} within CSV
                            </span>
                          )}
                          {dbConflicts > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              <Icon name="DatabaseIcon" size={11} /> {dbConflicts} DB conflicts
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {totalDups === 0 ? (
                    <div className="px-5 py-6 text-center text-sm text-[hsl(215,15%,52%)]">
                      All short codes, building names, and PIDs are unique in this file and do not conflict with existing database records.
                    </div>
                  ) : (
                    <div className="divide-y divide-[hsl(214,20%,88%)]">

                      {/* Short Code duplicates */}
                      {shortCodes.length > 0 && (
                        <div className="p-5">
                          <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                            <Icon name="HashIcon" size={12} /> Short Codes ({shortCodes.length})
                          </p>
                          <div className="space-y-2">
                            {shortCodes.map((d) => (
                              <div key={d.value} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border text-xs ${d.existsInDb ? (importMode === 'upsert' ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200') : 'bg-amber-50 border-amber-200'}`}>
                                <span className={`font-mono font-bold mt-0.5 ${d.existsInDb ? (importMode === 'upsert' ? 'text-blue-700' : 'text-red-700') : 'text-amber-700'}`}>{d.value}</span>
                                <div className="flex-1 min-w-0">
                                  {d.csvRows.length > 1 && (
                                    <p className="text-[hsl(215,15%,52%)]">
                                      Appears <strong>{d.csvRows.length}×</strong> in CSV: {d.csvRows.slice(0, 5).join(', ')}{d.csvRows.length > 5 ? ` +${d.csvRows.length - 5} more` : ''}
                                    </p>
                                  )}
                                  {d.existsInDb && (
                                    <p className={`${d.csvRows.length > 1 ? 'mt-0.5' : ''} ${importMode === 'upsert' ? 'text-blue-600' : 'text-red-600'} font-medium`}>
                                      {importMode === 'upsert' ? 'Exists in DB — will be updated with new data' : 'Already exists in database — will be skipped'}
                                    </p>
                                  )}
                                </div>
                                <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${d.existsInDb ? (importMode === 'upsert' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700') : 'bg-amber-100 text-amber-700'}`}>
                                  {d.existsInDb ? (importMode === 'upsert' ? 'Will update' : 'Will skip') : 'CSV dup'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Building Name duplicates */}
                      {buildingNames.length > 0 && (
                        <div className="p-5">
                          <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                            <Icon name="BuildingIcon" size={12} /> Building Names ({buildingNames.length})
                          </p>
                          <div className="space-y-2">
                            {buildingNames.map((d) => (
                              <div key={d.value} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border text-xs ${d.existsInDb ? (importMode === 'upsert' ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200') : 'bg-amber-50 border-amber-200'}`}>
                                <span className={`font-medium mt-0.5 ${d.existsInDb ? (importMode === 'upsert' ? 'text-blue-700' : 'text-red-700') : 'text-amber-700'}`}>{d.value}</span>
                                <div className="flex-1 min-w-0">
                                  {d.csvRows.length > 1 && (
                                    <p className="text-[hsl(215,15%,52%)]">
                                      Appears <strong>{d.csvRows.length}×</strong> in CSV: {d.csvRows.slice(0, 5).join(', ')}{d.csvRows.length > 5 ? ` +${d.csvRows.length - 5} more` : ''}
                                    </p>
                                  )}
                                  {d.existsInDb && (
                                    <p className={`${d.csvRows.length > 1 ? 'mt-0.5' : ''} ${importMode === 'upsert' ? 'text-blue-600' : 'text-red-600'} font-medium`}>
                                      {importMode === 'upsert' ? 'Exists in DB — will be updated with new data' : 'Already exists in database — will be skipped'}
                                    </p>
                                  )}
                                </div>
                                <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${d.existsInDb ? (importMode === 'upsert' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700') : 'bg-amber-100 text-amber-700'}`}>
                                  {d.existsInDb ? (importMode === 'upsert' ? 'Will update' : 'Will skip') : 'CSV dup'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Property Ref duplicates */}
                      {propertyRefs.length > 0 && (
                        <div className="p-5">
                          <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                            <Icon name="FileTextIcon" size={12} /> PIDs ({propertyRefs.length})
                          </p>
                          <div className="space-y-2">
                            {propertyRefs.map((d) => (
                              <div key={d.value} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border text-xs ${d.existsInDb ? (importMode === 'upsert' ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200') : 'bg-amber-50 border-amber-200'}`}>
                                <span className={`font-mono font-bold mt-0.5 ${d.existsInDb ? (importMode === 'upsert' ? 'text-blue-700' : 'text-red-700') : 'text-amber-700'}`}>{d.value}</span>
                                <div className="flex-1 min-w-0">
                                  {d.csvRows.length > 1 && (
                                    <p className="text-[hsl(215,15%,52%)]">
                                      Appears <strong>{d.csvRows.length}×</strong> in CSV
                                    </p>
                                  )}
                                  {d.existsInDb && (
                                    <p className={`${d.csvRows.length > 1 ? 'mt-0.5' : ''} ${importMode === 'upsert' ? 'text-blue-600' : 'text-red-600'} font-medium`}>
                                      Already exists in database — will be {importMode === 'upsert' ? 'updated (upsert)' : 'skipped (insert-only)'}
                                    </p>
                                  )}
                                </div>
                                <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${d.existsInDb ? (importMode === 'upsert' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700') : 'bg-amber-100 text-amber-700'}`}>
                                  {d.existsInDb ? (importMode === 'upsert' ? 'Will update' : 'Will skip') : 'CSV dup'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Merge info banner */}
            {importMode === 'upsert' && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3 flex items-center gap-3">
                <Icon name="ShieldCheckIcon" size={18} className="text-emerald-600 flex-shrink-0" />
                <p className="text-sm text-emerald-800">
                  <strong>Safe merge mode active.</strong> New data from this CSV will be merged into existing properties. Nothing will be deleted.
                </p>
              </div>
            )}
            {importMode === 'replace' && (
              <div className="bg-orange-50 border border-orange-300 rounded-xl px-5 py-3 flex items-center gap-3">
                <Icon name="AlertTriangleIcon" size={18} className="text-orange-600 flex-shrink-0" />
                <p className="text-sm text-orange-800">
                  <strong>Replace All mode active.</strong> After importing {parsedRows.length.toLocaleString()} records, all properties <em>not</em> in this CSV will be permanently deleted from the database.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep('preview')}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[hsl(215,15%,52%)] border border-[hsl(214,20%,88%)] rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors"
              >
                <Icon name="ArrowLeftIcon" size={15} />
                Back to Preview
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleReviewRowChanges}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-[#8B1A2B] border-2 border-[#8B1A2B] rounded-lg hover:bg-[#8B1A2B]/5 transition-colors"
                >
                  <Icon name="GitCompareIcon" size={16} />
                  Review Row Changes (Diff)
                </button>
                <button
                  onClick={handleImport}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#8B1A2B] text-white text-sm font-semibold rounded-lg hover:bg-[#7a1726] transition-colors"
                >
                  <Icon name="DatabaseIcon" size={16} />
                  Confirm &amp; Write to Database
                </button>
              </div>
            </div>

            {/* Danger Zone — collapsible */}
            <details className="group">
              <summary className="flex items-center gap-2 cursor-pointer text-xs font-medium text-red-600 hover:text-red-700 select-none list-none">
                <Icon name="ChevronRightIcon" size={13} className="transition-transform group-open:rotate-90" />
                Danger Zone — replace entire database
              </summary>
              <div className="mt-3 border border-red-200 rounded-xl p-4 bg-red-50">
                <p className="text-xs text-red-700 mb-3">
                  <strong>Warning:</strong> This will permanently delete <strong>all existing properties</strong> from the database before importing. Use only when you want this CSV to completely replace the current data.
                </p>
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Icon name="Trash2Icon" size={13} />
                  Clear DB &amp; Import Fresh (destructive)
                </button>
              </div>
            </details>
          </div>
        )}

        {/* ── STEP: IMPORTING ── */}
        {step === 'importing' && (
          <div className="space-y-4">
            {/* Overall progress */}
            <div className="bg-white border border-[hsl(214,20%,88%)] rounded-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-[hsl(215,25%,18%)]">Importing Properties…</h3>
                  <p className="text-sm text-[hsl(215,15%,52%)] mt-0.5">
                    Processing batch {currentBatch} of {totalBatches}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-[#8B1A2B]">{progressPct}%</span>
                  <p className="text-xs text-[hsl(215,15%,52%)]">{completedBatches}/{totalBatches} batches</p>
                </div>
              </div>
              <div className="w-full bg-[hsl(210,15%,94%)] rounded-full h-3 overflow-hidden">
                <div
                  className="h-3 bg-[#8B1A2B] rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {/* Batch grid */}
            <div className="bg-white border border-[hsl(214,20%,88%)] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-[hsl(215,25%,18%)] mb-4">Batch Progress</h3>
              <div className="grid grid-cols-8 gap-2 sm:grid-cols-10 md:grid-cols-12">
                {batches.map((b) => (
                  <div
                    key={b.batchNum}
                    title={`Batch ${b.batchNum}: rows ${b.start}\u2013${b.end}${b.error ? ` \u2014 ${b.error}` : ''}`}
                    className={`h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                      b.status === 'success' ? 'bg-emerald-100 text-emerald-700' :
                      b.status === 'error' ? 'bg-red-100 text-red-700' :
                      b.status === 'processing' ? 'bg-[#8B1A2B]/15 text-[#8B1A2B] animate-pulse' :
                      'bg-[hsl(210,15%,94%)] text-[hsl(215,15%,52%)]'
                    }`}
                  >
                    {b.status === 'success' ? <Icon name="CheckIcon" size={12} /> :
                     b.status === 'error' ? <Icon name="XIcon" size={12} /> :
                     b.status === 'processing' ? <Icon name="LoaderIcon" size={12} className="animate-spin" /> :
                     b.batchNum}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 mt-4 text-xs text-[hsl(215,15%,52%)]">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-100 inline-block" /> Success</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 inline-block" /> Failed</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#8B1A2B]/15 inline-block" /> Processing</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[hsl(210,15%,94%)] inline-block" /> Pending</span>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP: DONE — Summary ── */}
        {step === 'done' && summary && (
          <div className="space-y-4">
            {/* Summary banner */}
            <div className={`rounded-xl p-6 border-2 ${summary.errors.length === 0 ? 'bg-emerald-50 border-emerald-200' : summary.success > 0 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${summary.errors.length === 0 ? 'bg-emerald-100' : summary.success > 0 ? 'bg-amber-100' : 'bg-red-100'}`}>
                  <Icon
                    name={summary.errors.length === 0 ? 'CheckCircleIcon' : summary.success > 0 ? 'AlertTriangleIcon' : 'XCircleIcon'}
                    size={24}
                    className={summary.errors.length === 0 ? 'text-emerald-600' : summary.success > 0 ? 'text-amber-600' : 'text-red-600'}
                  />
                </div>
                <div className="flex-1">
                  <h2 className={`text-lg font-bold mb-1 ${summary.errors.length === 0 ? 'text-emerald-800' : summary.success > 0 ? 'text-amber-800' : 'text-red-800'}`}>
                    {summary.errors.length === 0 ? 'Import Completed Successfully' : summary.success > 0 ? 'Import Completed with Errors' : 'Import Failed'}
                  </h2>
                  <p className={`text-sm ${summary.errors.length === 0 ? 'text-emerald-700' : summary.success > 0 ? 'text-amber-700' : 'text-red-700'}`}>
                    Processed {summary.totalRows.toLocaleString()} rows in {summary.duration}s
                  </p>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className={`grid gap-4 ${summary.deleted !== undefined ? 'grid-cols-5' : 'grid-cols-4'}`}>
              <div className="bg-white border border-[hsl(214,20%,88%)] rounded-xl p-5 text-center">
                <div className="w-10 h-10 rounded-xl bg-[#8B1A2B]/10 flex items-center justify-center mx-auto mb-3">
                  <Icon name="DatabaseIcon" size={20} className="text-[#8B1A2B]" />
                </div>
                <p className="text-3xl font-bold text-[hsl(215,25%,18%)]">{summary.totalRows.toLocaleString()}</p>
                <p className="text-sm text-[hsl(215,15%,52%)] mt-1">Total Rows</p>
              </div>
              <div className="bg-white border border-[hsl(214,20%,88%)] rounded-xl p-5 text-center">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                  <Icon name="CheckCircleIcon" size={20} className="text-emerald-600" />
                </div>
                <p className="text-3xl font-bold text-[hsl(215,25%,18%)]">{summary.success.toLocaleString()}</p>
                <p className="text-sm text-[hsl(215,15%,52%)] mt-1">Successfully Imported</p>
              </div>
              <div className="bg-white border border-[hsl(214,20%,88%)] rounded-xl p-5 text-center">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mx-auto mb-3">
                  <Icon name="SkipForwardIcon" size={20} className="text-amber-600" />
                </div>
                <p className="text-3xl font-bold text-[hsl(215,25%,18%)]">{summary.skipped.toLocaleString()}</p>
                <p className="text-sm text-[hsl(215,15%,52%)] mt-1">Skipped / Existing</p>
              </div>
              {summary.deleted !== undefined && (
                <div className="bg-white border border-orange-200 rounded-xl p-5 text-center">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center mx-auto mb-3">
                    <Icon name="Trash2Icon" size={20} className="text-orange-600" />
                  </div>
                  <p className="text-3xl font-bold text-orange-700">{summary.deleted.toLocaleString()}</p>
                  <p className="text-sm text-[hsl(215,15%,52%)] mt-1">Deleted (not in CSV)</p>
                </div>
              )}
              <div className="bg-white border border-[hsl(214,20%,88%)] rounded-xl p-5 text-center">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center mx-auto mb-3">
                  <Icon name="XCircleIcon" size={20} className="text-red-500" />
                </div>
                <p className="text-3xl font-bold text-[hsl(215,25%,18%)]">{summary.errors.length}</p>
                <p className="text-sm text-[hsl(215,15%,52%)] mt-1">Failed Batches</p>
              </div>
            </div>

            {/* ── Validation Report ── */}
            <div className="bg-white border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[hsl(214,20%,88%)] flex items-center gap-2">
                <Icon name="ClipboardListIcon" size={15} className="text-[#8B1A2B]" />
                <h3 className="text-sm font-semibold text-[hsl(215,25%,18%)]">Validation Report &amp; Next Steps</h3>
              </div>
              <div className="divide-y divide-[hsl(214,20%,88%)]">

                {/* ── Row 1: Import result ── */}
                <div className="px-5 py-4 flex items-start gap-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${summary.success === summary.totalRows ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                    <Icon name={summary.success === summary.totalRows ? 'CheckCircleIcon' : 'AlertTriangleIcon'} size={16} className={summary.success === summary.totalRows ? 'text-emerald-600' : 'text-amber-600'} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">
                      {summary.success.toLocaleString()} of {summary.totalRows.toLocaleString()} rows imported
                    </p>
                    <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">
                      {summary.success === summary.totalRows
                        ? 'All rows were written to the database successfully.'
                        : `${summary.skipped} row${summary.skipped !== 1 ? 's' : ''} were skipped${importMode === 'skip' ? ' because they already exist in the database (insert-only mode)' : ''}.`}
                    </p>
                    {summary.skipped > 0 && importMode === 'skip' && (
                      <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                        <Icon name="InfoIcon" size={11} />
                        Switch to <strong>Upsert mode</strong> on the next upload to update existing records instead of skipping them.
                      </p>
                    )}
                  </div>
                  <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${summary.success === summary.totalRows ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {summary.success === summary.totalRows ? 'All clear' : `${summary.skipped} skipped`}
                  </span>
                </div>

                {/* ── Row 2: Failed batches ── */}
                <div className="px-5 py-4 flex items-start gap-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${summary.errors.length === 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
                    <Icon name={summary.errors.length === 0 ? 'CheckCircleIcon' : 'XCircleIcon'} size={16} className={summary.errors.length === 0 ? 'text-emerald-600' : 'text-red-600'} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">
                      {summary.errors.length === 0 ? 'No batch errors' : `${summary.errors.length} batch${summary.errors.length !== 1 ? 'es' : ''} failed`}
                    </p>
                    <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">
                      {summary.errors.length === 0
                        ? 'All batches completed without database errors.'
                        : 'Some rows could not be written due to database errors. See error details below.'}
                    </p>
                    {summary.errors.length > 0 && (
                      <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                        <Icon name="AlertCircleIcon" size={11} />
                        Review the error messages below, fix any data issues in your CSV, and re-upload the affected rows.
                      </p>
                    )}
                  </div>
                  <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${summary.errors.length === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {summary.errors.length === 0 ? 'No errors' : `${summary.errors.length} error${summary.errors.length !== 1 ? 's' : ''}`}
                  </span>
                </div>

                {/* ── Row 3: Building codes not found ── */}
                {(() => {
                  const unmapped = preImportSummary?.unmappedPrefixes ?? [];
                  return (
                    <div className="px-5 py-4 flex items-start gap-4">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${unmapped.length === 0 ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                        <Icon name={unmapped.length === 0 ? 'CheckCircleIcon' : 'AlertTriangleIcon'} size={16} className={unmapped.length === 0 ? 'text-emerald-600' : 'text-amber-600'} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">
                          {unmapped.length === 0 ? 'All building codes resolved' : `${unmapped.length} building code prefix${unmapped.length !== 1 ? 'es' : ''} not found`}
                        </p>
                        {unmapped.length === 0 ? (
                          <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">Every short code prefix in this file is mapped to a building name.</p>
                        ) : (
                          <>
                            <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">
                              Properties with these prefixes were imported but their <strong>building_name</strong> field is blank.
                            </p>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {unmapped.map((p) => (
                                <span key={p} className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-mono rounded-md border border-amber-300">{p}</span>
                              ))}
                            </div>
                            <Link href="/building-codes" className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-[#8B1A2B] hover:underline">
                              <Icon name="ExternalLinkIcon" size={11} />
                              Add missing codes in Building Code Mapper →
                            </Link>
                          </>
                        )}
                      </div>
                      <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${unmapped.length === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {unmapped.length === 0 ? 'All mapped' : `${unmapped.length} unmapped`}
                      </span>
                    </div>
                  );
                })()}

              </div>
            </div>

            {/* Batch result grid */}
            <div className="bg-white border border-[hsl(214,20%,88%)] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-[hsl(215,25%,18%)] mb-4">Batch Results</h3>
              <div className="grid grid-cols-8 gap-2 sm:grid-cols-10 md:grid-cols-12">
                {batches.map((b) => (
                  <div
                    key={b.batchNum}
                    title={`Batch ${b.batchNum}: rows ${b.start}\u2013${b.end}${b.error ? ` \u2014 ${b.error}` : ''}`}
                    className={`h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                      b.status === 'success' ? 'bg-emerald-100 text-emerald-700' :
                      b.status === 'error'? 'bg-red-100 text-red-700' : 'bg-[hsl(210,15%,94%)] text-[hsl(215,15%,52%)]'
                    }`}
                  >
                    {b.status === 'success' ? <Icon name="CheckIcon" size={12} /> : <Icon name="XIcon" size={12} />}
                  </div>
                ))}
              </div>
            </div>

            {/* Error details */}
            {summary.errors.length > 0 && (
              <div className="bg-white border border-red-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 bg-red-50 border-b border-red-200 flex items-center gap-2">
                  <Icon name="AlertCircleIcon" size={16} className="text-red-600" />
                  <h3 className="text-sm font-semibold text-red-800">Error Details ({summary.errors.length} failed batch{summary.errors.length > 1 ? 'es' : ''})</h3>
                </div>
                <ul className="divide-y divide-[hsl(214,20%,88%)] max-h-64 overflow-y-auto">
                  {summary.errors.map((err, i) => (
                    <li key={i} className="px-5 py-3 flex items-start gap-3">
                      <Icon name="XCircleIcon" size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                      <span className="text-xs text-[hsl(215,25%,18%)] font-mono">{err}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 justify-end">
              <Link
                href="/import-history"
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[hsl(215,15%,52%)] border border-[hsl(214,20%,88%)] rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors"
              >
                <Icon name="HistoryIcon" size={15} />
                View Import History
              </Link>
              <Link
                href="/property-management"
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[hsl(215,15%,52%)] border border-[hsl(214,20%,88%)] rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors"
              >
                <Icon name="BuildingIcon" size={15} />
                View Properties
              </Link>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#8B1A2B] text-white text-sm font-semibold rounded-lg hover:bg-[#7a1726] transition-colors"
              >
                <Icon name="UploadCloudIcon" size={15} />
                Upload Another File
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Clear Confirmation Modal ── */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="bg-red-50 border-b border-red-200 px-6 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <Icon name="AlertTriangleIcon" size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-red-800">Clear All Properties?</h3>
                <p className="text-xs text-red-600 mt-0.5">This action cannot be undone</p>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-[hsl(215,25%,18%)] mb-3">
                This will <strong>permanently delete all existing properties</strong> from the database, then import the <strong>{parsedRows.length.toLocaleString()} rows</strong> from your CSV as the fresh source of truth.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800 flex items-start gap-2">
                <Icon name="InfoIcon" size={13} className="flex-shrink-0 mt-0.5" />
                <span>All property records, including their status, pricing, and metadata, will be removed before the new data is written. Related records (contacts, documents, enquiries) linked to deleted properties may also be affected.</span>
              </div>
            </div>
            <div className="px-6 pb-5 flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-[hsl(215,15%,52%)] border border-[hsl(214,20%,88%)] rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAndImport}
                disabled={clearing}
                className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {clearing ? (
                  <Icon name="LoaderIcon" size={15} className="animate-spin" />
                ) : (
                  <Icon name="Trash2Icon" size={15} />
                )}
                {clearing ? 'Clearing…' : 'Yes, Clear & Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
