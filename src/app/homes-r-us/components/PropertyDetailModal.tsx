'use client';

import React, { useState, useEffect } from 'react';
import { PublicProperty } from './HomesRUsClient';

interface PropertyDetailModalProps {
  property: PublicProperty;
  onClose: () => void;
  onEnquire: () => void;
}

function formatPrice(value: number): string {
  if (value >= 1_000_000) return `HK$${(value / 1_000_000).toFixed(2)}M`;
  return `HK$${value.toLocaleString()}`;
}

function formatRent(value: number): string {
  return `HK$${value.toLocaleString()} / month`;
}

function StatusBadge({ status }: { status: PublicProperty['status'] }) {
  const map = {
    'for-sale': { label: 'For Sale', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    'for-rent': { label: 'For Rent', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    'for-sale-and-rent': { label: 'For Sale & Rent', bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  };
  const s = map[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${s.bg} ${s.text} ${s.border}`}>
      {s.label}
    </span>
  );
}

function FeaturePill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#F5EFE6] border border-[#E8D5C0] text-[#6B4226]">
      {label}
    </span>
  );
}

export default function PropertyDetailModal({ property, onClose, onEnquire }: PropertyDetailModalProps) {
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && property.photos && property.photos.length > 1) {
        setActivePhotoIdx((i) => (i + 1) % (property.photos?.length ?? 1));
      }
      if (e.key === 'ArrowLeft' && property.photos && property.photos.length > 1) {
        setActivePhotoIdx((i) => (i - 1 + (property.photos?.length ?? 1)) % (property.photos?.length ?? 1));
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, property.photos]);

  const locationParts = [
    property.building_name || null,
    property.village,
    property.phase,
    property.block ? `Block ${property.block}` : null,
    property.floor ? `Floor ${property.floor}` : null,
    property.unit ? `Unit ${property.unit}` : null,
  ].filter(Boolean);

  const photos = property.photos || [];
  const activePhoto = photos[activePhotoIdx];

  // Build additional features list
  const features: string[] = [];
  if (property.balcony) features.push('Balcony');
  if (property.terrace) features.push('Terrace');
  if (property.garden) features.push('Garden');
  if (property.pool) features.push('Pool');
  if (property.roof) features.push('Roof Top');
  if (property.duplex) features.push('Duplex');
  if (property.combined) features.push('Combined');
  if (property.openkitch) features.push('Open Kitchen');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-[0_20px_60px_rgba(27,79,138,0.18)] w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Photo gallery */}
        <div className="relative h-64 bg-gradient-to-br from-[#E8D5C0] to-[#F5EFE6] rounded-t-2xl overflow-hidden">
          {photos.length > 0 && activePhoto ? (
            <>
              <img
                src={activePhoto.public_url}
                alt={activePhoto.filename || `${property.property_ref} photo ${activePhotoIdx + 1}`}
                className="w-full h-full object-cover"
              />
              {photos.length > 1 && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); setActivePhotoIdx((i) => (i - 1 + photos.length) % photos.length); }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center transition-colors"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setActivePhotoIdx((i) => (i + 1) % photos.length); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center transition-colors"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {photos.map((_, i) => (
                      <button
                        key={i}
                        onClick={(e) => { e.stopPropagation(); setActivePhotoIdx(i); }}
                        className={`w-1.5 h-1.5 rounded-full transition-all ${i === activePhotoIdx ? 'bg-white w-4' : 'bg-white/50 hover:bg-white/80'}`}
                      />
                    ))}
                  </div>
                  <div className="absolute bottom-3 right-3 bg-black/40 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
                    {activePhotoIdx + 1} / {photos.length}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-16 h-16 text-[#C9A074]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
          )}
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <StatusBadge status={property.status} />
          </div>
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <span className="bg-white/90 backdrop-blur-sm rounded-md px-2.5 py-1 text-xs font-mono font-semibold text-[hsl(215,25%,18%)]">
              {property.property_ref}
            </span>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-all"
            >
              <svg className="w-4 h-4 text-[hsl(215,25%,18%)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Thumbnail strip */}
        {photos.length > 1 && (
          <div className="flex gap-1.5 px-4 py-2 bg-[#F5EFE6] border-b border-[#E8D5C0] overflow-x-auto">
            {photos.map((ph, i) => (
              <button
                key={i}
                onClick={() => setActivePhotoIdx(i)}
                className={`flex-shrink-0 w-12 h-12 rounded-md overflow-hidden border-2 transition-all ${i === activePhotoIdx ? 'border-[#8B1A2B]' : 'border-transparent hover:border-[#D9BB9A]'}`}
              >
                <img src={ph.public_url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Price */}
          <div className="flex items-start justify-between gap-4">
            <div>
              {property.asking_price && (
                <div className="text-[#1B4F8A] font-bold text-2xl leading-none mb-1">{formatPrice(property.asking_price)}</div>
              )}
              {property.asking_rent && (
                <div className={`font-semibold ${property.asking_price ? 'text-base text-[hsl(215,15%,52%)]' : 'text-[#1B4F8A] text-2xl'}`}>
                  {formatRent(property.asking_rent)}
                </div>
              )}
            </div>
            {property.building_name && (
              <div className="text-right">
                <p className="text-xs font-semibold text-[#8B1A2B]">{property.building_name}</p>
                <p className="text-xs text-[hsl(215,15%,52%)]">{property.village}</p>
              </div>
            )}
          </div>

          {/* Location */}
          <p className="text-[hsl(215,15%,52%)] text-sm flex items-center gap-1.5">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            {locationParts.join(', ') || property.address || 'Discovery Bay, Hong Kong'}
          </p>

          {/* Key specs grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Bedrooms', value: property.bedrooms === 0 ? 'Studio' : property.bedrooms || '—' },
              { label: 'Bathrooms', value: property.bathrooms || '—' },
              { label: 'Saleable', value: property.saleable_area ? `${property.saleable_area} ft²` : '—' },
              { label: 'Gross Area', value: property.gross_area ? `${property.gross_area} ft²` : (property.outside_sc ? `${property.outside_sc} ft²` : '—') },
            ].map((spec) => (
              <div key={spec.label} className="bg-[#F5EFE6] border border-[#E8D5C0] rounded-xl p-3 text-center">
                <div className="text-[hsl(215,25%,18%)] font-bold text-base">{spec.value}</div>
                <div className="text-[hsl(215,15%,52%)] text-[11px] font-medium">{spec.label}</div>
              </div>
            ))}
          </div>

          {/* Property details */}
          {(property.direction_id || property.view_id || property.prop_types || property.furn_id) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {property.direction_id && (
                <div className="bg-[#F5EFE6] border border-[#E8D5C0] rounded-lg px-3 py-2">
                  <p className="text-[10px] text-[hsl(215,15%,52%)] font-medium mb-0.5">Direction</p>
                  <p className="text-xs font-semibold text-[hsl(215,25%,18%)]">{property.direction_id}</p>
                </div>
              )}
              {property.view_id && (
                <div className="bg-[#F5EFE6] border border-[#E8D5C0] rounded-lg px-3 py-2">
                  <p className="text-[10px] text-[hsl(215,15%,52%)] font-medium mb-0.5">View</p>
                  <p className="text-xs font-semibold text-[hsl(215,25%,18%)]">{property.view_id}</p>
                </div>
              )}
              {property.prop_types && (
                <div className="bg-[#F5EFE6] border border-[#E8D5C0] rounded-lg px-3 py-2">
                  <p className="text-[10px] text-[hsl(215,15%,52%)] font-medium mb-0.5">Building Type</p>
                  <p className="text-xs font-semibold text-[hsl(215,25%,18%)]">{property.prop_types}</p>
                </div>
              )}
              {property.furn_id && (
                <div className="bg-[#F5EFE6] border border-[#E8D5C0] rounded-lg px-3 py-2">
                  <p className="text-[10px] text-[hsl(215,15%,52%)] font-medium mb-0.5">Furnishing</p>
                  <p className="text-xs font-semibold text-[hsl(215,25%,18%)]">{property.furn_id}</p>
                </div>
              )}
            </div>
          )}

          {/* Additional features */}
          {features.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-2">Additional Features</p>
              <div className="flex flex-wrap gap-1.5">
                {features.map((f) => <FeaturePill key={f} label={f} />)}
              </div>
            </div>
          )}

          {/* Description */}
          {(property.p_english || property.notes) && (
            <div className="bg-[#F5EFE6] border border-[#E8D5C0] rounded-xl p-4">
              <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-1.5">About this property</p>
              <p className="text-sm text-[hsl(215,25%,18%)] leading-relaxed">{property.p_english || property.notes}</p>
            </div>
          )}

          {/* Matterport 3D Tour */}
          {property.matterport_link && (
            <div className="bg-[#1B4F8A]/5 border border-[#1B4F8A]/20 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#1B4F8A]/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-[#1B4F8A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#1B4F8A]">3D Virtual Tour Available</p>
                  <p className="text-xs text-[hsl(215,15%,52%)]">Explore this property in immersive 3D</p>
                </div>
                <a
                  href={property.matterport_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 px-3 py-1.5 bg-[#1B4F8A] text-white text-xs font-semibold rounded-lg hover:bg-[#163f6e] transition-colors"
                >
                  View Tour
                </a>
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-[hsl(210,15%,94%)] text-[hsl(215,25%,18%)] text-sm font-semibold rounded-lg hover:bg-[hsl(214,20%,88%)] transition-all duration-150"
            >
              Close
            </button>
            <button
              onClick={onEnquire}
              className="flex-1 px-4 py-2.5 bg-[#8B1A2B] text-white text-sm font-semibold rounded-lg hover:bg-[#6E1522] transition-all duration-150 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              Enquire About This Property
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
