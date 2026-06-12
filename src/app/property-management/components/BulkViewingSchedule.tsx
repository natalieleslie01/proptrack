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
  email: string;
}

interface TimeValue {
  hour: number;
  minute: number;
  period: 'AM' | 'PM';
}

type ScheduleMode = 'full-address' | 'village-only';

function formatTime(t: TimeValue): string {
  const mm = String(t.minute).padStart(2, '0');
  return `${t.hour}:${mm} ${t.period}`;
}

function defaultTime(): TimeValue {
  return { hour: 9, minute: 0, period: 'AM' };
}

function hasMaidsRoom(property: Property): boolean {
  if (!property.additionalFeatures) return false;
  return property.additionalFeatures.some((f) => f.toLowerCase().includes('maid'));
}

function getCarParking(property: Property): string {
  if (!property.additionalFeatures) return 'N/A';
  const carFeature = property.additionalFeatures.find((f) =>
    f.toLowerCase().includes('car') || f.toLowerCase().includes('parking') || f.toLowerCase().includes('garage')
  );
  return carFeature ? '1' : 'N/A';
}

function parseAdvertisingRemarks(text: string): string[] {
  if (!text) return [];
  const lines = text
    .split(/\n|\r\n|\r|\*(?=\s)|•/)
    .map((l) => l.replace(/^\s*[\*•\-]\s*/, '').trim())
    .filter((l) => l.length > 3);
  return lines;
}

// ─── Structured Time Picker ───────────────────────────────────────────────────
interface TimePickerProps {
  value: TimeValue;
  onChange: (v: TimeValue) => void;
}

function TimePicker({ value, onChange }: TimePickerProps) {
  function incHour() { onChange({ ...value, hour: value.hour === 12 ? 1 : value.hour + 1 }); }
  function decHour() { onChange({ ...value, hour: value.hour === 1 ? 12 : value.hour - 1 }); }
  function incMinute() { onChange({ ...value, minute: value.minute === 55 ? 0 : value.minute + 5 }); }
  function decMinute() { onChange({ ...value, minute: value.minute === 0 ? 55 : value.minute - 5 }); }
  function togglePeriod() { onChange({ ...value, period: value.period === 'AM' ? 'PM' : 'AM' }); }
  const mm = String(value.minute).padStart(2, '0');

  return (
    <div className="flex items-center gap-1 select-none">
      <div className="flex flex-col items-center">
        <button type="button" onClick={incHour} className="w-6 h-5 flex items-center justify-center rounded hover:bg-[#1B4F8A]/10 text-[#1B4F8A] transition-colors" tabIndex={-1}>
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 5L5 1L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <span className="text-xs font-mono font-bold text-[hsl(215,25%,18%)] w-6 text-center leading-none py-0.5">{value.hour}</span>
        <button type="button" onClick={decHour} className="w-6 h-5 flex items-center justify-center rounded hover:bg-[#1B4F8A]/10 text-[#1B4F8A] transition-colors" tabIndex={-1}>
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>
      <span className="text-xs font-bold text-[hsl(215,25%,18%)] leading-none mb-0.5">:</span>
      <div className="flex flex-col items-center">
        <button type="button" onClick={incMinute} className="w-6 h-5 flex items-center justify-center rounded hover:bg-[#1B4F8A]/10 text-[#1B4F8A] transition-colors" tabIndex={-1}>
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 5L5 1L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <span className="text-xs font-mono font-bold text-[hsl(215,25%,18%)] w-6 text-center leading-none py-0.5">{mm}</span>
        <button type="button" onClick={decMinute} className="w-6 h-5 flex items-center justify-center rounded hover:bg-[#1B4F8A]/10 text-[#1B4F8A] transition-colors" tabIndex={-1}>
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>
      <button type="button" onClick={togglePeriod} className="ml-1 text-[10px] font-bold px-1.5 py-1 rounded border border-[#1B4F8A]/30 bg-[#1B4F8A]/8 text-[#1B4F8A] hover:bg-[#1B4F8A]/20 transition-colors leading-none" tabIndex={-1}>
        {value.period}
      </button>
    </div>
  );
}

export default function BulkViewingSchedule({ properties, onClose }: BulkViewingScheduleProps) {
  const [mode, setMode] = useState<ScheduleMode>('full-address');
  const [selectedAgent, setSelectedAgent] = useState<string>(agentNames[0]);
  const [client, setClient] = useState<ClientInfo>({ name: '', mobile: '', email: '' });
  const [viewingDate, setViewingDate] = useState<string>('');
  const [clientComments, setClientComments] = useState<string>('');
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
      {/* Print Styles — Portrait A4 */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm 12mm; }
          body * { visibility: hidden !important; }
          #bulk-viewing-schedule-print, #bulk-viewing-schedule-print * { visibility: visible !important; }
          #bulk-viewing-schedule-print {
            position: fixed; inset: 0;
            background: white;
            width: 100%;
          }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
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
                    mode === 'full-address' ? 'border-[#1B4F8A] bg-[#1B4F8A]/8 text-[#1B4F8A]' : 'border-[hsl(214,20%,88%)] text-[hsl(215,15%,52%)] hover:border-[#1B4F8A]/40'
                  }`}
                >
                  <Icon name="MapPinIcon" size={15} />
                  Full Address
                </button>
                <button
                  onClick={() => setMode('village-only')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border-2 text-sm font-medium transition-all ${
                    mode === 'village-only' ? 'border-[#1B4F8A] bg-[#1B4F8A]/8 text-[#1B4F8A]' : 'border-[hsl(214,20%,88%)] text-[hsl(215,15%,52%)] hover:border-[#1B4F8A]/40'
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
              <div>
                <label className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1.5 block">Client Email</label>
                <input
                  type="text"
                  value={client.email}
                  onChange={(e) => setClient({ ...client, email: e.target.value })}
                  placeholder="client@email.com"
                  className="input-base w-full"
                />
              </div>
            </div>

            {/* Client Comments */}
            <div>
              <label className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1.5 block">Client Comments / Notes</label>
              <textarea
                value={clientComments}
                onChange={(e) => setClientComments(e.target.value)}
                placeholder="Client feedback, notes, or comments after viewing..."
                rows={3}
                className="input-base w-full resize-none"
              />
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
                          onChange={(v) => setPropertyTimes((prev) => ({ ...prev, [p.id]: v }))}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── PRINTABLE SCHEDULE — Habitat-style Portrait A4 ─────────────── */}
          <div id="bulk-viewing-schedule-print" ref={printRef} className="p-7 bg-white font-sans">

            {/* ── PAGE HEADER: Logo left | Agent right ── */}
            <div className="flex items-start justify-between mb-5">
              {/* LEFT: Company branding */}
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-12 flex-shrink-0">
                  <Image
                    src="/assets/images/image-1780466751353.png"
                    alt="Homes R Us logo"
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
                <div>
                  <p className="text-[18px] font-black text-[hsl(215,25%,12%)] leading-none tracking-tight">{COMPANY.name}</p>
                  <p className="text-[9px] font-semibold text-[hsl(215,15%,45%)] uppercase tracking-widest mt-0.5">Property</p>
                </div>
              </div>

              {/* RIGHT: Agent details */}
              <div className="text-right">
                {agentProfile ? (
                  <>
                    <p className="text-[12px] font-bold text-[hsl(215,25%,18%)] leading-tight">{agentProfile.name}</p>
                    <p className="text-[10px] text-[hsl(215,15%,45%)] italic">
                      {agentProfile.name === 'Natalie Leslie' ? 'Principal Director' :
                       agentProfile.name === 'Nicola Baird' ? 'Senior Consultant' : 'Property Consultant'}
                    </p>
                    <p className="text-[10px] text-[hsl(215,15%,40%)] font-mono mt-0.5">☎ {agentProfile.mobile}</p>
                    <p className="text-[10px] text-[hsl(215,15%,40%)]">{agentProfile.email}</p>
                    <p className="text-[9px] text-[hsl(215,15%,55%)] font-mono mt-0.5">{agentProfile.licenceNumber}</p>
                  </>
                ) : (
                  <p className="text-[10px] text-[hsl(215,15%,52%)]">—</p>
                )}
              </div>
            </div>

            {/* ── DIVIDER ── */}
            <div className="border-t border-[hsl(215,15%,75%)] mb-4" />

            {/* ── CLIENT INFO ── */}
            {(client.name || viewingDate) && (
              <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1">
                {client.name && (
                  <div>
                    <span className="text-[9px] font-bold text-[hsl(215,15%,45%)] uppercase tracking-wider">Client: </span>
                    <span className="text-[10px] font-semibold text-[hsl(215,25%,18%)]">{client.name}</span>
                    {client.mobile && <span className="text-[10px] text-[hsl(215,15%,45%)] font-mono ml-2">{client.mobile}</span>}
                  </div>
                )}
                {viewingDate && (
                  <div>
                    <span className="text-[9px] font-bold text-[hsl(215,15%,45%)] uppercase tracking-wider">Date: </span>
                    <span className="text-[10px] font-semibold text-[hsl(215,25%,18%)] font-mono">{viewingDate}</span>
                  </div>
                )}
              </div>
            )}

            {/* ── PROPERTIES LIST ── */}
            <div className="space-y-6">
              {properties.map((property, idx) => {
                const bedroomsLabel = property.bedrooms != null ? (property.bedrooms >= 5 ? '5+' : String(property.bedrooms)) : '—';
                const bathroomsLabel = property.bathrooms != null ? (property.bathrooms >= 4 ? '4+' : String(property.bathrooms)) : '—';
                const maidsRoom = hasMaidsRoom(property) ? 'Yes' : 'N/A';
                const carParking = getCarParking(property);
                const addressLine =
                  mode === 'full-address'
                    ? `${property.unit}, ${property.building}, ${property.street}, ${property.district}`
                    : (property.village ?? property.district);
                const propertyHeading = mode === 'full-address'
                  ? `${property.building}${property.unit ? `, ${property.unit}` : ''}`
                  : (property.village ?? property.building);
                const propTime = propertyTimes[property.id];
                const propertyPhoto = property.photos && property.photos.length > 0 ? property.photos[0] : null;
                const priceDisplay = property.monthlyRent
                  ? `HK$${property.monthlyRent.toLocaleString()}/mo`
                  : property.salePrice
                  ? `HK$${(property.salePrice / 1000000).toFixed(3)}M`
                  : '—';
                const saleableArea = property.sqft ? `${property.sqft.toLocaleString()} sq.ft` : '—';
                const pricePerSqft = property.salePrice && property.sqft
                  ? `$${Math.round(property.salePrice / property.sqft).toLocaleString()} sq.ft`
                  : property.monthlyRent && property.sqft
                  ? `$${Math.round(property.monthlyRent / property.sqft).toLocaleString()}/sqft`
                  : '—';
                const features = property.additionalFeatures ?? [];
                const extProp = property as Property & { engRemark?: string; chiRemark?: string };
                const advertisingText = extProp.engRemark || property.agentNotes || '';
                const advertisingBullets = parseAdvertisingRemarks(advertisingText);

                return (
                  <div key={property.id} className={idx > 0 ? 'page-break pt-4' : ''}>
                    {/* Property heading row */}
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <h2 className="text-[18px] font-black text-[hsl(215,25%,12%)] leading-tight tracking-tight">
                          {propertyHeading}
                        </h2>
                        {mode === 'full-address' && (
                          <p className="text-[11px] text-[hsl(215,15%,40%)] mt-0.5 flex items-center gap-1">
                            <span className="text-[#1B4F8A]">📍</span>
                            {property.street}{property.district ? `, ${property.district}` : ''}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0 ml-4 flex items-center gap-3">
                        {propTime && (
                          <span className="text-[10px] font-mono font-bold text-[#1B4F8A] bg-[#1B4F8A]/10 px-2 py-0.5 rounded-full border border-[#1B4F8A]/20">
                            {formatTime(propTime)}
                          </span>
                        )}
                        <p className="text-[15px] font-black text-[hsl(215,25%,12%)]">{priceDisplay}</p>
                      </div>
                    </div>

                    {/* Specs + Photo */}
                    <div className="flex gap-4 mt-2 mb-2">
                      {/* LEFT: Specs + details */}
                      <div className="flex-1 min-w-0">
                        {/* Specs table */}
                        <div className="border border-[hsl(215,15%,80%)] rounded-sm overflow-hidden mb-2">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-[hsl(215,15%,80%)]">
                                <th className="text-[8px] font-bold text-[hsl(215,15%,45%)] uppercase tracking-wider px-1.5 py-1 border-r border-[hsl(215,15%,80%)]">BEDS</th>
                                <th className="text-[8px] font-bold text-[hsl(215,15%,45%)] uppercase tracking-wider px-1.5 py-1 border-r border-[hsl(215,15%,80%)]">BATHS</th>
                                <th className="text-[8px] font-bold text-[hsl(215,15%,45%)] uppercase tracking-wider px-1.5 py-1 border-r border-[hsl(215,15%,80%)]">CAR</th>
                                <th className="text-[8px] font-bold text-[hsl(215,15%,45%)] uppercase tracking-wider px-1.5 py-1 border-r border-[hsl(215,15%,80%)]">PRICE</th>
                                <th className="text-[8px] font-bold text-[hsl(215,15%,45%)] uppercase tracking-wider px-1.5 py-1 border-r border-[hsl(215,15%,80%)]">SALEABLE AREA</th>
                                <th className="text-[8px] font-bold text-[hsl(215,15%,45%)] uppercase tracking-wider px-1.5 py-1">PRICE/S.F.</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td className="text-[11px] font-bold text-[hsl(215,25%,18%)] px-1.5 py-1 border-r border-[hsl(215,15%,80%)]">{bedroomsLabel}</td>
                                <td className="text-[11px] font-bold text-[hsl(215,25%,18%)] px-1.5 py-1 border-r border-[hsl(215,15%,80%)]">{bathroomsLabel}</td>
                                <td className="text-[11px] font-bold text-[hsl(215,25%,18%)] px-1.5 py-1 border-r border-[hsl(215,15%,80%)]">{carParking}</td>
                                <td className="text-[10px] font-bold text-[hsl(215,25%,18%)] px-1.5 py-1 border-r border-[hsl(215,15%,80%)] font-mono">{priceDisplay}</td>
                                <td className="text-[10px] font-bold text-[hsl(215,25%,18%)] px-1.5 py-1 border-r border-[hsl(215,15%,80%)] font-mono">{saleableArea}</td>
                                <td className="text-[10px] font-bold text-[hsl(215,25%,18%)] px-1.5 py-1 font-mono">{pricePerSqft}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* Year Built + Helpers Room + View */}
                        <div className="flex gap-5 mb-1.5">
                          <div>
                            <p className="text-[8px] font-bold text-[hsl(215,15%,45%)] uppercase tracking-wider">YEAR BUILT</p>
                            <p className="text-[10px] font-bold text-[hsl(215,25%,18%)]">{property.yearBuilt ?? '—'}</p>
                          </div>
                          <div>
                            <p className="text-[8px] font-bold text-[hsl(215,15%,45%)] uppercase tracking-wider">HELPERS ROOM</p>
                            <p className="text-[10px] font-bold text-[hsl(215,25%,18%)]">{maidsRoom}</p>
                          </div>
                          {property.view && (
                            <div>
                              <p className="text-[8px] font-bold text-[hsl(215,15%,45%)] uppercase tracking-wider">VIEW</p>
                              <p className="text-[10px] font-bold text-[hsl(215,25%,18%)]">{property.view}</p>
                            </div>
                          )}
                          {property.direction && (
                            <div>
                              <p className="text-[8px] font-bold text-[hsl(215,15%,45%)] uppercase tracking-wider">FACING</p>
                              <p className="text-[10px] font-bold text-[hsl(215,25%,18%)]">{property.direction}</p>
                            </div>
                          )}
                        </div>

                        {/* Features */}
                        {features.length > 0 && (
                          <div className="mb-1.5">
                            <p className="text-[8px] font-bold text-[hsl(215,15%,45%)] uppercase tracking-wider mb-0.5">FEATURES</p>
                            <p className="text-[9px] text-[hsl(215,25%,25%)] leading-relaxed">
                              {features.join(', ')}
                            </p>
                          </div>
                        )}

                        {/* Advertising Remarks */}
                        {advertisingBullets.length > 0 && (
                          <ul className="space-y-0.5 mt-1">
                            {advertisingBullets.slice(0, 6).map((bullet, i) => (
                              <li key={i} className="text-[9px] text-[hsl(215,25%,25%)] leading-snug flex items-start gap-1.5">
                                <span className="flex-shrink-0 mt-0.5">*</span>
                                <span>{bullet}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* RIGHT: Large property photo */}
                      <div className="flex-shrink-0 w-[190px]">
                        {propertyPhoto ? (
                          <div className="relative w-full h-[170px] border border-[hsl(215,15%,80%)] overflow-hidden">
                            <Image
                              src={propertyPhoto}
                              alt={`${property.building} ${property.unit}`}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div className="w-full h-[170px] border border-[hsl(215,15%,80%)] bg-[hsl(210,20%,95%)] flex flex-col items-center justify-center gap-2">
                            <Icon name="HomeIcon" size={24} className="text-[hsl(215,15%,65%)]" />
                            <p className="text-[9px] text-[hsl(215,15%,55%)]">No photo available</p>
                          </div>
                        )}
                        {/* Property ID bottom right */}
                        <div className="flex justify-end mt-0.5">
                          <p className="text-[8px] font-bold text-[hsl(215,15%,45%)] uppercase tracking-wider">
                            PROPERTY ID &nbsp;<span className="text-[hsl(215,25%,18%)]">{property.ref || property.id}</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Divider between properties */}
                    {idx < properties.length - 1 && (
                      <div className="border-t border-[hsl(215,15%,80%)] mt-4" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── CLIENT COMMENTS BOX ── */}
            {clientComments && (
              <div className="mt-4 mb-3">
                <p className="text-[9px] font-bold text-[hsl(215,15%,45%)] uppercase tracking-wider mb-1">CLIENT NOTES</p>
                <p className="text-[10px] text-[hsl(215,25%,25%)] leading-relaxed whitespace-pre-wrap">{clientComments}</p>
              </div>
            )}

            {/* ── FOOTER ── */}
            <div className="mt-4 pt-3 border-t border-[hsl(215,15%,75%)]">
              <p className="text-[8px] text-[hsl(215,15%,50%)] leading-relaxed">
                A standard agency fee of 50% of one month&apos;s total rent is payable by both landlord and tenant upon signing a tenancy agreement. For sales, a 1% agency fee of the total purchase price is payable by both vendor and purchaser on completion. These particulars are for guidance only and do not form part of any offer or contract. All property details (including price, fees, rates, descriptions, and floor areas) are subject to change and should be verified by your solicitor before entering into any agreement. EA Licence {COMPANY.eaaLicense} · {COMPANY.name} · {COMPANY.address}
              </p>
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-[8px] text-[hsl(215,15%,50%)]">{COMPANY.name} is a leading specialist in Hong Kong property.</p>
                <p className="text-[8px] text-[hsl(215,15%,50%)] font-mono">Printed Date: {new Date().toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' })}</p>
              </div>
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
