import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as 'recovery' | 'email' | 'signup' | null;
  const next = searchParams.get('next') ?? '/dashboard';

  // Always use the request origin as the base URL — this ensures the redirect
  // works correctly regardless of which domain the user is accessing the app from.
  const siteUrl = request.nextUrl.origin;

  const supabase = await createClient();

  // Handle token_hash flow (password reset emails use this format)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      if (type === 'recovery') {
        return NextResponse.redirect(`${siteUrl}/reset-password`);
      }
      return NextResponse.redirect(`${siteUrl}${next}`);
    }
    // If verification failed, fall through to error redirect
    return NextResponse.redirect(`${siteUrl}/sign-up-login?error=invalid_link`);
  }

  // Handle code flow (OAuth, magic links)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (type === 'recovery') {
        return NextResponse.redirect(`${siteUrl}/reset-password`);
      }
      return NextResponse.redirect(`${siteUrl}${next}`);
    }
  }

  return NextResponse.redirect(`${siteUrl}/sign-up-login`);
}
