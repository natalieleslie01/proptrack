'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import Icon from '@/components/ui/AppIcon';
import { Property, agentNames, agentProfiles, AgentProfile } from './mockData';
import { COMPANY } from '@/lib/company';
import { toast } from 'sonner';

interface BulkViewingScheduleProps {
  properties: Property[];
  onClose: () => void;
}

interface ClientInfo {
  name: string;
  mobile: string;
}

interface TimeValue {
  hour: number;   // 1–12
  minute: number; // 0–59
  period: 'AM' | 'PM';
}

type ScheduleMode = 'full-address' | 'village-only';

const AVATAR_COLORS = [
  'bg-[#1B4F8A]', 'bg-emerald-600', 'bg-violet-600',
  'bg-rose-600', 'bg-amber-600', 'bg-cyan-600',
];

function agentInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function agentAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatTime(t: TimeValue): string {
  const mm = String(t.minute).padStart(2, '0');
  return `${t.hour}:${mm} ${t.period}`;
}

function defaultTime(): TimeValue {
  return { hour: 9, minute: 0, period: 'AM' };
}

// ─── Structured Time Picker ───────────────────────────────────────────────────
interface TimePickerProps {
  value: TimeValue;
  onChange: (v: TimeValue) => void;
}

function TimePicker({ value, onChange }: TimePickerProps) {
  function incHour() {
    onChange({ ...value, hour: value.hour === 12 ? 1 : value.hour + 1 });
  }
  function decHour() {
    onChange({ ...value, hour: value.hour === 1 ? 12 : value.hour - 1 });
  }
  function incMinute() {
    onChange({ ...value, minute: value.minute === 55 ? 0 : value.minute + 5 });
  }
  function decMinute() {
    onChange({ ...value, minute: value.minute === 0 ? 55 : value.minute - 5 });
  }
  function togglePeriod() {
    onChange({ ...value, period: value.period === 'AM' ? 'PM' : 'AM' });
  }

  const mm = String(value.minute).padStart(2, '0');

  return (
    <div className="flex items-center gap-1 select-none">
      {/* Hour */}
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={incHour}
          className="w-6 h-5 flex items-center justify-center rounded hover:bg-[#1B4F8A]/10 text-[#1B4F8A] transition-colors"
          tabIndex={-1}
        >
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 5L5 1L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <span className="text-xs font-mono font-bold text-[hsl(215,25%,18%)] w-6 text-center leading-none py-0.5">
          {value.hour}
        </span>
        <button
          type="button"
          onClick={decHour}
          className="w-6 h-5 flex items-center justify-center rounded hover:bg-[#1B4F8A]/10 text-[#1B4F8A] transition-colors"
          tabIndex={-1}
        >
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      <span className="text-xs font-bold text-[hsl(215,25%,18%)] leading-none mb-0.5">:</span>

      {/* Minute */}
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={incMinute}
          className="w-6 h-5 flex items-center justify-center rounded hover:bg-[#1B4F8A]/10 text-[#1B4F8A] transition-colors"
          tabIndex={-1}
        >
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 5L5 1L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <span className="text-xs font-mono font-bold text-[hsl(215,25%,18%)] w-6 text-center leading-none py-0.5">
          {mm}
        </span>
        <button
          type="button"
          onClick={decMinute}
          className="w-6 h-5 flex items-center justify-center rounded hover:bg-[#1B4F8A]/10 text-[#1B4F8A] transition-colors"
          tabIndex={-1}
        >
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      {/* AM/PM toggle */}
      <button
        type="button"
        onClick={togglePeriod}
        className="ml-1 text-[10px] font-bold px-1.5 py-1 rounded border border-[#1B4F8A]/30 bg-[#1B4F8A]/8 text-[#1B4F8A] hover:bg-[#1B4F8A]/20 transition-colors leading-none"
        tabIndex={-1}
      >
        {value.period}
      </button>
    </div>
  );
}

export default function BulkViewingSchedule({ properties, onClose }: BulkViewingScheduleProps) {
  const [mode, setMode] = useState<ScheduleMode>('full-address');
  const [selectedAgent, setSelectedAgent] = useState<string>(agentNames[0]);
  const [client, setClient] = useState<ClientInfo>({ name: '', mobile: '' });
  const [viewingDate, setViewingDate] = useState<string>('');
  const [propertyTimes, setPropertyTimes] = useState<Record<string, TimeValue>>(() =>
    Object.fromEntries(properties.map((p) => [p.id, defaultTime()]))
  );
  const printRef = useRef<HTMLDivElement>(null);

  const agentProfile: AgentProfile | undefined = agentProfiles.find((a) => a.name === selectedAgent);

  function handlePrint() {
    if (!client.name.trim()) {
      toast.error('Please enter the client name before printing');
      return;
    }
    window.print();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      {/* Print Styles */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #bulk-viewing-schedule-print, #bulk-viewing-schedule-print * { visibility: visible !important; }
          #bulk-viewing-schedule-print { position: fixed; inset: 0; padding: 28px; background: white; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(214,20%,88%)] flex-shrink-0 no-print">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1B4F8A]/10 flex items-center justify-center">
              <Icon name="CalendarIcon" size={20} className="text-[#1B4F8A]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[hsl(215,25%,18%)]">Bulk Viewing Schedule</h2>
              <p className="text-xs text-[hsl(215,15%,52%)]">{properties.length} propert{properties.length === 1 ? 'y' : 'ies'} selected</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors">
            <Icon name="XIcon" size={18} className="text-[hsl(215,15%,52%)]" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="px-6 py-4 border-b border-[hsl(214,20%,88%)] space-y-4 no-print">
            {/* Mode Toggle */}
            <div>
              <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-2">Schedule Version</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setMode('full-address')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border-2 text-sm font-medium transition-all ${
                    mode === 'full-address' ?'border-[#1B4F8A] bg-[#1B4F8A]/8 text-[#1B4F8A]' :'border-[hsl(214,20%,88%)] text-[hsl(215,15%,52%)] hover:border-[#1B4F8A]/40'
                  }`}
                >
                  <Icon name="MapPinIcon" size={15} />
                  Full Address
                </button>
                <button
                  onClick={() => setMode('village-only')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border-2 text-sm font-medium transition-all ${
                    mode === 'village-only' ?'border-[#1B4F8A] bg-[#1B4F8A]/8 text-[#1B4F8A]' :'border-[hsl(214,20%,88%)] text-[hsl(215,15%,52%)] hover:border-[#1B4F8A]/40'
                  }`}
                >
                  <Icon name="EyeOffIcon" size={15} />
                  Village Only (Hide Address)
                </button>
              </div>
              {mode === 'village-only' && (
                <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                  <Icon name="InfoIcon" size={12} />
                  Full address will be hidden — only village/area name shown
                </p>
              )}
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1.5 block">Agent</label>
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="input-base w-full"
                >
                  {agentNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1.5 block">Viewing Date</label>
                <input
                  type="text"
                  value={viewingDate}
                  onChange={(e) => setViewingDate(e.target.value)}
                  placeholder="DD/MM/YYYY"
                  className="input-base w-full font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1.5 block">Client Name *</label>
                <input
                  type="text"
                  value={client.name}
                  onChange={(e) => setClient({ ...client, name: e.target.value })}
                  placeholder="Client full name"
                  className="input-base w-full"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1.5 block">Client Mobile</label>
                <input
                  type="text"
                  value={client.mobile}
                  onChange={(e) => setClient({ ...client, mobile: e.target.value })}
                  placeholder="+852 9xxx xxxx"
                  className="input-base w-full font-mono"
                />
              </div>
            </div>

            {/* Selected Properties with Individual Times */}
            <div>
              <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-2">Properties &amp; Viewing Times</p>
              <div className="space-y-2">
                {properties.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[hsl(210,20%,97%)] border border-[hsl(214,20%,88%)]"
                  >
                    <Icon name="HomeIcon" size={13} className="text-[#1B4F8A] flex-shrink-0" />
                    <span className="text-xs font-semibold text-[#1B4F8A] flex-1 min-w-0 truncate">
                      {p.unit}, {p.building}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Icon name="ClockIcon" size={12} className="text-[hsl(215,15%,52%)]" />
                      <div className="bg-white border border-[hsl(214,20%,88%)] rounded-lg px-2 py-1">
                        <TimePicker
                          value={propertyTimes[p.id] ?? defaultTime()}
                          onChange={(v) =>
                            setPropertyTimes((prev) => ({ ...prev, [p.id]: v }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── PRINTABLE SCHEDULE ─────────────────────────────────────────── */}
          <div id="bulk-viewing-schedule-print" ref={printRef} className="p-6 bg-white">

            {/* ── TOP HEADER: Logo + Company Info ── */}
            <div className="flex items-center justify-between mb-5 pb-4 border-b-2 border-[#1B4F8A]">
              <div className="flex items-center gap-3">
                <div className="relative w-14 h-14 flex-shrink-0">
                  <Image
                    src="/assets/images/image-1780466751353.png"
                    alt="Homes R Us logo"
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
                <div>
                  <p className="text-lg font-extrabold text-[#1B4F8A] leading-tight">{COMPANY.name}</p>
                  <p className="text-[10px] text-[hsl(215,15%,52%)]">{COMPANY.address}</p>
                  <p className="text-[10px] text-[hsl(215,15%,52%)] font-mono">{COMPANY.phones[0]}</p>
                </div>
              </div>
              <div className="text-right">
                <h1 className="text-xl font-bold text-[hsl(215,25%,18%)] tracking-tight">Viewing Schedule</h1>
                {(viewingDate) && (
                  <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5 font-mono">
                    {viewingDate}
                  </p>
                )}
                <p className="text-[10px] text-[hsl(215,15%,62%)] mt-0.5">
                  EAA Lic: {COMPANY.eaaLicense} · Co: {COMPANY.companyLicense}
                </p>
              </div>
            </div>

            {/* ── CLIENT + AGENT ROW ── */}
            <div className="grid grid-cols-2 gap-5 mb-5">
              {/* Client */}
              <div>
                <p className="text-[10px] font-bold text-[#1B4F8A] uppercase tracking-wider mb-2.5 pb-1 border-b border-[hsl(214,20%,88%)]">Client Details</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[hsl(215,15%,52%)] w-14 flex-shrink-0">Name</span>
                    <span className="text-[11px] font-semibold text-[hsl(215,25%,18%)]">{client.name || '—'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[hsl(215,15%,52%)] w-14 flex-shrink-0">Mobile</span>
                    <span className="text-[11px] font-semibold text-[hsl(215,25%,18%)] font-mono">{client.mobile || '—'}</span>
                  </div>
                  {(viewingDate) && (
                    <div className="mt-2 bg-[#1B4F8A]/6 border border-[#1B4F8A]/20 rounded-lg p-2.5">
                      <p className="text-[10px] font-bold text-[#1B4F8A] uppercase tracking-wider mb-1">Appointment</p>
                      {viewingDate && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-[hsl(215,15%,52%)] w-10 flex-shrink-0">Date</span>
                          <span className="text-xs font-bold text-[#1B4F8A] font-mono">{viewingDate}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Agent */}
              <div>
                <p className="text-[10px] font-bold text-[#1B4F8A] uppercase tracking-wider mb-2.5 pb-1 border-b border-[hsl(214,20%,88%)]">Your Agent</p>
                {agentProfile ? (
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-bold text-sm ${agentAvatarColor(agentProfile.name)}`}>
                      {agentInitials(agentProfile.name)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-bold text-[hsl(215,25%,18%)] leading-tight">{agentProfile.name}</p>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-[hsl(215,15%,52%)] w-14 flex-shrink-0">Licence</span>
                          <span className="text-[11px] font-semibold text-[hsl(215,25%,18%)] font-mono">{agentProfile.licenceNumber}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-[hsl(215,15%,52%)] w-14 flex-shrink-0">Mobile</span>
                          <span className="text-[11px] font-semibold text-[hsl(215,25%,18%)] font-mono">{agentProfile.mobile}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-[hsl(215,15%,52%)] w-14 flex-shrink-0">Email</span>
                          <span className="text-[11px] font-semibold text-[hsl(215,25%,18%)] break-all">{agentProfile.email}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[hsl(215,15%,52%)]">Agent details not found</p>
                )}
              </div>
            </div>

            {/* ── PROPERTIES LIST ── */}
            <div>
              <p className="text-[10px] font-bold text-[#1B4F8A] uppercase tracking-wider mb-3 pb-1 border-b border-[hsl(214,20%,88%)]">
                Properties to View ({properties.length})
              </p>
              <div className="space-y-3">
                {properties.map((property, idx) => {
                  const bedroomsLabel = property.bedrooms != null ? (property.bedrooms >= 5 ? '5+' : String(property.bedrooms)) : '—';
                  const bathroomsLabel = property.bathrooms != null ? (property.bathrooms >= 4 ? '4+' : String(property.bathrooms)) : '—';
                  const addressLine =
                    mode === 'full-address'
                      ? `${property.unit}, ${property.building}, ${property.street}, ${property.district}`
                      : (property.village ?? property.district);
                  const propTime = propertyTimes[property.id];

                  return (
                    <div
                      key={property.id}
                      className="border border-[hsl(214,20%,88%)] rounded-xl overflow-hidden"
                    >
                      <div className="flex items-center gap-3 px-3 py-2 bg-[hsl(210,20%,97%)] border-b border-[hsl(214,20%,88%)]">
                        <span className="w-5 h-5 rounded-full bg-[#1B4F8A] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-[hsl(215,25%,18%)] truncate">
                            {mode === 'village-only'
                              ? (property.village ?? property.building)
                              : `${property.unit}, ${property.building}`}
                          </p>
                          <p className="text-[10px] text-[hsl(215,15%,52%)] truncate">{addressLine}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {propTime && (
                            <span className="text-[10px] font-mono font-bold text-[#1B4F8A] bg-[#1B4F8A]/10 px-2 py-0.5 rounded-full">
                              {formatTime(propTime)}
                            </span>
                          )}
                          {property.ref && (
                            <span className="text-[10px] font-mono font-semibold text-[#1B4F8A] bg-[#1B4F8A]/10 px-1.5 py-0.5 rounded-full">
                              {property.ref}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="px-3 py-2 grid grid-cols-4 gap-x-4 gap-y-1">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-[hsl(215,15%,52%)]">Beds</span>
                          <span className="text-[11px] font-semibold text-[hsl(215,25%,18%)]">{bedroomsLabel}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-[hsl(215,15%,52%)]">Baths</span>
                          <span className="text-[11px] font-semibold text-[hsl(215,25%,18%)]">{bathroomsLabel}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-[hsl(215,15%,52%)]">Size</span>
                          <span className="text-[11px] font-semibold text-[hsl(215,25%,18%)] font-mono">{property.sqft.toLocaleString()} sf</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-[hsl(215,15%,52%)]">Built</span>
                          <span className="text-[11px] font-semibold text-[hsl(215,25%,18%)]">{property.yearBuilt}</span>
                        </div>
                        {property.monthlyRent && (
                          <div className="flex items-center gap-1 col-span-2">
                            <span className="text-[10px] text-[hsl(215,15%,52%)]">Rent</span>
                            <span className="text-[11px] font-semibold text-[hsl(215,25%,18%)] font-mono">HK${property.monthlyRent.toLocaleString()}/mo</span>
                          </div>
                        )}
                        {property.salePrice && (
                          <div className="flex items-center gap-1 col-span-2">
                            <span className="text-[10px] text-[hsl(215,15%,52%)]">Sale</span>
                            <span className="text-[11px] font-semibold text-[hsl(215,25%,18%)] font-mono">HK${(property.salePrice / 1000000).toFixed(2)}M</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── FOOTER ── */}
            <div className="mt-5 pt-3 border-t border-[hsl(214,20%,88%)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative w-8 h-8 flex-shrink-0">
                  <Image
                    src="/assets/images/image-1780466751353.png"
                    alt="Homes R Us"
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[hsl(215,25%,18%)]">{COMPANY.name} · {COMPANY.website}</p>
                  <p className="text-[9px] text-[hsl(215,15%,62%)]">
                    {mode === 'village-only' ? 'Full address available upon confirmed appointment. ' : ''}
                    EAA Lic: {COMPANY.eaaLicense}
                  </p>
                </div>
              </div>
              <p className="text-[9px] text-[hsl(215,15%,62%)] font-mono">
                Generated {new Date().toLocaleDateString('en-GB')}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[hsl(214,20%,88%)] bg-[hsl(210,20%,98%)] flex-shrink-0 no-print">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${mode === 'full-address' ? 'bg-[#1B4F8A]' : 'bg-amber-500'}`} />
            <span className="text-xs text-[hsl(215,15%,52%)]">
              {mode === 'full-address' ? 'Full address version' : 'Village-only version (address hidden)'}
              {' · '}{properties.length} propert{properties.length === 1 ? 'y' : 'ies'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-ghost py-1.5 text-xs">
              Cancel
            </button>
            <button onClick={handlePrint} className="btn-primary py-1.5 text-xs">
              <Icon name="PrinterIcon" size={13} />
              Print Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
