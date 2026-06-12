'use client';

import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { usePropertiesRealtime, RealtimeEvent } from '@/hooks/useRealtimeSync';

type PropertiesChangeHandler = (event: RealtimeEvent, row: Record<string, unknown>) => void;

interface PropertiesRealtimeContextValue {
  subscribe: (handler: PropertiesChangeHandler) => () => void;
}

const PropertiesRealtimeContext = createContext<PropertiesRealtimeContextValue | null>(null);

export function PropertiesRealtimeProvider({ children }: { children: React.ReactNode }) {
  const subscribersRef = useRef(new Set<PropertiesChangeHandler>());

  const broadcast = useCallback((event: RealtimeEvent, row: Record<string, unknown>) => {
    subscribersRef.current.forEach((handler) => handler(event, row));
  }, []);

  usePropertiesRealtime(broadcast);

  const subscribe = useCallback((handler: PropertiesChangeHandler) => {
    subscribersRef.current.add(handler);
    return () => {
      subscribersRef.current.delete(handler);
    };
  }, []);

  return (
    <PropertiesRealtimeContext.Provider value={{ subscribe }}>
      {children}
    </PropertiesRealtimeContext.Provider>
  );
}

export function usePropertiesChangeListener(
  onChange: PropertiesChangeHandler,
  enabled = true
) {
  const context = useContext(PropertiesRealtimeContext);
  if (!context) {
    throw new Error('usePropertiesChangeListener must be used within PropertiesRealtimeProvider');
  }

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const { subscribe } = context;

  useEffect(() => {
    if (!enabled) return;
    return subscribe((event, row) => onChangeRef.current(event, row));
  }, [subscribe, enabled]);
}
