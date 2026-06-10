import AdminPanelClient from './components/AdminPanelClient';
import AppLayout from '@/components/AppLayout';

export const metadata = {
  title: 'Admin Panel | PropTrack HK',
  description: 'Invite team members, assign roles, and manage user access and permissions',
};

export default function AdminPanelPage() {
  return (
    <AppLayout>
      <AdminPanelClient />
    </AppLayout>
  );
}
