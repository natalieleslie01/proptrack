import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\s+/g, '').replace(/\/+$/, '');
  const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').replace(/\s+/g, '');

  // If env vars are missing or invalid, skip auth check entirely — don't crash the app
  if (!isValidUrl(supabaseUrl) || !supabaseAnonKey) {
    return supabaseResponse;
  }

  let user = null;

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value);
              supabaseResponse.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
  } catch {
    // If Supabase throws for any reason, fail open — let the page handle auth
    return supabaseResponse;
  }

  // Protect dashboard and other app routes
  const protectedPaths = ['/dashboard', '/property-management'];
  const isProtected = protectedPaths.some((p) =>
    request.nextUrl.pathname.startsWith(p)
  );

  // Public paths — never redirect these
  const publicPaths = ['/homes-r-us', '/sign-up-login', '/auth'];
  const isPublic = publicPaths.some((p) =>
    request.nextUrl.pathname.startsWith(p)
  );

  if (!user && isProtected && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-up-login';
    return NextResponse.redirect(url);
  }

  // Removed: middleware redirect for authenticated users on /sign-up-login
  // The LoginClient component handles this via useEffect + onAuthStateChange,
  // which only fires after the session cookie is fully committed to the browser.
  // Doing it here caused a race condition where the cookie wasn't set yet.

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
