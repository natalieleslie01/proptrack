'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';
import { Property, ContactStatus, PROPERTY_STATUS_OPTIONS } from './mockData';
import PropertyDetailModal from './PropertyDetailModal';
import ViewingSchedule from './ViewingSchedule';
import BulkViewingSchedule from './BulkViewingSchedule';
import AddPropertyModal from './AddPropertyModal';
import { toast } from 'sonner';
import { usePropertiesRealtime, useViewingsRealtime, RealtimeEvent } from '@/hooks/useRealtimeSync';
import { useRole } from '@/hooks/useRole';
import { createClient } from '@/lib/supabase/client';

// ── Property Thumbnail Component ───────────────────────────────────────────────
function PropertyThumbnail({ propertyId, propertyRef }: { propertyId: string; propertyRef?: string }) {
  const [thumbUrl, setThumbUrl] = React.useState<string | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    async function fetchThumb() {
      try {
        const supabase = createClient();
        // First try property_photos table (bulk import source)
        if (propertyRef) {
          const { data: rows } = await supabase
            .from('property_photos')
            .select('public_url')
            .eq('property_ref', propertyRef)
            .order('display_order', { ascending: true })
            .limit(1);
          if (!cancelled && rows && rows.length > 0) {
            setThumbUrl(rows[0].public_url);
            return;
          }
        }
        // Fallback: list files from property-documents storage bucket
        const { data: files } = await supabase.storage
          .from('property-documents')
          .list(`property-photos/${propertyId}`, { limit: 1, sortBy: { column: 'created_at', order: 'asc' } });
        if (!cancelled && files && files.length > 0) {
          const { data: urlData } = supabase.storage
            .from('property-documents')
            .getPublicUrl(`property-photos/${propertyId}/${files[0].name}`);
          if (urlData?.publicUrl) setThumbUrl(urlData.publicUrl);
        }
      } catch {
        // silently ignore
      }
    }
    fetchThumb();
    return () => { cancelled = true; };
  }, [propertyId, propertyRef]);

  if (!thumbUrl) {
    return (
      <div className="w-24 h-16 rounded bg-[hsl(210,15%,94%)] border border-[hsl(214,20%,88%)] flex items-center justify-center flex-shrink-0">
        <Icon name="ImageIcon" size={18} className="text-[hsl(215,15%,72%)]" />
      </div>
    );
  }

  return (
    <div className="w-24 h-16 rounded overflow-hidden border border-[hsl(214,20%,88%)] flex-shrink-0 bg-[hsl(210,15%,94%)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumbUrl}
        alt="Property photo"
        className={`w-full h-full object-cover transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
        onError={() => setThumbUrl(null)}
      />
    </div>
  );
}

const villages = [
  'All Villages',
  'Amalfi',
  'Bijou Hamlet',
  'Capeland Drive',
  'Caperidge Drive',
  'Capevale Drive',
  'Chianti',
  'Coastline Villa',
  'Crestmont Villa',
  'Db Plaza',
  'Greenvale Village',
  'Headland Drive',
  'Hillgrove Village',
  'IL Picco',
  'La Costa',
  'La Serene',
  'La Vista',
  'Middle Lane',
  'Midvale Village',
  'Neo Horizon',
  'Parkland Drive',
  'Parkridge Drive',
  'Parkridge Village',
  'Parkvale Drive',
  'Parkvale Village',
  'Poggibonsi',
  'Positano',
  'Seabee Lane',
  'Seabird Lane',
  'Seahorse Lane',
  'Siena One',
  'Siena Two',
  'Twilight Court',
];
const contactStatuses: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All Contact' },
  { value: 'active', label: 'Active' },
  { value: 'no-contact', label: 'No Contact' },
  { value: 'unknown', label: 'Unknown' },
];
const statuses: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All Statuses' },
  ...PROPERTY_STATUS_OPTIONS.map((o) => ({ value: String(o.value), label: o.label })),
];
const occupancies: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All Occupancy' },
  { value: 'vacant', label: 'Vacant' },
  { value: 'vacant-soon', label: 'Vacant Soon' },
  { value: 'leased', label: 'Leased' },
  { value: 'with-ta', label: 'With TA' },
];
const validationStatuses: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All Validation' },
  { value: 'valid', label: 'Valid' },
  { value: 'warning', label: 'Warning' },
  { value: 'invalid', label: 'Invalid' },
  { value: 'pending', label: 'Pending' },
];

type SortKey = keyof Property | 'none';
type SortDir = 'asc' | 'desc';

/** Returns true if lease ends within 3 months from today */
function isLeaseExpiringSoon(leaseEnd: string): boolean {
  try {
    const [d, m, y] = leaseEnd.split('/').map(Number);
    const leaseDate = new Date(y, m - 1, d);
    const now = new Date();
    const threeMonths = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
    return leaseDate >= now && leaseDate <= threeMonths;
  } catch {
    return false;
  }
}

/** Derives flat label (last 3 chars) and floor number from a short_code.
 *  e.g. "H020009A" → { flat: "9A", floor: "9" }
 *  Strips leading zeros from the floor portion.
 *  For 3-digit block+floor codes like "309" (Block 3, Floor 9),
 *  the floor is extracted as the last 2 digits stripped of leading zeros.
 */
function parseFlatFromShortCode(shortCode?: string): { flat: string; floor: string } | null {
  if (!shortCode || shortCode.length < 3) return null;
  const flat = shortCode.slice(-3).replace(/^0+/, '') || shortCode.slice(-3);
  // Floor is the numeric portion of the flat label (leading digits)
  const floorMatch = flat.match(/^(\d+)/);
  if (!floorMatch) return { flat, floor: '' };
  const rawFloor = floorMatch[1];
  // If the numeric portion is exactly 3 digits and first digit is non-zero,
  // it encodes Block + Floor (e.g. "309" = Block 3, Floor 9)
  let floor: string;
  if (/^[1-9]\d{2}$/.test(rawFloor)) {
    floor = String(parseInt(rawFloor.slice(1), 10));
  } else {
    floor = String(parseInt(rawFloor, 10));
  }
  return { flat, floor };
}

/**
 * Formats a floor value for display.
 * If the value is a 3-digit number (e.g. "309"), it is interpreted as
 * Block <first digit>, Floor <remaining digits stripped of leading zeros>.
 * e.g. "309" → "Block 3, Floor 9"  |  "308" → "Block 3, Floor 8" * Other values (e.g."9", "G", "LG") are returned as-is.
 */
function formatFloorDisplay(floor?: string | null): string {
  if (!floor) return '—';
  const trimmed = floor.trim();
  if (/^[1-9]\d{2}$/.test(trimmed)) {
    const block = trimmed[0];
    const floorNum = String(parseInt(trimmed.slice(1), 10));
    return `Block ${block}, Floor ${floorNum}`;
  }
  return trimmed;
}

function contactStatusBadge(status?: ContactStatus) {
  if (!status || status === 'active') return null;
  if (status === 'no-contact') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] font-semibold border border-red-200 whitespace-nowrap">
        No Contact
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-semibold border border-gray-200 whitespace-nowrap">
      Unknown
    </span>
  );
}

// ── Popover component ──────────────────────────────────────────────────────────
function Popover({ trigger, children }: { trigger: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 min-w-[220px] max-w-[300px] bg-white border border-[hsl(214,20%,88%)] rounded-xl shadow-lg p-3">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Contacts popover content ───────────────────────────────────────────────────
function ContactsPopover({ prop }: { prop: Property }) {
  const contacts = prop.contacts ?? [];
  const landlord = prop.landlord;

  // Build a deduplicated list: contacts array first, then landlord as fallback
  const items = contacts.length > 0 ? contacts : [
    { id: 'landlord', name: landlord.name, relationship: 'Landlord', mobile: landlord.phone, email: landlord.email, telephone: '' },
  ];

  return (
    <div className="space-y-2.5">
      <p className="text-[11px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-1">Contacts</p>
      {items.map((c) => (
        <div key={c.id} className="space-y-0.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[hsl(215,25%,18%)]">{c.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#1B4F8A]/10 text-[#1B4F8A] font-medium">{c.relationship}</span>
          </div>
          {'customerCode' in c && c.customerCode && (
            <p className="text-[11px] text-amber-700 flex items-center gap-1 font-mono font-semibold">
              <Icon name="TagIcon" size={10} className="text-amber-500" />
              {c.customerCode}
            </p>
          )}
          {c.mobile && (
            <p className="text-[11px] text-[hsl(215,15%,52%)] flex items-center gap-1">
              <Icon name="PhoneIcon" size={10} className="text-[hsl(215,15%,62%)]" />
              {c.mobile}
            </p>
          )}
          {c.telephone && (
            <p className="text-[11px] text-[hsl(215,15%,52%)] flex items-center gap-1">
              <Icon name="PhoneCallIcon" size={10} className="text-[hsl(215,15%,62%)]" />
              {c.telephone}
            </p>
          )}
          {c.email && (
            <p className="text-[11px] text-[hsl(215,15%,52%)] flex items-center gap-1 truncate">
              <Icon name="MailIcon" size={10} className="text-[hsl(215,15%,62%)]" />
              <span className="truncate">{c.email}</span>
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Key location popover content ───────────────────────────────────────────────
function KeyLocationPopover({ prop }: { prop: Property }) {
  const [keyLogData, setKeyLogData] = React.useState<{
    key_status: string;
    key_number: string;
    sole_agent: string;
    sole_agent_name: string;
    sole_agent_valid_from: string;
    sole_agent_valid_to: string;
  } | null>(null);
  const [keyLogLoaded, setKeyLogLoaded] = React.useState(false);

  React.useEffect(() => {
    const propRef = (prop as any).ref || prop.unit;
    if (!propRef) { setKeyLogLoaded(true); return; }
    const supabase = createClient();
    supabase
      .from('key_log')
      .select('key_status, key_number, sole_agent, sole_agent_name, sole_agent_valid_from, sole_agent_valid_to')
      .eq('property_ref', propRef)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setKeyLogData({
            key_status: data[0].key_status ?? '',
            key_number: data[0].key_number ?? '',
            sole_agent: data[0].sole_agent ?? '',
            sole_agent_name: data[0].sole_agent_name ?? '',
            sole_agent_valid_from: data[0].sole_agent_valid_from ?? '',
            sole_agent_valid_to: data[0].sole_agent_valid_to ?? '',
          });
        }
        setKeyLogLoaded(true);
      });
  }, [(prop as any).ref, prop.unit]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-2">
      {/* Key Location section */}
      {prop.keyLocation ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Key Location</p>
          {prop.keyLocation.type === 'office' && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1B4F8A]/10 text-[#1B4F8A] text-xs font-semibold">
                <Icon name="BuildingIcon" size={11} />
                Office {prop.keyLocation.keyNumber ? `#${prop.keyLocation.keyNumber}` : ''}
              </span>
            </div>
          )}
          {prop.keyLocation.type === 'agent' && (
            <div className="space-y-0.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                <Icon name="UserIcon" size={11} />
                With Agent
              </span>
              {prop.keyLocation.agentName && <p className="text-xs text-[hsl(215,25%,18%)] font-medium mt-1">{prop.keyLocation.agentName}</p>}
              {prop.keyLocation.agentPhone && (
                <p className="text-[11px] text-[hsl(215,15%,52%)] flex items-center gap-1">
                  <Icon name="PhoneIcon" size={10} className="text-[hsl(215,15%,62%)]" />
                  {prop.keyLocation.agentPhone}
                </p>
              )}
            </div>
          )}
          {prop.keyLocation.type === 'landlord' && (
            <div className="space-y-0.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                <Icon name="HomeIcon" size={11} />
                With Landlord
              </span>
              <p className="text-xs text-[hsl(215,25%,18%)] font-medium mt-1">{prop.landlord.name}</p>
              {prop.landlord.phone && (
                <p className="text-[11px] text-[hsl(215,15%,52%)] flex items-center gap-1">
                  <Icon name="PhoneIcon" size={10} className="text-[hsl(215,15%,62%)]" />
                  {prop.landlord.phone}
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-[hsl(215,15%,52%)] italic">No key location recorded</p>
      )}

      {/* Key Log section */}
      {keyLogLoaded && keyLogData && (keyLogData.key_status || keyLogData.key_number || keyLogData.sole_agent || keyLogData.sole_agent_name) && (
        <div className="border-t border-amber-200 pt-2 mt-1 space-y-1">
          <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-1">
            <Icon name="KeyIcon" size={10} className="text-amber-600" />
            Key Log
          </p>
          {keyLogData.key_status && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[hsl(215,15%,52%)]">Key:</span>
              <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${keyLogData.key_status === 'Yes' ? 'bg-emerald-100 text-emerald-700' : keyLogData.key_status === 'No' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                {keyLogData.key_status}
              </span>
            </div>
          )}
          {keyLogData.key_number && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[hsl(215,15%,52%)]">Key No:</span>
              <span className="text-[11px] font-mono font-semibold text-[hsl(215,25%,18%)]">{keyLogData.key_number}</span>
            </div>
          )}
          {keyLogData.sole_agent && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[hsl(215,15%,52%)]">Sole Agent:</span>
              <span className="text-[11px] font-semibold text-[hsl(215,25%,18%)]">{keyLogData.sole_agent}</span>
            </div>
          )}
          {keyLogData.sole_agent_name && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[hsl(215,15%,52%)]">Agent Name:</span>
              <span className="text-[11px] font-semibold text-[hsl(215,25%,18%)]">{keyLogData.sole_agent_name}</span>
            </div>
          )}
          {(keyLogData.sole_agent_valid_from || keyLogData.sole_agent_valid_to) && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[hsl(215,15%,52%)]">Valid:</span>
              <span className="text-[11px] text-[hsl(215,25%,18%)]">
                {keyLogData.sole_agent_valid_from ? new Date(keyLogData.sole_agent_valid_from).toLocaleDateString('en-HK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                {' → '}
                {keyLogData.sole_agent_valid_to ? new Date(keyLogData.sole_agent_valid_to).toLocaleDateString('en-HK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
              </span>
            </div>
          )}
        </div>
      )}
      {!keyLogLoaded && (
        <div className="border-t border-amber-200 pt-2 mt-1 flex items-center gap-1 text-[11px] text-amber-600">
          <Icon name="LoaderIcon" size={10} className="animate-spin" />
          Loading key log…
        </div>
      )}
    </div>
  );
}

// ── Map DB property_status string → numeric PropertyStatus ────────────────────
function dbStatusToNumeric(dbStatus: string | null | undefined): import('./mockData').PropertyStatus {
  switch (dbStatus) {
    case 'for-rent': return 0;
    case 'leased': return 1;
    case 'self-occupy': return 2;
    case 'for-sale': return 4;
    case 'for-sale-and-rent': return 0;
    default: return 99;
  }
}

// ── Map DB occupancy_status string → OccupancyStatus ─────────────────────────
function dbOccupancyToLocal(occ: string | null | undefined): import('./mockData').OccupancyStatus {
  if (occ === 'vacant' || occ === 'vacant-soon' || occ === 'leased' || occ === 'with-ta') return occ;
  return 'vacant';
}

// ── Map DB contact_status string → ContactStatus ──────────────────────────────
function dbContactStatusToLocal(cs: string | null | undefined): ContactStatus {
  if (cs === 'active' || cs === 'no-contact' || cs === 'unknown') return cs;
  return 'active';
}

// ── Convert a raw Supabase properties row → Property ─────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbRowToProperty(row: Record<string, any>): Property {
  const additionalFeatures: import('./mockData').AdditionalFeature[] = [];
  if (row.balcony) additionalFeatures.push('Balcony');
  if (row.terrace) additionalFeatures.push('Terrace');
  if (row.garden) additionalFeatures.push('Garden');
  if (row.pool) additionalFeatures.push('Pool');
  if (row.roof) additionalFeatures.push('Roof Top');
  if (row.duplex) additionalFeatures.push('Duplex');
  if (row.combined) additionalFeatures.push('Combined Unit');
  if (row.openkitch) additionalFeatures.push('Open Kitchen');

  // Map direction_id and view_id to typed values
  const directionMap: Record<string, import('./mockData').DirectionType> = {
    // Abbreviations (upper, lower, mixed)
    N: 'North', NE: 'North East', E: 'East', S: 'South',
    SE: 'South East', W: 'West', SW: 'South West', NW: 'North West',
    n: 'North', ne: 'North East', e: 'East', s: 'South',
    se: 'South East', w: 'West', sw: 'South West', nw: 'North West',
    // Full words (lower)
    north: 'North', 'north east': 'North East', east: 'East', south: 'South',
    'south east': 'South East', west: 'West', 'south west': 'South West', 'north west': 'North West',
    // Full words (title case) — idempotent / already-mapped values
    North: 'North', 'North East': 'North East', East: 'East', South: 'South',
    'South East': 'South East', West: 'West', 'South West': 'South West', 'North West': 'North West',
    // Hyphenated variants
    'north-east': 'North East', 'south-east': 'South East',
    'south-west': 'South West', 'north-west': 'North West',
    'North-East': 'North East', 'South-East': 'South East',
    'South-West': 'South West', 'North-West': 'North West',
  };
  const viewMap: Record<string, import('./mockData').ViewType> = {
    // Uppercase codes
    SEA: 'Sea View', GREEN: 'Green View', CITY: 'City View', MTN: 'Mountain View',
    POOL: 'Pool View', GARDEN: 'Garden View', STREET: 'Street View', OPEN: 'Open View',
    // Lowercase codes
    sea: 'Sea View', green: 'Green View', city: 'City View', mtn: 'Mountain View',
    pool: 'Pool View', garden: 'Garden View', street: 'Street View', open: 'Open View',
    // Lowercase full phrases
    'sea view': 'Sea View', 'green view': 'Green View', 'city view': 'City View',
    'mountain view': 'Mountain View', 'pool view': 'Pool View', 'garden view': 'Garden View',
    'street view': 'Street View', 'open view': 'Open View',
    // Title-case full phrases (idempotent / already-mapped values)
    'Sea View': 'Sea View', 'Green View': 'Green View', 'City View': 'City View',
    'Mountain View': 'Mountain View', 'Pool View': 'Pool View', 'Garden View': 'Garden View',
    'Street View': 'Street View', 'Open View': 'Open View',
    // Extra aliases
    mountain: 'Mountain View', Mountain: 'Mountain View', MOUNTAIN: 'Mountain View',
  };
  const decorMap: Record<string, import('./mockData').DecorationType> = {
    // Lowercase
    deluxe: 'Deluxe', good: 'Good', fair: 'Fair', original: 'Original',
    // Uppercase
    DELUXE: 'Deluxe', GOOD: 'Good', FAIR: 'Fair', ORIGINAL: 'Original',
    // Title case (idempotent)
    Deluxe: 'Deluxe', Good: 'Good', Fair: 'Fair', Original: 'Original',
    // "Condition" suffix variants (common in CSV exports)
    'good condition': 'Good', 'Good Condition': 'Good', 'GOOD CONDITION': 'Good',
    'fair condition': 'Fair', 'Fair Condition': 'Fair', 'FAIR CONDITION': 'Fair',
    'deluxe condition': 'Deluxe', 'Deluxe Condition': 'Deluxe', 'DELUXE CONDITION': 'Deluxe',
    'original condition': 'Original', 'Original Condition': 'Original', 'ORIGINAL CONDITION': 'Original',
    // Null / unknown / blank → '---'
    '---': '---', 'NULL': '---', 'null': '---', 'unknown': '---', 'Unknown': '---', 'UNKNOWN': '---',
    'n/a': '---', 'N/A': '---', '': '---',
  };

  // Map DB floor_type values → FloorType enum used by the modal dropdown
  const floorTypeMap: Record<string, import('./mockData').FloorType> = {
    'ground floor': 'Ground', 'ground': 'Ground',
    'low floor': 'Low', 'low': 'Low',
    'middle floor': 'Medium', 'mid floor': 'Medium', 'medium': 'Medium', 'medium floor': 'Medium',
    'high floor': 'High', 'high': 'High',
    // Also accept the enum values themselves (idempotent)
    'Ground': 'Ground', 'Low': 'Low', 'Medium': 'Medium', 'High': 'High',
  };

  // Map DB prop_types / prop_type values → BuildingType enum
  const buildingTypeMap: Record<string, import('./mockData').BuildingType> = {
    // Abbreviations
    HR: 'High Rise', LR: 'Low Rise', H: 'House',
    hr: 'High Rise', lr: 'Low Rise', h: 'House',
    // Full phrases (lower)
    'high rise': 'High Rise', 'low rise': 'Low Rise', house: 'House',
    // Title case (idempotent)
    'High Rise': 'High Rise', 'Low Rise': 'Low Rise', House: 'House',
    // Uppercase
    'HIGH RISE': 'High Rise', 'LOW RISE': 'Low Rise', HOUSE: 'House',
    // Hyphenated
    'high-rise': 'High Rise', 'low-rise': 'Low Rise',
    'High-Rise': 'High Rise', 'Low-Rise': 'Low Rise',
  };

  const rawDirection = row.direction_id || row.direction_view_id?.split('/')?.[0];
  const rawView = row.view_id || row.direction_view_id?.split('/')?.[1];
  const rawDecor = row.decor_id;
  const rawListType = row.list_type;

  const direction = rawDirection ? (directionMap[rawDirection] ?? rawDirection as import('./mockData').DirectionType) : undefined;
  const view = rawView ? (viewMap[rawView] ?? rawView as import('./mockData').ViewType) : undefined;
  const decoration = rawDecor
    ? (decorMap[rawDecor] ?? (rawDecor === 'NULL' || rawDecor.toLowerCase() === 'unknown' ? '---' : rawDecor as import('./mockData').DecorationType))
    : undefined;

  // Normalize listing_type: NULL/unknown/empty → ''
  const listingTypeNorm = (!rawListType || rawListType === 'NULL' || rawListType.toLowerCase() === 'unknown') ? '' : rawListType;

  // Resolve buildingType via map (handles abbreviations and case variants)
  const rawBuildingType = row.prop_types || row.prop_type;
  const buildingType = rawBuildingType
    ? (buildingTypeMap[rawBuildingType] ?? buildingTypeMap[(rawBuildingType as string).toLowerCase()] ?? rawBuildingType as import('./mockData').BuildingType)
    : undefined;

  return {
    id: row.id,
    ref: row.property_ref as string || undefined,
    unit: row.unit || row.block || '',
    building: row.building_name || row.area || row.tower || row.village || 'Discovery Bay',
    shortCode: row.short_code || undefined,
    district: row.village || 'Discovery Bay',
    village: row.village || 'Discovery Bay',
    street: row.address || row.area || '',
    type: 'Residential',
    status: row.contact_status_code != null ? (row.contact_status_code as import('./mockData').PropertyStatus) : dbStatusToNumeric(row.status),
    occupancyStatus: dbOccupancyToLocal(row.occupancy),
    contactStatus: dbContactStatusToLocal(row.contact_status),
    bedrooms: row.bedrooms ?? null,
    bathrooms: row.bathrooms ?? null,
    sqft: row.saleable_area ?? row.gross_area ?? 0,
    grossSqft: row.gross_area ?? undefined,
    floor: row.floor || row.floor_type || '',
    floorType: row.floor_type ? (floorTypeMap[row.floor_type] ?? floorTypeMap[(row.floor_type as string).toLowerCase()] ?? row.floor_type as import('./mockData').FloorType) : undefined,
    yearBuilt: row.build_year ?? undefined,
    direction,
    view,
    decoration,
    outdoorArea: row.outside_sc != null ? String(row.outside_sc) : undefined,
    additionalFeatures: additionalFeatures.length > 0 ? additionalFeatures : undefined,
    monthlyRent: row.asking_rent ?? null,
    salePrice: row.asking_price ?? null,
    listingDate: row.publish_dt ? (() => { const d = new Date(row.publish_dt); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; })() : undefined,
    vacantDate: row.vacant_date ? (() => { const d = new Date(row.vacant_date); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; })() : undefined,
    owner: row.landlord_name || undefined,
    landlord: {
      name: row.landlord_name || '',
      phone: row.landlord_phone || '',
      email: row.landlord_email || '',
      idNumber: '',
    },
    tenant: row.tenant_name
      ? {
          name: row.tenant_name,
          phone: row.tenant_phone || '',
          email: '',
          idNumber: '',
          leaseStart: row.lease_start || '',
          leaseEnd: row.lease_end || '',
          deposit: 0,
          stampDutyPaid: false,
          cr109Filed: false,
        }
      : null,
    lastUpdated: row.updated_at
      ? new Date(row.updated_at).toLocaleDateString('en-GB')
      : '',
    updatedBy: '',
    agentNotes: row.notes || row.p_eng_res || '',
    engRemark: row.p_english || '',
    chiRemark: row.p_chinese || '',
    photos: [],
    hasFloorPlan: false,
    comments: [],
    historyLog: [],
    importBatchId: row.import_batch_id || undefined,
    validationStatus: row.validation_status || 'valid',
    phase: row.phase || undefined,
    buildingName: row.building_name || undefined,
    buildingType,
    floorNumber: (row.floor as import('./mockData').FloorNumber) || undefined,
    listingType: listingTypeNorm,
    contactStatusCode: row.contact_status_code ?? undefined,
    keyLocation: row.key_location
      ? {
          type: (row.key_location as Record<string, string>).type as import('./mockData').KeyLocationType,
          keyNumber: (row.key_location as Record<string, string>).keyNumber ?? undefined,
          agentName: (row.key_location as Record<string, string>).agentName ?? undefined,
          agentPhone: (row.key_location as Record<string, string>).agentPhone ?? undefined,
        }
      : undefined,
    contacts: Array.isArray(row._contacts)
      ? (row._contacts as Record<string, unknown>[]).map((c) => ({
          id: String(c.id ?? ''),
          name: String(c.contact_person ?? ''),
          relationship: String(c.contact_role ?? 'Owner'),
          mobile: String(c.contact_number ?? ''),
          email: String(c.contact_email ?? ''),
          telephone: '',
          customerCode: undefined,
        }))
      : [],
  } as Property & { listingType: string; contactStatusCode: number | undefined };
}

// ── Batch Edit Modal ───────────────────────────────────────────────────────────
interface BatchEditField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean';
  options?: { value: string; label: string }[];
  dbKey: string;
}

const BATCH_EDIT_FIELDS: BatchEditField[] = [
  {
    key: 'status', label: 'Property Status', type: 'select', dbKey: 'status',
    options: [
      { value: 'for-rent', label: 'For Rent' },
      { value: 'leased', label: 'Leased' },
      { value: 'self-occupy', label: 'Self Occupy' },
      { value: 'for-sale', label: 'For Sale' },
    ],
  },
  {
    key: 'occupancy', label: 'Occupancy Status', type: 'select', dbKey: 'occupancy',
    options: [
      { value: 'vacant', label: 'Vacant' },
      { value: 'vacant-soon', label: 'Vacant Soon' },
      { value: 'leased', label: 'Leased' },
      { value: 'with-ta', label: 'With TA' },
    ],
  },
  {
    key: 'contact_status', label: 'Contact Status', type: 'select', dbKey: 'contact_status',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'no-contact', label: 'No Contact' },
      { value: 'unknown', label: 'Unknown' },
    ],
  },
  {
    key: 'floor_type', label: 'Floor Type', type: 'select', dbKey: 'floor_type',
    options: [
      { value: 'Ground', label: 'Ground Floor' },
      { value: 'Low', label: 'Low Floor' },
      { value: 'Medium', label: 'Medium Floor' },
      { value: 'High', label: 'High Floor' },
    ],
  },
  {
    key: 'prop_types', label: 'Building Type', type: 'select', dbKey: 'prop_types',
    options: [
      { value: 'High Rise', label: 'High Rise' },
      { value: 'Low Rise', label: 'Low Rise' },
      { value: 'House', label: 'House' },
    ],
  },
  {
    key: 'direction_id', label: 'Direction', type: 'select', dbKey: 'direction_id',
    options: [
      { value: 'North', label: 'North' },
      { value: 'North East', label: 'North East' },
      { value: 'East', label: 'East' },
      { value: 'South East', label: 'South East' },
      { value: 'South', label: 'South' },
      { value: 'South West', label: 'South West' },
      { value: 'West', label: 'West' },
      { value: 'North West', label: 'North West' },
    ],
  },
  {
    key: 'view_id', label: 'View', type: 'select', dbKey: 'view_id',
    options: [
      { value: 'Sea View', label: 'Sea View' },
      { value: 'Mountain View', label: 'Mountain View' },
      { value: 'City View', label: 'City View' },
      { value: 'Green View', label: 'Green View' },
      { value: 'Pool View', label: 'Pool View' },
      { value: 'Garden View', label: 'Garden View' },
      { value: 'Street View', label: 'Street View' },
      { value: 'Open View', label: 'Open View' },
    ],
  },
  {
    key: 'decor_id', label: 'Decoration', type: 'select', dbKey: 'decor_id',
    options: [
      { value: 'Deluxe', label: 'Deluxe' },
      { value: 'Good', label: 'Good' },
      { value: 'Fair', label: 'Fair' },
      { value: 'Original', label: 'Original' },
    ],
  },
  {
    key: 'list_type', label: 'Listing Type', type: 'select', dbKey: 'list_type',
    options: [
      { value: 'Exclusive', label: 'Exclusive' },
      { value: 'Open', label: 'Open' },
      { value: 'Co-broke', label: 'Co-broke' },
    ],
  },
  { key: 'bedrooms', label: 'Bedrooms', type: 'number', dbKey: 'bedrooms' },
  { key: 'bathrooms', label: 'Bathrooms', type: 'number', dbKey: 'bathrooms' },
  { key: 'build_year', label: 'Year Built', type: 'number', dbKey: 'build_year' },
  { key: 'saleable_area', label: 'Saleable Area (sq ft)', type: 'number', dbKey: 'saleable_area' },
  { key: 'gross_area', label: 'Gross Area (sq ft)', type: 'number', dbKey: 'gross_area' },
  { key: 'asking_rent', label: 'Asking Rent (HKD)', type: 'number', dbKey: 'asking_rent' },
  { key: 'asking_price', label: 'Asking Price (HKD)', type: 'number', dbKey: 'asking_price' },
  {
    key: 'balcony', label: 'Balcony', type: 'boolean', dbKey: 'balcony',
    options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }],
  },
  {
    key: 'terrace', label: 'Terrace', type: 'boolean', dbKey: 'terrace',
    options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }],
  },
  {
    key: 'garden', label: 'Garden', type: 'boolean', dbKey: 'garden',
    options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }],
  },
  {
    key: 'pool', label: 'Pool', type: 'boolean', dbKey: 'pool',
    options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }],
  },
  {
    key: 'duplex', label: 'Duplex', type: 'boolean', dbKey: 'duplex',
    options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }],
  },
  {
    key: 'roof', label: 'Roof Top', type: 'boolean', dbKey: 'roof',
    options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }],
  },
];

interface BatchEditModalProps {
  selectedIds: Set<string>;
  properties: Property[];
  onClose: () => void;
  onSuccess: () => void;
}

function BatchEditModal({ selectedIds, properties, onClose, onSuccess }: BatchEditModalProps) {
  const selectedProps = properties.filter((p) => selectedIds.has(p.id));
  // fieldUpdates: map of dbKey → value string
  const [fieldUpdates, setFieldUpdates] = useState<Record<string, string>>({});
  // which fields are toggled on
  const [enabledFields, setEnabledFields] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<{ updated: number; notFound: number; errors: number } | null>(null);

  function toggleField(key: string) {
    setEnabledFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        setFieldUpdates((fu) => {
          const nfu = { ...fu };
          delete nfu[key];
          return nfu;
        });
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function setFieldValue(dbKey: string, value: string) {
    setFieldUpdates((prev) => ({ ...prev, [dbKey]: value }));
  }

  async function handleApply() {
    if (enabledFields.size === 0) {
      toast.error('Select at least one field to update');
      return;
    }
    // Validate all enabled fields have a value
    for (const key of enabledFields) {
      const field = BATCH_EDIT_FIELDS.find((f) => f.key === key);
      if (!field) continue;
      const val = fieldUpdates[field.dbKey];
      if (val === undefined || val === '') {
        toast.error(`Please set a value for "${field.label}"`);
        return;
      }
    }

    setSubmitting(true);
    try {
      // Build rows: one per selected property, using property_ref as pid
      const rows = selectedProps
        .filter((p) => p.ref)
        .map((p) => {
          const row: Record<string, unknown> = { pid: p.ref };
          for (const key of enabledFields) {
            const field = BATCH_EDIT_FIELDS.find((f) => f.key === key);
            if (!field) continue;
            const rawVal = fieldUpdates[field.dbKey];
            if (field.type === 'number') {
              row[field.dbKey] = rawVal !== '' ? Number(rawVal) : null;
            } else if (field.type === 'boolean') {
              row[field.dbKey] = rawVal === 'true';
            } else {
              row[field.dbKey] = rawVal;
            }
          }
          return row;
        });

      const noRef = selectedProps.filter((p) => !p.ref);
      if (rows.length === 0) {
        toast.error('None of the selected properties have a property reference (PID). Cannot update.');
        setSubmitting(false);
        return;
      }
      if (noRef.length > 0) {
        toast.warning(`${noRef.length} selected propert${noRef.length === 1 ? 'y has' : 'ies have'} no PID and will be skipped.`);
      }

      const res = await fetch('/api/property-field-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Update failed');
      setResults(json.summary);
      toast.success(`Batch update complete: ${json.summary.updated} updated, ${json.summary.notFound} not found, ${json.summary.errors} errors`);
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Batch update failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(214,20%,88%)]">
          <div>
            <h2 className="text-base font-bold text-[hsl(215,25%,18%)]">Batch Edit Properties</h2>
            <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">
              {selectedProps.length} propert{selectedProps.length === 1 ? 'y' : 'ies'} selected
              {selectedProps.filter((p) => !p.ref).length > 0 && (
                <span className="ml-1 text-amber-600">
                  ({selectedProps.filter((p) => !p.ref).length} without PID will be skipped)
                </span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors">
            <Icon name="XIcon" size={16} className="text-[hsl(215,15%,52%)]" />
          </button>
        </div>

        {/* Selected property refs preview */}
        <div className="px-5 py-2.5 bg-[hsl(210,20%,97%)] border-b border-[hsl(214,20%,88%)]">
          <p className="text-[10px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-1.5">Selected Properties</p>
          <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
            {selectedProps.map((p) => (
              <span
                key={p.id}
                className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                  p.ref
                    ? 'bg-amber-100 text-amber-700 border border-amber-200' :'bg-gray-100 text-gray-400 border border-gray-200 line-through'
                }`}
              >
                {p.ref ?? `${p.unit} (no PID)`}
              </span>
            ))}
          </div>
        </div>

        {/* Field selection + value inputs */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          <p className="text-xs font-semibold text-[hsl(215,25%,18%)] mb-3">
            Toggle the fields you want to update, then set the new value:
          </p>
          {BATCH_EDIT_FIELDS.map((field) => {
            const enabled = enabledFields.has(field.key);
            return (
              <div
                key={field.key}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                  enabled
                    ? 'border-[#1B4F8A]/40 bg-[#1B4F8A]/5'
                    : 'border-[hsl(214,20%,88%)] bg-white hover:bg-[hsl(210,15%,97%)]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => toggleField(field.key)}
                  className="rounded border-[hsl(214,20%,88%)] accent-[#1B4F8A] flex-shrink-0"
                />
                <label
                  className={`text-xs font-medium w-44 flex-shrink-0 cursor-pointer ${enabled ? 'text-[#1B4F8A]' : 'text-[hsl(215,25%,18%)]'}`}
                  onClick={() => toggleField(field.key)}
                >
                  {field.label}
                </label>
                <div className="flex-1">
                  {field.type === 'select' || field.type === 'boolean' ? (
                    <select
                      disabled={!enabled}
                      value={fieldUpdates[field.dbKey] ?? ''}
                      onChange={(e) => setFieldValue(field.dbKey, e.target.value)}
                      className="input-base w-full py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <option value="">— select —</option>
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      disabled={!enabled}
                      value={fieldUpdates[field.dbKey] ?? ''}
                      onChange={(e) => setFieldValue(field.dbKey, e.target.value)}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                      className="input-base w-full py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Results summary */}
        {results && (
          <div className="px-5 py-3 border-t border-[hsl(214,20%,88%)] bg-emerald-50">
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                <Icon name="CheckCircleIcon" size={13} />
                {results.updated} updated
              </span>
              {results.notFound > 0 && (
                <span className="flex items-center gap-1 text-amber-600 font-semibold">
                  <Icon name="AlertTriangleIcon" size={13} />
                  {results.notFound} not found
                </span>
              )}
              {results.errors > 0 && (
                <span className="flex items-center gap-1 text-red-600 font-semibold">
                  <Icon name="XCircleIcon" size={13} />
                  {results.errors} errors
                </span>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-[hsl(214,20%,88%)] bg-[hsl(210,20%,98%)]">
          <p className="text-[11px] text-[hsl(215,15%,52%)]">
            {enabledFields.size === 0
              ? 'No fields selected'
              : `${enabledFields.size} field${enabledFields.size === 1 ? '' : 's'} will be updated`}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-secondary py-1.5 text-xs">
              {results ? 'Close' : 'Cancel'}
            </button>
            {!results && (
              <button
                onClick={handleApply}
                disabled={submitting || enabledFields.size === 0}
                className="btn-primary py-1.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Applying…
                  </span>
                ) : (
                  <>
                    <Icon name="CheckIcon" size={13} />
                    Apply to {selectedProps.filter((p) => p.ref).length} Propert{selectedProps.filter((p) => p.ref).length === 1 ? 'y' : 'ies'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const FEATURE_OPTIONS = ['Balcony', 'Terrace', 'Garden', 'Pool', 'Roof Top', 'Duplex', 'Combined Unit', 'Open Kitchen'];

function FeaturesMultiSelect({ selected, onChange }: { selected: string[]; onChange: (vals: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const [dropdownStyle, setDropdownStyle] = React.useState<React.CSSProperties>({});

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleOpen() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        minWidth: Math.max(rect.width, 160),
        zIndex: 9999,
      });
    }
    setOpen((o) => !o);
  }

  function toggle(val: string) {
    if (selected.includes(val)) onChange(selected.filter((v) => v !== val));
    else onChange([...selected, val]);
  }

  const label = selected.length === 0 ? 'Features ...' : selected.length === 1 ? selected[0] : `${selected.length} features`;

  return (
    <div ref={ref} className="relative w-full">
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className="flex items-center justify-between w-full text-xs text-[hsl(215,25%,30%)] bg-transparent outline-none cursor-pointer gap-1"
      >
        <span className={selected.length === 0 ? 'text-[hsl(215,15%,65%)]' : ''}>{label}</span>
        <Icon name="ChevronUpDownIcon" size={12} className="text-[hsl(215,15%,60%)] flex-shrink-0 pointer-events-none" />
      </button>
      {open && (
        <div
          style={dropdownStyle}
          className="bg-white border border-[hsl(36,25%,88%)] rounded-lg shadow-lg py-1 max-h-56 overflow-y-auto"
        >
          {FEATURE_OPTIONS.map((opt) => (
            <label key={opt} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[hsl(36,25%,96%)] cursor-pointer text-xs text-[hsl(215,25%,30%)]">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                className="accent-[hsl(215,70%,50%)] cursor-pointer"
              />
              {opt}
            </label>
          ))}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 border-t border-[hsl(36,25%,88%)] mt-1"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function PropertyManagementClient() {
  // ── Search panel state ─────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [sPriceMin, setSPriceMin] = useState('');
  const [sPriceMax, setSPriceMax] = useState('');
  const [availability, setAvailability] = useState('');
  const [directionFilter, setDirectionFilter] = useState('');
  const [bedsFilter, setBedsFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [activeStatus, setActiveStatus] = useState('');
  const [lPriceMin, setLPriceMin] = useState('');
  const [lPriceMax, setLPriceMax] = useState('');
  const [featuresFilter, setFeaturesFilter] = useState<string[]>([]);
  const [viewsFilter, setViewsFilter] = useState('');
  const [bathroomsFilter, setBathroomsFilter] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [rentType, setRentType] = useState('');
  const [gSizeMin, setGSizeMin] = useState('');
  const [gSizeMax, setGSizeMax] = useState('');
  const [furnishingFilter, setFurnishingFilter] = useState('');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState('');
  const [decorationsFilter, setDecorationsFilter] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [villageFilter, setVillageFilter] = useState('');
  const [sSizeMin, setSSizeMin] = useState('');
  const [sSizeMax, setSSizeMax] = useState('');
  const [floorFrom, setFloorFrom] = useState('');
  const [floorTo, setFloorTo] = useState('');
  const [highlightFilter, setHighlightFilter] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('');

  // ── Legacy filter state (kept for internal filtering logic) ───────────────
  const [contactStatusFilter] = useState('all');
  const [statusFilter] = useState('all');
  const [occupancyFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('none');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [liveUpdateCount, setLiveUpdateCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [quickViewingProp, setQuickViewingProp] = useState<Property | null>(null);
  const [batchEditOpen, setBatchEditOpen] = useState(false);
  const [bulkViewingOpen, setBulkViewingOpen] = useState(false);
  const [addPropertyOpen, setAddPropertyOpen] = useState(false);
  const [assignAgentOpen, setAssignAgentOpen] = useState(false);
  const [agents, setAgents] = useState<Array<{ id: string; full_name: string; email: string; role: string }>>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [assigningAgent, setAssigningAgent] = useState(false);

  // ── Import batch filter state ──────────────────────────────────────────────
  const [batchFilter] = useState('all');
  const [validationStatusFilter] = useState('all');
  const [importBatches, setImportBatches] = useState<Array<{ id: string; filename: string; imported_at: string }>>([]);

  // ── Supabase data ──────────────────────────────────────────────────────────
  const [dbProperties, setDbProperties] = useState<Property[]>([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  // ── Owner map: keyed by property_ref and short_code → first owner name + all contacts ──
  interface OwnerContactRow {
    id: string;
    property_ref: string | null;
    short_code: string | null;
    contact_person: string;
    contact_role: string;
    contact_number: string;
    contact_email: string;
  }
  const [ownerMap, setOwnerMap] = useState<Record<string, OwnerContactRow[]>>({});

  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const fetchProperties = useCallback(async () => {
    setDbLoading(true);
    setDbError(null);
    try {
      // Fetch in pages of 1000 to handle large datasets
      let allRows: Record<string, unknown>[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('properties')
          .select('*')
          .range(from, from + pageSize - 1)
          .order('property_ref', { ascending: true });
        if (error) throw error;
        if (!data || data.length === 0) break;
        allRows = allRows.concat(data);
        if (data.length < pageSize) break;
        from += pageSize;
      }

      // Fetch all property_contacts and attach to matching property rows
      const { data: contactRows } = await supabase
        .from('property_contacts')
        .select('*')
        .order('created_at', { ascending: true });

      if (contactRows && contactRows.length > 0) {
        // Build lookup maps: by property_ref and by short_code
        const contactsByRef: Record<string, typeof contactRows> = {};
        const contactsByShortCode: Record<string, typeof contactRows> = {};
        for (const c of contactRows) {
          if (c.property_ref) {
            if (!contactsByRef[c.property_ref]) contactsByRef[c.property_ref] = [];
            contactsByRef[c.property_ref].push(c);
          }
          if (c.short_code) {
            if (!contactsByShortCode[c.short_code]) contactsByShortCode[c.short_code] = [];
            contactsByShortCode[c.short_code].push(c);
          }
        }
        // Attach contacts to each property row
        allRows = allRows.map((row) => {
          const ref = row.property_ref as string | undefined;
          const sc = row.short_code as string | undefined;
          const matched = (ref && contactsByRef[ref]) || (sc && contactsByShortCode[sc]) || [];
          return { ...row, _contacts: matched };
        });
      }

      setDbProperties(allRows.map(dbRowToProperty));

      // Keep selectedProperty in sync so the modal reflects the latest saved values
      setSelectedProperty((prev) => {
        if (!prev) return prev;
        const updated = allRows.find((r) => r.id === prev.id);
        return updated ? dbRowToProperty(updated) : prev;
      });

      // Fetch import history batches for filter dropdown
      const { data: batchData } = await supabase
        .from('import_history')
        .select('id, filename, imported_at')
        .order('imported_at', { ascending: false })
        .limit(50);
      if (batchData) setImportBatches(batchData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load properties';
      setDbError(msg);
      console.error('PropertyManagementClient fetch error:', err);
    } finally {
      setDbLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  // Fetch contacts separately whenever dbProperties changes (new approach)
  useEffect(() => {
    if (dbProperties.length === 0) return;
    let cancelled = false;
    async function fetchContacts() {
      try {
        const sb = createClient();
        const { data, error } = await sb
          .from('property_contacts')
          .select('id, property_ref, short_code, contact_person, contact_role, contact_number, contact_email')
          .order('created_at', { ascending: true });
        if (error || !data || cancelled) return;
        // Build map keyed by both property_ref and short_code
        const map: Record<string, OwnerContactRow[]> = {};
        for (const row of data as OwnerContactRow[]) {
          if (row.property_ref) {
            const key = row.property_ref.trim().toLowerCase();
            if (!map[key]) map[key] = [];
            map[key].push(row);
          }
          if (row.short_code) {
            const key = row.short_code.trim().toLowerCase();
            if (!map[key]) map[key] = [];
            // avoid duplicates if same row matched both
            if (!map[key].find((r) => r.id === row.id)) map[key].push(row);
          }
        }
        if (!cancelled) setOwnerMap(map);
      } catch {
        // silently ignore
      }
    }
    fetchContacts();
    return () => { cancelled = true; };
  }, [dbProperties]);

  const { can, isAdmin, isAdminOrManager } = useRole();

  // ── Show only DB properties (no mock fallback) ─────────────────────────────
  const allProperties = useMemo(() => {
    return dbProperties;
  }, [dbProperties]);

    // ── Real-time: properties ──────────────────────────────────────────────────
  const handlePropertyChange = useCallback((event: RealtimeEvent, row: Record<string, unknown>) => {
    setLiveUpdateCount((c) => c + 1);
    setLastSyncTime(new Date());
    const ref = (row.property_ref as string) ?? '';
    if (event === 'INSERT') {
      toast.info(`New property added${ref ? `: ${ref}` : ''}`, { id: `prop-insert-${row.id}` });
      fetchProperties();
    } else if (event === 'UPDATE') {
      toast.success(`Property updated${ref ? `: ${ref}` : ''}`, { id: `prop-update-${row.id}` });
      fetchProperties();
    } else if (event === 'DELETE') {
      toast.warning(`Property removed${ref ? `: ${ref}` : ''}`, { id: `prop-delete-${row.id}` });
      fetchProperties();
    }
  }, [fetchProperties]);

  // ── Real-time: viewings ────────────────────────────────────────────────────
  const handleViewingChange = useCallback((event: RealtimeEvent, row: Record<string, unknown>) => {
    setLastSyncTime(new Date());
    if (event === 'INSERT') {
      toast.info('New viewing scheduled', { id: `viewing-insert-${row.id}` });
    } else if (event === 'UPDATE') {
      toast.success('Viewing updated', { id: `viewing-update-${row.id}` });
    } else if (event === 'DELETE') {
      toast.warning('Viewing cancelled', { id: `viewing-delete-${row.id}` });
    }
  }, []);

  usePropertiesRealtime(handlePropertyChange);
  useViewingsRealtime(handleViewingChange);

  const filtered = useMemo(() => {
    let data = [...allProperties];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (p) =>
          p.building.toLowerCase().includes(q) ||
          p.unit.toLowerCase().includes(q) ||
          p.district.toLowerCase().includes(q) ||
          p.landlord.name.toLowerCase().includes(q) ||
          (p.shortCode ?? '').toLowerCase().includes(q) ||
          (p.keyLocation?.keyNumber ?? '').toLowerCase().includes(q) ||
          (p.contacts ?? []).some((c) => (c.customerCode ?? '').toLowerCase().includes(q))
      );
    }
    if (villageFilter) data = data.filter((p) => (p.district ?? '').toLowerCase() === villageFilter.toLowerCase() || (p.village ?? '').toLowerCase() === villageFilter.toLowerCase());
    if (phaseFilter) data = data.filter((p) => String((p as any).phase ?? '') === phaseFilter);
    if (contactStatusFilter !== 'all') data = data.filter((p) => (p.contactStatus ?? 'active') === contactStatusFilter);
    if (statusFilter !== 'all') data = data.filter((p) => p.status === Number(statusFilter));
    if (occupancyFilter !== 'all') data = data.filter((p) => p.occupancyStatus === occupancyFilter);
    if (batchFilter !== 'all') data = data.filter((p) => p.importBatchId === batchFilter);
    if (validationStatusFilter !== 'all') data = data.filter((p) => (p.validationStatus ?? 'valid') === validationStatusFilter);
    // New search panel filters
    if (sPriceMin) data = data.filter((p) => (p.salePrice ?? 0) >= Number(sPriceMin));
    if (sPriceMax) data = data.filter((p) => (p.salePrice ?? 0) <= Number(sPriceMax));
    if (availability) data = data.filter((p) => p.occupancyStatus === availability);
    if (directionFilter) data = data.filter((p) => (p.direction ?? '').toLowerCase() === directionFilter.toLowerCase());
    if (bedsFilter) data = data.filter((p) => String(p.bedrooms ?? '') === bedsFilter);
    if (unitFilter) {
      const uq = unitFilter.toLowerCase().trim();
      data = data.filter((p) => p.unit.toLowerCase().trim() === uq);
    }
    if (activeStatus) data = data.filter((p) => String(p.status) === activeStatus);
    if (featuresFilter.length > 0) data = data.filter((p) => featuresFilter.every((f) => (p.additionalFeatures ?? []).some((af) => af.toLowerCase() === f.toLowerCase())));
    if (viewsFilter) data = data.filter((p) => (p.view ?? '').toLowerCase().includes(viewsFilter.toLowerCase()));
    if (bathroomsFilter) data = data.filter((p) => String(p.bathrooms ?? '') === bathroomsFilter);
    if (contactPerson) {
      const cq = contactPerson.toLowerCase();
      data = data.filter((p) => p.landlord.name.toLowerCase().includes(cq) || (p.contacts ?? []).some((c) => c.name.toLowerCase().includes(cq)));
    }
    if (rentType) {
      if (rentType === 'Unknown') {
        data = data.filter((p) => { const lt = (p as any).listingType; return !lt || lt === '' || lt.toLowerCase() === 'unknown'; });
      } else {
        data = data.filter((p) => (p as any).listingType?.toLowerCase() === rentType.toLowerCase());
      }
    }
    if (gSizeMin) data = data.filter((p) => (p.grossSqft ?? 0) >= Number(gSizeMin));
    if (gSizeMax) data = data.filter((p) => (p.grossSqft ?? 0) <= Number(gSizeMax));
    if (furnishingFilter) data = data.filter((p) => (p.floorType ?? '').toLowerCase().includes(furnishingFilter.toLowerCase()));
    if (propertyTypeFilter) data = data.filter((p) => ((p as any).buildingType ?? '').toLowerCase().includes(propertyTypeFilter.toLowerCase()));
    if (decorationsFilter) data = data.filter((p) => (p.decoration ?? '').toLowerCase().includes(decorationsFilter.toLowerCase()));
    if (phoneNumber) {
      const pq = phoneNumber.toLowerCase();
      data = data.filter((p) => p.landlord.phone.toLowerCase().includes(pq) || (p.contacts ?? []).some((c) => (c.mobile ?? '').toLowerCase().includes(pq)));
    }
    if (sSizeMin) data = data.filter((p) => (p.sqft ?? 0) >= Number(sSizeMin));
    if (sSizeMax) data = data.filter((p) => (p.sqft ?? 0) <= Number(sSizeMax));
    if (floorFrom) data = data.filter((p) => {
      const parsed = parseFlatFromShortCode(p.shortCode);
      const rawFloor = p.floor ?? '0';
      const floorNum = parsed ? parseInt(parsed.floor, 10) : (/^[1-9]\d{2}$/.test(rawFloor.trim()) ? parseInt(rawFloor.trim().slice(1), 10) : parseInt(rawFloor, 10));
      return !isNaN(floorNum) && floorNum >= Number(floorFrom);
    });
    if (floorTo) data = data.filter((p) => {
      const parsed = parseFlatFromShortCode(p.shortCode);
      const rawFloor = p.floor ?? '0';
      const floorNum = parsed ? parseInt(parsed.floor, 10) : (/^[1-9]\d{2}$/.test(rawFloor.trim()) ? parseInt(rawFloor.trim().slice(1), 10) : parseInt(rawFloor, 10));
      return !isNaN(floorNum) && floorNum <= Number(floorTo);
    });
    if (highlightFilter) data = data.filter((p) => (p.highlight ?? '').toLowerCase().includes(highlightFilter.toLowerCase()));
    if (sortKey !== 'none') {
      data.sort((a, b) => {
        const av = a[sortKey as keyof Property];
        const bv = b[sortKey as keyof Property];
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === 'string' && typeof bv === 'string') {
          return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
        }
        if (typeof av === 'number' && typeof bv === 'number') {
          return sortDir === 'asc' ? av - bv : bv - av;
        }
        return 0;
      });
    }
    return data;
  }, [search, villageFilter, phaseFilter, contactStatusFilter, statusFilter, occupancyFilter, batchFilter, validationStatusFilter, sPriceMin, sPriceMax, availability, directionFilter, bedsFilter, unitFilter, activeStatus, featuresFilter, viewsFilter, bathroomsFilter, contactPerson, rentType, gSizeMin, gSizeMax, furnishingFilter, propertyTypeFilter, decorationsFilter, phoneNumber, sSizeMin, sSizeMax, floorFrom, floorTo, highlightFilter, sortKey, sortDir, allProperties]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  function toggleRow(id: string) {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedRows.size === paginated.length) setSelectedRows(new Set());
    else setSelectedRows(new Set(paginated.map((p) => p.id)));
  }

  function handleBulkExport() {
    const selectedProps = allProperties.filter((p) => selectedRows.has(p.id));
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const rows = selectedProps.map((p) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;">${p.shortCode ?? '—'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;">${p.unit ?? ''} ${p.building ?? ''}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;">${p.village ?? ''}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;">${p.bedrooms ?? '—'} bed / ${p.bathrooms ?? '—'} bath</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;">${p.sqft ? p.sqft + ' sq ft' : '—'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;">${p.monthlyRent ? 'HKD ' + p.monthlyRent.toLocaleString() : '—'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;">${p.status ?? '—'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;">${p.occupancyStatus ?? '—'}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Property Export - ${dateStr}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 30px; color: #111; }
    h1 { font-size: 20px; color: #1B4F8A; margin-bottom: 4px; }
    p.subtitle { font-size: 12px; color: #6b7280; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #1B4F8A; color: white; }
    thead th { padding: 8px 10px; text-align: left; font-size: 12px; font-weight: 600; }
    tbody tr:nth-child(even) { background: #f9fafb; }
    @media print { body { margin: 15px; } }
  </style>
</head>
<body>
  <h1>PropTrack — Property Export</h1>
  <p class="subtitle">Generated: ${dateStr} &nbsp;|&nbsp; ${selectedProps.length} properties selected</p>
  <table>
    <thead>
      <tr>
        <th>Short Code</th>
        <th>Unit / Building</th>
        <th>Village</th>
        <th>Beds / Baths</th>
        <th>Size</th>
        <th>Rental Price</th>
        <th>Status</th>
        <th>Occupancy</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `properties-export-${dateStr}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded export for ${selectedProps.length} properties`);
    setSelectedRows(new Set());
  }

  async function openAssignAgent() {
    setAssignAgentOpen(true);
    setSelectedAgentId('');
    if (agents.length === 0) {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('user_profiles')
          .select('id, full_name, email, role')
          .eq('is_active', true)
          .order('full_name', { ascending: true });
        if (data) setAgents(data);
      } catch {
        // silently ignore
      }
    }
  }

  async function handleConfirmAssign() {
    if (!selectedAgentId) return;
    const agent = agents.find((a) => a.id === selectedAgentId);
    if (!agent) return;
    setAssigningAgent(true);
    try {
      const supabase = createClient();
      const ids = Array.from(selectedRows);
      await supabase
        .from('properties')
        .update({ advertising_agent: agent.full_name })
        .in('id', ids);
      toast.success(`${selectedRows.size} properties assigned to ${agent.full_name}`);
      setAssignAgentOpen(false);
      setSelectedRows(new Set());
      fetchProperties();
    } catch {
      toast.error('Failed to assign agent. Please try again.');
    } finally {
      setAssigningAgent(false);
    }
  }

  function handleBulkAssign() {
    openAssignAgent();
  }

  const hasActiveFilters = search || villageFilter || phaseFilter || sPriceMin || sPriceMax || availability || directionFilter || bedsFilter || unitFilter || activeStatus || featuresFilter.length > 0 || viewsFilter || bathroomsFilter || contactPerson || rentType || gSizeMin || gSizeMax || furnishingFilter || propertyTypeFilter || decorationsFilter || phoneNumber || sSizeMin || sSizeMax || floorFrom || floorTo || highlightFilter;

  function exportToCSV() {
    const headers = [
      'Unit', 'Building', 'Short Code', 'District', 'Village', 'Street',
      'Type', 'Status', 'Occupancy Status', 'Contact Status',
      'Bedrooms', 'Bathrooms', 'Sq Ft', 'Floor', 'Floor Number', 'Floor Type',
      'Building Type', 'Direction', 'Outdoor Area', 'Additional Features',
      'Year Built', 'Monthly Rent (HKD)', 'Sale Price (HKD)',
      'Listing Date', 'Vacant Date', 'Owner',
      'Landlord Name', 'Landlord Phone', 'Landlord Email', 'Landlord ID',
      'Tenant Name', 'Tenant Phone', 'Tenant Email', 'Tenant ID',
      'Lease Start', 'Lease End', 'Deposit', 'Stamp Duty Paid', 'CR109 Filed',
      'Key Location Type', 'Key Number', 'Key Agent Name', 'Key Agent Phone',
      'Highlight', 'Agent Notes', 'Last Updated', 'Updated By',
      'Has Floor Plan', 'Matterport Link', 'Website Link',
      'Contact 1 Name', 'Contact 1 Relationship', 'Contact 1 Mobile', 'Contact 1 Email', 'Contact 1 Customer Code',
      'Contact 2 Name', 'Contact 2 Relationship', 'Contact 2 Mobile', 'Contact 2 Email', 'Contact 2 Customer Code',
    ];

    const escape = (val: unknown): string => {
      if (val == null) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = filtered.map((p) => {
      const c1 = p.contacts?.[0];
      const c2 = p.contacts?.[1];
      return [
        p.unit, p.building, p.shortCode ?? '', p.district, p.village ?? '', p.street,
        p.type, p.status, p.occupancyStatus, p.contactStatus ?? 'active',
        p.bedrooms ?? '', p.bathrooms ?? '', p.sqft, p.floor, p.floorNumber ?? '', p.floorType ?? '',
        p.buildingType ?? '', p.direction ?? '', p.outdoorArea ?? '',
        (p.additionalFeatures ?? []).join('; '),
        p.yearBuilt, p.monthlyRent ?? '', p.salePrice ?? '',
        p.listingDate ?? '', p.vacantDate ?? '', p.owner ?? '',
        p.landlord.name, p.landlord.phone, p.landlord.email, p.landlord.idNumber,
        p.tenant?.name ?? '', p.tenant?.phone ?? '', p.tenant?.email ?? '', p.tenant?.idNumber ?? '',
        p.tenant?.leaseStart ?? '', p.tenant?.leaseEnd ?? '',
        p.tenant?.deposit ?? '', p.tenant?.stampDutyPaid ?? '', p.tenant?.cr109Filed ?? '',
        p.keyLocation?.type ?? '', p.keyLocation?.keyNumber ?? '',
        p.keyLocation?.agentName ?? '', p.keyLocation?.agentPhone ?? '',
        p.highlight ?? '', p.agentNotes, p.lastUpdated, p.updatedBy,
        p.hasFloorPlan, p.matterportLink ?? '', p.websiteLink ?? '',
        c1?.name ?? '', c1?.relationship ?? '', c1?.mobile ?? '', c1?.email ?? '', c1?.customerCode ?? '',
        c2?.name ?? '', c2?.relationship ?? '', c2?.mobile ?? '', c2?.email ?? '', c2?.customerCode ?? '',
      ].map(escape).join(',');
    });

    const csvContent = [headers.map(escape).join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const filterSuffix = hasActiveFilters ? '-filtered' : '-all';
    link.href = url;
    link.download = `properties${filterSuffix}-${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} properties to CSV`);
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <Icon name="ChevronUpDownIcon" size={12} className="text-[hsl(215,15%,62%)] ml-1" />;
    return sortDir === 'asc'
      ? <Icon name="ChevronUpIcon" size={12} className="text-[#1B4F8A] ml-1" />
      : <Icon name="ChevronDownIcon" size={12} className="text-[#1B4F8A] ml-1" />;
  };

  return (
    <div className="space-y-3">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[hsl(215,25%,18%)]">Property Management</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-[hsl(215,15%,52%)]">
              {dbLoading ? (
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 border-2 border-[#1B4F8A]/30 border-t-[#1B4F8A] rounded-full animate-spin" />
                  Loading properties…
                </span>
              ) : (
                `${filtered.length.toLocaleString()} residential properties`
              )}
            </p>
            {dbError && (
              <span className="text-[10px] text-red-500 flex items-center gap-1">
                <Icon name="AlertTriangleIcon" size={10} />
                {dbError}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
              {liveUpdateCount > 0 && (
                <span className="ml-0.5 bg-emerald-500 text-white rounded-full px-1 text-[9px]">{liveUpdateCount}</span>
              )}
            </span>
            {lastSyncTime && (
              <span className="text-[10px] text-[hsl(215,15%,62%)]">
                Synced {lastSyncTime.toLocaleTimeString('en-HK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-primary py-1 text-xs"
            onClick={() => setAddPropertyOpen(true)}
          >
            <Icon name="PlusIcon" size={13} />
            Add Property
          </button>
          {isAdmin && (
          <button className="btn-secondary py-1 text-xs" onClick={exportToCSV}>
            <Icon name="DownloadIcon" size={13} />
            Export CSV
          </button>
          )}
          <button className="btn-secondary py-1 text-xs">
            <Icon name="PrinterIcon" size={13} />
            Print
          </button>
        </div>
      </div>

      {/* ── Advanced Search Panel ─────────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden border border-[hsl(36,25%,84%)] shadow-sm">
        {/* Header bar */}
        <div className="flex items-center justify-between bg-[#8B1A2B] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Icon name="SearchIcon" size={14} className="text-white/80" />
            <span className="text-sm font-semibold text-white">Search</span>
            <span className="text-sm text-white/70">Property</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSearch(''); setVillageFilter(''); setSPriceMin(''); setSPriceMax('');
                setAvailability(''); setDirectionFilter(''); setBedsFilter(''); setUnitFilter('');
                setActiveStatus(''); setLPriceMin(''); setLPriceMax('');
                setFeaturesFilter([]); setViewsFilter(''); setBathroomsFilter('');
                setContactPerson(''); setRentType(''); setGSizeMin(''); setGSizeMax('');
                setFurnishingFilter(''); setPropertyTypeFilter(''); setDecorationsFilter('');
                setPhoneNumber(''); setSSizeMin(''); setSSizeMax('');
                setFloorFrom(''); setFloorTo('');
                setHighlightFilter(''); setPhaseFilter(''); setPage(1);
              }}
              className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors border border-white/20"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Search fields grid */}
        <div className="bg-white divide-y divide-[hsl(36,25%,88%)]">
          {/* Row 1: Keyword, S.Price Min/Max, Availability, Directions, Beds, Unit */}
          <div className="grid grid-cols-9 divide-x divide-[hsl(36,25%,88%)]">
            {/* Keyword / Fast Key */}
            <div className="flex items-center gap-1.5 px-3 py-2">
              <input
                type="text"
                placeholder="Keyword"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="flex-1 text-xs text-[hsl(215,25%,30%)] placeholder-[hsl(215,15%,65%)] bg-transparent outline-none"
              />
            </div>
            {/* S.Price Min / Max */}
            <div className="flex items-stretch gap-1 px-3 py-2 col-span-3">
              <input
                type="number"
                placeholder="Sale Price Min"
                value={sPriceMin}
                onChange={(e) => { setSPriceMin(e.target.value); setPage(1); }}
                className="min-w-0 flex-1 text-xs text-[hsl(215,25%,30%)] placeholder-[hsl(215,15%,65%)] bg-transparent outline-none self-center"
              />
              <span className="flex items-center self-center flex-shrink-0"><Icon name="ArrowsRightLeftIcon" size={12} className="text-[hsl(215,15%,60%)] block" /></span>
              <input
                type="number"
                placeholder="Sale Price Max"
                value={sPriceMax}
                onChange={(e) => { setSPriceMax(e.target.value); setPage(1); }}
                className="min-w-0 flex-1 text-xs text-right text-[hsl(215,25%,30%)] placeholder-[hsl(215,15%,65%)] bg-transparent outline-none self-center"
              />
            </div>
            {/* Availability */}
            <div className="flex items-center px-3 py-2">
              <select
                value={availability}
                onChange={(e) => { setAvailability(e.target.value); setPage(1); }}
                className="w-full text-xs text-[hsl(215,25%,30%)] bg-transparent outline-none appearance-none cursor-pointer"
              >
                <option value="">Availability ...</option>
                <option value="vacant">Vacant</option>
                <option value="vacant-soon">Vacant Soon</option>
                <option value="leased">Leased</option>
                <option value="with-ta">With TA</option>
              </select>
              <Icon name="ChevronUpDownIcon" size={12} className="text-[hsl(215,15%,60%)] flex-shrink-0 -ml-1 pointer-events-none" />
            </div>
            {/* Directions */}
            <div className="flex items-center px-3 py-2">
              <select
                value={directionFilter}
                onChange={(e) => { setDirectionFilter(e.target.value); setPage(1); }}
                className="w-full text-xs text-[hsl(215,25%,30%)] bg-transparent outline-none appearance-none cursor-pointer"
              >
                <option value="">Directions ...</option>
                <option value="North">North</option>
                <option value="North East">North East</option>
                <option value="East">East</option>
                <option value="South East">South East</option>
                <option value="South">South</option>
                <option value="South West">South West</option>
                <option value="West">West</option>
                <option value="North West">North West</option>
              </select>
              <Icon name="ChevronUpDownIcon" size={12} className="text-[hsl(215,15%,60%)] flex-shrink-0 -ml-1 pointer-events-none" />
            </div>
            {/* Beds */}
            <div className="flex items-center px-3 py-2">
              <select
                value={bedsFilter}
                onChange={(e) => { setBedsFilter(e.target.value); setPage(1); }}
                className="w-full text-xs text-[hsl(215,25%,30%)] bg-transparent outline-none appearance-none cursor-pointer"
              >
                <option value="">Beds ...</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5+</option>
              </select>
              <Icon name="ChevronUpDownIcon" size={12} className="text-[hsl(215,15%,60%)] flex-shrink-0 -ml-1 pointer-events-none" />
            </div>
            {/* Unit */}
            <div className="flex items-center gap-1.5 px-3 py-2 col-span-1">
              <input
                type="text"
                placeholder="Unit"
                value={unitFilter}
                onChange={(e) => { setUnitFilter(e.target.value); setPage(1); }}
                className="flex-1 text-xs text-[hsl(215,25%,30%)] placeholder-[hsl(215,15%,65%)] bg-transparent outline-none"
              />
              <Icon name="Squares2X2Icon" size={13} className="text-[hsl(215,15%,60%)] flex-shrink-0" />
            </div>
          </div>

          {/* Row 2: Active, L.Price Min/Max, Features, Views, Bathrooms, Contact Person */}
          <div className="grid grid-cols-9 divide-x divide-[hsl(36,25%,88%)]">
            {/* Active */}
            <div className="flex items-center px-3 py-2">
              <select
                value={activeStatus}
                onChange={(e) => { setActiveStatus(e.target.value); setPage(1); }}
                className="w-full text-xs text-[hsl(215,25%,30%)] bg-transparent outline-none appearance-none cursor-pointer"
              >
                <option value="">Status ...</option>
                <option value="0">Active</option>
                <option value="1">Leased</option>
                <option value="3">No Contact</option>
                <option value="2">Self Occupy</option>
                <option value="4">Sold</option>
                <option value="9">Unknown</option>
              </select>
              <Icon name="ChevronUpDownIcon" size={12} className="text-[hsl(215,15%,60%)] flex-shrink-0 -ml-1 pointer-events-none" />
            </div>
            {/* Range 20-30 */}
            <div className="flex items-stretch gap-1 px-3 py-2 col-span-3">
              <input
                type="number"
                placeholder="Lease Price Min"
                value={lPriceMin}
                onChange={(e) => { setLPriceMin(e.target.value); setPage(1); }}
                className="min-w-0 flex-1 text-xs text-[hsl(215,25%,30%)] placeholder-[hsl(215,15%,65%)] bg-transparent outline-none self-center"
              />
              <span className="flex items-center self-center flex-shrink-0"><Icon name="ArrowsRightLeftIcon" size={12} className="text-[hsl(215,15%,60%)] block" /></span>
              <input
                type="number"
                placeholder="Lease Price Max"
                value={lPriceMax}
                onChange={(e) => { setLPriceMax(e.target.value); setPage(1); }}
                className="min-w-0 flex-1 text-xs text-right text-[hsl(215,25%,30%)] placeholder-[hsl(215,15%,65%)] bg-transparent outline-none self-center"
              />
            </div>
            {/* Features */}
            <div className="relative flex items-center px-3 py-2">
              <FeaturesMultiSelect
                selected={featuresFilter}
                onChange={(vals) => { setFeaturesFilter(vals); setPage(1); }}
              />
            </div>
            {/* Views */}
            <div className="flex items-center px-3 py-2">
              <select
                value={viewsFilter}
                onChange={(e) => { setViewsFilter(e.target.value); setPage(1); }}
                className="w-full text-xs text-[hsl(215,25%,30%)] bg-transparent outline-none appearance-none cursor-pointer"
              >
                <option value="">Views ...</option>
                <option value="Sea View">Sea View</option>
                <option value="Mountain View">Mountain View</option>
                <option value="City View">City View</option>
                <option value="Green View">Green View</option>
                <option value="Pool View">Pool View</option>
                <option value="Garden View">Garden View</option>
                <option value="Street View">Street View</option>
                <option value="Open View">Open View</option>
              </select>
              <Icon name="ChevronUpDownIcon" size={12} className="text-[hsl(215,15%,60%)] flex-shrink-0 -ml-1 pointer-events-none" />
            </div>
            {/* Bathrooms */}
            <div className="flex items-center px-3 py-2">
              <select
                value={bathroomsFilter}
                onChange={(e) => { setBathroomsFilter(e.target.value); setPage(1); }}
                className="w-full text-xs text-[hsl(215,25%,30%)] bg-transparent outline-none appearance-none cursor-pointer"
              >
                <option value="">Bathrooms ...</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4+</option>
              </select>
              <Icon name="ChevronUpDownIcon" size={12} className="text-[hsl(215,15%,60%)] flex-shrink-0 -ml-1 pointer-events-none" />
            </div>
            {/* Contact Person */}
            <div className="flex items-center gap-1.5 px-3 py-2 col-span-1">
              <input
                type="text"
                placeholder="Contact Person"
                value={contactPerson}
                onChange={(e) => { setContactPerson(e.target.value); setPage(1); }}
                className="flex-1 text-xs text-[hsl(215,25%,30%)] placeholder-[hsl(215,15%,65%)] bg-transparent outline-none"
              />
              <Icon name="UserIcon" size={13} className="text-[hsl(215,15%,60%)] flex-shrink-0" />
            </div>
          </div>

          {/* Row 3: Rent, G.Size Min/Max, Furnishing, Property Type, Decorations, Phone Number */}
          <div className="grid grid-cols-9 divide-x divide-[hsl(36,25%,88%)]">
            {/* Rent type */}
            <div className="flex items-center px-3 py-2">
              <select
                value={rentType}
                onChange={(e) => { setRentType(e.target.value); setPage(1); }}
                className="w-full text-xs text-[hsl(215,25%,30%)] bg-transparent outline-none appearance-none cursor-pointer"
              >
                <option value="">Listing Type ...</option>
                <option value="Sale">Sale</option>
                <option value="Rent">Rent</option>
                <option value="Rent & Sale">Rent &amp; Sale</option>
                <option value="Unknown">Unknown</option>
              </select>
              <Icon name="ChevronUpDownIcon" size={12} className="text-[hsl(215,15%,60%)] flex-shrink-0 -ml-1 pointer-events-none" />
            </div>
            {/* G.Size Min / Max */}
            <div className="flex items-stretch gap-1 px-3 py-2 col-span-3">
              <input
                type="number"
                placeholder="Gross Size Min"
                value={gSizeMin}
                onChange={(e) => { setGSizeMin(e.target.value); setPage(1); }}
                className="min-w-0 flex-1 text-xs text-[hsl(215,25%,30%)] placeholder-[hsl(215,15%,65%)] bg-transparent outline-none self-center"
              />
              <span className="flex items-center self-center flex-shrink-0"><Icon name="ArrowsRightLeftIcon" size={12} className="text-[hsl(215,15%,60%)] block" /></span>
              <input
                type="number"
                placeholder="Gross Size Max"
                value={gSizeMax}
                onChange={(e) => { setGSizeMax(e.target.value); setPage(1); }}
                className="min-w-0 flex-1 text-xs text-right text-[hsl(215,25%,30%)] placeholder-[hsl(215,15%,65%)] bg-transparent outline-none self-center"
              />
            </div>
            {/* Furnishing */}
            <div className="flex items-center px-3 py-2">
              <select
                value={furnishingFilter}
                onChange={(e) => { setFurnishingFilter(e.target.value); setPage(1); }}
                className="w-full text-xs text-[hsl(215,25%,30%)] bg-transparent outline-none appearance-none cursor-pointer"
              >
                <option value="">Furnishing ...</option>
                <option value="Fully Furnished">Fully Furnished</option>
                <option value="Semi Furnished">Semi Furnished</option>
                <option value="Unfurnished">Unfurnished</option>
              </select>
              <Icon name="ChevronUpDownIcon" size={12} className="text-[hsl(215,15%,60%)] flex-shrink-0 -ml-1 pointer-events-none" />
            </div>
            {/* Property Type */}
            <div className="flex items-center px-3 py-2">
              <select
                value={propertyTypeFilter}
                onChange={(e) => { setPropertyTypeFilter(e.target.value); setPage(1); }}
                className="w-full text-xs text-[hsl(215,25%,30%)] bg-transparent outline-none appearance-none cursor-pointer"
              >
                <option value="">Property Type ...</option>
                <option value="High Rise">High Rise</option>
                <option value="Low Rise">Low Rise</option>
                <option value="House">House</option>
              </select>
              <Icon name="ChevronUpDownIcon" size={12} className="text-[hsl(215,15%,60%)] flex-shrink-0 -ml-1 pointer-events-none" />
            </div>
            {/* Decorations */}
            <div className="flex items-center px-3 py-2">
              <select
                value={decorationsFilter}
                onChange={(e) => { setDecorationsFilter(e.target.value); setPage(1); }}
                className="w-full text-xs text-[hsl(215,25%,30%)] bg-transparent outline-none appearance-none cursor-pointer"
              >
                <option value="">Decorations ...</option>
                <option value="Deluxe">Deluxe</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Original">Original</option>
              </select>
              <Icon name="ChevronUpDownIcon" size={12} className="text-[hsl(215,15%,60%)] flex-shrink-0 -ml-1 pointer-events-none" />
            </div>
            {/* Phone Number */}
            <div className="flex items-center gap-1.5 px-3 py-2 col-span-1">
              <input
                type="text"
                placeholder="Phone Number"
                value={phoneNumber}
                onChange={(e) => { setPhoneNumber(e.target.value); setPage(1); }}
                className="flex-1 text-xs text-[hsl(215,25%,30%)] placeholder-[hsl(215,15%,65%)] bg-transparent outline-none"
              />
              <Icon name="PhoneIcon" size={13} className="text-[hsl(215,15%,60%)] flex-shrink-0" />
            </div>
          </div>

          {/* Row 4: Villages, S.Size Min/Max, Floor From/To, Highlight */}
          <div className="grid grid-cols-7 divide-x divide-[hsl(36,25%,88%)]">
            {/* Villages */}
            <div className="flex items-center px-3 py-2">
              <select
                value={villageFilter}
                onChange={(e) => { setVillageFilter(e.target.value); setPage(1); }}
                className="w-full text-xs text-[hsl(215,25%,30%)] bg-transparent outline-none appearance-none cursor-pointer"
              >
                <option value="">Villages ...</option>
                {villages.filter((v) => v !== 'All Villages').map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              <Icon name="ChevronUpDownIcon" size={12} className="text-[hsl(215,15%,60%)] flex-shrink-0 -ml-1 pointer-events-none" />
            </div>
            {/* S.Size Min / Max */}
            <div className="flex items-stretch gap-1 px-3 py-2 col-span-2">
              <input
                type="number"
                placeholder="Sale Size Min"
                value={sSizeMin}
                onChange={(e) => { setSSizeMin(e.target.value); setPage(1); }}
                className="min-w-0 flex-1 text-xs text-[hsl(215,25%,30%)] placeholder-[hsl(215,15%,65%)] bg-transparent outline-none self-center"
              />
              <span className="flex items-center self-center flex-shrink-0"><Icon name="ArrowsRightLeftIcon" size={12} className="text-[hsl(215,15%,60%)] block" /></span>
              <input
                type="number"
                placeholder="Sale Size Max"
                value={sSizeMax}
                onChange={(e) => { setSSizeMax(e.target.value); setPage(1); }}
                className="min-w-0 flex-1 text-xs text-right text-[hsl(215,25%,30%)] placeholder-[hsl(215,15%,65%)] bg-transparent outline-none self-center"
              />
            </div>
            {/* Floor From / To */}
            <div className="flex items-stretch gap-1 px-3 py-2 col-span-2">
              <input
                type="number"
                placeholder="Floor From"
                value={floorFrom}
                onChange={(e) => { setFloorFrom(e.target.value); setPage(1); }}
                className="min-w-0 flex-1 text-xs text-[hsl(215,25%,30%)] placeholder-[hsl(215,15%,65%)] bg-transparent outline-none self-center"
              />
              <span className="flex items-center self-center flex-shrink-0"><Icon name="ArrowsRightLeftIcon" size={12} className="text-[hsl(215,15%,60%)] block" /></span>
              <input
                type="number"
                placeholder="Floor To"
                value={floorTo}
                onChange={(e) => { setFloorTo(e.target.value); setPage(1); }}
                className="min-w-0 flex-1 text-xs text-right text-[hsl(215,25%,30%)] placeholder-[hsl(215,15%,65%)] bg-transparent outline-none self-center"
              />
            </div>
            {/* Highlight */}
            <div className="flex items-center gap-1.5 px-3 py-2 col-span-2">
              <input
                type="text"
                placeholder="Highlight"
                value={highlightFilter}
                onChange={(e) => { setHighlightFilter(e.target.value); setPage(1); }}
                className="flex-1 text-xs text-[hsl(215,25%,30%)] placeholder-[hsl(215,15%,65%)] bg-transparent outline-none"
              />
              <Icon name="FolderOpenIcon" size={13} className="text-[hsl(215,15%,60%)] flex-shrink-0" />
            </div>
          </div>

          {/* Row 5: Phase */}
          <div className="grid grid-cols-5 divide-x divide-[hsl(36,25%,88%)]">
            {/* Phase */}
            <div className="flex items-center px-3 py-2">
              <select
                value={phaseFilter}
                onChange={(e) => { setPhaseFilter(e.target.value); setPage(1); }}
                className="w-full text-xs text-[hsl(215,25%,30%)] bg-transparent outline-none appearance-none cursor-pointer"
              >
                <option value="">Phase ...</option>
                {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16].map((n) => (
                  <option key={n} value={String(n)}>Phase {n}</option>
                ))}
              </select>
              <Icon name="ChevronUpDownIcon" size={12} className="text-[hsl(215,15%,60%)] flex-shrink-0 -ml-1 pointer-events-none" />
            </div>
            {/* Empty filler columns */}
            <div className="col-span-4" />
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedRows.size > 0 && (
        <div className="animate-slide-up fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1B4F8A] text-white rounded-xl shadow-modal px-5 py-3 flex items-center gap-4">
          <span className="text-sm font-semibold">{selectedRows.size} selected</span>
          <div className="w-px h-5 bg-white/30" />
          <button onClick={handleBulkExport} className="flex items-center gap-1.5 text-sm hover:text-blue-200 transition-colors">
            <Icon name="DownloadIcon" size={14} />
            Export
          </button>
          <button onClick={handleBulkAssign} className="flex items-center gap-1.5 text-sm hover:text-blue-200 transition-colors">
            <Icon name="UserCheckIcon" size={14} />
            Assign Agent
          </button>
          <button
            onClick={() => setBatchEditOpen(true)}
            className="flex items-center gap-1.5 text-sm hover:text-blue-200 transition-colors"
          >
            <Icon name="PencilIcon" size={14} />
            Batch Edit
          </button>
          <button
            onClick={() => setBulkViewingOpen(true)}
            className="flex items-center gap-1.5 text-sm hover:text-blue-200 transition-colors"
          >
            <Icon name="CalendarIcon" size={14} />
            Viewing Schedule
          </button>
          <button onClick={() => setSelectedRows(new Set())} className="flex items-center gap-1.5 text-sm hover:text-blue-200 transition-colors">
            <Icon name="XIcon" size={14} />
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="border-b border-[hsl(214,20%,88%)] bg-[hsl(210,20%,97%)]">
                <th className="px-3 py-2 w-8">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === paginated.length && paginated.length > 0}
                    onChange={toggleAll}
                    className="rounded border-[hsl(214,20%,88%)] accent-[#1B4F8A]"
                  />
                </th>
                {[
                  { label: 'Photo', key: 'none' as SortKey },
                  { label: 'Unit / Building', key: 'building' as SortKey },
                  { label: 'Short Code', key: 'shortCode' as SortKey },
                  { label: 'PID', key: 'none' as SortKey },
                  { label: 'Status / Occupancy', key: 'status' as SortKey },
                  { label: 'Sale Price', key: 'salePrice' as SortKey },
                  { label: 'Rental Price', key: 'monthlyRent' as SortKey },
                  { label: 'Key', key: 'none' as SortKey },
                  { label: 'Owner', key: 'none' as SortKey },
                  { label: 'sq ft', key: 'sqft' as SortKey },
                  { label: 'Lease End', key: 'none' as SortKey },
                  { label: 'Highlight / Comments', key: 'none' as SortKey },
                  { label: 'Last Updated', key: 'lastUpdated' as SortKey },
                  { label: 'Actions', key: 'none' as SortKey },
                ].map((col) => (
                  <th
                    key={`th-${col.label}`}
                    className="px-3 py-2 text-left text-[11px] font-semibold text-[hsl(215,15%,52%)] whitespace-nowrap cursor-pointer select-none"
                    onClick={() => col.key !== 'none' && handleSort(col.key)}
                  >
                    <span className="flex items-center">
                      {col.label}
                      {col.key !== 'none' && <SortIcon col={col.key} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dbLoading ? (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-3 border-[#1B4F8A]/20 border-t-[#1B4F8A] rounded-full animate-spin" />
                      <p className="text-sm text-[hsl(215,15%,52%)]">Loading properties from database…</p>
                    </div>
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[hsl(210,15%,94%)] flex items-center justify-center">
                        <Icon name="BuildingIcon" size={20} className="text-[hsl(215,15%,52%)]" />
                      </div>
                      <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">No properties found</p>
                      <p className="text-xs text-[hsl(215,15%,52%)]">Try adjusting your search or filter criteria</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((prop, idx) => {
                  const leaseExpiring = prop.tenant ? isLeaseExpiringSoon(prop.tenant.leaseEnd) : false;
                  const recentComments = (prop.comments ?? []).slice(0, 2);
                  return (
                    <tr
                      key={prop.id}
                      className={`border-b border-[hsl(214,20%,92%)] hover:bg-[hsl(210,15%,97%)] transition-colors cursor-pointer ${idx % 2 !== 0 ? 'bg-[hsl(210,20%,98.5%)]' : ''} ${selectedRows.has(prop.id) ? 'bg-[#1B4F8A]/5' : ''}`}
                      onClick={() => setSelectedProperty(prop)}
                    >
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedRows.has(prop.id)}
                          onChange={() => toggleRow(prop.id)}
                          className="rounded border-[hsl(214,20%,88%)] accent-[#1B4F8A]"
                        />
                      </td>
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <PropertyThumbnail propertyId={prop.id} propertyRef={prop.ref} />
                      </td>
                      <td className="px-3 py-2 min-w-[160px]">
                        <div className="flex flex-col gap-0.5">
                          {/* Flat / Unit number */}
                          {(() => {
                            const parsed = parseFlatFromShortCode(prop.shortCode);
                            const buildingPrefix = (prop as any).buildingName ? `${(prop as any).buildingName}, ` : '';
                            if (parsed) {
                              return (
                                <p className="text-xs font-bold text-[hsl(215,25%,18%)] leading-tight">
                                  {`${buildingPrefix}Unit ${parsed.flat}`}
                                </p>
                              );
                            }
                            // Fallback: no short_code available
                            if (prop.unit) {
                              return (
                                <p className="text-xs font-bold text-[hsl(215,25%,18%)] leading-tight">
                                  {`${buildingPrefix}Unit ${prop.unit}`}
                                </p>
                              );
                            }
                            return null;
                          })()}
                          {/* Building Name — now shown inline in main label above */}
                          {/* Village */}
                          {prop.village && (
                            <p className="text-[11px] text-[hsl(215,15%,52%)] leading-tight">{prop.village}</p>
                          )}
                          {/* Phase */}
                          {(prop as any).phase && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold w-fit">
                              Phase {(prop as any).phase}
                            </span>
                          )}
                          {/* Floor Number — shown inline in main label above */}
                          {/* Building Type */}
                          {(prop as any).buildingType && (
                            <p className="text-[10px] text-[hsl(215,15%,52%)] leading-tight">
                              <span className="font-semibold text-[hsl(215,25%,30%)]">{(prop as any).buildingType}</span>
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {prop.shortCode ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-[#1B4F8A]/10 text-[#1B4F8A] text-[11px] font-mono font-semibold tracking-wide">
                            {prop.shortCode}
                          </span>
                        ) : (
                          <span className="text-[11px] text-[hsl(215,15%,62%)] italic">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {prop.ref ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[11px] font-mono font-semibold tracking-wide">
                            {prop.ref}
                          </span>
                        ) : (
                          <span className="text-[11px] text-[hsl(215,15%,62%)] italic">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-0.5">
                          <StatusBadge status={prop.status as Parameters<typeof StatusBadge>[0]['status']} />
                          <StatusBadge status={prop.occupancyStatus as Parameters<typeof StatusBadge>[0]['status']} />
                          {contactStatusBadge(prop.contactStatus)}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {prop.salePrice ? (
                          <span className="text-xs font-mono font-semibold text-violet-700 tabular-nums">
                            HK${((v) => v % 1 === 0 ? v.toFixed(0) : v.toFixed(1))(prop.salePrice / 1000000)}M
                          </span>
                        ) : (
                          <span className="text-[11px] text-[hsl(215,15%,62%)] italic">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {prop.monthlyRent ? (
                          <span className="text-xs font-mono font-semibold text-[hsl(215,25%,18%)] tabular-nums">
                            HK${prop.monthlyRent.toLocaleString()}/mo
                          </span>
                        ) : (
                          <span className="text-[11px] text-[hsl(215,15%,62%)] italic">—</span>
                        )}
                      </td>
                      {/* Key Location — icon + popover (always shown, loads key log on hover) */}
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <Popover
                          trigger={
                            <button
                              className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,92%)] transition-colors group/key"
                              title="View key info"
                            >
                              <Icon name="KeyIcon" size={15} className={prop.keyLocation ? 'text-amber-600 group-hover/key:text-amber-700' : 'text-[hsl(215,15%,72%)] group-hover/key:text-amber-500'} />
                            </button>
                          }
                        >
                          <KeyLocationPopover prop={prop} />
                        </Popover>
                      </td>
                      {/* Owner — looked up directly from ownerMap by property_ref / short_code */}
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const refKey = (prop.ref ?? '').trim().toLowerCase();
                          const scKey = (prop.shortCode ?? '').trim().toLowerCase();
                          const contactRows = (refKey && ownerMap[refKey]) || (scKey && ownerMap[scKey]) || [];
                          const ownerRow = contactRows.find((c) => (c.contact_role ?? '').toLowerCase() === 'owner') ?? contactRows[0] ?? null;
                          const ownerName = ownerRow?.contact_person?.trim() || prop.owner || prop.landlord.name;
                          if (!ownerName) return <span className="text-[11px] text-[hsl(215,15%,62%)] italic">—</span>;
                          const popoverContacts = contactRows.map((c) => ({
                            id: c.id,
                            name: c.contact_person,
                            relationship: c.contact_role,
                            mobile: c.contact_number,
                            email: c.contact_email,
                            telephone: '',
                            customerCode: undefined,
                          }));
                          const propWithContacts = { ...prop, contacts: popoverContacts.length > 0 ? popoverContacts : prop.contacts };
                          return (
                            <Popover
                              trigger={
                                <button
                                  className="text-left hover:underline hover:text-[#1B4F8A] transition-colors"
                                  title="View owner contact details"
                                >
                                  <p className="text-xs font-semibold text-[#1B4F8A] whitespace-nowrap">{ownerName}</p>
                                </button>
                              }
                            >
                              <ContactsPopover prop={propWithContacts} />
                            </Popover>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2 text-xs font-mono tabular-nums text-[hsl(215,25%,18%)] whitespace-nowrap">
                        {prop.sqft ? prop.sqft.toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {prop.tenant ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-mono text-[hsl(215,25%,18%)]">{prop.tenant.leaseEnd}</span>
                            {leaseExpiring && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-600 text-[10px] font-semibold border border-orange-200 whitespace-nowrap">
                                <Icon name="AlertTriangleIcon" size={9} />
                                Expiring
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-[hsl(215,15%,62%)] italic">—</span>
                        )}
                      </td>
                      {/* Highlight + Recent Comments */}
                      <td className="px-3 py-2 max-w-[220px]">
                        <div className="space-y-1">
                          {prop.highlight && (
                            <div className="flex items-start gap-1 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
                              <Icon name="StarIcon" size={10} className="text-yellow-500 flex-shrink-0 mt-0.5" />
                              <p className="text-[10px] text-yellow-800 leading-snug line-clamp-1">{prop.highlight}</p>
                            </div>
                          )}
                          {recentComments.length > 0 && (
                            <div className="space-y-0.5">
                              {recentComments.map((c) => (
                                <div key={c.id} className="flex items-start gap-1">
                                  <Icon name="MessageSquareIcon" size={9} className="text-[hsl(215,15%,62%)] flex-shrink-0 mt-0.5" />
                                  <p className="text-[10px] text-[hsl(215,15%,52%)] leading-snug line-clamp-1">
                                    <span className="font-semibold text-[hsl(215,25%,30%)]">{c.agent.split(' ')[0]}:</span> {c.text}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                          {prop.agentNotes && !prop.highlight && recentComments.length === 0 && (
                            <p className="text-[10px] text-[hsl(215,15%,52%)] line-clamp-2">{prop.agentNotes}</p>
                          )}
                          {!prop.highlight && !prop.agentNotes && recentComments.length === 0 && (
                            <span className="text-[11px] text-[hsl(215,15%,62%)] italic">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <p className="text-[11px] text-[hsl(215,25%,18%)] font-mono">{prop.lastUpdated}</p>
                        <p className="text-[11px] text-[hsl(215,15%,52%)]">{prop.updatedBy}</p>
                      </td>
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => setSelectedProperty(prop)}
                            className="p-1 rounded hover:bg-[hsl(210,15%,94%)] transition-colors"
                            title="View property details"
                          >
                            <Icon name="EyeIcon" size={13} className="text-[#1B4F8A]" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setQuickViewingProp(prop); }}
                            className="p-1 rounded hover:bg-blue-50 transition-colors"
                            title="Quick-add viewing"
                          >
                            <Icon name="CalendarPlusIcon" size={13} className="text-blue-500" />
                          </button>
{/* Delete button removed */}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-[hsl(214,20%,88%)] bg-[hsl(210,20%,98%)]">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[hsl(215,15%,52%)]">
              {dbLoading ? 'Loading…' : `Showing ${Math.min((page - 1) * perPage + 1, filtered.length)}–${Math.min(page * perPage, filtered.length)} of ${filtered.length}`}
            </span>
            <select
              value={perPage}
              onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
              className="input-base w-auto text-xs py-1"
            >
              {[10, 25, 50, 100].map((n) => <option key={`pp-${n}`} value={n}>{n} per page</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button
              disabled={page === 1}
              onClick={() => setPage(1)}
              className="p-1.5 rounded hover:bg-[hsl(210,15%,94%)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Icon name="ChevronsLeftIcon" size={13} className="text-[hsl(215,15%,52%)]" />
            </button>
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="p-1.5 rounded hover:bg-[hsl(210,15%,94%)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Icon name="ChevronLeftIcon" size={13} className="text-[hsl(215,15%,52%)]" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
              return (
                <button
                  key={`page-${p}`}
                  onClick={() => setPage(p)}
                  className={`w-7 h-7 text-xs rounded font-medium transition-colors ${page === p ? 'bg-[#1B4F8A] text-white' : 'hover:bg-[hsl(210,15%,94%)] text-[hsl(215,25%,18%)]'}`}
                >
                  {p}
                </button>
              );
            })}
            <button
              disabled={page === totalPages || totalPages === 0}
              onClick={() => setPage(page + 1)}
              className="p-1.5 rounded hover:bg-[hsl(210,15%,94%)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Icon name="ChevronRightIcon" size={13} className="text-[hsl(215,15%,52%)]" />
            </button>
            <button
              disabled={page === totalPages || totalPages === 0}
              onClick={() => setPage(totalPages)}
              className="p-1.5 rounded hover:bg-[hsl(210,15%,94%)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Icon name="ChevronsRightIcon" size={13} className="text-[hsl(215,15%,52%)]" />
            </button>
          </div>
        </div>
      </div>

      {/* Property Detail Modal */}
      {selectedProperty && (
        <PropertyDetailModal
          property={selectedProperty}
          onClose={() => setSelectedProperty(null)}
          onSaved={fetchProperties}
        />
      )}

      {/* Quick-Add Viewing Modal */}
      {quickViewingProp && (
        <ViewingSchedule
          property={quickViewingProp}
          onClose={() => setQuickViewingProp(null)}
        />
      )}

      {/* Bulk Viewing Schedule Modal */}
      {bulkViewingOpen && (
        <BulkViewingSchedule
          properties={allProperties.filter((p) => selectedRows.has(p.id))}
          onClose={() => setBulkViewingOpen(false)}
        />
      )}

      {/* Assign Agent Modal */}
      {assignAgentOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-modal w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[hsl(215,25%,20%)]">Assign Agent</h2>
              <button
                onClick={() => setAssignAgentOpen(false)}
                className="text-[hsl(215,15%,55%)] hover:text-[hsl(215,25%,20%)] transition-colors"
              >
                <Icon name="XMarkIcon" size={20} />
              </button>
            </div>
            <p className="text-sm text-[hsl(215,15%,50%)] mb-4">
              Select an agent to assign to <span className="font-semibold text-[hsl(215,25%,20%)]">{selectedRows.size}</span> selected {selectedRows.size === 1 ? 'property' : 'properties'}.
            </p>
            {agents.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-[hsl(215,15%,55%)] text-sm">
                <Icon name="ArrowPathIcon" size={16} className="animate-spin mr-2" />
                Loading agents…
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto mb-5">
                {agents.map((agent) => (
                  <label
                    key={agent.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedAgentId === agent.id
                        ? 'border-[#1B4F8A] bg-blue-50'
                        : 'border-[hsl(214,20%,88%)] hover:border-[#1B4F8A]/50 hover:bg-[hsl(210,15%,98%)]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="agent"
                      value={agent.id}
                      checked={selectedAgentId === agent.id}
                      onChange={() => setSelectedAgentId(agent.id)}
                      className="accent-[#1B4F8A]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[hsl(215,25%,20%)] truncate">{agent.full_name || agent.email}</div>
                      <div className="text-xs text-[hsl(215,15%,55%)] truncate">{agent.email} · <span className="capitalize">{agent.role}</span></div>
                    </div>
                  </label>
                ))}
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setAssignAgentOpen(false)}
                className="btn-secondary py-2 px-4 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAssign}
                disabled={!selectedAgentId || assigningAgent}
                className="btn-primary py-2 px-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assigningAgent ? 'Assigning…' : 'Assign Agent'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Edit Modal */}
      {batchEditOpen && (
        <BatchEditModal
          selectedIds={selectedRows}
          properties={allProperties}
          onClose={() => setBatchEditOpen(false)}
          onSuccess={() => {
            setBatchEditOpen(false);
            setSelectedRows(new Set());
            fetchProperties();
          }}
        />
      )}

      {/* Add Property Modal */}
      {addPropertyOpen && (
        <AddPropertyModal
          onClose={() => setAddPropertyOpen(false)}
          onSuccess={() => {
            setAddPropertyOpen(false);
            fetchProperties();
          }}
        />
      )}
    </div>
  );
}