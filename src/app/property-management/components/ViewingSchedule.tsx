'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import Icon from '@/components/ui/AppIcon';
import { Property, agentNames, agentProfiles, AgentProfile } from './mockData';
import { COMPANY } from '@/lib/company';
import { toast } from 'sonner';

interface ViewingScheduleProps {
  property: Property;
  onClose: () => void;
}

interface ClientInfo {
  name: string;
  mobile: string;
  email: string;
}

type ScheduleMode = 'full-address' | 'village-only';

const AVATAR_COLORS = [
  'bg-[#1B4F8A]',
  'bg-emerald-600',
  'bg-violet-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-teal-600',
];

function agentInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function agentAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function hasMaidsRoom(property: Property): boolean {
  if (!property.additionalFeatures) return false;
  return property.additionalFeatures.some((f) =>
    f.toLowerCase().includes('maid')
  );
}

export default function ViewingSchedule({ property, onClose }: ViewingScheduleProps) {
  const [mode, setMode] = useState<ScheduleMode>('full-address');
  const [selectedAgent, setSelectedAgent] = useState<string>(agentNames[0]);
  const [client, setClient] = useState<ClientInfo>({ name: '', mobile: '', email: '' });
  const [viewingDate, setViewingDate] = useState<string>('');
  const [viewingTime, setViewingTime] = useState<string>('');
  const [clientComments, setClientComments] = useState<string>('');
  const printRef = useRef<HTMLDivElement>(null);

  const agentProfile: AgentProfile | undefined = agentProfiles.find((a) => a.name === selectedAgent);

  const bedroomsLabel = property.bedrooms != null ? (property.bedrooms >= 5 ? '5+' : String(property.bedrooms)) : '—';
  const bathroomsLabel = property.bathrooms != null ? (property.bathrooms >= 4 ? '4+' : String(property.bathrooms)) : '—';
  const maidsRoom = hasMaidsRoom(property) ? 'Yes' : 'No';

  const propertyPhoto = property.photos && property.photos.length > 0 ? property.photos[0] : null;

  function handlePrint() {
    if (!client.name.trim()) {
      toast.error('Please enter the client name before printing');
      return;
    }
    window.print();
  }

  const addressLine =
    mode === 'full-address'
      ? `${property.unit}, ${property.building}, ${property.street}, ${property.district}`
      : (property.village ?? property.district);

  const priceDisplay = property.monthlyRent
    ? `HK$${property.monthlyRent.toLocaleString()}/mo`
    : property.salePrice
    ? `HK$${(property.salePrice / 1000000).toFixed(2)}M`
    : '—';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      {/* Print Styles — Portrait A4 */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 14mm 12mm; }
          body * { visibility: hidden !important; }
          #viewing-schedule-print, #viewing-schedule-print * { visibility: visible !important; }
          #viewing-schedule-print {
            position: fixed; inset: 0;
            background: white;
            width: 100%;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(214,20%,88%)] flex-shrink-0 no-print">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1B4F8A]/10 flex items-center justify-center">
              <Icon name="CalendarIcon" size={20} className="text-[#1B4F8A]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[hsl(215,25%,18%)]">Viewing Schedule</h2>
              <p className="text-xs text-[hsl(215,15%,52%)]">{property.unit}, {property.building}</p>
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
              <div>
                <label className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1.5 block">Viewing Time</label>
                <input
                  type="text"
                  value={viewingTime}
                  onChange={(e) => setViewingTime(e.target.value)}
                  placeholder="e.g. 2:30 PM"
                  className="input-base w-full font-mono"
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
          </div>

          {/* ─── PRINTABLE SCHEDULE (Portrait) ─────────────────────────────── */}
          <div id="viewing-schedule-print" ref={printRef} className="p-6 bg-white">

            {/* ── TOP HEADER: Client Left | Logo Center | Agent Right ── */}
            <div className="flex items-start justify-between mb-4 pb-3 border-b-2 border-[#1B4F8A]">

              {/* LEFT: Client Details */}
              <div className="w-[30%]">
                <p className="text-[9px] font-bold text-[#1B4F8A] uppercase tracking-wider mb-1.5 pb-0.5 border-b border-[#1B4F8A]/30">Client Details</p>
                <div className="space-y-0.5">
                  <p className="text-[11px] font-bold text-[hsl(215,25%,18%)] leading-tight">{client.name || '—'}</p>
                  {client.mobile && <p className="text-[10px] text-[hsl(215,15%,52%)] font-mono">{client.mobile}</p>}
                  {client.email && <p className="text-[10px] text-[hsl(215,15%,52%)]">{client.email}</p>}
                  {(viewingDate || viewingTime) && (
                    <div className="mt-1.5 bg-[#1B4F8A]/6 border border-[#1B4F8A]/20 rounded px-2 py-1">
                      <p className="text-[9px] font-bold text-[#1B4F8A] uppercase tracking-wider mb-0.5">Appointment</p>
                      {viewingDate && <p className="text-[10px] font-bold text-[#1B4F8A] font-mono">{viewingDate}{viewingTime ? ` · ${viewingTime}` : ''}</p>}
                    </div>
                  )}
                </div>
              </div>

              {/* CENTER: Homes R Us Logo */}
              <div className="flex flex-col items-center gap-1 w-[36%]">
                <div className="relative w-16 h-16 flex-shrink-0">
                  <Image
                    src="/assets/images/image-1780466751353.png"
                    alt="Homes R Us logo"
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
                <div className="text-center">
                  <p className="text-base font-extrabold text-[#1B4F8A] leading-tight">{COMPANY.name}</p>
                  <p className="text-[9px] text-[hsl(215,15%,52%)]">{COMPANY.address}</p>
                  <p className="text-[9px] text-[hsl(215,15%,52%)] font-mono">{COMPANY.phones[0]}</p>
                  <p className="text-[8px] text-[hsl(215,15%,62%)] mt-0.5">EAA: {COMPANY.eaaLicense} · Co: {COMPANY.companyLicense}</p>
                </div>
                <div className="mt-1 text-center">
                  <h1 className="text-sm font-bold text-[hsl(215,25%,18%)] tracking-tight uppercase">Viewing Schedule</h1>
                </div>
              </div>

              {/* RIGHT: Agent Details */}
              <div className="w-[30%] text-right">
                <p className="text-[9px] font-bold text-[#1B4F8A] uppercase tracking-wider mb-1.5 pb-0.5 border-b border-[#1B4F8A]/30">Your Agent</p>
                {agentProfile ? (
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-bold text-[hsl(215,25%,18%)] leading-tight">{agentProfile.name}</p>
                    <p className="text-[10px] text-[hsl(215,15%,52%)] font-mono">{agentProfile.mobile}</p>
                    <p className="text-[10px] text-[hsl(215,15%,52%)]">{agentProfile.email}</p>
                    <p className="text-[9px] text-[hsl(215,15%,62%)] font-mono">Lic: {agentProfile.licenceNumber}</p>
                  </div>
                ) : (
                  <p className="text-[10px] text-[hsl(215,15%,52%)]">—</p>
                )}
              </div>
            </div>

            {/* ── PROPERTY PHOTO ── */}
            {propertyPhoto ? (
              <div className="mb-4 rounded-xl overflow-hidden border border-[hsl(214,20%,88%)]">
                <div className="relative w-full h-52">
                  <Image
                    src={propertyPhoto}
                    alt={`${property.building} — ${property.unit}`}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3">
                    <p className="text-white font-bold text-sm leading-tight">
                      {property.building}{property.unit ? `, ${property.unit}` : ''}
                    </p>
                    <p className="text-white/80 text-xs">{addressLine}</p>
                  </div>
                  <div className="absolute top-3 right-3 bg-[#1B4F8A] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Ref: {property.id}
                  </div>
                  {/* Price badge */}
                  <div className="absolute top-3 left-3 bg-white/90 text-[#1B4F8A] text-[11px] font-bold px-2.5 py-1 rounded-full shadow">
                    {priceDisplay}
                  </div>
                </div>
              </div>
            ) : (
              /* No photo — show address banner */
              <div className="mb-4 rounded-xl bg-[#1B4F8A]/8 border border-[#1B4F8A]/20 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-[#1B4F8A]">{property.building}{property.unit ? `, ${property.unit}` : ''}</p>
                  <p className="text-xs text-[hsl(215,15%,52%)]">{addressLine}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#1B4F8A]">{priceDisplay}</p>
                  <p className="text-[10px] text-[hsl(215,15%,52%)]">Ref: {property.id}</p>
                </div>
              </div>
            )}

            {/* ── PROPERTY DETAILS GRID ── */}
            <div className="mb-4">
              <p className="text-[9px] font-bold text-[#1B4F8A] uppercase tracking-wider mb-2 pb-1 border-b border-[hsl(214,20%,88%)]">Property Details</p>
              <div className="grid grid-cols-4 gap-x-3 gap-y-2">

                {/* Price */}
                <div className="bg-[hsl(210,20%,97%)] rounded-lg px-2.5 py-2 text-center">
                  <p className="text-[9px] text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5">Price</p>
                  <p className="text-[11px] font-bold text-[#1B4F8A] font-mono leading-tight">{priceDisplay}</p>
                </div>

                {/* Beds */}
                <div className="bg-[hsl(210,20%,97%)] rounded-lg px-2.5 py-2 text-center">
                  <p className="text-[9px] text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5">Beds</p>
                  <p className="text-[13px] font-bold text-[hsl(215,25%,18%)] leading-tight">{bedroomsLabel}</p>
                </div>

                {/* Baths */}
                <div className="bg-[hsl(210,20%,97%)] rounded-lg px-2.5 py-2 text-center">
                  <p className="text-[9px] text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5">Baths</p>
                  <p className="text-[13px] font-bold text-[hsl(215,25%,18%)] leading-tight">{bathroomsLabel}</p>
                </div>

                {/* Maids Room */}
                <div className="bg-[hsl(210,20%,97%)] rounded-lg px-2.5 py-2 text-center">
                  <p className="text-[9px] text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5">Maid&apos;s Room</p>
                  <p className={`text-[11px] font-bold leading-tight ${maidsRoom === 'Yes' ? 'text-emerald-600' : 'text-[hsl(215,25%,18%)]'}`}>{maidsRoom}</p>
                </div>

                {/* Net Sqft */}
                <div className="bg-[hsl(210,20%,97%)] rounded-lg px-2.5 py-2 text-center">
                  <p className="text-[9px] text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5">Net Sq Ft</p>
                  <p className="text-[11px] font-bold text-[hsl(215,25%,18%)] font-mono leading-tight">{property.sqft ? property.sqft.toLocaleString() : '—'}</p>
                </div>

                {/* Gross Sqft */}
                <div className="bg-[hsl(210,20%,97%)] rounded-lg px-2.5 py-2 text-center">
                  <p className="text-[9px] text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5">Gross Sq Ft</p>
                  <p className="text-[11px] font-bold text-[hsl(215,25%,18%)] font-mono leading-tight">{property.grossSqft ? property.grossSqft.toLocaleString() : '—'}</p>
                </div>

                {/* Year Built */}
                <div className="bg-[hsl(210,20%,97%)] rounded-lg px-2.5 py-2 text-center">
                  <p className="text-[9px] text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5">Year Built</p>
                  <p className="text-[11px] font-bold text-[hsl(215,25%,18%)] leading-tight">{property.yearBuilt ?? '—'}</p>
                </div>

                {/* Direction */}
                <div className="bg-[hsl(210,20%,97%)] rounded-lg px-2.5 py-2 text-center">
                  <p className="text-[9px] text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5">Direction</p>
                  <p className="text-[11px] font-bold text-[hsl(215,25%,18%)] leading-tight">{property.direction ?? '—'}</p>
                </div>

                {/* View — spans 2 cols */}
                <div className="bg-[hsl(210,20%,97%)] rounded-lg px-2.5 py-2 text-center col-span-2">
                  <p className="text-[9px] text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5">View</p>
                  <p className="text-[11px] font-bold text-[hsl(215,25%,18%)] leading-tight">{property.view ?? '—'}</p>
                </div>

                {/* Address — spans 2 cols */}
                <div className="bg-[hsl(210,20%,97%)] rounded-lg px-2.5 py-2 col-span-2">
                  <p className="text-[9px] text-[hsl(215,15%,52%)] uppercase tracking-wider mb-0.5">Address</p>
                  <p className="text-[10px] font-semibold text-[hsl(215,25%,18%)] leading-tight">{addressLine}</p>
                </div>
              </div>
            </div>

            {/* ── ADDITIONAL FEATURES ── */}
            {property.additionalFeatures && property.additionalFeatures.length > 0 && (
              <div className="mb-4">
                <p className="text-[9px] font-bold text-[#1B4F8A] uppercase tracking-wider mb-1.5 pb-1 border-b border-[hsl(214,20%,88%)]">Additional Features</p>
                <div className="flex flex-wrap gap-1">
                  {property.additionalFeatures.map((feat) => (
                    <span key={feat} className="text-[9px] px-2 py-0.5 rounded-full bg-[#1B4F8A]/10 text-[#1B4F8A] font-medium border border-[#1B4F8A]/20">
                      {feat}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── CLIENT COMMENTS BOX ── */}
            <div className="mb-4">
              <p className="text-[9px] font-bold text-[#1B4F8A] uppercase tracking-wider mb-1.5 pb-1 border-b border-[hsl(214,20%,88%)]">Client Comments &amp; Notes</p>
              {clientComments ? (
                <p className="text-[11px] text-[hsl(215,25%,18%)] leading-relaxed whitespace-pre-wrap">{clientComments}</p>
              ) : (
                <div className="border border-dashed border-[hsl(214,20%,80%)] rounded-lg h-16 flex items-center justify-center">
                  <p className="text-[10px] text-[hsl(215,15%,68%)] italic">Space for client comments and feedback</p>
                </div>
              )}
            </div>

            {/* ── FOOTER ── */}
            <div className="pt-3 border-t border-[hsl(214,20%,88%)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative w-7 h-7 flex-shrink-0">
                  <Image
                    src="/assets/images/image-1780466751353.png"
                    alt="Homes R Us"
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
                <div>
                  <p className="text-[9px] font-semibold text-[hsl(215,25%,18%)]">{COMPANY.name} · {COMPANY.website}</p>
                  <p className="text-[8px] text-[hsl(215,15%,62%)]">
                    {mode === 'village-only' ? 'Full address available upon confirmed appointment. ' : ''}
                    EAA Lic: {COMPANY.eaaLicense}
                  </p>
                </div>
              </div>
              <p className="text-[8px] text-[hsl(215,15%,62%)] font-mono">
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
