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

function hasMaidsRoom(property: Property): boolean {
  if (!property.additionalFeatures) return false;
  return property.additionalFeatures.some((f) =>
    f.toLowerCase().includes('maid')
  );
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
  // Split by common bullet/newline patterns
  const lines = text
    .split(/\n|\r\n|\r|\*(?=\s)|•/)
    .map((l) => l.replace(/^\s*[\*•\-]\s*/, '').trim())
    .filter((l) => l.length > 3);
  return lines;
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
  const maidsRoom = hasMaidsRoom(property) ? 'Yes' : 'N/A';
  const carParking = getCarParking(property);

  const propertyPhoto = property.photos && property.photos.length > 0 ? property.photos[0] : null;

  // Extended fields from DB mapping
  const extProp = property as Property & { engRemark?: string; chiRemark?: string };
  const advertisingText = extProp.engRemark || property.agentNotes || '';
  const advertisingBullets = parseAdvertisingRemarks(advertisingText);

  const saleableArea = property.sqft ? `${property.sqft.toLocaleString()} sq.ft` : '—';
  const priceDisplay = property.monthlyRent
    ? `HK$${property.monthlyRent.toLocaleString()}/mo`
    : property.salePrice
    ? `HK$${(property.salePrice / 1000000).toFixed(3)}M`
    : '—';

  const pricePerSqft = property.salePrice && property.sqft
    ? `$${Math.round(property.salePrice / property.sqft).toLocaleString()} sq.ft`
    : property.monthlyRent && property.sqft
    ? `$${Math.round(property.monthlyRent / property.sqft).toLocaleString()}/sqft`
    : '—';

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

  const propertyHeading = mode === 'full-address'
    ? `${property.building}${property.unit ? `, ${property.unit}` : ''}`
    : (property.village ?? property.building);

  const features = property.additionalFeatures ?? [];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      {/* Print Styles — Portrait A4 */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm 12mm; }
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

          {/* ─── PRINTABLE SCHEDULE — Habitat-style Portrait A4 ─────────────── */}
          <div id="viewing-schedule-print" ref={printRef} className="p-7 bg-white font-sans">

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

            {/* ── PROPERTY HEADING: Name left | Price right ── */}
            <div className="flex items-start justify-between mb-1">
              <div>
                <h2 className="text-[20px] font-black text-[hsl(215,25%,12%)] leading-tight tracking-tight">
                  {propertyHeading}
                </h2>
                {mode === 'full-address' && (
                  <p className="text-[11px] text-[hsl(215,15%,40%)] mt-0.5 flex items-center gap-1">
                    <span className="text-[#1B4F8A]">📍</span>
                    {property.street}{property.district ? `, ${property.district}` : ''}
                  </p>
                )}
              </div>
              <div className="text-right flex-shrink-0 ml-4">
                <p className="text-[16px] font-black text-[hsl(215,25%,12%)]">{priceDisplay}</p>
              </div>
            </div>

            {/* ── SPECS ROW + PHOTO (side by side) ── */}
            <div className="flex gap-4 mt-3 mb-3">
              {/* LEFT: Specs + details */}
              <div className="flex-1 min-w-0">
                {/* Specs table row */}
                <div className="border border-[hsl(215,15%,80%)] rounded-sm overflow-hidden mb-3">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[hsl(215,15%,80%)]">
                        <th className="text-[9px] font-bold text-[hsl(215,15%,45%)] uppercase tracking-wider px-2 py-1.5 border-r border-[hsl(215,15%,80%)]">BEDS</th>
                        <th className="text-[9px] font-bold text-[hsl(215,15%,45%)] uppercase tracking-wider px-2 py-1.5 border-r border-[hsl(215,15%,80%)]">BATHS</th>
                        <th className="text-[9px] font-bold text-[hsl(215,15%,45%)] uppercase tracking-wider px-2 py-1.5 border-r border-[hsl(215,15%,80%)]">CAR</th>
                        <th className="text-[9px] font-bold text-[hsl(215,15%,45%)] uppercase tracking-wider px-2 py-1.5 border-r border-[hsl(215,15%,80%)]">PRICE</th>
                        <th className="text-[9px] font-bold text-[hsl(215,15%,45%)] uppercase tracking-wider px-2 py-1.5 border-r border-[hsl(215,15%,80%)]">SALEABLE AREA</th>
                        <th className="text-[9px] font-bold text-[hsl(215,15%,45%)] uppercase tracking-wider px-2 py-1.5">PRICE/S.F.</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="text-[12px] font-bold text-[hsl(215,25%,18%)] px-2 py-1.5 border-r border-[hsl(215,15%,80%)]">{bedroomsLabel}</td>
                        <td className="text-[12px] font-bold text-[hsl(215,25%,18%)] px-2 py-1.5 border-r border-[hsl(215,15%,80%)]">{bathroomsLabel}</td>
                        <td className="text-[12px] font-bold text-[hsl(215,25%,18%)] px-2 py-1.5 border-r border-[hsl(215,15%,80%)]">{carParking}</td>
                        <td className="text-[11px] font-bold text-[hsl(215,25%,18%)] px-2 py-1.5 border-r border-[hsl(215,15%,80%)] font-mono">{priceDisplay}</td>
                        <td className="text-[11px] font-bold text-[hsl(215,25%,18%)] px-2 py-1.5 border-r border-[hsl(215,15%,80%)] font-mono">{saleableArea}</td>
                        <td className="text-[11px] font-bold text-[hsl(215,25%,18%)] px-2 py-1.5 font-mono">{pricePerSqft}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Year Built + Helpers Room row */}
                <div className="flex gap-6 mb-2">
                  <div>
                    <p className="text-[9px] font-bold text-[hsl(215,15%,45%)] uppercase tracking-wider">YEAR BUILT</p>
                    <p className="text-[11px] font-bold text-[hsl(215,25%,18%)]">{property.yearBuilt ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-[hsl(215,15%,45%)] uppercase tracking-wider">HELPERS ROOM</p>
                    <p className="text-[11px] font-bold text-[hsl(215,25%,18%)]">{maidsRoom}</p>
                  </div>
                  {property.view && (
                    <div>
                      <p className="text-[9px] font-bold text-[hsl(215,15%,45%)] uppercase tracking-wider">VIEW</p>
                      <p className="text-[11px] font-bold text-[hsl(215,25%,18%)]">{property.view}</p>
                    </div>
                  )}
                  {property.direction && (
                    <div>
                      <p className="text-[9px] font-bold text-[hsl(215,15%,45%)] uppercase tracking-wider">FACING</p>
                      <p className="text-[11px] font-bold text-[hsl(215,25%,18%)]">{property.direction}</p>
                    </div>
                  )}
                </div>

                {/* Features */}
                {features.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[9px] font-bold text-[hsl(215,15%,45%)] uppercase tracking-wider mb-1">FEATURES</p>
                    <p className="text-[10px] text-[hsl(215,25%,25%)] leading-relaxed">
                      {features.join(', ')}
                    </p>
                  </div>
                )}

                {/* Advertising Remarks as bullet points */}
                {advertisingBullets.length > 0 && (
                  <div className="mt-2">
                    <ul className="space-y-0.5">
                      {advertisingBullets.map((bullet, i) => (
                        <li key={i} className="text-[10px] text-[hsl(215,25%,25%)] leading-snug flex items-start gap-1.5">
                          <span className="text-[hsl(215,25%,25%)] mt-0.5 flex-shrink-0">*</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Viewing appointment info */}
                {(viewingDate || viewingTime || client.name) && (
                  <div className="mt-3 pt-2 border-t border-[hsl(215,15%,85%)]">
                    <p className="text-[9px] font-bold text-[hsl(215,15%,45%)] uppercase tracking-wider mb-1">VIEWING APPOINTMENT</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                      {client.name && <p className="text-[10px] text-[hsl(215,25%,18%)]"><span className="font-semibold">Client:</span> {client.name}</p>}
                      {viewingDate && <p className="text-[10px] text-[hsl(215,25%,18%)] font-mono"><span className="font-semibold">Date:</span> {viewingDate}</p>}
                      {viewingTime && <p className="text-[10px] text-[hsl(215,25%,18%)] font-mono"><span className="font-semibold">Time:</span> {viewingTime}</p>}
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT: Large property photo */}
              <div className="flex-shrink-0 w-[220px]">
                {propertyPhoto ? (
                  <div className="relative w-full h-[200px] border border-[hsl(215,15%,80%)] overflow-hidden">
                    <Image
                      src={propertyPhoto}
                      alt={`${property.building} — ${property.unit}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="w-full h-[200px] border border-[hsl(215,15%,80%)] bg-[hsl(210,20%,95%)] flex flex-col items-center justify-center gap-2">
                    <Icon name="HomeIcon" size={28} className="text-[hsl(215,15%,65%)]" />
                    <p className="text-[9px] text-[hsl(215,15%,55%)]">No photo available</p>
                  </div>
                )}
                {/* Property ID bottom right of photo */}
                <div className="flex justify-end mt-1">
                  <p className="text-[9px] font-bold text-[hsl(215,15%,45%)] uppercase tracking-wider">
                    PROPERTY ID &nbsp;<span className="text-[hsl(215,25%,18%)]">{property.ref || property.id}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* ── CLIENT COMMENTS BOX ── */}
            {clientComments && (
              <div className="mt-2 mb-3">
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
