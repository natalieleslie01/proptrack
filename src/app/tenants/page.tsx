import { Metadata } from 'next';
import TenantsClient from './components/TenantsClient';

export const metadata: Metadata = {
  title: 'Tenants | PropTrack HK',
  description: 'View, search, and manage all tenants across properties with lease terms and status',
};

export default function TenantsPage() {
  return <TenantsClient />;
}
