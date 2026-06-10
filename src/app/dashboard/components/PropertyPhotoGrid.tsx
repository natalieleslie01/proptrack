'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

// ── Types ──────────────────────────────────────────────────────────────────────
interface PropertyRow {
  id: string;
  property_ref: string;
  short_code: string | null;
  village: string;
  unit: string | null;
  address: string | null;
  status: string | null;
  building_name: string | null;
  photo_url: string | null;
  photo_count: number;
}

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  'for-rent':          { label: 'Active',       color: 'bg-emerald-500' },
  'for-sale':          { label: 'For Sale',      color: 'bg-blue-500'   },
  'for-sale-and-rent': { label: 'Sale & Rent',   color: 'bg-violet-500' },
  'self-occupy':       { label: 'Self Occupy',   color: 'bg-slate-400'  },
  'leased':            { label: 'Leased',        color: 'bg-blue-600'   },
};

const ALL_STATUSES = Object.keys(STATUS_CONFIG);

// ── Component ──────────────────────────────────────────────────────────────────
export default function PropertyPhotoGrid() {
  const [filter, setFilter] = useState<string>('all');
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const supabase = createClient();

        // 1. Fetch all properties (id, property_ref, short_code, village, unit, address, status, building_name)
        const { data: props, error: propErr } = await supabase
          .from('properties')
          .select('id, property_ref, short_code, village, unit, address, status, building_name')
          .order('property_ref', { ascending: true });

        if (propErr || !props || cancelled) return;

        // 2. Collect all property_refs that have photos (fetch first photo per property_ref)
        //    We do a single query for the lowest display_order photo per property_ref
        const refs = props.map((p) => p.property_ref).filter(Boolean);

        // Fetch one photo per property_ref using a select with limit trick:
        // We'll fetch all photos ordered by display_order and deduplicate client-side
        const { data: photos } = await supabase
          .from('property_photos')
          .select('property_ref, public_url, display_order')
          .in('property_ref', refs)
          .order('display_order', { ascending: true });

        if (cancelled) return;

        // Build a map: property_ref → { url, count }
        const photoMap = new Map<string, { url: string; count: number }>();
        if (photos) {
          // Count photos per ref
          const countMap = new Map<string, number>();
          for (const ph of photos) {
            countMap.set(ph.property_ref, (countMap.get(ph.property_ref) ?? 0) + 1);
          }
          // First occurrence (lowest display_order) per ref
          for (const ph of photos) {
            if (!photoMap.has(ph.property_ref)) {
              photoMap.set(ph.property_ref, {
                url: ph.public_url,
                count: countMap.get(ph.property_ref) ?? 1,
              });
            }
          }
        }

        // 3. Merge
        const merged: PropertyRow[] = props.map((p) => {
          const photoEntry = photoMap.get(p.property_ref);
          return {
            id: p.id,
            property_ref: p.property_ref,
            short_code: p.short_code,
            village: p.village ?? 'Discovery Bay',
            unit: p.unit,
            address: p.address,
            status: p.status,
            building_name: p.building_name,
            photo_url: photoEntry?.url ?? null,
            photo_count: photoEntry?.count ?? 0,
          };
        });

        if (!cancelled) {
          setProperties(merged);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // ── Filter ─────────────────────────────────────────────────────────────────
  const presentStatuses = ALL_STATUSES.filter((s) =>
    properties.some((p) => p.status === s)
  );

  const filtered = filter === 'all'
    ? properties
    : properties.filter((p) => p.status === filter);

  const displayedProperties = filtered.slice(0, 20);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(214,20%,88%)]">
        <div>
          <h2 className="text-base font-semibold text-[hsl(215,25%,18%)]">Property Condition Overview</h2>
          <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">
            Discovery Bay, Lantau Island · {Math.min(filtered.length, 20)} of {properties.length} properties
          </p>
        </div>
        <Link href="/property-management">
          <button className="btn-ghost py-1.5 text-xs">View All</button>
        </Link>
      </div>

      {/* Filter Pills */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-[hsl(214,20%,88%)] overflow-x-auto scrollbar-thin">
        {/* All pill */}
        <button
          onClick={() => setFilter('all')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150 border ${
            filter === 'all' ?'bg-[#1B4F8A] text-white border-[#1B4F8A]' :'bg-white text-[hsl(215,15%,52%)] border-[hsl(214,20%,88%)] hover:border-[#1B4F8A] hover:text-[#1B4F8A]'
          }`}
        >
          All
          <span className={`ml-0.5 ${filter === 'all' ? 'text-blue-200' : 'text-[hsl(215,15%,65%)]'}`}>
            {properties.length}
          </span>
        </button>

        {presentStatuses.map((s) => {
          const cfg = STATUS_CONFIG[s];
          const count = properties.filter((p) => p.status === s).length;
          if (count === 0) return null;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150 border ${
                filter === s
                  ? 'bg-[#1B4F8A] text-white border-[#1B4F8A]'
                  : 'bg-white text-[hsl(215,15%,52%)] border-[hsl(214,20%,88%)] hover:border-[#1B4F8A] hover:text-[#1B4F8A]'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.color}`} />
              {cfg.label}
              <span className={`ml-0.5 ${filter === s ? 'text-blue-200' : 'text-[hsl(215,15%,65%)]'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="p-10 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#1B4F8A] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Photo Grid */}
      {!loading && (
        <div className="p-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {displayedProperties.map((property) => {
            const cfg = STATUS_CONFIG[property.status ?? ''] ?? { label: 'Unknown', color: 'bg-gray-400' };
            const label = property.unit
              ? `${property.unit}${property.building_name ? `, ${property.building_name}` : ''}`
              : property.address ?? property.property_ref;

            return (
              <div
                key={property.id}
                className="group rounded-xl overflow-hidden border border-[hsl(214,20%,88%)] hover:shadow-md transition-shadow duration-200 cursor-pointer"
              >
                {/* Photo */}
                <div className="relative aspect-[4/3] bg-[hsl(210,20%,96%)] overflow-hidden">
                  {property.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={property.photo_url}
                      alt={label}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                        const parent = (e.currentTarget as HTMLImageElement).parentElement;
                        if (parent) {
                          const placeholder = parent.querySelector('[data-placeholder]') as HTMLElement | null;
                          if (placeholder) placeholder.style.display = 'flex';
                        }
                      }}
                    />
                  ) : null}

                  {/* No-photo placeholder (always rendered, hidden when photo loads) */}
                  <div
                    data-placeholder
                    className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-[hsl(215,15%,65%)] absolute inset-0"
                    style={{ display: property.photo_url ? 'none' : 'flex' }}
                  >
                    <Icon name="ImageIcon" size={28} />
                    <span className="text-[10px] font-medium">No photo</span>
                  </div>

                  {/* Status badge */}
                  <div className="absolute top-2 left-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-sm ${cfg.color}`}>
                      <span className="w-1 h-1 rounded-full bg-white/70" />
                      {cfg.label}
                    </span>
                  </div>

                  {/* Photo count badge */}
                  {property.photo_count > 1 && (
                    <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                      <Icon name="ImageIcon" size={10} />
                      {property.photo_count}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className="text-xs font-bold text-[hsl(215,25%,18%)] leading-tight truncate">
                    {label}
                  </p>
                  <p className="text-[10px] text-[hsl(215,15%,52%)] mt-0.5 truncate">
                    {property.village}, Lantau Island
                  </p>
                </div>
              </div>
            );
          })}

          {displayedProperties.length === 0 && (
            <div className="col-span-full py-10 text-center text-sm text-[hsl(215,15%,52%)]">
              No properties found for this filter.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
