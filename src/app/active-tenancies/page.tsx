import { Metadata } from 'next';
import ActiveTenanciesClient from './components/ActiveTenanciesClient';

export const metadata: Metadata = {
  title: 'Active Tenancies | PropTrack HK',
  description: 'All active tenancies with workflow progress and outstanding actions',
};

export default function ActiveTenanciesPage() {
  return <ActiveTenanciesClient />;
}
