'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CompletedTenancy {
  id: string;
  property_ref: string;
  property_address: string;
  tenant_name: string;
  landlord_name: string | null;
  lease_start: string | null;
  lease_end: string | null;
  actual_end_date: string;
  monthly_rent: number | null;
  handover_notes: string | null;
  deposit_returned: boolean;
  keys_returned: boolean;
  utilities_settled: boolean;
  agent_name: string | null;
  archived_at: string;
}

type SortField = 'actual_end_date' | 'archived_at' | 'property_address' | 'tenant_name';
type SortDir = 'asc' | 'desc';
type ChecklistFilter = 'all' | 'complete' | 'incomplete';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCurrency(amount: number | null) {
  if (!amount) return '—';
  return `HK$${amount.toLocaleString()}`;
}

function getChecklistCount(c: CompletedTenancy) {
  return [c.deposit_returned, c.keys_returned, c.utilities_settled].filter(Boolean).length;
}

// ─── Checklist Badge ───────────────────────────────────────────────────────────

function ChecklistBadge({ c }: { c: CompletedTenancy }) {
  const count = getChecklistCount(c);
  const complete = count === 3;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {[
          { done: c.deposit_returned, label: 'Deposit' },
          { done: c.keys_returned, label: 'Keys' },
          { done: c.utilities_settled, label: 'Utilities' },
        ].map((item) => (
          <span
            key={item.label}
            title={item.label}
            className={`w-5 h-5 rounded-full flex items-center justify-center ${
              item.done ? 'bg-emerald-100 text-emerald-600' : 'bg-[hsl(214,20%,92%)] text-[hsl(215,15%,65%)]'
            }`}
          >
            <Icon name="CheckIcon" size={10} />
          </span>
        ))}
      </div>
      <span
        className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
          complete
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :'bg-amber-50 text-amber-700 border border-amber-200'
        }`}
      >
        {count}/3
      </span>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ArchivedTenanciesClient() {
  const supabase = createClient();

  const [records, setRecords] = useState<CompletedTenancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [checklistFilter, setChecklistFilter] = useState<ChecklistFilter>('all');
  const [agentFilter, setAgentFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('actual_end_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    async function fetchArchive() {
      setLoading(true);
      const { data, error } = await supabase
        .from('completed_tenancies')
        .select('*')
        .order('archived_at', { ascending: false });
      if (!error && data) setRecords(data as CompletedTenancy[]);
      setLoading(false);
    }
    fetchArchive();
  }, []);

  // Derived filter options
  const agentOptions = useMemo(() => {
    const agents = Array.from(new Set(records.map((r) => r.agent_name).filter(Boolean))) as string[];
    return agents.sort();
  }, [records]);

  const yearOptions = useMemo(() => {
    const years = Array.from(
      new Set(records.map((r) => new Date(r.actual_end_date).getFullYear()).filter((y) => !isNaN(y)))
    ) as number[];
    return years.sort((a, b) => b - a);
  }, [records]);

  // Stats
  const stats = useMemo(() => {
    const total = records.length;
    const complete = records.filter((r) => getChecklistCount(r) === 3).length;
    const incomplete = total - complete;
    const thisYear = records.filter(
      (r) => new Date(r.actual_end_date).getFullYear() === new Date().getFullYear()
    ).length;
    return { total, complete, incomplete, thisYear };
  }, [records]);

  // Filtered + sorted
  const filtered = useMemo(() => {
    let result = [...records];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.property_address.toLowerCase().includes(q) ||
          r.property_ref.toLowerCase().includes(q) ||
          r.tenant_name.toLowerCase().includes(q) ||
          (r.landlord_name ?? '').toLowerCase().includes(q) ||
          (r.agent_name ?? '').toLowerCase().includes(q) ||
          (r.handover_notes ?? '').toLowerCase().includes(q)
      );
    }

    if (checklistFilter === 'complete') result = result.filter((r) => getChecklistCount(r) === 3);
    if (checklistFilter === 'incomplete') result = result.filter((r) => getChecklistCount(r) < 3);
    if (agentFilter) result = result.filter((r) => r.agent_name === agentFilter);
    if (yearFilter) result = result.filter((r) => new Date(r.actual_end_date).getFullYear() === parseInt(yearFilter));

    result.sort((a, b) => {
      let aVal = '';
      let bVal = '';
      if (sortField === 'actual_end_date') { aVal = a.actual_end_date; bVal = b.actual_end_date; }
      else if (sortField === 'archived_at') { aVal = a.archived_at; bVal = b.archived_at; }
      else if (sortField === 'property_address') { aVal = a.property_address; bVal = b.property_address; }
      else if (sortField === 'tenant_name') { aVal = a.tenant_name; bVal = b.tenant_name; }
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });

    return result;
  }, [records, search, checklistFilter, agentFilter, yearFilter, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <Icon name="ChevronsUpDownIcon" size={12} className="text-[hsl(215,15%,65%)]" />;
    return (
      <Icon
        name={sortDir === 'asc' ? 'ChevronUpIcon' : 'ChevronDownIcon'}
        size={12}
        className="text-[#8B1A2B]"
      />
    );
  }

  const hasFilters = search || checklistFilter !== 'all' || agentFilter || yearFilter;

  function clearFilters() {
    setSearch('');
    setChecklistFilter('all');
    setAgentFilter('');
    setYearFilter('');
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        {/* ── Header ── */}
        <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-[hsl(214,20%,88%)] bg-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-[hsl(215,25%,18%)]">Archived Tenancies</h1>
              <p className="text-sm text-[hsl(215,15%,52%)] mt-0.5">
                Complete history of closed tenancies with handover dates and checklist status
              </p>
            </div>
            <Link
              href="/tenancy-handover"
              className="inline-flex items-center gap-1.5 text-sm text-[#8B1A2B] hover:text-[#6d1522] font-medium transition-colors"
            >
              <Icon name="ArrowLeftIcon" size={14} />
              Tenancy Handover
            </Link>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total Archived', value: stats.total, icon: 'ArchiveIcon', color: 'text-[hsl(215,25%,18%)]', bg: 'bg-[hsl(210,15%,96%)]' },
              { label: 'Handover This Year', value: stats.thisYear, icon: 'CalendarIcon', color: 'text-[#8B1A2B]', bg: 'bg-[#8B1A2B]/6' },
              { label: 'Checklist Complete', value: stats.complete, icon: 'CheckCircleIcon', color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Checklist Incomplete', value: stats.incomplete, icon: 'AlertCircleIcon', color: 'text-amber-600', bg: 'bg-amber-50' },
            ].map((s) => (
              <div key={s.label} className={`${s.bg} rounded-xl px-4 py-3 flex items-center gap-3`}>
                <Icon name={s.icon as Parameters<typeof Icon>[0]['name']} size={18} className={s.color} />
                <div>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-[hsl(215,15%,52%)]">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="flex-shrink-0 px-6 py-3 border-b border-[hsl(214,20%,88%)] bg-[hsl(210,15%,98%)]">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px] max-w-xs">
              <Icon name="SearchIcon" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(215,15%,52%)]" />
              <input
                type="text"
                placeholder="Search property, tenant, agent, notes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-xl bg-white text-[hsl(215,25%,18%)] placeholder-[hsl(215,15%,65%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20"
              />
            </div>

            {/* Checklist filter */}
            <select
              value={checklistFilter}
              onChange={(e) => setChecklistFilter(e.target.value as ChecklistFilter)}
              className="px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-xl bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20"
            >
              <option value="all">All Checklists</option>
              <option value="complete">✓ Complete</option>
              <option value="incomplete">⚠ Incomplete</option>
            </select>

            {/* Agent filter */}
            {agentOptions.length > 0 && (
              <select
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-xl bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20"
              >
                <option value="">All Agents</option>
                {agentOptions.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            )}

            {/* Year filter */}
            {yearOptions.length > 0 && (
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-xl bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20"
              >
                <option value="">All Years</option>
                {yearOptions.map((y) => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            )}

            {/* Clear filters */}
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)] border border-[hsl(214,20%,88%)] rounded-xl bg-white hover:bg-[hsl(210,15%,95%)] transition-colors"
              >
                <Icon name="XIcon" size={13} />
                Clear
              </button>
            )}

            <span className="ml-auto text-xs text-[hsl(215,15%,52%)]">
              {filtered.length} {filtered.length === 1 ? 'record' : 'records'}
            </span>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="bg-white border border-[hsl(214,20%,88%)] rounded-2xl p-16 flex items-center justify-center gap-3 text-[hsl(215,15%,52%)]">
              <Icon name="LoaderIcon" size={20} className="animate-spin" />
              <span className="text-sm">Loading archive…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-[hsl(214,20%,88%)] rounded-2xl p-16 text-center">
              <Icon name="ArchiveIcon" size={36} className="text-[hsl(215,15%,75%)] mx-auto mb-3" />
              <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">
                {hasFilters ? 'No records match your filters' : 'No archived tenancies yet'}
              </p>
              <p className="text-xs text-[hsl(215,15%,52%)] mt-1">
                {hasFilters
                  ? 'Try adjusting your search or filter criteria.' :'Closed tenancies will appear here once archived via Tenancy Handover.'}
              </p>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm text-[#8B1A2B] border border-[#8B1A2B]/30 rounded-xl hover:bg-[#8B1A2B]/5 transition-colors"
                >
                  <Icon name="XIcon" size={13} />
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white border border-[hsl(214,20%,88%)] rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[hsl(214,20%,92%)] bg-[hsl(210,15%,97%)]">
                    <th className="text-left px-4 py-3">
                      <button
                        onClick={() => toggleSort('property_address')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide hover:text-[hsl(215,25%,18%)] transition-colors"
                      >
                        Property <SortIcon field="property_address" />
                      </button>
                    </th>
                    <th className="text-left px-4 py-3">
                      <button
                        onClick={() => toggleSort('tenant_name')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide hover:text-[hsl(215,25%,18%)] transition-colors"
                      >
                        Tenant <SortIcon field="tenant_name" />
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">
                      Lease Period
                    </th>
                    <th className="text-left px-4 py-3">
                      <button
                        onClick={() => toggleSort('actual_end_date')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide hover:text-[hsl(215,25%,18%)] transition-colors"
                      >
                        Handover Date <SortIcon field="actual_end_date" />
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">
                      Checklist
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">
                      Agent
                    </th>
                    <th className="text-left px-4 py-3">
                      <button
                        onClick={() => toggleSort('archived_at')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide hover:text-[hsl(215,25%,18%)] transition-colors"
                      >
                        Archived <SortIcon field="archived_at" />
                      </button>
                    </th>
                    <th className="px-4 py-3 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, idx) => {
                    const isExpanded = expandedId === c.id;
                    const checkCount = getChecklistCount(c);
                    return (
                      <React.Fragment key={c.id}>
                        <tr
                          className={`border-b border-[hsl(214,20%,92%)] hover:bg-[hsl(210,15%,98%)] transition-colors cursor-pointer ${
                            idx % 2 === 0 ? '' : 'bg-[hsl(210,15%,99%)]'
                          } ${isExpanded ? 'bg-[hsl(210,15%,97%)]' : ''}`}
                          onClick={() => setExpandedId(isExpanded ? null : c.id)}
                        >
                          <td className="px-4 py-3">
                            <p className="font-semibold text-[hsl(215,25%,18%)]">{c.property_address}</p>
                            <p className="text-xs text-[hsl(215,15%,52%)]">{c.property_ref}</p>
                          </td>
                          <td className="px-4 py-3 text-[hsl(215,25%,18%)]">{c.tenant_name}</td>
                          <td className="px-4 py-3 text-[hsl(215,15%,52%)] text-xs whitespace-nowrap">
                            {formatDate(c.lease_start)}
                            <span className="mx-1 text-[hsl(215,15%,70%)]">→</span>
                            {formatDate(c.lease_end)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full whitespace-nowrap">
                              <Icon name="CalendarCheckIcon" size={11} />
                              {formatDate(c.actual_end_date)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <ChecklistBadge c={c} />
                          </td>
                          <td className="px-4 py-3 text-xs text-[hsl(215,15%,52%)]">{c.agent_name ?? '—'}</td>
                          <td className="px-4 py-3 text-xs text-[hsl(215,15%,52%)] whitespace-nowrap">
                            {formatDate(c.archived_at)}
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : c.id)}
                              className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,93%)] transition-colors"
                              aria-label={isExpanded ? 'Collapse' : 'Expand details'}
                            >
                              <Icon
                                name={isExpanded ? 'ChevronUpIcon' : 'ChevronDownIcon'}
                                size={14}
                                className="text-[hsl(215,15%,52%)]"
                              />
                            </button>
                          </td>
                        </tr>

                        {/* Expanded detail row */}
                        {isExpanded && (
                          <tr className="border-b border-[hsl(214,20%,92%)] bg-[hsl(210,15%,97%)]">
                            <td colSpan={8} className="px-6 py-5">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                {/* Handover notes */}
                                <div className="md:col-span-2">
                                  <p className="text-xs font-semibold text-[hsl(215,25%,18%)] uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                    <Icon name="FileTextIcon" size={12} className="text-[#8B1A2B]" />
                                    Handover Notes
                                  </p>
                                  <div className="bg-white border border-[hsl(214,20%,88%)] rounded-xl px-4 py-3 min-h-[80px]">
                                    {c.handover_notes ? (
                                      <p className="text-sm text-[hsl(215,15%,40%)] leading-relaxed whitespace-pre-wrap">
                                        {c.handover_notes}
                                      </p>
                                    ) : (
                                      <p className="text-sm italic text-[hsl(215,15%,65%)]">No notes recorded.</p>
                                    )}
                                  </div>
                                </div>

                                {/* Details panel */}
                                <div>
                                  <p className="text-xs font-semibold text-[hsl(215,25%,18%)] uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                    <Icon name="InfoIcon" size={12} className="text-[#8B1A2B]" />
                                    Details
                                  </p>
                                  <div className="bg-white border border-[hsl(214,20%,88%)] rounded-xl px-4 py-3 space-y-2.5">
                                    {[
                                      { label: 'Monthly Rent', value: formatCurrency(c.monthly_rent) },
                                      { label: 'Landlord', value: c.landlord_name ?? '—' },
                                      { label: 'Archived On', value: formatDate(c.archived_at) },
                                    ].map((row) => (
                                      <div key={row.label} className="flex justify-between items-center text-xs">
                                        <span className="text-[hsl(215,15%,52%)]">{row.label}</span>
                                        <span className="font-semibold text-[hsl(215,25%,18%)]">{row.value}</span>
                                      </div>
                                    ))}
                                    <div className="pt-2 border-t border-[hsl(214,20%,92%)] space-y-2">
                                      <p className="text-xs font-semibold text-[hsl(215,25%,18%)] uppercase tracking-wide">
                                        Checklist
                                      </p>
                                      {[
                                        { done: c.deposit_returned, label: 'Deposit returned' },
                                        { done: c.keys_returned, label: 'Keys returned' },
                                        { done: c.utilities_settled, label: 'Utilities settled' },
                                      ].map((item) => (
                                        <div key={item.label} className="flex items-center justify-between text-xs">
                                          <span className="text-[hsl(215,15%,52%)]">{item.label}</span>
                                          <span
                                            className={`inline-flex items-center gap-1 font-semibold ${
                                              item.done ? 'text-emerald-600' : 'text-amber-600'
                                            }`}
                                          >
                                            <Icon
                                              name={item.done ? 'CheckCircleIcon' : 'AlertCircleIcon'}
                                              size={11}
                                            />
                                            {item.done ? 'Done' : 'Pending'}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
