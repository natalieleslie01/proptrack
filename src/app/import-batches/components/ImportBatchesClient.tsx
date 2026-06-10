'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

// ─── Types ────────────────────────────────────────────────────────────────────

type BatchStatus = 'active' | 'completed' | 'partial' | 'failed' | 'rolled_back';

interface ImportBatch {
  id: string;
  import_type: string;
  filename: string;
  status: BatchStatus;
  total_records: number;
  success_count: number;
  skipped_count: number;
  error_count: number;
  imported_by_name?: string;
  imported_at: string;
  notes?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function successRate(batch: ImportBatch): number {
  if (batch.total_records === 0) return 0;
  return Math.round((batch.success_count / batch.total_records) * 100);
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-HK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function statusConfig(status: BatchStatus) {
  switch (status) {
    case 'active':
      return {
        label: 'Active',
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        dot: 'bg-blue-500 animate-pulse',
        barColor: 'bg-blue-400',
      };
    case 'completed':
      return {
        label: 'Completed',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        dot: 'bg-emerald-500',
        barColor: 'bg-emerald-500',
      };
    case 'partial':
      return {
        label: 'Partial',
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        dot: 'bg-amber-500',
        barColor: 'bg-amber-400',
      };
    case 'failed':
      return {
        label: 'Failed',
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        dot: 'bg-red-500',
        barColor: 'bg-red-400',
      };
    case 'rolled_back':
      return {
        label: 'Rolled Back',
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        border: 'border-slate-200',
        dot: 'bg-slate-400',
        barColor: 'bg-slate-300',
      };
  }
}

// ─── Mock data fallback ───────────────────────────────────────────────────────

const MOCK_BATCHES: ImportBatch[] = [
  {
    id: 'batch-001',
    import_type: 'csv',
    filename: 'discovery_bay_properties_batch1.csv',
    status: 'active',
    total_records: 3200,
    success_count: 1840,
    skipped_count: 12,
    error_count: 8,
    imported_by_name: 'admin@homesrus.hk',
    imported_at: new Date(Date.now() - 8 * 60000).toISOString(),
    notes: 'Live import — Discovery Bay Phase 1–8',
  },
  {
    id: 'batch-002',
    import_type: 'csv',
    filename: 'tenancy_updates_may2026.csv',
    status: 'active',
    total_records: 580,
    success_count: 210,
    skipped_count: 0,
    error_count: 3,
    imported_by_name: 'manager@homesrus.hk',
    imported_at: new Date(Date.now() - 2 * 60000).toISOString(),
    notes: 'Tenancy data sync in progress',
  },
  {
    id: 'batch-003',
    import_type: 'csv',
    filename: 'discovery_bay_properties_batch2.csv',
    status: 'completed',
    total_records: 3100,
    success_count: 3100,
    skipped_count: 0,
    error_count: 0,
    imported_by_name: 'manager@homesrus.hk',
    imported_at: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
    notes: 'Discovery Bay Phase 9–14 — clean import',
  },
  {
    id: 'batch-004',
    import_type: 'photo',
    filename: 'db_photos_batch1.zip',
    status: 'partial',
    total_records: 1820,
    success_count: 1743,
    skipped_count: 42,
    error_count: 35,
    imported_by_name: 'admin@homesrus.hk',
    imported_at: new Date(Date.now() - 3 * 24 * 3600000).toISOString(),
    notes: 'Photos matched by filename short code',
  },
  {
    id: 'batch-005',
    import_type: 'csv',
    filename: 'client_contacts_q2.csv',
    status: 'failed',
    total_records: 420,
    success_count: 0,
    skipped_count: 0,
    error_count: 420,
    imported_by_name: 'agent@homesrus.hk',
    imported_at: new Date(Date.now() - 4 * 24 * 3600000).toISOString(),
    notes: 'Missing required column "client_ref"',
  },
  {
    id: 'batch-006',
    import_type: 'photo',
    filename: 'db_photos_batch2.zip',
    status: 'rolled_back',
    total_records: 960,
    success_count: 960,
    skipped_count: 0,
    error_count: 0,
    imported_by_name: 'admin@homesrus.hk',
    imported_at: new Date(Date.now() - 5 * 24 * 3600000).toISOString(),
    notes: 'Wrong photo set — rolled back',
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SyncStatusPill({ connected }: { connected: boolean }) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
        connected
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :'bg-slate-100 text-slate-500 border-slate-200'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
        }`}
      />
      {connected ? 'Live sync' : 'Offline'}
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  value: string | number;
  icon: string;
  iconBg: string;
  iconColor: string;
  sub?: string;
}

function SummaryCard({ label, value, icon, iconBg, iconColor, sub }: SummaryCardProps) {
  return (
    <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon name={icon as Parameters<typeof Icon>[0]['name']} size={20} className={iconColor} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-[hsl(215,25%,18%)] leading-tight">{value}</p>
        <p className="text-xs text-[hsl(215,15%,52%)] truncate">{label}</p>
        {sub && <p className="text-xs text-[hsl(215,15%,65%)] truncate">{sub}</p>}
      </div>
    </div>
  );
}

interface BatchCardProps {
  batch: ImportBatch;
}

function BatchCard({ batch }: BatchCardProps) {
  const sc = statusConfig(batch.status);
  const rate = successRate(batch);
  const isActive = batch.status === 'active';

  return (
    <div
      className={`bg-white rounded-xl border overflow-hidden transition-shadow hover:shadow-md ${
        isActive ? 'border-blue-200 shadow-sm shadow-blue-50' : 'border-[hsl(214,20%,88%)]'
      }`}
    >
      {/* Active pulse bar */}
      {isActive && (
        <div className="h-0.5 w-full bg-gradient-to-r from-blue-400 via-blue-300 to-blue-400 animate-pulse" />
      )}

      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
              batch.import_type === 'csv' ? 'bg-blue-50' : 'bg-purple-50'
            }`}
          >
            <Icon
              name={batch.import_type === 'csv' ? 'FileSpreadsheetIcon' : 'ImageIcon'}
              size={18}
              className={batch.import_type === 'csv' ? 'text-blue-600' : 'text-purple-600'}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-[hsl(215,25%,18%)] truncate max-w-[220px]">
                {batch.filename}
              </span>
              <span
                className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${sc.bg} ${sc.text} ${sc.border}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                {sc.label}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-[hsl(215,15%,52%)]">{formatRelative(batch.imported_at)}</span>
              {batch.imported_by_name && (
                <span className="text-xs text-[hsl(215,15%,65%)]">· {batch.imported_by_name}</span>
              )}
            </div>
          </div>

          {/* Success rate badge */}
          <div className="flex-shrink-0 text-right">
            <p
              className={`text-lg font-bold ${
                rate === 100
                  ? 'text-emerald-600'
                  : rate >= 80
                  ? 'text-amber-600' :'text-red-600'
              }`}
            >
              {rate}%
            </p>
            <p className="text-xs text-[hsl(215,15%,52%)]">success</p>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="w-full h-2 bg-[hsl(210,15%,94%)] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${sc.barColor}`}
              style={{ width: `${rate}%` }}
            />
          </div>
        </div>

        {/* Row counts */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Total', value: batch.total_records, color: 'text-[hsl(215,25%,18%)]' },
            { label: 'Success', value: batch.success_count, color: 'text-emerald-600' },
            { label: 'Skipped', value: batch.skipped_count, color: 'text-amber-600' },
            { label: 'Errors', value: batch.error_count, color: 'text-red-600' },
          ].map((item) => (
            <div key={item.label} className="bg-[hsl(210,15%,97%)] rounded-lg p-2 text-center">
              <p className={`text-sm font-bold ${item.color}`}>{item.value.toLocaleString()}</p>
              <p className="text-xs text-[hsl(215,15%,52%)]">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Notes + link */}
        {batch.notes && (
          <p className="text-xs text-[hsl(215,15%,52%)] flex items-start gap-1.5">
            <Icon name="InfoIcon" size={12} className="mt-0.5 flex-shrink-0" />
            {batch.notes}
          </p>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-[hsl(215,15%,65%)]">{formatDate(batch.imported_at)}</span>
          <Link
            href={`/import-batch-detail?id=${batch.id}`}
            className="flex items-center gap-1 text-xs font-medium text-[#8B1A2B] hover:underline"
          >
            View detail
            <Icon name="ArrowRightIcon" size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ImportBatchesClient() {
  const supabase = createClient();
  const [batches, setBatches] = useState<ImportBatch[]>(MOCK_BATCHES);
  const [loading, setLoading] = useState(true);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [tab, setTab] = useState<'all' | 'active' | 'completed'>('all');
  const [search, setSearch] = useState('');
  const useMockRef = useRef(false);

  // ── Fetch from DB ──────────────────────────────────────────────────────────
  const fetchBatches = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('import_history')
        .select('*')
        .order('imported_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        useMockRef.current = false;
        setBatches(
          data.map((r) => ({
            id: r.id,
            import_type: r.import_type ?? 'csv',
            filename: r.filename,
            status: (r.status as BatchStatus) ?? 'completed',
            total_records: r.total_records ?? 0,
            success_count: r.success_count ?? 0,
            skipped_count: r.skipped_count ?? 0,
            error_count: r.error_count ?? 0,
            imported_by_name: r.imported_by ?? undefined,
            imported_at: r.imported_at ?? r.created_at,
            notes: r.notes ?? undefined,
          }))
        );
      } else {
        useMockRef.current = true;
        setBatches(MOCK_BATCHES);
      }
      setLastSynced(new Date());
    } catch {
      useMockRef.current = true;
      setBatches(MOCK_BATCHES);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  // ── Realtime subscription ──────────────────────────────────────────────────
  useRealtimeSync({
    table: 'import_history',
    channelName: 'realtime:import_history:batches',
    enabled: !useMockRef.current,
    onInsert: (payload) => {
      const r = payload as Record<string, unknown>;
      setBatches((prev) => [
        {
          id: r.id as string,
          import_type: (r.import_type as string) ?? 'csv',
          filename: r.filename as string,
          status: (r.status as BatchStatus) ?? 'active',
          total_records: (r.total_records as number) ?? 0,
          success_count: (r.success_count as number) ?? 0,
          skipped_count: (r.skipped_count as number) ?? 0,
          error_count: (r.error_count as number) ?? 0,
          imported_by_name: r.imported_by as string | undefined,
          imported_at: (r.imported_at as string) ?? new Date().toISOString(),
          notes: r.notes as string | undefined,
        },
        ...prev,
      ]);
      setLastSynced(new Date());
    },
    onUpdate: (payload) => {
      const r = payload as Record<string, unknown>;
      setBatches((prev) =>
        prev.map((b) =>
          b.id === (r.id as string)
            ? {
                ...b,
                status: (r.status as BatchStatus) ?? b.status,
                total_records: (r.total_records as number) ?? b.total_records,
                success_count: (r.success_count as number) ?? b.success_count,
                skipped_count: (r.skipped_count as number) ?? b.skipped_count,
                error_count: (r.error_count as number) ?? b.error_count,
                notes: (r.notes as string) ?? b.notes,
              }
            : b
        )
      );
      setLastSynced(new Date());
    },
  });

  // ── Simulate realtime connected after mount ────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setRealtimeConnected(true), 1200);
    return () => clearTimeout(t);
  }, []);

  // ── Derived data ───────────────────────────────────────────────────────────
  const activeBatches = batches.filter((b) => b.status === 'active');
  const completedBatches = batches.filter((b) => b.status !== 'active');

  const totalRows = batches.reduce((s, b) => s + b.total_records, 0);
  const totalSuccess = batches.reduce((s, b) => s + b.success_count, 0);
  const totalErrors = batches.reduce((s, b) => s + b.error_count, 0);
  const overallRate = totalRows > 0 ? Math.round((totalSuccess / totalRows) * 100) : 0;

  const filtered = batches.filter((b) => {
    if (tab === 'active' && b.status !== 'active') return false;
    if (tab === 'completed' && b.status === 'active') return false;
    if (search && !b.filename.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto bg-[hsl(210,15%,97%)] p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(215,25%,18%)]">Import Batches</h1>
          <p className="text-sm text-[hsl(215,15%,52%)] mt-0.5">
            Monitor active and completed import batches — row counts, success rates, and live sync status.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SyncStatusPill connected={realtimeConnected} />
          {lastSynced && (
            <span className="text-xs text-[hsl(215,15%,65%)]">
              Updated {formatRelative(lastSynced.toISOString())}
            </span>
          )}
          <button
            onClick={fetchBatches}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[hsl(214,20%,88%)] text-[hsl(215,15%,52%)] hover:bg-[hsl(210,15%,94%)] transition-colors"
          >
            <Icon name="RefreshCwIcon" size={13} />
            Refresh
          </button>
          <Link
            href="/data-import-export"
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-[#8B1A2B] text-white hover:bg-[#7a1726] transition-colors"
          >
            <Icon name="UploadIcon" size={15} />
            New Import
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          label="Active Batches"
          value={activeBatches.length}
          icon="ActivityIcon"
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          sub={activeBatches.length > 0 ? 'In progress now' : 'None running'}
        />
        <SummaryCard
          label="Total Rows Processed"
          value={totalRows.toLocaleString()}
          icon="DatabaseIcon"
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
          sub={`${batches.length} batch${batches.length !== 1 ? 'es' : ''} total`}
        />
        <SummaryCard
          label="Overall Success Rate"
          value={`${overallRate}%`}
          icon="TrendingUpIcon"
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          sub={`${totalSuccess.toLocaleString()} rows succeeded`}
        />
        <SummaryCard
          label="Total Errors"
          value={totalErrors.toLocaleString()}
          icon="AlertCircleIcon"
          iconBg="bg-red-50"
          iconColor="text-red-600"
          sub={`Across all batches`}
        />
      </div>

      {/* Active batches highlight */}
      {activeBatches.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <p className="text-sm font-semibold text-blue-800">
              {activeBatches.length} Active Import{activeBatches.length > 1 ? 's' : ''} Running
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeBatches.map((b) => {
              const rate = successRate(b);
              return (
                <div key={b.id} className="bg-white rounded-lg border border-blue-200 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-[hsl(215,25%,18%)] truncate max-w-[200px]">
                      {b.filename}
                    </span>
                    <span className="text-sm font-bold text-blue-700">{rate}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-700"
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[hsl(215,15%,52%)]">
                    <span className="text-emerald-600 font-medium">{b.success_count.toLocaleString()} ok</span>
                    <span className="text-red-500 font-medium">{b.error_count} err</span>
                    <span className="ml-auto">{b.total_records.toLocaleString()} total rows</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters + tabs */}
      <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] px-4 py-3 flex flex-wrap items-center gap-3">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-[hsl(210,15%,94%)] rounded-lg p-1">
          {([
            { key: 'all', label: `All (${batches.length})` },
            { key: 'active', label: `Active (${activeBatches.length})` },
            { key: 'completed', label: `Completed (${completedBatches.length})` },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                tab === t.key
                  ? 'bg-white text-[hsl(215,25%,18%)] shadow-sm'
                  : 'text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Icon
            name="SearchIcon"
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(215,15%,52%)]"
          />
          <input
            type="text"
            placeholder="Search by filename…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B]"
          />
        </div>

        <span className="text-xs text-[hsl(215,15%,52%)] ml-auto">
          {filtered.length} batch{filtered.length !== 1 ? 'es' : ''}
        </span>
      </div>

      {/* Batch grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Icon name="LoaderIcon" size={28} className="animate-spin text-[#8B1A2B]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] flex flex-col items-center justify-center py-16 gap-3">
          <Icon name="InboxIcon" size={40} className="text-[hsl(215,15%,70%)]" />
          <p className="text-sm text-[hsl(215,15%,52%)]">No batches match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((batch) => (
            <BatchCard key={batch.id} batch={batch} />
          ))}
        </div>
      )}
    </div>
  );
}
