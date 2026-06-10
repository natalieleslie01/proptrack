'use client';

import { jsPDF } from 'jspdf';
import { COMPANY } from '@/lib/company';

export interface Form2Data {
  // Property
  propertyAddress: string;
  monthlyRent: string;
  leaseStart: string;
  leaseEnd: string;
  // Tenant
  tenantName: string;
  tenantIdNumber: string;
  tenantAddress: string;
  tenantPhone: string;
  // Landlord
  landlordName: string;
  landlordIdNumber: string;
  landlordAddress: string;
  // Agent
  agentName: string;
  agentLicenceNumber: string;
  // Deposit
  depositAmount: string;
  depositMethod: 'cheque' | 'transfer' | '';
  firstMonthMethod: 'cheque' | 'transfer' | '';
  // Agency relationship
  agencyRelationship: 'single' | 'dual' | 'potentially-dual';
}

function tick(doc: jsPDF, x: number, y: number, checked: boolean) {
  doc.rect(x, y, 4, 4);
  if (checked) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('✓', x + 0.5, y + 3.2);
    doc.setFont('helvetica', 'normal');
  }
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

export async function generateForm2PDF(data: Form2Data): Promise<void> {
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
  doc.text('ESTATE AGENTS ORDINANCE (CAP. 511)', margin, 8);
  doc.setTextColor(0, 0, 0);

  // Logo
  y = 16;
  if (logoBase64) {
    const logoH = 18;
    const logoW = 50;
    const logoX = (pageW - logoW) / 2;
    doc.addImage(logoBase64, 'PNG', logoX, y, logoW, logoH);
    y += logoH + 4;
  } else {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(27, 79, 138);
    doc.text(COMPANY.name, pageW / 2, y + 6, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 14;
  }

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('FORM 2', pageW / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(10);
  doc.text('LEASING INFORMATION FORM FOR PROSPECTIVE TENANTS', pageW / 2, y, { align: 'center', maxWidth: contentW });
  y += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('(To be provided to prospective tenants before entering into a tenancy agreement)', pageW / 2, y, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  y += 8;

  // Caution box
  doc.setFillColor(255, 248, 220);
  doc.setDrawColor(200, 160, 0);
  doc.setLineWidth(0.4);
  doc.rect(margin, y, contentW, 10, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bolditalic');
  doc.text('GENERAL CAUTION: You are advised to read and understand this Form before signing any tenancy agreement. If in doubt, consult a solicitor.', margin + 2, y + 4, { maxWidth: contentW - 4 });
  doc.setFont('helvetica', 'normal');
  y += 14;

  // Section 1: Property Details
  doc.setFillColor(240, 245, 255);
  doc.rect(margin, y, contentW, 6, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('1.  PROPERTY DETAILS', margin + 2, y + 4);
  doc.setFont('helvetica', 'normal');
  y += 9;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Property Address:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.propertyAddress || '_______________________________________________', margin + 36, y);
  doc.line(margin + 36, y + 0.5, margin + 36 + 120, y + 0.5);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('Monthly Rent:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.monthlyRent ? `HK$ ${Number(data.monthlyRent).toLocaleString()} per month` : 'HK$ _______________ per month', margin + 28, y);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('Lease Term:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`From: ${data.leaseStart || '__/__/____'}`, margin + 24, y);
  doc.text(`To: ${data.leaseEnd || '__/__/____'}`, margin + 80, y);
  y += 10;

  // Section 2: Landlord Details
  doc.setFillColor(240, 245, 255);
  doc.rect(margin, y, contentW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('2.  LANDLORD DETAILS', margin + 2, y + 4);
  doc.setFont('helvetica', 'normal');
  y += 9;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Landlord Name:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.landlordName || '___________________________', margin + 30, y);
  doc.line(margin + 30, y + 0.5, margin + 30 + 80, y + 0.5);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('HKID / CR No.:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.landlordIdNumber || '___________________________', margin + 28, y);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('Address:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.landlordAddress || '_______________________________________________', margin + 18, y, { maxWidth: contentW - 18 });
  doc.line(margin + 18, y + 0.5, margin + 18 + 140, y + 0.5);
  y += 10;

  // Section 3: Agent Details
  doc.setFillColor(240, 245, 255);
  doc.rect(margin, y, contentW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('3.  ESTATE AGENT DETAILS', margin + 2, y + 4);
  doc.setFont('helvetica', 'normal');
  y += 9;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Agency Name:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(COMPANY.name, margin + 26, y);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('EAA Licence:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(COMPANY.eaaLicense, margin + 24, y);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('Handling Agent:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.agentName || '___________________________', margin + 30, y);
  doc.setFont('helvetica', 'bold');
  doc.text('  Licence No.:', margin + 90, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.agentLicenceNumber || '___________', margin + 118, y);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('Agency Relationship:', margin, y);
  doc.setFont('helvetica', 'normal');
  tick(doc, margin + 40, y - 3.5, data.agencyRelationship === 'single');
  doc.text('Single agency', margin + 46, y);
  tick(doc, margin + 80, y - 3.5, data.agencyRelationship === 'dual');
  doc.text('Dual agency', margin + 86, y);
  tick(doc, margin + 118, y - 3.5, data.agencyRelationship === 'potentially-dual');
  doc.text('Potentially dual', margin + 124, y);
  y += 10;

  // Section 4: Deposit & Payment
  doc.setFillColor(240, 245, 255);
  doc.rect(margin, y, contentW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('4.  DEPOSIT & PAYMENT DETAILS', margin + 2, y + 4);
  doc.setFont('helvetica', 'normal');
  y += 9;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Security Deposit (2 months):', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.depositAmount ? `HK$ ${Number(data.depositAmount).toLocaleString()}` : 'HK$ _______________', margin + 54, y);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('Deposit Payment Method:', margin, y);
  doc.setFont('helvetica', 'normal');
  tick(doc, margin + 48, y - 3.5, data.depositMethod === 'cheque');
  doc.text('Cheque', margin + 54, y);
  tick(doc, margin + 80, y - 3.5, data.depositMethod === 'transfer');
  doc.text('Bank Transfer', margin + 86, y);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('1st Month Rent Payment:', margin, y);
  doc.setFont('helvetica', 'normal');
  tick(doc, margin + 48, y - 3.5, data.firstMonthMethod === 'cheque');
  doc.text('Cheque', margin + 54, y);
  tick(doc, margin + 80, y - 3.5, data.firstMonthMethod === 'transfer');
  doc.text('Bank Transfer', margin + 86, y);
  y += 10;

  // Section 5: Tenant Details
  doc.setFillColor(240, 245, 255);
  doc.rect(margin, y, contentW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('5.  PROSPECTIVE TENANT DETAILS', margin + 2, y + 4);
  doc.setFont('helvetica', 'normal');
  y += 9;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Tenant Name:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.tenantName || '___________________________', margin + 26, y);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('HKID No.:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.tenantIdNumber || '___________________________', margin + 20, y);
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
  y += 12;

  // Signature section
  doc.setFillColor(240, 245, 255);
  doc.rect(margin, y, contentW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('6.  ACKNOWLEDGEMENT', margin + 2, y + 4);
  doc.setFont('helvetica', 'normal');
  y += 9;

  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text('I/We acknowledge receipt of this Form 2 and confirm that the above information has been explained to me/us by the estate agent.', margin, y, { maxWidth: contentW });
  doc.setTextColor(0, 0, 0);
  y += 10;

  // Signature lines
  const sigY = y + 15;
  doc.line(margin, sigY, margin + 70, sigY);
  doc.setFontSize(8);
  doc.text('Signature of Prospective Tenant', margin, sigY + 4);
  doc.text('Date: _______________', margin, sigY + 9);

  doc.line(margin + 100, sigY, margin + 170, sigY);
  doc.text('Signature of Estate Agent', margin + 100, sigY + 4);
  doc.text('Date: _______________', margin + 100, sigY + 9);

  y = sigY + 20;

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(`${COMPANY.name} · ${COMPANY.address} · ${COMPANY.phones[0]} · EAA Licence: ${COMPANY.eaaLicense}`, pageW / 2, 290, { align: 'center' });

  doc.save(`Form2_${data.tenantName || 'Tenant'}_${data.propertyAddress || 'Property'}.pdf`);
}
