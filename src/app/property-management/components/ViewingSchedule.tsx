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
}

type ScheduleMode = 'full-address' | 'village-only';

// Agent avatar colours for initials fallback
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

export default function ViewingSchedule({ property, onClose }: ViewingScheduleProps) {
  const [mode, setMode] = useState<ScheduleMode>('full-address');
  const [selectedAgent, setSelectedAgent] = useState<string>(agentNames[0]);
  const [client, setClient] = useState<ClientInfo>({ name: '', mobile: '' });
  const [viewingDate, setViewingDate] = useState<string>('');
  const [viewingTime, setViewingTime] = useState<string>('');
  const printRef = useRef<HTMLDivElement>(null);

  const agentProfile: AgentProfile | undefined = agentProfiles.find((a) => a.name === selectedAgent);

  const bedroomsLabel = property.bedrooms != null ? (property.bedrooms >= 5 ? '5+' : String(property.bedrooms)) : '—';
  const bathroomsLabel = property.bathrooms != null ? (property.bathrooms >= 4 ? '4+' : String(property.bathrooms)) : '—';

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

  const addressLabel = mode === 'full-address' ? 'Full Address' : 'Village';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      {/* Print Styles */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #viewing-schedule-print, #viewing-schedule-print * { visibility: visible !important; }
          #viewing-schedule-print { position: fixed; inset: 0; padding: 28px; background: white; }
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
          </div>

          {/* ─── PRINTABLE SCHEDULE ─────────────────────────────────────────── */}
          <div id="viewing-schedule-print" ref={printRef} className="p-6 bg-white">

            {/* ── TOP HEADER: Logo + Company Info ── */}
            <div className="flex items-center justify-between mb-5 pb-4 border-b-2 border-[#1B4F8A]">
              {/* Logo */}
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
              {/* Schedule Title */}
              <div className="text-right">
                <h1 className="text-xl font-bold text-[hsl(215,25%,18%)] tracking-tight">Viewing Schedule</h1>
                {(viewingDate || viewingTime) && (
                  <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5 font-mono">
                    {viewingDate && `${viewingDate}`}{viewingDate && viewingTime && ' · '}{viewingTime && `${viewingTime}`}
                  </p>
                )}
                <p className="text-[10px] text-[hsl(215,15%,62%)] mt-0.5">
                  EAA Lic: {COMPANY.eaaLicense} · Co: {COMPANY.companyLicense}
                </p>
              </div>
            </div>

            {/* ── PROPERTY PHOTO BANNER ── */}
            {propertyPhoto && (
              <div className="mb-5 rounded-xl overflow-hidden border border-[hsl(214,20%,88%)]">
                <div className="relative w-full h-44">
                  <Image
                    src={propertyPhoto}
                    alt={`${property.building} — ${property.unit}`}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  {/* Overlay badge */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3">
                    <p className="text-white font-bold text-sm leading-tight">
                      {property.building}{property.unit ? `, ${property.unit}` : ''}
                    </p>
                    <p className="text-white/80 text-xs">
                      {mode === 'full-address' ? addressLine : (property.village ?? property.district)}
                    </p>
                  </div>
                  {/* Ref badge */}
                  <div className="absolute top-3 right-3 bg-[#1B4F8A] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Ref: {property.id}
                  </div>
                </div>
              </div>
            )}

            {/* ── MAIN CONTENT: Property + Agent + Client ── */}
            <div className="grid grid-cols-2 gap-5 mb-5">

              {/* LEFT: Property Details */}
              <div>
                <p className="text-[10px] font-bold text-[#1B4F8A] uppercase tracking-wider mb-2.5 pb-1 border-b border-[hsl(214,20%,88%)]">Property Details</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[11px] text-[hsl(215,15%,52%)] flex-shrink-0">{addressLabel}</span>
                    <span className="text-xs font-semibold text-[hsl(215,25%,18%)] text-right">{addressLine}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-[11px] text-[hsl(215,15%,52%)]">Bedrooms</span>
                    <span className="text-xs font-semibold text-[hsl(215,25%,18%)]">{bedroomsLabel}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-[11px] text-[hsl(215,15%,52%)]">Bathrooms</span>
                    <span className="text-xs font-semibold text-[hsl(215,25%,18%)]">{bathroomsLabel}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-[11px] text-[hsl(215,15%,52%)]">Saleable Sq Ft</span>
                    <span className="text-xs font-semibold text-[hsl(215,25%,18%)] font-mono">{property.sqft.toLocaleString()} sq ft</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-[11px] text-[hsl(215,15%,52%)]">Age of Building</span>
                    <span className="text-xs font-semibold text-[hsl(215,25%,18%)]">
                      {new Date().getFullYear() - property.yearBuilt} yrs (Built {property.yearBuilt})
                    </span>
                  </div>
                  {property.direction && (
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[11px] text-[hsl(215,15%,52%)]">Direction</span>
                      <span className="text-xs font-semibold text-[hsl(215,25%,18%)]">{property.direction}</span>
                    </div>
                  )}
                  {property.outdoorArea && (
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[11px] text-[hsl(215,15%,52%)]">Outdoor Area</span>
                      <span className="text-xs font-semibold text-[hsl(215,25%,18%)]">{property.outdoorArea}</span>
                    </div>
                  )}
                  {property.monthlyRent && (
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[11px] text-[hsl(215,15%,52%)]">Monthly Rent</span>
                      <span className="text-xs font-semibold text-[hsl(215,25%,18%)] font-mono">HK${property.monthlyRent.toLocaleString()}</span>
                    </div>
                  )}
                  {property.salePrice && (
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[11px] text-[hsl(215,15%,52%)]">Sale Price</span>
                      <span className="text-xs font-semibold text-[hsl(215,25%,18%)] font-mono">HK${(property.salePrice / 1000000).toFixed(2)}M</span>
                    </div>
                  )}
                </div>

                {/* Additional Features */}
                {property.additionalFeatures && property.additionalFeatures.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] font-bold text-[#1B4F8A] uppercase tracking-wider mb-1.5 pb-1 border-b border-[hsl(214,20%,88%)]">Features</p>
                    <div className="flex flex-wrap gap-1">
                      {property.additionalFeatures.map((feat) => (
                        <span key={feat} className="text-[10px] px-2 py-0.5 rounded-full bg-[#1B4F8A]/10 text-[#1B4F8A] font-medium border border-[#1B4F8A]/20">
                          {feat}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT: Agent + Client */}
              <div className="space-y-4">

                {/* Agent Card */}
                <div>
                  <p className="text-[10px] font-bold text-[#1B4F8A] uppercase tracking-wider mb-2.5 pb-1 border-b border-[hsl(214,20%,88%)]">Your Agent</p>
                  {agentProfile ? (
                    <div className="flex items-start gap-3">
                      {/* Agent Avatar */}
                      <div className={`w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-bold text-sm ${agentAvatarColor(agentProfile.name)}`}>
                        {agentInitials(agentProfile.name)}
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <p className="text-sm font-bold text-[hsl(215,25%,18%)] leading-tight">{agentProfile.name}</p>
                        <div className="space-y-1">
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

                {/* Client Details */}
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
                  </div>
                </div>

                {/* Viewing Appointment Box */}
                {(viewingDate || viewingTime) && (
                  <div className="bg-[#1B4F8A]/6 border border-[#1B4F8A]/20 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-[#1B4F8A] uppercase tracking-wider mb-1.5">Appointment</p>
                    <div className="space-y-1">
                      {viewingDate && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-[hsl(215,15%,52%)] w-10 flex-shrink-0">Date</span>
                          <span className="text-xs font-bold text-[#1B4F8A] font-mono">{viewingDate}</span>
                        </div>
                      )}
                      {viewingTime && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-[hsl(215,15%,52%)] w-10 flex-shrink-0">Time</span>
                          <span className="text-xs font-bold text-[#1B4F8A] font-mono">{viewingTime}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── FOOTER ── */}
            <div className="pt-3 border-t border-[hsl(214,20%,88%)] flex items-center justify-between">
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
