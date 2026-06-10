import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import BulkDataEditorClient from './components/BulkDataEditorClient';

export default function BulkDataEditorPage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="p-8 text-center text-[hsl(215,15%,52%)]">Loading…</div>}>
        <BulkDataEditorClient />
      </Suspense>
    </AppLayout>
  );
}
