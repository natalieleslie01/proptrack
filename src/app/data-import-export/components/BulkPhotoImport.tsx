'use client';

import React, { useState, useRef, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PhotoFile {
  id: string;
  filename: string;
  shortCode: string;
  propertyRef: string | null;
  matchedProperty: string | null;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error' | 'no-match';
  error?: string;
  previewUrl?: string;
  isAdvertising: boolean;
  displayOrder: number;
}

interface UploadSummary {
  total: number;
  matched: number;
  unmatched: number;
  uploaded: number;
  failed: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractShortCode(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '');
  const match = base.match(/^([A-Z0-9]+)/i);
  return match ? match[1].toUpperCase() : '';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BulkPhotoImport() {
  const supabase = createClient();
  const zipInputRef = useRef<HTMLInputElement>(null);
  const directInputRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const [zipName, setZipName] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'matched' | 'unmatched'>('all');
  const [uploadMode, setUploadMode] = useState<'zip' | 'direct'>('zip');

  // Drag-to-reorder state
  const [dragPhotoId, setDragPhotoId] = useState<string | null>(null);
  const [dragOverPhotoId, setDragOverPhotoId] = useState<string | null>(null);

  // ── Process ZIP ────────────────────────────────────────────────────────────

  const processZip = useCallback(async (file: File) => {
    setProcessing(true);
    setPhotos([]);
    setSummary(null);
    setZipName(file.name);

    try {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(file);

      const { data: properties } = await supabase
        .from('properties')
        .select('property_ref, village, block, unit, short_code');

      const shortCodeMap = new Map<string, { ref: string; label: string }>();
      (properties || []).forEach((p: { property_ref: string; village?: string; block?: string; unit?: string; short_code?: string }) => {
        // Map by short_code if available
        if (p.short_code) {
          const sc = p.short_code.toUpperCase();
          if (!shortCodeMap.has(sc)) {
            shortCodeMap.set(sc, {
              ref: p.property_ref,
              label: `${p.property_ref}${p.village ? ` · ${p.village}` : ''}`,
            });
          }
        }
        // Also map by property_ref prefix
        const parts = p.property_ref.split('-');
        if (parts.length > 0) {
          const code = parts[0].toUpperCase();
          if (!shortCodeMap.has(code)) {
            shortCodeMap.set(code, {
              ref: p.property_ref,
              label: `${p.property_ref}${p.village ? ` · ${p.village}` : ''}`,
            });
          }
        }
      });

      const IMAGE_EXTS = /\.(jpe?g|png|webp|gif|heic|avif)$/i;
      const extracted: PhotoFile[] = [];

      const fileEntries = Object.entries(zip.files).filter(
        ([name, entry]) => !entry.dir && IMAGE_EXTS.test(name) && !name.startsWith('__MACOSX')
      );

      let order = 0;
      for (const [name, entry] of fileEntries) {
        const filename = name.split('/').pop() || name;
        const shortCode = extractShortCode(filename);
        const match = shortCodeMap.get(shortCode);

        const blob = await entry.async('blob');
        const imageFile = new File([blob], filename, { type: blob.type || 'image/jpeg' });
        const previewUrl = URL.createObjectURL(blob);

        extracted.push({
          id: `photo-${Date.now()}-${order}`,
          filename,
          shortCode,
          propertyRef: match?.ref || null,
          matchedProperty: match?.label || null,
          file: imageFile,
          status: match ? 'pending' : 'no-match',
          previewUrl,
          isAdvertising: false,
          displayOrder: order++,
        });
      }

      setPhotos(extracted);

      const matched = extracted.filter((p) => p.status === 'pending').length;
      const unmatched = extracted.filter((p) => p.status === 'no-match').length;
      setSummary({ total: extracted.length, matched, unmatched, uploaded: 0, failed: 0 });
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(false);
    }
  }, [supabase]);

  // ── Process Direct Files ───────────────────────────────────────────────────

  const processDirectFiles = useCallback(async (files: FileList) => {
    setProcessing(true);
    setPhotos([]);
    setSummary(null);
    setZipName(`${files.length} files selected`);

    try {
      const { data: properties } = await supabase
        .from('properties')
        .select('property_ref, village, block, unit, short_code');

      const shortCodeMap = new Map<string, { ref: string; label: string }>();
      (properties || []).forEach((p: { property_ref: string; village?: string; block?: string; unit?: string; short_code?: string }) => {
        if (p.short_code) {
          const sc = p.short_code.toUpperCase();
          if (!shortCodeMap.has(sc)) {
            shortCodeMap.set(sc, {
              ref: p.property_ref,
              label: `${p.property_ref}${p.village ? ` · ${p.village}` : ''}`,
            });
          }
        }
        const parts = p.property_ref.split('-');
        if (parts.length > 0) {
          const code = parts[0].toUpperCase();
          if (!shortCodeMap.has(code)) {
            shortCodeMap.set(code, {
              ref: p.property_ref,
              label: `${p.property_ref}${p.village ? ` · ${p.village}` : ''}`,
            });
          }
        }
      });

      const IMAGE_EXTS = /\.(jpe?g|png|webp|gif|heic|avif)$/i;
      const extracted: PhotoFile[] = [];
      let order = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!IMAGE_EXTS.test(file.name)) continue;

        const shortCode = extractShortCode(file.name);
        const match = shortCodeMap.get(shortCode);
        const previewUrl = URL.createObjectURL(file);

        extracted.push({
          id: `photo-${Date.now()}-${order}`,
          filename: file.name,
          shortCode,
          propertyRef: match?.ref || null,
          matchedProperty: match?.label || null,
          file,
          status: match ? 'pending' : 'no-match',
          previewUrl,
          isAdvertising: false,
          displayOrder: order++,
        });
      }

      setPhotos(extracted);
      const matched = extracted.filter((p) => p.status === 'pending').length;
      const unmatched = extracted.filter((p) => p.status === 'no-match').length;
      setSummary({ total: extracted.length, matched, unmatched, uploaded: 0, failed: 0 });
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(false);
    }
  }, [supabase]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processZip(file);
  };

  const handleDirectFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) processDirectFiles(files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.zip')) {
      processZip(file);
    }
  };

  // ── Advertising tick-box toggle ────────────────────────────────────────────

  const toggleAdvertising = (id: string) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isAdvertising: !p.isAdvertising } : p))
    );
  };

  const toggleAllAdvertising = (value: boolean) => {
    setPhotos((prev) =>
      prev.map((p) => (p.status !== 'no-match' ? { ...p, isAdvertising: value } : p))
    );
  };

  // ── Drag-to-reorder ────────────────────────────────────────────────────────

  const handlePhotoDragStart = (e: React.DragEvent, id: string) => {
    setDragPhotoId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handlePhotoDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverPhotoId(id);
  };

  const handlePhotoDrop = (e: React.DragEvent, dropId: string) => {
    e.preventDefault();
    if (!dragPhotoId || dragPhotoId === dropId) {
      setDragPhotoId(null);
      setDragOverPhotoId(null);
      return;
    }
    setPhotos((prev) => {
      const updated = [...prev];
      const fromIdx = updated.findIndex((p) => p.id === dragPhotoId);
      const toIdx = updated.findIndex((p) => p.id === dropId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [moved] = updated.splice(fromIdx, 1);
      updated.splice(toIdx, 0, moved);
      // Recalculate display order
      return updated.map((p, i) => ({ ...p, displayOrder: i }));
    });
    setDragPhotoId(null);
    setDragOverPhotoId(null);
  };

  const handlePhotoDragEnd = () => {
    setDragPhotoId(null);
    setDragOverPhotoId(null);
  };

  // ── Upload Photos ──────────────────────────────────────────────────────────

  const handleUpload = useCallback(async () => {
    const toUpload = photos.filter((p) => p.status === 'pending');
    if (toUpload.length === 0) return;

    setUploading(true);
    let uploaded = 0;
    let failed = 0;

    const updated = [...photos];

    for (let i = 0; i < updated.length; i++) {
      const photo = updated[i];
      if (photo.status !== 'pending') continue;

      updated[i] = { ...photo, status: 'uploading' };
      setPhotos([...updated]);

      try {
        const storagePath = `properties/${photo.propertyRef}/${Date.now()}_${photo.filename}`;

        const { error: uploadError } = await supabase.storage
          .from('property-photos')
          .upload(storagePath, photo.file, {
            contentType: photo.file.type || 'image/jpeg',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('property-photos')
          .getPublicUrl(storagePath);

        if (urlData?.publicUrl && photo.propertyRef) {
          // Insert into property_photos table with order and advertising flag
          await supabase.from('property_photos').insert({
            property_ref: photo.propertyRef,
            short_code: photo.shortCode || null,
            storage_path: storagePath,
            public_url: urlData.publicUrl,
            filename: photo.filename,
            display_order: photo.displayOrder,
            is_advertising: photo.isAdvertising,
          });

          // Set as primary photo_url if none exists
          const { data: existing } = await supabase
            .from('properties')
            .select('photo_url')
            .eq('property_ref', photo.propertyRef)
            .single();

          if (!(existing as any)?.photo_url) {
            await supabase
              .from('properties')
              .update({ photo_url: urlData.publicUrl } as any)
              .eq('property_ref', photo.propertyRef);
          }
        }

        updated[i] = { ...updated[i], status: 'success' };
        uploaded++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        updated[i] = { ...updated[i], status: 'error', error: msg };
        failed++;
      }

      setPhotos([...updated]);
    }

    setSummary((prev) => (prev ? { ...prev, uploaded, failed } : null));
    setUploading(false);
  }, [photos, supabase]);

  const reset = () => {
    photos.forEach((p) => { if (p.previewUrl) URL.revokeObjectURL(p.previewUrl); });
    setPhotos([]);
    setSummary(null);
    setZipName(null);
    setFilterMode('all');
    if (zipInputRef.current) zipInputRef.current.value = '';
    if (directInputRef.current) directInputRef.current.value = '';
  };

  // ── Filtered view ──────────────────────────────────────────────────────────

  const filteredPhotos = photos.filter((p) => {
    if (filterMode === 'matched') return p.status !== 'no-match';
    if (filterMode === 'unmatched') return p.status === 'no-match';
    return true;
  });

  const pendingCount = photos.filter((p) => p.status === 'pending').length;
  const advertisingCount = photos.filter((p) => p.isAdvertising && p.status !== 'no-match').length;
  const allAdvertising = pendingCount > 0 && photos.filter((p) => p.status === 'pending').every((p) => p.isAdvertising);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[hsl(214,20%,88%)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#1B4F8A]/10 flex items-center justify-center">
            <Icon name="ImageIcon" size={16} className="text-[#1B4F8A]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[hsl(215,25%,18%)]">Bulk Photo Import</h2>
            <p className="text-xs text-[hsl(215,15%,52%)]">
              Upload photos by short code — tick for advertising, drag to reorder
            </p>
          </div>
        </div>
        {photos.length > 0 && (
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
        {/* Upload mode tabs */}
        {!zipName && (
          <div className="flex gap-1 p-1 bg-[hsl(210,20%,97%)] rounded-lg">
            <button
              onClick={() => setUploadMode('zip')}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${uploadMode === 'zip' ? 'bg-white text-[#1B4F8A] shadow-sm' : 'text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)]'}`}
            >
              ZIP Archive
            </button>
            <button
              onClick={() => setUploadMode('direct')}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${uploadMode === 'direct' ? 'bg-white text-[#1B4F8A] shadow-sm' : 'text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)]'}`}
            >
              Select Files
            </button>
          </div>
        )}

        {/* Drop zone */}
        {!zipName ? (
          uploadMode === 'zip' ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => zipInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragOver
                  ? 'border-[#1B4F8A] bg-[#1B4F8A]/5'
                  : 'border-[hsl(214,20%,88%)] hover:border-[#1B4F8A]/50 hover:bg-[hsl(210,20%,97%)]'
              }`}
            >
              <div className="w-14 h-14 rounded-full bg-[hsl(210,20%,97%)] flex items-center justify-center mx-auto mb-3">
                <Icon name="FolderArchiveIcon" size={26} className="text-[hsl(215,15%,52%)]" />
              </div>
              <p className="text-sm font-medium text-[hsl(215,25%,18%)]">Drop your zipped photos folder here</p>
              <p className="text-xs text-[hsl(215,15%,52%)] mt-1">
                Accepts .zip files · Photos named starting with the property short code
              </p>
              <p className="text-[11px] text-[hsl(215,15%,52%)] mt-2 font-mono bg-[hsl(210,20%,97%)] inline-block px-2 py-1 rounded">
                e.g. SBL0001A-photo1.jpg · PAV0303A_living.jpg · CSL0603B.jpg
              </p>
              <input ref={zipInputRef} type="file" accept=".zip" className="hidden" onChange={handleFileChange} />
            </div>
          ) : (
            <div
              onClick={() => directInputRef.current?.click()}
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors border-[hsl(214,20%,88%)] hover:border-[#1B4F8A]/50 hover:bg-[hsl(210,20%,97%)]"
            >
              <div className="w-14 h-14 rounded-full bg-[hsl(210,20%,97%)] flex items-center justify-center mx-auto mb-3">
                <Icon name="ImageIcon" size={26} className="text-[hsl(215,15%,52%)]" />
              </div>
              <p className="text-sm font-medium text-[hsl(215,25%,18%)]">Click to select photos</p>
              <p className="text-xs text-[hsl(215,15%,52%)] mt-1">
                Select multiple image files · Named starting with the property short code
              </p>
              <input ref={directInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleDirectFilesChange} />
            </div>
          )
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(210,20%,97%)] border border-[hsl(214,20%,88%)]">
            <Icon name="FolderArchiveIcon" size={18} className="text-[#1B4F8A] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[hsl(215,25%,18%)] truncate">{zipName}</p>
              {processing && (
                <p className="text-xs text-[hsl(215,15%,52%)] flex items-center gap-1">
                  <Icon name="LoaderIcon" size={11} className="animate-spin" />
                  Extracting and matching photos…
                </p>
              )}
              {!processing && summary && (
                <p className="text-xs text-[hsl(215,15%,52%)]">
                  {summary.total} photos found · {summary.matched} matched · {summary.unmatched} unmatched
                </p>
              )}
            </div>
          </div>
        )}

        {/* Summary bar */}
        {summary && !processing && (
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Total', value: summary.total, color: 'text-[hsl(215,25%,18%)]', bg: 'bg-[hsl(210,20%,97%)]' },
              { label: 'Matched', value: summary.matched, color: 'text-[#1B4F8A]', bg: 'bg-[#1B4F8A]/5' },
              { label: 'Advertising', value: advertisingCount, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Uploaded', value: summary.uploaded, color: 'text-green-600', bg: 'bg-green-50' },
            ].map((s) => (
              <div key={s.label} className={`${s.bg} rounded-lg p-2.5 text-center`}>
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-[hsl(215,15%,52%)] font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Controls row */}
        {photos.length > 0 && !processing && (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Filter tabs */}
            <div className="flex gap-1">
              {(['all', 'matched', 'unmatched'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setFilterMode(mode)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filterMode === mode
                      ? 'bg-[#1B4F8A] text-white'
                      : 'bg-[hsl(210,20%,97%)] text-[hsl(215,25%,18%)] hover:bg-[hsl(214,20%,88%)]'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  {mode === 'all' && ` (${photos.length})`}
                  {mode === 'matched' && ` (${photos.filter((p) => p.status !== 'no-match').length})`}
                  {mode === 'unmatched' && ` (${photos.filter((p) => p.status === 'no-match').length})`}
                </button>
              ))}
            </div>
            {/* Select all advertising */}
            {pendingCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[hsl(215,15%,52%)]">Advertising:</span>
                <button
                  onClick={() => toggleAllAdvertising(true)}
                  className="px-2 py-1 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={() => toggleAllAdvertising(false)}
                  className="px-2 py-1 rounded text-xs font-medium bg-[hsl(210,20%,97%)] text-[hsl(215,15%,52%)] border border-[hsl(214,20%,88%)] hover:bg-[hsl(214,20%,88%)] transition-colors"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
        )}

        {/* Advertising info banner */}
        {pendingCount > 0 && !processing && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 flex gap-2">
            <Icon name="InfoIcon" size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              <strong>Tick the advertising checkbox</strong> to mark photos for website display. 
              <strong> Drag rows</strong> to set the display order. Photos marked for advertising will appear on the Homes R Us website when the property is published.
            </p>
          </div>
        )}

        {/* Photo grid with drag-to-reorder */}
        {filteredPhotos.length > 0 && !processing && (
          <div className="max-h-96 overflow-y-auto rounded-lg border border-[hsl(214,20%,88%)]">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-[hsl(210,20%,97%)] z-10">
                <tr>
                  <th className="px-2 py-2 text-left font-semibold text-[hsl(215,25%,18%)] w-6">
                    <Icon name="GripVerticalIcon" size={12} className="text-[hsl(215,15%,52%)]" />
                  </th>
                  <th className="px-2 py-2 text-left font-semibold text-[hsl(215,25%,18%)] w-8">#</th>
                  <th className="px-2 py-2 text-left font-semibold text-[hsl(215,25%,18%)] w-12">Photo</th>
                  <th className="px-2 py-2 text-left font-semibold text-[hsl(215,25%,18%)]">Filename</th>
                  <th className="px-2 py-2 text-left font-semibold text-[hsl(215,25%,18%)]">Short Code</th>
                  <th className="px-2 py-2 text-left font-semibold text-[hsl(215,25%,18%)]">Matched Property</th>
                  <th className="px-2 py-2 text-center font-semibold text-[hsl(215,25%,18%)] w-24">
                    <div className="flex items-center justify-center gap-1">
                      <Icon name="MonitorIcon" size={11} className="text-emerald-600" />
                      Advertise
                    </div>
                  </th>
                  <th className="px-2 py-2 text-left font-semibold text-[hsl(215,25%,18%)]">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredPhotos.map((photo, i) => (
                  <tr
                    key={photo.id}
                    draggable={photo.status !== 'no-match'}
                    onDragStart={(e) => handlePhotoDragStart(e, photo.id)}
                    onDragOver={(e) => handlePhotoDragOver(e, photo.id)}
                    onDrop={(e) => handlePhotoDrop(e, photo.id)}
                    onDragEnd={handlePhotoDragEnd}
                    className={`border-t border-[hsl(214,20%,88%)] transition-colors ${
                      dragOverPhotoId === photo.id ? 'bg-[#1B4F8A]/5 border-t-2 border-t-[#1B4F8A]' : 'hover:bg-[hsl(210,20%,97%)]'
                    } ${dragPhotoId === photo.id ? 'opacity-50' : ''} ${photo.status !== 'no-match' ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  >
                    <td className="px-2 py-2">
                      {photo.status !== 'no-match' && (
                        <Icon name="GripVerticalIcon" size={12} className="text-[hsl(215,15%,62%)]" />
                      )}
                    </td>
                    <td className="px-2 py-2 text-[hsl(215,15%,52%)] font-mono">{i + 1}</td>
                    <td className="px-2 py-2">
                      {photo.previewUrl ? (
                        <img
                          src={photo.previewUrl}
                          alt={photo.filename}
                          className="w-9 h-9 object-cover rounded-md border border-[hsl(214,20%,88%)]"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-md bg-[hsl(210,20%,97%)] flex items-center justify-center">
                          <Icon name="ImageIcon" size={14} className="text-[hsl(215,15%,52%)]" />
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2 font-mono text-[hsl(215,25%,18%)] max-w-[120px] truncate" title={photo.filename}>
                      {photo.filename}
                    </td>
                    <td className="px-2 py-2">
                      <span className="px-1.5 py-0.5 rounded bg-[hsl(210,20%,97%)] border border-[hsl(214,20%,88%)] font-mono text-[#1B4F8A] font-semibold">
                        {photo.shortCode || '—'}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-[hsl(215,25%,18%)] max-w-[140px] truncate" title={photo.matchedProperty || ''}>
                      {photo.matchedProperty || (
                        <span className="text-amber-600 italic">No match found</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {photo.status !== 'no-match' ? (
                        <label className="inline-flex items-center justify-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={photo.isAdvertising}
                            onChange={() => toggleAdvertising(photo.id)}
                            className="sr-only"
                          />
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                            photo.isAdvertising
                              ? 'bg-emerald-500 border-emerald-500' :'bg-white border-[hsl(214,20%,75%)] hover:border-emerald-400'
                          }`}>
                            {photo.isAdvertising && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </label>
                      ) : (
                        <span className="text-[hsl(215,15%,62%)]">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {photo.status === 'pending' && (
                        <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">Ready</span>
                      )}
                      {photo.status === 'uploading' && (
                        <span className="px-1.5 py-0.5 rounded-full bg-[hsl(210,20%,97%)] text-[hsl(215,15%,52%)] flex items-center gap-1 w-fit">
                          <Icon name="LoaderIcon" size={10} className="animate-spin" />
                          Uploading
                        </span>
                      )}
                      {photo.status === 'success' && (
                        <span className="px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">Uploaded</span>
                      )}
                      {photo.status === 'error' && (
                        <span className="px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-medium" title={photo.error}>Failed</span>
                      )}
                      {photo.status === 'no-match' && (
                        <span className="px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">No match</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Unmatched hint */}
        {summary && summary.unmatched > 0 && !processing && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex gap-2">
            <Icon name="AlertTriangleIcon" size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              <strong>{summary.unmatched} photo{summary.unmatched > 1 ? 's' : ''}</strong> could not be matched to a property.
              Check that the filename starts with a valid building short code (e.g. <span className="font-mono">SBL0001A</span>, <span className="font-mono">PAV0303A</span>, <span className="font-mono">CSL0603B</span>).
              Unmatched photos will be skipped during upload.
            </p>
          </div>
        )}

        {/* Upload button */}
        {pendingCount > 0 && (
          <div className="space-y-2">
            {advertisingCount > 0 && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 flex items-center gap-2">
                <Icon name="MonitorIcon" size={13} className="text-emerald-600 flex-shrink-0" />
                <p className="text-xs text-emerald-700">
                  <strong>{advertisingCount} photo{advertisingCount !== 1 ? 's' : ''}</strong> marked for advertising — these will be shown on the Homes R Us website when the property is published.
                </p>
              </div>
            )}
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full py-2.5 rounded-lg bg-[#1B4F8A] text-white text-sm font-semibold hover:bg-[#1B4F8A]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Icon name="LoaderIcon" size={15} className="animate-spin" />
                  Uploading photos…
                </>
              ) : (
                <>
                  <Icon name="UploadCloudIcon" size={15} />
                  Upload {pendingCount} matched photo{pendingCount !== 1 ? 's' : ''} to properties
                </>
              )}
            </button>
          </div>
        )}

        {/* All done */}
        {summary && summary.uploaded > 0 && pendingCount === 0 && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-3 flex items-center gap-2">
            <Icon name="CheckCircleIcon" size={15} className="text-green-600" />
            <p className="text-xs text-green-700 font-medium">
              {summary.uploaded} photo{summary.uploaded !== 1 ? 's' : ''} uploaded and linked to their properties.
              {summary.failed > 0 && ` ${summary.failed} failed — check individual rows for details.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
