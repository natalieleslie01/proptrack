import React from 'react';
import AppLayout from '@/components/AppLayout';
import RoleGuard from '@/components/RoleGuard';
import UserManagementClient from './components/UserManagementClient';

export default function UserManagementPage() {
  return (
    <AppLayout>
      <RoleGuard permission="canManageUsers">
        <UserManagementClient />
      </RoleGuard>
    </AppLayout>
  );
}
