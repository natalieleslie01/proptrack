import { createClient } from '@/lib/supabase/client';

export type EventType =
  | 'property_view' |'csv_upload' |'pdf_download' |'form_submission';

interface EventMetadata {
  [key: string]: string | number | boolean | null | undefined;
}

export async function trackEvent(
  eventType: EventType,
  metadata: EventMetadata = {}
): Promise<void> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from('event_tracking').insert({
      event_type: eventType,
      user_id: user?.id ?? null,
      metadata,
    });
  } catch {
    // Silently fail — tracking should never break the app
  }
}
