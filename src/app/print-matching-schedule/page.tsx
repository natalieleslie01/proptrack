'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { COMPANY } from '@/lib/company';

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
}

interface MatchScheduleData {
  clientName: string;
  clientMobile: string;
  clientBudget: string;
  properties: MatchedProperty[];
  printedAt: string;
}

function formatPrice(val: number | null): string {
  if (!val) return '—';
  if (val >= 1_000_000) return `HK$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `HK$${(val / 1_000).toFixed(0)}K`;
  return `HK$${val}`;
}

function statusLabel(status: string): string {
  switch (status) {
    case 'for-rent': return 'For Rent';
    case 'for-sale': return 'For Sale';
    case 'for-sale-and-rent': return 'For Sale & Rent';
    case 'leased': return 'Leased';
    case 'self-occupy': return 'Self Occupy';
    default: return status;
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'for-rent': return '#1d4ed8';
    case 'for-sale': return '#15803d';
    case 'for-sale-and-rent': return '#7e22ce';
    case 'leased': return '#b45309';
    default: return '#6b7280';
  }
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
      }, 600);
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

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 14mm 14mm; }
          .no-print { display: none !important; }
        }
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background: white; }
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

      <div style={{ padding: '32px', background: 'white', fontFamily: 'sans-serif', maxWidth: '794px', margin: '0 auto' }}>

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
              <p style={{ fontSize: '9px', fontWeight: 600, color: '#6b7a8d', textTransform: 'uppercase', letterSpacing: '2px', margin: '2px 0 0' }}>Property Viewing Schedule</p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '10px', color: '#6b7a8d', margin: 0 }}>Prepared: {printDate}</p>
            <p style={{ fontSize: '10px', color: '#6b7a8d', margin: '2px 0 0' }}>{data.properties.length} propert{data.properties.length === 1 ? 'y' : 'ies'} selected</p>
          </div>
        </div>

        {/* DIVIDER */}
        <div style={{ borderTop: '2px solid #1B4F8A', marginBottom: '16px' }} />

        {/* CLIENT INFO */}
        <div style={{ background: '#f0f4f9', borderRadius: '8px', padding: '12px 16px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
          <div>
            <p style={{ fontSize: '9px', fontWeight: 700, color: '#6b7a8d', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 2px' }}>Client</p>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#1a2a3a', margin: 0 }}>{data.clientName}</p>
          </div>
          {data.clientMobile && (
            <div>
              <p style={{ fontSize: '9px', fontWeight: 700, color: '#6b7a8d', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 2px' }}>Mobile</p>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a2a3a', fontFamily: 'monospace', margin: 0 }}>{data.clientMobile}</p>
            </div>
          )}
          {data.clientBudget && data.clientBudget !== '—' && (
            <div>
              <p style={{ fontSize: '9px', fontWeight: 700, color: '#6b7a8d', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 2px' }}>Budget</p>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a2a3a', margin: 0 }}>{data.clientBudget}</p>
            </div>
          )}
        </div>

        {/* PROPERTIES TABLE */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr style={{ background: '#1B4F8A', color: 'white' }}>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', borderRadius: '0' }}>#</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ref</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Location</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Beds</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Baths</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Area (ft²)</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Price</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Viewing Time</th>
            </tr>
          </thead>
          <tbody>
            {data.properties.map((prop, idx) => {
              const location = [
                prop.village,
                prop.phase,
                prop.block ? `Blk ${prop.block}` : null,
                prop.floor ? `Fl.${prop.floor}` : null,
                prop.unit ? `Unit ${prop.unit}` : null,
              ].filter(Boolean).join(' · ');
              const price = prop.askingRent ?? prop.askingPrice;
              const priceLabel = prop.askingRent
                ? `${formatPrice(prop.askingRent)}/mo`
                : formatPrice(prop.askingPrice);

              return (
                <tr
                  key={prop.id}
                  style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}
                >
                  <td style={{ padding: '10px 10px', color: '#6b7a8d', fontWeight: 600 }}>{idx + 1}</td>
                  <td style={{ padding: '10px 10px', fontWeight: 700, color: '#1a2a3a', fontFamily: 'monospace' }}>{prop.ref}</td>
                  <td style={{ padding: '10px 10px', color: '#374151', maxWidth: '180px' }}>{location || '—'}</td>
                  <td style={{ padding: '10px 10px' }}>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      color: statusColor(prop.status),
                      background: `${statusColor(prop.status)}18`,
                      padding: '2px 7px',
                      borderRadius: '999px',
                      border: `1px solid ${statusColor(prop.status)}30`,
                      whiteSpace: 'nowrap',
                    }}>
                      {statusLabel(prop.status)}
                    </span>
                  </td>
                  <td style={{ padding: '10px 10px', textAlign: 'center', color: '#1a2a3a', fontWeight: 600 }}>{prop.bedrooms ?? '—'}</td>
                  <td style={{ padding: '10px 10px', textAlign: 'center', color: '#1a2a3a', fontWeight: 600 }}>{prop.bathrooms ?? '—'}</td>
                  <td style={{ padding: '10px 10px', textAlign: 'center', color: '#1a2a3a' }}>{prop.saleableArea ? prop.saleableArea.toLocaleString() : '—'}</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: '#1a2a3a', whiteSpace: 'nowrap' }}>{price ? priceLabel : '—'}</td>
                  <td style={{ padding: '10px 10px', color: '#6b7a8d' }}>
                    {/* Blank line for handwriting */}
                    <span style={{ display: 'inline-block', borderBottom: '1px solid #c8d0da', width: '80px' }}>&nbsp;</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* FOOTER */}
        <div style={{ marginTop: '32px', borderTop: '1px solid #c8d0da', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <p style={{ fontSize: '9px', color: '#9ca3af', margin: 0 }}>
              This schedule was prepared by {COMPANY.name} for {data.clientName} on {printDate}.
            </p>
            <p style={{ fontSize: '9px', color: '#9ca3af', margin: '2px 0 0' }}>
              All prices are indicative and subject to change. Please confirm viewing times with the agent.
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '9px', color: '#9ca3af', margin: 0 }}>Agent Signature</p>
            <div style={{ borderBottom: '1px solid #c8d0da', width: '120px', marginTop: '20px' }} />
          </div>
        </div>

      </div>
    </>
  );
}
