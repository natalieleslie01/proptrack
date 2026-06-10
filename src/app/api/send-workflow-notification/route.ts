import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export type WorkflowType = 'tenancy' | 'sales';
export type WorkflowEvent =
  | 'lease-signed' |'stamp-duty-filed' |'key-handover-scheduled' |'invoice-ready';

interface WorkflowNotificationPayload {
  workflowType: WorkflowType;
  event: WorkflowEvent;
  propertyAddress: string;
  propertyRef: string;
  // Tenancy
  tenantName?: string;
  tenantEmail?: string;
  landlordName?: string;
  landlordEmail?: string;
  // Sales
  vendorName?: string;
  vendorEmail?: string;
  purchaserName?: string;
  purchaserEmail?: string;
  // Agent
  agentName?: string;
  agentPhone?: string;
  agentEmail?: string;
  // Extra
  completionDate?: string;
  invoiceAmount?: string;
}

const EVENT_LABELS: Record<WorkflowEvent, string> = {
  'lease-signed': 'Tenancy Agreement Signed',
  'stamp-duty-filed': 'Stamp Duty Filed',
  'key-handover-scheduled': 'Key Handover Scheduled',
  'invoice-ready': 'Invoice Ready',
};

const EVENT_ICONS: Record<WorkflowEvent, string> = {
  'lease-signed': '✅',
  'stamp-duty-filed': '🏛️',
  'key-handover-scheduled': '🔑',
  'invoice-ready': '🧾',
};

const EVENT_COLORS: Record<WorkflowEvent, string> = {
  'lease-signed': '#059669',
  'stamp-duty-filed': '#1B4F8A',
  'key-handover-scheduled': '#d97706',
  'invoice-ready': '#7c3aed',
};

function buildEmailBody(payload: WorkflowNotificationPayload, recipientName: string, recipientRole: string): string {
  const { event, propertyAddress, propertyRef, agentName, agentPhone, completionDate, invoiceAmount } = payload;
  const label = EVENT_LABELS[event];
  const icon = EVENT_ICONS[event];
  const color = EVENT_COLORS[event];

  const extraRows: string[] = [];
  if (completionDate) {
    extraRows.push(`<tr><td style="padding:6px 0;font-size:13px;color:#64748b;width:40%;">Date</td><td style="padding:6px 0;font-size:13px;color:#1e293b;font-weight:600;">${completionDate}</td></tr>`);
  }
  if (invoiceAmount) {
    extraRows.push(`<tr><td style="padding:6px 0;font-size:13px;color:#64748b;width:40%;">Invoice Amount</td><td style="padding:6px 0;font-size:13px;color:#1e293b;font-weight:600;">${invoiceAmount}</td></tr>`);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#8B1A2B 0%,#6d1522 100%);padding:28px 40px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:rgba(255,255,255,0.65);text-transform:uppercase;letter-spacing:0.1em;">Homes R Us · Discovery Bay</p>
            <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">Workflow Update</h1>
            <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">Property: <strong style="color:#ffffff;">${propertyRef}</strong></p>
          </td>
        </tr>
        <!-- Step badge -->
        <tr>
          <td style="padding:28px 40px 0;">
            <table cellpadding="0" cellspacing="0" style="background:${color}15;border:2px solid ${color};border-radius:10px;width:100%;">
              <tr>
                <td style="padding:18px 24px;">
                  <p style="margin:0;font-size:22px;font-weight:800;color:${color};">${icon} ${label}</p>
                  <p style="margin:6px 0 0;font-size:13px;color:#64748b;">This step has been completed for the property below.</p>
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
              We are writing to confirm that the <strong>${label}</strong> step has been completed for the following property.
              ${recipientRole === 'agent' ? ' Please review the details below and take any required follow-up actions.' : ' Please keep this for your records.'}
            </p>
          </td>
        </tr>
        <!-- Property details -->
        <tr>
          <td style="padding:20px 40px 0;">
            <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;">Property Details</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
              <tr>
                <td style="padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr><td style="padding:6px 0;font-size:13px;color:#64748b;width:40%;">Address</td><td style="padding:6px 0;font-size:13px;color:#1e293b;font-weight:600;">${propertyAddress}</td></tr>
                    <tr><td style="padding:6px 0;font-size:13px;color:#64748b;">Reference</td><td style="padding:6px 0;font-size:13px;color:#1e293b;">${propertyRef}</td></tr>
                    ${extraRows.join('')}
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Agent contact -->
        ${agentName ? `
        <tr>
          <td style="padding:20px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;">
              <tr>
                <td style="padding:14px 20px;">
                  <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#0369a1;">Your Agent: ${agentName}</p>
                  ${agentPhone ? `<p style="margin:0;font-size:13px;color:#0369a1;">📞 ${agentPhone}</p>` : ''}
                  <p style="margin:6px 0 0;font-size:13px;color:#0369a1;">Please contact your agent if you have any questions.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>` : ''}
        <!-- Footer -->
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
}

export async function POST(req: NextRequest) {
  try {
    const payload: WorkflowNotificationPayload = await req.json();
    const { workflowType, event, propertyRef, propertyAddress, agentName, agentPhone } = payload;

    if (!event || !propertyRef) {
      return NextResponse.json({ error: 'Missing required fields: event, propertyRef' }, { status: 400 });
    }

    const label = EVENT_LABELS[event];
    const subject = `[${label}] – ${propertyRef} · ${propertyAddress}`;
    const results: { recipient: string; success: boolean; id?: string; error?: string }[] = [];

    // Build recipient list based on workflow type
    const recipients: { name: string; email: string; role: string }[] = [];

    if (workflowType === 'tenancy') {
      if (payload.tenantName && payload.tenantEmail) {
        recipients.push({ name: payload.tenantName, email: payload.tenantEmail, role: 'tenant' });
      }
      if (payload.landlordName && payload.landlordEmail) {
        recipients.push({ name: payload.landlordName, email: payload.landlordEmail, role: 'landlord' });
      }
    } else if (workflowType === 'sales') {
      if (payload.vendorName && payload.vendorEmail) {
        recipients.push({ name: payload.vendorName, email: payload.vendorEmail, role: 'vendor' });
      }
      if (payload.purchaserName && payload.purchaserEmail) {
        recipients.push({ name: payload.purchaserName, email: payload.purchaserEmail, role: 'purchaser' });
      }
    }

    // Always notify agent if email provided
    if (agentName && payload.agentEmail) {
      recipients.push({ name: agentName, email: payload.agentEmail, role: 'agent' });
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No valid recipients with email addresses found' }, { status: 400 });
    }

    // Send to all recipients
    for (const recipient of recipients) {
      const html = buildEmailBody(payload, recipient.name, recipient.role);
      const { data, error } = await resend.emails.send({
        from: 'PropTrack <onboarding@resend.dev>',
        to: [recipient.email],
        subject,
        html,
      });
      results.push({
        recipient: recipient.email,
        success: !error,
        id: data?.id,
        error: error?.message,
      });
    }

    const allSuccess = results.every((r) => r.success);
    return NextResponse.json({ success: allSuccess, results }, { status: allSuccess ? 200 : 207 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to send notification' }, { status: 500 });
  }
}
