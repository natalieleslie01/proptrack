import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface LeaseExpiryPayload {
  tenantName: string;
  tenantEmail: string;
  propertyAddress: string;
  propertyRef: string;
  leaseEndDate: string;
  daysRemaining: number;
  agentName: string;
  agentPhone?: string;
}

export async function POST(req: NextRequest) {
  try {
    const payload: LeaseExpiryPayload = await req.json();
    const { tenantName, tenantEmail, propertyAddress, propertyRef, leaseEndDate, daysRemaining, agentName, agentPhone } = payload;

    if (!tenantEmail || !propertyRef) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const urgencyColor = daysRemaining <= 30 ? '#dc2626' : daysRemaining <= 60 ? '#d97706' : '#059669';
    const urgencyLabel = daysRemaining <= 30 ? 'URGENT' : daysRemaining <= 60 ? 'ACTION REQUIRED' : 'NOTICE';

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#8B1A2B 0%,#6d1522 100%);padding:32px 40px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:rgba(255,255,255,0.65);text-transform:uppercase;letter-spacing:0.1em;">Homes R Us · Discovery Bay</p>
            <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">Lease Expiry Notice</h1>
            <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">Property: <strong style="color:#ffffff;">${propertyRef}</strong></p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 40px 0;">
            <p style="margin:0;font-size:15px;color:#334155;">Dear <strong>${tenantName}</strong>,</p>
            <p style="margin:12px 0 0;font-size:14px;color:#64748b;line-height:1.6;">
              We are writing to inform you that your tenancy agreement for the property at <strong>${propertyAddress}</strong> is approaching its expiry date.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:2px solid ${urgencyColor};border-radius:10px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:${urgencyColor};text-transform:uppercase;letter-spacing:0.08em;">${urgencyLabel}</p>
                  <p style="margin:0;font-size:28px;font-weight:800;color:${urgencyColor};">${daysRemaining} days remaining</p>
                  <p style="margin:6px 0 0;font-size:14px;color:#64748b;">Lease expires: <strong>${leaseEndDate}</strong></p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px 0;">
            <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;">Property Details</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
              <tr>
                <td style="padding:18px 20px;">
                  <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#1e293b;">${propertyAddress}</p>
                  <p style="margin:0;font-size:13px;color:#64748b;">Reference: ${propertyRef}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#0369a1;">Your Agent: ${agentName}</p>
                  ${agentPhone ? `<p style="margin:0;font-size:13px;color:#0369a1;">📞 ${agentPhone}</p>` : ''}
                  <p style="margin:8px 0 0;font-size:13px;color:#0369a1;line-height:1.6;">Please contact your agent to discuss renewal options or vacating the property.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 40px 32px;">
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 20px;"/>
            <p style="margin:0 0 4px;font-size:13px;color:#334155;font-weight:600;">Homes R Us</p>
            <p style="margin:0;font-size:12px;color:#94a3b8;">Discovery Bay, Lantau Island, Hong Kong · enquiries@homesrus.hk</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const { data, error } = await resend.emails.send({
      from: 'PropTrack <onboarding@resend.dev>',
      to: [tenantEmail],
      subject: `[${urgencyLabel}] Lease Expiry Notice – ${propertyRef} (${daysRemaining} days remaining)`,
      html,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, id: data?.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to send email' }, { status: 500 });
  }
}
