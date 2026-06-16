'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Client {
  id: string;
  full_name: string;
  mobile: string | null;
  budget_min: number | null;
  budget_max: number | null;
  preferred_areas: string[] | null;
  preferred_bedrooms: number[] | null;
  notes: string | null;
}

interface Property {
  id: string;
  property_ref: string;
  village: string;
  phase: string | null;
  block: string | null;
  floor: string | null;
  unit: string | null;
  address: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  saleable_area: number | null;
  asking_price: number | null;
  asking_rent: number | null;
  status: string;
  occupancy: string;
}

interface Match {
  id: string;
  client_id: string;
  property_id: string;
  notes: string | null;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HK_DISTRICTS = [
  'Headland',
  'Seabee Lane',
  'Beach',
  'Parkvale',
  'Parkland',
  'Coastline',
  'Upper Caperidge',
  'Lower Caperidge',
  'Crestmont',
  'Greenvale',
  'Neo Horizon',
  'Woods',
  'Middle Lane',
  'Midvale',
  'Cor & Cry',
  'Hillgrove',
  'Parkridge',
  'Siena 1 Lowrise',
  'Siena 1 Highrise',
  'Siena 2 Lowrise',
  'Siena 2 Highrise',
  'Chianti',
  'Poggibonsi',
  'Positano',
  'Amalfi',
  'DB Plaza',
  'Peninsula',
];

const PROPERTY_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'for-rent', label: 'For Rent' },
  { value: 'for-sale', label: 'For Sale' },
  { value: 'for-sale-and-rent', label: 'For Sale & Rent' },
];

const BEDROOM_OPTIONS = [1, 2, 3, 4, 5];

function formatBudget(min: number | null, max: number | null): string {
  if (!min && !max) return '—';
  const fmt = (n: number) =>
    n >= 1_000_000 ? `HK$${(n / 1_000_000).toFixed(1)}M` : `HK$${(n / 1_000).toFixed(0)}K`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (max) return `Up to ${fmt(max)}`;
  return `From ${fmt(min!)}`;
}

function formatPrice(val: number | null): string {
  if (!val) return '—';
  if (val >= 1_000_000) return `HK$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `HK$${(val / 1_000).toFixed(0)}K`;
  return `HK$${val}`;
}

function statusColor(status: string): string {
  switch (status) {
    case 'for-rent': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'for-sale': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'for-sale-and-rent': return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'leased': return 'bg-amber-50 text-amber-700 border-amber-200';
    default: return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'for-rent': return 'For Rent';
    case 'for-sale': return 'For Sale';
    case 'for-sale-and-rent': return 'For Sale & Rent';
    case 'leased': return 'Leased';
    case 'self-occupy': return 'Self Occupy';
    default: return status;
  }
}

// ─── Match Score ──────────────────────────────────────────────────────────────

function computeMatchScore(client: Client, property: Property): number {
  let score = 0;

  // Budget match (40 pts)
  const price = property.asking_rent ?? property.asking_price ?? 0;
  if (price > 0 && (client.budget_min || client.budget_max)) {
    const min = client.budget_min ?? 0;
    const max = client.budget_max ?? Infinity;
    if (price >= min && price <= max) score += 40;
    else if (price <= max * 1.1) score += 20; // within 10% over budget
  }

  // District match (35 pts)
  if (client.preferred_areas && client.preferred_areas.length > 0) {
    const propArea = property.village ?? '';
    if (client.preferred_areas.some((a) => propArea.toLowerCase().includes(a.toLowerCase()) || a.toLowerCase().includes(propArea.toLowerCase()))) {
      score += 35;
    }
  }

  // Bedroom match (25 pts)
  if (client.preferred_bedrooms && client.preferred_bedrooms.length > 0 && property.bedrooms != null) {
    if (client.preferred_bedrooms.includes(property.bedrooms)) score += 25;
  }

  return score;
}

// ─── Property Card ────────────────────────────────────────────────────────────

interface PropertyCardProps {
  property: Property;
  isAssigned: boolean;
  matchScore: number;
  onAssign: (propertyId: string) => void;
  onUnassign: (propertyId: string) => void;
  assigning: boolean;
}

function PropertyCard({ property, isAssigned, matchScore, onAssign, onUnassign, assigning }: PropertyCardProps) {
  const price = property.asking_rent ?? property.asking_price;
  const scoreColor =
    matchScore >= 75 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
    matchScore >= 40 ? 'text-amber-600 bg-amber-50 border-amber-200': 'text-gray-500 bg-gray-50 border-gray-200';

  return (
    <div className={`bg-white rounded-xl border transition-all duration-150 ${isAssigned ? 'border-[#1B4F8A] shadow-md shadow-[#1B4F8A]/10' : 'border-[hsl(214,20%,88%)] hover:border-[#1B4F8A]/40 hover:shadow-sm'}`}>
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[hsl(215,25%,18%)] text-sm">{property.property_ref}</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusColor(property.status)}`}>
                {statusLabel(property.status)}
              </span>
            </div>
            <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5 truncate">
              {[property.village, property.phase, property.block && `Block ${property.block}`, property.floor && `Fl.${property.floor}`, property.unit && `Unit ${property.unit}`].filter(Boolean).join(' · ')}
            </p>
          </div>
          {/* Match score badge */}
          <div className={`flex-shrink-0 text-xs font-bold px-2 py-1 rounded-lg border ${scoreColor}`}>
            {matchScore}%
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center bg-[hsl(210,15%,97%)] rounded-lg py-1.5 px-2">
            <p className="text-[10px] text-[hsl(215,15%,52%)] mb-0.5">Beds</p>
            <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">{property.bedrooms ?? '—'}</p>
          </div>
          <div className="text-center bg-[hsl(210,15%,97%)] rounded-lg py-1.5 px-2">
            <p className="text-[10px] text-[hsl(215,15%,52%)] mb-0.5">Area</p>
            <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">{property.saleable_area ? `${property.saleable_area}ft²` : '—'}</p>
          </div>
          <div className="text-center bg-[hsl(210,15%,97%)] rounded-lg py-1.5 px-2">
            <p className="text-[10px] text-[hsl(215,15%,52%)] mb-0.5">Price</p>
            <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">{formatPrice(price)}</p>
          </div>
        </div>

        {/* Assign button */}
        {isAssigned ? (
          <button
            onClick={() => onUnassign(property.id)}
            disabled={assigning}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-[#1B4F8A] text-white text-xs font-semibold hover:bg-[#163f6e] transition-colors disabled:opacity-50"
          >
            <Icon name="CheckIcon" size={13} />
            Assigned — Remove
          </button>
        ) : (
          <button
            onClick={() => onAssign(property.id)}
            disabled={assigning}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-[#1B4F8A]/30 text-[#1B4F8A] text-xs font-semibold hover:bg-[#1B4F8A]/5 transition-colors disabled:opacity-50"
          >
            <Icon name="PlusIcon" size={13} />
            Assign to Client
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PropertyMatchingClient() {
  const supabase = createClient();

  const [clients, setClients] = useState<Client[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingProps, setLoadingProps] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Selected client
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  // Filters (can be pre-filled from client prefs or overridden)
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [districtFilter, setDistrictFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [bedroomFilter, setBedroomFilter] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState<'match' | 'price_asc' | 'price_desc'>('match');

  // ── Fetch clients ──────────────────────────────────────────────────────────

  const fetchClients = useCallback(async () => {
    setLoadingClients(true);
    const { data } = await supabase
      .from('clients')
      .select('id, full_name, mobile, budget_min, budget_max, preferred_areas, preferred_bedrooms, notes')
      .order('full_name', { ascending: true });
    setClients(data ?? []);
    setLoadingClients(false);
  }, [supabase]);

  // ── Fetch properties ───────────────────────────────────────────────────────

  const fetchProperties = useCallback(async () => {
    setLoadingProps(true);
    const { data } = await supabase
      .from('properties')
      .select('id, property_ref, village, phase, block, floor, unit, address, bedrooms, bathrooms, saleable_area, asking_price, asking_rent, status, occupancy, photo_url, year_built, view, direction, additional_features, eng_remark, advertising_remarks')
      .order('property_ref', { ascending: true });
    setProperties(data ?? []);
    setLoadingProps(false);
  }, [supabase]);

  // ── Fetch matches for selected client ─────────────────────────────────────

  const fetchMatches = useCallback(async (clientId: string) => {
    const { data } = await supabase
      .from('client_property_matches')
      .select('id, client_id, property_id, notes, created_at')
      .eq('client_id', clientId);
    setMatches(data ?? []);
  }, [supabase]);

  useEffect(() => {
    fetchClients();
    fetchProperties();
  }, [fetchClients, fetchProperties]);

  useEffect(() => {
    if (selectedClientId) {
      fetchMatches(selectedClientId);
    } else {
      setMatches([]);
    }
  }, [selectedClientId, fetchMatches]);

  // ── Pre-fill filters from client preferences ───────────────────────────────

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) ?? null,
    [clients, selectedClientId]
  );

  const handleSelectClient = (client: Client) => {
    setSelectedClientId(client.id);
    setClientSearch(client.full_name);
    setShowClientDropdown(false);
    // Pre-fill filters from client prefs
    setBudgetMin(client.budget_min ? String(client.budget_min) : '');
    setBudgetMax(client.budget_max ? String(client.budget_max) : '');
    setDistrictFilter(client.preferred_areas ?? []);
    setBedroomFilter(client.preferred_bedrooms ?? []);
    setTypeFilter('all');
    setSortBy('match');
  };

  // ── Toast helper ───────────────────────────────────────────────────────────

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Assign / Unassign ──────────────────────────────────────────────────────

  const handleAssign = async (propertyId: string) => {
    if (!selectedClientId) return;
    setAssigning(true);
    const { error } = await supabase
      .from('client_property_matches')
      .insert({ client_id: selectedClientId, property_id: propertyId });
    if (error) {
      showToast('Failed to assign property', 'error');
    } else {
      showToast('Property assigned to client', 'success');
      await fetchMatches(selectedClientId);
    }
    setAssigning(false);
  };

  const handleUnassign = async (propertyId: string) => {
    if (!selectedClientId) return;
    setAssigning(true);
    const match = matches.find((m) => m.property_id === propertyId);
    if (match) {
      const { error } = await supabase
        .from('client_property_matches')
        .delete()
        .eq('id', match.id);
      if (error) {
        showToast('Failed to remove assignment', 'error');
      } else {
        showToast('Assignment removed', 'success');
        await fetchMatches(selectedClientId);
      }
    }
    setAssigning(false);
  };

  // ── Filter & sort properties ───────────────────────────────────────────────

  const filteredProperties = useMemo(() => {
    let data = [...properties];

    // Budget filter
    if (budgetMin) {
      const min = Number(budgetMin);
      data = data.filter((p) => {
        const price = p.asking_rent ?? p.asking_price ?? 0;
        return price >= min;
      });
    }
    if (budgetMax) {
      const max = Number(budgetMax);
      data = data.filter((p) => {
        const price = p.asking_rent ?? p.asking_price ?? 0;
        return price <= max;
      });
    }

    // District filter
    if (districtFilter.length > 0) {
      data = data.filter((p) =>
        districtFilter.some(
          (d) =>
            (p.village ?? '').toLowerCase().includes(d.toLowerCase()) ||
            d.toLowerCase().includes((p.village ?? '').toLowerCase())
        )
      );
    }

    // Type filter
    if (typeFilter !== 'all') {
      data = data.filter((p) => p.status === typeFilter);
    }

    // Bedroom filter
    if (bedroomFilter.length > 0) {
      data = data.filter((p) => p.bedrooms != null && bedroomFilter.includes(p.bedrooms));
    }

    // Sort
    if (sortBy === 'match' && selectedClient) {
      data.sort((a, b) => computeMatchScore(selectedClient, b) - computeMatchScore(selectedClient, a));
    } else if (sortBy === 'price_asc') {
      data.sort((a, b) => (a.asking_rent ?? a.asking_price ?? 0) - (b.asking_rent ?? b.asking_price ?? 0));
    } else if (sortBy === 'price_desc') {
      data.sort((a, b) => (b.asking_rent ?? b.asking_price ?? 0) - (a.asking_rent ?? a.asking_price ?? 0));
    }

    return data;
  }, [properties, budgetMin, budgetMax, districtFilter, typeFilter, bedroomFilter, sortBy, selectedClient]);

  const assignedPropertyIds = useMemo(() => new Set(matches.map((m) => m.property_id)), [matches]);

  // ── Print Viewing Schedule ─────────────────────────────────────────────────

  const handlePrintViewingSchedule = () => {
    if (!selectedClient || assignedPropertyIds.size === 0) return;
    const assignedProps = properties.filter((p) => assignedPropertyIds.has(p.id));
    const printData = {
      clientName: selectedClient.full_name,
      clientMobile: selectedClient.mobile ?? '',
      clientBudget: formatBudget(selectedClient.budget_min, selectedClient.budget_max),
      properties: assignedProps.map((p) => ({
        id: p.id,
        ref: p.property_ref,
        village: p.village,
        phase: p.phase,
        block: p.block,
        floor: p.floor,
        unit: p.unit,
        address: p.address,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        saleableArea: p.saleable_area,
        askingPrice: p.asking_price,
        askingRent: p.asking_rent,
        status: p.status,
        photoUrl: p.photo_url ?? null,
        yearBuilt: p.year_built ?? null,
        view: p.view ?? null,
        direction: p.direction ?? null,
        additionalFeatures: p.additional_features ?? [],
        engRemark: p.eng_remark ?? p.advertising_remarks ?? null,
      })),
      printedAt: new Date().toISOString(),
    };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(printData))));
    window.open(`/print-matching-schedule?data=${encoded}`, '_blank');
  };

  // ── Client dropdown filter ─────────────────────────────────────────────────

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients;
    const q = clientSearch.toLowerCase();
    return clients.filter((c) => c.full_name.toLowerCase().includes(q) || (c.mobile ?? '').includes(q));
  }, [clients, clientSearch]);

  const toggleDistrict = (d: string) => {
    setDistrictFilter((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  };

  const toggleBedroom = (b: number) => {
    setBedroomFilter((prev) =>
      prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]
    );
  };

  const clearFilters = () => {
    setBudgetMin('');
    setBudgetMax('');
    setDistrictFilter([]);
    setTypeFilter('all');
    setBedroomFilter([]);
    setSortBy(selectedClient ? 'match' : 'price_asc');
  };

  const hasFilters = budgetMin || budgetMax || districtFilter.length > 0 || typeFilter !== 'all' || bedroomFilter.length > 0;

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium transition-all ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          <Icon name={toast.type === 'success' ? 'CheckCircleIcon' : 'XCircleIcon'} size={16} />
          {toast.msg}
        </div>
      )}

      {/* Page header */}
      <div className="px-6 pt-6 pb-4 border-b border-[hsl(214,20%,88%)] bg-white flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[hsl(215,25%,18%)]">Property Matching</h1>
            <p className="text-sm text-[hsl(215,15%,52%)] mt-0.5">Select a client, then filter and assign suitable properties</p>
          </div>
          {selectedClient && (
            <div className="flex items-center gap-2 bg-[#1B4F8A]/5 border border-[#1B4F8A]/20 rounded-xl px-3 py-2">
              <div className="w-7 h-7 rounded-full bg-[#1B4F8A] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {selectedClient.full_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1B4F8A]">{selectedClient.full_name}</p>
                <p className="text-[11px] text-[hsl(215,15%,52%)]">{assignedPropertyIds.size} propert{assignedPropertyIds.size === 1 ? 'y' : 'ies'} assigned</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── Left panel: Client selector + Filters ── */}
        <div className="w-72 flex-shrink-0 border-r border-[hsl(214,20%,88%)] bg-[hsl(210,15%,97%)] flex flex-col overflow-y-auto">
          <div className="p-4 space-y-5">

            {/* Client selector */}
            <div>
              <label className="section-label mb-2 block">Select Client</label>
              <div className="relative">
                <div className="relative">
                  <Icon name="SearchIcon" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(215,15%,52%)]" />
                  <input
                    className="input-base pl-8 text-sm py-2"
                    placeholder={loadingClients ? 'Loading...' : 'Search clients…'}
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      setShowClientDropdown(true);
                    }}
                    onFocus={() => setShowClientDropdown(true)}
                    onBlur={() => setTimeout(() => setShowClientDropdown(false), 150)}
                    disabled={loadingClients}
                  />
                </div>
                {showClientDropdown && filteredClients.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-[hsl(214,20%,88%)] rounded-xl shadow-lg max-h-52 overflow-y-auto">
                    {filteredClients.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={() => handleSelectClient(c)}
                        className={`w-full text-left px-3 py-2.5 hover:bg-[#1B4F8A]/5 transition-colors border-b border-[hsl(214,20%,88%)] last:border-0 ${selectedClientId === c.id ? 'bg-[#1B4F8A]/5' : ''}`}
                      >
                        <p className="text-sm font-medium text-[hsl(215,25%,18%)]">{c.full_name}</p>
                        <p className="text-[11px] text-[hsl(215,15%,52%)]">{c.mobile ?? 'No mobile'} · {formatBudget(c.budget_min, c.budget_max)}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedClient && (
                <button
                  onClick={() => { setSelectedClientId(null); setClientSearch(''); clearFilters(); }}
                  className="mt-1.5 text-xs text-[hsl(215,15%,52%)] hover:text-red-500 transition-colors flex items-center gap-1"
                >
                  <Icon name="XIcon" size={11} /> Clear selection
                </button>
              )}
            </div>

            {/* Client preference summary */}
            {selectedClient && (
              <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-3 space-y-1.5">
                <p className="text-[11px] font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Client Preferences</p>
                <div className="flex items-center gap-1.5 text-xs text-[hsl(215,25%,18%)]">
                  <Icon name="DollarSignIcon" size={12} className="text-[hsl(215,15%,52%)]" />
                  {formatBudget(selectedClient.budget_min, selectedClient.budget_max)}
                </div>
                {selectedClient.preferred_areas && selectedClient.preferred_areas.length > 0 && (
                  <div className="flex items-start gap-1.5 text-xs text-[hsl(215,25%,18%)]">
                    <Icon name="MapPinIcon" size={12} className="text-[hsl(215,15%,52%)] mt-0.5 flex-shrink-0" />
                    <span>{selectedClient.preferred_areas.join(', ')}</span>
                  </div>
                )}
                {selectedClient.preferred_bedrooms && selectedClient.preferred_bedrooms.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-[hsl(215,25%,18%)]">
                    <Icon name="BedDoubleIcon" size={12} className="text-[hsl(215,15%,52%)]" />
                    {selectedClient.preferred_bedrooms.join(', ')} bed{selectedClient.preferred_bedrooms.length > 1 ? 's' : ''}
                  </div>
                )}
                {selectedClient.notes && (
                  <div className="flex items-start gap-1.5 text-xs text-[hsl(215,15%,52%)]">
                    <Icon name="FileTextIcon" size={12} className="mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{selectedClient.notes}</span>
                  </div>
                )}
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-[hsl(214,20%,88%)]" />

            {/* Filters */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="section-label">Filters</p>
                {hasFilters && (
                  <button onClick={clearFilters} className="text-[11px] text-[#1B4F8A] hover:underline">Clear all</button>
                )}
              </div>

              {/* Budget */}
              <div>
                <label className="text-xs font-medium text-[hsl(215,25%,18%)] mb-1.5 block">Budget Range (HK$)</label>
                <div className="flex gap-1.5 items-center">
                  <input
                    className="input-base text-xs py-1.5 flex-1"
                    placeholder="Min"
                    type="number"
                    value={budgetMin}
                    onChange={(e) => setBudgetMin(e.target.value)}
                  />
                  <span className="text-[hsl(215,15%,52%)] text-xs">–</span>
                  <input
                    className="input-base text-xs py-1.5 flex-1"
                    placeholder="Max"
                    type="number"
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(e.target.value)}
                  />
                </div>
              </div>

              {/* Property type */}
              <div>
                <label className="text-xs font-medium text-[hsl(215,25%,18%)] mb-1.5 block">Property Type</label>
                <select
                  className="input-base text-xs py-1.5"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  {PROPERTY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Bedrooms */}
              <div>
                <label className="text-xs font-medium text-[hsl(215,25%,18%)] mb-1.5 block">Bedrooms</label>
                <div className="flex gap-1.5 flex-wrap">
                  {BEDROOM_OPTIONS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => toggleBedroom(b)}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold border transition-all ${
                        bedroomFilter.includes(b)
                          ? 'bg-[#1B4F8A] text-white border-[#1B4F8A]'
                          : 'bg-white text-[hsl(215,15%,52%)] border-[hsl(214,20%,88%)] hover:border-[#1B4F8A]/50'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Villages */}
              <div>
                <label className="text-xs font-medium text-[hsl(215,25%,18%)] mb-1.5 block">Villages</label>
                <div className="flex flex-wrap gap-1">
                  {HK_DISTRICTS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDistrict(d)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
                        districtFilter.includes(d)
                          ? 'bg-[#1B4F8A] text-white border-[#1B4F8A]'
                          : 'bg-white text-[hsl(215,15%,52%)] border-[hsl(214,20%,88%)] hover:border-[#1B4F8A]/50'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right panel: Property results ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Results toolbar */}
          <div className="px-5 py-3 border-b border-[hsl(214,20%,88%)] bg-white flex items-center justify-between gap-3 flex-shrink-0">
            <p className="text-sm text-[hsl(215,15%,52%)]">
              {loadingProps ? 'Loading…' : (
                <>
                  <span className="font-semibold text-[hsl(215,25%,18%)]">{filteredProperties.length}</span> propert{filteredProperties.length === 1 ? 'y' : 'ies'} found
                  {assignedPropertyIds.size > 0 && (
                    <span className="ml-2 text-[#1B4F8A] font-medium">· {assignedPropertyIds.size} assigned</span>
                  )}
                </>
              )}
            </p>
            <div className="flex items-center gap-2">
              {selectedClient && assignedPropertyIds.size > 0 && (
                <button
                  onClick={handlePrintViewingSchedule}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B4F8A] text-white text-xs font-semibold hover:bg-[#163f6e] transition-colors"
                  title="Print viewing schedule for assigned properties"
                >
                  <Icon name="PrinterIcon" size={13} />
                  Print Viewing Schedule
                </button>
              )}
              <label className="text-xs text-[hsl(215,15%,52%)]">Sort:</label>
              <select
                className="input-base text-xs py-1 pr-7"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              >
                {selectedClient && <option value="match">Best Match</option>}
                <option value="price_asc">Price: Low → High</option>
                <option value="price_desc">Price: High → Low</option>
              </select>
            </div>
          </div>

          {/* Property grid */}
          <div className="flex-1 overflow-y-auto p-5">
            {!selectedClientId && (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <div className="w-14 h-14 rounded-2xl bg-[#1B4F8A]/8 flex items-center justify-center mb-4">
                  <Icon name="UsersIcon" size={26} className="text-[#1B4F8A]/50" />
                </div>
                <p className="text-base font-semibold text-[hsl(215,25%,18%)]">Select a client to get started</p>
                <p className="text-sm text-[hsl(215,15%,52%)] mt-1 max-w-xs">Choose a client from the left panel. Filters will be pre-filled from their preferences and you can assign matching properties.</p>
              </div>
            )}

            {selectedClientId && loadingProps && (
              <div className="flex items-center justify-center py-16">
                <svg className="animate-spin w-6 h-6 text-[#1B4F8A]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </div>
            )}

            {selectedClientId && !loadingProps && filteredProperties.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                  <Icon name="SearchXIcon" size={22} className="text-gray-400" />
                </div>
                <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">No properties match these filters</p>
                <button onClick={clearFilters} className="mt-2 text-xs text-[#1B4F8A] hover:underline">Clear filters</button>
              </div>
            )}

            {selectedClientId && !loadingProps && filteredProperties.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredProperties.map((property) => (
                  <PropertyCard
                    key={property.id}
                    property={property}
                    isAssigned={assignedPropertyIds.has(property.id)}
                    matchScore={selectedClient ? computeMatchScore(selectedClient, property) : 0}
                    onAssign={handleAssign}
                    onUnassign={handleUnassign}
                    assigning={assigning}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
