import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST() {
  try {
    const supabase = createAdminClient();

    // Fetch all properties — we need to check notes, p_eng_res, and p_english
    // agentNotes in the UI is: row.notes || row.p_english || row.p_eng_res
    // We want to find properties where notes OR p_eng_res has content (those are the "Agent Comments")
    // p_english is the Advertising Remarks destination
    let allProperties: {
      id: string;
      notes: string | null;
      p_eng_res: string | null;
      p_english: string | null;
    }[] = [];
    let from = 0;
    const PAGE = 1000;

    // Fetch properties where notes OR p_eng_res is non-empty (these are the agent comment sources)
    while (true) {
      const { data, error } = await supabase
        .from('properties')
        .select('id, notes, p_eng_res, p_english')
        .or('notes.neq.,p_eng_res.neq.')
        .not('notes', 'is', null)
        .range(from, from + PAGE - 1);

      if (error) {
        // If the OR query fails, fall back to separate queries
        break;
      }
      if (!data || data.length === 0) break;
      allProperties = allProperties.concat(
        data as { id: string; notes: string | null; p_eng_res: string | null; p_english: string | null }[]
      );
      if (data.length < PAGE) break;
      from += PAGE;
    }

    // Also fetch properties where p_eng_res is non-empty but notes is null/empty
    let from2 = 0;
    while (true) {
      const { data, error } = await supabase
        .from('properties')
        .select('id, notes, p_eng_res, p_english')
        .not('p_eng_res', 'is', null)
        .neq('p_eng_res', '')
        .range(from2, from2 + PAGE - 1);

      if (error) break;
      if (!data || data.length === 0) break;

      // Add only if not already in allProperties
      for (const row of data as { id: string; notes: string | null; p_eng_res: string | null; p_english: string | null }[]) {
        if (!allProperties.find((p) => p.id === row.id)) {
          allProperties.push(row);
        }
      }
      if (data.length < PAGE) break;
      from2 += PAGE;
    }

    // Also fetch properties where notes is non-empty
    let from3 = 0;
    while (true) {
      const { data, error } = await supabase
        .from('properties')
        .select('id, notes, p_eng_res, p_english')
        .not('notes', 'is', null)
        .neq('notes', '')
        .range(from3, from3 + PAGE - 1);

      if (error) break;
      if (!data || data.length === 0) break;

      for (const row of data as { id: string; notes: string | null; p_eng_res: string | null; p_english: string | null }[]) {
        if (!allProperties.find((p) => p.id === row.id)) {
          allProperties.push(row);
        }
      }
      if (data.length < PAGE) break;
      from3 += PAGE;
    }

    // Filter to only properties that actually have agent comment content
    const propertiesWithComments = allProperties.filter((p) => {
      const notesVal = (p.notes ?? '').trim();
      const pEngResVal = (p.p_eng_res ?? '').trim();
      return notesVal.length > 0 || pEngResVal.length > 0;
    });

    if (propertiesWithComments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No properties with agent comments found in notes or p_eng_res columns.',
        updated: 0,
        debug: {
          totalFetched: allProperties.length,
          columnsChecked: ['notes', 'p_eng_res'],
        },
      });
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process in batches of 50
    const BATCH_SIZE = 50;
    for (let i = 0; i < propertiesWithComments.length; i += BATCH_SIZE) {
      const batch = propertiesWithComments.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (prop) => {
          // Combine agent comment sources: notes takes priority, then p_eng_res
          const notesVal = (prop.notes ?? '').trim();
          const pEngResVal = (prop.p_eng_res ?? '').trim();

          // Build the agent comment text (combine both if both have content)
          let agentComment = '';
          if (notesVal && pEngResVal && notesVal !== pEngResVal) {
            agentComment = `${notesVal}\n\n${pEngResVal}`;
          } else {
            agentComment = notesVal || pEngResVal;
          }

          if (!agentComment) return; // Nothing to migrate

          const existingRemarks = (prop.p_english ?? '').trim();

          // Merge: if advertising remarks already has content, append; otherwise replace
          const newRemarks = existingRemarks
            ? `${existingRemarks}\n\n${agentComment}`
            : agentComment;

          const { error } = await supabase
            .from('properties')
            .update({
              p_english: newRemarks,
              notes: null,
              p_eng_res: null,
            })
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
      total: propertiesWithComments.length,
      updated: successCount,
      failed: errorCount,
      errors: errors.slice(0, 50),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
