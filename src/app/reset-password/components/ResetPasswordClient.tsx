'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordClient() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    // Listen for the PASSWORD_RECOVERY event first (fires when verifyOtp sets the session)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setIsValidSession(true);
        setCheckingSession(false);
      }
    });

    // Also check if a session already exists (e.g. page reload after verifyOtp)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsValidSession(true);
      }
      setCheckingSession(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success('Password updated successfully! Please sign in with your new password.');
      await supabase.auth.signOut();
      router.push('/sign-up-login');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-[hsl(210,20%,97%)]">
      {/* Left Panel — Brand */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] bg-[#8B1A2B] flex-col relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute top-0 left-0 w-full h-full"
            style={{
              backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(255,255,255,0.3) 40px, rgba(255,255,255,0.3) 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,0.3) 40px, rgba(255,255,255,0.3) 41px)`,
            }}
          />
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-48 opacity-20">
          <svg viewBox="0 0 800 200" className="w-full h-full" preserveAspectRatio="xMidYMax meet">
            <rect x="20" y="80" width="40" height="120" fill="white" />
            <rect x="70" y="50" width="50" height="150" fill="white" />
            <rect x="130" y="40" width="35" height="160" fill="white" />
            <rect x="175" y="70" width="45" height="130" fill="white" />
            <rect x="230" y="20" width="60" height="180" fill="white" />
            <rect x="300" y="55" width="40" height="145" fill="white" />
            <rect x="350" y="35" width="55" height="165" fill="white" />
            <rect x="415" y="65" width="40" height="135" fill="white" />
            <rect x="465" y="45" width="50" height="155" fill="white" />
            <rect x="525" y="25" width="45" height="175" fill="white" />
            <rect x="580" y="60" width="40" height="140" fill="white" />
            <rect x="630" y="40" width="55" height="160" fill="white" />
            <rect x="695" y="70" width="35" height="130" fill="white" />
            <rect x="740" y="50" width="45" height="150" fill="white" />
          </svg>
        </div>
        <div className="relative z-10 flex flex-col h-full p-10 xl:p-14">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden">
              <AppLogo size={44} />
            </div>
            <div>
              <span className="font-bold text-white text-xl tracking-tight">
                PropTrack<span className="text-[#F5C6CB]"> HK</span>
              </span>
              <p className="text-red-200 text-xs">Property Management Platform</p>
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-4">
              Secure Your
              <span className="block text-[#F5C6CB]">Account Access.</span>
            </h1>
            <p className="text-red-200 text-lg leading-relaxed max-w-md">
              Create a strong new password to protect your PropTrack HK account and all your property management data.
            </p>
            <div className="mt-8 space-y-3">
              {[
                { icon: 'ShieldCheckIcon', text: 'Use at least 8 characters' },
                { icon: 'KeyIcon', text: 'Mix letters, numbers and symbols' },
                { icon: 'LockIcon', text: 'Avoid reusing old passwords' },
              ].map((f) => (
                <div key={`tip-${f.icon}`} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Icon name={f.icon as Parameters<typeof Icon>[0]['name']} size={15} className="text-[#F5C6CB]" />
                  </div>
                  <p className="text-red-100 text-sm">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="w-full lg:w-1/2 xl:w-[45%] flex items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <AppLogo size={36} />
            <span className="font-bold text-[#8B1A2B] text-lg tracking-tight">
              PropTrack<span className="text-[#2C2C2C]"> HK</span>
            </span>
          </div>

          {checkingSession ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Icon name="Loader2Icon" size={32} className="animate-spin text-[#8B1A2B]" />
              <p className="text-sm text-[hsl(215,15%,52%)]">Verifying reset link…</p>
            </div>
          ) : !isValidSession ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <Icon name="AlertCircleIcon" size={28} className="text-[#8B1A2B]" />
              </div>
              <h2 className="text-xl font-bold text-[hsl(215,25%,18%)] mb-2">Link Expired or Invalid</h2>
              <p className="text-sm text-[hsl(215,15%,52%)] mb-6 leading-relaxed">
                This password reset link has expired or is no longer valid. Please request a new one.
              </p>
              <button
                onClick={() => router.push('/sign-up-login')}
                className="btn-primary justify-center py-2.5 text-sm font-semibold"
              >
                <Icon name="ArrowLeftIcon" size={16} />
                Back to Sign In
              </button>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <div className="w-12 h-12 rounded-xl bg-[#8B1A2B]/10 flex items-center justify-center mb-4">
                  <Icon name="LockIcon" size={22} className="text-[#8B1A2B]" />
                </div>
                <h2 className="text-2xl font-bold text-[hsl(215,25%,18%)]">Set New Password</h2>
                <p className="text-sm text-[hsl(215,15%,52%)] mt-1.5">
                  Choose a strong password for your PropTrack account.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4" suppressHydrationWarning>
                {/* New Password */}
                <div>
                  <label htmlFor="new-password" className="block text-sm font-semibold text-[hsl(215,25%,18%)] mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    {mounted ? (
                      <input
                        id="new-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Min. 8 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="input-base pr-10"
                        required
                      />
                    ) : (
                      <div className="input-base h-10 bg-[hsl(210,20%,97%)]" />
                    )}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)] transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <Icon name={showPassword ? 'EyeOffIcon' : 'EyeIcon'} size={16} />
                    </button>
                  </div>
                  {password.length > 0 && password.length < 8 && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <Icon name="AlertCircleIcon" size={12} />
                      Password must be at least 8 characters
                    </p>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label htmlFor="confirm-password" className="block text-sm font-semibold text-[hsl(215,25%,18%)] mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    {mounted ? (
                      <input
                        id="confirm-password"
                        type={showConfirm ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Re-enter your new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="input-base pr-10"
                        required
                      />
                    ) : (
                      <div className="input-base h-10 bg-[hsl(210,20%,97%)]" />
                    )}
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)] transition-colors"
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    >
                      <Icon name={showConfirm ? 'EyeOffIcon' : 'EyeIcon'} size={16} />
                    </button>
                  </div>
                  {confirmPassword.length > 0 && password !== confirmPassword && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <Icon name="AlertCircleIcon" size={12} />
                      Passwords do not match
                    </p>
                  )}
                </div>

                {/* Password strength hint */}
                {password.length >= 8 && (
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-xs text-green-700 flex items-center gap-1.5">
                      <Icon name="CheckCircleIcon" size={13} />
                      Password meets minimum requirements
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary w-full justify-center py-2.5 text-sm font-semibold"
                  style={{ minHeight: '42px' }}
                >
                  {isLoading ? (
                    <>
                      <Icon name="Loader2Icon" size={16} className="animate-spin" />
                      Updating password…
                    </>
                  ) : (
                    <>
                      <Icon name="ShieldCheckIcon" size={16} />
                      Update Password
                    </>
                  )}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button
                  onClick={() => router.push('/sign-up-login')}
                  className="text-xs text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)] transition-colors"
                >
                  Back to sign in
                </button>
              </div>
            </>
          )}

          <p className="text-center text-xs text-[hsl(215,15%,52%)] mt-8">
            PropTrack HK · Licensed Estate Agency Management System
            <br />
            Compliant with Landlord and Tenant (Consolidation) Ordinance (Cap. 7)
          </p>
        </div>
      </div>
    </div>
  );
}
