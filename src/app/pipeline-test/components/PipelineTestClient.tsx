'use client';

import React, { useState, useRef, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

type StepStatus = 'idle' | 'running' | 'pass' | 'fail' | 'skipped';

interface StepResult {
  status: StepStatus;
  message: string;
  detail?: string;
  duration?: number;
}

interface KpiSnapshot {
  totalProperties: number;
  leasedCount: number;
  vacantCount: number;
  forSaleCount: number;
}

interface PipelineState {
  csvParse: StepResult;
  supabaseInsert: StepResult;
  kpiRefresh: StepResult;
}

const INITIAL_STATE: PipelineState = {
  csvParse: { status: 'idle', message: 'Waiting…' },
  supabaseInsert: { status: 'idle', message: 'Waiting…' },
  kpiRefresh: { status: 'idle', message: 'Waiting…' },
};

// ─── Minimal CSV template for test ───────────────────────────────────────────

const TEST_CSV_CONTENT = `pid,village,short_code,area,tower,list_type,prop_type,saleable_sqft_size,gross_area,bedrooms,bathrooms,asking_rent,asking_price,status,balcony,garden,pool,terrace,roof,duplex,combined,openkitchen,publish_dt
PIPELINE-TEST-001,Discovery Bay,NV,North Village,NT1,Rent,High Rise,800,950,3,2,28000,,1,Y,N,N,N,N,N,N,N,2026-01-01
PIPELINE-TEST-002,Discovery Bay,NV,North Village,NT2,Rent,High Rise,650,780,2,1,22000,,1,N,N,N,N,N,N,N,N,2026-01-01`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTestCsv(csvText: string): Record<string, string>[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (vals[i] || '').trim(); });
    return row;
  });
}

function mapCsvRowToDb(raw: Record<string, string>) {
  const parseBool = (v: string | undefined) => v?.trim().toUpperCase() === 'Y' || v?.trim().toUpperCase() === 'YES' || v?.trim() === '1';
  const parseIntSafe = (v: string | undefined) => { const n = parseInt(v || '', 10); return isNaN(n) ? undefined : n; };
  const parseFloatSafe = (v: string | undefined) => { const n = parseFloat(v || ''); return isNaN(n) ? undefined : n; };
  const cleanStr = (v: string | undefined) => (!v || v.trim() === '' || v.trim().toUpperCase() === 'NULL') ? undefined : v.trim();

  const statusCode = parseInt(raw['status'] || '', 10);
  let status: string | undefined;
  const listType = cleanStr(raw['list_type'] || raw['list type']);
  if (!isNaN(statusCode)) {
    if (statusCode === 0 || statusCode === 3) {
      const lt = (listType || '').toLowerCase();
      status = lt === 'sale' ? 'for-sale' : lt === 'rent' ? 'for-rent' : 'for-rent';
    } else if (statusCode === 1) status = 'leased';
    else if (statusCode === 4) status = 'for-sale';
  }

  return {
    property_ref: (raw['pid'] || raw['property_ref'] || '').trim(),
    village: cleanStr(raw['village']) || 'Discovery Bay',
    short_code: cleanStr(raw['short_code']),
    area: cleanStr(raw['area']),
    tower: cleanStr(raw['tower']),
    list_type: listType || 'unknown',
    prop_type: cleanStr(raw['prop_type']),
    prop_types: cleanStr(raw['prop_type']),
    saleable_area: parseFloatSafe(raw['saleable_sqft_size']),
    gross_area: parseFloatSafe(raw['gross_area']),
    bedrooms: parseIntSafe(raw['bedrooms']),
    bathrooms: parseIntSafe(raw['bathrooms']),
    asking_rent: parseFloatSafe(raw['asking_rent']),
    asking_price: parseFloatSafe(raw['asking_price']),
    status: status,
    contact_status_code: isNaN(statusCode) ? undefined : statusCode,
    balcony: parseBool(raw['balcony']),
    garden: parseBool(raw['garden']),
    pool: parseBool(raw['pool']),
    terrace: parseBool(raw['terrace']),
    roof: parseBool(raw['roof']),
    duplex: parseBool(raw['duplex']),
    combined: parseBool(raw['combined']),
    openkitch: parseBool(raw['openkitchen'] || raw['openkitch']),
    publish_dt: cleanStr(raw['publish_dt']),
  };
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepCard({
  stepNum,
  title,
  description,
  result,
}: {
  stepNum: number;
  title: string;
  description: string;
  result: StepResult;
}) {
  const statusConfig: Record<StepStatus, { icon: string; bg: string; border: string; text: string; badge: string }> = {
    idle: { icon: 'CircleIcon', bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-400', badge: 'bg-gray-100 text-gray-500' },
    running: { icon: 'LoaderIcon', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', badge: 'bg-blue-100 text-blue-700' },
    pass: { icon: 'CheckCircleIcon', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700' },
    fail: { icon: 'XCircleIcon', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', badge: 'bg-red-100 text-red-700' },
    skipped: { icon: 'MinusCircleIcon', bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-400', badge: 'bg-gray-100 text-gray-500' },
  };

  const cfg = statusConfig[result.status];

  return (
    <div className={`rounded-xl border-2 p-5 transition-all duration-300 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${result.status === 'running' ? 'animate-spin' : ''} ${cfg.text} bg-white border-2 ${cfg.border}`}>
          <Icon name={cfg.icon as Parameters<typeof Icon>[0]['name']} size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Step {stepNum}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
              {result.status === 'idle' ? 'Pending' : result.status === 'running' ? 'Running…' : result.status === 'pass' ? 'PASS' : result.status === 'fail' ? 'FAIL' : 'Skipped'}
            </span>
            {result.duration !== undefined && (
              <span className="text-xs text-gray-400">{result.duration}ms</span>
            )}
          </div>
          <h3 className="font-semibold text-[hsl(215,25%,18%)] text-sm">{title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          <p className={`text-sm mt-2 font-medium ${cfg.text}`}>{result.message}</p>
          {result.detail && (
            <pre className="mt-2 text-xs bg-white/70 rounded-lg p-3 overflow-x-auto border border-gray-200 text-gray-600 whitespace-pre-wrap break-all">
              {result.detail}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── KPI diff card ────────────────────────────────────────────────────────────

function KpiDiffRow({ label, before, after }: { label: string; before: number; after: number }) {
  const diff = after - before;
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm font-mono text-gray-400">{before}</span>
        <Icon name="ArrowRightIcon" size={12} className="text-gray-300" />
        <span className="text-sm font-mono font-semibold text-[hsl(215,25%,18%)]">{after}</span>
        {diff !== 0 && (
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${diff > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
            {diff > 0 ? `+${diff}` : diff}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PipelineTestClient() {
  const [pipeline, setPipeline] = useState<PipelineState>(INITIAL_STATE);
  const [running, setRunning] = useState(false);
  const [csvSource, setCsvSource] = useState<'builtin' | 'custom'>('builtin');
  const [customCsv, setCustomCsv] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [kpiBefore, setKpiBefore] = useState<KpiSnapshot | null>(null);
  const [kpiAfter, setKpiAfter] = useState<KpiSnapshot | null>(null);
  const [overallResult, setOverallResult] = useState<'idle' | 'pass' | 'fail'>('idle');
  const [insertedRefs, setInsertedRefs] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setStep = useCallback((step: keyof PipelineState, update: Partial<StepResult>) => {
    setPipeline(prev => ({ ...prev, [step]: { ...prev[step], ...update } }));
  }, []);

  const fetchKpiSnapshot = async (): Promise<KpiSnapshot> => {
    const supabase = createClient();
    const { data } = await supabase.from('properties').select('status, occupancy');
    const props = data || [];
    return {
      totalProperties: props.length,
      leasedCount: props.filter(p => p.occupancy === 'leased').length,
      vacantCount: props.filter(p => p.occupancy === 'vacant' || p.occupancy === 'vacant-soon').length,
      forSaleCount: props.filter(p => p.status === 'for-sale' || p.status === 'for-sale-and-rent').length,
    };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCustomCsv((ev.target?.result as string) || '');
      setCsvSource('custom');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.name.endsWith('.csv')) return;
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCustomCsv((ev.target?.result as string) || '');
      setCsvSource('custom');
    };
    reader.readAsText(file);
  };

  const runPipeline = async () => {
    setRunning(true);
    setOverallResult('idle');
    setKpiBefore(null);
    setKpiAfter(null);
    setInsertedRefs([]);
    setPipeline(INITIAL_STATE);

    const supabase = createClient();
    const csvText = csvSource === 'builtin' ? TEST_CSV_CONTENT : customCsv;

    // ── STEP 1: CSV Parse ──────────────────────────────────────────────────────
    setStep('csvParse', { status: 'running', message: 'Parsing CSV…' });
    const t1Start = Date.now();
    let rows: Record<string, string>[] = [];
    let mappedRows: ReturnType<typeof mapCsvRowToDb>[] = [];

    try {
      rows = parseTestCsv(csvText);
      if (rows.length === 0) throw new Error('No data rows found in CSV');
      mappedRows = rows.map(mapCsvRowToDb).filter(r => r.property_ref !== '');
      if (mappedRows.length === 0) throw new Error('No valid rows after mapping (missing property_ref?)');

      const refs = mappedRows.map(r => r.property_ref).join(', ');
      setStep('csvParse', {
        status: 'pass',
        message: `Parsed ${mappedRows.length} row(s) successfully`,
        detail: `Refs: ${refs}\nColumns detected: ${Object.keys(rows[0]).join(', ')}`,
        duration: Date.now() - t1Start,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStep('csvParse', { status: 'fail', message: `Parse failed: ${msg}`, duration: Date.now() - t1Start });
      setStep('supabaseInsert', { status: 'skipped', message: 'Skipped — CSV parse failed' });
      setStep('kpiRefresh', { status: 'skipped', message: 'Skipped — upstream failure' });
      setOverallResult('fail');
      setRunning(false);
      return;
    }

    // ── STEP 2: Supabase Insert ────────────────────────────────────────────────
    setStep('supabaseInsert', { status: 'running', message: 'Inserting rows into Supabase…' });
    const t2Start = Date.now();

    // Capture KPI before insert
    let snapshotBefore: KpiSnapshot;
    try {
      snapshotBefore = await fetchKpiSnapshot();
      setKpiBefore(snapshotBefore);
    } catch {
      snapshotBefore = { totalProperties: 0, leasedCount: 0, vacantCount: 0, forSaleCount: 0 };
    }

    try {
      const { data: upsertData, error: upsertErr } = await supabase
        .from('properties')
        .upsert(mappedRows, { onConflict: 'property_ref', ignoreDuplicates: false })
        .select('property_ref');

      if (upsertErr) throw upsertErr;

      const insertedCount = upsertData?.length || mappedRows.length;
      const refs = (upsertData || mappedRows).map(r => r.property_ref);
      setInsertedRefs(refs);

      setStep('supabaseInsert', {
        status: 'pass',
        message: `Upserted ${insertedCount} row(s) into properties table`,
        detail: `Inserted/updated refs:\n${refs.join('\n')}`,
        duration: Date.now() - t2Start,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStep('supabaseInsert', {
        status: 'fail',
        message: `Insert failed: ${msg}`,
        detail: msg,
        duration: Date.now() - t2Start,
      });
      setStep('kpiRefresh', { status: 'skipped', message: 'Skipped — insert failed' });
      setOverallResult('fail');
      setRunning(false);
      return;
    }

    // ── STEP 3: KPI Refresh ────────────────────────────────────────────────────
    setStep('kpiRefresh', { status: 'running', message: 'Re-fetching dashboard KPIs…' });
    const t3Start = Date.now();

    try {
      const snapshotAfter = await fetchKpiSnapshot();
      setKpiAfter(snapshotAfter);

      const diff = snapshotAfter.totalProperties - snapshotBefore.totalProperties;
      const detail = [
        `Total properties: ${snapshotBefore.totalProperties} → ${snapshotAfter.totalProperties} (${diff >= 0 ? '+' : ''}${diff})`,
        `Leased: ${snapshotBefore.leasedCount} → ${snapshotAfter.leasedCount}`,
        `Vacant: ${snapshotBefore.vacantCount} → ${snapshotAfter.vacantCount}`,
        `For Sale: ${snapshotBefore.forSaleCount} → ${snapshotAfter.forSaleCount}`,
      ].join('\n');

      setStep('kpiRefresh', {
        status: 'pass',
        message: `KPI refresh successful — ${diff > 0 ? `${diff} new propert${diff === 1 ? 'y' : 'ies'} reflected` : 'counts updated (upsert)'}`,
        detail,
        duration: Date.now() - t3Start,
      });
      setOverallResult('pass');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStep('kpiRefresh', { status: 'fail', message: `KPI fetch failed: ${msg}`, duration: Date.now() - t3Start });
      setOverallResult('fail');
    }

    setRunning(false);
  };

  const handleReset = () => {
    setPipeline(INITIAL_STATE);
    setOverallResult('idle');
    setKpiBefore(null);
    setKpiAfter(null);
    setInsertedRefs([]);
    setCsvSource('builtin');
    setCustomCsv('');
    setUploadedFileName(null);
  };

  const allPass = overallResult === 'pass';
  const anyFail = overallResult === 'fail';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(215,25%,18%)]">Pipeline Test</h1>
          <p className="text-sm text-[hsl(215,15%,52%)] mt-0.5">
            Validates the end-to-end data pipeline: CSV upload → Supabase insert → Dashboard KPI refresh
          </p>
        </div>
        {overallResult !== 'idle' && (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm ${allPass ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
            <Icon name={allPass ? 'CheckCircleIcon' : 'XCircleIcon'} size={18} />
            {allPass ? 'ALL STEPS PASSED' : 'PIPELINE FAILED'}
          </div>
        )}
      </div>

      {/* CSV Source selector */}
      <div className="card bg-white border border-[hsl(214,20%,88%)] p-5">
        <h2 className="text-sm font-semibold text-[hsl(215,25%,18%)] mb-3 flex items-center gap-2">
          <Icon name="FileTextIcon" size={16} className="text-[#1B4F8A]" />
          CSV Data Source
        </h2>
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => setCsvSource('builtin')}
            className={`flex-1 py-2.5 px-4 rounded-lg border-2 text-sm font-medium transition-all ${csvSource === 'builtin' ? 'border-[#1B4F8A] bg-[#1B4F8A]/5 text-[#1B4F8A]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
          >
            Use built-in test CSV (2 rows)
          </button>
          <button
            onClick={() => { setCsvSource('custom'); if (!customCsv) fileInputRef.current?.click(); }}
            className={`flex-1 py-2.5 px-4 rounded-lg border-2 text-sm font-medium transition-all ${csvSource === 'custom' ? 'border-[#1B4F8A] bg-[#1B4F8A]/5 text-[#1B4F8A]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
          >
            Upload custom CSV
          </button>
        </div>

        {csvSource === 'builtin' && (
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <p className="text-xs font-semibold text-gray-500 mb-1">Built-in test data (refs: PIPELINE-TEST-001, PIPELINE-TEST-002)</p>
            <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre">{TEST_CSV_CONTENT}</pre>
          </div>
        )}

        {csvSource === 'custom' && (
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#1B4F8A] transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileUpload}
            />
            {uploadedFileName ? (
              <div className="flex items-center justify-center gap-2 text-emerald-600">
                <Icon name="CheckCircleIcon" size={18} />
                <span className="text-sm font-medium">{uploadedFileName}</span>
              </div>
            ) : (
              <>
                <Icon name="UploadCloudIcon" size={28} className="text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Drop a CSV file here or click to browse</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Pipeline steps */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[hsl(215,25%,18%)] flex items-center gap-2">
          <Icon name="GitBranchIcon" size={16} className="text-[#1B4F8A]" />
          Pipeline Steps
        </h2>
        <StepCard
          stepNum={1}
          title="CSV Parse & Validation"
          description="Parse CSV text, map columns to DB schema, validate required fields (property_ref)"
          result={pipeline.csvParse}
        />
        <div className="flex justify-center">
          <Icon name="ArrowDownIcon" size={16} className="text-gray-300" />
        </div>
        <StepCard
          stepNum={2}
          title="Supabase Insert (Upsert)"
          description="Upsert mapped rows into the properties table using property_ref as conflict key"
          result={pipeline.supabaseInsert}
        />
        <div className="flex justify-center">
          <Icon name="ArrowDownIcon" size={16} className="text-gray-300" />
        </div>
        <StepCard
          stepNum={3}
          title="Dashboard KPI Refresh"
          description="Re-query properties table and compare KPI counts before vs. after insert"
          result={pipeline.kpiRefresh}
        />
      </div>

      {/* KPI diff table */}
      {kpiBefore && kpiAfter && (
        <div className="card bg-white border border-[hsl(214,20%,88%)] p-5">
          <h2 className="text-sm font-semibold text-[hsl(215,25%,18%)] mb-3 flex items-center gap-2">
            <Icon name="BarChart3Icon" size={16} className="text-[#1B4F8A]" />
            KPI Delta (Before → After)
          </h2>
          <div className="divide-y divide-gray-100">
            <KpiDiffRow label="Total Properties" before={kpiBefore.totalProperties} after={kpiAfter.totalProperties} />
            <KpiDiffRow label="Leased" before={kpiBefore.leasedCount} after={kpiAfter.leasedCount} />
            <KpiDiffRow label="Vacant" before={kpiBefore.vacantCount} after={kpiAfter.vacantCount} />
            <KpiDiffRow label="For Sale" before={kpiBefore.forSaleCount} after={kpiAfter.forSaleCount} />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={runPipeline}
          disabled={running || (csvSource === 'custom' && !customCsv)}
          className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon name={running ? 'LoaderIcon' : 'PlayIcon'} size={16} className={running ? 'animate-spin' : ''} />
          {running ? 'Running pipeline…' : 'Run Pipeline Test'}
        </button>
        <button
          onClick={handleReset}
          disabled={running}
          className="btn-secondary flex items-center gap-2 disabled:opacity-50"
        >
          <Icon name="RotateCcwIcon" size={16} />
          Reset
        </button>
        {allPass && (
          <Link href="/dashboard" className="btn-secondary flex items-center gap-2 ml-auto">
            <Icon name="LayoutDashboardIcon" size={16} />
            View Dashboard
          </Link>
        )}
      </div>

      {/* Cleanup note */}
      {insertedRefs.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 flex gap-3">
          <Icon name="InfoIcon" size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Test data inserted</p>
            <p className="text-xs text-amber-700 mt-0.5">
              The following test refs were upserted into your properties table:{' '}
              <span className="font-mono">{insertedRefs.join(', ')}</span>.
              You can delete them from the{' '}
              <Link href="/property-management" className="underline">Property Management</Link> screen or via the Supabase dashboard.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
