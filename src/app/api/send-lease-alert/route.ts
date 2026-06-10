import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface LeaseAlertPayload {
  recipientName: string;
  recipientEmail: string;
  recipientRole: 'agent' | 'manager';
  leases: {
    unit: string;
    district: string;
    tenant: string;
    monthlyRent: number;
    leaseEnd: string;
    daysLeft: number;
    agentNote?: string;
  }[];
  alertWindow: 7 | 14 | 30;
}

function buildAlertEmail(payload: LeaseAlertPayload): string {
  const { recipientName, recipientRole, leases, alertWindow } = payload;

  const urgencyColor = alertWindow === 7 ? '#dc2626' : alertWindow === 14 ? '#d97706' : '#1B4F8A';
  const urgencyBg = alertWindow === 7 ? '#fef2f2' : alertWindow === 14 ? '#fffbeb' : '#eff6ff';
  const urgencyBorder = alertWindow === 7 ? '#fecaca' : alertWindow === 14 ? '#fde68a' : '#bfdbfe';
  const urgencyLabel = alertWindow === 7 ? '🔴 URGENT — 7-Day Expiry Alert' : alertWindow === 14 ? '🟡 14-Day Expiry Alert' : '🔵 30-Day Expiry Alert';

  const leaseRows = leases
    .map(
      (lease) => `
    <tr style="border-bottom:1px solid #e2e8f0;">
      <td style="padding:12px 16px;font-size:13px;color:#1e293b;font-weight:600;">${lease.unit}</td>
      <td style="padding:12px 16px;font-size:13px;color:#475569;">${lease.district}</td>
      <td style="padding:12px 16px;font-size:13px;color:#1e293b;">${lease.tenant}</td>
      <td style="padding:12px 16px;font-size:13px;font-family:monospace;color:#1e293b;font-weight:600;">HK$${lease.monthlyRent.toLocaleString()}</td>
      <td style="padding:12px 16px;font-size:13px;font-family:monospace;color:#1e293b;">${lease.leaseEnd}</td>
      <td style="padding:12px 16px;">
        <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:700;background:${urgencyBg};color:${urgencyColor};border:1px solid ${urgencyBorder};">${lease.daysLeft}d</span>
      </td>
      <td style="padding:12px 16px;font-size:12px;color:#64748b;max-width:180px;">${lease.agentNote ?? '—'}</td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="700" cellpadding="0" cellspacing="0" style="max-width:700px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#8B1A2B 0%,#6d1522 100%);padding:28px 40px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:rgba(255,255,255,0.65);text-transform:uppercase;letter-spacing:0.1em;">Homes R Us · Discovery Bay</p>
            <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">Lease Expiry Alert</h1>
            <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">Automated alert for ${recipientRole === 'manager' ? 'portfolio managers' : 'assigned agents'}</p>
          </td>
        </tr>
        <!-- Alert banner -->
        <tr>
          <td style="padding:24px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:${urgencyBg};border:2px solid ${urgencyColor};border-radius:10px;">
              <tr>
                <td style="padding:18px 24px;">
                  <p style="margin:0;font-size:18px;font-weight:800;color:${urgencyColor};">${urgencyLabel}</p>
                  <p style="margin:6px 0 0;font-size:14px;color:#64748b;">${leases.length} lease${leases.length !== 1 ? 's' : ''} expiring within ${alertWindow} days require${leases.length === 1 ? 's' : ''} your attention.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Greeting -->
        <tr>
          <td style="padding:24px 40px 0;">
            <p style="margin:0;font-size:15px;color:#334155;">Dear <strong>${recipientName}</strong>,</p>
            <p style="margin:10px 0 0;font-size:14px;color:#64748b;line-height:1.6;">
              The following ${leases.length === 1 ? 'lease is' : 'leases are'} expiring within <strong>${alertWindow} days</strong>. Please review each tenancy and take the appropriate action — whether that is initiating a renewal, issuing a notice, or relisting the property.
            </p>
          </td>
        </tr>
        <!-- Lease table -->
        <tr>
          <td style="padding:20px 40px 0;">
            <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;">Expiring Leases</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
              <thead>
                <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
                  <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Unit / Address</th>
                  <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">District</th>
                  <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Tenant</th>
                  <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Monthly Rent</th>
                  <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Lease End</th>
                  <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Days Left</th>
                  <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Agent Note</th>
                </tr>
              </thead>
              <tbody>
                ${leaseRows}
              </tbody>
            </table>
          </td>
        </tr>
        <!-- Action note -->
        <tr>
          <td style="padding:20px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#0369a1;">Recommended Actions</p>
                  <ul style="margin:0;padding-left:18px;font-size:13px;color:#0369a1;line-height:1.8;">
                    <li>Contact tenant to confirm renewal or vacating intent</li>
                    <li>Prepare and issue CR109 Form if renewal is agreed</li>
                    <li>Update tenancy status in PropTrack dashboard</li>
                    <li>Relist property if tenant is vacating</li>
                  </ul>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:28px 40px 32px;">
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 20px;"/>
            <p style="margin:0 0 4px;font-size:13px;color:#334155;font-weight:600;">Homes R Us · PropTrack</p>
            <p style="margin:0;font-size:12px;color:#94a3b8;">Discovery Bay, Lantau Island, Hong Kong · enquiries@homesrus.hk</p>
            <p style="margin:6px 0 0;font-size:11px;color:#cbd5e1;">This is an automated alert generated by PropTrack. Do not reply to this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const payload: LeaseAlertPayload = await req.json();
    const { recipientName, recipientEmail, recipientRole, leases, alertWindow } = payload;

    if (!recipientEmail || !leases?.length || !alertWindow) {
      return NextResponse.json({ error: 'Missing required fields: recipientEmail, leases, alertWindow' }, { status: 400 });
    }

    const urgencyLabel =
      alertWindow === 7 ? 'URGENT — 7-Day' : alertWindow === 14 ? '14-Day' : '30-Day';

    const html = buildAlertEmail(payload);

    const { data, error } = await resend.emails.send({
      from: 'PropTrack <onboarding@resend.dev>',
      to: [recipientEmail],
      subject: `[${urgencyLabel} Expiry Alert] ${leases.length} lease${leases.length !== 1 ? 's' : ''} require${leases.length === 1 ? 's' : ''} action — PropTrack`,
      html,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, id: data?.id, leaseCount: leases.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to send alert' }, { status: 500 });
  }
}
