import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface UpdateRow {
  short_code: string;
  [key: string]: unknown;
}

interface BulkUpdateRequest {
  rows: UpdateRow[];
  mode: 'pricing-update' | 'update-by-shortcode';
}

export async function POST(request: NextRequest) {
  try {
    const body: BulkUpdateRequest = await request.json();
    const { rows, mode } = body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Pre-fetch all properties: build case-insensitive short_code → id map
    const scToId = new Map<string, string>();
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('properties')
        .select('id, short_code')
        .range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      (data as { id: string; short_code: string | null }[]).forEach((row) => {
        if (row.short_code) {
          scToId.set(row.short_code.trim().toUpperCase(), row.id);
        }
      });
      if (data.length < PAGE) break;
      from += PAGE;
    }

    let success = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Process updates in parallel batches of 50
    const BATCH_SIZE = 50;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (row) => {
          const { short_code, ...updateFields } = row;

          if (!short_code) {
            skipped++;
            return;
          }

          // Build update payload — remove undefined values
          const updatePayload: Record<string, unknown> = {};
          Object.entries(updateFields).forEach(([k, v]) => {
            if (v !== undefined) updatePayload[k] = v;
          });

          // For pricing-update mode, null values are intentional (clear the field)
          // For update-by-shortcode mode, null values should also be kept if explicitly set
          if (Object.keys(updatePayload).length === 0) {
            skipped++;
            return;
          }

          const lookupKey = short_code.trim().toUpperCase();
          const propertyId = scToId.get(lookupKey);

          if (!propertyId) {
            errors.push(`${short_code}: no matching property found — skipped`);
            skipped++;
            return;
          }

          const { error } = await supabase
            .from('properties')
            .update(updatePayload)
            .eq('id', propertyId);

          if (error) {
            errors.push(`${short_code}: ${error.message}`);
            skipped++;
          } else {
            success++;
          }
        })
      );
    }

    return NextResponse.json({
      success: true,
      mode,
      totalRows: rows.length,
      successCount: success,
      skippedCount: skipped,
      errors: errors.slice(0, 50),
      errorCount: errors.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
