import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const demoUsers = [
  {
    email: 'natalie@homesrus.hk',
    password: 'Agent@PropHK2026',
    full_name: 'Natalie Leslie',
    role: 'admin',
  },
  {
    email: 'nicky@homesrus.hk',
    password: 'Agent@PropHK2026',
    full_name: 'Nicola Baird',
    role: 'agent',
  },
  {
    email: 'cris@homesrus.hk',
    password: 'Agent@PropHK2026',
    full_name: 'Cris Yan',
    role: 'agent',
  },
];

export async function POST() {
  try {
    const adminClient = createAdminClient();
    const results: { email: string; status: string; error?: string }[] = [];

    for (const user of demoUsers) {
      // Check if user already exists
      const { data: existingUsers } = await adminClient.auth.admin.listUsers();
      const alreadyExists = existingUsers?.users?.some((u) => u.email === user.email);

      if (alreadyExists) {
        results.push({ email: user.email, status: 'already_exists' });
        continue;
      }

      // Create user with email already confirmed
      const { data, error } = await adminClient.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          full_name: user.full_name,
          role: user.role,
        },
      });

      if (error) {
        results.push({ email: user.email, status: 'error', error: error.message });
      } else {
        results.push({ email: user.email, status: 'created' });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
