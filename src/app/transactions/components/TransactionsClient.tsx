'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import AppLayout from '@/components/AppLayout';
import { createClient } from '@/lib/supabase/client';

// ─── Types ─────────────────────────────────────────────────────────────────────

type TransactionType = 'sale' | 'lease' | 'renewal';
type TransactionStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'fallen_through';

interface Transaction {
  id: string;
  propertyRef: string;
  propertyAddress: string | null;
  village: string | null;
  district: string | null;
  transactionType: TransactionType;
  partyName: string;
  partyPhone: string | null;
  partyEmail: string | null;
  agentName: string | null;
  amount: number | null;
  currency: string | null;
  transactionDate: string | null;
  completionDate: string | null;
  status: TransactionStatus;
  notes: string | null;
  createdAt: string;
}

// ─── Config ────────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<TransactionType, { label: string; color: string; bg: string; border: string; icon: string }> = {
  sale:    { label: 'Sale',    color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', icon: 'HomeIcon' },
  lease:   { label: 'Lease',   color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd', icon: 'KeyIcon' },
  renewal: { label: 'Renewal', color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4', icon: 'RefreshCwIcon' },
};

const STATUS_CONFIG: Record<TransactionStatus, { label: string; color: string; bg: string; border: string }> = {
  pending:        { label: 'Pending',        color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  in_progress:    { label: 'In Progress',    color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  completed:      { label: 'Completed',      color: '#059669', bg: '#f0fdf4', border: '#a7f3d0' },
  cancelled:      { label: 'Cancelled',      color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  fallen_through: { label: 'Fallen Through', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatAmount(amount: number | null, currency: string | null): string {
  if (amount == null) return '—';
  const cur = currency || 'HKD';
  if (amount >= 1_000_000) return `${cur} ${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `${cur} ${(amount / 1_000).toFixed(0)}K`;
  return `${cur} ${amount.toLocaleString()}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function TransactionsClient() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | TransactionStatus>('all');
  const [districtFilter, setDistrictFilter] = useState('all');

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: fetchErr } = await supabase
        .from('property_transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchErr) {
        setError(fetchErr.message);
        return;
      }

      const mapped: Transaction[] = (data || []).map((row: any) => ({
        id: row.id,
        propertyRef: row.property_ref,
        propertyAddress: row.property_address,
        village: row.village,
        district: row.district,
        transactionType: row.transaction_type as TransactionType,
        partyName: row.party_name,
        partyPhone: row.party_phone,
        partyEmail: row.party_email,
        agentName: row.agent_name,
        amount: row.amount != null ? Number(row.amount) : null,
        currency: row.currency,
        transactionDate: row.transaction_date,
        completionDate: row.completion_date,
        status: row.status as TransactionStatus,
        notes: row.notes,
        createdAt: row.created_at,
      }));

      setTransactions(mapped);
    } catch (err: any) {
      setError(err?.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // ─── Derived data ───────────────────────────────────────────────────────────

  const districts = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => { if (t.district) set.add(t.district); });
    return Array.from(set).sort();
  }, [transactions]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return transactions.filter((t) => {
      if (typeFilter !== 'all' && t.transactionType !== typeFilter) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (districtFilter !== 'all' && t.district !== districtFilter) return false;
      if (q) {
        const haystack = [
          t.propertyRef, t.propertyAddress, t.partyName,
          t.district, t.village, t.agentName,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, search, typeFilter, statusFilter, districtFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = transactions.length;
    const completed = transactions.filter((t) => t.status === 'completed').length;
    const inProgress = transactions.filter((t) => t.status === 'in_progress').length;
    const pending = transactions.filter((t) => t.status === 'pending').length;
    const sales = transactions.filter((t) => t.transactionType === 'sale').length;
    const leases = transactions.filter((t) => t.transactionType === 'lease').length;
    const renewals = transactions.filter((t) => t.transactionType === 'renewal').length;
    const totalValue = transactions
      .filter((t) => t.status === 'completed' && t.amount != null)
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    return { total, completed, inProgress, pending, sales, leases, renewals, totalValue };
  }, [transactions]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="flex flex-col h-full min-h-0">
        {/* Header */}
        <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-[hsl(214,20%,88%)] bg-white">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h1 className="text-xl font-bold text-[hsl(215,25%,18%)]">Property Transactions</h1>
              <p className="text-sm text-[hsl(215,15%,52%)] mt-0.5">
                All sales, leases, and renewals — searchable and filterable
              </p>
            </div>
            <button
              onClick={fetchTransactions}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[hsl(215,25%,18%)] bg-white border border-[hsl(214,20%,88%)] rounded-lg hover:bg-[hsl(210,15%,96%)] transition-colors"
            >
              <Icon name="RefreshCwIcon" size={14} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex-shrink-0 px-6 py-4 bg-[hsl(210,15%,97%)] border-b border-[hsl(214,20%,88%)]">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: 'Total', value: stats.total, color: 'text-[hsl(215,25%,18%)]' },
              { label: 'Completed', value: stats.completed, color: 'text-[#059669]' },
              { label: 'In Progress', value: stats.inProgress, color: 'text-[#2563eb]' },
              { label: 'Pending', value: stats.pending, color: 'text-[#d97706]' },
              { label: 'Sales', value: stats.sales, color: 'text-[#7c3aed]' },
              { label: 'Leases', value: stats.leases, color: 'text-[#0369a1]' },
              { label: 'Renewals', value: stats.renewals, color: 'text-[#0d9488]' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-lg border border-[hsl(214,20%,88%)] px-3 py-2.5 text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex-shrink-0 px-6 py-3 bg-white border-b border-[hsl(214,20%,88%)]">
          <div className="flex flex-wrap gap-2 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Icon name="SearchIcon" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(215,15%,52%)]" />
              <input
                type="text"
                placeholder="Search property, party, district…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-[hsl(214,20%,88%)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B]"
              />
            </div>

            {/* Type filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="px-3 py-1.5 text-sm border border-[hsl(214,20%,88%)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 bg-white"
            >
              <option value="all">All Types</option>
              <option value="sale">Sale</option>
              <option value="lease">Lease</option>
              <option value="renewal">Renewal</option>
            </select>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 text-sm border border-[hsl(214,20%,88%)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="fallen_through">Fallen Through</option>
            </select>

            {/* District filter */}
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-[hsl(214,20%,88%)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 bg-white"
            >
              <option value="all">All Districts</option>
              {districts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            {/* Result count */}
            <span className="text-xs text-[hsl(215,15%,52%)] ml-auto">
              {filtered.length} of {transactions.length} transactions
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="flex items-center gap-2 text-[hsl(215,15%,52%)]">
                <Icon name="LoaderIcon" size={18} className="animate-spin" />
                <span className="text-sm">Loading transactions…</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <Icon name="AlertCircleIcon" size={32} className="text-[#dc2626]" />
              <p className="text-sm text-[#dc2626]">{error}</p>
              <button
                onClick={fetchTransactions}
                className="px-4 py-2 text-sm font-medium text-white bg-[#8B1A2B] rounded-lg hover:bg-[#7a1726] transition-colors"
              >
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <Icon name="InboxIcon" size={32} className="text-[hsl(215,15%,72%)]" />
              <p className="text-sm text-[hsl(215,15%,52%)]">No transactions match your filters</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[hsl(210,15%,97%)] border-b border-[hsl(214,20%,88%)] z-10">
                <tr>
                  {['Property', 'Type', 'Party (Buyer/Tenant)', 'Amount', 'Transaction Date', 'Completion Date', 'Status', 'Agent', 'Notes'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(214,20%,92%)]">
                {filtered.map((t) => {
                  const typeCfg = TYPE_CONFIG[t.transactionType];
                  const statusCfg = STATUS_CONFIG[t.status];
                  return (
                    <tr key={t.id} className="hover:bg-[hsl(210,15%,98%)] transition-colors">
                      {/* Property */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-semibold text-[hsl(215,25%,18%)]">{t.propertyRef}</p>
                        {t.propertyAddress && (
                          <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5 max-w-[180px] truncate">{t.propertyAddress}</p>
                        )}
                        {t.district && (
                          <p className="text-xs text-[hsl(215,15%,62%)]">{t.district}</p>
                        )}
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border"
                          style={{ color: typeCfg.color, background: typeCfg.bg, borderColor: typeCfg.border }}
                        >
                          <Icon name={typeCfg.icon as any} size={10} />
                          {typeCfg.label}
                        </span>
                      </td>

                      {/* Party */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-[hsl(215,25%,18%)]">{t.partyName}</p>
                        {t.partyPhone && (
                          <p className="text-xs text-[hsl(215,15%,52%)]">{t.partyPhone}</p>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3 whitespace-nowrap font-semibold text-[hsl(215,25%,18%)]">
                        {formatAmount(t.amount, t.currency)}
                      </td>

                      {/* Transaction Date */}
                      <td className="px-4 py-3 whitespace-nowrap text-[hsl(215,15%,40%)]">
                        {formatDate(t.transactionDate)}
                      </td>

                      {/* Completion Date */}
                      <td className="px-4 py-3 whitespace-nowrap text-[hsl(215,15%,40%)]">
                        {formatDate(t.completionDate)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border"
                          style={{ color: statusCfg.color, background: statusCfg.bg, borderColor: statusCfg.border }}
                        >
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* Agent */}
                      <td className="px-4 py-3 whitespace-nowrap text-[hsl(215,15%,40%)] text-xs">
                        {t.agentName || '—'}
                      </td>

                      {/* Notes */}
                      <td className="px-4 py-3 max-w-[200px]">
                        {t.notes ? (
                          <p className="text-xs text-[hsl(215,15%,52%)] truncate" title={t.notes}>{t.notes}</p>
                        ) : (
                          <span className="text-xs text-[hsl(215,15%,72%)]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
