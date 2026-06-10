import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role to bypass RLS entirely
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface UpdateRow {
  pid: string; // property_ref
  build_year?: number | null;
  list_type?: string | null;
  prop_types?: string | null;
  prop_type?: string | null;
  floor_type?: string | null;
  saleable_area?: number | null;
  gross_area?: number | null;
  outside_sc?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  direction_id?: string | null;
  view_id?: string | null;
  decor_id?: string | null;
  balcony?: boolean;
  combined?: boolean;
  duplex?: boolean;
  garden?: boolean;
  openkitch?: boolean;
  pool?: boolean;
  roof?: boolean;
  terrace?: boolean;
}

interface UpdateResult {
  pid: string;
  status: 'updated' | 'not_found' | 'error';
  error?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rows: UpdateRow[] = body.rows;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    const results: UpdateResult[] = [];

    // Process in batches of 50 to avoid timeouts
    const BATCH_SIZE = 50;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (row) => {
          const { pid, ...fields } = row;

          if (!pid || pid.trim() === '') {
            results.push({ pid: pid ?? '(empty)', status: 'error', error: 'Missing PID' });
            return;
          }

          // Build update object — only include fields that are explicitly provided (not undefined)
          const updateObj: Record<string, unknown> = {};
          if (fields.build_year !== undefined) updateObj.build_year = fields.build_year;
          if (fields.list_type !== undefined) updateObj.list_type = fields.list_type;
          if (fields.prop_types !== undefined) {
            updateObj.prop_types = fields.prop_types;
            updateObj.prop_type = fields.prop_types; // keep both columns in sync
          }
          if (fields.floor_type !== undefined) updateObj.floor_type = fields.floor_type;
          if (fields.saleable_area !== undefined) updateObj.saleable_area = fields.saleable_area;
          if (fields.gross_area !== undefined) updateObj.gross_area = fields.gross_area;
          if (fields.outside_sc !== undefined) updateObj.outside_sc = fields.outside_sc;
          if (fields.bedrooms !== undefined) updateObj.bedrooms = fields.bedrooms;
          if (fields.bathrooms !== undefined) updateObj.bathrooms = fields.bathrooms;
          if (fields.direction_id !== undefined) updateObj.direction_id = fields.direction_id;
          if (fields.view_id !== undefined) updateObj.view_id = fields.view_id;
          if (fields.decor_id !== undefined) updateObj.decor_id = fields.decor_id;
          if (fields.balcony !== undefined) updateObj.balcony = fields.balcony;
          if (fields.combined !== undefined) updateObj.combined = fields.combined;
          if (fields.duplex !== undefined) updateObj.duplex = fields.duplex;
          if (fields.garden !== undefined) updateObj.garden = fields.garden;
          if (fields.openkitch !== undefined) updateObj.openkitch = fields.openkitch;
          if (fields.pool !== undefined) updateObj.pool = fields.pool;
          if (fields.roof !== undefined) updateObj.roof = fields.roof;
          if (fields.terrace !== undefined) updateObj.terrace = fields.terrace;

          if (Object.keys(updateObj).length === 0) {
            results.push({ pid, status: 'error', error: 'No fields to update' });
            return;
          }

          // Always update updated_at
          updateObj.updated_at = new Date().toISOString();

          const { data, error } = await supabaseAdmin
            .from('properties')
            .update(updateObj)
            .eq('property_ref', pid.trim())
            .select('property_ref')
            .single();

          if (error) {
            if (error.code === 'PGRST116') {
              results.push({ pid, status: 'not_found' });
            } else {
              results.push({ pid, status: 'error', error: error.message });
            }
          } else if (!data) {
            results.push({ pid, status: 'not_found' });
          } else {
            results.push({ pid, status: 'updated' });
          }
        })
      );
    }

    const updated = results.filter((r) => r.status === 'updated').length;
    const notFound = results.filter((r) => r.status === 'not_found').length;
    const errors = results.filter((r) => r.status === 'error').length;

    return NextResponse.json({
      success: true,
      summary: { total: rows.length, updated, notFound, errors },
      results,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
