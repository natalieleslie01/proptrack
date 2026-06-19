import { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import LeaseWorkflow from './components/LeaseWorkflow';

export const metadata = {
  title: 'Lease Workflow — PropTrack HK',
  description: 'Step-by-step lease workflow: Land Search, ID Documents, PTA, Formal TA, Handover, and Utilities.',
};

export default function LeaseWorkflowPage() {
  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-[#1B4F8A]/10 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1B4F8A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-[hsl(215,25%,18%)]">Lease Workflow</h1>
              <p className="text-sm text-[hsl(215,15%,52%)]">
                Complete the full lease process from Land Search through to Tenant Extras
              </p>
            </div>
          </div>
        </div>

        <Suspense fallback={<div className="text-sm text-[hsl(215,15%,52%)]">Loading workflow…</div>}>
          <LeaseWorkflow />
        </Suspense>
      </div>
    </AppLayout>
  );
}
