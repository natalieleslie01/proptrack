'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { COMPANY } from '@/lib/company';
import { agentProfiles, AgentProfile } from '@/app/property-management/components/mockData';

interface MatchedProperty {
  id: string;
  ref: string;
  village: string;
  phase: string | null;
  block: string | null;
  floor: string | null;
  unit: string | null;
  address: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  saleableArea: number | null;
  askingPrice: number | null;
  askingRent: number | null;
  status: string;
  photoUrl?: string | null;
  yearBuilt?: string | number | null;
  view?: string | null;
  direction?: string | null;
  additionalFeatures?: string[];
  engRemark?: string | null;
}

interface MatchScheduleData {
  clientName: string;
  clientMobile: string;
  clientBudget: string;
  properties: MatchedProperty[];
  printedAt: string;
}

function formatPrice(val: number | null, isRent: boolean): string {
  if (!val) return '—';
  if (isRent) {
    if (val >= 1_000_000) return `HK$${(val / 1_000_000).toFixed(2)}M/mo`;
    if (val >= 1_000) return `HK$${(val / 1_000).toFixed(0)}K/mo`;
    return `HK$${val}/mo`;
  }
  if (val >= 1_000_000) return `HK$${(val / 1_000_000).toFixed(3)}M`;
  if (val >= 1_000) return `HK$${(val / 1_000).toFixed(0)}K`;
  return `HK$${val}`;
}

function hasMaidsRoom(features: string[] | undefined): boolean {
  if (!features) return false;
  return features.some((f) => f.toLowerCase().includes('maid'));
}

function getCarParking(features: string[] | undefined): string {
  if (!features) return 'N/A';
  const carFeature = features.find((f) =>
    f.toLowerCase().includes('car') || f.toLowerCase().includes('parking') || f.toLowerCase().includes('garage')
  );
  return carFeature ? '1' : 'N/A';
}

function parseAdvertisingRemarks(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\n|\r\n|\r|\*(?=\s)|•/)
    .map((l) => l.replace(/^\s*[\*•\-]\s*/, '').trim())
    .filter((l) => l.length > 3);
}

export default function PrintMatchingSchedulePage() {
  const [data, setData] = useState<MatchScheduleData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const encoded = params.get('data');
      if (!encoded) {
        setError('No schedule data found. Please go back and try again.');
        return;
      }
      const jsonStr = decodeURIComponent(escape(atob(encoded)));
      const parsed: MatchScheduleData = JSON.parse(jsonStr);
      setData(parsed);
    } catch {
      setError('Failed to load schedule data. The URL may be malformed.');
    }
  }, []);

  useEffect(() => {
    if (data) {
      const timer = setTimeout(() => {
        window.print();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [data]);

  if (error) {
    return (
      <div style={{ padding: '40px', fontFamily: 'sans-serif', color: '#333' }}>
        <h2>Print Error</h2>
        <p>{error}</p>
        <button onClick={() => window.close()} style={{ marginTop: '16px', padding: '8px 16px', cursor: 'pointer' }}>
          Close Tab
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: '40px', fontFamily: 'sans-serif', color: '#333' }}>
        <p>Loading schedule data...</p>
      </div>
    );
  }

  const printDate = new Date(data.printedAt).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  // Use default agent profile (Natalie Leslie)
  const agentProfile: AgentProfile | undefined = agentProfiles.find((a) => a.name === 'Natalie Leslie') ?? agentProfiles[0];

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm 12mm; }
          .no-print { display: none !important; }
        }
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; font-family: sans-serif; background: white; }
      `}</style>

      {/* Print button (screen only) */}
      <div className="no-print" style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 100, display: 'flex', gap: '8px' }}>
        <button
          onClick={() => window.print()}
          style={{ padding: '8px 16px', background: '#1B4F8A', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
        >
          🖨 Print
        </button>
        <button
          onClick={() => window.close()}
          style={{ padding: '8px 16px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}
        >
          Close
        </button>
      </div>

      <div style={{ padding: '28px', background: 'white', fontFamily: 'sans-serif', maxWidth: '794px', margin: '0 auto' }}>

        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image
              src="/assets/images/image-1780466751353.png"
              alt="Homes R Us logo"
              width={48}
              height={48}
              style={{ objectFit: 'contain' }}
              unoptimized
            />
            <div>
              <p style={{ fontSize: '18px', fontWeight: 900, color: '#1a2a3a', margin: 0, letterSpacing: '-0.5px' }}>{COMPANY.name}</p>
              <p style={{ fontSize: '9px', fontWeight: 600, color: '#6b7a8d', textTransform: 'uppercase', letterSpacing: '2px', margin: '2px 0 0' }}>Property</p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {agentProfile ? (
              <>
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#1a2a3a', margin: 0 }}>{agentProfile.name}</p>
                <p style={{ fontSize: '10px', color: '#6b7a8d', fontStyle: 'italic', margin: '2px 0 0' }}>
                  {agentProfile.name === 'Natalie Leslie' ? 'Principal Director' :
                   agentProfile.name === 'Nicola Baird' ? 'Senior Consultant' : 'Property Consultant'}
                </p>
                <p style={{ fontSize: '10px', color: '#4a5a6a', fontFamily: 'monospace', margin: '2px 0 0' }}>☎ {agentProfile.mobile}</p>
                <p style={{ fontSize: '10px', color: '#4a5a6a', margin: '2px 0 0' }}>{agentProfile.email}</p>
                <p style={{ fontSize: '9px', color: '#6b7a8d', fontFamily: 'monospace', margin: '2px 0 0' }}>{agentProfile.licenceNumber}</p>
              </>
            ) : (
              <p style={{ fontSize: '10px', color: '#6b7a8d' }}>—</p>
            )}
          </div>
        </div>

        {/* DIVIDER */}
        <div style={{ borderTop: '1px solid #c8d0da', marginBottom: '16px' }} />

        {/* CLIENT INFO */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', marginBottom: '16px' }}>
          <div>
            <span style={{ fontSize: '9px', fontWeight: 700, color: '#6b7a8d', textTransform: 'uppercase', letterSpacing: '1px' }}>Client: </span>
            <span style={{ fontSize: '10px', fontWeight: 600, color: '#1a2a3a' }}>{data.clientName}</span>
            {data.clientMobile && (
              <span style={{ fontSize: '10px', color: '#6b7a8d', fontFamily: 'monospace', marginLeft: '8px' }}>{data.clientMobile}</span>
            )}
          </div>
          {data.clientBudget && data.clientBudget !== '—' && (
            <div>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#6b7a8d', textTransform: 'uppercase', letterSpacing: '1px' }}>Budget: </span>
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#1a2a3a' }}>{data.clientBudget}</span>
            </div>
          )}
        </div>

        {/* PROPERTIES — card layout */}
        {data.properties.map((property, idx) => {
          const bedroomsLabel = property.bedrooms != null ? (property.bedrooms >= 5 ? '5+' : String(property.bedrooms)) : '—';
          const bathroomsLabel = property.bathrooms != null ? (property.bathrooms >= 4 ? '4+' : String(property.bathrooms)) : '—';
          const maidsRoom = hasMaidsRoom(property.additionalFeatures) ? 'Yes' : 'N/A';
          const carParking = getCarParking(property.additionalFeatures);

          const isRent = !!property.askingRent;
          const priceValue = property.askingRent ?? property.askingPrice;
          const priceDisplay = formatPrice(priceValue, isRent);

          const saleableArea = property.saleableArea ? `${property.saleableArea.toLocaleString()} sq.ft` : '—';
          const pricePerSqft = property.askingPrice && property.saleableArea
            ? `$${Math.round(property.askingPrice / property.saleableArea).toLocaleString()} sq.ft`
            : property.askingRent && property.saleableArea
            ? `$${Math.round(property.askingRent / property.saleableArea).toLocaleString()}/sqft`
            : '—';

          const propertyHeading = [
            property.village,
            property.phase,
            property.block ? `Blk ${property.block}` : null,
          ].filter(Boolean).join(', ');

          const subHeading = [
            property.floor ? `Fl.${property.floor}` : null,
            property.unit ? `Unit ${property.unit}` : null,
            property.address,
          ].filter(Boolean).join(' · ');

          const features = property.additionalFeatures ?? [];
          const advertisingText = property.engRemark ?? '';
          const advertisingBullets = parseAdvertisingRemarks(advertisingText);

          return (
            <div key={property.id} style={{ marginTop: idx > 0 ? '24px' : '0' }}>
              {idx > 0 && <div style={{ borderTop: '1px solid #d0d8e4', marginBottom: '20px' }} />}

              {/* Property heading row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#1a2a3a', margin: 0, letterSpacing: '-0.5px' }}>
                    {propertyHeading || property.village}
                  </h2>
                  {subHeading && (
                    <p style={{ fontSize: '11px', color: '#4a5a6a', margin: '2px 0 0' }}>
                      📍 {subHeading}
                    </p>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '16px' }}>
                  <p style={{ fontSize: '15px', fontWeight: 900, color: '#1a2a3a', margin: 0 }}>{priceDisplay}</p>
                </div>
              </div>

              {/* Specs + Photo */}
              <div style={{ display: 'flex', gap: '16px', marginTop: '8px', marginBottom: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Specs table */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #c8d0da', marginBottom: '8px', fontSize: '10px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #c8d0da' }}>
                        {['BEDS', 'BATHS', 'CAR', 'PRICE', 'SALEABLE AREA', 'PRICE/S.F.'].map((h) => (
                          <th key={h} style={{ fontSize: '8px', fontWeight: 700, color: '#6b7a8d', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 6px', borderRight: '1px solid #c8d0da', textAlign: 'left' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ fontSize: '11px', fontWeight: 700, color: '#1a2a3a', padding: '4px 6px', borderRight: '1px solid #c8d0da' }}>{bedroomsLabel}</td>
                        <td style={{ fontSize: '11px', fontWeight: 700, color: '#1a2a3a', padding: '4px 6px', borderRight: '1px solid #c8d0da' }}>{bathroomsLabel}</td>
                        <td style={{ fontSize: '11px', fontWeight: 700, color: '#1a2a3a', padding: '4px 6px', borderRight: '1px solid #c8d0da' }}>{carParking}</td>
                        <td style={{ fontSize: '10px', fontWeight: 700, color: '#1a2a3a', padding: '4px 6px', borderRight: '1px solid #c8d0da', fontFamily: 'monospace' }}>{priceDisplay}</td>
                        <td style={{ fontSize: '10px', fontWeight: 700, color: '#1a2a3a', padding: '4px 6px', borderRight: '1px solid #c8d0da', fontFamily: 'monospace' }}>{saleableArea}</td>
                        <td style={{ fontSize: '10px', fontWeight: 700, color: '#1a2a3a', padding: '4px 6px', fontFamily: 'monospace' }}>{pricePerSqft}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Extra details */}
                  <div style={{ display: 'flex', gap: '20px', marginBottom: '6px' }}>
                    <div>
                      <p style={{ fontSize: '8px', fontWeight: 700, color: '#6b7a8d', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>YEAR BUILT</p>
                      <p style={{ fontSize: '10px', fontWeight: 700, color: '#1a2a3a', margin: '2px 0 0' }}>{property.yearBuilt ?? '—'}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '8px', fontWeight: 700, color: '#6b7a8d', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>HELPERS ROOM</p>
                      <p style={{ fontSize: '10px', fontWeight: 700, color: '#1a2a3a', margin: '2px 0 0' }}>{maidsRoom}</p>
                    </div>
                    {property.view && (
                      <div>
                        <p style={{ fontSize: '8px', fontWeight: 700, color: '#6b7a8d', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>VIEW</p>
                        <p style={{ fontSize: '10px', fontWeight: 700, color: '#1a2a3a', margin: '2px 0 0' }}>{property.view}</p>
                      </div>
                    )}
                    {property.direction && (
                      <div>
                        <p style={{ fontSize: '8px', fontWeight: 700, color: '#6b7a8d', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>FACING</p>
                        <p style={{ fontSize: '10px', fontWeight: 700, color: '#1a2a3a', margin: '2px 0 0' }}>{property.direction}</p>
                      </div>
                    )}
                  </div>

                  {features.length > 0 && (
                    <div style={{ marginBottom: '6px' }}>
                      <p style={{ fontSize: '8px', fontWeight: 700, color: '#6b7a8d', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 2px' }}>FEATURES</p>
                      <p style={{ fontSize: '9px', color: '#2a3a4a', lineHeight: 1.6, margin: 0 }}>{features.join(', ')}</p>
                    </div>
                  )}

                  {advertisingBullets.length > 0 && (
                    <ul style={{ margin: '4px 0 0', padding: 0, listStyle: 'none' }}>
                      {advertisingBullets.slice(0, 6).map((bullet, i) => (
                        <li key={i} style={{ fontSize: '9px', color: '#2a3a4a', lineHeight: 1.5, display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                          <span style={{ flexShrink: 0 }}>*</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Photo */}
                <div style={{ flexShrink: 0, width: '190px' }}>
                  {property.photoUrl ? (
                    <div style={{ position: 'relative', width: '190px', height: '170px', border: '1px solid #c8d0da', overflow: 'hidden' }}>
                      <Image
                        src={property.photoUrl}
                        alt={`${property.village ?? ''} ${property.unit ?? ''}`}
                        fill
                        style={{ objectFit: 'cover' }}
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div style={{ width: '190px', height: '170px', border: '1px solid #c8d0da', background: '#f0f3f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <p style={{ fontSize: '9px', color: '#6b7a8d', margin: 0 }}>No photo available</p>
                    </div>
                  )}
                  <p style={{ fontSize: '8px', fontWeight: 700, color: '#6b7a8d', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right', margin: '4px 0 0' }}>
                    PROPERTY ID &nbsp;<span style={{ color: '#1a2a3a' }}>{property.ref || property.id}</span>
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {/* FOOTER */}
        <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #c8d0da' }}>
          <p style={{ fontSize: '8px', color: '#6b7a8d', lineHeight: 1.6, margin: 0 }}>
            A standard agency fee of 50% of one month&apos;s total rent is payable by both landlord and tenant upon signing a tenancy agreement. For sales, a 1% agency fee of the total purchase price is payable by both vendor and purchaser on completion. These particulars are for guidance only and do not form part of any offer or contract. All property details (including price, fees, rates, descriptions, and floor areas) are subject to change and should be verified by your solicitor before entering into any agreement. EA Licence {COMPANY.eaaLicense} · {COMPANY.name} · {COMPANY.address}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
            <p style={{ fontSize: '8px', color: '#6b7a8d', margin: 0 }}>{COMPANY.name} is a leading specialist in Hong Kong property.</p>
            <p style={{ fontSize: '8px', color: '#6b7a8d', fontFamily: 'monospace', margin: 0 }}>
              Printed: {new Date().toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' })}
            </p>
          </div>
        </div>

      </div>
    </>
  );
}
