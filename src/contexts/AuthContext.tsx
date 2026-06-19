'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import React from 'react';

export type UserRole = 'agent' | 'manager' | 'admin';

interface AuthContextType {
  user: any;
  session: any;
  loading: boolean;
  role: UserRole | null;
  profileLoading: boolean;
  signUp: (email: string, password: string, metadata?: any) => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  getCurrentUser: () => Promise<any>;
  isEmailVerified: () => boolean;
  getUserProfile: () => Promise<any>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Use a ref to hold the supabase client so it's only created once
  // and never during SSR (avoids hydration mismatches)
  const supabaseRef = React.useRef<ReturnType<typeof createClient> | null>(null);
  function getSupabase() {
    if (!supabaseRef.current) {
      supabaseRef.current = createClient();
    }
    return supabaseRef.current;
  }

  const fetchRole = async (userId: string) => {
    setProfileLoading(true);
    try {
      const { data } = await getSupabase()
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .single();
      setRole((data?.role as UserRole) ?? 'agent');
    } catch {
      setRole('agent');
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.id);
      }
      setLoading(false);
    });

    const {
      data: { subscription }
    } = getSupabase().auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.id);
      } else {
        setRole(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, metadata = {}) => {
    // Always use the published site URL for email confirmation redirects.
    // Using window.location.origin would send the preview domain (proptrack7151.builtwithrocket.new)
    // which is NOT in Supabase's allowed redirect list, causing "Invalid path" errors.
    const envUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
    const siteUrl = (envUrl && !envUrl.includes('builtwithrocket.new')) ? envUrl : 'https://homesrus-proptrack.com';
    const { data, error } = await getSupabase().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback`,
        data: {
          full_name: (metadata as any)?.fullName || '',
          avatar_url: (metadata as any)?.avatarUrl || ''
        }
      }
    });
    if (error) throw error;
    return data;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await getSupabase().auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw error;
  };

  const getCurrentUser = async () => {
    const { data: { user }, error } = await getSupabase().auth.getUser();
    if (error) throw error;
    return user;
  };

  const isEmailVerified = () => {
    return user?.email_confirmed_at !== null;
  };

  const getUserProfile = async () => {
    if (!user) return null;
    const { data, error } = await getSupabase()
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (error) throw error;
    return data;
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    role,
    profileLoading,
    signUp,
    signIn,
    signOut,
    getCurrentUser,
    isEmailVerified,
    getUserProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
