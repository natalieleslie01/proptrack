'use client';

import React, { useState, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

interface DuplicateGroup {
  property_ref: string;
  filename: string;
  count: number;
  keep_id: string;
  delete_ids: string[];
  delete_paths: string[];
}

interface ScanResult {
  totalPhotos: number;
  duplicateGroups: DuplicateGroup[];
  duplicateCount: number;
}

type Phase = 'idle' | 'scanning' | 'scanned' | 'deleting' | 'done';

export default function DeduplicatePhotos() {
  const supabase = createClient();
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [deleted, setDeleted] = useState(0);
  const [failed, setFailed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // ── Scan ────────────────────────────────────────────────────────────────────

  const handleScan = useCallback(async () => {
    setPhase('scanning');
    setResult(null);
    setError(null);

    try {
      // Fetch ALL photos using pagination (Supabase default limit is 1,000 rows)
      const PAGE_SIZE = 1000;
      let allPhotos: { id: string; property_ref: string; filename: string; storage_path: string; created_at: string }[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error: fetchErr } = await supabase
          .from('property_photos')
          .select('id, property_ref, filename, storage_path, created_at')
          .order('created_at', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);

        if (fetchErr) throw fetchErr;

        const page = data || [];
        allPhotos = allPhotos.concat(page);

        if (page.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          from += PAGE_SIZE;
        }
      }

      const photos = allPhotos;

      // Group by property_ref + filename
      const groups = new Map<string, typeof photos>();
      for (const photo of photos) {
        const key = `${photo.property_ref}||${photo.filename}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(photo);
      }

      const duplicateGroups: DuplicateGroup[] = [];
      for (const [key, group] of groups.entries()) {
        if (group.length < 2) continue;
        const [property_ref, filename] = key.split('||');
        // Already sorted by created_at asc — keep the first (oldest)
        const keep = group[0];
        const dupes = group.slice(1);
        duplicateGroups.push({
          property_ref,
          filename,
          count: group.length,
          keep_id: keep.id,
          delete_ids: dupes.map((d) => d.id),
          delete_paths: dupes.map((d) => d.storage_path).filter(Boolean),
        });
      }

      setResult({
        totalPhotos: photos.length,
        duplicateGroups,
        duplicateCount: duplicateGroups.reduce((sum, g) => sum + g.delete_ids.length, 0),
      });
      setPhase('scanned');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
      setPhase('idle');
    }
  }, [supabase]);

  // ── Delete duplicates ────────────────────────────────────────────────────────

  const handleDelete = useCallback(async () => {
    if (!result || result.duplicateGroups.length === 0) return;
    setPhase('deleting');
    setDeleted(0);
    setFailed(0);

    let deletedCount = 0;
    let failedCount = 0;

    for (const group of result.duplicateGroups) {
      // Delete storage files first (best-effort — don't abort on storage error)
      if (group.delete_paths.length > 0) {
        await supabase.storage
          .from('property-photos')
          .remove(group.delete_paths)
          .catch(() => null);
      }

      // Delete DB rows
      const { error: dbErr } = await supabase
        .from('property_photos')
        .delete()
        .in('id', group.delete_ids);

      if (dbErr) {
        failedCount += group.delete_ids.length;
      } else {
        deletedCount += group.delete_ids.length;
      }

      setDeleted(deletedCount);
      setFailed(failedCount);
    }

    setPhase('done');
  }, [result, supabase]);

  const handleReset = () => {
    setPhase('idle');
    setResult(null);
    setDeleted(0);
    setFailed(0);
    setError(null);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[hsl(214,20%,88%)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
            <Icon name="CopyIcon" size={16} className="text-red-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[hsl(215,25%,18%)]">Remove Duplicate Photos</h2>
            <p className="text-xs text-[hsl(215,15%,52%)]">
              Scan for duplicate filenames per property and delete extras, keeping the earliest upload
            </p>
          </div>
        </div>
        {phase !== 'idle' && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(214,20%,88%)] text-xs text-[hsl(215,15%,52%)] hover:bg-[hsl(210,15%,94%)] transition-colors"
          >
            <Icon name="RefreshCwIcon" size={12} />
            Reset
          </button>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex gap-2">
            <Icon name="AlertCircleIcon" size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {/* Idle — scan button */}
        {phase === 'idle' && (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-[hsl(210,20%,97%)] flex items-center justify-center mx-auto mb-3">
              <Icon name="SearchIcon" size={26} className="text-[hsl(215,15%,52%)]" />
            </div>
            <p className="text-sm font-medium text-[hsl(215,25%,18%)] mb-1">
              Scan for duplicate photos
            </p>
            <p className="text-xs text-[hsl(215,15%,52%)] mb-4 max-w-xs mx-auto">
              Checks every property for photos with the same filename. Duplicates are removed from storage and the database — the earliest upload is kept.
            </p>
            <button
              onClick={handleScan}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1B4F8A] text-white text-sm font-semibold hover:bg-[#1B4F8A]/90 transition-colors"
            >
              <Icon name="SearchIcon" size={15} />
              Scan for Duplicates
            </button>
          </div>
        )}

        {/* Scanning */}
        {phase === 'scanning' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Icon name="LoaderIcon" size={28} className="animate-spin text-[#1B4F8A]" />
            <p className="text-sm text-[hsl(215,15%,52%)]">Scanning all property photos…</p>
          </div>
        )}

        {/* Scanned — show results */}
        {(phase === 'scanned' || phase === 'deleting') && result && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[hsl(210,20%,97%)] rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-[hsl(215,25%,18%)]">{result.totalPhotos.toLocaleString()}</p>
                <p className="text-[10px] text-[hsl(215,15%,52%)] font-medium mt-0.5">Total Photos</p>
              </div>
              <div className={`rounded-lg p-3 text-center ${result.duplicateGroups.length > 0 ? 'bg-amber-50' : 'bg-green-50'}`}>
                <p className={`text-xl font-bold ${result.duplicateGroups.length > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                  {result.duplicateGroups.length}
                </p>
                <p className="text-[10px] text-[hsl(215,15%,52%)] font-medium mt-0.5">Duplicate Groups</p>
              </div>
              <div className={`rounded-lg p-3 text-center ${result.duplicateCount > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                <p className={`text-xl font-bold ${result.duplicateCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {result.duplicateCount}
                </p>
                <p className="text-[10px] text-[hsl(215,15%,52%)] font-medium mt-0.5">Photos to Delete</p>
              </div>
            </div>

            {result.duplicateCount === 0 ? (
              <div className="rounded-lg bg-green-50 border border-green-200 p-3 flex items-center gap-2">
                <Icon name="CheckCircleIcon" size={15} className="text-green-600" />
                <p className="text-xs text-green-700 font-medium">
                  No duplicates found — all {result.totalPhotos.toLocaleString()} photos are unique.
                </p>
              </div>
            ) : (
              <>
                {/* Duplicate list (capped at 50 rows for readability) */}
                <div className="max-h-64 overflow-y-auto rounded-lg border border-[hsl(214,20%,88%)]">
                  <table className="w-full text-[11px]">
                    <thead className="sticky top-0 bg-[hsl(210,20%,97%)] z-10">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-[hsl(215,25%,18%)]">Property</th>
                        <th className="px-3 py-2 text-left font-semibold text-[hsl(215,25%,18%)]">Filename</th>
                        <th className="px-3 py-2 text-center font-semibold text-[hsl(215,25%,18%)] w-20">Copies</th>
                        <th className="px-3 py-2 text-center font-semibold text-[hsl(215,25%,18%)] w-24">To Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.duplicateGroups.slice(0, 50).map((g, i) => (
                        <tr key={i} className="border-t border-[hsl(214,20%,88%)] hover:bg-[hsl(210,20%,97%)]">
                          <td className="px-3 py-2 font-mono text-[#1B4F8A] font-semibold">{g.property_ref}</td>
                          <td className="px-3 py-2 text-[hsl(215,25%,18%)] max-w-[180px] truncate font-mono" title={g.filename}>
                            {g.filename}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">{g.count}</span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-semibold">{g.delete_ids.length}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.duplicateGroups.length > 50 && (
                    <p className="text-[10px] text-[hsl(215,15%,52%)] text-center py-2 border-t border-[hsl(214,20%,88%)]">
                      …and {result.duplicateGroups.length - 50} more groups not shown
                    </p>
                  )}
                </div>

                {/* Warning + delete button */}
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex gap-2">
                  <Icon name="AlertTriangleIcon" size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    <strong>{result.duplicateCount} duplicate photo{result.duplicateCount !== 1 ? 's' : ''}</strong> will be permanently deleted from storage and the database.
                    The earliest uploaded copy of each file will be kept.
                  </p>
                </div>

                <button
                  onClick={handleDelete}
                  disabled={phase === 'deleting'}
                  className="w-full py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {phase === 'deleting' ? (
                    <>
                      <Icon name="LoaderIcon" size={15} className="animate-spin" />
                      Deleting duplicates… ({deleted} done)
                    </>
                  ) : (
                    <>
                      <Icon name="Trash2Icon" size={15} />
                      Delete {result.duplicateCount} Duplicate Photo{result.duplicateCount !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </>
            )}
          </>
        )}

        {/* Done */}
        {phase === 'done' && (
          <div className="space-y-3">
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 flex items-start gap-3">
              <Icon name="CheckCircleIcon" size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-800">Deduplication complete</p>
                <p className="text-xs text-green-700 mt-0.5">
                  {deleted} duplicate photo{deleted !== 1 ? 's' : ''} deleted.
                  {failed > 0 && (
                    <span className="text-red-600 ml-1">{failed} failed to delete — try again or check permissions.</span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={handleReset}
              className="w-full py-2 rounded-lg border border-[hsl(214,20%,88%)] text-xs font-medium text-[hsl(215,15%,52%)] hover:bg-[hsl(210,15%,94%)] transition-colors"
            >
              Run another scan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
