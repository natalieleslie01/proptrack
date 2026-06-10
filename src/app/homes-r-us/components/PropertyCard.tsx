'use client';

import React from 'react';
import { PublicProperty } from './HomesRUsClient';

interface PropertyCardProps {
  property: PublicProperty;
  onView: () => void;
  onEnquire: () => void;
}

function formatPrice(value: number): string {
  if (value >= 1_000_000) return `HK$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `HK$${(value / 1_000).toFixed(0)}K`;
  return `HK$${value.toLocaleString()}`;
}

function formatRent(value: number): string {
  return `HK$${value.toLocaleString()}/mo`;
}

function StatusBadge({ status }: { status: PublicProperty['status'] }) {
  const map = {
    'for-sale': { label: 'For Sale', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    'for-rent': { label: 'For Rent', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    'for-sale-and-rent': { label: 'Sale & Rent', bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  };
  const s = map[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${s.bg} ${s.text} ${s.border}`}>
      {s.label}
    </span>
  );
}

export default function PropertyCard({ property, onView, onEnquire }: PropertyCardProps) {
  const locationParts = [property.building_name || property.village, property.phase, property.block].filter(Boolean);
  const locationStr = locationParts.join(' · ');
  const firstPhoto = property.photos && property.photos.length > 0 ? property.photos[0] : null;

  // Build feature pills
  const features: string[] = [];
  if (property.balcony) features.push('Balcony');
  if (property.terrace) features.push('Terrace');
  if (property.garden) features.push('Garden');
  if (property.pool) features.push('Pool');
  if (property.roof) features.push('Roof Top');
  if (property.duplex) features.push('Duplex');
  if (property.matterport_link) features.push('3D Tour');

  return (
    <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden shadow-sm hover:shadow-[0_4px_12px_rgba(27,79,138,0.12)] transition-all duration-200 group flex flex-col">
      {/* Photo */}
      <div
        className="relative h-48 bg-gradient-to-br from-[#E8D5C0] to-[#F5EFE6] cursor-pointer overflow-hidden"
        onClick={onView}
      >
        {firstPhoto ? (
          <img
            src={firstPhoto.public_url}
            alt={firstPhoto.filename || `${property.property_ref} property photo`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-12 h-12 text-[#C9A074]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </div>
        )}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <StatusBadge status={property.status} />
          {property.photos && property.photos.length > 1 && (
            <span className="bg-black/40 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full">
              {property.photos.length} photos
            </span>
          )}
        </div>
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-md px-2 py-0.5">
          <span className="text-[11px] font-mono font-semibold text-[hsl(215,25%,18%)]">{property.property_ref}</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        {/* Price */}
        <div className="flex items-baseline gap-2 mb-1 flex-wrap">
          {property.asking_price && (
            <span className="text-[#1B4F8A] font-bold text-lg leading-none">{formatPrice(property.asking_price)}</span>
          )}
          {property.asking_rent && (
            <span className={`font-semibold leading-none ${property.asking_price ? 'text-sm text-[hsl(215,15%,52%)]' : 'text-[#1B4F8A] text-lg'}`}>
              {formatRent(property.asking_rent)}
            </span>
          )}
        </div>

        {/* Location */}
        <p className="text-[hsl(215,15%,52%)] text-xs mb-3 truncate">{locationStr || property.address || 'Discovery Bay'}</p>

        {/* Specs row */}
        <div className="flex items-center gap-4 text-[hsl(215,25%,18%)] text-xs mb-3">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-[hsl(215,15%,52%)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            <span className="font-medium">{property.bedrooms === 0 ? 'Studio' : property.bedrooms}</span> bed
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-[hsl(215,15%,52%)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">{property.bathrooms}</span> bath
          </span>
          {property.saleable_area && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-[hsl(215,15%,52%)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
              <span className="font-medium">{property.saleable_area}</span> ft²
            </span>
          )}
        </div>

        {/* Feature pills */}
        {features.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {features.slice(0, 3).map((f) => (
              <span key={f} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${f === '3D Tour' ? 'bg-[#1B4F8A]/10 text-[#1B4F8A] border-[#1B4F8A]/20' : 'bg-[#F5EFE6] text-[#6B4226] border-[#E8D5C0]'}`}>
                {f}
              </span>
            ))}
            {features.length > 3 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-[hsl(210,20%,97%)] text-[hsl(215,15%,52%)] border border-[hsl(214,20%,88%)]">
                +{features.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-auto">
          <button
            onClick={onView}
            className="flex-1 px-3 py-2 bg-[hsl(210,15%,94%)] text-[hsl(215,25%,18%)] text-xs font-semibold rounded-lg hover:bg-[hsl(214,20%,88%)] transition-all duration-150"
          >
            View Details
          </button>
          <button
            onClick={onEnquire}
            className="flex-1 px-3 py-2 bg-[#1B4F8A] text-white text-xs font-semibold rounded-lg hover:bg-[#163f6e] transition-all duration-150"
          >
            Enquire
          </button>
        </div>
      </div>
    </div>
  );
}
