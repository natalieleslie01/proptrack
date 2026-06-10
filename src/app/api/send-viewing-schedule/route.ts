import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface ViewingSchedulePayload {
  client: {
    name: string;
    email: string;
    phone: string;
  };
  property: {
    ref: string;
    address: string;
    village: string;
    phase: string;
    beds: number;
    baths: number;
    sqft: number;
    type: string;
    price: string;
  };
  date: string;
  time: string;
  endTime: string;
  agent: string;
  status: string;
  notes?: string;
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function buildScheduleHtml(data: ViewingSchedulePayload): string {
  const statusColor =
    data.status === 'Confirmed' ?'#059669'
      : data.status === 'Pending' ?'#d97706' :'#dc2626';

  const typeColor =
    data.property.type === 'Sale' ?'#7c3aed'
      : data.property.type === 'Rent' ?'#2563eb' :'#0d9488';

  const notesSection = data.notes
    ? `
    <tr>
      <td style="padding: 0 40px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.08em;">Notes</p>
              <p style="margin:0;font-size:13px;color:#78350f;line-height:1.6;">${data.notes}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Viewing Schedule – ${data.property.ref}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#8B1A2B 0%,#6d1522 100%);padding:32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:rgba(255,255,255,0.65);text-transform:uppercase;letter-spacing:0.1em;">Homes R Us · Discovery Bay</p>
                    <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;line-height:1.2;">Viewing Schedule</h1>
                    <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">Property Reference: <strong style="color:#ffffff;">${data.property.ref}</strong></p>
                  </td>
                  <td align="right" valign="top">
                    <span style="display:inline-block;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);border-radius:20px;padding:6px 14px;font-size:12px;font-weight:600;color:#ffffff;">${data.status}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:28px 40px 0;">
              <p style="margin:0;font-size:15px;color:#334155;line-height:1.6;">Dear <strong>${data.client.name}</strong>,</p>
              <p style="margin:10px 0 0;font-size:14px;color:#64748b;line-height:1.6;">
                Please find below your confirmed viewing schedule. We look forward to showing you this property.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:20px 40px 0;"><hr style="border:none;border-top:1px solid #e2e8f0;margin:0;" /></td></tr>

          <!-- Date & Time -->
          <tr>
            <td style="padding:24px 40px 0;">
              <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;">Date &amp; Time</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
                <tr>
                  <td style="padding:18px 20px;border-right:1px solid #e2e8f0;" width="50%">
                    <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">Date</p>
                    <p style="margin:0;font-size:14px;font-weight:700;color:#1e293b;">${formatDateFull(data.date)}</p>
                  </td>
                  <td style="padding:18px 20px;" width="50%">
                    <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">Time Slot</p>
                    <p style="margin:0;font-size:14px;font-weight:700;color:#1e293b;">${data.time} – ${data.endTime}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Property Details -->
          <tr>
            <td style="padding:24px 40px 0;">
              <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;">Property Details</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
                <tr>
                  <td style="padding:20px 20px 16px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#1e293b;">${data.property.address}</p>
                          <p style="margin:0 0 12px;font-size:13px;color:#64748b;">${data.property.village} &middot; ${data.property.phase}</p>
                        </td>
                        <td align="right" valign="top">
                          <span style="display:inline-block;background:${typeColor}18;border:1px solid ${typeColor}40;border-radius:12px;padding:4px 10px;font-size:11px;font-weight:700;color:${typeColor};">${data.property.type}</span>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0 0 14px;font-size:20px;font-weight:800;color:#1B4F8A;">${data.property.price}</p>
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right:20px;">
                          <p style="margin:0;font-size:12px;color:#64748b;">&#127968; <strong style="color:#1e293b;">${data.property.beds}</strong> Bedrooms</p>
                        </td>
                        <td style="padding-right:20px;">
                          <p style="margin:0;font-size:12px;color:#64748b;">&#128704; <strong style="color:#1e293b;">${data.property.baths}</strong> Bathrooms</p>
                        </td>
                        <td>
                          <p style="margin:0;font-size:12px;color:#64748b;">&#9632; <strong style="color:#1e293b;">${data.property.sqft.toLocaleString()}</strong> ft²</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Agent Contact -->
          <tr>
            <td style="padding:24px 40px 0;">
              <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;">Your Agent</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right:14px;">
                          <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#8B1A2B,#6d1522);display:flex;align-items:center;justify-content:center;text-align:center;line-height:44px;">
                            <span style="font-size:16px;font-weight:700;color:#ffffff;">${data.agent.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</span>
                          </div>
                        </td>
                        <td>
                          <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#1e293b;">${data.agent}</p>
                          <p style="margin:0;font-size:12px;color:#64748b;">Property Consultant · Homes R Us</p>
                        </td>
                      </tr>
                    </table>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;padding-top:14px;border-top:1px solid #e2e8f0;">
                      <tr>
                        <td>
                          <p style="margin:0 0 4px;font-size:12px;color:#64748b;">&#128222; <a href="tel:+85221234567" style="color:#1B4F8A;text-decoration:none;font-weight:600;">+852 2123 4567</a></p>
                          <p style="margin:0;font-size:12px;color:#64748b;">&#9993; <a href="mailto:enquiries@homesrus.hk" style="color:#1B4F8A;text-decoration:none;font-weight:600;">enquiries@homesrus.hk</a></p>
                        </td>
                        <td align="right">
                          <p style="margin:0;font-size:11px;color:#94a3b8;">Discovery Bay, Hong Kong</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${notesSection}

          <!-- CTA -->
          <tr>
            <td style="padding:24px 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0;font-size:13px;color:#0369a1;line-height:1.6;">
                      Need to reschedule or have questions? Contact your agent directly or reply to this email and we'll be happy to assist.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 40px 32px;">
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 20px;" />
              <p style="margin:0 0 4px;font-size:13px;color:#334155;font-weight:600;">Homes R Us</p>
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
                Discovery Bay, Lantau Island, Hong Kong &nbsp;&middot;&nbsp; +852 2123 4567 &nbsp;&middot;&nbsp; enquiries@homesrus.hk
              </p>
              <p style="margin:12px 0 0;font-size:11px;color:#cbd5e1;">
                This viewing schedule was generated by PropTrack. Please do not reply directly to this automated message.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const payload: ViewingSchedulePayload = await req.json();

    const { client, property, date, time } = payload;

    if (!client?.email || !property?.ref || !date || !time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const html = buildScheduleHtml(payload);

    const { data, error } = await resend.emails.send({
      from: 'Homes R Us <onboarding@resend.dev>',
      to: [client.email],
      subject: `Your Viewing Schedule – ${property.address} on ${formatDateFull(date)} at ${time}`,
      html,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to send viewing schedule';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
