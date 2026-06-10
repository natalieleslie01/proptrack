import { createClient } from '@/lib/supabase/client';

export type EntityType =
  | 'property' |'contact' |'form' |'tenancy' |'maintenance' |'viewing' |'enquiry' |'lease_renewal' |'commission' |'client';

export type ActionType =
  | 'created' |'updated' |'deleted' |'status_changed' |'contact_added' |'contact_updated' |'contact_removed' |'form_generated' |'form_submitted' |'document_uploaded' |'note_added' |'assigned' |'archived';

export interface LogActivityParams {
  entityType: EntityType;
  actionType: ActionType;
  entityId?: string;
  entityRef?: string;
  entityLabel?: string;
  description: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single();

    await supabase.from('activity_log').insert({
      entity_type: params.entityType,
      action_type: params.actionType,
      entity_id: params.entityId ?? null,
      entity_ref: params.entityRef ?? null,
      entity_label: params.entityLabel ?? null,
      user_id: user.id,
      user_name: profile?.full_name || user.email?.split('@')[0] || 'Unknown',
      user_role: profile?.role || 'agent',
      description: params.description,
      before_state: params.beforeState ?? null,
      after_state: params.afterState ?? null,
      metadata: params.metadata ?? null,
    });
  } catch {
    // Silently fail — logging should never break the main flow
  }
}
