'use client';

import React, { useState, useRef, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import type JSZipType from 'jszip';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Lightweight entry stored during ZIP scan — no blob materialised yet */
interface ZipFileEntry {
  name: string;
  /** The JSZip file object — blob is read on-demand */
  zipEntry: JSZipType.JSZipObject;
}

interface FolderGroup {
  shortCode: string;
  propertyRef: string | null;
  matchedLabel: string | null;
  /** Raw entries — blobs are NOT pre-loaded */
  entries: ZipFileEntry[];
  /** Materialised previews — only populated when folder is expanded */
  previews: Array<{ name: string; previewUrl: string }>;
  previewsLoaded: boolean;
  status: 'pending' | 'uploading' | 'done' | 'error' | 'no-match';
  uploadedCount: number;
  error?: string;
}

interface ImportSummary {
  totalFolders: number;
  matchedFolders: number;
  unmatchedFolders: number;
  totalImages: number;
  uploadedImages: number;
  failedImages: number;
}

const IMAGE_EXTS = /\.(jpe?g|png|webp|gif|heic|avif)$/i;

// ─── Component ────────────────────────────────────────────────────────────────

export default function ZipFolderPhotoImport() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Keep a reference to the loaded JSZip instance so entries can be read later */
  const zipRef = useRef<JSZipType | null>(null);

  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [zipName, setZipName] = useState<string | null>(null);
  const [folders, setFolders] = useState<FolderGroup[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'matched' | 'unmatched'>('all');
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);

  // ── Process ZIP ────────────────────────────────────────────────────────────

  const processZip = useCallback(async (file: File) => {
    setProcessing(true);
    setFolders([]);
    setSummary(null);
    setZipName(file.name);
    setExpandedFolder(null);
    setProcessingError(null);
    zipRef.current = null;

    try {
      // Read the file into memory immediately using FileReader wrapped in a Promise.
      // The FileReader.readAsArrayBuffer() call is initiated synchronously (before any await),
      // which guarantees the file handle is still valid when the read begins.
      // This avoids the "permission problems" error that occurs when file access is
      // deferred past the first async tick.
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file); // starts synchronously — file handle is still fresh
      });

      const JSZip = (await import('jszip')).default;

      // Parse the ZIP from the in-memory buffer — no further file I/O needed
      const zip = await JSZip.loadAsync(arrayBuffer);
      zipRef.current = zip;

      // Load all properties and build short_code → property_ref map
      const shortCodeMap = new Map<string, { ref: string; label: string }>();
      let allProperties: Array<{ id: string; property_ref: string; village?: string; short_code?: string }> = [];
      let from = 0;
      const pageSize = 1000;

      while (true) {
        const { data: page, error: pageError } = await supabase
          .from('properties')
          .select('id, property_ref, village, short_code')
          .range(from, from + pageSize - 1);

        if (pageError) break;
        if (!page || page.length === 0) break;

        allProperties = allProperties.concat(page);
        if (page.length < pageSize) break;
        from += pageSize;
      }

      allProperties.forEach(
        (p: { id: string; property_ref: string; village?: string; short_code?: string }) => {
          if (p.short_code) {
            const sc = p.short_code.toUpperCase().trim();
            if (!shortCodeMap.has(sc)) {
              shortCodeMap.set(sc, {
                ref: p.property_ref,
                label: `${p.short_code}${p.village ? ` · ${p.village}` : ''}`,
              });
            }
          }
        }
      );

      // Group ZIP entries by top-level folder name — store entry refs, NOT blobs
      const folderMap = new Map<string, ZipFileEntry[]>();

      const fileEntries = Object.entries(zip.files).filter(
        ([name, entry]) =>
          !entry.dir &&
          IMAGE_EXTS.test(name) &&
          !name.startsWith('__MACOSX') &&
          !name.startsWith('.')
      );

      for (const [fullPath, entry] of fileEntries) {
        const parts = fullPath.split('/');
        if (parts.length < 2) continue;
        const folderName = parts[0].trim();
        if (!folderName) continue;
        const filename = parts[parts.length - 1];

        if (!folderMap.has(folderName)) folderMap.set(folderName, []);
        folderMap.get(folderName)!.push({ name: filename, zipEntry: entry });
      }

      // Build folder groups — no blobs loaded yet
      const groups: FolderGroup[] = [];
      for (const [folderName, entries] of folderMap.entries()) {
        const sc = folderName.toUpperCase();
        const match = shortCodeMap.get(sc);
        groups.push({
          shortCode: folderName,
          propertyRef: match?.ref || null,
          matchedLabel: match?.label || null,
          entries,
          previews: [],
          previewsLoaded: false,
          status: match ? 'pending' : 'no-match',
          uploadedCount: 0,
        });
      }

      // Sort: matched first, then by short code
      groups.sort((a, b) => {
        if (a.status === 'no-match' && b.status !== 'no-match') return 1;
        if (a.status !== 'no-match' && b.status === 'no-match') return -1;
        return a.shortCode.localeCompare(b.shortCode);
      });

      setFolders(groups);

      const matchedFolders = groups.filter((g) => g.status !== 'no-match').length;
      const unmatchedFolders = groups.filter((g) => g.status === 'no-match').length;
      const totalImages = groups.reduce((sum, g) => sum + g.entries.length, 0);

      setSummary({
        totalFolders: groups.length,
        matchedFolders,
        unmatchedFolders,
        totalImages,
        uploadedImages: 0,
        failedImages: 0,
      });
    } catch (err) {
      console.error('ZIP processing error:', err);
      const message =
        err instanceof Error ? err.message : 'Unknown error occurred while reading ZIP file';
      setProcessingError(message);
      setZipName(null);
    } finally {
      setProcessing(false);
    }
  }, [supabase]);

  // ── Lazy-load previews when a folder is expanded ───────────────────────────

  const loadPreviews = useCallback(async (shortCode: string) => {
    setFolders((prev) =>
      prev.map((f) => {
        if (f.shortCode !== shortCode || f.previewsLoaded) return f;
        // Kick off async load; we'll update state when done
        (async () => {
          const previews: Array<{ name: string; previewUrl: string }> = [];
          // Only load up to 40 preview thumbnails to keep memory reasonable
          const limit = Math.min(f.entries.length, 40);
          for (let i = 0; i < limit; i++) {
            try {
              const blob = await f.entries[i].zipEntry.async('blob');
              previews.push({ name: f.entries[i].name, previewUrl: URL.createObjectURL(blob) });
            } catch {
              // skip unreadable entry
            }
          }
          setFolders((prev2) =>
            prev2.map((g) =>
              g.shortCode === shortCode ? { ...g, previews, previewsLoaded: true } : g
            )
          );
        })();
        return f; // return unchanged while async runs
      })
    );
  }, []);

  // ── Toggle folder expand ───────────────────────────────────────────────────

  const toggleFolder = useCallback(
    (shortCode: string) => {
      setExpandedFolder((prev) => {
        if (prev === shortCode) {
          // Collapsing — revoke object URLs to free memory
          setFolders((f) =>
            f.map((g) => {
              if (g.shortCode !== shortCode) return g;
              g.previews.forEach((p) => URL.revokeObjectURL(p.previewUrl));
              return { ...g, previews: [], previewsLoaded: false };
            })
          );
          return null;
        }
        // Expanding — trigger lazy preview load
        loadPreviews(shortCode);
        return shortCode;
      });
    },
    [loadPreviews]
  );

  // ── Upload ─────────────────────────────────────────────────────────────────

  const handleUpload = useCallback(async () => {
    const toUpload = folders.filter((f) => f.status === 'pending');
    if (toUpload.length === 0) return;

    setUploading(true);
    let totalUploaded = 0;
    let totalFailed = 0;

    const updated = [...folders];

    for (let i = 0; i < updated.length; i++) {
      const folder = updated[i];
      if (folder.status !== 'pending') continue;

      updated[i] = { ...folder, status: 'uploading', uploadedCount: 0 };
      setFolders([...updated]);

      let folderUploaded = 0;
      let folderFailed = 0;

      for (let j = 0; j < folder.entries.length; j++) {
        const entry = folder.entries[j];
        try {
          // Read blob on-demand from the in-memory ZIP (no file I/O)
          const blob = await entry.zipEntry.async('blob');
          const mimeType = blob.type || 'image/jpeg';
          const safeName = entry.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const storagePath = `properties/${folder.propertyRef}/${Date.now()}_${j}_${safeName}`;

          const imageFile = new File([blob], safeName, { type: mimeType });

          const { error: uploadError } = await supabase.storage
            .from('property-photos')
            .upload(storagePath, imageFile, { contentType: mimeType, upsert: false });

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from('property-photos')
            .getPublicUrl(storagePath);

          if (urlData?.publicUrl && folder.propertyRef) {
            await supabase.from('property_photos').insert({
              property_ref: folder.propertyRef,
              short_code: folder.shortCode,
              storage_path: storagePath,
              public_url: urlData.publicUrl,
              filename: safeName,
              display_order: j,
              is_advertising: false,
            });
          }

          folderUploaded++;
          totalUploaded++;
        } catch (err) {
          console.error(`Upload failed for ${entry.name}:`, err);
          folderFailed++;
          totalFailed++;
        }

        updated[i] = { ...updated[i], uploadedCount: folderUploaded };
        setFolders([...updated]);
      }

      updated[i] = {
        ...updated[i],
        status: folderFailed === folder.entries.length ? 'error' : 'done',
        uploadedCount: folderUploaded,
        error: folderFailed > 0 ? `${folderFailed} image(s) failed` : undefined,
      };
      setFolders([...updated]);
    }

    setSummary((prev) =>
      prev ? { ...prev, uploadedImages: totalUploaded, failedImages: totalFailed } : null
    );
    setUploading(false);
  }, [folders, supabase]);

  // ── Reset ──────────────────────────────────────────────────────────────────

  const reset = () => {
    folders.forEach((f) => f.previews.forEach((p) => URL.revokeObjectURL(p.previewUrl)));
    setFolders([]);
    setSummary(null);
    setZipName(null);
    setFilterMode('all');
    setExpandedFolder(null);
    setProcessingError(null);
    zipRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const filteredFolders = folders.filter((f) => {
    if (filterMode === 'matched') return f.status !== 'no-match';
    if (filterMode === 'unmatched') return f.status === 'no-match';
    return true;
  });

  const pendingCount = folders.filter((f) => f.status === 'pending').length;
  const doneCount = folders.filter((f) => f.status === 'done').length;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[hsl(214,20%,88%)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
            <Icon name="FolderOpenIcon" size={16} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[hsl(215,25%,18%)]">ZIP Folder Photo Import</h2>
            <p className="text-xs text-[hsl(215,15%,52%)]">
              ZIP with folders named by short code — e.g.{' '}
              <span className="font-mono">H020009A/</span>
            </p>
          </div>
        </div>
        {folders.length > 0 && (
          <button
            onClick={reset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(214,20%,88%)] text-xs text-[hsl(215,15%,52%)] hover:bg-[hsl(210,15%,94%)] transition-colors"
          >
            <Icon name="RefreshCwIcon" size={12} />
            Reset
          </button>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Drop zone */}
        {!zipName ? (
          <>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file?.name.endsWith('.zip')) processZip(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragOver
                  ? 'border-emerald-500 bg-emerald-50' :'border-[hsl(214,20%,88%)] hover:border-emerald-400 hover:bg-emerald-50/40'
              }`}
            >
              <div className="w-14 h-14 rounded-full bg-[hsl(210,20%,97%)] flex items-center justify-center mx-auto mb-3">
                <Icon name="FolderArchiveIcon" size={26} className="text-[hsl(215,15%,52%)]" />
              </div>
              <p className="text-sm font-medium text-[hsl(215,25%,18%)]">Drop your ZIP file here</p>
              <p className="text-xs text-[hsl(215,15%,52%)] mt-1">
                ZIP must contain folders named by property short code
              </p>
              <div className="mt-3 inline-flex flex-col items-center gap-1">
                <p className="text-[11px] text-[hsl(215,15%,52%)] font-mono bg-[hsl(210,20%,97%)] px-2 py-1 rounded">
                  H020009A/ → photo1.jpg, photo2.jpg …
                </p>
                <p className="text-[11px] text-[hsl(215,15%,52%)] font-mono bg-[hsl(210,20%,97%)] px-2 py-1 rounded">
                  SBL0001A/ → living.jpg, bedroom.jpg …
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) processZip(file);
                }}
              />
            </div>

            {processingError && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200">
                <Icon name="AlertCircleIcon" size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-red-700">Failed to read ZIP file</p>
                  <p className="text-xs text-red-600 mt-0.5">{processingError}</p>
                  <p className="text-xs text-red-500 mt-1">
                    Try re-selecting the file or ensure it is a valid ZIP archive.
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(210,20%,97%)] border border-[hsl(214,20%,88%)]">
            <Icon name="FolderArchiveIcon" size={18} className="text-emerald-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[hsl(215,25%,18%)] truncate">{zipName}</p>
              {processing ? (
                <p className="text-xs text-[hsl(215,15%,52%)] flex items-center gap-1">
                  <Icon name="LoaderIcon" size={11} className="animate-spin" />
                  Reading folders and matching properties…
                </p>
              ) : summary ? (
                <p className="text-xs text-[hsl(215,15%,52%)]">
                  {summary.totalFolders} folders · {summary.matchedFolders} matched ·{' '}
                  {summary.unmatchedFolders} unmatched · {summary.totalImages} images
                </p>
              ) : null}
            </div>
          </div>
        )}

        {/* Summary stats */}
        {summary && !processing && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[
              { label: 'Folders', value: summary.totalFolders, color: 'text-[hsl(215,25%,18%)]', bg: 'bg-[hsl(210,20%,97%)]' },
              { label: 'Matched', value: summary.matchedFolders, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Unmatched', value: summary.unmatchedFolders, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Images', value: summary.totalImages, color: 'text-[#1B4F8A]', bg: 'bg-[#1B4F8A]/5' },
              { label: 'Uploaded', value: summary.uploadedImages, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Failed', value: summary.failedImages, color: 'text-red-500', bg: 'bg-red-50' },
            ].map((stat) => (
              <div key={stat.label} className={`${stat.bg} rounded-lg p-2 text-center`}>
                <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-[10px] text-[hsl(215,15%,52%)] font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filter + Upload controls */}
        {folders.length > 0 && !processing && (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-1 p-1 bg-[hsl(210,20%,97%)] rounded-lg">
              {(['all', 'matched', 'unmatched'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setFilterMode(mode)}
                  className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                    filterMode === mode
                      ? 'bg-white text-[#1B4F8A] shadow-sm'
                      : 'text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)]'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {pendingCount > 0 && (
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {uploading ? (
                  <>
                    <Icon name="LoaderIcon" size={13} className="animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Icon name="UploadCloudIcon" size={13} />
                    Upload {pendingCount} folder{pendingCount !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            )}

            {doneCount > 0 && pendingCount === 0 && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                <Icon name="CheckCircleIcon" size={14} />
                All uploads complete
              </div>
            )}
          </div>
        )}

        {/* Folder list */}
        {filteredFolders.length > 0 && !processing && (
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {filteredFolders.map((folder) => {
              const isExpanded = expandedFolder === folder.shortCode;
              const statusColor =
                folder.status === 'no-match' ?'border-amber-200 bg-amber-50/50'
                  : folder.status === 'done' ?'border-emerald-200 bg-emerald-50/30'
                  : folder.status === 'error' ?'border-red-200 bg-red-50/30'
                  : folder.status === 'uploading' ?'border-[#1B4F8A]/20 bg-[#1B4F8A]/5' :'border-[hsl(214,20%,88%)] bg-white';

              return (
                <div
                  key={folder.shortCode}
                  className={`rounded-lg border ${statusColor} overflow-hidden transition-colors`}
                >
                  {/* Folder row */}
                  <div
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                    onClick={() => toggleFolder(folder.shortCode)}
                  >
                    {/* Status icon */}
                    <div className="flex-shrink-0">
                      {folder.status === 'no-match' && (
                        <Icon name="AlertCircleIcon" size={15} className="text-amber-500" />
                      )}
                      {folder.status === 'pending' && (
                        <Icon name="FolderIcon" size={15} className="text-[hsl(215,15%,52%)]" />
                      )}
                      {folder.status === 'uploading' && (
                        <Icon name="LoaderIcon" size={15} className="text-[#1B4F8A] animate-spin" />
                      )}
                      {folder.status === 'done' && (
                        <Icon name="CheckCircleIcon" size={15} className="text-emerald-500" />
                      )}
                      {folder.status === 'error' && (
                        <Icon name="XCircleIcon" size={15} className="text-red-500" />
                      )}
                    </div>

                    {/* Short code */}
                    <span className="font-mono text-xs font-semibold text-[hsl(215,25%,18%)] w-28 flex-shrink-0">
                      {folder.shortCode}
                    </span>

                    {/* Match info */}
                    <div className="flex-1 min-w-0">
                      {folder.matchedLabel ? (
                        <span className="text-xs text-[hsl(215,25%,18%)] truncate">
                          {folder.matchedLabel}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600 italic">No matching property</span>
                      )}
                    </div>

                    {/* Image count + progress */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {folder.status === 'uploading' && (
                        <span className="text-xs text-[#1B4F8A]">
                          {folder.uploadedCount}/{folder.entries.length}
                        </span>
                      )}
                      {folder.status === 'done' && (
                        <span className="text-xs text-emerald-600">
                          {folder.uploadedCount} uploaded
                        </span>
                      )}
                      {folder.status === 'error' && folder.error && (
                        <span className="text-xs text-red-500">{folder.error}</span>
                      )}
                      <span className="text-[11px] text-[hsl(215,15%,52%)] bg-[hsl(210,20%,97%)] px-1.5 py-0.5 rounded">
                        {folder.entries.length} img{folder.entries.length !== 1 ? 's' : ''}
                      </span>
                      <Icon
                        name={isExpanded ? 'ChevronUpIcon' : 'ChevronDownIcon'}
                        size={13}
                        className="text-[hsl(215,15%,52%)]"
                      />
                    </div>
                  </div>

                  {/* Expanded preview grid — lazy loaded */}
                  {isExpanded && (
                    <div className="px-3 pb-3 border-t border-[hsl(214,20%,88%)]">
                      {!folder.previewsLoaded ? (
                        <div className="flex items-center gap-2 py-3 text-xs text-[hsl(215,15%,52%)]">
                          <Icon name="LoaderIcon" size={13} className="animate-spin" />
                          Loading previews…
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 mt-2">
                            {folder.previews.map((fi, idx) => (
                              <div
                                key={idx}
                                className="aspect-square rounded overflow-hidden bg-[hsl(210,20%,97%)] border border-[hsl(214,20%,88%)]"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={fi.previewUrl}
                                  alt={fi.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ))}
                          </div>
                          <p className="text-[10px] text-[hsl(215,15%,52%)] mt-1.5">
                            {folder.entries.length > 40
                              ? `Showing first 40 of ${folder.entries.length} images. All will be uploaded.`
                              : 'First image will be used as the property thumbnail.'}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state after filter */}
        {folders.length > 0 && filteredFolders.length === 0 && !processing && (
          <div className="text-center py-6 text-xs text-[hsl(215,15%,52%)]">
            No folders match the current filter.
          </div>
        )}

        {/* How-to hint */}
        {!zipName && (
          <div className="rounded-lg bg-[hsl(210,20%,97%)] border border-[hsl(214,20%,88%)] p-3">
            <p className="text-xs font-semibold text-[hsl(215,25%,18%)] mb-1.5 flex items-center gap-1.5">
              <Icon name="InfoIcon" size={13} className="text-[hsl(215,15%,52%)]" />
              Expected ZIP structure
            </p>
            <div className="font-mono text-[11px] text-[hsl(215,15%,52%)] space-y-0.5 leading-relaxed">
              <p>photos.zip</p>
              <p className="pl-3">├── H020009A/</p>
              <p className="pl-6">│   ├── photo1.jpg</p>
              <p className="pl-6">│   └── photo2.jpg</p>
              <p className="pl-3">├── SBL0001A/</p>
              <p className="pl-6">│   ├── living.jpg</p>
              <p className="pl-6">│   └── bedroom.jpg</p>
              <p className="pl-3">└── PAV0303A/</p>
              <p className="pl-6">    └── main.jpg</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
