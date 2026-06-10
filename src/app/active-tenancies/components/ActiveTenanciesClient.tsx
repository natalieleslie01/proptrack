'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import AppLayout from '@/components/AppLayout';
import { mockProperties, Property, agentNames } from '@/app/property-management/components/mockData';

// ─── Workflow Steps ────────────────────────────────────────────────────────────

type WorkflowStep =
  | 'front-page' |'form2' |'forms56' |'provisional-ta' |'tenancy-agreement' |'stamp-duty' |'cr109';

interface StepConfig {
  id: WorkflowStep;
  label: string;
  shortLabel: string;
  icon: string;
}

const STEPS: StepConfig[] = [
  { id: 'front-page', label: 'Tenancy Details', shortLabel: 'Details', icon: 'ClipboardListIcon' },
  { id: 'form2', label: 'Form 2', shortLabel: 'Form 2', icon: 'FileTextIcon' },
  { id: 'forms56', label: 'Forms 5 & 6', shortLabel: 'F5 & F6', icon: 'FilesIcon' },
  { id: 'provisional-ta', label: 'Provisional TA', shortLabel: 'Prov. TA', icon: 'FileSignatureIcon' },
  { id: 'tenancy-agreement', label: 'Tenancy Agreement', shortLabel: 'TA', icon: 'HomeIcon' },
  { id: 'stamp-duty', label: 'Stamp Duty', shortLabel: 'Stamp', icon: 'ExternalLinkIcon' },
  { id: 'cr109', label: 'CR109', shortLabel: 'CR109', icon: 'CheckSquareIcon' },
];

// ─── Derive workflow state from property data ──────────────────────────────────

interface TenancyRecord {
  property: Property;
  currentStep: WorkflowStep;
  currentStepIndex: number;
  progressPercent: number;
  outstandingActions: string[];
  agent: string;
  leaseStart: string;
  leaseEnd: string;
  monthlyRent: number;
  tenantName: string;
}

function deriveWorkflowState(prop: Property): { step: WorkflowStep; stepIndex: number; progress: number; outstanding: string[] } {
  const t = prop.tenant;
  const outstanding: string[] = [];

  if (!t) {
    return { step: 'front-page', stepIndex: 0, progress: 0, outstanding: ['Enter tenancy details'] };
  }

  // Determine step based on available data
  if (!t.stampDutyPaid && !t.cr109Filed) {
    // Check if TA is done — assume leaseStart means TA is signed
    if (t.leaseStart) {
      outstanding.push('Submit stamp duty via IRD portal');
      outstanding.push('File CR109 with Rating & Valuation Dept.');
      return { step: 'stamp-duty', stepIndex: 5, progress: 72, outstanding };
    }
    outstanding.push('Upload signed Tenancy Agreement');
    outstanding.push('Submit stamp duty via IRD portal');
    outstanding.push('File CR109');
    return { step: 'tenancy-agreement', stepIndex: 4, progress: 57, outstanding };
  }

  if (t.stampDutyPaid && !t.cr109Filed) {
    outstanding.push('File CR109 with Rating & Valuation Dept.');
    return { step: 'cr109', stepIndex: 6, progress: 86, outstanding };
  }

  if (t.stampDutyPaid && t.cr109Filed) {
    return { step: 'cr109', stepIndex: 6, progress: 100, outstanding: [] };
  }

  outstanding.push('Submit stamp duty via IRD portal');
  return { step: 'stamp-duty', stepIndex: 5, progress: 72, outstanding };
}

function buildTenancyRecords(properties: Property[]): TenancyRecord[] {
  return properties
    .filter((p) => p.occupancyStatus === 'leased' || p.occupancyStatus === 'with-ta' || p.status === 'leased')
    .map((prop) => {
      const { step, stepIndex, progress, outstanding } = deriveWorkflowState(prop);
      const t = prop.tenant;
      return {
        property: prop,
        currentStep: step,
        currentStepIndex: stepIndex,
        progressPercent: progress,
        outstandingActions: outstanding,
        agent: prop.updatedBy || agentNames[0],
        leaseStart: t?.leaseStart ?? '—',
        leaseEnd: t?.leaseEnd ?? '—',
        monthlyRent: prop.monthlyRent ?? 0,
        tenantName: t?.name ?? 'Unknown Tenant',
      };
    });
}

// ─── Progress Bar ──────────────────────────────────────────────────────────────

function ProgressBar({ percent }: { percent: number }) {
  const color =
    percent === 100
      ? 'bg-emerald-500'
      : percent >= 70
      ? 'bg-amber-400' :'bg-[#8B1A2B]';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[hsl(214,20%,92%)] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-[hsl(215,25%,18%)] w-8 text-right">{percent}%</span>
    </div>
  );
}

// ─── Step Badge ────────────────────────────────────────────────────────────────

function StepBadge({ step, stepIndex }: { step: WorkflowStep; stepIndex: number }) {
  const cfg = STEPS[stepIndex];
  const isComplete = stepIndex === STEPS.length - 1;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
        isComplete
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :'bg-[#8B1A2B]/8 text-[#8B1A2B] border border-[#8B1A2B]/20'
      }`}
    >
      <Icon name={cfg?.icon as Parameters<typeof Icon>[0]['name']} size={11} />
      {cfg?.shortLabel ?? step}
    </span>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

type FilterStatus = 'all' | 'in-progress' | 'completed' | 'needs-action';
type SortKey = 'progress' | 'leaseEnd' | 'rent' | 'tenant';

export default function ActiveTenanciesClient() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortKey, setSortKey] = useState<SortKey>('progress');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const allRecords = useMemo(() => buildTenancyRecords(mockProperties), []);

  const filtered = useMemo(() => {
    let list = [...allRecords];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.property.unit.toLowerCase().includes(q) ||
          r.property.building.toLowerCase().includes(q) ||
          r.tenantName.toLowerCase().includes(q) ||
          r.agent.toLowerCase().includes(q)
      );
    }

    // Filter
    if (filterStatus === 'completed') {
      list = list.filter((r) => r.progressPercent === 100);
    } else if (filterStatus === 'in-progress') {
      list = list.filter((r) => r.progressPercent > 0 && r.progressPercent < 100);
    } else if (filterStatus === 'needs-action') {
      list = list.filter((r) => r.outstandingActions.length > 0);
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'progress') cmp = a.progressPercent - b.progressPercent;
      else if (sortKey === 'rent') cmp = a.monthlyRent - b.monthlyRent;
      else if (sortKey === 'tenant') cmp = a.tenantName.localeCompare(b.tenantName);
      else if (sortKey === 'leaseEnd') cmp = a.leaseEnd.localeCompare(b.leaseEnd);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [allRecords, search, filterStatus, sortKey, sortDir]);

  const stats = useMemo(() => ({
    total: allRecords.length,
    completed: allRecords.filter((r) => r.progressPercent === 100).length,
    needsAction: allRecords.filter((r) => r.outstandingActions.length > 0).length,
    inProgress: allRecords.filter((r) => r.progressPercent > 0 && r.progressPercent < 100).length,
  }), [allRecords]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <Icon name="ChevronsUpDownIcon" size={13} className="text-[hsl(215,15%,65%)]" />;
    return <Icon name={sortDir === 'asc' ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={13} className="text-[#8B1A2B]" />;
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        {/* ── Header ── */}
        <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-[hsl(214,20%,88%)] bg-white">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h1 className="text-xl font-bold text-[hsl(215,25%,18%)]">Active Tenancies</h1>
              <p className="text-sm text-[hsl(215,15%,52%)] mt-0.5">
                Track workflow progress and outstanding actions for all active tenancies
              </p>
            </div>
            <Link
              href="/property-management"
              className="inline-flex items-center gap-1.5 text-sm text-[#8B1A2B] hover:text-[#6d1522] font-medium transition-colors"
            >
              <Icon name="ArrowLeftIcon" size={14} />
              Property Management
            </Link>
          </div>

          {/* ── Stats Row ── */}
          <div className="grid grid-cols-4 gap-3 mt-4">
            {[
              { label: 'Total Active', value: stats.total, icon: 'KeyIcon', color: 'text-[hsl(215,25%,18%)]', bg: 'bg-[hsl(210,15%,96%)]' },
              { label: 'In Progress', value: stats.inProgress, icon: 'ClockIcon', color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Needs Action', value: stats.needsAction, icon: 'AlertCircleIcon', color: 'text-[#8B1A2B]', bg: 'bg-[#8B1A2B]/6' },
              { label: 'Completed', value: stats.completed, icon: 'CheckCircleIcon', color: 'text-emerald-600', bg: 'bg-emerald-50' },
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
        <div className="flex-shrink-0 px-6 py-3 bg-white border-b border-[hsl(214,20%,88%)] flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-48 max-w-72">
            <Icon name="SearchIcon" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(215,15%,52%)]" />
            <input
              type="text"
              placeholder="Search tenant, property, agent…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-[hsl(214,20%,88%)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B] bg-white"
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1">
            {(['all', 'in-progress', 'needs-action', 'completed'] as FilterStatus[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilterStatus(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${
                  filterStatus === f
                    ? 'bg-[#8B1A2B] text-white'
                    : 'bg-[hsl(210,15%,96%)] text-[hsl(215,15%,45%)] hover:bg-[hsl(210,15%,92%)]'
                }`}
              >
                {f === 'all' ? 'All' : f === 'in-progress' ? 'In Progress' : f === 'needs-action' ? 'Needs Action' : 'Completed'}
              </button>
            ))}
          </div>

          <div className="ml-auto text-xs text-[hsl(215,15%,52%)]">
            {filtered.length} of {allRecords.length} tenancies
          </div>
        </div>

        {/* ── Table ── */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-full bg-[hsl(210,15%,96%)] flex items-center justify-center mb-3">
                <Icon name="KeyIcon" size={24} className="text-[hsl(215,15%,52%)]" />
              </div>
              <p className="text-sm font-medium text-[hsl(215,25%,18%)]">No tenancies found</p>
              <p className="text-xs text-[hsl(215,15%,52%)] mt-1">Try adjusting your search or filter</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[2fr_1.4fr_1.2fr_1fr_1.6fr_1.4fr_auto] gap-0 border-b border-[hsl(214,20%,88%)] bg-[hsl(210,15%,97%)]">
                {[
                  { label: 'Property / Tenant', key: null },
                  { label: 'Tenant', key: 'tenant' as SortKey },
                  { label: 'Current Step', key: null },
                  { label: 'Progress', key: 'progress' as SortKey },
                  { label: 'Lease Period', key: 'leaseEnd' as SortKey },
                  { label: 'Monthly Rent', key: 'rent' as SortKey },
                  { label: '', key: null },
                ].map((col, i) => (
                  <div
                    key={i}
                    onClick={() => col.key && toggleSort(col.key)}
                    className={`px-4 py-3 text-xs font-semibold text-[hsl(215,15%,45%)] uppercase tracking-wide flex items-center gap-1 ${col.key ? 'cursor-pointer hover:text-[#8B1A2B] select-none' : ''}`}
                  >
                    {col.label}
                    {col.key && <SortIcon k={col.key} />}
                  </div>
                ))}
              </div>

              {/* Rows */}
              {filtered.map((record) => {
                const isExpanded = expandedId === record.property.id;
                const address = `${record.property.unit}, ${record.property.building}`;

                return (
                  <div key={record.property.id} className="border-b border-[hsl(214,20%,88%)] last:border-b-0">
                    {/* Main row */}
                    <div className="grid grid-cols-[2fr_1.4fr_1.2fr_1fr_1.6fr_1.4fr_auto] gap-0 hover:bg-[hsl(210,15%,98%)] transition-colors">
                      {/* Property */}
                      <div className="px-4 py-3.5 flex flex-col justify-center">
                        <p className="text-sm font-semibold text-[hsl(215,25%,18%)] truncate">{address}</p>
                        <p className="text-xs text-[hsl(215,15%,52%)] truncate mt-0.5">{record.property.village ?? record.property.district}</p>
                        <p className="text-xs text-[hsl(215,15%,65%)] mt-0.5">Agent: {record.agent}</p>
                      </div>

                      {/* Tenant */}
                      <div className="px-4 py-3.5 flex flex-col justify-center">
                        <p className="text-sm font-medium text-[hsl(215,25%,18%)] truncate">{record.tenantName}</p>
                        {record.property.tenant?.idNumber && (
                          <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">{record.property.tenant.idNumber}</p>
                        )}
                      </div>

                      {/* Current Step */}
                      <div className="px-4 py-3.5 flex items-center">
                        <StepBadge step={record.currentStep} stepIndex={record.currentStepIndex} />
                      </div>

                      {/* Progress */}
                      <div className="px-4 py-3.5 flex flex-col justify-center">
                        <ProgressBar percent={record.progressPercent} />
                        <p className="text-xs text-[hsl(215,15%,52%)] mt-1">
                          Step {record.currentStepIndex + 1} of {STEPS.length}
                        </p>
                      </div>

                      {/* Lease Period */}
                      <div className="px-4 py-3.5 flex flex-col justify-center">
                        <p className="text-xs text-[hsl(215,15%,52%)]">Start</p>
                        <p className="text-sm font-medium text-[hsl(215,25%,18%)]">{record.leaseStart}</p>
                        <p className="text-xs text-[hsl(215,15%,52%)] mt-1">End</p>
                        <p className="text-sm font-medium text-[hsl(215,25%,18%)]">{record.leaseEnd}</p>
                      </div>

                      {/* Rent */}
                      <div className="px-4 py-3.5 flex flex-col justify-center">
                        {record.monthlyRent > 0 ? (
                          <>
                            <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">
                              HK${record.monthlyRent.toLocaleString()}
                            </p>
                            <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">/month</p>
                          </>
                        ) : (
                          <p className="text-sm text-[hsl(215,15%,52%)]">—</p>
                        )}
                      </div>

                      {/* Expand toggle */}
                      <div className="px-3 py-3.5 flex items-center">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : record.property.id)}
                          className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,92%)] transition-colors"
                          title={isExpanded ? 'Collapse' : 'View outstanding actions'}
                        >
                          <Icon
                            name={isExpanded ? 'ChevronUpIcon' : 'ChevronDownIcon'}
                            size={15}
                            className="text-[hsl(215,15%,52%)]"
                          />
                        </button>
                      </div>
                    </div>

                    {/* Expanded: outstanding actions + step pipeline */}
                    {isExpanded && (
                      <div className="bg-[hsl(210,15%,98%)] border-t border-[hsl(214,20%,88%)] px-4 py-4">
                        {/* Step pipeline */}
                        <div className="mb-4">
                          <p className="text-xs font-semibold text-[hsl(215,15%,45%)] uppercase tracking-wide mb-2">Workflow Pipeline</p>
                          <div className="flex items-center gap-0 overflow-x-auto pb-1">
                            {STEPS.map((step, idx) => {
                              const isDone = idx < record.currentStepIndex;
                              const isCurrent = idx === record.currentStepIndex;
                              const isPending = idx > record.currentStepIndex;
                              return (
                                <React.Fragment key={step.id}>
                                  <div className="flex flex-col items-center min-w-[72px]">
                                    <div
                                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                                        isDone
                                          ? 'bg-emerald-500 border-emerald-500 text-white'
                                          : isCurrent
                                          ? 'bg-[#8B1A2B] border-[#8B1A2B] text-white'
                                          : 'bg-white border-[hsl(214,20%,85%)] text-[hsl(215,15%,65%)]'
                                      }`}
                                    >
                                      {isDone ? (
                                        <Icon name="CheckIcon" size={13} />
                                      ) : (
                                        <span>{idx + 1}</span>
                                      )}
                                    </div>
                                    <p
                                      className={`text-[10px] mt-1 text-center leading-tight ${
                                        isCurrent
                                          ? 'text-[#8B1A2B] font-semibold'
                                          : isDone
                                          ? 'text-emerald-600' :'text-[hsl(215,15%,60%)]'
                                      }`}
                                    >
                                      {step.shortLabel}
                                    </p>
                                  </div>
                                  {idx < STEPS.length - 1 && (
                                    <div
                                      className={`flex-1 h-0.5 min-w-[12px] mx-0.5 rounded-full ${
                                        idx < record.currentStepIndex ? 'bg-emerald-400' : 'bg-[hsl(214,20%,88%)]'
                                      }`}
                                    />
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </div>
                        </div>

                        {/* Outstanding actions */}
                        <div>
                          <p className="text-xs font-semibold text-[hsl(215,15%,45%)] uppercase tracking-wide mb-2">
                            Outstanding Actions
                          </p>
                          {record.outstandingActions.length === 0 ? (
                            <div className="flex items-center gap-2 text-emerald-600">
                              <Icon name="CheckCircleIcon" size={14} />
                              <span className="text-sm font-medium">All steps completed — tenancy fully processed</span>
                            </div>
                          ) : (
                            <ul className="space-y-1.5">
                              {record.outstandingActions.map((action, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <div className="w-4 h-4 rounded-full bg-[#8B1A2B]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <Icon name="AlertCircleIcon" size={10} className="text-[#8B1A2B]" />
                                  </div>
                                  <span className="text-sm text-[hsl(215,25%,18%)]">{action}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {/* Link to property */}
                        <div className="mt-3 pt-3 border-t border-[hsl(214,20%,88%)]">
                          <Link
                            href="/property-management"
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8B1A2B] hover:text-[#6d1522] transition-colors"
                          >
                            <Icon name="ExternalLinkIcon" size={12} />
                            Open in Property Management
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
