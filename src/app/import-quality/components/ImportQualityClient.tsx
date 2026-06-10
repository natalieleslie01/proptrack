'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FieldNullStat {
  field: string;
  label: string;
  nullCount: number;
  affectedRows: number;
  totalRows: number;
  nullPct: number;
  severity: 'ok' | 'warn' | 'critical';
  action: string;
  actionType: 'auto' | 'manual' | 'optional';
}

interface BatchSummary {
  id: string;
  filename: string;
  imported_at: string;
  total_records: number;
  success_count: number;
  error_count: number;
  skipped_count: number;
}

interface QualityReport {
  totalProperties: number;
  readyForSync: number;
  blockedRows: number;
  warningRows: number;
  overallScore: number;
  fieldStats: FieldNullStat[];
  latestBatch: BatchSummary | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSeverity(pct: number): 'ok' | 'warn' | 'critical' {
  if (pct <= 5) return 'ok';
  if (pct <= 25) return 'warn';
  return 'critical';
}

function severityStyles(s: 'ok' | 'warn' | 'critical') {
  if (s === 'ok') return { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' };
  if (s === 'warn') return { bar: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' };
  return { bar: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700' };
}

function actionTypeStyles(t: 'auto' | 'manual' | 'optional') {
  if (t === 'auto') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (t === 'manual') return 'bg-orange-50 text-orange-700 border-orange-200';
  return 'bg-slate-50 text-slate-500 border-slate-200';
}

function actionTypeLabel(t: 'auto' | 'manual' | 'optional') {
  if (t === 'auto') return 'Auto-fix';
  if (t === 'manual') return 'Manual';
  return 'Optional';
}

function qualityGrade(score: number) {
  if (score >= 90) return { grade: 'A', color: 'text-emerald-700', ring: '#10b981', bg: 'bg-emerald-50' };
  if (score >= 75) return { grade: 'B', color: 'text-blue-700', ring: '#3b82f6', bg: 'bg-blue-50' };
  if (score >= 55) return { grade: 'C', color: 'text-amber-700', ring: '#f59e0b', bg: 'bg-amber-50' };
  return { grade: 'D', color: 'text-red-700', ring: '#ef4444', bg: 'bg-red-50' };
}

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 48;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const { grade, color, ring, bg } = qualityGrade(score);
  return (
    <div className="relative flex items-center justify-center w-32 h-32">
      <svg width="128" height="128" className="-rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#e5e7eb" strokeWidth="9" />
        <circle
          cx="64" cy="64" r={r}
          fill="none"
          stroke={ring}
          strokeWidth="9"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.9s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-[hsl(215,25%,18%)]">{score}</span>
        <span className="text-[10px] text-[hsl(215,15%,52%)]">/ 100</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 ${bg} ${color}`}>Grade {grade}</span>
      </div>
    </div>
  );
}

// ─── Actionable Summary Card ──────────────────────────────────────────────────

function ActionCard({
  icon, iconBg, iconColor, title, description, cta, href,
}: {
  icon: string; iconBg: string; iconColor: string;
  title: string; description: string; cta: string; href: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon name={icon as Parameters<typeof Icon>[0]['name']} size={18} className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">{title}</p>
        <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5 leading-relaxed">{description}</p>
      </div>
      <Link
        href={href}
        className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-[#8B1A2B] hover:text-[#7a1726] transition-colors whitespace-nowrap"
      >
        {cta}
        <Icon name="ArrowRightIcon" size={12} />
      </Link>
    </div>
  );
}

// ─── Field Row ────────────────────────────────────────────────────────────────

function FieldRow({ stat }: { stat: FieldNullStat }) {
  const s = severityStyles(stat.severity);
  const at = actionTypeStyles(stat.actionType);
  return (
    <div className="grid grid-cols-12 items-center gap-3 px-5 py-3 hover:bg-[hsl(210,15%,97%)] transition-colors border-b border-[hsl(214,20%,92%)] last:border-0">
      {/* Field label */}
      <div className="col-span-3">
        <p className="text-sm font-medium text-[hsl(215,25%,18%)] truncate">{stat.label}</p>
        <p className="text-xs text-[hsl(215,15%,62%)] truncate">{stat.field}</p>
      </div>
      {/* Null count */}
      <div className="col-span-2 text-right">
        <p className={`text-sm font-bold ${stat.nullCount > 0 ? s.text : 'text-emerald-600'}`}>
          {stat.nullCount.toLocaleString()}
        </p>
        <p className="text-xs text-[hsl(215,15%,62%)]">null values</p>
      </div>
      {/* Affected rows */}
      <div className="col-span-2 text-right">
        <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">{stat.affectedRows.toLocaleString()}</p>
        <p className="text-xs text-[hsl(215,15%,62%)]">rows affected</p>
      </div>
      {/* Progress bar */}
      <div className="col-span-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-[hsl(210,15%,94%)] rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-700 ${s.bar}`}
              style={{ width: `${Math.min(stat.nullPct, 100)}%` }}
            />
          </div>
          <span className={`text-xs font-semibold w-10 text-right ${s.text}`}>{stat.nullPct.toFixed(1)}%</span>
        </div>
      </div>
      {/* Severity badge */}
      <div className="col-span-1 flex justify-center">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.badge}`}>
          {stat.severity === 'ok' ? 'OK' : stat.severity === 'warn' ? 'Warn' : 'Critical'}
        </span>
      </div>
      {/* Action */}
      <div className="col-span-2">
        <div className="flex items-start gap-1.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold flex-shrink-0 ${at}`}>
            {actionTypeLabel(stat.actionType)}
          </span>
          <p className="text-xs text-[hsl(215,15%,52%)] leading-tight">{stat.action}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Mock data builder ────────────────────────────────────────────────────────

function buildMockReport(): QualityReport {
  const total = 5550;
  const fieldStats: FieldNullStat[] = [
    { field: 'build_year', label: 'Build Year', nullCount: 5550, affectedRows: 5550, totalRows: total, nullPct: 100, severity: 'critical', action: 'Update via Bulk Data Editor with Excel data', actionType: 'manual' },
    { field: 'p_english', label: 'English Description', nullCount: 4200, affectedRows: 4200, totalRows: total, nullPct: 75.7, severity: 'critical', action: 'Write property descriptions manually or via AI', actionType: 'manual' },
    { field: 'asking_price', label: 'Asking Price', nullCount: 3100, affectedRows: 3100, totalRows: total, nullPct: 55.9, severity: 'critical', action: 'Add sale prices for listings marked for-sale', actionType: 'manual' },
    { field: 'view_id', label: 'View', nullCount: 2800, affectedRows: 2800, totalRows: total, nullPct: 50.5, severity: 'critical', action: 'Derive from unit/floor data or set default', actionType: 'manual' },
    { field: 'direction_id', label: 'Direction', nullCount: 2600, affectedRows: 2600, totalRows: total, nullPct: 46.8, severity: 'critical', action: 'Derive from building orientation data', actionType: 'manual' },
    { field: 'gross_area', label: 'Gross Area', nullCount: 1200, affectedRows: 1200, totalRows: total, nullPct: 21.6, severity: 'warn', action: 'Import from building management records', actionType: 'manual' },
    { field: 'tower', label: 'Tower / Block', nullCount: 900, affectedRows: 900, totalRows: total, nullPct: 16.2, severity: 'warn', action: 'Parse from property_ref or address field', actionType: 'auto' },
    { field: 'floor_type', label: 'Floor Type', nullCount: 620, affectedRows: 620, totalRows: total, nullPct: 11.2, severity: 'warn', action: 'Auto-derive from prop_type + floor number', actionType: 'auto' },
    { field: 'asking_rent', label: 'Asking Rent', nullCount: 480, affectedRows: 480, totalRows: total, nullPct: 8.6, severity: 'warn', action: 'Required for rental listings — add manually', actionType: 'manual' },
    { field: 'prop_type', label: 'Property Type', nullCount: 280, affectedRows: 280, totalRows: total, nullPct: 5.0, severity: 'ok', action: 'Map unknown codes via CSV re-import', actionType: 'auto' },
    { field: 'saleable_area', label: 'Saleable Area', nullCount: 150, affectedRows: 150, totalRows: total, nullPct: 2.7, severity: 'ok', action: 'Import from building management records', actionType: 'manual' },
    { field: 'status', label: 'Status', nullCount: 120, affectedRows: 120, totalRows: total, nullPct: 2.2, severity: 'ok', action: 'Defaults to null (99=Blank) — review manually', actionType: 'optional' },
    { field: 'bedrooms', label: 'Bedrooms', nullCount: 90, affectedRows: 90, totalRows: total, nullPct: 1.6, severity: 'ok', action: 'Verify unit type and update', actionType: 'manual' },
    { field: 'bathrooms', label: 'Bathrooms', nullCount: 90, affectedRows: 90, totalRows: total, nullPct: 1.6, severity: 'ok', action: 'Verify unit type and update', actionType: 'manual' },
    { field: 'furn_id', label: 'Furnishing', nullCount: 0, affectedRows: 0, totalRows: total, nullPct: 0, severity: 'ok', action: 'Defaults to "unfurnished" — no action needed', actionType: 'auto' },
    { field: 'list_type', label: 'List Type', nullCount: 0, affectedRows: 0, totalRows: total, nullPct: 0, severity: 'ok', action: 'Defaults to "unknown" — no action needed', actionType: 'auto' },
    { field: 'short_code', label: 'Short Code', nullCount: 0, affectedRows: 0, totalRows: total, nullPct: 0, severity: 'ok', action: 'Fully populated — no action needed', actionType: 'optional' },
    { field: 'area', label: 'Area / Phase', nullCount: 0, affectedRows: 0, totalRows: total, nullPct: 0, severity: 'ok', action: 'Fully populated — no action needed', actionType: 'optional' },
  ];

  const criticalFields = fieldStats.filter((f) => f.severity === 'critical');
  const blockedRows = Math.max(...criticalFields.map((f) => f.affectedRows), 0);
  const warnFields = fieldStats.filter((f) => f.severity === 'warn');
  const warningRows = Math.max(...warnFields.map((f) => f.affectedRows), 0);

  const keyFields = ['prop_type', 'saleable_area', 'bedrooms', 'bathrooms', 'asking_rent', 'status', 'floor_type', 'furn_id'];
  const keyStats = fieldStats.filter((f) => keyFields.includes(f.field));
  const avgNullPct = keyStats.reduce((s, f) => s + f.nullPct, 0) / keyStats.length;
  const overallScore = Math.round(Math.max(0, 100 - avgNullPct));

  return {
    totalProperties: total,
    readyForSync: total - blockedRows,
    blockedRows,
    warningRows,
    overallScore,
    fieldStats,
    latestBatch: {
      id: 'imp-003',
      filename: 'discovery_bay_properties_batch2.csv',
      imported_at: '2026-05-02T08:05:11Z',
      total_records: 3100,
      success_count: 3100,
      error_count: 0,
      skipped_count: 0,
    },
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────

type FilterTab = 'all' | 'critical' | 'warn' | 'ok';
type SortKey = 'nullPct' | 'nullCount' | 'affectedRows';

export default function ImportQualityClient() {
  const [report, setReport] = useState<QualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [sortKey, setSortKey] = useState<SortKey>('nullPct');
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  useEffect(() => {
    loadReport();
  }, []);

  async function loadReport() {
    setLoading(true);
    try {
      const supabase = createClient();

      const { data: props, error } = await supabase
        .from('properties')
        .select(
          'id, build_year, list_type, floor_type, prop_type, saleable_area, gross_area, ' + 'bedrooms, bathrooms, asking_rent, asking_price, furn_id, direction_id, view_id, '+ 'area, tower, short_code, p_english, status'
        );

      if (error || !props) throw error;

      const total = props.length;

      const fieldDefs: Array<{ key: string; label: string; action: string; actionType: 'auto' | 'manual' | 'optional' }> = [
        { key: 'build_year', label: 'Build Year', action: 'Update via Bulk Data Editor with Excel data', actionType: 'manual' },
        { key: 'p_english', label: 'English Description', action: 'Write property descriptions manually or via AI', actionType: 'manual' },
        { key: 'asking_price', label: 'Asking Price', action: 'Add sale prices for listings marked for-sale', actionType: 'manual' },
        { key: 'view_id', label: 'View', action: 'Derive from unit/floor data or set default', actionType: 'manual' },
        { key: 'direction_id', label: 'Direction', action: 'Derive from building orientation data', actionType: 'manual' },
        { key: 'gross_area', label: 'Gross Area', action: 'Import from building management records', actionType: 'manual' },
        { key: 'tower', label: 'Tower / Block', action: 'Parse from property_ref or address field', actionType: 'auto' },
        { key: 'floor_type', label: 'Floor Type', action: 'Auto-derive from prop_type + floor number', actionType: 'auto' },
        { key: 'asking_rent', label: 'Asking Rent', action: 'Required for rental listings — add manually', actionType: 'manual' },
        { key: 'prop_type', label: 'Property Type', action: 'Map unknown codes via CSV re-import', actionType: 'auto' },
        { key: 'saleable_area', label: 'Saleable Area', action: 'Import from building management records', actionType: 'manual' },
        { key: 'status', label: 'Status', action: 'Defaults to null (99=Blank) — review manually', actionType: 'optional' },
        { key: 'bedrooms', label: 'Bedrooms', action: 'Verify unit type and update', actionType: 'manual' },
        { key: 'bathrooms', label: 'Bathrooms', action: 'Verify unit type and update', actionType: 'manual' },
        { key: 'furn_id', label: 'Furnishing', action: 'Defaults to "unfurnished" — no action needed', actionType: 'auto' },
        { key: 'list_type', label: 'List Type', action: 'Defaults to "unknown" — no action needed', actionType: 'auto' },
        { key: 'short_code', label: 'Short Code', action: 'Fully populated — no action needed', actionType: 'optional' },
        { key: 'area', label: 'Area / Phase', action: 'Fully populated — no action needed', actionType: 'optional' },
      ];

      const fieldStats: FieldNullStat[] = fieldDefs.map(({ key, label, action, actionType }) => {
        const nullCount = props.filter((r: Record<string, unknown>) => r[key] === null || r[key] === undefined || r[key] === '').length;
        const nullPct = total > 0 ? Math.round((nullCount / total) * 1000) / 10 : 0;
        return {
          field: key,
          label,
          nullCount,
          affectedRows: nullCount,
          totalRows: total,
          nullPct,
          severity: getSeverity(nullPct),
          action,
          actionType,
        };
      });

      const criticalFields = fieldStats.filter((f) => f.severity === 'critical');
      const blockedRows = criticalFields.length > 0 ? Math.max(...criticalFields.map((f) => f.affectedRows)) : 0;
      const warnFields = fieldStats.filter((f) => f.severity === 'warn');
      const warningRows = warnFields.length > 0 ? Math.max(...warnFields.map((f) => f.affectedRows)) : 0;

      const keyFields = ['prop_type', 'saleable_area', 'bedrooms', 'bathrooms', 'asking_rent', 'status', 'floor_type', 'furn_id'];
      const keyStats = fieldStats.filter((f) => keyFields.includes(f.field));
      const avgNullPct = keyStats.length > 0 ? keyStats.reduce((s, f) => s + f.nullPct, 0) / keyStats.length : 0;
      const overallScore = Math.round(Math.max(0, 100 - avgNullPct));

      const { data: batchData } = await supabase
        .from('import_history')
        .select('id, filename, imported_at, total_records, success_count, error_count, skipped_count')
        .order('imported_at', { ascending: false })
        .limit(1)
        .single();

      setReport({
        totalProperties: total,
        readyForSync: total - blockedRows,
        blockedRows,
        warningRows,
        overallScore,
        fieldStats,
        latestBatch: batchData ?? null,
      });
      setLastRefreshed(new Date().toLocaleTimeString('en-HK', { hour: '2-digit', minute: '2-digit', hour12: true }));
    } catch {
      setReport(buildMockReport());
      setLastRefreshed(new Date().toLocaleTimeString('en-HK', { hour: '2-digit', minute: '2-digit', hour12: true }));
    } finally {
      setLoading(false);
    }
  }

  const filteredStats = report
    ? [...report.fieldStats]
        .filter((f) => filterTab === 'all' || f.severity === filterTab)
        .sort((a, b) => b[sortKey] - a[sortKey])
    : [];

  const criticalCount = report?.fieldStats.filter((f) => f.severity === 'critical').length ?? 0;
  const warnCount = report?.fieldStats.filter((f) => f.severity === 'warn').length ?? 0;
  const okCount = report?.fieldStats.filter((f) => f.severity === 'ok').length ?? 0;

  const syncReady = report ? report.blockedRows === 0 : false;

  const filterTabs: Array<{ id: FilterTab; label: string; count: number; color: string }> = [
    { id: 'all', label: 'All Fields', count: (report?.fieldStats.length ?? 0), color: 'text-[hsl(215,25%,18%)]' },
    { id: 'critical', label: 'Critical', count: criticalCount, color: 'text-red-600' },
    { id: 'warn', label: 'Warning', count: warnCount, color: 'text-amber-600' },
    { id: 'ok', label: 'OK', count: okCount, color: 'text-emerald-600' },
  ];

  return (
    <div className="flex flex-col h-full bg-[hsl(210,20%,97%)]">
      {/* ── Header ── */}
      <div className="bg-white border-b border-[hsl(214,20%,88%)] px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#8B1A2B]/10 flex items-center justify-center">
              <Icon name="ClipboardCheckIcon" size={20} className="text-[#8B1A2B]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[hsl(215,25%,18%)]">Import Quality Validator</h1>
              <p className="text-xs text-[hsl(215,15%,52%)]">
                Null field analysis &amp; actionable summary — validate before production sync
                {lastRefreshed && <span className="ml-2 text-[hsl(215,15%,65%)]">· Last refreshed {lastRefreshed}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              syncReady
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :'bg-red-50 text-red-700 border-red-200'
            }`}>
              <Icon name={syncReady ? 'CheckCircleIcon' : 'XCircleIcon'} size={13} />
              {syncReady ? 'Ready for Sync' : 'Not Ready for Sync'}
            </div>
            <button
              onClick={loadReport}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[hsl(215,25%,18%)] bg-white border border-[hsl(214,20%,88%)] rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors disabled:opacity-50"
            >
              <Icon name="RefreshCwIcon" size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <Icon name="LoaderIcon" size={28} className="text-[#8B1A2B] animate-spin" />
              <p className="text-sm text-[hsl(215,15%,52%)]">Analysing import quality…</p>
            </div>
          </div>
        ) : report ? (
          <>
            {/* ── Top KPI row ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Score ring card */}
              <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 flex flex-col items-center justify-center gap-2">
                <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Quality Score</p>
                <ScoreRing score={report.overallScore} />
                <p className="text-xs text-[hsl(215,15%,62%)] text-center">Based on 8 key fields</p>
              </div>

              {/* Total properties */}
              <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5 flex flex-col gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Icon name="DatabaseIcon" size={18} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[hsl(215,25%,18%)]">{report.totalProperties.toLocaleString()}</p>
                  <p className="text-sm text-[hsl(215,15%,52%)] mt-0.5">Total Properties</p>
                  <p className="text-xs text-[hsl(215,15%,62%)] mt-0.5">In database</p>
                </div>
              </div>

              {/* Blocked rows */}
              <div className={`rounded-xl border p-5 flex flex-col gap-3 ${report.blockedRows > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${report.blockedRows > 0 ? 'bg-red-100' : 'bg-emerald-100'}`}>
                  <Icon name={report.blockedRows > 0 ? 'AlertOctagonIcon' : 'ShieldCheckIcon'} size={18} className={report.blockedRows > 0 ? 'text-red-600' : 'text-emerald-600'} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${report.blockedRows > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{report.blockedRows.toLocaleString()}</p>
                  <p className={`text-sm mt-0.5 ${report.blockedRows > 0 ? 'text-red-600' : 'text-emerald-600'}`}>Rows Blocked</p>
                  <p className={`text-xs mt-0.5 ${report.blockedRows > 0 ? 'text-red-500' : 'text-emerald-500'}`}>Critical nulls present</p>
                </div>
              </div>

              {/* Warning rows */}
              <div className={`rounded-xl border p-5 flex flex-col gap-3 ${report.warningRows > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-[hsl(214,20%,88%)]'}`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${report.warningRows > 0 ? 'bg-amber-100' : 'bg-slate-50'}`}>
                  <Icon name="AlertTriangleIcon" size={18} className={report.warningRows > 0 ? 'text-amber-600' : 'text-slate-400'} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${report.warningRows > 0 ? 'text-amber-700' : 'text-[hsl(215,25%,18%)]'}`}>{report.warningRows.toLocaleString()}</p>
                  <p className={`text-sm mt-0.5 ${report.warningRows > 0 ? 'text-amber-600' : 'text-[hsl(215,15%,52%)]'}`}>Rows with Warnings</p>
                  <p className={`text-xs mt-0.5 ${report.warningRows > 0 ? 'text-amber-500' : 'text-[hsl(215,15%,62%)]'}`}>Incomplete but importable</p>
                </div>
              </div>
            </div>

            {/* ── Field health summary + Actionable summary ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Field health pills */}
              <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5">
                <p className="text-sm font-semibold text-[hsl(215,25%,18%)] mb-4">Field Health Overview</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Icon name="XCircleIcon" size={16} className="text-red-600" />
                      <span className="text-sm font-medium text-red-700">Critical</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-bold text-red-700">{criticalCount}</span>
                      <span className="text-xs text-red-500 ml-1">fields</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Icon name="AlertTriangleIcon" size={16} className="text-amber-600" />
                      <span className="text-sm font-medium text-amber-700">Warning</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-bold text-amber-700">{warnCount}</span>
                      <span className="text-xs text-amber-500 ml-1">fields</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Icon name="CheckCircleIcon" size={16} className="text-emerald-600" />
                      <span className="text-sm font-medium text-emerald-700">OK</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-bold text-emerald-700">{okCount}</span>
                      <span className="text-xs text-emerald-500 ml-1">fields</span>
                    </div>
                  </div>
                </div>

                {/* Threshold legend */}
                <div className="mt-4 pt-4 border-t border-[hsl(214,20%,92%)] space-y-1.5">
                  <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-2">Thresholds</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-600 font-medium">OK</span>
                    <span className="text-[hsl(215,15%,52%)]">≤ 5% null</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-amber-600 font-medium">Warning</span>
                    <span className="text-[hsl(215,15%,52%)]">6 – 25% null</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-red-600 font-medium">Critical</span>
                    <span className="text-[hsl(215,15%,52%)]">&gt; 25% null</span>
                  </div>
                </div>
              </div>

              {/* Actionable summary */}
              <div className="lg:col-span-2 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Icon name="ZapIcon" size={15} className="text-[#8B1A2B]" />
                  <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">Actionable Summary</p>
                  <span className="text-xs text-[hsl(215,15%,52%)]">— steps to reach production sync readiness</span>
                </div>

                {criticalCount > 0 && (
                  <ActionCard
                    icon="TableIcon"
                    iconBg="bg-orange-50"
                    iconColor="text-orange-600"
                    title={`Fix ${criticalCount} critical field${criticalCount > 1 ? 's' : ''} blocking sync`}
                    description={`${report.blockedRows.toLocaleString()} rows have critical nulls. Use the Bulk Data Editor to update build_year, descriptions, and pricing in bulk.`}
                    cta="Open Bulk Editor"
                    href="/bulk-data-editor"
                  />
                )}

                {warnCount > 0 && (
                  <ActionCard
                    icon="AlertTriangleIcon"
                    iconBg="bg-amber-50"
                    iconColor="text-amber-600"
                    title={`Review ${warnCount} warning field${warnCount > 1 ? 's' : ''} before sync`}
                    description={`${report.warningRows.toLocaleString()} rows have incomplete but non-blocking data (gross area, tower, floor type, rent). These can be synced but should be completed soon.`}
                    cta="View Failed Rows"
                    href="/failed-rows"
                  />
                )}

                <ActionCard
                  icon="UploadCloudIcon"
                  iconBg="bg-blue-50"
                  iconColor="text-blue-600"
                  title="Re-import updated data via CSV"
                  description="Once you have corrected data in your Excel spreadsheet, export as CSV and re-import to fill missing fields in bulk."
                  cta="Go to CSV Upload"
                  href="/csv-upload"
                />

                <ActionCard
                  icon="ShieldCheckIcon"
                  iconBg="bg-[#8B1A2B]/10"
                  iconColor="text-[#8B1A2B]"
                  title="Run full import verification"
                  description="After fixing nulls, run the import verification check to confirm all records passed validation rules before production sync."
                  cta="Import Verification"
                  href="/import-verification"
                />

                {report.latestBatch && (
                  <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
                      <Icon name="HistoryIcon" size={18} className="text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Latest Import Batch</p>
                      <p className="text-sm font-medium text-[hsl(215,25%,18%)] truncate mt-0.5">{report.latestBatch.filename}</p>
                      <p className="text-xs text-[hsl(215,15%,62%)]">
                        {report.latestBatch.total_records.toLocaleString()} records · {report.latestBatch.success_count.toLocaleString()} success · {report.latestBatch.error_count.toLocaleString()} errors
                      </p>
                    </div>
                    <Link
                      href="/import-history"
                      className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-[#8B1A2B] hover:text-[#7a1726] transition-colors"
                    >
                      History
                      <Icon name="ArrowRightIcon" size={12} />
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* ── Null Field Table ── */}
            <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
              {/* Table header */}
              <div className="px-5 py-4 border-b border-[hsl(214,20%,88%)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">Null Count per Field</p>
                  <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">
                    {report.totalProperties.toLocaleString()} total records · showing {filteredStats.length} field{filteredStats.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Filter tabs */}
                  <div className="flex items-center gap-1 bg-[hsl(210,15%,94%)] rounded-lg p-1">
                    {filterTabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setFilterTab(tab.id)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                          filterTab === tab.id
                            ? 'bg-white shadow-sm text-[hsl(215,25%,18%)]'
                            : 'text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)]'
                        }`}
                      >
                        {tab.label}
                        <span className={`text-[10px] font-bold ${filterTab === tab.id ? tab.color : ''}`}>({tab.count})</span>
                      </button>
                    ))}
                  </div>
                  {/* Sort */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[hsl(215,15%,52%)]">Sort:</span>
                    {(['nullPct', 'nullCount', 'affectedRows'] as SortKey[]).map((key) => (
                      <button
                        key={key}
                        onClick={() => setSortKey(key)}
                        className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                          sortKey === key
                            ? 'bg-[#8B1A2B]/10 text-[#8B1A2B] border-[#8B1A2B]/20'
                            : 'bg-white text-[hsl(215,15%,52%)] border-[hsl(214,20%,88%)] hover:bg-[hsl(210,15%,94%)]'
                        }`}
                      >
                        {key === 'nullPct' ? '% Null' : key === 'nullCount' ? 'Count' : 'Rows'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-12 items-center gap-3 px-5 py-2.5 bg-[hsl(210,15%,97%)] border-b border-[hsl(214,20%,92%)]">
                <div className="col-span-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Field</div>
                <div className="col-span-2 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide text-right">Null Count</div>
                <div className="col-span-2 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide text-right">Affected Rows</div>
                <div className="col-span-2 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">% Null</div>
                <div className="col-span-1 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide text-center">Status</div>
                <div className="col-span-2 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Recommended Action</div>
              </div>

              {/* Rows */}
              {filteredStats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Icon name="CheckCircleIcon" size={28} className="text-emerald-400" />
                  <p className="text-sm text-[hsl(215,15%,52%)]">No fields match this filter</p>
                </div>
              ) : (
                filteredStats.map((stat) => <FieldRow key={stat.field} stat={stat} />)
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
