import { Metadata } from 'next';
import TenancyHandoverClient from './components/TenancyHandoverClient';

export const metadata: Metadata = {
  title: 'Tenancy Handover | PropTrack HK',
  description: 'Close tenancies, capture handover notes and archive into Completed Tenancies',
};

export default function TenancyHandoverPage() {
  return <TenancyHandoverClient />;
}
