'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useRole } from '@/hooks/useRole';
import { useClientsRealtime, RealtimeEvent } from '@/hooks/useRealtimeSync';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Client {
  id: string;
  full_name: string;
  mobile: string | null;
  email: string | null;
  budget_min: number | null;
  budget_max: number | null;
  preferred_areas: string[] | null;
  preferred_bedrooms: number[] | null;
  notes: string | null;
  created_at: string;
}

interface MatchedProperty {
  id: string;
  property_id: string;
  created_at: string;
  properties: {
    property_ref: string;
    village: string;
    phase: string | null;
    block: string | null;
    floor: string | null;
    unit: string | null;
    bedrooms: number | null;
    saleable_area: number | null;
    asking_rent: number | null;
    asking_price: number | null;
    status: string;
  } | null;
}

interface ClientForm {
  full_name: string;
  mobile: string;
  email: string;
  budget_min: string;
  budget_max: string;
  preferred_areas: string[];
  notes: string;
}

type SortKey = 'full_name' | 'mobile' | 'budget_max' | 'preferred_areas' | 'created_at';
type SortDir = 'asc' | 'desc';

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
  'Discovery Bay',
];

const EMPTY_FORM: ClientForm = {
  full_name: '',
  mobile: '',
  email: '',
  budget_min: '',
  budget_max: '',
  preferred_areas: [],
  notes: '',
};

function formatBudget(min: number | null, max: number | null): string {
  if (!min && !max) return '—';
  const fmt = (n: number) =>
    n >= 1_000_000
      ? `HK$${(n / 1_000_000).toFixed(1)}M`
      : `HK$${(n / 1_000).toFixed(0)}K`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (max) return `Up to ${fmt(max)}`;
  return `From ${fmt(min!)}`;
}

// ─── Inline Row Form ──────────────────────────────────────────────────────────

interface RowFormProps {
  form: ClientForm;
  onChange: (form: ClientForm) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isNew?: boolean;
}

function RowForm({ form, onChange, onSave, onCancel, saving, isNew }: RowFormProps) {
  const toggleDistrict = (d: string) => {
    const next = form.preferred_areas.includes(d)
      ? form.preferred_areas.filter((x) => x !== d)
      : [...form.preferred_areas, d];
    onChange({ ...form, preferred_areas: next });
  };

  return (
    <tr className={`${isNew ? 'bg-[#1B4F8A]/5' : 'bg-amber-50/60'} animate-slide-up`}>
      {/* Name */}
      <td className="px-4 py-3 align-top">
        <input
          className="input-base text-sm py-1.5"
          placeholder="Full name *"
          value={form.full_name}
          onChange={(e) => onChange({ ...form, full_name: e.target.value })}
          autoFocus
        />
      </td>
      {/* Mobile */}
      <td className="px-4 py-3 align-top">
        <input
          className="input-base text-sm py-1.5"
          placeholder="+852 xxxx xxxx"
          value={form.mobile}
          onChange={(e) => onChange({ ...form, mobile: e.target.value })}
        />
      </td>
      {/* Budget */}
      <td className="px-4 py-3 align-top">
        <div className="flex gap-1.5 items-center">
          <input
            className="input-base text-sm py-1.5 w-24"
            placeholder="Min (e.g. 1.4)"
            type="number"
            step="0.1"
            value={form.budget_min}
            onChange={(e) => onChange({ ...form, budget_min: e.target.value })}
          />
          <span className="text-[hsl(215,15%,52%)] text-xs">–</span>
          <input
            className="input-base text-sm py-1.5 w-24"
            placeholder="Max (e.g. 2.5)"
            type="number"
            step="0.1"
            value={form.budget_max}
            onChange={(e) => onChange({ ...form, budget_max: e.target.value })}
          />
        </div>
        <p className="text-[10px] text-[hsl(215,15%,62%)] mt-1">× 1,000,000</p>
      </td>
      {/* Districts */}
      <td className="px-4 py-3 align-top" colSpan={1}>
        <div className="flex flex-wrap gap-1 max-w-xs">
          {HK_DISTRICTS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDistrict(d)}
              className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all duration-100 ${
                form.preferred_areas.includes(d)
                  ? 'bg-[#1B4F8A] text-white border-[#1B4F8A]'
                  : 'bg-white text-[hsl(215,15%,52%)] border-[hsl(214,20%,88%)] hover:border-[#1B4F8A]/50'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </td>
      {/* Notes */}
      <td className="px-4 py-3 align-top">
        <input
          className="input-base text-sm py-1.5"
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => onChange({ ...form, notes: e.target.value })}
        />
      </td>
      {/* Actions */}
      <td className="px-4 py-3 align-top">
        <div className="flex items-center gap-1.5">
          <button
            onClick={onSave}
            disabled={saving || !form.full_name.trim()}
            className="btn-primary py-1.5 px-3 text-xs disabled:opacity-50"
          >
            {saving ? (
              <span className="flex items-center gap-1">
                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Saving
              </span>
            ) : (
              'Save'
            )}
          </button>
          <button onClick={onCancel} className="btn-ghost py-1.5 px-3 text-xs">
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClientsClient() {
  const supabase = createClient();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & sort
  const [search, setSearch] = useState('');
  const [districtFilter, setDistrictFilter] = useState('All Districts');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Inline add/edit state
  const [addingNew, setAddingNew] = useState(false);
  const [newForm, setNewForm] = useState<ClientForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ClientForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const { isAdminOrManager, isAdmin } = useRole();

  // Expanded client for matched properties
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [matchedProperties, setMatchedProperties] = useState<MatchedProperty[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('clients')
      .select('id, full_name, mobile, email, budget_min, budget_max, preferred_areas, preferred_bedrooms, notes, created_at')
      .order('created_at', { ascending: false });
    if (err) {
      setError(err.message);
    } else {
      setClients(data ?? []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // ── Realtime sync — refresh list when another window mutates clients ───────
  useClientsRealtime(
    useCallback((_event: RealtimeEvent, _row: Record<string, unknown>) => {
      fetchClients();
    }, [fetchClients])
  );

  // ── Toast helper ───────────────────────────────────────────────────────────

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Sort & Filter ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let data = [...clients];

    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(
        (c) =>
          c.full_name.toLowerCase().includes(q) ||
          (c.mobile ?? '').toLowerCase().includes(q) ||
          (c.email ?? '').toLowerCase().includes(q) ||
          (c.notes ?? '').toLowerCase().includes(q)
      );
    }

    if (districtFilter !== 'All Districts') {
      data = data.filter((c) => c.preferred_areas?.includes(districtFilter));
    }

    data.sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      if (sortKey === 'full_name') { av = a.full_name; bv = b.full_name; }
      else if (sortKey === 'mobile') { av = a.mobile ?? ''; bv = b.mobile ?? ''; }
      else if (sortKey === 'budget_max') { av = a.budget_max ?? 0; bv = b.budget_max ?? 0; }
      else if (sortKey === 'preferred_areas') { av = (a.preferred_areas ?? []).join(','); bv = (b.preferred_areas ?? []).join(','); }
      else if (sortKey === 'created_at') { av = a.created_at; bv = b.created_at; }

      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return data;
  }, [clients, search, districtFilter, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <Icon name="ChevronsUpDownIcon" size={13} className="text-[hsl(215,15%,62%)] ml-1" />;
    return sortDir === 'asc'
      ? <Icon name="ChevronUpIcon" size={13} className="text-[#1B4F8A] ml-1" />
      : <Icon name="ChevronDownIcon" size={13} className="text-[#1B4F8A] ml-1" />;
  };

  // ── Add ────────────────────────────────────────────────────────────────────

  const handleAdd = async () => {
    if (!newForm.full_name.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      full_name: newForm.full_name.trim(),
      mobile: newForm.mobile.trim() || null,
      email: newForm.email.trim() || null,
      budget_min: newForm.budget_min ? Math.round(parseFloat(newForm.budget_min) * 1_000_000) : null,
      budget_max: newForm.budget_max ? Math.round(parseFloat(newForm.budget_max) * 1_000_000) : null,
      preferred_areas: newForm.preferred_areas.length ? newForm.preferred_areas : null,
      notes: newForm.notes.trim() || null,
      created_by: user?.id ?? null,
    };
    const { error: err } = await supabase.from('clients').insert(payload);
    if (err) {
      showToast(err.message, 'error');
    } else {
      showToast('Client added successfully', 'success');
      setAddingNew(false);
      setNewForm(EMPTY_FORM);
      fetchClients();
    }
    setSaving(false);
  };

  // ── Edit ───────────────────────────────────────────────────────────────────

  const startEdit = (c: Client) => {
    setEditingId(c.id);
    setEditForm({
      full_name: c.full_name,
      mobile: c.mobile ?? '',
      email: c.email ?? '',
      budget_min: c.budget_min != null ? (c.budget_min / 1_000_000).toString() : '',
      budget_max: c.budget_max != null ? (c.budget_max / 1_000_000).toString() : '',
      preferred_areas: c.preferred_areas ?? [],
      notes: c.notes ?? '',
    });
    setAddingNew(false);
  };

  const handleUpdate = async () => {
    if (!editingId || !editForm.full_name.trim()) return;
    setSaving(true);
    const payload = {
      full_name: editForm.full_name.trim(),
      mobile: editForm.mobile.trim() || null,
      email: editForm.email.trim() || null,
      budget_min: editForm.budget_min ? Math.round(parseFloat(editForm.budget_min) * 1_000_000) : null,
      budget_max: editForm.budget_max ? Math.round(parseFloat(editForm.budget_max) * 1_000_000) : null,
      preferred_areas: editForm.preferred_areas.length ? editForm.preferred_areas : null,
      notes: editForm.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error: err } = await supabase.from('clients').update(payload).eq('id', editingId);
    if (err) {
      showToast(err.message, 'error');
    } else {
      showToast('Client updated', 'success');
      setEditingId(null);
      fetchClients();
    }
    setSaving(false);
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this client? This cannot be undone.')) return;
    const { error: err } = await supabase.from('clients').delete().eq('id', id);
    if (err) {
      showToast(err.message, 'error');
    } else {
      showToast('Client deleted', 'success');
      fetchClients();
    }
  };

  // ── Matched Properties ─────────────────────────────────────────────────────

  const handleToggleMatches = async (clientId: string) => {
    if (expandedClientId === clientId) {
      setExpandedClientId(null);
      setMatchedProperties([]);
      return;
    }
    setExpandedClientId(clientId);
    setLoadingMatches(true);
    const { data, error: err } = await supabase
      .from('client_property_matches')
      .select(`
        id,
        property_id,
        created_at,
        properties (
          property_ref,
          village,
          phase,
          block,
          floor,
          unit,
          bedrooms,
          saleable_area,
          asking_rent,
          asking_price,
          status
        )
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    if (!err) {
      setMatchedProperties((data as unknown as MatchedProperty[]) ?? []);
    }
    setLoadingMatches(false);
  };

  function formatMatchPrice(rent: number | null, price: number | null): string {
    const val = rent ?? price;
    if (!val) return '—';
    if (val >= 1_000_000) return `HK$${(val / 1_000_000).toFixed(1)}M${rent ? '/mo' : ''}`;
    if (val >= 1_000) return `HK$${(val / 1_000).toFixed(0)}K${rent ? '/mo' : ''}`;
    return `HK$${val}`;
  }

  function matchStatusLabel(status: string): string {
    switch (status) {
      case 'for-rent': return 'For Rent';
      case 'for-sale': return 'For Sale';
      case 'for-sale-and-rent': return 'For Sale & Rent';
      case 'leased': return 'Leased';
      default: return status;
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-slide-up ${
            toast.type === 'success' ?'bg-white border border-green-200 text-green-700' :'bg-white border border-red-200 text-red-600'
          }`}
        >
          <Icon name={toast.type === 'success' ? 'CheckCircleIcon' : 'AlertCircleIcon'} size={16} />
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(215,25%,18%)]">Clients</h1>
          <p className="text-sm text-[hsl(215,15%,52%)] mt-0.5">
            {loading ? 'Loading…' : `${filtered.length} client${filtered.length !== 1 ? 's' : ''}${clients.length !== filtered.length ? ` of ${clients.length}` : ''}`}
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => { setAddingNew(true); setEditingId(null); setNewForm(EMPTY_FORM); }}
        >
          <Icon name="PlusIcon" size={16} />
          Add Client
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Icon name="SearchIcon" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(215,15%,52%)]" />
          <input
            className="input-base pl-9 text-sm py-1.5"
            placeholder="Search name, mobile, notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input-base w-auto text-sm py-1.5"
          value={districtFilter}
          onChange={(e) => setDistrictFilter(e.target.value)}
        >
          <option>All Districts</option>
          {HK_DISTRICTS.map((d) => <option key={d}>{d}</option>)}
        </select>
        {(search || districtFilter !== 'All Districts') && (
          <button
            className="btn-ghost py-1.5 text-xs"
            onClick={() => { setSearch(''); setDistrictFilter('All Districts'); }}
          >
            <Icon name="XIcon" size={13} />
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsl(214,20%,88%)] bg-[hsl(210,20%,97%)]">
                <th
                  className="px-4 py-3 text-left font-semibold text-[hsl(215,25%,18%)] cursor-pointer select-none whitespace-nowrap"
                  onClick={() => handleSort('full_name')}
                >
                  <span className="inline-flex items-center">Name <SortIcon col="full_name" /></span>
                </th>
                <th
                  className="px-4 py-3 text-left font-semibold text-[hsl(215,25%,18%)] cursor-pointer select-none whitespace-nowrap"
                  onClick={() => handleSort('mobile')}
                >
                  <span className="inline-flex items-center">Mobile <SortIcon col="mobile" /></span>
                </th>
                <th
                  className="px-4 py-3 text-left font-semibold text-[hsl(215,25%,18%)] cursor-pointer select-none whitespace-nowrap"
                  onClick={() => handleSort('budget_max')}
                >
                  <span className="inline-flex items-center">Budget <SortIcon col="budget_max" /></span>
                </th>
                <th
                  className="px-4 py-3 text-left font-semibold text-[hsl(215,25%,18%)] cursor-pointer select-none whitespace-nowrap"
                  onClick={() => handleSort('preferred_areas')}
                >
                  <span className="inline-flex items-center">Village Preference <SortIcon col="preferred_areas" /></span>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-[hsl(215,25%,18%)] whitespace-nowrap">Notes</th>
                <th className="px-4 py-3 text-center font-semibold text-[hsl(215,25%,18%)] whitespace-nowrap">Matches</th>
                <th className="px-4 py-3 text-right font-semibold text-[hsl(215,25%,18%)] whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* Inline Add Row */}
              {addingNew && (
                <RowForm
                  form={newForm}
                  onChange={setNewForm}
                  onSave={handleAdd}
                  onCancel={() => { setAddingNew(false); setNewForm(EMPTY_FORM); }}
                  saving={saving}
                  isNew
                />
              )}

              {/* Loading */}
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[hsl(215,15%,52%)]">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4 text-[#1B4F8A]" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Loading clients…
                    </div>
                  </td>
                </tr>
              )}

              {/* Error */}
              {error && !loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-red-500 text-sm">
                    <Icon name="AlertCircleIcon" size={16} className="inline mr-1.5" />
                    {error}
                  </td>
                </tr>
              )}

              {/* Empty state */}
              {!loading && !error && filtered.length === 0 && !addingNew && (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center">
                    <div className="flex flex-col items-center gap-2 text-[hsl(215,15%,52%)]">
                      <Icon name="UsersIcon" size={32} className="opacity-30" />
                      <p className="font-medium text-sm">
                        {clients.length === 0 ? 'No clients yet' : 'No clients match your filters'}
                      </p>
                      {clients.length === 0 && (
                        <button
                          className="btn-primary mt-1 text-xs py-1.5 px-3"
                          onClick={() => setAddingNew(true)}
                        >
                          <Icon name="PlusIcon" size={13} />
                          Add your first client
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {/* Data rows */}
              {!loading && !error && filtered.map((client) => {
                if (editingId === client.id) {
                  return (
                    <RowForm
                      key={client.id}
                      form={editForm}
                      onChange={setEditForm}
                      onSave={handleUpdate}
                      onCancel={() => setEditingId(null)}
                      saving={saving}
                    />
                  );
                }

                return (
                  <React.Fragment key={client.id}>
                  <tr
                    className="border-b border-[hsl(214,20%,88%)] last:border-0 hover:bg-[hsl(210,20%,97%)] transition-colors group"
                  >
                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#1B4F8A]/10 flex items-center justify-center text-[#1B4F8A] text-xs font-bold flex-shrink-0">
                          {client.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-[hsl(215,25%,18%)]">{client.full_name}</p>
                          {client.email && (
                            <p className="text-xs text-[hsl(215,15%,52%)] truncate max-w-[160px]">{client.email}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Mobile */}
                    <td className="px-4 py-3 text-[hsl(215,25%,18%)] font-mono text-xs tabular-nums">
                      {client.mobile ?? <span className="text-[hsl(215,15%,62%)]">—</span>}
                    </td>

                    {/* Budget */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {client.budget_min || client.budget_max ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#C9A84C]/10 text-[#8a6a1b] text-xs font-semibold">
                          {formatBudget(client.budget_min, client.budget_max)}
                        </span>
                      ) : (
                        <span className="text-[hsl(215,15%,62%)]">—</span>
                      )}
                    </td>

                    {/* Districts */}
                    <td className="px-4 py-3">
                      {client.preferred_areas && client.preferred_areas.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {client.preferred_areas.slice(0, 3).map((area) => (
                            <span
                              key={area}
                              className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#1B4F8A]/8 text-[#1B4F8A] text-[11px] font-medium border border-[#1B4F8A]/15"
                            >
                              {area}
                            </span>
                          ))}
                          {client.preferred_areas.length > 3 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[hsl(210,15%,94%)] text-[hsl(215,15%,52%)] text-[11px] font-medium">
                              +{client.preferred_areas.length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[hsl(215,15%,62%)]">—</span>
                      )}
                    </td>

                    {/* Notes */}
                    <td className="px-4 py-3 max-w-[200px]">
                      {client.notes ? (
                        <p className="text-xs text-[hsl(215,15%,52%)] truncate" title={client.notes}>
                          {client.notes}
                        </p>
                      ) : (
                        <span className="text-[hsl(215,15%,62%)]">—</span>
                      )}
                    </td>

                    {/* Matches */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleMatches(client.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                          expandedClientId === client.id
                            ? 'bg-[#1B4F8A] text-white border-[#1B4F8A]'
                            : 'bg-[#1B4F8A]/8 text-[#1B4F8A] border-[#1B4F8A]/20 hover:bg-[#1B4F8A]/15'
                        }`}
                        title="View matched properties"
                      >
                        <Icon name="HomeIcon" size={12} />
                        View
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => startEdit(client)}
                          className="btn-ghost py-1 px-2 text-xs"
                          title="Edit client"
                        >
                          <Icon name="PencilIcon" size={13} />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(client.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg text-red-500 hover:bg-red-50 transition-all duration-150"
                          title="Delete client"
                        >
                          <Icon name="Trash2Icon" size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded matched properties row */}
                  {expandedClientId === client.id && (
                    <tr key={`${client.id}-matches`} className="bg-[#f0f4f9]">
                      <td colSpan={7} className="px-6 py-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-semibold text-[#1B4F8A] uppercase tracking-wide flex items-center gap-1.5">
                            <Icon name="HomeIcon" size={13} />
                            Matched Properties for {client.full_name}
                          </p>
                          <button
                            onClick={() => { setExpandedClientId(null); setMatchedProperties([]); }}
                            className="text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)] transition-colors"
                          >
                            <Icon name="XIcon" size={14} />
                          </button>
                        </div>

                        {loadingMatches ? (
                          <div className="flex items-center gap-2 py-3 text-xs text-[hsl(215,15%,52%)]">
                            <svg className="animate-spin w-3.5 h-3.5 text-[#1B4F8A]" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                            Loading matched properties…
                          </div>
                        ) : matchedProperties.length === 0 ? (
                          <p className="text-xs text-[hsl(215,15%,52%)] py-2">No properties matched yet. Use the <span className="font-medium text-[#1B4F8A]">Property Matching</span> page to assign properties to this client.</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                            {matchedProperties.map((match) => {
                              const prop = match.properties;
                              if (!prop) return null;
                              const location = [
                                prop.village,
                                prop.phase,
                                prop.block ? `Blk ${prop.block}` : null,
                                prop.floor ? `Fl.${prop.floor}` : null,
                                prop.unit ? `Unit ${prop.unit}` : null,
                              ].filter(Boolean).join(' · ');
                              return (
                                <div key={match.id} className="bg-white rounded-lg border border-[hsl(214,20%,88%)] p-3 text-xs">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="font-bold text-[hsl(215,25%,18%)] font-mono">{prop.property_ref}</span>
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                                      prop.status === 'for-rent' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                      prop.status === 'for-sale' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                      prop.status === 'leased'? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-gray-100 text-gray-600 border-gray-200'
                                    }`}>
                                      {matchStatusLabel(prop.status)}
                                    </span>
                                  </div>
                                  <p className="text-[hsl(215,15%,52%)] truncate mb-1.5">{location || '—'}</p>
                                  <div className="flex items-center gap-2 text-[hsl(215,25%,18%)]">
                                    {prop.bedrooms != null && <span>{prop.bedrooms} bed</span>}
                                    {prop.saleable_area != null && <span>· {prop.saleable_area}ft²</span>}
                                    <span className="ml-auto font-semibold text-[#1B4F8A]">
                                      {formatMatchPrice(prop.asking_rent, prop.asking_price)}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer count */}
        {!loading && !error && clients.length > 0 && (
          <div className="px-4 py-3 border-t border-[hsl(214,20%,88%)] bg-[hsl(210,20%,97%)] flex items-center justify-between">
            <p className="text-xs text-[hsl(215,15%,52%)]">
              Showing {filtered.length} of {clients.length} clients
            </p>
            <p className="text-xs text-[hsl(215,15%,52%)]">
              Sorted by{' '}
              <span className="font-medium text-[hsl(215,25%,18%)]">
                {sortKey === 'full_name' ? 'Name' : sortKey === 'mobile' ? 'Mobile' : sortKey === 'budget_max' ? 'Budget' : sortKey === 'preferred_areas' ? 'Districts' : 'Date Added'}
              </span>{' '}
              ({sortDir === 'asc' ? '↑' : '↓'})
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
