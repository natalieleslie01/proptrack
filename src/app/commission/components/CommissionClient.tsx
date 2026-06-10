'use client';

import React, { useState, useMemo } from 'react';
import Icon from '@/components/ui/AppIcon';
import AppLayout from '@/components/AppLayout';
import { agentNames, mockProperties } from '@/app/property-management/components/mockData';
import { toast } from 'sonner';
import { useRole } from '@/hooks/useRole';

interface CommissionEntry {
  id: string;
  agentName: string;
  propertyRef: string;
  propertyAddress: string;
  tenantName: string;
  commissionType: string;
  amount: number;
  monthYear: string;
  notes: string;
  paid: boolean;
}

const COMMISSION_TYPES = [
  { value: 'new_listing', label: 'New Listing', rate: 2.5 },
  { value: 'eaa_form', label: 'EAA Form 3/5', rate: 2.5 },
  { value: 'new_photos', label: 'New Photos', rate: 3 },
  { value: 'new_matterport', label: 'New Matterport', rate: 3.5 },
  { value: 'new_key', label: 'New Key', rate: 3.5 },
  { value: 'new_telephone', label: 'New Telephone', rate: 5 },
  { value: 'tenancy_signed', label: 'Tenancy Signed' },
  { value: 'renewal', label: 'Renewal' },
  { value: 'sale', label: 'Sale' },
];

function buildMockCommissions(): CommissionEntry[] {
  const months = ['2026-03', '2026-04', '2026-05'];
  const entries: CommissionEntry[] = [];
  let idx = 0;
  mockProperties.slice(0, 15).forEach((p) => {
    const agent = agentNames[idx % agentNames.length];
    const month = months[idx % months.length];
    const types = COMMISSION_TYPES.slice(0, 3 + (idx % 3));
    types.forEach((t) => {
      entries.push({
        id: `c-${idx++}`,
        agentName: agent,
        propertyRef: p.id.slice(0, 8),
        propertyAddress: `${p.unit}, ${p.building}`,
        tenantName: p.tenant?.name ?? 'N/A',
        commissionType: t.value,
        amount: [2000, 1500, 3000, 1000, 8000, 5000, 25000][idx % 7],
        monthYear: month,
        notes: '',
        paid: idx % 3 !== 0,
      });
    });
  });
  return entries;
}

export default function CommissionClient() {
  const [commissions, setCommissions] = useState<CommissionEntry[]>(buildMockCommissions);
  const [filterAgent, setFilterAgent] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const { isAdminOrManager } = useRole();
  const [newEntry, setNewEntry] = useState<Partial<CommissionEntry>>({
    agentName: agentNames[0], commissionType: 'tenancy_signed', paid: false, notes: '',
    monthYear: new Date().toISOString().slice(0, 7),
  });

  const months = useMemo(() => {
    const set = new Set(commissions.map((c) => c.monthYear));
    return Array.from(set).sort().reverse();
  }, [commissions]);

  const filtered = useMemo(() => {
    return commissions.filter((c) => {
      if (filterAgent !== 'all' && c.agentName !== filterAgent) return false;
      if (filterMonth !== 'all' && c.monthYear !== filterMonth) return false;
      return true;
    });
  }, [commissions, filterAgent, filterMonth]);

  // Monthly summary per agent
  const monthlySummary = useMemo(() => {
    const map: Record<string, Record<string, { total: number; paid: number; count: number }>> = {};
    commissions.forEach((c) => {
      if (!map[c.monthYear]) map[c.monthYear] = {};
      if (!map[c.monthYear][c.agentName]) map[c.monthYear][c.agentName] = { total: 0, paid: 0, count: 0 };
      map[c.monthYear][c.agentName].total += c.amount;
      if (c.paid) map[c.monthYear][c.agentName].paid += c.amount;
      map[c.monthYear][c.agentName].count++;
    });
    return map;
  }, [commissions]);

  const currentMonthSummary = monthlySummary[filterMonth !== 'all' ? filterMonth : months[0]] ?? {};

  function togglePaid(id: string) {
    setCommissions((prev) => prev.map((c) => c.id === id ? { ...c, paid: !c.paid } : c));
    toast.success('Payment status updated');
  }

  function addCommission() {
    if (!newEntry.propertyRef || !newEntry.amount || !newEntry.agentName) {
      toast.error('Please fill in all required fields');
      return;
    }
    const entry: CommissionEntry = {
      id: `c-${Date.now()}`,
      agentName: newEntry.agentName!,
      propertyRef: newEntry.propertyRef!,
      propertyAddress: newEntry.propertyAddress ?? newEntry.propertyRef!,
      tenantName: newEntry.tenantName ?? 'N/A',
      commissionType: newEntry.commissionType ?? 'tenancy_signed',
      amount: Number(newEntry.amount),
      monthYear: newEntry.monthYear ?? new Date().toISOString().slice(0, 7),
      notes: newEntry.notes ?? '',
      paid: false,
    };
    setCommissions((prev) => [entry, ...prev]);
    setShowAddModal(false);
    setNewEntry({ agentName: agentNames[0], commissionType: 'tenancy_signed', paid: false, notes: '', monthYear: new Date().toISOString().slice(0, 7) });
    toast.success('Commission entry added');
  }

  const totalFiltered = filtered.reduce((s, c) => s + c.amount, 0);
  const totalPaid = filtered.filter((c) => c.paid).reduce((s, c) => s + c.amount, 0);

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[hsl(215,25%,18%)]">Commission Tracking</h1>
            <p className="text-sm text-[hsl(215,15%,52%)] mt-0.5">Agent commissions per tenancy with monthly summaries</p>
          </div>
          <button
            onClick={() => isAdminOrManager ? setShowAddModal(true) : toast.error('Managers and Admins can add commission entries')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${isAdminOrManager ? 'bg-[#8B1A2B] text-white hover:bg-[#6d1522]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
          >
            <Icon name="PlusIcon" size={16} />
            Add Commission
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <select
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            className="border border-[hsl(214,20%,88%)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30 bg-white"
          >
            <option value="all">All Agents</option>
            {agentNames.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="border border-[hsl(214,20%,88%)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30 bg-white"
          >
            <option value="all">All Months</option>
            {months.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[hsl(210,20%,97%)] rounded-xl p-4">
            <p className="text-2xl font-bold text-[hsl(215,25%,18%)]">HK${totalFiltered.toLocaleString()}</p>
            <p className="text-xs text-[hsl(215,15%,52%)] mt-1">Total Commission</p>
          </div>
          <div className="bg-green-50 rounded-xl p-4">
            <p className="text-2xl font-bold text-green-600">HK${totalPaid.toLocaleString()}</p>
            <p className="text-xs text-[hsl(215,15%,52%)] mt-1">Paid Out</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-4">
            <p className="text-2xl font-bold text-orange-600">HK${(totalFiltered - totalPaid).toLocaleString()}</p>
            <p className="text-xs text-[hsl(215,15%,52%)] mt-1">Outstanding</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-2xl font-bold text-blue-600">{filtered.length}</p>
            <p className="text-xs text-[hsl(215,15%,52%)] mt-1">Entries</p>
          </div>
        </div>

        {/* Agent Commission Rates */}
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[hsl(214,20%,88%)]">
            <h2 className="font-semibold text-[hsl(215,25%,18%)] text-sm">Agent Commission Rates</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 divide-x divide-y divide-[hsl(214,20%,88%)]">
            {COMMISSION_TYPES.filter((t) => t.rate !== undefined).map((t) => (
              <div key={t.value} className="px-4 py-3 text-center">
                <p className="text-lg font-bold text-[#1B4F8A]">{t.rate}%</p>
                <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">{t.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Agent Summary */}
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[hsl(214,20%,88%)]">
            <h2 className="font-semibold text-[hsl(215,25%,18%)] text-sm">
              Monthly Summary — {filterMonth !== 'all' ? filterMonth : months[0]}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[hsl(210,20%,97%)] border-b border-[hsl(214,20%,88%)]">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Agent</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Entries</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Total</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Paid</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide hidden sm:table-cell">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(214,20%,88%)]">
                {Object.entries(currentMonthSummary).map(([agent, data]) => (
                  <tr key={agent} className="hover:bg-[hsl(210,20%,97%)]">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#1B4F8A] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {agent.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </div>
                        <span className="font-medium text-[hsl(215,25%,18%)]">{agent}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-[hsl(215,15%,52%)]">{data.count}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-[hsl(215,25%,18%)]">HK${data.total.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-green-600 font-medium">HK${data.paid.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-orange-600 font-medium hidden sm:table-cell">HK${(data.total - data.paid).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[hsl(214,20%,88%)]">
            <h2 className="font-semibold text-[hsl(215,25%,18%)] text-sm">Commission Entries ({filtered.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[hsl(210,20%,97%)] border-b border-[hsl(214,20%,88%)]">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Agent</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide hidden sm:table-cell">Property</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide hidden md:table-cell">Type</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide hidden lg:table-cell">Month</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Amount</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(214,20%,88%)]">
                {filtered.slice(0, 50).map((c) => (
                  <tr key={c.id} className="hover:bg-[hsl(210,20%,97%)]">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-[hsl(215,25%,18%)] text-xs">{c.agentName}</p>
                    </td>
                    <td className="px-4 py-2.5 hidden sm:table-cell">
                      <p className="text-xs text-[hsl(215,25%,18%)] truncate max-w-[140px]">{c.propertyAddress}</p>
                      <p className="text-xs text-[hsl(215,15%,52%)]">{c.tenantName}</p>
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[hsl(210,20%,97%)] text-[hsl(215,15%,52%)]">
                        {COMMISSION_TYPES.find((t) => t.value === c.commissionType)?.label ?? c.commissionType}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 hidden lg:table-cell text-xs text-[hsl(215,15%,52%)]">{c.monthYear}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-[hsl(215,25%,18%)] text-xs">HK${c.amount.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => isAdminOrManager ? togglePaid(c.id) : toast.error('Managers and Admins can update payment status')}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-colors ${
                          c.paid ? 'bg-green-500 border-green-500' : isAdminOrManager ? 'border-[hsl(214,20%,88%)] hover:border-green-400' : 'border-gray-200 cursor-not-allowed'
                        }`}
                      >
                        {c.paid && <Icon name="CheckIcon" size={12} className="text-white" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-[hsl(214,20%,88%)]">
              <h2 className="font-bold text-[hsl(215,25%,18%)]">Add Commission Entry</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 rounded-lg hover:bg-[hsl(210,15%,94%)]">
                <Icon name="XIcon" size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] mb-1.5">Agent *</label>
                  <select
                    value={newEntry.agentName}
                    onChange={(e) => setNewEntry((p) => ({ ...p, agentName: e.target.value }))}
                    className="w-full border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
                  >
                    {agentNames.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] mb-1.5">Month *</label>
                  <input
                    type="month"
                    value={newEntry.monthYear}
                    onChange={(e) => setNewEntry((p) => ({ ...p, monthYear: e.target.value }))}
                    className="w-full border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] mb-1.5">Property Ref *</label>
                <input
                  value={newEntry.propertyRef ?? ''}
                  onChange={(e) => setNewEntry((p) => ({ ...p, propertyRef: e.target.value }))}
                  placeholder="e.g. DB-001"
                  className="w-full border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] mb-1.5">Commission Type</label>
                  <select
                    value={newEntry.commissionType}
                    onChange={(e) => setNewEntry((p) => ({ ...p, commissionType: e.target.value }))}
                    className="w-full border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
                  >
                    {COMMISSION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] mb-1.5">Amount (HKD) *</label>
                  <input
                    type="number"
                    value={newEntry.amount ?? ''}
                    onChange={(e) => setNewEntry((p) => ({ ...p, amount: Number(e.target.value) }))}
                    placeholder="e.g. 5000"
                    className="w-full border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] mb-1.5">Notes</label>
                <input
                  value={newEntry.notes ?? ''}
                  onChange={(e) => setNewEntry((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Optional notes"
                  className="w-full border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
                />
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-[hsl(214,20%,88%)]">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2 rounded-lg border border-[hsl(214,20%,88%)] text-sm font-semibold hover:bg-[hsl(210,15%,94%)]">
                Cancel
              </button>
              <button onClick={addCommission} className="flex-1 py-2 rounded-lg bg-[#8B1A2B] text-white text-sm font-semibold hover:bg-[#6d1522] transition-colors">
                Add Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
