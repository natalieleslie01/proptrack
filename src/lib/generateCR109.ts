'use client';

import { jsPDF } from 'jspdf';
import { COMPANY } from '@/lib/company';

export interface CR109Data {
  // Property
  propertyAddress: string;
  district: string;
  floor: string;
  sqft: string;
  // Landlord
  landlordName: string;
  landlordIdNumber: string;
  landlordAddress: string;
  landlordPhone: string;
  // Tenant
  tenantName: string;
  tenantIdNumber: string;
  tenantAddress: string;
  tenantPhone: string;
  // Tenancy
  monthlyRent: string;
  leaseStart: string;
  leaseEnd: string;
  includesRates: boolean;
  includesManagement: boolean;
  depositAmount: string;
  // Agent
  agentName: string;
  agentLicenceNumber: string;
}

async function loadLogoBase64(): Promise<string | null> {
  try {
    const response = await fetch('/assets/images/app_logo.png');
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateCR109PDF(data: CR109Data): Promise<void> {
  const logoBase64 = await loadLogoBase64();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = 15;

  // Header bar
  doc.setFillColor(27, 79, 138);
  doc.rect(0, 0, pageW, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('RATING AND VALUATION DEPARTMENT — HONG KONG', margin, 8);
  doc.setTextColor(0, 0, 0);

  // Logo
  y = 16;
  if (logoBase64) {
    const logoH = 14;
    const logoW = 40;
    doc.addImage(logoBase64, 'PNG', margin, y, logoW, logoH);
    y += logoH + 4;
  } else {
    y += 6;
  }

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(27, 79, 138);
  doc.text('FORM CR109', pageW / 2, y, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  y += 6;
  doc.setFontSize(10);
  doc.text('NOTICE OF NEW LETTING OR RENEWAL OF TENANCY AGREEMENT', pageW / 2, y, { align: 'center', maxWidth: contentW });
  y += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Rating and Valuation Department · Landlord and Tenant (Consolidation) Ordinance (Cap. 7)', pageW / 2, y, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  y += 8;

  // Important notice box
  doc.setFillColor(255, 235, 235);
  doc.setDrawColor(200, 80, 80);
  doc.setLineWidth(0.4);
  doc.rect(margin, y, contentW, 12, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bolditalic');
  doc.setTextColor(160, 40, 40);
  doc.text('IMPORTANT: This form must be submitted to the Commissioner of Rating and Valuation within 30 days of the commencement of the tenancy.', margin + 2, y + 4, { maxWidth: contentW - 4 });
  doc.text('Failure to submit may result in a fine. Submit to: Rating and Valuation Department, 15/F, Cheung Sha Wan Government Offices, 303 Cheung Sha Wan Road, Kowloon.', margin + 2, y + 9, { maxWidth: contentW - 4 });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  y += 16;

  // Section A: Property
  doc.setFillColor(240, 245, 255);
  doc.rect(margin, y, contentW, 6, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('PART A — PROPERTY DETAILS', margin + 2, y + 4);
  doc.setFont('helvetica', 'normal');
  y += 9;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Address of Premises:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.propertyAddress || '_______________________________________________', margin + 40, y, { maxWidth: contentW - 40 });
  doc.line(margin + 40, y + 0.5, margin + 40 + 115, y + 0.5);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('District:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.district || '_______________', margin + 16, y);
  doc.setFont('helvetica', 'bold');
  doc.text('Floor:', margin + 70, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.floor || '___', margin + 82, y);
  doc.setFont('helvetica', 'bold');
  doc.text('Saleable Area:', margin + 100, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.sqft ? `${data.sqft} sq.ft.` : '___ sq.ft.', margin + 126, y);
  y += 10;

  // Section B: Tenancy Details
  doc.setFillColor(240, 245, 255);
  doc.rect(margin, y, contentW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('PART B — TENANCY DETAILS', margin + 2, y + 4);
  doc.setFont('helvetica', 'normal');
  y += 9;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Commencement Date:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.leaseStart || '__/__/____', margin + 40, y);
  doc.setFont('helvetica', 'bold');
  doc.text('Expiry Date:', margin + 80, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.leaseEnd || '__/__/____', margin + 104, y);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('Monthly Rent:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.monthlyRent ? `HK$ ${Number(data.monthlyRent).toLocaleString()}` : 'HK$ _______________', margin + 28, y);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('Rent Inclusive of:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.rect(margin + 34, y - 3.5, 4, 4);
  if (data.includesRates) { doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('✓', margin + 34.5, y - 0.3); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); }
  doc.text('Government Rates', margin + 40, y);
  doc.rect(margin + 80, y - 3.5, 4, 4);
  if (data.includesManagement) { doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('✓', margin + 80.5, y - 0.3); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); }
  doc.text('Management Fees', margin + 86, y);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('Security Deposit:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.depositAmount ? `HK$ ${Number(data.depositAmount).toLocaleString()}` : 'HK$ _______________', margin + 34, y);
  y += 10;

  // Section C: Landlord
  doc.setFillColor(240, 245, 255);
  doc.rect(margin, y, contentW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('PART C — LANDLORD DETAILS', margin + 2, y + 4);
  doc.setFont('helvetica', 'normal');
  y += 9;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Name:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.landlordName || '___________________________', margin + 12, y);
  doc.setFont('helvetica', 'bold');
  doc.text('HKID / CR No.:', margin + 90, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.landlordIdNumber || '___________', margin + 118, y);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('Address:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.landlordAddress || '_______________________________________________', margin + 18, y, { maxWidth: contentW - 18 });
  doc.line(margin + 18, y + 0.5, margin + 18 + 140, y + 0.5);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('Phone:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.landlordPhone || '___________________________', margin + 14, y);
  y += 10;

  // Section D: Tenant
  doc.setFillColor(240, 245, 255);
  doc.rect(margin, y, contentW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('PART D — TENANT DETAILS', margin + 2, y + 4);
  doc.setFont('helvetica', 'normal');
  y += 9;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Name:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.tenantName || '___________________________', margin + 12, y);
  doc.setFont('helvetica', 'bold');
  doc.text('HKID No.:', margin + 90, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.tenantIdNumber || '___________', margin + 112, y);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('Address:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.tenantAddress || '_______________________________________________', margin + 18, y, { maxWidth: contentW - 18 });
  doc.line(margin + 18, y + 0.5, margin + 18 + 140, y + 0.5);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('Phone:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.tenantPhone || '___________________________', margin + 14, y);
  y += 10;

  // Section E: Agent
  doc.setFillColor(240, 245, 255);
  doc.rect(margin, y, contentW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('PART E — ESTATE AGENT DETAILS', margin + 2, y + 4);
  doc.setFont('helvetica', 'normal');
  y += 9;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Agency Name:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(COMPANY.name, margin + 26, y);
  doc.setFont('helvetica', 'bold');
  doc.text('EAA Licence:', margin + 90, y);
  doc.setFont('helvetica', 'normal');
  doc.text(COMPANY.eaaLicense, margin + 114, y);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('Handling Agent:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.agentName || '___________________________', margin + 30, y);
  doc.setFont('helvetica', 'bold');
  doc.text('Licence No.:', margin + 90, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.agentLicenceNumber || '___________', margin + 114, y);
  y += 12;

  // Signature section
  const sigY = y + 10;
  doc.line(margin, sigY, margin + 70, sigY);
  doc.setFontSize(8);
  doc.text('Signature of Landlord', margin, sigY + 4);
  doc.text('Date: _______________', margin, sigY + 9);

  doc.line(margin + 100, sigY, margin + 170, sigY);
  doc.text('Signature of Tenant', margin + 100, sigY + 4);
  doc.text('Date: _______________', margin + 100, sigY + 9);

  y = sigY + 20;

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(`Prepared by: ${COMPANY.name} · ${COMPANY.address} · ${COMPANY.phones[0]} · EAA Licence: ${COMPANY.eaaLicense}`, pageW / 2, 290, { align: 'center' });

  doc.save(`CR109_${data.tenantName || 'Tenant'}_${data.propertyAddress || 'Property'}.pdf`);
}
