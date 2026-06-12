import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST() {
  try {
    const supabase = createAdminClient();

    // Fetch all properties that have non-empty agent comments (notes)
    let allProperties: { id: string; notes: string | null; p_english: string | null }[] = [];
    let from = 0;
    const PAGE = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('properties')
        .select('id, notes, p_english')
        .not('notes', 'is', null)
        .neq('notes', '')
        .range(from, from + PAGE - 1);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (!data || data.length === 0) break;
      allProperties = allProperties.concat(data as { id: string; notes: string | null; p_english: string | null }[]);
      if (data.length < PAGE) break;
      from += PAGE;
    }

    if (allProperties.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No properties with agent comments found.',
        updated: 0,
      });
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process in batches of 50
    const BATCH_SIZE = 50;
    for (let i = 0; i < allProperties.length; i += BATCH_SIZE) {
      const batch = allProperties.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (prop) => {
          const agentComment = (prop.notes ?? '').trim();
          const existingRemarks = (prop.p_english ?? '').trim();

          // Merge: if advertising remarks already has content, append; otherwise replace
          const newRemarks = existingRemarks
            ? `${existingRemarks}\n\n${agentComment}`
            : agentComment;

          const { error } = await supabase
            .from('properties')
            .update({ p_english: newRemarks, notes: null })
            .eq('id', prop.id);

          if (error) {
            errors.push(`Property ${prop.id}: ${error.message}`);
            errorCount++;
          } else {
            successCount++;
          }
        })
      );
    }

    return NextResponse.json({
      success: true,
      message: `Migration complete. ${successCount} properties updated, ${errorCount} errors.`,
      total: allProperties.length,
      updated: successCount,
      failed: errorCount,
      errors: errors.slice(0, 50),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
