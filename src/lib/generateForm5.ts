'use client';

import { jsPDF } from 'jspdf';

export interface Form5Data {
  // Landlord
  landlordName: string;
  landlordIdNumber: string;
  landlordAddress: string;
  landlordPhone: string;
  // Agent
  agentName: string;
  agentLicenceNumber: string;
  agentAddress: string;
  agentPhone: string;
  // Property
  propertyAddress: string;
  // Agency type
  agencyType: 'exclusive' | 'non-exclusive';
  // Validity
  startDate: string;
  expiryDate: string;
  // Agency relationship
  agencyRelationship: 'single' | 'dual' | 'potentially-dual';
  // List rental
  listRentalWords: string;
  listRentalHKD: string;
  rentalIncludes: 'inclusive' | 'exclusive';
  // Commission
  commissionType: 'amount' | 'rate';
  commissionValue: string;
  commissionPayment: 'signing' | 'commencement';
  // Tick boxes
  allowViewingByAgent: boolean;
  allowViewingByTenant: boolean;
  passKeysToAgent: boolean;
  authorizePassKeysToOthers: boolean;
  authorizeSubListing: boolean;
  authorizeAdvertising: boolean;
  agentHasInterest: boolean;
  receivedLeasingInfoForm: boolean;
}

function numberToWords(num: number): string {
  if (num === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertChunk(n: number): string {
    if (n === 0) return '';
    if (n < 20) return ones[n] + ' ';
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '') + ' ';
    return ones[Math.floor(n / 100)] + ' Hundred ' + convertChunk(n % 100);
  }

  let result = '';
  if (num >= 1000000) {
    result += convertChunk(Math.floor(num / 1000000)) + 'Million ';
    num %= 1000000;
  }
  if (num >= 1000) {
    result += convertChunk(Math.floor(num / 1000)) + 'Thousand ';
    num %= 1000;
  }
  result += convertChunk(num);
  return result.trim() + ' Hong Kong Dollars Only';
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

export async function generateForm5PDF(data: Form5Data): Promise<void> {
  const logoBase64 = await loadLogoBase64();

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = 15;

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFillColor(27, 79, 138);
  doc.rect(0, 0, pageW, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('ESTATE AGENTS ORDINANCE (CAP. 511)', margin, 8);
  doc.setTextColor(0, 0, 0);

  // ── Logo ─────────────────────────────────────────────────────────────────────
  y = 16;
  if (logoBase64) {
    const logoH = 18;
    const logoW = 50;
    const logoX = (pageW - logoW) / 2;
    doc.addImage(logoBase64, 'PNG', logoX, y, logoW, logoH);
    y += logoH + 4;
  } else {
    // Fallback: company name text
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(27, 79, 138);
    doc.text('Homes R Us', pageW / 2, y + 6, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 14;
  }

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('FORM 5', pageW / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(10);
  doc.text('ESTATE AGENCY AGREEMENT FOR LEASING OF RESIDENTIAL PROPERTIES IN HONG KONG', pageW / 2, y, { align: 'center', maxWidth: contentW });
  y += 8;

  // General caution box
  doc.setFillColor(255, 248, 220);
  doc.setDrawColor(200, 160, 0);
  doc.setLineWidth(0.4);
  doc.rect(margin, y, contentW, 10, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bolditalic');
  doc.text('GENERAL CAUTION: You are advised to read and understand this Agreement before signing it. If in doubt, consult a solicitor.', margin + 2, y + 4, { maxWidth: contentW - 4 });
  doc.setFont('helvetica', 'normal');
  y += 14;

  // ── Section 1: Appointment ───────────────────────────────────────────────────
  doc.setFillColor(240, 245, 255);
  doc.rect(margin, y, contentW, 6, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('1.  APPOINTMENT OF AGENT AND VALIDITY PERIOD', margin + 2, y + 4);
  doc.setFont('helvetica', 'normal');
  y += 9;

  doc.setFontSize(8.5);
  doc.text('I/We,', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.text(data.landlordName || '________________________________', margin + 10, y);
  doc.setFont('helvetica', 'normal');
  doc.text('("Landlord") appoint', margin + 10 + Math.min(data.landlordName.length * 2.2, 70), y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.text(data.agentName || '________________________________', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text('("Agent") to market the following property for leasing:', margin + Math.min(data.agentName.length * 2.2, 80), y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Property:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.propertyAddress || '_______________________________________________', margin + 18, y);
  doc.line(margin + 18, y + 0.5, margin + 18 + 130, y + 0.5);
  y += 7;

  // Agency type
  doc.setFont('helvetica', 'bold');
  doc.text('Agency Type:', margin, y);
  doc.setFont('helvetica', 'normal');
  tick(doc, margin + 28, y - 3.5, data.agencyType === 'exclusive');
  doc.text('Exclusive', margin + 34, y);
  tick(doc, margin + 60, y - 3.5, data.agencyType === 'non-exclusive');
  doc.text('Non-exclusive', margin + 66, y);
  y += 7;

  // Validity period
  doc.setFont('helvetica', 'bold');
  doc.text('Validity Period:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text('From:', margin + 32, y);
  doc.text(data.startDate || '__/__/____', margin + 42, y);
  doc.line(margin + 42, y + 0.5, margin + 42 + 28, y + 0.5);
  doc.text('To:', margin + 76, y);
  doc.text(data.expiryDate || '__/__/____', margin + 84, y);
  doc.line(margin + 84, y + 0.5, margin + 84 + 28, y + 0.5);
  y += 10;

  // ── Section 2: Agency Relationship ──────────────────────────────────────────
  doc.setFillColor(240, 245, 255);
  doc.rect(margin, y, contentW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('2.  AGENCY RELATIONSHIP AND DUTIES', margin + 2, y + 4);
  doc.setFont('helvetica', 'normal');
  y += 9;

  doc.setFontSize(8.5);
  doc.text('The Agent shall act as:', margin, y);
  y += 5;
  tick(doc, margin, y - 3.5, data.agencyRelationship === 'single');
  doc.text('Single agency', margin + 6, y);
  tick(doc, margin + 40, y - 3.5, data.agencyRelationship === 'dual');
  doc.text('Dual agency', margin + 46, y);
  tick(doc, margin + 80, y - 3.5, data.agencyRelationship === 'potentially-dual');
  doc.text('Potentially dual agency', margin + 86, y);
  y += 8;

  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  doc.text('The Agent\'s duties are set out in Schedule 1. In dual agency, the Agent must disclose commission received from both parties.', margin, y, { maxWidth: contentW });
  doc.setTextColor(0, 0, 0);
  y += 8;

  // ── Section 3: List Rental ───────────────────────────────────────────────────
  doc.setFillColor(240, 245, 255);
  doc.rect(margin, y, contentW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('3.  LIST RENTAL', margin + 2, y + 4);
  doc.setFont('helvetica', 'normal');
  y += 9;

  doc.setFontSize(8.5);
  doc.text('List Rental (in words):', margin, y);
  const rentalWords = data.listRentalHKD ? numberToWords(parseInt(data.listRentalHKD.replace(/[^0-9]/g, ''), 10)) : '';
  doc.setFont('helvetica', 'bold');
  doc.text(rentalWords || 'Hong Kong Dollars ___________________________', margin + 42, y, { maxWidth: contentW - 42 });
  doc.setFont('helvetica', 'normal');
  y += 6;
  doc.text('List Rental (HK$):', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.text(data.listRentalHKD ? `HK$ ${parseInt(data.listRentalHKD.replace(/[^0-9]/g, ''), 10).toLocaleString()} per month` : 'HK$ _______________ per month', margin + 36, y);
  doc.setFont('helvetica', 'normal');
  y += 6;
  doc.text('Rental is:', margin, y);
  tick(doc, margin + 20, y - 3.5, data.rentalIncludes === 'inclusive');
  doc.text('Inclusive', margin + 26, y);
  tick(doc, margin + 52, y - 3.5, data.rentalIncludes === 'exclusive');
  doc.text('Exclusive', margin + 58, y);
  doc.text('of rates and management fees', margin + 80, y);
  y += 6;
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  doc.text('The list rental can only be changed by written instructions from the Landlord.', margin, y, { maxWidth: contentW });
  doc.setTextColor(0, 0, 0);
  y += 10;

  // ── Section 4: Commission ────────────────────────────────────────────────────
  doc.setFillColor(240, 245, 255);
  doc.rect(margin, y, contentW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('4.  COMMISSION (Schedule 2)', margin + 2, y + 4);
  doc.setFont('helvetica', 'normal');
  y += 9;

  doc.setFontSize(8.5);
  doc.text('Commission payable by Landlord:', margin, y);
  y += 5;
  tick(doc, margin, y - 3.5, data.commissionType === 'amount');
  doc.text('In the amount of HK$', margin + 6, y);
  doc.text(data.commissionType === 'amount' ? data.commissionValue : '_______________', margin + 46, y);
  doc.line(margin + 46, y + 0.5, margin + 46 + 35, y + 0.5);
  y += 5;
  tick(doc, margin, y - 3.5, data.commissionType === 'rate');
  doc.text('At the rate of', margin + 6, y);
  doc.text(data.commissionType === 'rate' ? data.commissionValue : '_______', margin + 32, y);
  doc.line(margin + 32, y + 0.5, margin + 32 + 20, y + 0.5);
  doc.text('% of the transacted rental', margin + 54, y);
  y += 6;
  doc.text('Payment timing:', margin, y);
  tick(doc, margin + 30, y - 3.5, data.commissionPayment === 'signing');
  doc.text('Upon signing of lease', margin + 36, y);
  tick(doc, margin + 100, y - 3.5, data.commissionPayment === 'commencement');
  doc.text('Upon commencement of tenancy', margin + 106, y);
  y += 10;

  // ── Section 6: Property Inspection ──────────────────────────────────────────
  doc.setFillColor(240, 245, 255);
  doc.rect(margin, y, contentW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('6.  PROPERTY INSPECTION', margin + 2, y + 4);
  doc.setFont('helvetica', 'normal');
  y += 9;

  doc.setFontSize(8.5);
  const inspectionRows = [
    { label: 'Allow viewing by Agent and/or tenant(s):', yes: data.allowViewingByAgent || data.allowViewingByTenant },
    { label: 'Pass keys to Agent for viewing purposes:', yes: data.passKeysToAgent },
    { label: 'Authorize Agent to pass keys to other estate agents/persons:', yes: data.authorizePassKeysToOthers },
  ];
  inspectionRows.forEach((row) => {
    doc.text(row.label, margin, y);
    tick(doc, margin + 120, y - 3.5, row.yes);
    doc.text('Yes', margin + 126, y);
    tick(doc, margin + 138, y - 3.5, !row.yes);
    doc.text('No', margin + 144, y);
    y += 6;
  });
  y += 2;

  // ── Section 7 & 8 ───────────────────────────────────────────────────────────
  doc.setFillColor(240, 245, 255);
  doc.rect(margin, y, contentW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('7 & 8.  SUB-LISTING AND ADVERTISING', margin + 2, y + 4);
  doc.setFont('helvetica', 'normal');
  y += 9;

  doc.setFontSize(8.5);
  doc.text('Authorize Agent to sub-list the property:', margin, y);
  tick(doc, margin + 90, y - 3.5, data.authorizeSubListing);
  doc.text('Yes', margin + 96, y);
  tick(doc, margin + 108, y - 3.5, !data.authorizeSubListing);
  doc.text('No', margin + 114, y);
  y += 6;
  doc.text('Authorize Agent to issue advertisements:', margin, y);
  tick(doc, margin + 90, y - 3.5, data.authorizeAdvertising);
  doc.text('Yes', margin + 96, y);
  tick(doc, margin + 108, y - 3.5, !data.authorizeAdvertising);
  doc.text('No', margin + 114, y);
  y += 10;

  // ── Section 9: Disclosure ────────────────────────────────────────────────────
  doc.setFillColor(240, 245, 255);
  doc.rect(margin, y, contentW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('9.  DISCLOSURE OF INTEREST BY AGENT', margin + 2, y + 4);
  doc.setFont('helvetica', 'normal');
  y += 9;

  doc.setFontSize(8.5);
  doc.text('Agent has pecuniary or beneficial interest in the property:', margin, y);
  tick(doc, margin + 115, y - 3.5, data.agentHasInterest);
  doc.text('Yes', margin + 121, y);
  tick(doc, margin + 133, y - 3.5, !data.agentHasInterest);
  doc.text('No', margin + 139, y);
  y += 10;

  // ── Section 10: Acknowledgement ─────────────────────────────────────────────
  doc.setFillColor(240, 245, 255);
  doc.rect(margin, y, contentW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('10.  ACKNOWLEDGEMENT BY LANDLORD', margin + 2, y + 4);
  doc.setFont('helvetica', 'normal');
  y += 9;

  doc.setFontSize(8.5);
  tick(doc, margin, y - 3.5, data.receivedLeasingInfoForm);
  doc.text('I/We have received the Leasing Information Form as required by the Estate Agents Ordinance.', margin + 6, y, { maxWidth: contentW - 6 });
  y += 6;
  tick(doc, margin, y - 3.5, !data.receivedLeasingInfoForm);
  doc.text('I/We agree to receive the Leasing Information Form before entering into a binding lease agreement.', margin + 6, y, { maxWidth: contentW - 6 });
  y += 12;

  // ── Signature Section ────────────────────────────────────────────────────────
  doc.setFillColor(240, 245, 255);
  doc.rect(margin, y, contentW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('SIGNATURES', margin + 2, y + 4);
  doc.setFont('helvetica', 'normal');
  y += 9;

  const sigColW = contentW / 2 - 3;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('LANDLORD', margin, y);
  doc.setFont('helvetica', 'normal');
  y += 5;
  doc.text('Signature:', margin, y);
  doc.line(margin + 20, y + 0.5, margin + sigColW, y + 0.5);
  y += 6;
  doc.text('Name:', margin, y);
  doc.text(data.landlordName, margin + 14, y);
  doc.line(margin + 14, y + 0.5, margin + sigColW, y + 0.5);
  y += 6;
  doc.text('HKID/CR No.:', margin, y);
  doc.text(data.landlordIdNumber, margin + 24, y);
  doc.line(margin + 24, y + 0.5, margin + sigColW, y + 0.5);
  y += 6;
  doc.text('Address:', margin, y);
  doc.text(data.landlordAddress || '________________________', margin + 18, y, { maxWidth: sigColW - 18 });
  doc.line(margin + 18, y + 0.5, margin + sigColW, y + 0.5);
  y += 6;
  doc.text('Tel:', margin, y);
  doc.text(data.landlordPhone || '________________________', margin + 10, y);
  doc.line(margin + 10, y + 0.5, margin + sigColW, y + 0.5);
  y += 6;
  doc.text('Date:', margin, y);
  doc.line(margin + 12, y + 0.5, margin + sigColW, y + 0.5);
  const sigY = y;

  // Agent column
  const agentX = margin + sigColW + 6;
  let ay = sigY - 30;
  doc.setFont('helvetica', 'bold');
  doc.text('ESTATE AGENT / SALESPERSON', agentX, ay);
  doc.setFont('helvetica', 'normal');
  ay += 5;
  doc.text('Signature:', agentX, ay);
  doc.line(agentX + 20, ay + 0.5, agentX + sigColW, ay + 0.5);
  ay += 6;
  doc.text('Name & Licence No.:', agentX, ay);
  doc.text(`${data.agentName}  ${data.agentLicenceNumber}`, agentX + 38, ay, { maxWidth: sigColW - 38 });
  doc.line(agentX + 38, ay + 0.5, agentX + sigColW, ay + 0.5);
  ay += 6;
  doc.text('Address:', agentX, ay);
  doc.text(data.agentAddress || '________________________', agentX + 18, ay, { maxWidth: sigColW - 18 });
  doc.line(agentX + 18, ay + 0.5, agentX + sigColW, ay + 0.5);
  ay += 6;
  doc.text('Tel:', agentX, ay);
  doc.text(data.agentPhone || '________________________', agentX + 10, ay);
  doc.line(agentX + 10, ay + 0.5, agentX + sigColW, ay + 0.5);
  ay += 6;
  doc.text('Date:', agentX, ay);
  doc.line(agentX + 12, ay + 0.5, agentX + sigColW, ay + 0.5);

  y += 14;

  // ── Schedule 1 ──────────────────────────────────────────────────────────────
  doc.addPage();
  y = 15;
  doc.setFillColor(27, 79, 138);
  doc.rect(0, 0, pageW, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('FORM 5 — SCHEDULE 1: DUTIES OF AGENT', margin, 8);
  doc.setTextColor(0, 0, 0);

  y = 20;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('SCHEDULE 1 — DUTIES OF AGENT', margin, y);
  doc.setFont('helvetica', 'normal');
  y += 7;

  const duties = [
    'Market the property and use best endeavours to find a tenant.',
    'Obtain information about the property and provide it to prospective tenants.',
    'Arrange and accompany inspections of the property.',
    'Conduct negotiations between the Landlord and prospective tenants.',
    'Assist in the execution of a tenancy agreement.',
    'Comply with all applicable provisions of the Estate Agents Ordinance (Cap. 511) and its subsidiary legislation.',
  ];
  duties.forEach((duty, i) => {
    doc.setFontSize(8.5);
    doc.text(`${i + 1}.  ${duty}`, margin, y, { maxWidth: contentW });
    y += 7;
  });

  y += 5;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('SCHEDULE 2 — COMMISSION TERMS', margin, y);
  doc.setFont('helvetica', 'normal');
  y += 7;

  doc.setFontSize(8.5);
  doc.text('Commission is payable by the Landlord to the Agent upon the terms set out in Clause 4 above.', margin, y, { maxWidth: contentW });
  y += 6;
  doc.text('If the tenancy does not proceed due to the default of the Landlord, the commission shall still be payable.', margin, y, { maxWidth: contentW });
  y += 6;
  doc.text('If the tenancy does not proceed due to the default of the tenant, the Agent shall refund the commission (without interest) to the Landlord.', margin, y, { maxWidth: contentW });
  y += 6;
  doc.text('The Agent shall not be liable for commissions payable to any other cooperating estate agent.', margin, y, { maxWidth: contentW });
  y += 10;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('SCHEDULE 4 — EXPLANATORY NOTES', margin, y);
  doc.setFont('helvetica', 'normal');
  y += 7;

  const notes = [
    'Exclusive agency: The Landlord appoints only one agent. Commission is payable even if the property is let through another agent or the Landlord directly during the validity period.',
    'Non-exclusive agency: The Landlord may appoint more than one agent. Commission is payable only to the agent who introduces the successful tenant.',
    'Single agency: The Agent acts only for the Landlord.',
    'Dual agency: The Agent acts for both the Landlord and the tenant. The Agent must disclose this and obtain consent from both parties.',
    'Potentially dual agency: The Agent may act for both parties. The Agent must disclose this possibility.',
    'Commission is negotiable between the Landlord and the Agent.',
  ];
  notes.forEach((note, i) => {
    doc.setFontSize(8);
    doc.text(`${i + 1}.  ${note}`, margin, y, { maxWidth: contentW });
    y += 8;
  });

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated by PropTrack  ·  Property: ${data.propertyAddress}  ·  ${new Date().toLocaleDateString('en-GB')}`, pageW / 2, 290, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  doc.save(`Form5_Lease_${data.propertyAddress.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)}.pdf`);
}
