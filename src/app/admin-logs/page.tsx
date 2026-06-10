import React from 'react';
import AppLayout from '@/components/AppLayout';
import RoleGuard from '@/components/RoleGuard';
import AdminLogsClient from './components/AdminLogsClient';

export default function AdminLogsPage() {
  return (
    <AppLayout>
      <RoleGuard permission="canViewAdminLogs">
        <AdminLogsClient />
      </RoleGuard>
    </AppLayout>
  );
}
