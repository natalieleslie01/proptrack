import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';
  const type = searchParams.get('type');

  // Always use the request origin as the base URL — this ensures the redirect
  // works correctly regardless of which domain the user is accessing the app from
  // (e.g. homesrus-proptrack.com vs proptrack7151.builtwithrocket.new).
  // NEXT_PUBLIC_SITE_URL may point to a different domain causing "Invalid path" errors.
  const siteUrl = request.nextUrl.origin;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Password recovery flow — redirect to the reset-password page
      if (type === 'recovery') {
        return NextResponse.redirect(`${siteUrl}/reset-password`);
      }
      return NextResponse.redirect(`${siteUrl}${next}`);
    }
  }

  return NextResponse.redirect(`${siteUrl}/sign-up-login`);
}
