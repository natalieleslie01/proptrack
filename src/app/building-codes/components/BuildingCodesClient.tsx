'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Papa from 'papaparse';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BuildingCodeRow {
  id: string;
  short_code_prefix: string;
  building_name: string;
  created_at: string;
}

interface ParsedRow {
  short_code_prefix: string;
  building_name: string;
  _rowIndex: number;
  _error?: string;
}

interface UploadResult {
  inserted: number;
  updated: number;
  errors: string[];
}

// ─── Template download ────────────────────────────────────────────────────────

function downloadTemplate() {
  const csv = 'short_code_prefix,building_name\nWGC,Woodgreen Court\nSBL,Seabird\nTWI,Twilight Court';
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'building_codes_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BuildingCodesClient() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [existingCodes, setExistingCodes] = useState<BuildingCodeRow[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(true);

  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');

  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // ─── Load existing codes ───────────────────────────────────────────────────

  const loadExisting = useCallback(async () => {
    setLoadingExisting(true);
    const { data, error } = await supabase
      .from('building_codes')
      .select('id, short_code_prefix, building_name, created_at')
      .order('short_code_prefix', { ascending: true });

    if (!error && data) {
      setExistingCodes(data as BuildingCodeRow[]);
    }
    setLoadingExisting(false);
  }, [supabase]);

  useEffect(() => {
    loadExisting();
  }, [loadExisting]);

  // ─── CSV parsing ──────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError('');
    setParsedRows([]);
    setResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows: ParsedRow[] = [];
        const rawData = results.data as Record<string, string>[];

        rawData.forEach((raw, idx) => {
          // Normalise column names — accept variations
          const prefix = (
            raw['short_code_prefix'] ||
            raw['Short Code Prefix'] ||
            raw['short_code'] ||
            raw['Short Code'] ||
            raw['prefix'] ||
            ''
          ).trim().toUpperCase();

          const name = (
            raw['building_name'] ||
            raw['Building Name'] ||
            raw['building'] ||
            raw['Building'] ||
            raw['name'] ||
            ''
          ).trim();

          const row: ParsedRow = { short_code_prefix: prefix, building_name: name, _rowIndex: idx + 2 };

          if (!prefix) row._error = 'Missing short_code_prefix';
          else if (!name) row._error = 'Missing building_name';

          rows.push(row);
        });

        if (rows.length === 0) {
          setParseError('No data rows found in the CSV file.');
          return;
        }

        setParsedRows(rows);
      },
      error: (err) => {
        setParseError(`CSV parse error: ${err.message}`);
      },
    });

    // Reset input so same file can be re-selected
    e.target.value = '';
  }

  // ─── Upload ───────────────────────────────────────────────────────────────

  async function handleUpload() {
    const validRows = parsedRows.filter((r) => !r._error);
    if (validRows.length === 0) return;

    setUploading(true);
    setResult(null);

    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const row of validRows) {
      const { error } = await supabase
        .from('building_codes')
        .upsert(
          {
            short_code_prefix: row.short_code_prefix,
            building_name: row.building_name,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'short_code_prefix' }
        );

      if (error) {
        errors.push(`Row ${row._rowIndex} (${row.short_code_prefix}): ${error.message}`);
      } else {
        // Determine if it was an insert or update
        const existed = existingCodes.some(
          (c) => c.short_code_prefix.toUpperCase() === row.short_code_prefix.toUpperCase()
        );
        if (existed) updated++;
        else inserted++;
      }
    }

    setResult({ inserted, updated, errors });
    setUploading(false);
    setParsedRows([]);
    setFileName('');
    await loadExisting();
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    const { error } = await supabase.from('building_codes').delete().eq('id', id);
    if (!error) {
      setExistingCodes((prev) => prev.filter((c) => c.id !== id));
    }
    setDeleteConfirm(null);
  }

  // ─── Filtered list ────────────────────────────────────────────────────────

  const filteredCodes = existingCodes.filter(
    (c) =>
      c.short_code_prefix.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.building_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const validCount = parsedRows.filter((r) => !r._error).length;
  const errorCount = parsedRows.filter((r) => r._error).length;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(215,25%,18%)]">Building Code Mapper</h1>
          <p className="text-sm text-[hsl(215,15%,52%)] mt-0.5">
            Upload a 2-column CSV to map short code prefixes to building names
          </p>
        </div>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#8B1A2B] border border-[#8B1A2B]/30 rounded-lg hover:bg-[#8B1A2B]/5 transition-colors"
        >
          <Icon name="DownloadIcon" size={15} />
          Download Template
        </button>
      </div>

      {/* Upload card */}
      <div className="bg-white border border-[hsl(214,20%,88%)] rounded-xl p-6 space-y-5">
        <h2 className="text-base font-semibold text-[hsl(215,25%,18%)] flex items-center gap-2">
          <Icon name="UploadCloudIcon" size={18} className="text-[#8B1A2B]" />
          Upload CSV
        </h2>

        {/* Format hint */}
        <div className="bg-[hsl(210,15%,97%)] border border-[hsl(214,20%,88%)] rounded-lg p-3 text-xs text-[hsl(215,15%,40%)] space-y-1">
          <p className="font-semibold text-[hsl(215,25%,18%)]">Expected columns:</p>
          <p>
            <span className="font-mono bg-white border border-[hsl(214,20%,88%)] px-1.5 py-0.5 rounded text-[#8B1A2B]">short_code_prefix</span>
            {' '}— e.g. <span className="font-mono">WGC</span>, <span className="font-mono">SBL</span>, <span className="font-mono">NEO01</span>
          </p>
          <p>
            <span className="font-mono bg-white border border-[hsl(214,20%,88%)] px-1.5 py-0.5 rounded text-[#8B1A2B]">building_name</span>
            {' '}— e.g. <span className="font-mono">Woodgreen Court</span>
          </p>
          <p className="text-[hsl(215,15%,52%)]">Existing prefixes will be updated (upsert). Column names are case-insensitive.</p>
        </div>

        {/* Drop zone */}
        <div
          className="border-2 border-dashed border-[hsl(214,20%,82%)] rounded-xl p-8 text-center cursor-pointer hover:border-[#8B1A2B]/40 hover:bg-[#8B1A2B]/2 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <Icon name="FileSpreadsheetIcon" size={36} className="mx-auto text-[hsl(215,15%,65%)] mb-3" />
          <p className="text-sm font-medium text-[hsl(215,25%,18%)]">
            {fileName ? fileName : 'Click to select a CSV file'}
          </p>
          <p className="text-xs text-[hsl(215,15%,52%)] mt-1">
            {fileName ? 'Click to choose a different file' : 'short_code_prefix / building_name'}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Parse error */}
        {parseError && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <Icon name="AlertCircleIcon" size={16} className="mt-0.5 flex-shrink-0" />
            {parseError}
          </div>
        )}

        {/* Preview table */}
        {parsedRows.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1.5 text-green-700 font-medium">
                <Icon name="CheckCircleIcon" size={15} />
                {validCount} valid
              </span>
              {errorCount > 0 && (
                <span className="flex items-center gap-1.5 text-red-600 font-medium">
                  <Icon name="XCircleIcon" size={15} />
                  {errorCount} with errors
                </span>
              )}
            </div>

            <div className="border border-[hsl(214,20%,88%)] rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-[hsl(210,15%,97%)] sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-[hsl(215,15%,40%)] uppercase tracking-wide w-8">#</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-[hsl(215,15%,40%)] uppercase tracking-wide">Prefix</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-[hsl(215,15%,40%)] uppercase tracking-wide">Building Name</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-[hsl(215,15%,40%)] uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(214,20%,92%)]">
                  {parsedRows.map((row) => (
                    <tr key={row._rowIndex} className={row._error ? 'bg-red-50' : 'bg-white'}>
                      <td className="px-3 py-2 text-[hsl(215,15%,52%)]">{row._rowIndex}</td>
                      <td className="px-3 py-2 font-mono font-medium text-[hsl(215,25%,18%)]">{row.short_code_prefix || '—'}</td>
                      <td className="px-3 py-2 text-[hsl(215,25%,18%)]">{row.building_name || '—'}</td>
                      <td className="px-3 py-2">
                        {row._error ? (
                          <span className="text-xs text-red-600 flex items-center gap-1">
                            <Icon name="AlertCircleIcon" size={13} />
                            {row._error}
                          </span>
                        ) : (
                          <span className="text-xs text-green-600 flex items-center gap-1">
                            <Icon name="CheckIcon" size={13} />
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={handleUpload}
              disabled={uploading || validCount === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#8B1A2B] text-white text-sm font-semibold rounded-lg hover:bg-[#7a1726] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? (
                <>
                  <Icon name="LoaderIcon" size={15} className="animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Icon name="UploadCloudIcon" size={15} />
                  Upload {validCount} row{validCount !== 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        )}

        {/* Result banner */}
        {result && (
          <div className={`p-4 rounded-lg border text-sm space-y-1 ${result.errors.length === 0 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-yellow-50 border-yellow-200 text-yellow-800'}`}>
            <p className="font-semibold flex items-center gap-2">
              <Icon name={result.errors.length === 0 ? 'CheckCircleIcon' : 'AlertTriangleIcon'} size={16} />
              Upload complete
            </p>
            <p>{result.inserted} inserted · {result.updated} updated</p>
            {result.errors.map((e, i) => (
              <p key={i} className="text-red-700 text-xs">{e}</p>
            ))}
          </div>
        )}
      </div>

      {/* Existing codes table */}
      <div className="bg-white border border-[hsl(214,20%,88%)] rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[hsl(215,25%,18%)] flex items-center gap-2">
            <Icon name="BuildingIcon" size={18} className="text-[#8B1A2B]" />
            Mapped Building Codes
            <span className="ml-1 text-xs font-normal text-[hsl(215,15%,52%)] bg-[hsl(210,15%,94%)] px-2 py-0.5 rounded-full">
              {existingCodes.length}
            </span>
          </h2>
          <div className="relative">
            <Icon name="SearchIcon" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(215,15%,52%)]" />
            <input
              type="text"
              placeholder="Search…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-[hsl(214,20%,88%)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 w-48"
            />
          </div>
        </div>

        {loadingExisting ? (
          <div className="flex items-center justify-center py-12 text-[hsl(215,15%,52%)]">
            <Icon name="LoaderIcon" size={20} className="animate-spin mr-2" />
            Loading…
          </div>
        ) : filteredCodes.length === 0 ? (
          <div className="text-center py-12 text-[hsl(215,15%,52%)]">
            <Icon name="BuildingIcon" size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">{searchQuery ? 'No results match your search.' : 'No building codes uploaded yet.'}</p>
          </div>
        ) : (
          <div className="border border-[hsl(214,20%,88%)] rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[hsl(210,15%,97%)]">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[hsl(215,15%,40%)] uppercase tracking-wide">Prefix</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[hsl(215,15%,40%)] uppercase tracking-wide">Building Name</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[hsl(215,15%,40%)] uppercase tracking-wide">Added</th>
                  <th className="px-4 py-2.5 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(214,20%,92%)]">
                {filteredCodes.map((code) => (
                  <tr key={code.id} className="hover:bg-[hsl(210,15%,98%)] transition-colors">
                    <td className="px-4 py-2.5 font-mono font-semibold text-[#8B1A2B]">{code.short_code_prefix}</td>
                    <td className="px-4 py-2.5 text-[hsl(215,25%,18%)]">{code.building_name}</td>
                    <td className="px-4 py-2.5 text-[hsl(215,15%,52%)] text-xs">
                      {new Date(code.created_at).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {deleteConfirm === code.id ? (
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => handleDelete(code.id)}
                            className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="text-xs px-2 py-1 border border-[hsl(214,20%,88%)] rounded hover:bg-[hsl(210,15%,94%)] transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(code.id)}
                          className="p-1.5 text-[hsl(215,15%,52%)] hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Icon name="Trash2Icon" size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
