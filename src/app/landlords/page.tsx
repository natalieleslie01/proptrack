'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import LandlordsClient from './components/LandlordsClient';

export default async function LandlordsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase?.auth?.getUser();
  if (!user) redirect('/sign-up-login');

  return (
    <AppLayout>
      <LandlordsClient />
    </AppLayout>
  );
}
