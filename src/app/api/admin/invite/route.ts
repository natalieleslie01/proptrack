import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// POST /api/admin/invite — invite a new agent or manager
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: callerProfile } = await supabase
    .from('user_profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  if (!callerProfile || !['admin', 'manager'].includes(callerProfile.role)) {
    return NextResponse.json({ error: 'Forbidden — only admins and managers can invite team members' }, { status: 403 });
  }

  const body = await request.json();
  const { email, fullName, role, tempPassword, personalNote } = body;

  if (!email || !fullName || !role || !tempPassword) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (!['agent', 'manager'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role — only agent or manager can be invited' }, { status: 400 });
  }

  if (tempPassword.length < 8) {
    return NextResponse.json({ error: 'Temporary password must be at least 8 characters' }, { status: 400 });
  }

  // Use admin client (service role) to create auth user
  const adminClient = createAdminClient();
  const { data: signUpData, error: signUpError } = await adminClient.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });

  if (signUpError) return NextResponse.json({ error: signUpError.message }, { status: 400 });

  const newUserId = signUpData.user?.id;
  if (!newUserId) return NextResponse.json({ error: 'User creation failed' }, { status: 500 });

  // Upsert profile using regular client (RLS-aware)
  const { error: profileError } = await supabase
    .from('user_profiles')
    .upsert(
      { id: newUserId, email, full_name: fullName, role, is_active: true },
      { onConflict: 'id' }
    );

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  // Send welcome email with credentials
  const roleLabel = role === 'manager' ? 'Manager' : 'Agent';
  const inviterName = callerProfile.full_name || 'Your administrator';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://homesrus-proptrack.com';

  try {
    await resend.emails.send({
      from: 'PropTrack HK <onboarding@resend.dev>',
      to: email,
      subject: `You've been invited to PropTrack HK as ${roleLabel}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b;">
          <div style="background: #8B1A2B; padding: 24px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 700;">PropTrack HK</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 13px;">Discovery Bay Property Management</p>
          </div>
          <div style="padding: 28px 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px; background: #ffffff;">
            <h2 style="color: #1e293b; font-size: 18px; margin: 0 0 12px;">Welcome to the team, ${fullName}!</h2>
            <p style="color: #475569; margin: 0 0 20px; line-height: 1.6;">
              ${inviterName} has invited you to join PropTrack HK as a <strong>${roleLabel}</strong>.
              ${personalNote ? `<br/><br/><em>"${personalNote}"</em>` : ''}
            </p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Your Login Credentials</p>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; font-size: 14px; color: #64748b; width: 120px;">Email</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #1e293b; font-weight: 600;">${email}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 14px; color: #64748b;">Temp Password</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #8B1A2B; font-weight: 700; font-family: monospace; letter-spacing: 0.05em;">${tempPassword}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 14px; color: #64748b;">Role</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #1e293b; font-weight: 600;">${roleLabel}</td>
                </tr>
              </table>
            </div>
            <a href="${siteUrl}/sign-up-login" style="display: inline-block; background: #8B1A2B; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
              Sign In to PropTrack HK →
            </a>
            <p style="color: #94a3b8; font-size: 12px; margin: 20px 0 0; line-height: 1.5;">
              For security, please change your password after your first sign-in.<br/>
              If you have any questions, contact your administrator.
            </p>
          </div>
        </div>
      `,
    });
  } catch {
    // Non-fatal — user was created, email failed
  }

  return NextResponse.json({ success: true, userId: newUserId });
}
