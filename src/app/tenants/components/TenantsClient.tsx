'use client';

import React, { useState, useMemo } from 'react';
import Icon from '@/components/ui/AppIcon';
import AppLayout from '@/components/AppLayout';
import { mockProperties, Property } from '@/app/property-management/components/mockData';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TenantRow {
  id: string;
  tenantName: string;
  tenantPhone: string;
  tenantEmail: string;
  unit: string;
  building: string;
  village: string;
  bedrooms: number | null;
  monthlyRent: number | null;
  leaseStart: string;
  leaseEnd: string;
  deposit: number;
  stampDutyPaid: boolean;
  cr109Filed: boolean;
  occupancyStatus: string;
  daysUntilExpiry: number | null;
  leaseStatus: 'active' | 'expiring-soon' | 'expired' | 'pending';
  agent: string;
  property: Property;
}

function calcDaysUntilExpiry(leaseEnd: string): number | null {
  if (!leaseEnd || leaseEnd === '—') return null;
  try {
    const parts = leaseEnd.split('/');
    if (parts.length !== 3) return null;
    const [d, m, y] = parts.map(Number);
    const end = new Date(y, m - 1, d);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

function getLeaseStatus(days: number | null): TenantRow['leaseStatus'] {
  if (days === null) return 'pending';
  if (days < 0) return 'expired';
  if (days <= 90) return 'expiring-soon';
  return 'active';
}

function buildTenantRows(properties: Property[]): TenantRow[] {
  return properties
    .filter((p) => p.tenant !== null)
    .map((p) => {
      const t = p.tenant!;
      const days = calcDaysUntilExpiry(t.leaseEnd);
      return {
        id: p.id,
        tenantName: t.name || 'Unknown',
        tenantPhone: t.phone || '—',
        tenantEmail: t.email || '—',
        unit: p.unit,
        building: p.building,
        village: p.village || '—',
        bedrooms: p.bedrooms,
        monthlyRent: p.monthlyRent,
        leaseStart: t.leaseStart || '—',
        leaseEnd: t.leaseEnd || '—',
        deposit: t.deposit || 0,
        stampDutyPaid: t.stampDutyPaid,
        cr109Filed: t.cr109Filed,
        occupancyStatus: p.occupancyStatus,
        daysUntilExpiry: days,
        leaseStatus: getLeaseStatus(days),
        agent: p.updatedBy || 'Unassigned',
        property: p,
      };
    });
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function LeaseStatusBadge({ status, days }: { status: TenantRow['leaseStatus']; days: number | null }) {
  const configs = {
    active: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Active' },
    'expiring-soon': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Expiring Soon' },
    expired: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Expired' },
    pending: { bg: 'bg-[hsl(214,20%,94%)]', text: 'text-[hsl(215,15%,45%)]', border: 'border-[hsl(214,20%,85%)]', label: 'Pending' },
  };
  const cfg = configs[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'active' ? 'bg-emerald-500' : status === 'expiring-soon' ? 'bg-amber-500' : status === 'expired' ? 'bg-red-500' : 'bg-gray-400'}`} />
      {cfg.label}
      {days !== null && status === 'expiring-soon' && <span className="ml-0.5 opacity-75">({days}d)</span>}
    </span>
  );
}

function ComplianceDot({ done, label }: { done: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${done ? 'text-emerald-600' : 'text-[hsl(215,15%,52%)]'}`}>
      <Icon name={done ? 'CheckCircleIcon' : 'CircleIcon'} size={13} className={done ? 'text-emerald-500' : 'text-[hsl(215,15%,65%)]'} />
      {label}
    </span>
  );
}

// ─── Tenant Detail Panel ───────────────────────────────────────────────────────

function TenantDetailPanel({ row, onClose }: { row: TenantRow; onClose: () => void }) {
  const rentFormatted = row.monthlyRent ? `HK$${row.monthlyRent.toLocaleString()}` : '—';
  const depositFormatted = row.deposit ? `HK$${row.deposit.toLocaleString()}` : '—';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-[hsl(214,20%,90%)]">
          <div>
            <h2 className="text-lg font-bold text-[hsl(215,25%,18%)]">{row.tenantName}</h2>
            <p className="text-sm text-[hsl(215,15%,52%)] mt-0.5">{row.unit}, {row.building}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors"
          >
            <Icon name="XIcon" size={18} className="text-[hsl(215,15%,52%)]" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Lease Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[hsl(215,25%,18%)]">Lease Status</span>
            <LeaseStatusBadge status={row.leaseStatus} days={row.daysUntilExpiry} />
          </div>

          {/* Contact */}
          <div>
            <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-2">Contact Details</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <Icon name="PhoneIcon" size={14} className="text-[hsl(215,15%,52%)]" />
                <span className="text-sm text-[hsl(215,25%,18%)]">{row.tenantPhone}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Icon name="MailIcon" size={14} className="text-[hsl(215,15%,52%)]" />
                <span className="text-sm text-[hsl(215,25%,18%)]">{row.tenantEmail}</span>
              </div>
            </div>
          </div>

          {/* Property */}
          <div>
            <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-2">Property</p>
            <div className="bg-[hsl(210,15%,97%)] rounded-xl p-3.5 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-[hsl(215,15%,52%)]">Unit</span>
                <span className="font-medium text-[hsl(215,25%,18%)]">{row.unit}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[hsl(215,15%,52%)]">Building</span>
                <span className="font-medium text-[hsl(215,25%,18%)]">{row.building}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[hsl(215,15%,52%)]">Village</span>
                <span className="font-medium text-[hsl(215,25%,18%)]">{row.village}</span>
              </div>
              {row.bedrooms !== null && (
                <div className="flex justify-between text-sm">
                  <span className="text-[hsl(215,15%,52%)]">Bedrooms</span>
                  <span className="font-medium text-[hsl(215,25%,18%)]">{row.bedrooms} BR</span>
                </div>
              )}
            </div>
          </div>

          {/* Lease Terms */}
          <div>
            <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-2">Lease Terms</p>
            <div className="bg-[hsl(210,15%,97%)] rounded-xl p-3.5 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-[hsl(215,15%,52%)]">Start Date</span>
                <span className="font-medium text-[hsl(215,25%,18%)]">{row.leaseStart}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[hsl(215,15%,52%)]">End Date</span>
                <span className={`font-medium ${row.leaseStatus === 'expired' ? 'text-red-600' : row.leaseStatus === 'expiring-soon' ? 'text-amber-600' : 'text-[hsl(215,25%,18%)]'}`}>{row.leaseEnd}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[hsl(215,15%,52%)]">Monthly Rent</span>
                <span className="font-semibold text-[hsl(215,25%,18%)]">{rentFormatted}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[hsl(215,15%,52%)]">Deposit</span>
                <span className="font-medium text-[hsl(215,25%,18%)]">{depositFormatted}</span>
              </div>
            </div>
          </div>

          {/* Compliance */}
          <div>
            <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-2">Compliance</p>
            <div className="flex gap-4">
              <ComplianceDot done={row.stampDutyPaid} label="Stamp Duty" />
              <ComplianceDot done={row.cr109Filed} label="CR109" />
            </div>
          </div>

          {/* Agent */}
          <div className="flex items-center justify-between pt-1 border-t border-[hsl(214,20%,90%)]">
            <span className="text-xs text-[hsl(215,15%,52%)]">Assigned Agent</span>
            <span className="text-sm font-medium text-[hsl(215,25%,18%)]">{row.agent}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

type LeaseFilter = 'all' | 'active' | 'expiring-soon' | 'expired' | 'pending';
type SortKey = 'name' | 'leaseEnd' | 'rent' | 'building';

export default function TenantsClient() {
  const [search, setSearch] = useState('');
  const [leaseFilter, setLeaseFilter] = useState<LeaseFilter>('all');
  const [villageFilter, setVillageFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedTenant, setSelectedTenant] = useState<TenantRow | null>(null);

  const allRows = useMemo(() => buildTenantRows(mockProperties), []);

  const villages = useMemo(() => {
    const set = new Set(allRows.map((r) => r.village).filter((v) => v !== '—'));
    return ['all', ...Array.from(set).sort()];
  }, [allRows]);

  const filtered = useMemo(() => {
    let list = [...allRows];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.tenantName.toLowerCase().includes(q) ||
          r.unit.toLowerCase().includes(q) ||
          r.building.toLowerCase().includes(q) ||
          r.village.toLowerCase().includes(q) ||
          r.tenantPhone.toLowerCase().includes(q) ||
          r.tenantEmail.toLowerCase().includes(q) ||
          r.agent.toLowerCase().includes(q)
      );
    }

    if (leaseFilter !== 'all') {
      list = list.filter((r) => r.leaseStatus === leaseFilter);
    }

    if (villageFilter !== 'all') {
      list = list.filter((r) => r.village === villageFilter);
    }

    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.tenantName.localeCompare(b.tenantName);
      else if (sortKey === 'leaseEnd') cmp = (a.leaseEnd || '').localeCompare(b.leaseEnd || '');
      else if (sortKey === 'rent') cmp = (a.monthlyRent ?? 0) - (b.monthlyRent ?? 0);
      else if (sortKey === 'building') cmp = a.building.localeCompare(b.building);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [allRows, search, leaseFilter, villageFilter, sortKey, sortDir]);

  const stats = useMemo(() => ({
    total: allRows.length,
    active: allRows.filter((r) => r.leaseStatus === 'active').length,
    expiringSoon: allRows.filter((r) => r.leaseStatus === 'expiring-soon').length,
    expired: allRows.filter((r) => r.leaseStatus === 'expired').length,
  }), [allRows]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <Icon name="ChevronsUpDownIcon" size={13} className="text-[hsl(215,15%,65%)]" />;
    return <Icon name={sortDir === 'asc' ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={13} className="text-[#8B1A2B]" />;
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-[hsl(210,15%,97%)]">
        {/* Page Header */}
        <div className="bg-white border-b border-[hsl(214,20%,88%)] px-6 py-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-[hsl(215,25%,18%)]">Tenants</h1>
              <p className="text-sm text-[hsl(215,15%,52%)] mt-0.5">All tenants across properties — lease terms, status &amp; compliance</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-[hsl(215,15%,52%)]">
              <Icon name="UsersIcon" size={15} />
              <span>{allRows.length} tenants total</span>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {[
              { label: 'Total Tenants', value: stats.total, icon: 'UsersIcon', color: 'text-[hsl(215,25%,18%)]', bg: 'bg-[hsl(210,15%,94%)]' },
              { label: 'Active Leases', value: stats.active, icon: 'CheckCircleIcon', color: 'text-emerald-700', bg: 'bg-emerald-50' },
              { label: 'Expiring Soon', value: stats.expiringSoon, icon: 'ClockIcon', color: 'text-amber-700', bg: 'bg-amber-50' },
              { label: 'Expired', value: stats.expired, icon: 'AlertCircleIcon', color: 'text-red-700', bg: 'bg-red-50' },
            ].map((s) => (
              <div key={s.label} className={`${s.bg} rounded-xl px-4 py-3 flex items-center gap-3`}>
                <Icon name={s.icon as Parameters<typeof Icon>[0]['name']} size={18} className={s.color} />
                <div>
                  <p className={`text-xl font-bold leading-none ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border-b border-[hsl(214,20%,88%)] px-6 py-3 flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Icon name="SearchIcon" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(215,15%,52%)]" />
            <input
              type="text"
              placeholder="Search tenant, unit, building…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-[hsl(210,15%,97%)] text-[hsl(215,25%,18%)] placeholder-[hsl(215,15%,65%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B]/40"
            />
          </div>

          {/* Lease Status Filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['all', 'active', 'expiring-soon', 'expired', 'pending'] as LeaseFilter[]).map((f) => {
              const labels: Record<LeaseFilter, string> = { all: 'All', active: 'Active', 'expiring-soon': 'Expiring Soon', expired: 'Expired', pending: 'Pending' };
              const active = leaseFilter === f;
              return (
                <button
                  key={f}
                  onClick={() => setLeaseFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-[#8B1A2B] text-white'
                      : 'bg-[hsl(210,15%,94%)] text-[hsl(215,15%,45%)] hover:bg-[hsl(210,15%,90%)]'
                  }`}
                >
                  {labels[f]}
                </button>
              );
            })}
          </div>

          {/* Village Filter */}
          <select
            value={villageFilter}
            onChange={(e) => setVillageFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20"
          >
            {villages.map((v) => (
              <option key={v} value={v}>{v === 'all' ? 'All Villages' : v}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Icon name="UsersIcon" size={40} className="text-[hsl(215,15%,75%)] mb-3" />
              <p className="text-base font-semibold text-[hsl(215,25%,18%)]">No tenants found</p>
              <p className="text-sm text-[hsl(215,15%,52%)] mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[hsl(214,20%,88%)] bg-[hsl(210,15%,97%)]">
                      <th className="text-left px-4 py-3 font-semibold text-[hsl(215,15%,45%)] text-xs uppercase tracking-wide">
                        <button className="flex items-center gap-1 hover:text-[hsl(215,25%,18%)] transition-colors" onClick={() => toggleSort('name')}>
                          Tenant <SortIcon col="name" />
                        </button>
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-[hsl(215,15%,45%)] text-xs uppercase tracking-wide">
                        <button className="flex items-center gap-1 hover:text-[hsl(215,25%,18%)] transition-colors" onClick={() => toggleSort('building')}>
                          Property <SortIcon col="building" />
                        </button>
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-[hsl(215,15%,45%)] text-xs uppercase tracking-wide hidden md:table-cell">
                        Lease Period
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-[hsl(215,15%,45%)] text-xs uppercase tracking-wide">
                        <button className="flex items-center gap-1 hover:text-[hsl(215,25%,18%)] transition-colors" onClick={() => toggleSort('leaseEnd')}>
                          Expiry <SortIcon col="leaseEnd" />
                        </button>
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-[hsl(215,15%,45%)] text-xs uppercase tracking-wide">
                        Status
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-[hsl(215,15%,45%)] text-xs uppercase tracking-wide hidden lg:table-cell">
                        <button className="flex items-center gap-1 hover:text-[hsl(215,25%,18%)] transition-colors" onClick={() => toggleSort('rent')}>
                          Rent <SortIcon col="rent" />
                        </button>
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-[hsl(215,15%,45%)] text-xs uppercase tracking-wide hidden xl:table-cell">
                        Compliance
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-[hsl(215,15%,45%)] text-xs uppercase tracking-wide hidden lg:table-cell">
                        Agent
                      </th>
                      <th className="px-4 py-3 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[hsl(214,20%,92%)]">
                    {filtered.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-[hsl(210,15%,98%)] transition-colors cursor-pointer"
                        onClick={() => setSelectedTenant(row)}
                      >
                        {/* Tenant */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#8B1A2B]/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-[#8B1A2B]">
                                {row.tenantName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-[hsl(215,25%,18%)] truncate">{row.tenantName}</p>
                              <p className="text-xs text-[hsl(215,15%,52%)] truncate">{row.tenantPhone}</p>
                            </div>
                          </div>
                        </td>

                        {/* Property */}
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-[hsl(215,25%,18%)] truncate">{row.unit}</p>
                          <p className="text-xs text-[hsl(215,15%,52%)] truncate">{row.building}{row.village !== '—' ? ` · ${row.village}` : ''}</p>
                        </td>

                        {/* Lease Period */}
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          <p className="text-[hsl(215,25%,18%)]">{row.leaseStart}</p>
                          <p className="text-xs text-[hsl(215,15%,52%)]">to {row.leaseEnd}</p>
                        </td>

                        {/* Expiry */}
                        <td className="px-4 py-3.5">
                          <p className={`font-medium ${row.leaseStatus === 'expired' ? 'text-red-600' : row.leaseStatus === 'expiring-soon' ? 'text-amber-600' : 'text-[hsl(215,25%,18%)]'}`}>
                            {row.leaseEnd}
                          </p>
                          {row.daysUntilExpiry !== null && (
                            <p className="text-xs text-[hsl(215,15%,52%)]">
                              {row.daysUntilExpiry < 0
                                ? `${Math.abs(row.daysUntilExpiry)}d ago`
                                : `${row.daysUntilExpiry}d left`}
                            </p>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          <LeaseStatusBadge status={row.leaseStatus} days={row.daysUntilExpiry} />
                        </td>

                        {/* Rent */}
                        <td className="px-4 py-3.5 hidden lg:table-cell">
                          <p className="font-semibold text-[hsl(215,25%,18%)]">
                            {row.monthlyRent ? `HK$${row.monthlyRent.toLocaleString()}` : '—'}
                          </p>
                          {row.deposit > 0 && (
                            <p className="text-xs text-[hsl(215,15%,52%)]">Dep: HK${row.deposit.toLocaleString()}</p>
                          )}
                        </td>

                        {/* Compliance */}
                        <td className="px-4 py-3.5 hidden xl:table-cell">
                          <div className="flex flex-col gap-1">
                            <ComplianceDot done={row.stampDutyPaid} label="Stamp Duty" />
                            <ComplianceDot done={row.cr109Filed} label="CR109" />
                          </div>
                        </td>

                        {/* Agent */}
                        <td className="px-4 py-3.5 hidden lg:table-cell">
                          <p className="text-sm text-[hsl(215,25%,18%)] truncate max-w-[120px]">{row.agent}</p>
                        </td>

                        {/* Action */}
                        <td className="px-4 py-3.5">
                          <Icon name="ChevronRightIcon" size={15} className="text-[hsl(215,15%,65%)]" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-[hsl(214,20%,88%)] bg-[hsl(210,15%,97%)] flex items-center justify-between">
                <p className="text-xs text-[hsl(215,15%,52%)]">
                  Showing <span className="font-semibold text-[hsl(215,25%,18%)]">{filtered.length}</span> of <span className="font-semibold text-[hsl(215,25%,18%)]">{allRows.length}</span> tenants
                </p>
                {leaseFilter !== 'all' || villageFilter !== 'all' || search ? (
                  <button
                    onClick={() => { setSearch(''); setLeaseFilter('all'); setVillageFilter('all'); }}
                    className="text-xs text-[#8B1A2B] font-semibold hover:underline"
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      {selectedTenant && (
        <TenantDetailPanel row={selectedTenant} onClose={() => setSelectedTenant(null)} />
      )}
    </AppLayout>
  );
}
