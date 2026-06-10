'use client';

/**
 * PhotoGalleryV2 — brand-new gallery component, no shared code with previous gallery.
 * Thumbnails use native <img> tags inside <button> elements with no drag attributes.
 * Drag-to-reorder is handled by a completely separate drag zone that does NOT overlap
 * the thumbnail click area.
 */

import React, { useState, useRef, useCallback } from 'react';

interface Photo {
  id: string;
  url: string;
}

interface PhotoGalleryV2Props {
  photos: Photo[];
  propertyLabel: string;
  onPhotosChange: (photos: Photo[]) => void;
  onUploadClick: () => void;
  uploading?: boolean;
  onSaveOrder?: (photos: Photo[]) => void;
}

export default function PhotoGalleryV2({
  photos,
  propertyLabel,
  onPhotosChange,
  onUploadClick,
  uploading = false,
  onSaveOrder,
}: PhotoGalleryV2Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const didDragRef = useRef(false);

  // Keep activeIndex in bounds when photos array changes
  const safeActive = Math.min(activeIndex, Math.max(0, photos.length - 1));

  // ── Thumbnail click ──────────────────────────────────────────────────────
  // Uses a plain React synthetic onClick — no pointer/drag interference.
  function selectPhoto(index: number) {
    setActiveIndex(index);
  }

  // ── Prev / Next ──────────────────────────────────────────────────────────
  function prevPhoto() {
    setActiveIndex((i) => (i - 1 + photos.length) % photos.length);
  }
  function nextPhoto() {
    setActiveIndex((i) => (i + 1) % photos.length);
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  function deletePhoto(index: number) {
    const updated = photos.filter((_, i) => i !== index);
    onPhotosChange(updated);
    setActiveIndex(Math.min(index, Math.max(0, updated.length - 1)));
  }

  // ── Drag-to-reorder (entire thumbnail is draggable) ──────────────────────
  const dragHandleDragStart = useCallback((e: React.DragEvent, index: number) => {
    didDragRef.current = false;
    setDragFrom(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }, []);

  const dragHandleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(index);
  }, []);

  const dragHandleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    didDragRef.current = true;
    const raw = e.dataTransfer.getData('text/plain');
    const fromIndex = raw !== '' ? parseInt(raw, 10) : dragFrom;
    if (fromIndex === null || fromIndex === dropIndex) {
      setDragFrom(null);
      setDragOver(null);
      return;
    }
    const updated = [...photos];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(dropIndex, 0, moved);
    onPhotosChange(updated);
    onSaveOrder?.(updated);
    setActiveIndex(dropIndex);
    setDragFrom(null);
    setDragOver(null);
  }, [photos, dragFrom, onPhotosChange, onSaveOrder]);

  const dragHandleDragEnd = useCallback(() => {
    setDragFrom(null);
    setDragOver(null);
  }, []);

  // ── Lightbox ─────────────────────────────────────────────────────────────
  function openLightbox(index: number) {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }

  if (photos.length === 0) {
    return (
      <div
        className="aspect-video rounded-xl bg-[hsl(210,15%,94%)] flex flex-col items-center justify-center border-2 border-dashed border-[hsl(214,20%,88%)] cursor-pointer hover:bg-[hsl(210,15%,91%)] transition-colors"
        onClick={onUploadClick}
      >
        <svg className="w-8 h-8 text-[hsl(215,15%,62%)] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-xs text-[hsl(215,15%,52%)]">Click to upload photos</span>
      </div>
    );
  }

  return (
    <>
      {/* ── Main viewer ─────────────────────────────────────────────────── */}
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photos[safeActive].url}
          alt={`${propertyLabel} — photo ${safeActive + 1}`}
          className="w-full h-full object-cover cursor-pointer"
          onClick={() => openLightbox(safeActive)}
        />

        {/* Counter */}
        <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full font-medium pointer-events-none">
          {safeActive + 1} / {photos.length}
        </div>

        {/* Expand */}
        <button
          type="button"
          className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full transition-colors opacity-0 group-hover:opacity-100"
          onClick={() => openLightbox(safeActive)}
          title="View fullscreen"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>

        {/* Delete */}
        <button
          type="button"
          className="absolute bottom-2 right-2 bg-red-500/80 hover:bg-red-600 text-white p-1.5 rounded-full transition-colors opacity-0 group-hover:opacity-100"
          onClick={() => deletePhoto(safeActive)}
          title="Delete photo"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>

        {/* Prev / Next */}
        {photos.length > 1 && (
          <>
            <button
              type="button"
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white p-1.5 rounded-full transition-colors opacity-0 group-hover:opacity-100"
              onClick={prevPhoto}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white p-1.5 rounded-full transition-colors opacity-0 group-hover:opacity-100"
              onClick={nextPhoto}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* ── Thumbnail strip ──────────────────────────────────────────────── */}
      <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
        {photos.map((photo, i) => (
          <div
            key={`v2-thumb-${photo.id}-${i}`}
            draggable
            onDragStart={(e) => dragHandleDragStart(e, i)}
            onDragEnd={dragHandleDragEnd}
            onDragOver={(e) => dragHandleDragOver(e, i)}
            onDrop={(e) => dragHandleDrop(e, i)}
            onClick={() => {
              if (!didDragRef.current) selectPhoto(i);
              didDragRef.current = false;
            }}
            title={`Photo ${i + 1} — drag to reorder, click to select`}
            className={`relative flex-shrink-0 w-14 h-10 rounded-md overflow-hidden transition-all cursor-grab active:cursor-grabbing select-none ${
              dragOver === i && dragFrom !== i
                ? 'ring-4 ring-[#1B4F8A] ring-offset-1 scale-110'
                : dragFrom === i
                ? 'opacity-40 border-2 border-dashed border-[hsl(214,20%,78%)]'
                : i === safeActive
                ? 'ring-4 ring-[#1B4F8A] ring-offset-2 border-2 border-[#1B4F8A] scale-105'
                : 'border-2 border-transparent hover:border-[hsl(214,20%,78%)]'
            }`}
          >
            {/* Thumbnail image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={`Thumbnail ${i + 1}`}
              className="w-full h-full object-cover pointer-events-none"
              draggable={false}
            />

            {/* Drag handle indicator — top-right corner, always visible on hover */}
            <div
              className="absolute top-0.5 right-0.5 z-20 w-4 h-4 bg-black/50 rounded-sm flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
              aria-hidden="true"
            >
              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 6a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm8-16a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4z" />
              </svg>
            </div>

            {/* Cover badge */}
            {i === 0 && (
              <div className="absolute bottom-0 left-0 right-0 z-10 bg-[#1B4F8A]/80 text-white text-[8px] text-center font-semibold py-0.5 pointer-events-none">
                COVER
              </div>
            )}
          </div>
        ))}

        {/* Add more button */}
        <button
          type="button"
          onClick={onUploadClick}
          disabled={uploading}
          className="flex-shrink-0 w-14 h-10 rounded-md border-2 border-dashed border-[hsl(214,20%,78%)] flex items-center justify-center hover:bg-[hsl(210,15%,94%)] transition-colors"
          title="Add photos"
        >
          {uploading ? (
            <svg className="w-4 h-4 text-[hsl(215,15%,52%)] animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-[hsl(215,15%,52%)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          )}
        </button>
      </div>

      {/* Caption */}
      <p className="text-[10px] text-[hsl(215,15%,62%)] mt-1">
        {photos.length} photo{photos.length !== 1 ? 's' : ''} · Drag handle (top-right of thumbnail) to reorder · Click thumbnail to select
      </p>

      {/* ── Lightbox ─────────────────────────────────────────────────────── */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/25 text-white p-2 rounded-full transition-colors z-10"
            onClick={() => setLightboxOpen(false)}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-sm font-medium">
            {lightboxIndex + 1} / {photos.length}
          </div>

          <div
            className="relative max-w-5xl max-h-[80vh] w-full px-12"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[lightboxIndex]?.url}
              alt={`${propertyLabel} — photo ${lightboxIndex + 1}`}
              className="w-full h-full object-contain max-h-[75vh] rounded-lg"
            />
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  className="absolute left-0 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/25 text-white p-2.5 rounded-full transition-colors"
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => (i - 1 + photos.length) % photos.length); }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="absolute right-0 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/25 text-white p-2.5 rounded-full transition-colors"
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => (i + 1) % photos.length); }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* Lightbox thumbnails */}
          <div
            className="flex gap-1.5 mt-4 overflow-x-auto max-w-2xl px-4"
            onClick={(e) => e.stopPropagation()}
          >
            {photos.map((photo, i) => (
              <button
                key={`lb-v2-${i}`}
                type="button"
                onClick={() => setLightboxIndex(i)}
                className={`flex-shrink-0 w-14 h-10 rounded-md overflow-hidden border-2 transition-all ${
                  i === lightboxIndex ? 'border-white ring-1 ring-white/40 scale-105' : 'border-white/20 hover:border-white/50'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={`Thumbnail ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>

          {/* Delete in lightbox */}
          <button
            type="button"
            className="absolute bottom-4 right-4 bg-red-500/80 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              const updated = photos.filter((_, i) => i !== lightboxIndex);
              onPhotosChange(updated);
              if (updated.length === 0) { setLightboxOpen(false); return; }
              setLightboxIndex(Math.min(lightboxIndex, updated.length - 1));
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete photo
          </button>
        </div>
      )}
    </>
  );
}
