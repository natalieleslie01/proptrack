'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function createClient() {
  if (client) return client;
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Use a stable storage key scoped to this app
        storageKey: 'proptrack-auth',
        // Disable the Web Locks API that causes "lock broken by steal" errors
        // when multiple tabs or concurrent requests compete for the lock
        lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<unknown>) => {
          return fn();
        },
      },
    }
  );
  return client;
}