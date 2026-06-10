import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@/lib/supabase/server';

const resend = new Resend(process.env.RESEND_API_KEY);

interface AdvertisingReminderPayload {
  propertyRef: string;
  propertyAddress: string;
  advertisingDate: string;
  agentName: string;
  agentEmail: string;
  workflowType: 'sales' | 'tenancy';
}

const SALES_CHECKLIST = [
  'Confirm the property is still available for sale',
  'Verify the asking price is still current and competitive',
  'Update property photos if the property condition has changed',
  'Review and refresh the property description and key features',
  'Check if vendor is still committed to selling',
  'Update any recent renovation or improvement details',
  'Confirm vendor contact details are still correct',
  'Review marketing channels and portal listings',
  'Check for any new comparable sales in the area',
  'Update the property status in PropTrack if sold or withdrawn',
];

const TENANCY_CHECKLIST = [
  'Confirm the property is still available for lease',
  'Verify the asking rent is still current and competitive',
  'Update property photos if the property condition has changed',
  'Review and refresh the property description and key features',
  'Check if landlord is still committed to leasing',
  'Confirm any recent maintenance or improvements are noted',
  'Verify landlord contact details are still correct',
  'Review marketing channels and portal listings',
  'Check for any new comparable rentals in the area',
  'Update the property status in PropTrack if leased or withdrawn',
];

function buildReminderEmail(payload: AdvertisingReminderPayload): string {
  const { propertyRef, propertyAddress, advertisingDate, agentName, workflowType } = payload;
  const checklist = workflowType === 'sales' ? SALES_CHECKLIST : TENANCY_CHECKLIST;
  const typeLabel = workflowType === 'sales' ? 'Sale' : 'Tenancy';
  const formLabel = workflowType === 'sales' ? 'Form 3' : 'Form 5';

  const checklistRows = checklist
    .map(
      (item, i) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:24px;vertical-align:top;padding-top:1px;">
              <span style="display:inline-block;width:20px;height:20px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:4px;text-align:center;line-height:20px;font-size:11px;color:#94a3b8;">${i + 1}</span>
            </td>
            <td style="padding-left:10px;font-size:13px;color:#334155;line-height:1.5;">${item}</td>
          </tr>
        </table>
      </td>
    </tr>`
    )
    .join('');

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
            <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">📅 3-Month Advertising Review</h1>
            <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">Property: <strong style="color:#ffffff;">${propertyRef}</strong></p>
          </td>
        </tr>
        <!-- Alert banner -->
        <tr>
          <td style="padding:28px 40px 0;">
            <table cellpadding="0" cellspacing="0" style="background:#fef3c7;border:2px solid #f59e0b;border-radius:10px;width:100%;">
              <tr>
                <td style="padding:18px 24px;">
                  <p style="margin:0;font-size:18px;font-weight:800;color:#92400e;">⚠️ Advertising Review Required</p>
                  <p style="margin:6px 0 0;font-size:13px;color:#78350f;">
                    It has been <strong>3 months</strong> since this property was listed for ${typeLabel.toLowerCase()} (${formLabel} signed on <strong>${new Date(advertisingDate).toLocaleDateString('en-HK', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>).
                    The property has not yet been recorded as ${workflowType === 'sales' ? 'sold' : 'leased'}.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Greeting -->
        <tr>
          <td style="padding:24px 40px 0;">
            <p style="margin:0;font-size:15px;color:#334155;">Dear <strong>${agentName}</strong>,</p>
            <p style="margin:10px 0 0;font-size:14px;color:#64748b;line-height:1.6;">
              Please contact the ${workflowType === 'sales' ? 'vendor' : 'landlord'} to confirm whether the property is still available and update the listing accordingly. 
              Review the checklist below and update the following items in PropTrack:
            </p>
          </td>
        </tr>
        <!-- Property details -->
        <tr>
          <td style="padding:20px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
              <tr>
                <td style="padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:6px 0;font-size:13px;color:#64748b;width:40%;">Property Address</td>
                      <td style="padding:6px 0;font-size:13px;color:#1e293b;font-weight:600;">${propertyAddress}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:13px;color:#64748b;">Reference</td>
                      <td style="padding:6px 0;font-size:13px;color:#1e293b;">${propertyRef}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:13px;color:#64748b;">Workflow Type</td>
                      <td style="padding:6px 0;font-size:13px;color:#1e293b;">${typeLabel} (${formLabel})</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:13px;color:#64748b;">Advertising Start</td>
                      <td style="padding:6px 0;font-size:13px;color:#1e293b;font-weight:600;">${new Date(advertisingDate).toLocaleDateString('en-HK', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:13px;color:#64748b;">Days on Market</td>
                      <td style="padding:6px 0;font-size:13px;color:#dc2626;font-weight:700;">~90 days</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Checklist -->
        <tr>
          <td style="padding:20px 40px 0;">
            <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;">Update the Following</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
              ${checklistRows}
            </table>
          </td>
        </tr>
        <!-- CTA -->
        <tr>
          <td style="padding:24px 40px 0;">
            <table cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;width:100%;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#1d4ed8;">Next Steps</p>
                  <p style="margin:0;font-size:13px;color:#1e40af;line-height:1.6;">
                    1. Call or email the ${workflowType === 'sales' ? 'vendor' : 'landlord'} to confirm availability.<br/>
                    2. Update the property status in PropTrack (mark as Sold/Leased if applicable).<br/>
                    3. Refresh the listing on all portals if still available.<br/>
                    4. Log any changes in the Activity Log.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:28px 40px 32px;">
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 20px;"/>
            <p style="margin:0 0 4px;font-size:13px;color:#334155;font-weight:600;">Homes R Us</p>
            <p style="margin:0;font-size:12px;color:#94a3b8;">Discovery Bay, Lantau Island, Hong Kong · enquiries@homesrus.hk</p>
            <p style="margin:6px 0 0;font-size:11px;color:#cbd5e1;">This is an automated reminder from PropTrack. Please do not reply to this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// POST — send a reminder immediately (manual trigger or cron)
export async function POST(req: NextRequest) {
  try {
    const payload: AdvertisingReminderPayload = await req.json();
    const { propertyRef, propertyAddress, advertisingDate, agentName, agentEmail, workflowType } = payload;

    if (!propertyRef || !agentEmail || !advertisingDate) {
      return NextResponse.json({ error: 'Missing required fields: propertyRef, agentEmail, advertisingDate' }, { status: 400 });
    }

    const html = buildReminderEmail(payload);
    const typeLabel = workflowType === 'sales' ? 'Sale' : 'Tenancy';
    const subject = `[3-Month Review] ${propertyRef} — ${propertyAddress} · ${typeLabel} Advertising Check`;

    const { data, error } = await resend.emails.send({
      from: 'PropTrack <onboarding@resend.dev>',
      to: [agentEmail],
      subject,
      html,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Mark reminder as sent in DB
    try {
      const supabase = await createClient();
      await supabase
        .from('advertising_reminders')
        .update({ reminder_sent: true, reminder_sent_at: new Date().toISOString() })
        .eq('property_ref', propertyRef)
        .eq('reminder_sent', false);
    } catch {
      // Non-blocking — email already sent
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to send reminder' }, { status: 500 });
  }
}

// GET — check for overdue reminders (can be called by a cron job or dashboard)
export async function GET() {
  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];

    // Find reminders that are due and not yet sent
    const { data: dueReminders, error } = await supabase
      .from('advertising_reminders')
      .select('*')
      .lte('reminder_due_date', today)
      .eq('reminder_sent', false)
      .eq('property_status', 'active');

    if (error) throw error;

    if (!dueReminders || dueReminders.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: 'No reminders due' });
    }

    const results = [];
    for (const reminder of dueReminders) {
      if (!reminder.agent_email) continue;

      const payload: AdvertisingReminderPayload = {
        propertyRef: reminder.property_ref,
        propertyAddress: reminder.property_address ?? '',
        advertisingDate: reminder.advertising_date,
        agentName: reminder.agent_name ?? 'Agent',
        agentEmail: reminder.agent_email,
        workflowType: reminder.workflow_type as 'sales' | 'tenancy',
      };

      const html = buildReminderEmail(payload);
      const typeLabel = reminder.workflow_type === 'sales' ? 'Sale' : 'Tenancy';
      const subject = `[3-Month Review] ${reminder.property_ref} — ${reminder.property_address} · ${typeLabel} Advertising Check`;

      const { data, error: sendError } = await resend.emails.send({
        from: 'PropTrack <onboarding@resend.dev>',
        to: [reminder.agent_email],
        subject,
        html,
      });

      if (!sendError) {
        await supabase
          .from('advertising_reminders')
          .update({ reminder_sent: true, reminder_sent_at: new Date().toISOString() })
          .eq('id', reminder.id);
      }

      results.push({ id: reminder.id, propertyRef: reminder.property_ref, success: !sendError, emailId: data?.id });
    }

    return NextResponse.json({ success: true, sent: results.filter((r) => r.success).length, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to process reminders' }, { status: 500 });
  }
}
