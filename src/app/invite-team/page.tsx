import React from 'react';
import AppLayout from '@/components/AppLayout';
import RoleGuard from '@/components/RoleGuard';
import InviteTeamClient from './components/InviteTeamClient';

export default function InviteTeamPage() {
  return (
    <AppLayout>
      <RoleGuard permission="canInviteTeam">
        <InviteTeamClient />
      </RoleGuard>
    </AppLayout>
  );
}
