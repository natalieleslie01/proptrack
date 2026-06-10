import React from 'react';
import AppLayout from '@/components/AppLayout';
import RoleGuard from '@/components/RoleGuard';
import ReportsClient from './components/ReportsClient';

export default function ReportsPage() {
  return (
    <AppLayout>
      <RoleGuard permission="canViewReports">
        <ReportsClient />
      </RoleGuard>
    </AppLayout>
  );
}
