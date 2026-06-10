import React from 'react';
import AppLayout from '@/components/AppLayout';
import RoleGuard from '@/components/RoleGuard';
import TeamManagementClient from './components/TeamManagementClient';

export default function TeamManagementPage() {
  return (
    <AppLayout>
      <RoleGuard permission="canViewTeamManagement">
        <TeamManagementClient />
      </RoleGuard>
    </AppLayout>
  );
}
