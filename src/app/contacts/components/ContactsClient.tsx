'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PropertyContact {
  id: string;
  property_ref: string | null;
  short_code: string | null;
  contact_role: string;
  contact_person: string;
  contact_number: string;
  contact_email: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface PropertyGroup {
  short_code: string;
  property_ref: string | null;
  contacts: PropertyContact[];
}

interface CsvRow {
  short_code: string;
  property_ref?: string;
  contact_person: string;
  contact_number?: string;
  contact_email?: string;
  contact_role?: string;
  notes?: string;
}

interface ImportResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

const CONTACT_ROLES = ['Decision Maker', 'Tenant', 'Landlord', 'Owner'] as const;
type ContactRole = (typeof CONTACT_ROLES)[number];

const ROLE_COLORS: Record<string, string> = {
  'Decision Maker': 'bg-purple-100 text-purple-700 border-purple-200',
  Tenant: 'bg-blue-100 text-blue-700 border-blue-200',
  Landlord: 'bg-amber-100 text-amber-700 border-amber-200',
  Owner: 'bg-green-100 text-green-700 border-green-200',
  owner: 'bg-green-100 text-green-700 border-green-200',
};

function getRoleColor(role: string): string {
  return ROLE_COLORS[role] || 'bg-gray-100 text-gray-600 border-gray-200';
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function detectDelimiter(firstLine: string): string {
  const counts: Record<string, number> = { ',': 0, '\t': 0, ';': 0, '|': 0 };
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (!inQuotes && ch in counts) counts[ch]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function splitLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    if (ch === '"') {
      if (inQuotes && line[j + 1] === '"') {
        current += '"';
        j++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current.trim());
  return values;
}

function parseCsv(text: string): CsvRow[] {
  // Strip BOM if present
  const cleanText = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleanText.split('\n');

  // Find first non-empty line as header
  let headerLineIdx = 0;
  while (headerLineIdx < lines.length && !lines[headerLineIdx].trim()) headerLineIdx++;
  if (headerLineIdx >= lines.length - 1) return [];

  const headerLine = lines[headerLineIdx];
  const delimiter = detectDelimiter(headerLine);

  const rawHeaders = splitLine(headerLine, delimiter);
  const headers = rawHeaders.map((h) =>
    h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  );

  // Detect numbered indices once from headers (not per-row)
  const numberedIndices = new Set<number>();
  headers.forEach((h) => {
    const m = h.match(/^contact_(?:person|number|email|role|name)(\d+)$/);
    if (m) numberedIndices.add(parseInt(m[1], 10));
  });
  const sortedNumberedIndices = Array.from(numberedIndices).sort((a, b) => a - b);
  const hasNumberedColumns = numberedIndices.size > 0;

  const rows: CsvRow[] = [];

  for (let i = headerLineIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = splitLine(line, delimiter);

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || '').trim();
    });

    const shortCode = row['short_code'] || row['shortcode'] || row['short_code_'] || row['short code'] || '';
    if (!shortCode) continue;

    const propertyRef = row['property_ref'] || row['pid'] || row['property_id'] || undefined;
    const notes = row['notes'] || row['note'] || '';

    if (hasNumberedColumns) {
      // Numbered columns mode — emit one row per numbered index that has a name
      let addedAny = false;
      for (const idx of sortedNumberedIndices) {
        const contactPerson =
          row[`contact_person${idx}`] ||
          row[`contact_name${idx}`] ||
          row[`name${idx}`] ||
          '';
        if (!contactPerson) continue;

        rows.push({
          short_code: shortCode,
          property_ref: propertyRef,
          contact_person: contactPerson,
          contact_number: row[`contact_number${idx}`] || row[`phone${idx}`] || row[`mobile${idx}`] || '',
          contact_email: row[`contact_email${idx}`] || row[`email${idx}`] || '',
          contact_role: row[`contact_role${idx}`] || row[`role${idx}`] || 'owner',
          notes: row[`notes${idx}`] || notes || '',
        });
        addedAny = true;
      }

      // Also check for an un-numbered contact_person on the same row
      const basePerson = row['contact_person'] || row['name'] || row['contact_name'] || row['full_name'] || '';
      if (basePerson) {
        rows.push({
          short_code: shortCode,
          property_ref: propertyRef,
          contact_person: basePerson,
          contact_number: row['contact_number'] || row['phone'] || row['mobile'] || row['number'] || '',
          contact_email: row['contact_email'] || row['email'] || '',
          contact_role: row['contact_role'] || row['role'] || row['type'] || 'owner',
          notes: notes || '',
        });
        addedAny = true;
      }

      // If no numbered or base contact found, try any column that looks like a name
      if (!addedAny) continue;
    } else {
      // Standard single-contact-per-row mode
      const contactPerson =
        row['contact_person'] ||
        row['name'] ||
        row['contact_name'] ||
        row['full_name'] ||
        row['person'] ||
        row['contact'] ||
        '';
      if (!contactPerson) continue;

      rows.push({
        short_code: shortCode,
        property_ref: propertyRef,
        contact_person: contactPerson,
        contact_number: row['contact_number'] || row['phone'] || row['mobile'] || row['number'] || row['phone_number'] || '',
        contact_email: row['contact_email'] || row['email'] || row['email_address'] || '',
        contact_role: row['contact_role'] || row['role'] || row['type'] || 'owner',
        notes: notes || '',
      });
    }
  }
  return rows;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ContactsClient() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [contacts, setContacts] = useState<PropertyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShortCode, setSelectedShortCode] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // CSV upload state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<CsvRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showImportPanel, setShowImportPanel] = useState(false);

  // Role edit state
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('property_contacts')
        .select('*')
        .order('short_code', { ascending: true })
        .order('contact_person', { ascending: true });

      if (error) {
        console.error('Error fetching contacts:', error.message);
        setContacts([]);
      } else {
        setContacts(data || []);
      }
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // ─── Grouped by short_code ──────────────────────────────────────────────────

  const propertyGroups: PropertyGroup[] = React.useMemo(() => {
    const map = new Map<string, PropertyGroup>();
    contacts.forEach((c) => {
      const key = c.short_code || c.property_ref || 'Unknown';
      if (!map.has(key)) {
        map.set(key, { short_code: key, property_ref: c.property_ref, contacts: [] });
      }
      map.get(key)!.contacts.push(c);
    });
    return Array.from(map.values());
  }, [contacts]);

  const filteredGroups = React.useMemo(() => {
    if (!search.trim()) return propertyGroups;
    const q = search.toLowerCase();
    return propertyGroups.filter(
      (g) =>
        g.short_code.toLowerCase().includes(q) ||
        g.property_ref?.toLowerCase().includes(q) ||
        g.contacts.some(
          (c) =>
            c.contact_person.toLowerCase().includes(q) ||
            c.contact_number.toLowerCase().includes(q) ||
            c.contact_email.toLowerCase().includes(q)
        )
    );
  }, [propertyGroups, search]);

  const selectedGroup = selectedShortCode
    ? filteredGroups.find((g) => g.short_code === selectedShortCode) || null
    : null;

  // ─── CSV Handling ────────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      // Debug: log first 500 chars and line count
      const cleanText = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const lines = cleanText.split('\n').filter(l => l.trim());
      console.log('[CSV Debug] File:', file.name, '| Lines:', lines.length);
      console.log('[CSV Debug] Header line:', lines[0]);
      console.log('[CSV Debug] First data line:', lines[1]);
      const rows = parseCsv(text);
      console.log('[CSV Debug] Parsed rows:', rows.length, rows.slice(0, 3));
      setCsvPreview(rows);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvPreview.length) return;
    setImporting(true);
    setImportResult(null);

    const result: ImportResult = { inserted: 0, skipped: 0, errors: [] };

    for (const row of csvPreview) {
      try {
        const { error } = await supabase.from('property_contacts').insert({
          short_code: row.short_code,
          property_ref: row.property_ref || null,
          contact_person: row.contact_person,
          contact_number: row.contact_number || '',
          contact_email: row.contact_email || '',
          contact_role: row.contact_role || 'owner',
          notes: row.notes || null,
        });

        if (error) {
          result.errors.push(`${row.contact_person} (${row.short_code}): ${error.message}`);
          result.skipped++;
        } else {
          result.inserted++;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push(`${row.contact_person}: ${msg}`);
        result.skipped++;
      }
    }

    setImportResult(result);
    setImporting(false);

    if (result.inserted > 0) {
      await fetchContacts();
      setCsvFile(null);
      setCsvPreview([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClearCsv = () => {
    setCsvFile(null);
    setCsvPreview([]);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── Role Update ─────────────────────────────────────────────────────────────

  const handleRoleChange = async (contactId: string, newRole: string) => {
    setSavingRoleId(contactId);
    try {
      const { error } = await supabase
        .from('property_contacts')
        .update({ contact_role: newRole, updated_at: new Date().toISOString() })
        .eq('id', contactId);

      if (!error) {
        setContacts((prev) =>
          prev.map((c) => (c.id === contactId ? { ...c, contact_role: newRole } : c))
        );
      }
    } finally {
      setSavingRoleId(null);
      setEditingRoleId(null);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full min-h-0 bg-[hsl(210,20%,97%)]">
      {/* Left Panel — Property List */}
      <div className="w-72 flex-shrink-0 bg-white border-r border-[hsl(214,20%,88%)] flex flex-col">
        {/* Header */}
        <div className="px-4 py-4 border-b border-[hsl(214,20%,88%)]">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-base font-bold text-[hsl(215,25%,18%)]">Contacts</h1>
            <button
              onClick={() => { setShowImportPanel(!showImportPanel); setSelectedShortCode(null); }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#8B1A2B] text-white text-xs font-semibold rounded-lg hover:bg-[#7a1626] transition-colors"
            >
              <Icon name="CloudArrowUpIcon" size={14} />
              Import CSV
            </button>
          </div>
          <div className="relative">
            <Icon name="MagnifyingGlassIcon" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(215,15%,52%)]" />
            <input
              type="text"
              placeholder="Search properties or contacts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-[hsl(214,20%,88%)] rounded-lg bg-[hsl(210,15%,97%)] focus:outline-none focus:ring-1 focus:ring-[#8B1A2B]/30 focus:border-[#8B1A2B]/50"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="px-4 py-2 border-b border-[hsl(214,20%,88%)] bg-[hsl(210,15%,97%)]">
          <p className="text-xs text-[hsl(215,15%,52%)]">
            <span className="font-semibold text-[hsl(215,25%,18%)]">{filteredGroups.length}</span> properties ·{' '}
            <span className="font-semibold text-[hsl(215,25%,18%)]">{contacts.length}</span> contacts
          </p>
        </div>

        {/* Property List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-[#8B1A2B] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Icon name="UsersIcon" size={32} className="text-[hsl(215,15%,72%)] mb-2" />
              <p className="text-sm font-medium text-[hsl(215,25%,18%)]">No contacts yet</p>
              <p className="text-xs text-[hsl(215,15%,52%)] mt-1">Upload a CSV to get started</p>
            </div>
          ) : (
            filteredGroups.map((group) => {
              const isActive = selectedShortCode === group.short_code;
              return (
                <button
                  key={group.short_code}
                  onClick={() => { setSelectedShortCode(group.short_code); setShowImportPanel(false); }}
                  className={`w-full text-left px-4 py-3 border-b border-[hsl(214,20%,88%)] transition-colors ${
                    isActive
                      ? 'bg-[#8B1A2B]/5 border-l-2 border-l-[#8B1A2B]'
                      : 'hover:bg-[hsl(210,15%,96%)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[hsl(215,25%,18%)] truncate">{group.short_code}</span>
                    <span className="ml-2 flex-shrink-0 text-xs bg-[hsl(210,15%,92%)] text-[hsl(215,15%,42%)] px-1.5 py-0.5 rounded-full font-medium">
                      {group.contacts.length}
                    </span>
                  </div>
                  {group.property_ref && (
                    <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5 truncate">{group.property_ref}</p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {group.contacts.slice(0, 3).map((c) => (
                      <span
                        key={c.id}
                        className={`text-xs px-1.5 py-0.5 rounded border font-medium ${getRoleColor(c.contact_role)}`}
                      >
                        {c.contact_role}
                      </span>
                    ))}
                    {group.contacts.length > 3 && (
                      <span className="text-xs text-[hsl(215,15%,52%)]">+{group.contacts.length - 3}</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* ── CSV Import Panel ── */}
        {showImportPanel && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
                <div className="px-6 py-4 border-b border-[hsl(214,20%,88%)] bg-[hsl(210,15%,97%)]">
                  <h2 className="text-base font-bold text-[hsl(215,25%,18%)]">Import Contacts from CSV</h2>
                  <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">
                    CSV must include <code className="bg-[hsl(210,15%,92%)] px-1 rounded">short_code</code>.
                    Supports numbered contact columns per row:{' '}
                    <code className="bg-[hsl(210,15%,92%)] px-1 rounded">contact_person1</code>,{' '}
                    <code className="bg-[hsl(210,15%,92%)] px-1 rounded">contact_number1</code>,{' '}
                    <code className="bg-[hsl(210,15%,92%)] px-1 rounded">contact_person2</code>,{' '}
                    <code className="bg-[hsl(210,15%,92%)] px-1 rounded">contact_number2</code>, … — each pair is imported as a separate contact.
                    Also supports single-contact columns:{' '}
                    <code className="bg-[hsl(210,15%,92%)] px-1 rounded">contact_person</code>,{' '}
                    <code className="bg-[hsl(210,15%,92%)] px-1 rounded">contact_number</code>,{' '}
                    <code className="bg-[hsl(210,15%,92%)] px-1 rounded">contact_email</code>,{' '}
                    <code className="bg-[hsl(210,15%,92%)] px-1 rounded">contact_role</code>.
                  </p>
                </div>

                <div className="p-6 space-y-5">
                  {/* Drop zone */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-[hsl(214,20%,82%)] rounded-xl p-8 text-center cursor-pointer hover:border-[#8B1A2B]/40 hover:bg-[#8B1A2B]/2 transition-colors"
                  >
                    <Icon name="DocumentArrowUpIcon" size={36} className="mx-auto text-[hsl(215,15%,62%)] mb-3" />
                    {csvFile ? (
                      <div>
                        <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">{csvFile.name}</p>
                        <p className="text-xs text-[hsl(215,15%,52%)] mt-1">{csvPreview.length} contact records detected</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">Click to select a CSV file</p>
                        <p className="text-xs text-[hsl(215,15%,52%)] mt-1">or drag and drop</p>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>

                  {/* Preview table */}
                  {csvPreview.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-[hsl(215,15%,42%)] uppercase tracking-wide mb-2">
                        Preview — first {Math.min(csvPreview.length, 10)} of {csvPreview.length} rows
                      </p>
                      <div className="overflow-x-auto rounded-lg border border-[hsl(214,20%,88%)]">
                        <table className="w-full text-xs">
                          <thead className="bg-[hsl(210,15%,96%)]">
                            <tr>
                              {['Short Code', 'Contact Person', 'Phone', 'Email', 'Role'].map((h) => (
                                <th key={h} className="px-3 py-2 text-left font-semibold text-[hsl(215,15%,42%)] whitespace-nowrap">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {csvPreview.slice(0, 10).map((row, idx) => (
                              <tr key={idx} className="border-t border-[hsl(214,20%,88%)]">
                                <td className="px-3 py-2 font-medium text-[hsl(215,25%,18%)]">{row.short_code}</td>
                                <td className="px-3 py-2 text-[hsl(215,25%,28%)]">{row.contact_person}</td>
                                <td className="px-3 py-2 text-[hsl(215,15%,42%)]">{row.contact_number || '—'}</td>
                                <td className="px-3 py-2 text-[hsl(215,15%,42%)]">{row.contact_email || '—'}</td>
                                <td className="px-3 py-2">
                                  <span className={`px-1.5 py-0.5 rounded border text-xs font-medium ${getRoleColor(row.contact_role || 'owner')}`}>
                                    {row.contact_role || 'owner'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Import result */}
                  {importResult && (
                    <div className={`rounded-lg p-4 border ${importResult.errors.length === 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Icon
                          name={importResult.errors.length === 0 ? 'CheckCircleIcon' : 'ExclamationTriangleIcon'}
                          size={16}
                          className={importResult.errors.length === 0 ? 'text-green-600' : 'text-amber-600'}
                        />
                        <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">
                          Import complete: {importResult.inserted} inserted, {importResult.skipped} skipped
                        </p>
                      </div>
                      {importResult.errors.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {importResult.errors.slice(0, 5).map((e, i) => (
                            <li key={i} className="text-xs text-amber-700">{e}</li>
                          ))}
                          {importResult.errors.length > 5 && (
                            <li className="text-xs text-amber-600">…and {importResult.errors.length - 5} more</li>
                          )}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleImport}
                      disabled={csvPreview.length === 0 || importing}
                      className="flex items-center gap-2 px-4 py-2 bg-[#8B1A2B] text-white text-sm font-semibold rounded-lg hover:bg-[#7a1626] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {importing ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Icon name="CloudArrowUpIcon" size={16} />
                      )}
                      {importing ? 'Importing…' : `Import ${csvPreview.length} Contacts`}
                    </button>
                    {csvFile && (
                      <button
                        onClick={handleClearCsv}
                        className="px-3 py-2 text-sm text-[hsl(215,15%,42%)] hover:text-[hsl(215,25%,18%)] transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Property Contacts Detail ── */}
        {!showImportPanel && selectedGroup && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto space-y-4">
              {/* Property header */}
              <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#8B1A2B]/10 flex items-center justify-center flex-shrink-0">
                    <Icon name="BuildingOffice2Icon" size={20} className="text-[#8B1A2B]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[hsl(215,25%,18%)]">{selectedGroup.short_code}</h2>
                    {selectedGroup.property_ref && (
                      <p className="text-sm text-[hsl(215,15%,52%)]">Ref: {selectedGroup.property_ref}</p>
                    )}
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-2xl font-bold text-[#8B1A2B]">{selectedGroup.contacts.length}</p>
                    <p className="text-xs text-[hsl(215,15%,52%)]">contact{selectedGroup.contacts.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              </div>

              {/* Contact cards */}
              <div className="space-y-3">
                {selectedGroup.contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="bg-white rounded-xl border border-[hsl(214,20%,88%)] px-5 py-4"
                  >
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-[hsl(210,15%,92%)] flex items-center justify-center flex-shrink-0 text-sm font-bold text-[hsl(215,25%,38%)]">
                        {contact.contact_person.charAt(0).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">{contact.contact_person}</p>
                          {/* Role badge / selector */}
                          {editingRoleId === contact.id ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {CONTACT_ROLES.map((role) => (
                                <button
                                  key={role}
                                  onClick={() => handleRoleChange(contact.id, role)}
                                  disabled={savingRoleId === contact.id}
                                  className={`px-2 py-0.5 rounded border text-xs font-medium transition-all ${
                                    contact.contact_role === role
                                      ? getRoleColor(role) + 'ring-1 ring-offset-1 ring-current' :'bg-white border-[hsl(214,20%,82%)] text-[hsl(215,15%,42%)] hover:border-[hsl(214,20%,62%)]'
                                  }`}
                                >
                                  {savingRoleId === contact.id && contact.contact_role === role ? (
                                    <span className="flex items-center gap-1">
                                      <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin inline-block" />
                                      {role}
                                    </span>
                                  ) : role}
                                </button>
                              ))}
                              <button
                                onClick={() => setEditingRoleId(null)}
                                className="text-xs text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)] px-1"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setEditingRoleId(contact.id)}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium transition-all hover:opacity-80 ${getRoleColor(contact.contact_role)}`}
                              title="Click to change role"
                            >
                              {contact.contact_role}
                              <Icon name="PencilSquareIcon" size={10} className="opacity-60" />
                            </button>
                          )}
                        </div>

                        {/* Contact details */}
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                          {contact.contact_number && (
                            <a
                              href={`tel:${contact.contact_number}`}
                              className="flex items-center gap-1.5 text-xs text-[hsl(215,15%,42%)] hover:text-[#8B1A2B] transition-colors"
                            >
                              <Icon name="PhoneIcon" size={12} />
                              {contact.contact_number}
                            </a>
                          )}
                          {contact.contact_email && (
                            <a
                              href={`mailto:${contact.contact_email}`}
                              className="flex items-center gap-1.5 text-xs text-[hsl(215,15%,42%)] hover:text-[#8B1A2B] transition-colors"
                            >
                              <Icon name="EnvelopeIcon" size={12} />
                              {contact.contact_email}
                            </a>
                          )}
                        </div>

                        {contact.notes && (
                          <p className="mt-2 text-xs text-[hsl(215,15%,52%)] italic">{contact.notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {!showImportPanel && !selectedGroup && (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-[hsl(210,15%,92%)] flex items-center justify-center mb-4">
              <Icon name="UsersIcon" size={28} className="text-[hsl(215,15%,62%)]" />
            </div>
            <h3 className="text-base font-semibold text-[hsl(215,25%,18%)] mb-1">Select a property</h3>
            <p className="text-sm text-[hsl(215,15%,52%)] max-w-xs">
              Choose a property from the left panel to view its contacts, or import a CSV to get started.
            </p>
            <button
              onClick={() => setShowImportPanel(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-[#8B1A2B] text-white text-sm font-semibold rounded-lg hover:bg-[#7a1626] transition-colors"
            >
              <Icon name="CloudArrowUpIcon" size={16} />
              Import CSV
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
