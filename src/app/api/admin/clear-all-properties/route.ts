import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Use a SECURITY DEFINER database function that runs TRUNCATE ... CASCADE
    // This bypasses RLS entirely and handles all FK constraints automatically.
    const { data, error } = await supabaseAdmin.rpc('admin_clear_all_properties');

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const result = data as {
      success: boolean;
      before?: number;
      after?: number;
      deleted?: number;
      error?: string;
    };

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error ?? 'Unknown error in DB function' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      before: result.before ?? 0,
      after: result.after ?? 0,
      deleted: result.deleted ?? 0,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
