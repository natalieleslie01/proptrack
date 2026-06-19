import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
  try {
    // Build admin client inline — avoids any cached/stale module issues
    const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
    const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\s+/g, '');

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: `Missing env vars. URL present: ${!!supabaseUrl}, Key present: ${!!serviceRoleKey}` },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Step 1: fetch ALL properties in pages (no filter — let JS decide) ──
    type PropRow = {
      id: string;
      notes: string | null;
      p_eng_res: string | null;
      p_english: string | null;
      [key: string]: unknown;
    };

    let allProperties: PropRow[] = [];
    let from = 0;
    const PAGE = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('properties')
        .select('id, notes, p_eng_res, p_english')
        .range(from, from + PAGE - 1);

      if (error) {
        return NextResponse.json(
          { error: `DB fetch error: ${error.message}`, hint: error.hint, details: error.details },
          { status: 500 }
        );
      }

      if (!data || data.length === 0) break;
      allProperties = allProperties.concat(data as PropRow[]);
      if (data.length < PAGE) break;
      from += PAGE;
    }

    const totalFetched = allProperties.length;

    // ── Step 2: inspect actual column values to understand data shape ──
    const columnStats = {
      notes_non_null: allProperties.filter((p) => p.notes !== null && p.notes !== undefined).length,
      notes_non_empty: allProperties.filter((p) => (p.notes ?? '').trim().length > 0).length,
      p_eng_res_non_null: allProperties.filter((p) => p.p_eng_res !== null && p.p_eng_res !== undefined).length,
      p_eng_res_non_empty: allProperties.filter((p) => (p.p_eng_res ?? '').trim().length > 0).length,
      p_english_non_empty: allProperties.filter((p) => (p.p_english ?? '').trim().length > 0).length,
    };

    // Sample first 3 rows for debugging
    const sampleRows = allProperties.slice(0, 3).map((p) => ({
      id: p.id,
      notes_preview: p.notes ? String(p.notes).substring(0, 80) : null,
      p_eng_res_preview: p.p_eng_res ? String(p.p_eng_res).substring(0, 80) : null,
      p_english_preview: p.p_english ? String(p.p_english).substring(0, 80) : null,
    }));

    // ── Step 3: filter to properties that have agent comment content ──
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
        total: 0,
        failed: 0,
        debug: {
          totalFetched,
          columnStats,
          sampleRows,
          columnsChecked: ['notes', 'p_eng_res'],
        },
      });
    }

    // ── Step 4: migrate — copy to p_english, clear source fields ──
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    const BATCH_SIZE = 50;
    for (let i = 0; i < propertiesWithComments.length; i += BATCH_SIZE) {
      const batch = propertiesWithComments.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (prop) => {
          const notesVal = (prop.notes ?? '').trim();
          const pEngResVal = (prop.p_eng_res ?? '').trim();

          let agentComment = '';
          if (notesVal && pEngResVal && notesVal !== pEngResVal) {
            agentComment = `${notesVal}\n\n${pEngResVal}`;
          } else {
            agentComment = notesVal || pEngResVal;
          }

          if (!agentComment) return;

          const existingRemarks = (prop.p_english ?? '').trim();
          const newRemarks = existingRemarks
            ? `${existingRemarks}\n\n${agentComment}`
            : agentComment;

          const { error } = await supabase
            .from('properties')
            .update({ p_english: newRemarks, notes: null, p_eng_res: null })
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
      debug: {
        totalFetched,
        columnStats,
        sampleRows,
        columnsChecked: ['notes', 'p_eng_res'],
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
