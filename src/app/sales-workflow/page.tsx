import { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import SalesWorkflow from './components/SalesWorkflow';

export const metadata = {
  title: 'Sales Workflow — PropTrack HK',
  description: 'Step-by-step sales workflow: Form 3, Provisional S&P, Stamp Duty, Key Handover, and Invoice.',
};

export default function SalesWorkflowPage() {
  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-[#1B4F8A]/10 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1B4F8A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-[hsl(215,25%,18%)]">Sales Workflow</h1>
              <p className="text-sm text-[hsl(215,15%,52%)]">
                Complete the full sales process from initial details through to completion
              </p>
            </div>
          </div>
        </div>

        <Suspense fallback={<div className="text-sm text-[hsl(215,15%,52%)]">Loading workflow…</div>}>
          <SalesWorkflow />
        </Suspense>
      </div>
    </AppLayout>
  );
}
