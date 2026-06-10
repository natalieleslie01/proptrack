'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Papa from 'papaparse';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PropertyRow {
  id: string;
  property_ref: string;
  build_year: number | null;
  floor_type: string | null;
  amenities: string | null;
  balcony: boolean;
  pool: boolean;
  garden: boolean;
  roof: boolean;
  terrace: boolean;
  openkitch: boolean;
  combined: boolean;
  duplex: boolean;
  _edited?: boolean;
  _saved?: boolean;
  _error?: string;
}

interface ShortCodeRow {
  building: string;
  short_code: string;
  phase: string;
  village: string;
  build_year: number | null;
}

interface ContactRow {
  short_code: string;
  pid: string;
  contact_role: string;
  contact_person: string;
  contact_number: string;
  contact_email: string;
}

type EditableField = 'build_year' | 'floor_type' | 'balcony' | 'pool' | 'garden' | 'roof' | 'terrace' | 'openkitch' | 'combined' | 'duplex';

type TabMode = 'manual' | 'csv' | 'shortcode' | 'contacts';

const FLOOR_TYPE_OPTIONS = [
  '', 'low floor', 'mid floor', 'high floor', 'ground floor', 'penthouse', 'rooftop',
];

const AMENITY_KEYS: { key: keyof PropertyRow; label: string }[] = [
  { key: 'balcony', label: 'Balcony' },
  { key: 'pool', label: 'Pool' },
  { key: 'garden', label: 'Garden' },
  { key: 'roof', label: 'Roof' },
  { key: 'terrace', label: 'Terrace' },
  { key: 'openkitch', label: 'Open Kitchen' },
  { key: 'combined', label: 'Combined' },
  { key: 'duplex', label: 'Duplex' },
];

// ─── CSV Templates ────────────────────────────────────────────────────────────

function downloadTemplate() {
  const header = 'property_ref,build_year,floor_type,balcony,pool,garden,roof,terrace,openkitch,combined,duplex';
  const example = 'DB-PH1-001,2005,high floor,1,0,1,0,0,0,0,0';
  const blob = new Blob([header + '\n' + example], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bulk_edit_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function downloadShortCodeTemplate() {
  const header = 'Building,Short Code,Phase,Village,Build Year';
  const examples = [
    'Bright Rise,BRI,1,Siena Two,2005',
    'Twin Peaks,TWI,2,Siena One,2008',
    'Seabird Lane,SBL,1,Chianti,2010',
  ].join('\n');
  const blob = new Blob([header + '\n' + examples], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'shortcode_bulk_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function downloadContactsTemplate() {
  const header = 'Short-code,PID,Type,Contact-Person,Contact-Number';
  const examples = [
    'BRI,,Owner,John Smith,+852 9123 4567',
    'BRI,,Secretary,Mary Chan,+852 9234 5678',
    ',DB-PH1-001-01,Owner,Peter Wong,+852 9345 6789',
  ].join('\n');
  const blob = new Blob([header + '\n' + examples], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'contacts_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BulkDataEditorClient() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scFileInputRef = useRef<HTMLInputElement>(null);
  const contactsFileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<TabMode>('manual');
  const [rows, setRows] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResults, setSaveResults] = useState<{ saved: number; errors: number; propertiesUpdated?: number } | null>(null);
  const [filterMissing, setFilterMissing] = useState(true);
  const [searchRef, setSearchRef] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvPreview, setCsvPreview] = useState<PropertyRow[]>([]);
  const [csvFileName, setCsvFileName] = useState('');

  // Short Code CSV state
  const [scDragOver, setScDragOver] = useState(false);
  const [scErrors, setScErrors] = useState<string[]>([]);
  const [scPreview, setScPreview] = useState<ShortCodeRow[]>([]);
  const [scFileName, setScFileName] = useState('');

  // Spreadsheet direct-apply state
  const [applyingSpreadsheet, setApplyingSpreadsheet] = useState(false);
  const [spreadsheetResult, setSpreadsheetResult] = useState<{ totalGroups: number; totalProperties: number; errors: number } | null>(null);

  // Contacts CSV state
  const [contactsDragOver, setContactsDragOver] = useState(false);
  const [contactsErrors, setContactsErrors] = useState<string[]>([]);
  const [contactsPreview, setContactsPreview] = useState<ContactRow[]>([]);
  const [contactsFileName, setContactsFileName] = useState('');
  const [contactsSaveResult, setContactsSaveResult] = useState<{ saved: number; errors: number } | null>(null);

  // ─── Load properties from DB ───────────────────────────────────────────────

  const loadProperties = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('properties')
      .select('id, property_ref, build_year, floor_type, balcony, pool, garden, roof, terrace, openkitch, combined, duplex')
      .order('property_ref', { ascending: true });

    if (error) {
      console.error('Failed to load properties', error);
      setLoading(false);
      return;
    }

    const mapped: PropertyRow[] = (data || []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      property_ref: r.property_ref as string,
      build_year: r.build_year as number | null,
      floor_type: r.floor_type as string | null,
      amenities: null,
      balcony: !!(r.balcony),
      pool: !!(r.pool),
      garden: !!(r.garden),
      roof: !!(r.roof),
      terrace: !!(r.terrace),
      openkitch: !!(r.openkitch),
      combined: !!(r.combined),
      duplex: !!(r.duplex),
    }));

    setRows(mapped);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  // ─── Filter ────────────────────────────────────────────────────────────────

  const displayRows = rows.filter((r) => {
    const matchSearch = !searchRef || r.property_ref?.toLowerCase().includes(searchRef.toLowerCase());
    const matchMissing = !filterMissing || !r.build_year || !r.floor_type;
    return matchSearch && matchMissing;
  });

  // ─── Inline edit ──────────────────────────────────────────────────────────

  function updateRow(id: string, field: EditableField, value: unknown) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value, _edited: true, _saved: false, _error: undefined } : r))
    );
  }

  // ─── Session guard helper ─────────────────────────────────────────────────
  // Returns the current session or throws a descriptive error.
  // Prevents silent failures when auth.uid() is NULL server-side.
  async function requireSession(): Promise<void> {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      throw new Error(
        'No active session — please sign in again before performing bulk updates.'
      );
    }
  }

  // ─── Save all edited rows ─────────────────────────────────────────────────

  async function saveAll() {
    const edited = rows.filter((r) => r._edited && !r._saved);
    if (!edited.length) return;
    setSaving(true);

    try {
      await requireSession();
    } catch (sessionErr) {
      setSaving(false);
      setSaveResults({ saved: 0, errors: edited.length });
      setRows((prev) =>
        prev.map((r) =>
          r._edited && !r._saved
            ? { ...r, _error: (sessionErr as Error).message }
            : r
        )
      );
      return;
    }

    let saved = 0;
    let errors = 0;

    for (const row of edited) {
      const { error, count } = await supabase
        .from('properties')
        .update({
          build_year: row.build_year,
          floor_type: row.floor_type || null,
          balcony: row.balcony,
          pool: row.pool,
          garden: row.garden,
          roof: row.roof,
          terrace: row.terrace,
          openkitch: row.openkitch,
          combined: row.combined,
          duplex: row.duplex,
        })
        .eq('id', row.id)
        .select('id', { count: 'exact', head: true });

      if (error) {
        errors++;
        setRows((prev) =>
          prev.map((r) => (r.id === row.id ? { ...r, _error: error.message } : r))
        );
      } else if ((count ?? 0) === 0) {
        // Silent failure: RLS blocked the update (no session or insufficient role)
        errors++;
        setRows((prev) =>
          prev.map((r) =>
            r.id === row.id
              ? { ...r, _error: 'Update blocked — insufficient permissions or session expired' }
              : r
          )
        );
      } else {
        saved++;
        setRows((prev) =>
          prev.map((r) => (r.id === row.id ? { ...r, _edited: false, _saved: true } : r))
        );
      }
    }

    setSaving(false);
    setSaveResults({ saved, errors });
  }

  // ─── CSV Parsing (property_ref based) ────────────────────────────────────

  function parseCSV(file: File) {
    setCsvErrors([]);
    setCsvPreview([]);
    setCsvFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const errs: string[] = [];
        const parsed: PropertyRow[] = [];

        (results.data as Record<string, string>[]).forEach((row, i) => {
          const ref = row['property_ref']?.trim();
          if (!ref) {
            errs.push(`Row ${i + 2}: missing property_ref`);
            return;
          }

          const buildYearRaw = row['build_year'] || row['build year'] || '';
          const buildYear = buildYearRaw ? parseInt(buildYearRaw, 10) : null;
          if (buildYearRaw && isNaN(buildYear!)) {
            errs.push(`Row ${i + 2} (${ref}): build_year "${buildYearRaw}" is not a valid number`);
          }

          const floorType = row['floor_type']?.trim() || null;

          parsed.push({
            id: ref,
            property_ref: ref,
            build_year: buildYear,
            floor_type: floorType,
            amenities: null,
            balcony: row['balcony'] === '1' || row['balcony']?.toLowerCase() === 'true',
            pool: row['pool'] === '1' || row['pool']?.toLowerCase() === 'true',
            garden: row['garden'] === '1' || row['garden']?.toLowerCase() === 'true',
            roof: row['roof'] === '1' || row['roof']?.toLowerCase() === 'true',
            terrace: row['terrace'] === '1' || row['terrace']?.toLowerCase() === 'true',
            openkitch: row['openkitch'] === '1' || row['openkitch']?.toLowerCase() === 'true',
            combined: row['combined'] === '1' || row['combined']?.toLowerCase() === 'true',
            duplex: row['duplex'] === '1' || row['duplex']?.toLowerCase() === 'true',
            _edited: true,
          });
        });

        setCsvErrors(errs);
        setCsvPreview(parsed);
      },
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) parseCSV(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) parseCSV(file);
  }

  // ─── Apply CSV to DB (property_ref based) ────────────────────────────────

  async function applyCSV() {
    if (!csvPreview.length) return;
    setSaving(true);

    try {
      await requireSession();
    } catch (sessionErr) {
      setSaving(false);
      setSaveResults({ saved: 0, errors: csvPreview.length });
      setCsvErrors([(sessionErr as Error).message]);
      return;
    }

    let saved = 0;
    let errors = 0;

    for (const row of csvPreview) {
      const { error, count } = await supabase
        .from('properties')
        .update({
          build_year: row.build_year,
          floor_type: row.floor_type || null,
          balcony: row.balcony,
          pool: row.pool,
          garden: row.garden,
          roof: row.roof,
          terrace: row.terrace,
          openkitch: row.openkitch,
          combined: row.combined,
          duplex: row.duplex,
        })
        .eq('property_ref', row.property_ref)
        .select('id', { count: 'exact', head: true });

      if (error) {
        errors++;
      } else if ((count ?? 0) === 0) {
        // Silent failure: property_ref not found OR RLS blocked the update
        errors++;
      } else {
        saved++;
      }
    }

    setSaving(false);
    setSaveResults({ saved, errors });
    if (saved > 0) {
      setCsvPreview([]);
      setCsvFileName('');
      loadProperties();
    }
  }

  // ─── Short Code CSV Parsing ───────────────────────────────────────────────

  function parseShortCodeCSV(file: File) {
    setScErrors([]);
    setScPreview([]);
    setScFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const errs: string[] = [];
        const parsed: ShortCodeRow[] = [];

        (results.data as Record<string, string>[]).forEach((row, i) => {
          // Accept "Short Code" or "short_code" or "shortcode" or "ShortCode"
          const shortCode =
            (row['Short Code'] || row['short_code'] || row['shortcode'] || row['ShortCode'] || '').trim();

          if (!shortCode) {
            errs.push(`Row ${i + 2}: missing Short Code`);
            return;
          }

          const building = (row['Building'] || row['building'] || '').trim();
          const phase = (row['Phase'] || row['phase'] || '').trim();
          const village = (row['Village'] || row['village'] || '').trim();

          const buildYearRaw = (row['Build Year'] || row['build_year'] || row['build year'] || '').trim();
          const buildYear = buildYearRaw ? parseInt(buildYearRaw, 10) : null;
          if (buildYearRaw && isNaN(buildYear!)) {
            errs.push(`Row ${i + 2} (${shortCode}): Build Year "${buildYearRaw}" is not a valid number`);
          }

          parsed.push({ building, short_code: shortCode, phase, village, build_year: buildYear });
        });

        setScErrors(errs);
        setScPreview(parsed);
      },
    });
  }

  function handleScFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) parseShortCodeCSV(file);
  }

  function handleScDrop(e: React.DragEvent) {
    e.preventDefault();
    setScDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) parseShortCodeCSV(file);
  }

  // ─── Short Code Parser ────────────────────────────────────────────────────
  // Extracts floor/block number and flat/unit from a short code.
  //
  // Patterns supported:
  //   WGC0011C   → Woodgreen floor 11 flat C       { floor: "11",  unit: "C"  }
  //   SEL00053   → Seabee Lane house 53             { floor: "53",  unit: ""   }
  //   SBL0023G   → Seabird Lane block 23 flat G     { floor: "23",  unit: "G"  }
  //   SN100017   → Siena One house 17               { floor: "17",  unit: ""   }
  //   SN1580GB   → Siena One block 58 ground flat B { floor: "58",  unit: "GB" }
  function parseShortCode(shortCode: string): { floor: string; unit: string } | null {
    if (!shortCode) return null;
    const sc = shortCode.trim().toUpperCase();

    // Pattern 1: PREFIX + DIGITS + LETTERS  (e.g. WGC0011C, SBL0023G, SN1580GB)
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

  // ─── Apply Short Code CSV to DB ───────────────────────────────────────────

  async function applyShortCodeCSV() {
    if (!scPreview.length) return;
    setSaving(true);

    try {
      await requireSession();
    } catch (sessionErr) {
      setSaving(false);
      setSaveResults({ saved: 0, errors: scPreview.length });
      setScErrors([(sessionErr as Error).message]);
      return;
    }

    let shortCodesSaved = 0;
    let errors = 0;
    let totalPropertiesUpdated = 0;

    for (const row of scPreview) {
      // Build update payload — only include non-empty fields
      const updatePayload: Record<string, unknown> = {};
      if (row.build_year !== null) updatePayload.build_year = row.build_year;
      if (row.phase) updatePayload.phase = row.phase;
      if (row.village) updatePayload.village = row.village;
      if (row.building) updatePayload.building_name = row.building;

      // Auto-extract floor and unit from the short code
      const parsed = parseShortCode(row.short_code);
      if (parsed) {
        updatePayload.floor = parsed.floor;
        updatePayload.unit = parsed.unit;
      }

      if (Object.keys(updatePayload).length === 0) continue;

      const { error, count } = await supabase
        .from('properties')
        .update(updatePayload)
        .eq('short_code', row.short_code)
        .select('id', { count: 'exact', head: true });

      if (error) {
        errors++;
      } else if ((count ?? 0) === 0) {
        // Silent failure: no matching short_code OR RLS blocked the update
        errors++;
      } else {
        shortCodesSaved++;
        totalPropertiesUpdated += count ?? 0;
      }
    }

    setSaving(false);
    setSaveResults({ saved: shortCodesSaved, errors, propertiesUpdated: totalPropertiesUpdated });
    if (shortCodesSaved > 0) {
      setScPreview([]);
      setScFileName('');
      loadProperties();
    }
  }

  // ─── Apply Spreadsheet Data directly ─────────────────────────────────────

  async function applySpreadsheetData() {
    setApplyingSpreadsheet(true);
    setSpreadsheetResult(null);
    try {
      const res = await fetch('/api/bulk-update-shortcodes', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSpreadsheetResult({ totalGroups: data.totalGroups, totalProperties: data.totalProperties, errors: data.errors });
        loadProperties();
      } else {
        setSpreadsheetResult({ totalGroups: 0, totalProperties: 0, errors: 1 });
      }
    } catch {
      setSpreadsheetResult({ totalGroups: 0, totalProperties: 0, errors: 1 });
    } finally {
      setApplyingSpreadsheet(false);
    }
  }

  // ─── Contacts CSV Parsing ─────────────────────────────────────────────────

  function parseContactsCSV(file: File) {
    setContactsErrors([]);
    setContactsPreview([]);
    setContactsFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const errs: string[] = [];
        const parsed: ContactRow[] = [];

        (results.data as Record<string, string>[]).forEach((row, i) => {
          // Accept various header spellings
          const shortCode = (
            row['Short-code'] || row['Short Code'] || row['short_code'] || row['shortcode'] || row['ShortCode'] || ''
          ).trim();
          const pid = (row['PID'] || row['pid'] || row['property_ref'] || '').trim();

          if (!shortCode && !pid) {
            errs.push(`Row ${i + 2}: must have either Short Code or PID`);
            return;
          }

          const contactRole = (
            row['Type'] || row['type'] || row['contact_role'] || row['Contact Role'] || 'owner'
          ).trim();
          const contactPerson = (
            row['Contact-Person'] || row['Contact Person'] || row['contact_person'] || ''
          ).trim();
          const contactNumber = (
            row['Contact-Number'] || row['Contact Number'] || row['contact_number'] || ''
          ).trim();
          const contactEmail = (
            row['Contact-Email'] || row['Contact Email'] || row['contact_email'] || row['Email'] || row['email'] || ''
          ).trim();

          if (!contactPerson && !contactNumber) {
            errs.push(`Row ${i + 2}: must have at least Contact-Person or Contact-Number`);
            return;
          }

          parsed.push({ short_code: shortCode, pid, contact_role: contactRole, contact_person: contactPerson, contact_number: contactNumber, contact_email: contactEmail });
        });

        setContactsErrors(errs);
        setContactsPreview(parsed);
      },
    });
  }

  function handleContactsFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) parseContactsCSV(file);
  }

  function handleContactsDrop(e: React.DragEvent) {
    e.preventDefault();
    setContactsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) parseContactsCSV(file);
  }

  // ─── Apply Contacts CSV to DB ─────────────────────────────────────────────

  async function applyContactsCSV() {
    if (!contactsPreview.length) return;
    setSaving(true);
    setContactsSaveResult(null);

    try {
      await requireSession();
    } catch (sessionErr) {
      setSaving(false);
      setContactsSaveResult({ saved: 0, errors: contactsPreview.length });
      setContactsErrors([(sessionErr as Error).message]);
      return;
    }

    let saved = 0;
    let errors = 0;

    for (const row of contactsPreview) {
      const record: Record<string, string> = {
        contact_role: row.contact_role,
        contact_person: row.contact_person,
        contact_number: row.contact_number,
        contact_email: row.contact_email || '',
      };
      if (row.short_code) record.short_code = row.short_code;
      if (row.pid) record.property_ref = row.pid;

      const { error } = await supabase.from('property_contacts').insert(record);
      if (error) errors++;
      else saved++;
    }

    setSaving(false);
    setContactsSaveResult({ saved, errors });
    if (saved > 0) {
      setContactsPreview([]);
      setContactsFileName('');
    }
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  const totalRows = rows.length;
  const missingBuildYear = rows.filter((r) => !r.build_year).length;
  const missingFloorType = rows.filter((r) => !r.floor_type).length;
  const editedCount = rows.filter((r) => r._edited && !r._saved).length;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[hsl(210,20%,97%)]">
      {/* Header */}
      <div className="bg-white border-b border-[hsl(214,20%,88%)] px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-[hsl(215,25%,18%)]">Bulk Data Editor</h1>
            <p className="text-sm text-[hsl(215,15%,52%)] mt-0.5">
              Update missing fields across multiple properties at once
            </p>
          </div>
          <div className="flex items-center gap-2">
            {tab === 'csv' && (
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg hover:bg-[hsl(210,15%,94%)] text-[hsl(215,25%,18%)] transition-colors"
              >
                <Icon name="DownloadIcon" size={15} />
                CSV Template
              </button>
            )}
            {tab === 'shortcode' && (
              <button
                onClick={downloadShortCodeTemplate}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg hover:bg-[hsl(210,15%,94%)] text-[hsl(215,25%,18%)] transition-colors"
              >
                <Icon name="DownloadIcon" size={15} />
                Short Code Template
              </button>
            )}
            {tab === 'contacts' && (
              <button
                onClick={downloadContactsTemplate}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg hover:bg-[hsl(210,15%,94%)] text-[hsl(215,25%,18%)] transition-colors"
              >
                <Icon name="DownloadIcon" size={15} />
                Contacts Template
              </button>
            )}
            {tab === 'manual' && editedCount > 0 && (
              <button
                onClick={saveAll}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[#8B1A2B] text-white rounded-lg hover:bg-[#7a1726] disabled:opacity-60 transition-colors font-medium"
              >
                {saving ? (
                  <Icon name="LoaderIcon" size={15} className="animate-spin" />
                ) : (
                  <Icon name="SaveIcon" size={15} />
                )}
                Save {editedCount} Change{editedCount !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Properties', value: totalRows, icon: 'BuildingIcon', color: 'text-[hsl(215,25%,18%)]' },
          { label: 'Missing Build Year', value: missingBuildYear, icon: 'CalendarIcon', color: 'text-amber-600' },
          { label: 'Missing Floor Type', value: missingFloorType, icon: 'LayersIcon', color: 'text-amber-600' },
          { label: 'Pending Edits', value: editedCount, icon: 'EditIcon', color: 'text-[#8B1A2B]' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-[hsl(214,20%,88%)] px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[hsl(210,15%,94%)] flex items-center justify-center flex-shrink-0">
              <Icon name={s.icon as Parameters<typeof Icon>[0]['name']} size={18} className={s.color} />
            </div>
            <div>
              <p className="text-xs text-[hsl(215,15%,52%)]">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Save result banner */}
      {saveResults && (
        <div className={`mx-6 mb-3 px-4 py-3 rounded-lg flex items-center gap-2 text-sm font-medium ${saveResults.errors === 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
          <Icon name={saveResults.errors === 0 ? 'CheckCircleIcon' : 'AlertTriangleIcon'} size={16} />
          {saveResults.propertiesUpdated !== undefined
            ? `${saveResults.saved} building group${saveResults.saved !== 1 ? 's' : ''} applied — ${saveResults.propertiesUpdated} propert${saveResults.propertiesUpdated !== 1 ? 'ies' : 'y'} updated`
            : `${saveResults.saved} propert${saveResults.saved !== 1 ? 'ies' : 'y'} updated successfully`}
          {saveResults.errors > 0 && `, ${saveResults.errors} failed`}
          <button onClick={() => setSaveResults(null)} className="ml-auto">
            <Icon name="XIcon" size={14} />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="px-6 mb-4">
        <div className="flex gap-1 bg-[hsl(210,15%,94%)] rounded-lg p-1 w-fit flex-wrap">
          {([
            { key: 'manual', label: 'Manual Edit' },
            { key: 'csv', label: 'CSV Upload' },
            { key: 'shortcode', label: 'Short Code CSV' },
            { key: 'contacts', label: 'Contacts CSV' },
          ] as { key: TabMode; label: string }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSaveResults(null); setContactsSaveResult(null); }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-white text-[hsl(215,25%,18%)] shadow-sm'
                  : 'text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── MANUAL TAB ── */}
      {tab === 'manual' && (
        <div className="px-6 pb-8">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative">
              <Icon name="SearchIcon" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(215,15%,52%)]" />
              <input
                type="text"
                placeholder="Search property ref…"
                value={searchRef}
                onChange={(e) => setSearchRef(e.target.value)}
                className="pl-9 pr-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 w-56"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-[hsl(215,25%,18%)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filterMissing}
                onChange={(e) => setFilterMissing(e.target.checked)}
                className="w-4 h-4 rounded accent-[#8B1A2B]"
              />
              Show only rows with missing fields
            </label>
            <span className="text-xs text-[hsl(215,15%,52%)] ml-auto">
              {displayRows.length} of {totalRows} rows
            </span>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16 gap-3 text-[hsl(215,15%,52%)]">
                <Icon name="LoaderIcon" size={20} className="animate-spin" />
                Loading properties…
              </div>
            ) : displayRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-[hsl(215,15%,52%)]">
                <Icon name="CheckCircleIcon" size={32} className="text-emerald-400" />
                <p className="font-medium">No missing fields found</p>
                <p className="text-sm">All properties have build year and floor type filled in.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[hsl(210,15%,94%)] border-b border-[hsl(214,20%,88%)]">
                      <th className="text-left px-4 py-3 font-semibold text-[hsl(215,25%,18%)] whitespace-nowrap">Property Ref</th>
                      <th className="text-left px-4 py-3 font-semibold text-[hsl(215,25%,18%)] whitespace-nowrap">Build Year</th>
                      <th className="text-left px-4 py-3 font-semibold text-[hsl(215,25%,18%)] whitespace-nowrap">Floor Type</th>
                      <th className="text-left px-4 py-3 font-semibold text-[hsl(215,25%,18%)] whitespace-nowrap" colSpan={8}>Amenities</th>
                      <th className="text-left px-4 py-3 font-semibold text-[hsl(215,25%,18%)] whitespace-nowrap">Status</th>
                    </tr>
                    <tr className="bg-[hsl(210,15%,94%)] border-b border-[hsl(214,20%,88%)] text-xs text-[hsl(215,15%,52%)]">
                      <th className="px-4 py-1" />
                      <th className="px-4 py-1" />
                      <th className="px-4 py-1" />
                      {AMENITY_KEYS.map((a) => (
                        <th key={a.key} className="px-2 py-1 font-normal">{a.label}</th>
                      ))}
                      <th className="px-4 py-1" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[hsl(214,20%,88%)]">
                    {displayRows.map((row) => (
                      <tr
                        key={row.id}
                        className={`hover:bg-[hsl(210,15%,97%)] transition-colors ${row._edited && !row._saved ? 'bg-amber-50/40' : ''} ${row._saved ? 'bg-emerald-50/40' : ''}`}
                      >
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold text-[hsl(215,25%,18%)] whitespace-nowrap">
                          {row.property_ref}
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number"
                            min={1900}
                            max={2030}
                            value={row.build_year ?? ''}
                            onChange={(e) =>
                              updateRow(row.id, 'build_year', e.target.value ? parseInt(e.target.value, 10) : null)
                            }
                            placeholder="e.g. 2005"
                            className={`w-24 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 ${
                              !row.build_year ? 'border-amber-300 bg-amber-50' : 'border-[hsl(214,20%,88%)]'
                            }`}
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <select
                            value={row.floor_type ?? ''}
                            onChange={(e) => updateRow(row.id, 'floor_type', e.target.value || null)}
                            className={`w-36 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 ${
                              !row.floor_type ? 'border-amber-300 bg-amber-50' : 'border-[hsl(214,20%,88%)]'
                            }`}
                          >
                            {FLOOR_TYPE_OPTIONS.map((o) => (
                              <option key={o} value={o}>{o || '— select —'}</option>
                            ))}
                          </select>
                        </td>
                        {AMENITY_KEYS.map((a) => (
                          <td key={a.key} className="px-2 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={!!(row[a.key as keyof PropertyRow])}
                              onChange={(e) => updateRow(row.id, a.key as EditableField, e.target.checked)}
                              className="w-4 h-4 rounded accent-[#8B1A2B] cursor-pointer"
                            />
                          </td>
                        ))}
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {row._error ? (
                            <span className="inline-flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                              <Icon name="AlertCircleIcon" size={11} /> Error
                            </span>
                          ) : row._saved ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                              <Icon name="CheckIcon" size={11} /> Saved
                            </span>
                          ) : row._edited ? (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                              <Icon name="EditIcon" size={11} /> Edited
                            </span>
                          ) : (
                            <span className="text-xs text-[hsl(215,15%,52%)]">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {editedCount > 0 && (
            <div className="mt-4 flex items-center justify-between bg-white border border-[hsl(214,20%,88%)] rounded-xl px-5 py-3">
              <p className="text-sm text-[hsl(215,25%,18%)]">
                <span className="font-semibold text-[#8B1A2B]">{editedCount}</span> unsaved change{editedCount !== 1 ? 's' : ''}
              </p>
              <button
                onClick={saveAll}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-[#8B1A2B] text-white text-sm font-medium rounded-lg hover:bg-[#7a1726] disabled:opacity-60 transition-colors"
              >
                {saving ? <Icon name="LoaderIcon" size={15} className="animate-spin" /> : <Icon name="SaveIcon" size={15} />}
                Save All Changes
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── CSV TAB ── */}
      {tab === 'csv' && (
        <div className="px-6 pb-8 space-y-5">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 text-sm text-blue-800">
            <p className="font-semibold mb-1 flex items-center gap-1.5">
              <Icon name="InfoIcon" size={15} /> How to use CSV upload
            </p>
            <ol className="list-decimal list-inside space-y-1 text-blue-700">
              <li>Download the CSV template using the button above</li>
              <li>Fill in <strong>property_ref</strong>, <strong>build_year</strong>, <strong>floor_type</strong>, and amenity flags (1/0)</li>
              <li>Upload the completed CSV — a preview will appear below</li>
              <li>Review the preview, then click <strong>Apply to Database</strong></li>
            </ol>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-[#8B1A2B] bg-[#8B1A2B]/5'
                : 'border-[hsl(214,20%,78%)] hover:border-[#8B1A2B]/50 hover:bg-[hsl(210,15%,97%)]'
            }`}
          >
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
            <Icon name="UploadCloudIcon" size={36} className="mx-auto mb-3 text-[hsl(215,15%,52%)]" />
            {csvFileName ? (
              <p className="font-semibold text-[hsl(215,25%,18%)]">{csvFileName}</p>
            ) : (
              <>
                <p className="font-semibold text-[hsl(215,25%,18%)]">Drop your CSV here or click to browse</p>
                <p className="text-sm text-[hsl(215,15%,52%)] mt-1">Accepts .csv files only</p>
              </>
            )}
          </div>

          {csvErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4">
              <p className="font-semibold text-red-700 mb-2 flex items-center gap-1.5">
                <Icon name="AlertCircleIcon" size={15} /> {csvErrors.length} parsing issue{csvErrors.length !== 1 ? 's' : ''}
              </p>
              <ul className="text-sm text-red-600 space-y-0.5 list-disc list-inside">
                {csvErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {csvPreview.length > 0 && (
            <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-[hsl(214,20%,88%)]">
                <p className="font-semibold text-[hsl(215,25%,18%)]">
                  Preview — {csvPreview.length} row{csvPreview.length !== 1 ? 's' : ''}
                </p>
                <button
                  onClick={applyCSV}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-[#8B1A2B] text-white text-sm font-medium rounded-lg hover:bg-[#7a1726] disabled:opacity-60 transition-colors"
                >
                  {saving ? <Icon name="LoaderIcon" size={14} className="animate-spin" /> : <Icon name="DatabaseIcon" size={14} />}
                  Apply to Database
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[hsl(210,15%,94%)] border-b border-[hsl(214,20%,88%)]">
                      <th className="text-left px-4 py-2.5 font-semibold text-[hsl(215,25%,18%)]">Property Ref</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-[hsl(215,25%,18%)]">Build Year</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-[hsl(215,25%,18%)]">Floor Type</th>
                      {AMENITY_KEYS.map((a) => (
                        <th key={a.key} className="text-left px-3 py-2.5 font-semibold text-[hsl(215,25%,18%)] text-xs">{a.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[hsl(214,20%,88%)]">
                    {csvPreview.map((row, i) => (
                      <tr key={i} className="hover:bg-[hsl(210,15%,97%)]">
                        <td className="px-4 py-2 font-mono text-xs font-semibold">{row.property_ref}</td>
                        <td className="px-4 py-2">
                          {row.build_year ? <span>{row.build_year}</span> : <span className="text-[hsl(215,15%,52%)] italic">—</span>}
                        </td>
                        <td className="px-4 py-2">
                          {row.floor_type ? <span>{row.floor_type}</span> : <span className="text-[hsl(215,15%,52%)] italic">—</span>}
                        </td>
                        {AMENITY_KEYS.map((a) => (
                          <td key={a.key} className="px-3 py-2 text-center">
                            {row[a.key as keyof PropertyRow] ? (
                              <Icon name="CheckIcon" size={14} className="text-emerald-600 mx-auto" />
                            ) : (
                              <span className="text-[hsl(215,15%,52%)]">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SHORT CODE CSV TAB ── */}
      {tab === 'shortcode' && (
        <div className="px-6 pb-8 space-y-5">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 text-sm text-blue-800">
            <p className="font-semibold mb-1 flex items-center gap-1.5">
              <Icon name="InfoIcon" size={15} /> How to use Short Code CSV upload
            </p>
            <ol className="list-decimal list-inside space-y-1 text-blue-700">
              <li>Download the Short Code Template using the button above</li>
              <li>Your CSV must have these columns: <strong>Building</strong>, <strong>Short Code</strong>, <strong>Phase</strong>, <strong>Village</strong>, <strong>Build Year</strong></li>
              <li>Each row represents one building group — all properties sharing that Short Code will be updated</li>
              <li>Upload the CSV, review the preview, then click <strong>Apply to Database</strong></li>
            </ol>
            <p className="mt-2 text-blue-600 text-xs">
              Tip: Leave a field blank if you don&apos;t want to overwrite it. Only non-empty values are applied.
            </p>
          </div>

          {/* ── One-click spreadsheet apply ── */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="font-semibold text-emerald-800 flex items-center gap-1.5 mb-1">
                  <Icon name="ZapIcon" size={15} />
                  Apply Uploaded Spreadsheet Data
                </p>
                <p className="text-sm text-emerald-700">
                  Instantly apply all Phase, Village &amp; Build Year values from the uploaded spreadsheet (75 building groups) to every matching property in the database.
                </p>
              </div>
              <button
                onClick={applySpreadsheetData}
                disabled={applyingSpreadsheet}
                className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-emerald-700 text-white text-sm font-semibold rounded-lg hover:bg-emerald-800 disabled:opacity-60 transition-colors"
              >
                {applyingSpreadsheet ? (
                  <Icon name="LoaderIcon" size={15} className="animate-spin" />
                ) : (
                  <Icon name="DatabaseIcon" size={15} />
                )}
                {applyingSpreadsheet ? 'Applying…' : 'Apply All Now'}
              </button>
            </div>
            {spreadsheetResult && (
              <div className={`mt-3 flex items-center gap-2 text-sm font-medium ${spreadsheetResult.errors === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                <Icon name={spreadsheetResult.errors === 0 ? 'CheckCircleIcon' : 'AlertTriangleIcon'} size={15} />
                {spreadsheetResult.totalGroups} building group{spreadsheetResult.totalGroups !== 1 ? 's' : ''} applied — {spreadsheetResult.totalProperties} propert{spreadsheetResult.totalProperties !== 1 ? 'ies' : 'y'} updated
                {spreadsheetResult.errors > 0 && `, ${spreadsheetResult.errors} group${spreadsheetResult.errors !== 1 ? 's' : ''} failed`}
              </div>
            )}
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setScDragOver(true); }}
            onDragLeave={() => setScDragOver(false)}
            onDrop={handleScDrop}
            onClick={() => scFileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              scDragOver
                ? 'border-[#8B1A2B] bg-[#8B1A2B]/5'
                : 'border-[hsl(214,20%,78%)] hover:border-[#8B1A2B]/50 hover:bg-[hsl(210,15%,97%)]'
            }`}
          >
            <input ref={scFileInputRef} type="file" accept=".csv" className="hidden" onChange={handleScFileChange} />
            <Icon name="UploadCloudIcon" size={36} className="mx-auto mb-3 text-[hsl(215,15%,52%)]" />
            {scFileName ? (
              <p className="font-semibold text-[hsl(215,25%,18%)]">{scFileName}</p>
            ) : (
              <>
                <p className="font-semibold text-[hsl(215,25%,18%)]">Drop your Short Code CSV here or click to browse</p>
                <p className="text-sm text-[hsl(215,15%,52%)] mt-1">Accepts .csv files only</p>
              </>
            )}
          </div>

          {/* Errors */}
          {scErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4">
              <p className="font-semibold text-red-700 mb-2 flex items-center gap-1.5">
                <Icon name="AlertCircleIcon" size={15} /> {scErrors.length} parsing issue{scErrors.length !== 1 ? 's' : ''}
              </p>
              <ul className="text-sm text-red-600 space-y-0.5 list-disc list-inside">
                {scErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {/* Preview */}
          {scPreview.length > 0 && (
            <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-[hsl(214,20%,88%)]">
                <div>
                  <p className="font-semibold text-[hsl(215,25%,18%)]">
                    Preview — {scPreview.length} building group{scPreview.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">
                    All properties matching each Short Code will be updated
                  </p>
                </div>
                <button
                  onClick={applyShortCodeCSV}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-[#8B1A2B] text-white text-sm font-medium rounded-lg hover:bg-[#7a1726] disabled:opacity-60 transition-colors"
                >
                  {saving ? <Icon name="LoaderIcon" size={14} className="animate-spin" /> : <Icon name="DatabaseIcon" size={14} />}
                  Apply to Database
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[hsl(210,15%,94%)] border-b border-[hsl(214,20%,88%)]">
                      <th className="text-left px-4 py-2.5 font-semibold text-[hsl(215,25%,18%)]">Building</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-[hsl(215,25%,18%)]">Short Code</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-[hsl(215,25%,18%)]">Phase</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-[hsl(215,25%,18%)]">Village</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-[hsl(215,25%,18%)]">Build Year</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[hsl(214,20%,88%)]">
                    {scPreview.map((row, i) => (
                      <tr key={i} className="hover:bg-[hsl(210,15%,97%)]">
                        <td className="px-4 py-2.5 text-[hsl(215,25%,18%)]">
                          {row.building || <span className="text-[hsl(215,15%,52%)] italic">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="font-mono text-xs font-semibold bg-[hsl(210,15%,94%)] px-2 py-0.5 rounded text-[hsl(215,25%,18%)]">
                            {row.short_code}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-[hsl(215,25%,18%)]">
                          {row.phase || <span className="text-[hsl(215,15%,52%)] italic">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-[hsl(215,25%,18%)]">
                          {row.village || <span className="text-[hsl(215,15%,52%)] italic">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-[hsl(215,25%,18%)]">
                          {row.build_year ?? <span className="text-[hsl(215,15%,52%)] italic">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CONTACTS CSV TAB ── */}
      {tab === 'contacts' && (
        <div className="px-6 pb-8 space-y-5">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 text-sm text-blue-800">
            <p className="font-semibold mb-1 flex items-center gap-1.5">
              <Icon name="InfoIcon" size={15} /> How to upload contact details
            </p>
            <ol className="list-decimal list-inside space-y-1 text-blue-700">
              <li>Download the Contacts Template using the button above</li>
              <li>Your CSV must have: <strong>Short-code</strong>, <strong>PID</strong>, <strong>Type</strong>, <strong>Contact-Person</strong>, <strong>Contact-Number</strong></li>
              <li><strong>Type</strong> is the contact role — e.g. Owner, Secretary, Sister, Agent, etc.</li>
              <li>Use <strong>Short-code</strong> to link to all units in a building, or <strong>PID</strong> (numeric property identifier, e.g. 10010001) for a specific unit</li>
              <li>Upload the CSV, review the preview, then click <strong>Save Contacts</strong></li>
            </ol>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setContactsDragOver(true); }}
            onDragLeave={() => setContactsDragOver(false)}
            onDrop={handleContactsDrop}
            onClick={() => contactsFileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              contactsDragOver
                ? 'border-[#8B1A2B] bg-[#8B1A2B]/5'
                : 'border-[hsl(214,20%,78%)] hover:border-[#8B1A2B]/50 hover:bg-[hsl(210,15%,97%)]'
            }`}
          >
            <input ref={contactsFileInputRef} type="file" accept=".csv" className="hidden" onChange={handleContactsFileChange} />
            <Icon name="UsersIcon" size={36} className="mx-auto mb-3 text-[hsl(215,15%,52%)]" />
            {contactsFileName ? (
              <p className="font-semibold text-[hsl(215,25%,18%)]">{contactsFileName}</p>
            ) : (
              <>
                <p className="font-semibold text-[hsl(215,25%,18%)]">Drop your Contacts CSV here or click to browse</p>
                <p className="text-sm text-[hsl(215,15%,52%)] mt-1">Accepts .csv files only</p>
              </>
            )}
          </div>

          {/* Errors */}
          {contactsErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4">
              <p className="font-semibold text-red-700 mb-2 flex items-center gap-1.5">
                <Icon name="AlertCircleIcon" size={15} /> {contactsErrors.length} parsing issue{contactsErrors.length !== 1 ? 's' : ''}
              </p>
              <ul className="text-sm text-red-600 space-y-0.5 list-disc list-inside">
                {contactsErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {/* Save result banner */}
          {contactsSaveResult && (
            <div className={`px-4 py-3 rounded-lg flex items-center gap-2 text-sm font-medium ${contactsSaveResult.errors === 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
              <Icon name={contactsSaveResult.errors === 0 ? 'CheckCircleIcon' : 'AlertTriangleIcon'} size={16} />
              {contactsSaveResult.saved} contact{contactsSaveResult.saved !== 1 ? 's' : ''} saved successfully
              {contactsSaveResult.errors > 0 && `, ${contactsSaveResult.errors} failed`}
              <button onClick={() => setContactsSaveResult(null)} className="ml-auto">
                <Icon name="XIcon" size={14} />
              </button>
            </div>
          )}

          {/* Preview */}
          {contactsPreview.length > 0 && (
            <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-[hsl(214,20%,88%)]">
                <div>
                  <p className="font-semibold text-[hsl(215,25%,18%)]">
                    Preview — {contactsPreview.length} contact{contactsPreview.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">Review before saving to database</p>
                </div>
                <button
                  onClick={applyContactsCSV}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-[#8B1A2B] text-white text-sm font-medium rounded-lg hover:bg-[#7a1726] disabled:opacity-60 transition-colors"
                >
                  {saving ? <Icon name="LoaderIcon" size={14} className="animate-spin" /> : <Icon name="UserPlusIcon" size={14} />}
                  Save Contacts
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[hsl(210,15%,94%)] border-b border-[hsl(214,20%,88%)]">
                      <th className="text-left px-4 py-2.5 font-semibold text-[hsl(215,25%,18%)]">Short Code</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-[hsl(215,25%,18%)]">PID</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-[hsl(215,25%,18%)]">Type / Role</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-[hsl(215,25%,18%)]">Contact Person</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-[hsl(215,25%,18%)]">Contact Number</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[hsl(214,20%,88%)]">
                    {contactsPreview.map((row, i) => (
                      <tr key={i} className="hover:bg-[hsl(210,15%,97%)]">
                        <td className="px-4 py-2.5">
                          {row.short_code
                            ? <span className="font-mono text-xs font-semibold bg-[hsl(210,15%,94%)] px-2 py-0.5 rounded text-[hsl(215,25%,18%)]">{row.short_code}</span>
                            : <span className="text-[hsl(215,15%,52%)] italic text-xs">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {row.pid
                            ? <span className="font-mono text-xs font-semibold text-[hsl(215,25%,18%)]">{row.pid}</span>
                            : <span className="text-[hsl(215,15%,52%)] italic text-xs">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 capitalize">
                            {row.contact_role}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-[hsl(215,25%,18%)]">
                          {row.contact_person || <span className="text-[hsl(215,15%,52%)] italic">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-[hsl(215,25%,18%)]">
                          {row.contact_number || <span className="text-[hsl(215,15%,52%)] italic">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
