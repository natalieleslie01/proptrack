import { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import BatchExportFixClient from './components/BatchExportFixClient';
import Icon from '@/components/ui/AppIcon';

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <Icon name="LoaderIcon" size={28} className="text-[#8B1A2B] animate-spin" />
        <p className="text-sm text-[hsl(215,15%,52%)]">Loading batch records…</p>
      </div>
    </div>
  );
}

export default function BatchExportFixPage() {
  return (
    <AppLayout>
      <Suspense fallback={<LoadingFallback />}>
        <BatchExportFixClient />
      </Suspense>
    </AppLayout>
  );
}
