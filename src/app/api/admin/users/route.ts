import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

// GET /api/admin/users — list all users with activity stats
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check caller is admin or manager
  const { data: callerProfile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!callerProfile || !['admin', 'manager'].includes(callerProfile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch all profiles
  const { data: profiles, error } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, role, is_active, created_at, updated_at, last_sign_in_at')
    .order('full_name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch enquiry counts per agent
  const { data: enquiryCounts } = await supabase
    .from('enquiries')
    .select('assigned_agent_id')
    .not('assigned_agent_id', 'is', null);

  const countMap: Record<string, number> = {};
  enquiryCounts?.forEach((e) => {
    if (e.assigned_agent_id) {
      countMap[e.assigned_agent_id] = (countMap[e.assigned_agent_id] || 0) + 1;
    }
  });

  const users = profiles?.map((p) => ({
    id: p.id,
    email: p.email,
    fullName: p.full_name,
    role: p.role,
    isActive: p.is_active,
    createdAt: p.created_at,
    lastSignInAt: p.last_sign_in_at,
    enquiriesHandled: countMap[p.id] || 0,
  }));

  return NextResponse.json({ users });
}

// POST /api/admin/users — invite/create a new user
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: callerProfile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!callerProfile || callerProfile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { email, fullName, role, password } = body;

  if (!email || !fullName || !role || !password) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Use admin client (service role) to create auth user
  const adminClient = createAdminClient();
  const { data: signUpData, error: signUpError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });

  if (signUpError) return NextResponse.json({ error: signUpError.message }, { status: 400 });

  const newUserId = signUpData.user?.id;
  if (!newUserId) return NextResponse.json({ error: 'User creation failed' }, { status: 500 });

  // Upsert profile (trigger may have already created it)
  const { error: profileError } = await supabase
    .from('user_profiles')
    .upsert({ id: newUserId, email, full_name: fullName, role, is_active: true }, { onConflict: 'id' });

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  return NextResponse.json({ success: true, userId: newUserId });
}
