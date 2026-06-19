import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role to bypass RLS entirely
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, updates } = body as { id: string; updates: Record<string, unknown> };

    if (!id) {
      return NextResponse.json({ error: 'Missing property id' }, { status: 400 });
    }
    if (!updates || Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Always stamp updated_at
    const updateObj = { ...updates, updated_at: new Date().toISOString() };

    const { error } = await supabaseAdmin
      .from('properties')
      .update(updateObj)
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
