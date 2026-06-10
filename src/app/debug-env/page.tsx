import AppLayout from '@/components/AppLayout';
import DebugEnvClient from './components/DebugEnvClient';

export const metadata = {
  title: 'Debug: Env & Supabase | PropTrack HK',
  description: 'Admin-only debug screen for environment variables and Supabase connection status',
};

export default function DebugEnvPage() {
  return (
    <AppLayout>
      <DebugEnvClient />
    </AppLayout>
  );
}
