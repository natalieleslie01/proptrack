import React from 'react';
import AppLayout from '@/components/AppLayout';
import RoleGuard from '@/components/RoleGuard';
import AgentMetricsClient from './components/AgentMetricsClient';

export default function AgentMetricsPage() {
  return (
    <AppLayout>
      <RoleGuard permission="canViewAgentMetrics">
        <AgentMetricsClient />
      </RoleGuard>
    </AppLayout>
  );
}
