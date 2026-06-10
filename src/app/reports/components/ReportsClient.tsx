'use client';

import React, { useState, useMemo } from 'react';
import Icon from '@/components/ui/AppIcon';
import AppLayout from '@/components/AppLayout';
import { mockProperties, getPropertyStatusLabel } from '@/app/property-management/components/mockData';
import { jsPDF } from 'jspdf';
import { COMPANY } from '@/lib/company';
import { toast } from 'sonner';

interface PropertyReport {
  propertyRef: string;
  address: string;
  building: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number;
  status: string;
  occupancyStatus: string;
  monthlyRent: number | null;
  salePrice: number | null;
  tenantName?: string;
  leaseStart?: string;
  leaseEnd?: string;
  landlordName: string;
  agentNotes: string;
  viewingsCount: number;
  enquiriesCount: number;
  daysOnMarket: number;
  vacancyRate: number;
}

interface CustomerCodeEntry {
  customerCode: string;
  contactName: string;
  relationship: string;
  mobile: string;
  email: string;
  properties: Array<{ ref: string; address: string; status: string; monthlyRent: number | null }>;
}

interface KeyNumberEntry {
  keyNumber: string;
  keyType: string;
  propertyRef: string;
  address: string;
  building: string;
  landlordName: string;
  status: string;
  occupancyStatus: string;
}

function buildReports(): PropertyReport[] {
  return mockProperties.slice(0, 20).map((p, i) => ({
    propertyRef: p.id.slice(0, 8).toUpperCase(),
    address: `${p.unit}, ${p.building}, ${p.street}`,
    building: p.building,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    sqft: p.sqft,
    status: p.status,
    occupancyStatus: p.occupancyStatus,
    monthlyRent: p.monthlyRent,
    salePrice: p.salePrice,
    tenantName: p.tenant?.name,
    leaseStart: p.tenant?.leaseStart,
    leaseEnd: p.tenant?.leaseEnd,
    landlordName: p.landlord.name,
    agentNotes: p.agentNotes,
    viewingsCount: 2 + (i % 8),
    enquiriesCount: 3 + (i % 12),
    daysOnMarket: 15 + (i * 7) % 120,
    vacancyRate: p.occupancyStatus === 'leased' ? 0 : Math.round(10 + (i * 5) % 40),
  }));
}

function buildCustomerCodeEntries(): CustomerCodeEntry[] {
  const map = new Map<string, CustomerCodeEntry>();
  for (const prop of mockProperties) {
    for (const contact of prop.contacts ?? []) {
      if (!contact.customerCode) continue;
      const code = contact.customerCode.trim();
      if (!map.has(code)) {
        map.set(code, {
          customerCode: code,
          contactName: contact.name,
          relationship: contact.relationship,
          mobile: contact.mobile,
          email: contact.email,
          properties: [],
        });
      }
      map.get(code)!.properties.push({
        ref: prop.id.slice(0, 8).toUpperCase(),
        address: `${prop.unit}, ${prop.building}`,
        status: prop.status,
        monthlyRent: prop.monthlyRent,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.customerCode.localeCompare(b.customerCode));
}

function buildKeyNumberEntries(): KeyNumberEntry[] {
  const entries: KeyNumberEntry[] = [];
  for (const prop of mockProperties) {
    if (prop.keyLocation?.keyNumber) {
      entries.push({
        keyNumber: prop.keyLocation.keyNumber,
        keyType: prop.keyLocation.type,
        propertyRef: prop.id.slice(0, 8).toUpperCase(),
        address: `${prop.unit}, ${prop.building}, ${prop.street}`,
        building: prop.building,
        landlordName: prop.landlord.name,
        status: prop.status,
        occupancyStatus: prop.occupancyStatus,
      });
    }
  }
  return entries.sort((a, b) => a.keyNumber.localeCompare(b.keyNumber));
}

async function generatePropertyPDF(report: PropertyReport): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = 0;

  doc.setFillColor(27, 79, 138);
  doc.rect(0, 0, pageW, 14, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('PROPTRACK HK — PROPERTY PERFORMANCE REPORT', margin, 9);
  doc.setTextColor(0, 0, 0);
  y = 20;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(27, 79, 138);
  doc.text('Property Performance Report', margin, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, margin, y);
  doc.text(`Ref: ${report.propertyRef}`, pageW - margin, y, { align: 'right' });
  y += 10;

  doc.setFillColor(240, 245, 255);
  doc.rect(margin, y, contentW, 7, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(27, 79, 138);
  doc.text('PROPERTY DETAILS', margin + 2, y + 5);
  doc.setTextColor(0, 0, 0);
  y += 11;

  const details = [
    ['Address', report.address],
    ['Building', report.building],
    ['Bedrooms / Bathrooms', `${report.bedrooms ?? 'N/A'} bed / ${report.bathrooms ?? 'N/A'} bath`],
    ['Floor Area', `${report.sqft.toLocaleString()} sq ft`],
    ['Status', getPropertyStatusLabel(report.status as Parameters<typeof getPropertyStatusLabel>[0])],
    ['Occupancy', report.occupancyStatus.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())],
    ['Landlord', report.landlordName],
  ];

  doc.setFontSize(9);
  details.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, margin + 55, y);
    y += 6;
  });
  y += 4;

  doc.setFillColor(240, 245, 255);
  doc.rect(margin, y, contentW, 7, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(27, 79, 138);
  doc.text('FINANCIAL SUMMARY', margin + 2, y + 5);
  doc.setTextColor(0, 0, 0);
  y += 11;

  doc.setFontSize(9);
  const financials = [
    ['Monthly Rent', report.monthlyRent ? `HK$${report.monthlyRent.toLocaleString()}` : 'N/A'],
    ['Sale Price', report.salePrice ? `HK$${report.salePrice.toLocaleString()}` : 'N/A'],
    ['Annual Rental Income', report.monthlyRent ? `HK$${(report.monthlyRent * 12).toLocaleString()}` : 'N/A'],
  ];
  financials.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, margin + 55, y);
    y += 6;
  });
  y += 4;

  if (report.tenantName) {
    doc.setFillColor(240, 245, 255);
    doc.rect(margin, y, contentW, 7, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(27, 79, 138);
    doc.text('CURRENT TENANCY', margin + 2, y + 5);
    doc.setTextColor(0, 0, 0);
    y += 11;

    doc.setFontSize(9);
    const tenancy = [
      ['Tenant', report.tenantName],
      ['Lease Start', report.leaseStart ?? 'N/A'],
      ['Lease End', report.leaseEnd ?? 'N/A'],
    ];
    tenancy.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(`${label}:`, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value, margin + 55, y);
      y += 6;
    });
    y += 4;
  }

  doc.setFillColor(240, 245, 255);
  doc.rect(margin, y, contentW, 7, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(27, 79, 138);
  doc.text('PERFORMANCE METRICS', margin + 2, y + 5);
  doc.setTextColor(0, 0, 0);
  y += 11;

  const metrics = [
    { label: 'Viewings', value: String(report.viewingsCount), color: [27, 79, 138] as [number, number, number] },
    { label: 'Enquiries', value: String(report.enquiriesCount), color: [139, 26, 43] as [number, number, number] },
    { label: 'Days on Market', value: String(report.daysOnMarket), color: [5, 150, 105] as [number, number, number] },
    { label: 'Vacancy Rate', value: `${report.vacancyRate}%`, color: [124, 58, 237] as [number, number, number] },
  ];

  const boxW = (contentW - 9) / 4;
  metrics.forEach((m, i) => {
    const bx = margin + i * (boxW + 3);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(bx, y, boxW, 18, 'FD');
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...m.color);
    doc.text(m.value, bx + boxW / 2, y + 11, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(m.label, bx + boxW / 2, y + 16, { align: 'center' });
  });
  doc.setTextColor(0, 0, 0);
  y += 24;

  if (report.agentNotes) {
    doc.setFillColor(240, 245, 255);
    doc.rect(margin, y, contentW, 7, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(27, 79, 138);
    doc.text('AGENT NOTES', margin + 2, y + 5);
    doc.setTextColor(0, 0, 0);
    y += 11;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(report.agentNotes, contentW);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 4;
  }

  doc.setFillColor(27, 79, 138);
  doc.rect(0, 282, pageW, 15, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`${COMPANY.name} · Discovery Bay, Hong Kong · Confidential`, pageW / 2, 291, { align: 'center' });

  doc.save(`PropTrack-Report-${report.propertyRef}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

async function generateCustomerCodePDF(entries: CustomerCodeEntry[], searchTerm: string): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = 0;

  doc.setFillColor(27, 79, 138);
  doc.rect(0, 0, pageW, 14, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('PROPTRACK HK — CUSTOMER CODE REPORT', margin, 9);
  doc.setTextColor(0, 0, 0);
  y = 20;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(27, 79, 138);
  doc.text('Customer Code Report', margin, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, margin, y);
  if (searchTerm) doc.text(`Filter: ${searchTerm}`, pageW - margin, y, { align: 'right' });
  y += 10;

  for (const entry of entries) {
    if (y > 250) {
      doc.addPage();
      y = 15;
    }
    doc.setFillColor(240, 245, 255);
    doc.rect(margin, y, contentW, 7, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(27, 79, 138);
    doc.text(`Customer Code: ${entry.customerCode}`, margin + 2, y + 5);
    doc.setTextColor(0, 0, 0);
    y += 11;

    doc.setFontSize(9);
    const contactInfo = [
      ['Contact Name', entry.contactName],
      ['Relationship', entry.relationship || 'N/A'],
      ['Mobile', entry.mobile || 'N/A'],
      ['Email', entry.email || 'N/A'],
      ['Properties Managed', String(entry.properties.length)],
    ];
    contactInfo.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(`${label}:`, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value, margin + 50, y);
      y += 5.5;
    });
    y += 2;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text('Properties:', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    for (const prop of entry.properties) {
      doc.text(`• ${prop.address} (${getPropertyStatusLabel(prop.status as Parameters<typeof getPropertyStatusLabel>[0])})${prop.monthlyRent ? ` — HK$${prop.monthlyRent.toLocaleString()}/mo` : ''}`, margin + 3, y);
      y += 5;
    }
    doc.setTextColor(0, 0, 0);
    y += 5;
  }

  doc.setFillColor(27, 79, 138);
  doc.rect(0, 282, pageW, 15, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`${COMPANY.name} · Discovery Bay, Hong Kong · Confidential`, pageW / 2, 291, { align: 'center' });

  doc.save(`PropTrack-CustomerCode-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

async function generateKeyNumberPDF(entries: KeyNumberEntry[], searchTerm: string): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = 297;
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = 0;

  doc.setFillColor(27, 79, 138);
  doc.rect(0, 0, pageW, 14, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('PROPTRACK HK — KEY NUMBER REPORT', margin, 9);
  doc.setTextColor(0, 0, 0);
  y = 20;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(27, 79, 138);
  doc.text('Key Number Report', margin, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, margin, y);
  if (searchTerm) doc.text(`Filter: ${searchTerm}`, pageW - margin, y, { align: 'right' });
  y += 10;

  // Table header
  doc.setFillColor(27, 79, 138);
  doc.rect(margin, y, contentW, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  const cols = [margin, margin + 25, margin + 55, margin + 120, margin + 175, margin + 215, margin + 245];
  ['Key #', 'Type', 'Address', 'Building', 'Landlord', 'Status', 'Occupancy'].forEach((h, i) => {
    doc.text(h, cols[i], y + 5);
  });
  doc.setTextColor(0, 0, 0);
  y += 10;

  doc.setFontSize(8);
  entries.forEach((entry, idx) => {
    if (y > 185) {
      doc.addPage();
      y = 15;
    }
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y - 2, contentW, 7, 'F');
    }
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(27, 79, 138);
    doc.text(entry.keyNumber, cols[0], y + 3);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(entry.keyType, cols[1], y + 3);
    doc.text(entry.address.slice(0, 35), cols[2], y + 3);
    doc.text(entry.building.slice(0, 25), cols[3], y + 3);
    doc.text(entry.landlordName.slice(0, 20), cols[4], y + 3);
    doc.text(getPropertyStatusLabel(entry.status as Parameters<typeof getPropertyStatusLabel>[0]), cols[5], y + 3);
    doc.text(entry.occupancyStatus.replace(/-/g, ' '), cols[6], y + 3);
    y += 7;
  });

  doc.setFillColor(27, 79, 138);
  doc.rect(0, 198, pageW, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`${COMPANY.name} · Discovery Bay, Hong Kong · Confidential`, pageW / 2, 206, { align: 'center' });

  doc.save(`PropTrack-KeyNumber-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

type ReportTab = 'properties' | 'customer-codes' | 'key-numbers';

export default function ReportsClient() {
  const [activeTab, setActiveTab] = useState<ReportTab>('properties');
  const [reports] = useState<PropertyReport[]>(buildReports);
  const [search, setSearch] = useState('');
  const [generating, setGenerating] = useState<string | null>(null);

  const allCustomerCodes = useMemo(() => buildCustomerCodeEntries(), []);
  const allKeyNumbers = useMemo(() => buildKeyNumberEntries(), []);

  const filteredReports = reports.filter((r) =>
    r.address.toLowerCase().includes(search.toLowerCase()) ||
    r.propertyRef.toLowerCase().includes(search.toLowerCase()) ||
    r.landlordName.toLowerCase().includes(search.toLowerCase())
  );

  const filteredCustomerCodes = allCustomerCodes.filter((e) =>
    e.customerCode.toLowerCase().includes(search.toLowerCase()) ||
    e.contactName.toLowerCase().includes(search.toLowerCase()) ||
    e.properties.some((p) => p.address.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredKeyNumbers = allKeyNumbers.filter((e) =>
    e.keyNumber.toLowerCase().includes(search.toLowerCase()) ||
    e.address.toLowerCase().includes(search.toLowerCase()) ||
    e.landlordName.toLowerCase().includes(search.toLowerCase())
  );

  async function handleGenerate(report: PropertyReport) {
    setGenerating(report.propertyRef);
    try {
      await generatePropertyPDF(report);
      toast.success(`Report generated for ${report.propertyRef}`);
    } catch {
      toast.error('Failed to generate PDF');
    } finally {
      setGenerating(null);
    }
  }

  async function handleGenerateAll() {
    setGenerating('all');
    try {
      for (const report of filteredReports.slice(0, 5)) {
        await generatePropertyPDF(report);
        await new Promise((r) => setTimeout(r, 300));
      }
      toast.success(`Generated ${Math.min(filteredReports.length, 5)} reports`);
    } catch {
      toast.error('Failed to generate reports');
    } finally {
      setGenerating(null);
    }
  }

  async function handleExportCustomerCodes() {
    setGenerating('customer-codes');
    try {
      await generateCustomerCodePDF(filteredCustomerCodes, search);
      toast.success('Customer Code report exported');
    } catch {
      toast.error('Failed to generate PDF');
    } finally {
      setGenerating(null);
    }
  }

  async function handleExportKeyNumbers() {
    setGenerating('key-numbers');
    try {
      await generateKeyNumberPDF(filteredKeyNumbers, search);
      toast.success('Key Number report exported');
    } catch {
      toast.error('Failed to generate PDF');
    } finally {
      setGenerating(null);
    }
  }

  const tabConfig: Array<{ id: ReportTab; label: string; icon: string; count: number }> = [
    { id: 'properties', label: 'Property Reports', icon: 'HomeIcon', count: reports.length },
    { id: 'customer-codes', label: 'Customer Codes', icon: 'TagIcon', count: allCustomerCodes.length },
    { id: 'key-numbers', label: 'Key Numbers', icon: 'KeyIcon', count: allKeyNumbers.length },
  ];

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[hsl(215,25%,18%)]">Reports</h1>
            <p className="text-sm text-[hsl(215,15%,52%)] mt-0.5">Generate PDF reports for properties, customer codes, and key numbers</p>
          </div>
          {activeTab === 'properties' && (
            <button
              onClick={handleGenerateAll}
              disabled={generating !== null}
              className="flex items-center gap-2 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6e] transition-colors disabled:opacity-50"
            >
              <Icon name="DownloadIcon" size={16} />
              {generating === 'all' ? 'Generating...' : 'Export Top 5'}
            </button>
          )}
          {activeTab === 'customer-codes' && (
            <button
              onClick={handleExportCustomerCodes}
              disabled={generating !== null || filteredCustomerCodes.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              <Icon name="DownloadIcon" size={16} />
              {generating === 'customer-codes' ? 'Generating...' : 'Export PDF'}
            </button>
          )}
          {activeTab === 'key-numbers' && (
            <button
              onClick={handleExportKeyNumbers}
              disabled={generating !== null || filteredKeyNumbers.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163d6e] transition-colors disabled:opacity-50"
            >
              <Icon name="DownloadIcon" size={16} />
              {generating === 'key-numbers' ? 'Generating...' : 'Export PDF'}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-[hsl(210,20%,97%)] p-1 rounded-xl border border-[hsl(214,20%,88%)]">
          {tabConfig.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSearch(''); }}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-[#1B4F8A] shadow-sm border border-[hsl(214,20%,88%)]'
                  : 'text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)]'
              }`}
            >
              <Icon name={tab.icon as Parameters<typeof Icon>[0]['name']} size={13} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-[#1B4F8A]/10 text-[#1B4F8A] text-[10px] font-semibold">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Icon name="SearchIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(215,15%,52%)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              activeTab === 'properties' ? 'Search properties...' :
              activeTab === 'customer-codes'? 'Search customer code or name...' : 'Search key number or address...'
            }
            className="pl-9 pr-4 py-2 bg-white border border-[hsl(214,20%,88%)] rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
          />
        </div>

        {/* ── Properties Tab ── */}
        {activeTab === 'properties' && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Properties', value: reports.length, color: 'text-[hsl(215,25%,18%)]', bg: 'bg-[hsl(210,20%,97%)]' },
                { label: 'Leased', value: reports.filter((r) => r.occupancyStatus === 'leased').length, color: 'text-green-600', bg: 'bg-green-50' },
                { label: 'Vacant', value: reports.filter((r) => r.occupancyStatus === 'vacant').length, color: 'text-orange-600', bg: 'bg-orange-50' },
                { label: 'Avg Viewings', value: Math.round(reports.reduce((s, r) => s + r.viewingsCount, 0) / reports.length), color: 'text-blue-600', bg: 'bg-blue-50' },
              ].map((s) => (
                <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-[hsl(215,15%,52%)] mt-1">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[hsl(210,20%,97%)] border-b border-[hsl(214,20%,88%)]">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Property</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide hidden sm:table-cell">Status</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide hidden md:table-cell">Rent</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide hidden lg:table-cell">Viewings</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide hidden lg:table-cell">Enquiries</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[hsl(214,20%,88%)]">
                    {filteredReports.map((r) => (
                      <tr key={r.propertyRef} className="hover:bg-[hsl(210,20%,97%)] transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[hsl(215,25%,18%)] text-xs">{r.address}</p>
                          <p className="text-xs text-[hsl(215,15%,52%)]">{r.propertyRef} · {r.landlordName}</p>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            r.occupancyStatus === 'leased' ? 'bg-green-100 text-green-700' :
                            r.occupancyStatus === 'vacant'? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {r.occupancyStatus.replace(/-/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right hidden md:table-cell">
                          <p className="text-xs font-semibold text-[hsl(215,25%,18%)]">
                            {r.monthlyRent ? `HK$${r.monthlyRent.toLocaleString()}` : '—'}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right hidden lg:table-cell text-xs text-[hsl(215,25%,18%)]">{r.viewingsCount}</td>
                        <td className="px-4 py-3 text-right hidden lg:table-cell text-xs text-[hsl(215,25%,18%)]">{r.enquiriesCount}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleGenerate(r)}
                            disabled={generating !== null}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B4F8A] text-white text-xs font-semibold hover:bg-[#163d6e] transition-colors disabled:opacity-50"
                          >
                            <Icon name="FileTextIcon" size={12} />
                            <span className="hidden sm:inline">{generating === r.propertyRef ? 'Generating...' : 'PDF'}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── Customer Codes Tab ── */}
        {activeTab === 'customer-codes' && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Unique Customer Codes', value: allCustomerCodes.length, color: 'text-amber-700', bg: 'bg-amber-50' },
                { label: 'Multi-Property Contacts', value: allCustomerCodes.filter((e) => e.properties.length > 1).length, color: 'text-[#1B4F8A]', bg: 'bg-blue-50' },
                { label: 'Properties Covered', value: allCustomerCodes.reduce((s, e) => s + e.properties.length, 0), color: 'text-green-700', bg: 'bg-green-50' },
              ].map((s) => (
                <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-[hsl(215,15%,52%)] mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {filteredCustomerCodes.length === 0 ? (
              <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-12 text-center">
                <Icon name="TagIcon" size={32} className="text-[hsl(215,15%,62%)] mx-auto mb-3" />
                <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">No customer codes found</p>
                <p className="text-xs text-[hsl(215,15%,52%)] mt-1">
                  {search ? 'Try a different search term' : 'Add customer codes to contacts in the property detail view'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCustomerCodes.map((entry) => (
                  <div key={entry.customerCode} className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
                    <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-sm font-mono font-bold border border-amber-200">
                          <Icon name="TagIcon" size={13} />
                          {entry.customerCode}
                        </span>
                        <span className="text-sm font-semibold text-[hsl(215,25%,18%)]">{entry.contactName}</span>
                        {entry.relationship && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white text-[hsl(215,15%,52%)] border border-[hsl(214,20%,88%)]">
                            {entry.relationship}
                          </span>
                        )}
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        entry.properties.length > 1 ? 'bg-[#1B4F8A]/10 text-[#1B4F8A]' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {entry.properties.length} {entry.properties.length === 1 ? 'property' : 'properties'}
                      </span>
                    </div>
                    <div className="px-4 py-3">
                      <div className="flex flex-wrap gap-4 mb-3 text-xs text-[hsl(215,15%,52%)]">
                        {entry.mobile && (
                          <span className="flex items-center gap-1">
                            <Icon name="SmartphoneIcon" size={11} />
                            {entry.mobile}
                          </span>
                        )}
                        {entry.email && (
                          <span className="flex items-center gap-1">
                            <Icon name="MailIcon" size={11} />
                            {entry.email}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        {entry.properties.map((prop, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 bg-[hsl(210,20%,98%)] rounded-lg border border-[hsl(214,20%,90%)]">
                            <div className="flex items-center gap-2">
                              <Icon name="HomeIcon" size={12} className="text-[#1B4F8A] flex-shrink-0" />
                              <span className="text-xs font-medium text-[hsl(215,25%,18%)]">{prop.address}</span>
                              <span className="text-[10px] font-mono text-[hsl(215,15%,62%)]">{prop.ref}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                                prop.status === 1 ? 'bg-green-100 text-green-700' :
                                prop.status === 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {getPropertyStatusLabel(prop.status as Parameters<typeof getPropertyStatusLabel>[0])}
                              </span>
                              {prop.monthlyRent && (
                                <span className="text-[10px] font-mono text-[hsl(215,25%,18%)]">HK${prop.monthlyRent.toLocaleString()}/mo</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Key Numbers Tab ── */}
        {activeTab === 'key-numbers' && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Total Keys Tracked', value: allKeyNumbers.length, color: 'text-amber-700', bg: 'bg-amber-50' },
                { label: 'Office Keys', value: allKeyNumbers.filter((e) => e.keyType === 'office').length, color: 'text-[#1B4F8A]', bg: 'bg-blue-50' },
                { label: 'With Agent / Landlord', value: allKeyNumbers.filter((e) => e.keyType !== 'office').length, color: 'text-green-700', bg: 'bg-green-50' },
              ].map((s) => (
                <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-[hsl(215,15%,52%)] mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {filteredKeyNumbers.length === 0 ? (
              <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-12 text-center">
                <Icon name="KeyIcon" size={32} className="text-[hsl(215,15%,62%)] mx-auto mb-3" />
                <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">No key numbers found</p>
                <p className="text-xs text-[hsl(215,15%,52%)] mt-1">
                  {search ? 'Try a different search term' : 'Key numbers are set in the property key location section'}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[hsl(210,20%,97%)] border-b border-[hsl(214,20%,88%)]">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Key #</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Type</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Property</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide hidden md:table-cell">Landlord</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide hidden sm:table-cell">Status</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide hidden lg:table-cell">Occupancy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[hsl(214,20%,88%)]">
                      {filteredKeyNumbers.map((entry, idx) => (
                        <tr key={`${entry.keyNumber}-${idx}`} className="hover:bg-[hsl(210,20%,97%)] transition-colors">
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 text-amber-800 text-xs font-mono font-bold border border-amber-200">
                              <Icon name="KeyIcon" size={11} />
                              {entry.keyNumber}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                              entry.keyType === 'office' ? 'bg-[#1B4F8A]/10 text-[#1B4F8A]' :
                              entry.keyType === 'agent'? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {entry.keyType}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-semibold text-[hsl(215,25%,18%)]">{entry.address}</p>
                            <p className="text-[10px] text-[hsl(215,15%,52%)] font-mono">{entry.propertyRef}</p>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <p className="text-xs text-[hsl(215,25%,18%)]">{entry.landlordName}</p>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                              entry.status === 1 ? 'bg-green-100 text-green-700' :
                              entry.status === 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {getPropertyStatusLabel(entry.status as Parameters<typeof getPropertyStatusLabel>[0])}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                              entry.occupancyStatus === 'leased' ? 'bg-green-100 text-green-700' :
                              entry.occupancyStatus === 'vacant'? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {entry.occupancyStatus.replace(/-/g, ' ')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
