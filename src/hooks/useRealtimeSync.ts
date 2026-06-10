'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface RealtimeSyncOptions {
  /** Supabase table name to subscribe to */
  table: string;
  /** Optional: filter by a specific column value e.g. { column: 'property_id', value: 'uuid' } */
  filter?: { column: string; value: string };
  /** Called on any change event */
  onInsert?: (payload: Record<string, unknown>) => void;
  onUpdate?: (payload: Record<string, unknown>) => void;
  onDelete?: (payload: Record<string, unknown>) => void;
  /** Called for any event (INSERT | UPDATE | DELETE) */
  onChange?: (event: RealtimeEvent, payload: Record<string, unknown>) => void;
  /** Channel name — must be unique per subscription */
  channelName: string;
  /** Whether the subscription is active */
  enabled?: boolean;
}

/**
 * useRealtimeSync
 * Subscribes to Supabase Realtime changes on a given table.
 * Automatically cleans up the channel on unmount or when options change.
 */
export function useRealtimeSync(options: RealtimeSyncOptions) {
  const {
    table,
    filter,
    onInsert,
    onUpdate,
    onDelete,
    onChange,
    channelName,
    enabled = true,
  } = options;

  // Keep stable refs so the effect doesn't re-run on every render
  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);
  const onChangeRef = useRef(onChange);

  useEffect(() => { onInsertRef.current = onInsert; }, [onInsert]);
  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);
  useEffect(() => { onDeleteRef.current = onDelete; }, [onDelete]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();

    const filterStr = filter ? `${filter.column}=eq.${filter.value}` : undefined;

    const channel: RealtimeChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as Parameters<RealtimeChannel['on']>[0],
        {
          event: '*',
          schema: 'public',
          table,
          ...(filterStr ? { filter: filterStr } : {}),
        },
        (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
          const event = payload.eventType as RealtimeEvent;
          const record = payload.new ?? payload.old;

          if (event === 'INSERT' && onInsertRef.current) onInsertRef.current(record);
          if (event === 'UPDATE' && onUpdateRef.current) onUpdateRef.current(record);
          if (event === 'DELETE' && onDeleteRef.current) onDeleteRef.current(payload.old);
          if (onChangeRef.current) onChangeRef.current(event, record);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, channelName, filter?.column, filter?.value, enabled]);
}

/**
 * usePropertiesRealtime
 * Subscribes to all property changes and calls the provided callback.
 */
export function usePropertiesRealtime(onChange: (event: RealtimeEvent, row: Record<string, unknown>) => void, enabled = true) {
  useRealtimeSync({
    table: 'properties',
    channelName: 'realtime:properties',
    onChange,
    enabled,
  });
}

/**
 * useViewingsRealtime
 * Subscribes to all viewing changes and calls the provided callback.
 * Optionally scoped to a specific property_id.
 */
export function useViewingsRealtime(
  onChange: (event: RealtimeEvent, row: Record<string, unknown>) => void,
  propertyId?: string,
  enabled = true
) {
  useRealtimeSync({
    table: 'viewings',
    channelName: propertyId ? `realtime:viewings:${propertyId}` : 'realtime:viewings',
    filter: propertyId ? { column: 'property_id', value: propertyId } : undefined,
    onChange,
    enabled,
  });
}

/**
 * usePropertyDocumentsRealtime
 * Subscribes to property_documents changes for a specific property_ref.
 */
export function usePropertyDocumentsRealtime(
  propertyRef: string,
  onChange: (event: RealtimeEvent, row: Record<string, unknown>) => void,
  enabled = true
) {
  useRealtimeSync({
    table: 'property_documents',
    channelName: `realtime:property_documents:${propertyRef}`,
    filter: { column: 'property_ref', value: propertyRef },
    onChange,
    enabled,
  });
}

/**
 * useClientsRealtime
 * Subscribes to all clients/contacts table changes and calls the provided callback.
 */
export function useClientsRealtime(
  onChange: (event: RealtimeEvent, row: Record<string, unknown>) => void,
  enabled = true
) {
  useRealtimeSync({
    table: 'clients',
    channelName: 'realtime:clients',
    onChange,
    enabled,
  });
}

/**
 * useMaintenanceRealtime
 * Subscribes to all maintenance_requests table changes and calls the provided callback.
 */
export function useMaintenanceRealtime(
  onChange: (event: RealtimeEvent, row: Record<string, unknown>) => void,
  enabled = true
) {
  useRealtimeSync({
    table: 'maintenance_requests',
    channelName: 'realtime:maintenance_requests',
    onChange,
    enabled,
  });
}

/**
 * useLeaseRenewalsRealtime
 * Subscribes to all lease_renewals table changes and calls the provided callback.
 */
export function useLeaseRenewalsRealtime(
  onChange: (event: RealtimeEvent, row: Record<string, unknown>) => void,
  enabled = true
) {
  useRealtimeSync({
    table: 'lease_renewals',
    channelName: 'realtime:lease_renewals',
    onChange,
    enabled,
  });
}
