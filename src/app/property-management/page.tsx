import React from 'react';
import AppLayout from '@/components/AppLayout';
import PropertyManagementClient from './components/PropertyManagementClient';

export default function PropertyManagementPage() {
  return (
    <AppLayout>
      <PropertyManagementClient />
    </AppLayout>
  );
}