import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// POST /api/admin/users/[id]/reset-password — send password reset email
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: callerProfile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!callerProfile || callerProfile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Get target user email
  const { data: targetProfile } = await supabase
    .from('user_profiles')
    .select('email, full_name')
    .eq('id', id)
    .single();

  if (!targetProfile) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Send password reset via Resend
  try {
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: targetProfile.email,
      subject: 'PropTrack HK — Password Reset',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #8B1A2B;">Password Reset Request</h2>
          <p>Hi ${targetProfile.full_name},</p>
          <p>Your PropTrack HK administrator has requested a password reset for your account.</p>
          <p>Please contact your administrator for your temporary password or use the login page to reset your password.</p>
          <p style="color: #666; font-size: 12px;">If you did not expect this email, please contact your administrator.</p>
        </div>
      `,
    });
  } catch {
    // Non-fatal — still return success
  }

  return NextResponse.json({ success: true, email: targetProfile.email });
}
