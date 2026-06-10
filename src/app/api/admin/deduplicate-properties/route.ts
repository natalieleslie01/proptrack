import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    // Count before
    const { count: before } = await supabaseAdmin
      .from('properties')
      .select('*', { count: 'exact', head: true });

    // Fetch all rows with id, property_ref, created_at
    // We page through in batches of 5000 to avoid memory issues
    let allRows: { id: string; property_ref: string | null; created_at: string }[] = [];
    let from = 0;
    const pageSize = 5000;

    while (true) {
      const { data, error } = await supabaseAdmin
        .from('properties')
        .select('id, property_ref, created_at')
        .order('created_at', { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) throw new Error(`Fetch error: ${error.message}`);
      if (!data || data.length === 0) break;

      allRows = allRows.concat(data as { id: string; property_ref: string | null; created_at: string }[]);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    // Group by property_ref — keep the first (earliest) per unique ref, collect rest for deletion
    const seen = new Map<string, string>(); // property_ref -> id to keep
    const toDelete: string[] = [];

    for (const row of allRows) {
      const ref = (row.property_ref ?? '').trim().toLowerCase();

      if (!ref) {
        // No property_ref — these are orphan rows, mark for deletion
        toDelete.push(row.id);
        continue;
      }

      if (!seen.has(ref)) {
        seen.set(ref, row.id);
      } else {
        toDelete.push(row.id);
      }
    }

    // Delete duplicates in batches of 500
    let totalDeleted = 0;
    for (let i = 0; i < toDelete.length; i += 500) {
      const batch = toDelete.slice(i, i + 500);
      const { error: delError } = await supabaseAdmin
        .from('properties')
        .delete()
        .in('id', batch);
      if (delError) throw new Error(`Delete error at batch ${i}: ${delError.message}`);
      totalDeleted += batch.length;
    }

    // Count after
    const { count: after } = await supabaseAdmin
      .from('properties')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      success: true,
      before,
      after,
      removed: totalDeleted,
      uniqueRefs: seen.size,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
