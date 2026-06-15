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

// ─── Property types (for Properties tab) ─────────────────────────────────────

interface DbProperty {
  id: string;
  property_ref?: string;
  unit?: string;
  building_name?: string;
  village?: string;
  short_code?: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  saleable_area?: number | null;
  gross_area?: number | null;
  floor_type?: string;
  prop_types?: string;
  direction_id?: string;
  view_id?: string;
  decor_id?: string;
  asking_rent?: number | null;
  asking_price?: number | null;
  status?: string;
  occupancy?: string;
  contact_status?: string;
  landlord_name?: string;
  landlord_phone?: string;
  landlord_email?: string;
  phase?: number | string;
  notes?: string;
  updated_at?: string;
  list_type?: string;
    [key: string]: unknown;
}

const villages = [
  'Amalfi', 'Bijou Hamlet', 'Capeland Drive', 'Caperidge Drive', 'Capevale Drive',
  'Chianti', 'Coastline Villa', 'Crestmont Villa', 'Db Plaza', 'Greenvale Village',
  'Headland Drive', 'Hillgrove Village', 'IL Picco', 'La Costa', 'La Serene',
  'La Vista', 'Middle Lane', 'Midvale Village', 'Neo Horizon', 'Parkland Drive',
  'Parkridge Drive', 'Parkridge Village', 'Parkvale Drive', 'Parkvale Village',
  'Poggibonsi', 'Positano', 'Seabee Lane', 'Seabird Lane', 'Seahorse Lane',
  'Siena One', 'Siena Two', 'Twilight Court',
];

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
  const cleanText = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleanText.split('\n');

  let headerLineIdx = 0;
  while (headerLineIdx < lines.length && !lines[headerLineIdx].trim()) headerLineIdx++;
  if (headerLineIdx >= lines.length - 1) return [];

  const headerLine = lines[headerLineIdx];
  const delimiter = detectDelimiter(headerLine);

  const rawHeaders = splitLine(headerLine, delimiter);
  const headers = rawHeaders.map((h) =>
    h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  );

  const numberedIndices = new Set<number>();
  headers.forEach((h) => {
    const m = h.match(/^contact_(?:person|number|email|role|name)_?(\d+)$/);
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
      let addedAny = false;
      for (const idx of sortedNumberedIndices) {
        const contactPerson =
          row[`contact_person${idx}`] ||
          row[`contact_person_${idx}`] ||
          row[`contact_name${idx}`] ||
          row[`contact_name_${idx}`] ||
          row[`name${idx}`] ||
          row[`name_${idx}`] ||
          '';
        if (!contactPerson) continue;

        rows.push({
          short_code: shortCode,
          property_ref: propertyRef,
          contact_person: contactPerson,
          contact_number: row[`contact_number${idx}`] || row[`contact_number_${idx}`] || row[`phone${idx}`] || row[`phone_${idx}`] || row[`mobile${idx}`] || row[`mobile_${idx}`] || '',
          contact_email: row[`contact_email${idx}`] || row[`contact_email_${idx}`] || row[`email${idx}`] || row[`email_${idx}`] || '',
          contact_role: row[`contact_role${idx}`] || row[`contact_role_${idx}`] || row[`role${idx}`] || row[`role_${idx}`] || 'owner',
          notes: row[`notes${idx}`] || row[`notes_${idx}`] || notes || '',
        });
        addedAny = true;
      }

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

      if (!addedAny) continue;
    } else {
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

// ─── Properties Tab Component ─────────────────────────────────────────────────

function PropertiesTab() {
  const supabase = createClient();
  const [properties, setProperties] = useState<DbProperty[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state (mirrors Properties page)
  const [search, setSearch] = useState('');
  const [villageFilter, setVillageFilter] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('');
  const [availability, setAvailability] = useState('');
  const [directionFilter, setDirectionFilter] = useState('');
  const [bedsFilter, setBedsFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [activeStatus, setActiveStatus] = useState('');
  const [viewsFilter, setViewsFilter] = useState('');
  const [bathroomsFilter, setBathroomsFilter] = useState('');
  const [rentType, setRentType] = useState('');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState('');
  const [decorationsFilter, setDecorationsFilter] = useState('');
  const [sPriceMin, setSPriceMin] = useState('');
  const [sPriceMax, setSPriceMax] = useState('');
  const [lPriceMin, setLPriceMin] = useState('');
  const [lPriceMax, setLPriceMax] = useState('');
  const [gSizeMin, setGSizeMin] = useState('');
  const [gSizeMax, setGSizeMax] = useState('');
  const [sSizeMin, setSSizeMin] = useState('');
  const [sSizeMax, setSSizeMax] = useState('');
  const [floorFrom, setFloorFrom] = useState('');
  const [floorTo, setFloorTo] = useState('');
  const [highlightFilter, setHighlightFilter] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const [page, setPage] = useState(1);
  const perPage = 25;

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    try {
      let allRows: DbProperty[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('properties')
          .select('id, property_ref, unit, building_name, village, short_code, bedrooms, bathrooms, saleable_area, gross_area, floor_type, prop_types, direction_id, view_id, decor_id, asking_rent, asking_price, status, occupancy, contact_status, landlord_name, landlord_phone, landlord_email, phase, notes, updated_at, list_type')
          .range(from, from + pageSize - 1)
          .order('property_ref', { ascending: true });
        if (error) throw error;
        if (!data || data.length === 0) break;
        allRows = allRows.concat(data as DbProperty[]);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      setProperties(allRows);
    } catch (err) {
      console.error('PropertiesTab fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  const filtered = useMemo(() => {
    let data = [...properties];

    if (search) {
      const q = search.toLowerCase();
      data = data.filter((p) =>
        (p.short_code ?? '').toLowerCase().includes(q) ||
        (p.property_ref ?? '').toLowerCase().includes(q) ||
        (p.unit ?? '').toLowerCase().includes(q) ||
        (p.building_name ?? '').toLowerCase().includes(q) ||
        (p.village ?? '').toLowerCase().includes(q) ||
        (p.landlord_name ?? '').toLowerCase().includes(q)
      );
    }
    if (villageFilter) data = data.filter((p) => (p.village ?? '').toLowerCase() === villageFilter.toLowerCase());
    if (phaseFilter) data = data.filter((p) => String(p.phase ?? '') === phaseFilter);
    if (availability) data = data.filter((p) => (p.occupancy ?? '') === availability);
    if (activeStatus) data = data.filter((p) => (p.status ?? '') === activeStatus);
    if (directionFilter) data = data.filter((p) => (p.direction_id ?? '').toLowerCase() === directionFilter.toLowerCase());
    if (bedsFilter) data = data.filter((p) => String(p.bedrooms ?? '') === bedsFilter);
    if (bathroomsFilter) data = data.filter((p) => String(p.bathrooms ?? '') === bathroomsFilter);
    if (unitFilter) data = data.filter((p) => (p.unit ?? '').toLowerCase().includes(unitFilter.toLowerCase()));
    if (viewsFilter) data = data.filter((p) => (p.view_id ?? '').toLowerCase().includes(viewsFilter.toLowerCase()));
    if (propertyTypeFilter) data = data.filter((p) => (p.prop_types ?? '').toLowerCase().includes(propertyTypeFilter.toLowerCase()));
    if (decorationsFilter) data = data.filter((p) => (p.decor_id ?? '').toLowerCase().includes(decorationsFilter.toLowerCase()));
    if (rentType) {
      if (rentType === 'Unknown') {
        data = data.filter((p) => !p.list_type || p.list_type === '' || (p.list_type as string).toLowerCase() === 'unknown');
      } else {
        data = data.filter((p) => (p.list_type as string ?? '').toLowerCase() === rentType.toLowerCase());
      }
    }
    if (sPriceMin) data = data.filter((p) => (p.asking_price ?? 0) >= Number(sPriceMin));
    if (sPriceMax) data = data.filter((p) => (p.asking_price ?? 0) <= Number(sPriceMax));
    if (lPriceMin) data = data.filter((p) => (p.asking_rent ?? 0) >= Number(lPriceMin));
    if (lPriceMax) data = data.filter((p) => (p.asking_rent ?? 0) <= Number(lPriceMax));
    if (gSizeMin) data = data.filter((p) => (p.gross_area ?? 0) >= Number(gSizeMin));
    if (gSizeMax) data = data.filter((p) => (p.gross_area ?? 0) <= Number(gSizeMax));
    if (sSizeMin) data = data.filter((p) => (p.saleable_area ?? 0) >= Number(sSizeMin));
    if (sSizeMax) data = data.filter((p) => (p.saleable_area ?? 0) <= Number(sSizeMax));
    if (floorFrom || floorTo) {
      data = data.filter((p) => {
        const sc = p.short_code ?? '';
        const flat = sc.length >= 3 ? sc.slice(-3).replace(/^0+/, '') || sc.slice(-3) : '';
        const floorMatch = flat.match(/^(\d+)/);
        const floorNum = floorMatch ? parseInt(floorMatch[1], 10) : NaN;
        if (isNaN(floorNum)) return true;
        if (floorFrom && floorNum < Number(floorFrom)) return false;
        if (floorTo && floorNum > Number(floorTo)) return false;
        return true;
      });
    }
    if (highlightFilter) data = data.filter((p) => (p.highlight as string ?? '').toLowerCase().includes(highlightFilter.toLowerCase()));
    if (contactPerson) {
      const cq = contactPerson.toLowerCase();
      data = data.filter((p) => (p.landlord_name ?? '').toLowerCase().includes(cq));
    }
    if (phoneNumber) {
      const pq = phoneNumber.toLowerCase();
      data = data.filter((p) => (p.landlord_phone ?? '').toLowerCase().includes(pq));
    }

    return data;
  }, [properties, search, villageFilter, phaseFilter, availability, activeStatus, directionFilter, bedsFilter, bathroomsFilter, unitFilter, viewsFilter, propertyTypeFilter, decorationsFilter, rentType, sPriceMin, sPriceMax, lPriceMin, lPriceMax, gSizeMin, gSizeMax, sSizeMin, sSizeMax, floorFrom, floorTo, highlightFilter, contactPerson, phoneNumber]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const hasActiveFilters = search || villageFilter || phaseFilter || availability || activeStatus || directionFilter || bedsFilter || bathroomsFilter || unitFilter || viewsFilter || propertyTypeFilter || decorationsFilter || rentType || sPriceMin || sPriceMax || lPriceMin || lPriceMax || gSizeMin || gSizeMax || sSizeMin || sSizeMax || floorFrom || floorTo || highlightFilter || contactPerson || phoneNumber;

  function resetFilters() {
    setSearch(''); setVillageFilter(''); setPhaseFilter(''); setAvailability('');
    setActiveStatus(''); setDirectionFilter(''); setBedsFilter(''); setBathroomsFilter('');
    setUnitFilter(''); setViewsFilter(''); setPropertyTypeFilter(''); setDecorationsFilter('');
    setRentType(''); setSPriceMin(''); setSPriceMax(''); setLPriceMin(''); setLPriceMax('');
    setGSizeMin(''); setGSizeMax(''); setSSizeMin(''); setSSizeMax('');
    setFloorFrom(''); setFloorTo(''); setHighlightFilter(''); setContactPerson(''); setPhoneNumber('');
    setPage(1);
  }

  const selectCls = "w-full text-xs text-[hsl(215,25%,30%)] bg-transparent outline-none appearance-none cursor-pointer";
  const inputCls = "flex-1 text-xs text-[hsl(215,25%,30%)] placeholder-[hsl(215,15%,65%)] bg-transparent outline-none";
  const chevron = <Icon name="ChevronUpDownIcon" size={12} className="text-[hsl(215,15%,60%)] flex-shrink-0 -ml-1 pointer-events-none" />;

  function statusLabel(s?: string) {
    const map: Record<string, string> = {
      'for-rent': 'For Rent', 'leased': 'Leased', 'self-occupy': 'Self Occupy',
      'for-sale': 'For Sale', 'for-sale-and-rent': 'For Sale & Rent',
    };
    return map[s ?? ''] ?? s ?? '—';
  }

  function occupancyLabel(o?: string) {
    const map: Record<string, string> = {
      'vacant': 'Vacant', 'vacant-soon': 'Vacant Soon', 'leased': 'Leased', 'with-ta': 'With TA',
    };
    return map[o ?? ''] ?? o ?? '—';
  }

  function occupancyColor(o?: string) {
    if (o === 'vacant') return 'bg-emerald-100 text-emerald-700';
    if (o === 'vacant-soon') return 'bg-amber-100 text-amber-700';
    if (o === 'leased') return 'bg-blue-100 text-blue-700';
    if (o === 'with-ta') return 'bg-purple-100 text-purple-700';
    return 'bg-gray-100 text-gray-500';
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Advanced Search Panel ── */}
      <div className="rounded-xl overflow-hidden border border-[hsl(36,25%,84%)] shadow-sm mx-4 mt-4 mb-3">
        {/* Header bar */}
        <div className="flex items-center justify-between bg-[#8B1A2B] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Icon name="MagnifyingGlassIcon" size={14} className="text-white/80" />
            <span className="text-sm font-semibold text-white">Search</span>
            <span className="text-sm text-white/70">Properties</span>
            {hasActiveFilters && (
              <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-semibold">Filtered</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/70">{filtered.length.toLocaleString()} results</span>
            <button
              onClick={resetFilters}
              className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors border border-white/20"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Filter rows */}
        <div className="bg-white divide-y divide-[hsl(36,25%,88%)]">
          {/* Row 1 */}
          <div className="grid grid-cols-9 divide-x divide-[hsl(36,25%,88%)]">
            <div className="flex items-center gap-1.5 px-3 py-2">
              <input type="text" placeholder="Keyword" value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className={inputCls} />
            </div>
            <div className="flex items-stretch gap-1 px-3 py-2 col-span-3">
              <input type="number" placeholder="Sale Price Min" value={sPriceMin}
                onChange={(e) => { setSPriceMin(e.target.value); setPage(1); }}
                className="min-w-0 flex-1 text-xs text-[hsl(215,25%,30%)] placeholder-[hsl(215,15%,65%)] bg-transparent outline-none self-center" />
              <span className="flex items-center self-center flex-shrink-0"><Icon name="ArrowsRightLeftIcon" size={12} className="text-[hsl(215,15%,60%)] block" /></span>
              <input type="number" placeholder="Sale Price Max" value={sPriceMax}
                onChange={(e) => { setSPriceMax(e.target.value); setPage(1); }}
                className="min-w-0 flex-1 text-xs text-right text-[hsl(215,25%,30%)] placeholder-[hsl(215,15%,65%)] bg-transparent outline-none self-center" />
            </div>
            <div className="flex items-center px-3 py-2">
              <select value={availability} onChange={(e) => { setAvailability(e.target.value); setPage(1); }} className={selectCls}>
                <option value="">Availability ...</option>
                <option value="vacant">Vacant</option>
                <option value="vacant-soon">Vacant Soon</option>
                <option value="leased">Leased</option>
                <option value="with-ta">With TA</option>
              </select>{chevron}
            </div>
            <div className="flex items-center px-3 py-2">
              <select value={directionFilter} onChange={(e) => { setDirectionFilter(e.target.value); setPage(1); }} className={selectCls}>
                <option value="">Directions ...</option>
                <option value="North">North</option>
                <option value="North East">North East</option>
                <option value="East">East</option>
                <option value="South East">South East</option>
                <option value="South">South</option>
                <option value="South West">South West</option>
                <option value="West">West</option>
                <option value="North West">North West</option>
              </select>{chevron}
            </div>
            <div className="flex items-center px-3 py-2">
              <select value={bedsFilter} onChange={(e) => { setBedsFilter(e.target.value); setPage(1); }} className={selectCls}>
                <option value="">Beds ...</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5+</option>
              </select>{chevron}
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2">
              <input type="text" placeholder="Unit" value={unitFilter}
                onChange={(e) => { setUnitFilter(e.target.value); setPage(1); }}
                className={inputCls} />
              <Icon name="Squares2X2Icon" size={13} className="text-[hsl(215,15%,60%)] flex-shrink-0" />
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-9 divide-x divide-[hsl(36,25%,88%)]">
            <div className="flex items-center px-3 py-2">
              <select value={activeStatus} onChange={(e) => { setActiveStatus(e.target.value); setPage(1); }} className={selectCls}>
                <option value="">Status ...</option>
                <option value="for-rent">For Rent</option>
                <option value="leased">Leased</option>
                <option value="self-occupy">Self Occupy</option>
                <option value="for-sale">For Sale</option>
              </select>{chevron}
            </div>
            <div className="flex items-stretch gap-1 px-3 py-2 col-span-3">
              <input type="number" placeholder="Lease Price Min" value={lPriceMin}
                onChange={(e) => { setLPriceMin(e.target.value); setPage(1); }}
                className="min-w-0 flex-1 text-xs text-[hsl(215,25%,30%)] placeholder-[hsl(215,15%,65%)] bg-transparent outline-none self-center" />
              <span className="flex items-center self-center flex-shrink-0"><Icon name="ArrowsRightLeftIcon" size={12} className="text-[hsl(215,15%,60%)] block" /></span>
              <input type="number" placeholder="Lease Price Max" value={lPriceMax}
                onChange={(e) => { setLPriceMax(e.target.value); setPage(1); }}
                className="min-w-0 flex-1 text-xs text-right text-[hsl(215,25%,30%)] placeholder-[hsl(215,15%,65%)] bg-transparent outline-none self-center" />
            </div>
            <div className="flex items-center px-3 py-2">
              <select value={viewsFilter} onChange={(e) => { setViewsFilter(e.target.value); setPage(1); }} className={selectCls}>
                <option value="">Views ...</option>
                <option value="Sea View">Sea View</option>
                <option value="Mountain View">Mountain View</option>
                <option value="City View">City View</option>
                <option value="Green View">Green View</option>
                <option value="Pool View">Pool View</option>
                <option value="Garden View">Garden View</option>
                <option value="Street View">Street View</option>
                <option value="Open View">Open View</option>
              </select>{chevron}
            </div>
            <div className="flex items-center px-3 py-2">
              <select value={bathroomsFilter} onChange={(e) => { setBathroomsFilter(e.target.value); setPage(1); }} className={selectCls}>
                <option value="">Bathrooms ...</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4+</option>
              </select>{chevron}
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 col-span-2">
              <input type="text" placeholder="Contact Person" value={contactPerson}
                onChange={(e) => { setContactPerson(e.target.value); setPage(1); }}
                className={inputCls} />
              <Icon name="UserIcon" size={13} className="text-[hsl(215,15%,60%)] flex-shrink-0" />
            </div>
          </div>

          {/* Row 3 */}
          <div className="grid grid-cols-9 divide-x divide-[hsl(36,25%,88%)]">
            <div className="flex items-center px-3 py-2">
              <select value={rentType} onChange={(e) => { setRentType(e.target.value); setPage(1); }} className={selectCls}>
                <option value="">Listing Type ...</option>
                <option value="Sale">Sale</option>
                <option value="Rent">Rent</option>
                <option value="Rent & Sale">Rent &amp; Sale</option>
                <option value="Unknown">Unknown</option>
              </select>{chevron}
            </div>
            <div className="flex items-stretch gap-1 px-3 py-2 col-span-3">
              <input type="number" placeholder="Gross Size Min" value={gSizeMin}
                onChange={(e) => { setGSizeMin(e.target.value); setPage(1); }}
                className="min-w-0 flex-1 text-xs text-[hsl(215,25%,30%)] placeholder-[hsl(215,15%,65%)] bg-transparent outline-none self-center" />
              <span className="flex items-center self-center flex-shrink-0"><Icon name="ArrowsRightLeftIcon" size={12} className="text-[hsl(215,15%,60%)] block" /></span>
              <input type="number" placeholder="Gross Size Max" value={gSizeMax}
                onChange={(e) => { setGSizeMax(e.target.value); setPage(1); }}
                className="min-w-0 flex-1 text-xs text-right text-[hsl(215,25%,30%)] placeholder-[hsl(215,15%,65%)] bg-transparent outline-none self-center" />
            </div>
            <div className="flex items-center px-3 py-2">
              <select value={propertyTypeFilter} onChange={(e) => { setPropertyTypeFilter(e.target.value); setPage(1); }} className={selectCls}>
                <option value="">Property Type ...</option>
                <option value="High Rise">High Rise</option>
                <option value="Low Rise">Low Rise</option>
                <option value="House">House</option>
              </select>{chevron}
            </div>
            <div className="flex items-center px-3 py-2">
              <select value={decorationsFilter} onChange={(e) => { setDecorationsFilter(e.target.value); setPage(1); }} className={selectCls}>
                <option value="">Decorations ...</option>
                <option value="Deluxe">Deluxe</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Original">Original</option>
              </select>{chevron}
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 col-span-2">
              <input type="text" placeholder="Phone Number" value={phoneNumber}
                onChange={(e) => { setPhoneNumber(e.target.value); setPage(1); }}
                className={inputCls} />
              <Icon name="PhoneIcon" size={13} className="text-[hsl(215,15%,60%)] flex-shrink-0" />
            </div>
          </div>

          {/* Row 4 */}
          <div className="grid grid-cols-7 divide-x divide-[hsl(36,25%,88%)]">
            <div className="flex items-center px-3 py-2">
              <select value={villageFilter} onChange={(e) => { setVillageFilter(e.target.value); setPage(1); }} className={selectCls}>
                <option value="">Villages ...</option>
                {villages.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>{chevron}
            </div>
            <div className="flex items-stretch gap-1 px-3 py-2 col-span-2">
              <input type="number" placeholder="Sale Size Min" value={sSizeMin}
                onChange={(e) => { setSSizeMin(e.target.value); setPage(1); }}
                className="min-w-0 flex-1 text-xs text-[hsl(215,25%,30%)] placeholder-[hsl(215,15%,65%)] bg-transparent outline-none self-center" />
              <span className="flex items-center self-center flex-shrink-0"><Icon name="ArrowsRightLeftIcon" size={12} className="text-[hsl(215,15%,60%)] block" /></span>
              <input type="number" placeholder="Sale Size Max" value={sSizeMax}
                onChange={(e) => { setSSizeMax(e.target.value); setPage(1); }}
                className="min-w-0 flex-1 text-xs text-right text-[hsl(215,25%,30%)] placeholder-[hsl(215,15%,65%)] bg-transparent outline-none self-center" />
            </div>
            <div className="flex items-stretch gap-1 px-3 py-2 col-span-2">
              <input type="number" placeholder="Floor From" value={floorFrom}
                onChange={(e) => { setFloorFrom(e.target.value); setPage(1); }}
                className="min-w-0 flex-1 text-xs text-[hsl(215,25%,30%)] placeholder-[hsl(215,15%,65%)] bg-transparent outline-none self-center" />
              <span className="flex items-center self-center flex-shrink-0"><Icon name="ArrowsRightLeftIcon" size={12} className="text-[hsl(215,15%,60%)] block" /></span>
              <input type="number" placeholder="Floor To" value={floorTo}
                onChange={(e) => { setFloorTo(e.target.value); setPage(1); }}
                className="min-w-0 flex-1 text-xs text-right text-[hsl(215,25%,30%)] placeholder-[hsl(215,15%,65%)] bg-transparent outline-none self-center" />
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 col-span-2">
              <input type="text" placeholder="Highlight" value={highlightFilter}
                onChange={(e) => { setHighlightFilter(e.target.value); setPage(1); }}
                className={inputCls} />
              <Icon name="FolderOpenIcon" size={13} className="text-[hsl(215,15%,60%)] flex-shrink-0" />
            </div>
          </div>

          {/* Row 5: Phase */}
          <div className="grid grid-cols-5 divide-x divide-[hsl(36,25%,88%)]">
            <div className="flex items-center px-3 py-2">
              <select value={phaseFilter} onChange={(e) => { setPhaseFilter(e.target.value); setPage(1); }} className={selectCls}>
                <option value="">Phase ...</option>
                {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16].map((n) => (
                  <option key={n} value={String(n)}>Phase {n}</option>
                ))}
              </select>{chevron}
            </div>
            <div className="col-span-4" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto mx-4 mb-4">
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-xs">
              <thead>
                <tr className="border-b border-[hsl(214,20%,88%)] bg-[hsl(210,20%,97%)]">
                  {['Short Code', 'PID', 'Unit / Building', 'Village', 'Status', 'Occupancy', 'Beds', 'Baths', 'Saleable', 'Gross', 'Asking Rent', 'Sale Price', 'Owner', 'Phone', 'Direction', 'View'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold text-[hsl(215,15%,52%)] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={16} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-[#8B1A2B]/20 border-t-[#8B1A2B] rounded-full animate-spin" />
                        <p className="text-sm text-[hsl(215,15%,52%)]">Loading properties…</p>
                      </div>
                    </td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Icon name="BuildingOffice2Icon" size={28} className="text-[hsl(215,15%,62%)]" />
                        <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">No properties found</p>
                        <p className="text-xs text-[hsl(215,15%,52%)]">Try adjusting your search or filter criteria</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginated.map((p, idx) => (
                    <tr key={p.id} className={`border-b border-[hsl(214,20%,92%)] hover:bg-[hsl(210,15%,97%)] transition-colors ${idx % 2 !== 0 ? 'bg-[hsl(210,20%,98.5%)]' : ''}`}>
                      <td className="px-3 py-2 font-mono font-semibold text-[hsl(215,25%,18%)] whitespace-nowrap">{p.short_code ?? '—'}</td>
                      <td className="px-3 py-2 text-[hsl(215,15%,42%)] whitespace-nowrap">{p.property_ref ?? '—'}</td>
                      <td className="px-3 py-2 text-[hsl(215,25%,28%)] whitespace-nowrap">{[p.unit, p.building_name].filter(Boolean).join(' ') || '—'}</td>
                      <td className="px-3 py-2 text-[hsl(215,15%,42%)] whitespace-nowrap">{p.village ?? '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[hsl(210,15%,92%)] text-[hsl(215,25%,28%)]">
                          {statusLabel(p.status as string)}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${occupancyColor(p.occupancy as string)}`}>
                          {occupancyLabel(p.occupancy as string)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center text-[hsl(215,25%,28%)]">{p.bedrooms ?? '—'}</td>
                      <td className="px-3 py-2 text-center text-[hsl(215,25%,28%)]">{p.bathrooms ?? '—'}</td>
                      <td className="px-3 py-2 text-right text-[hsl(215,15%,42%)] whitespace-nowrap">{p.saleable_area ? `${p.saleable_area} ft²` : '—'}</td>
                      <td className="px-3 py-2 text-right text-[hsl(215,15%,42%)] whitespace-nowrap">{p.gross_area ? `${p.gross_area} ft²` : '—'}</td>
                      <td className="px-3 py-2 text-right text-[hsl(215,25%,28%)] whitespace-nowrap font-medium">{p.asking_rent ? `HK$${Number(p.asking_rent).toLocaleString()}` : '—'}</td>
                      <td className="px-3 py-2 text-right text-[hsl(215,25%,28%)] whitespace-nowrap font-medium">{p.asking_price ? `HK$${Number(p.asking_price).toLocaleString()}` : '—'}</td>
                      <td className="px-3 py-2 text-[hsl(215,15%,42%)] whitespace-nowrap">{p.landlord_name ?? '—'}</td>
                      <td className="px-3 py-2 text-[hsl(215,15%,42%)] whitespace-nowrap">{p.landlord_phone ?? '—'}</td>
                      <td className="px-3 py-2 text-[hsl(215,15%,42%)] whitespace-nowrap">{p.direction_id ?? '—'}</td>
                      <td className="px-3 py-2 text-[hsl(215,15%,42%)] whitespace-nowrap">{p.view_id ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-3 px-1">
            <p className="text-xs text-[hsl(215,15%,52%)]">
              Showing {((page - 1) * perPage) + 1}–{Math.min(page * perPage, filtered.length)} of {filtered.length.toLocaleString()} properties
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-1 text-xs rounded border border-[hsl(214,20%,88%)] disabled:opacity-40 hover:bg-[hsl(210,15%,96%)] transition-colors"
              >
                ‹ Prev
              </button>
              <span className="px-2 py-1 text-xs text-[hsl(215,15%,42%)]">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2 py-1 text-xs rounded border border-[hsl(214,20%,88%)] disabled:opacity-40 hover:bg-[hsl(210,15%,96%)] transition-colors"
              >
                Next ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ContactsClient() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<'contacts' | 'properties'>('contacts');

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
      let allContacts: PropertyContact[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('property_contacts')
          .select('*')
          .order('short_code', { ascending: true })
          .order('contact_person', { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) {
          console.error('Error fetching contacts:', error.message);
          break;
        }
        if (!data || data.length === 0) break;
        allContacts = allContacts.concat(data as PropertyContact[]);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      setContacts(allContacts);
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
    const BATCH_SIZE = 500;

    for (let i = 0; i < csvPreview.length; i += BATCH_SIZE) {
      const batch = csvPreview.slice(i, i + BATCH_SIZE).map((row) => ({
        short_code: row.short_code,
        property_ref: row.property_ref || null,
        contact_person: row.contact_person,
        contact_number: row.contact_number || '',
        contact_email: row.contact_email || '',
        contact_role: row.contact_role || 'owner',
        notes: row.notes || null,
      }));

      try {
        const { error, data } = await supabase
          .from('property_contacts')
          .insert(batch)
          .select('id');

        if (error) {
          result.errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1} (rows ${i + 1}–${i + batch.length}): ${error.message}`);
          result.skipped += batch.length;
        } else {
          result.inserted += data?.length ?? batch.length;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1} (rows ${i + 1}–${i + batch.length}): ${msg}`);
        result.skipped += batch.length;
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

  const handleClearAllContacts = async () => {
    if (!window.confirm('This will permanently delete ALL imported contacts from the database. Are you sure you want to continue?')) return;
    try {
      const { error } = await supabase
        .from('property_contacts')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) {
        alert(`Failed to clear contacts: ${error.message}`);
        return;
      }
      setContacts([]);
      setSelectedShortCode(null);
      setImportResult(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      alert(`Failed to clear contacts: ${msg}`);
    }
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
    <div className="flex flex-col h-full min-h-0 bg-[hsl(210,20%,97%)]">
      {/* ── Tab Bar ── */}
      <div className="flex-shrink-0 bg-white border-b border-[hsl(214,20%,88%)] px-4 pt-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('contacts')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
              activeTab === 'contacts' ?'border-[#8B1A2B] text-[#8B1A2B] bg-[#8B1A2B]/5' :'border-transparent text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)] hover:bg-[hsl(210,15%,96%)]'
            }`}
          >
            <Icon name="UsersIcon" size={15} />
            Contacts
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${activeTab === 'contacts' ? 'bg-[#8B1A2B]/10 text-[#8B1A2B]' : 'bg-[hsl(210,15%,92%)] text-[hsl(215,15%,42%)]'}`}>
              {contacts.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('properties')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
              activeTab === 'properties' ?'border-[#8B1A2B] text-[#8B1A2B] bg-[#8B1A2B]/5' :'border-transparent text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)] hover:bg-[hsl(210,15%,96%)]'
            }`}
          >
            <Icon name="BuildingOffice2Icon" size={15} />
            Properties
          </button>
        </div>
      </div>

      {/* ── Properties Tab ── */}
      {activeTab === 'properties' && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <PropertiesTab />
        </div>
      )}

      {/* ── Contacts Tab ── */}
      {activeTab === 'contacts' && (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left Panel — Property List */}
          <div className="w-72 flex-shrink-0 bg-white border-r border-[hsl(214,20%,88%)] flex flex-col">
            {/* Header */}
            <div className="px-4 py-4 border-b border-[hsl(214,20%,88%)]">
              <div className="flex items-center justify-between mb-3">
                <h1 className="text-base font-bold text-[hsl(215,25%,18%)]">Contacts</h1>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleClearAllContacts}
                    title="Delete all imported contacts"
                    className="flex items-center gap-1 px-2 py-1.5 bg-red-50 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-100 border border-red-200 transition-colors"
                  >
                    <Icon name="TrashIcon" size={13} />
                    Clear All
                  </button>
                  <button
                    onClick={() => { setShowImportPanel(!showImportPanel); setSelectedShortCode(null); }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#8B1A2B] text-white text-xs font-semibold rounded-lg hover:bg-[#7a1626] transition-colors"
                  >
                    <Icon name="CloudArrowUpIcon" size={14} />
                    Import CSV
                  </button>
                </div>
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
                        <button
                          onClick={handleClearAllContacts}
                          className="px-3 py-2 text-sm text-[hsl(215,15%,42%)] hover:text-[hsl(215,25%,18%)] transition-colors"
                        >
                          Clear All Contacts
                        </button>
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
                                          ? getRoleColor(role) + 'ring-1 ring-offset-1 ring-current' : 'bg-white border-[hsl(214,20%,82%)] text-[hsl(215,15%,42%)] hover:border-[hsl(214,20%,62%)]'
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
      )}
    </div>
  );
}
