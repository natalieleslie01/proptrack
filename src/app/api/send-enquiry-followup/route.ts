import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface EnquiryFollowupPayload {
  clientName: string;
  clientEmail: string;
  propertyRef?: string;
  propertyAddress?: string;
  agentName: string;
  agentPhone?: string;
  customMessage?: string;
  enquiryDate?: string;
}

export async function POST(req: NextRequest) {
  try {
    const payload: EnquiryFollowupPayload = await req.json();
    const { clientName, clientEmail, propertyRef, propertyAddress, agentName, agentPhone, customMessage, enquiryDate } = payload;

    if (!clientEmail || !clientName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#1B4F8A 0%,#163d6e 100%);padding:32px 40px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:rgba(255,255,255,0.65);text-transform:uppercase;letter-spacing:0.1em;">Homes R Us · Discovery Bay</p>
            <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">Following Up On Your Enquiry</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 40px 0;">
            <p style="margin:0;font-size:15px;color:#334155;">Dear <strong>${clientName}</strong>,</p>
            <p style="margin:12px 0 0;font-size:14px;color:#64748b;line-height:1.6;">
              Thank you for your interest in properties at Discovery Bay. We wanted to follow up on your recent enquiry${enquiryDate ? ` from ${enquiryDate}` : ''} and ensure we can assist you further.
            </p>
          </td>
        </tr>
        ${propertyRef ? `
        <tr>
          <td style="padding:24px 40px 0;">
            <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;">Property of Interest</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
              <tr>
                <td style="padding:18px 20px;">
                  <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#1e293b;">${propertyAddress || propertyRef}</p>
                  <p style="margin:0;font-size:13px;color:#64748b;">Reference: ${propertyRef}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>` : ''}
        ${customMessage ? `
        <tr>
          <td style="padding:24px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.08em;">Message from your agent</p>
                  <p style="margin:0;font-size:14px;color:#78350f;line-height:1.6;">${customMessage}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>` : ''}
        <tr>
          <td style="padding:24px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;">
              <tr>
                <td style="padding:18px 20px;">
                  <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#0369a1;">Your Agent: ${agentName}</p>
                  ${agentPhone ? `<p style="margin:0 0 4px;font-size:13px;color:#0369a1;">📞 ${agentPhone}</p>` : ''}
                  <p style="margin:0;font-size:13px;color:#0369a1;">✉️ enquiries@homesrus.hk</p>
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
      to: [clientEmail],
      subject: `Following up on your Discovery Bay property enquiry`,
      html,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, id: data?.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to send email' }, { status: 500 });
  }
}
