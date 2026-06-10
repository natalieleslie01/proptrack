import React from 'react';
import AppLayout from '@/components/AppLayout';
import RoleGuard from '@/components/RoleGuard';
import CommissionClient from './components/CommissionClient';

export default function CommissionPage() {
  return (
    <AppLayout>
      <RoleGuard permission="canViewCommission">
        <CommissionClient />
      </RoleGuard>
    </AppLayout>
  );
}
