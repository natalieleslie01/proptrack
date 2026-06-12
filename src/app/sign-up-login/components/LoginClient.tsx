'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

interface LoginFormData {
  email: string;
  password: string;
  remember: boolean;
}

interface SignUpFormData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const hkDistricts = ['Central', 'Wan Chai', 'Causeway Bay', 'Tsim Sha Tsui', 'Mong Kok', 'Admiralty', 'Mid-Levels', 'West Kowloon'];

export default function LoginClient() {
  const router = useRouter();
  const { signIn, signUp, user, loading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [mounted, setMounted] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // When loginSuccess is true and user is populated (session committed), navigate
  useEffect(() => {
    if (loginSuccess && !loading && user) {
      window.location.replace('/dashboard');
    }
  }, [loginSuccess, loading, user]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    defaultValues: { email: '', password: '', remember: false },
  });

  const {
    register: registerSignUp,
    handleSubmit: handleSubmitSignUp,
    watch: watchSignUp,
    formState: { errors: signUpErrors },
  } = useForm<SignUpFormData>({
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  });

    async function onSubmit(data: LoginFormData) {
    setIsLoading(true);
    try {
      await signIn(data.email, data.password);
      toast.success(`Welcome back!`);
      setLoginSuccess(true);
    } catch (err: any) {
      const msg: string = err?.message || '';
      if (msg.toLowerCase().includes('email not confirmed')) {
        toast.error('Please confirm your email address before signing in. Check your inbox.');
      } else if (msg.toLowerCase().includes('invalid login credentials') || msg.toLowerCase().includes('invalid credentials')) {
        toast.error('Incorrect email or password. Please try again.');
      } else {
        toast.error(msg || 'Sign in failed — please check your credentials and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function onSignUp(data: SignUpFormData) {
    setIsLoading(true);
    try {
      await signUp(data.email, data.password, { fullName: data.fullName });
      toast.success('Account created! Please check your email to confirm your account.');
      setMode('login');
    } catch (err: any) {
      toast.error(err?.message || 'Sign up failed — please try again');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotLoading(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const envUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
      const siteUrl = (envUrl && !envUrl.includes('builtwithrocket.new')) ? envUrl : 'https://homesrus-proptrack.com';
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${siteUrl}/auth/callback?type=recovery`,
      });
      if (error) throw error;
      setForgotSent(true);
    } catch (err: any) {
      const msg: string = err?.message || '';
      toast.error(msg || 'Failed to send reset email. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-[hsl(210,20%,97%)]">
      {/* Left Panel — Brand */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] bg-[#8B1A2B] flex-col relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-full h-full" style={{
            backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(255,255,255,0.3) 40px, rgba(255,255,255,0.3) 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,0.3) 40px, rgba(255,255,255,0.3) 41px)`
          }} />
        </div>

        {/* Skyline silhouette */}
        <div className="absolute bottom-0 left-0 right-0 h-48 opacity-20">
          <svg viewBox="0 0 800 200" className="w-full h-full" preserveAspectRatio="xMidYMax meet">
            <rect x="20" y="80" width="40" height="120" fill="white" />
            <rect x="30" y="60" width="20" height="20" fill="white" />
            <rect x="70" y="50" width="50" height="150" fill="white" />
            <rect x="80" y="30" width="30" height="20" fill="white" />
            <rect x="130" y="40" width="35" height="160" fill="white" />
            <rect x="175" y="70" width="45" height="130" fill="white" />
            <rect x="230" y="20" width="60" height="180" fill="white" />
            <rect x="245" y="5" width="30" height="15" fill="white" />
            <rect x="300" y="55" width="40" height="145" fill="white" />
            <rect x="350" y="35" width="55" height="165" fill="white" />
            <rect x="360" y="15" width="35" height="20" fill="white" />
            <rect x="415" y="65" width="40" height="135" fill="white" />
            <rect x="465" y="45" width="50" height="155" fill="white" />
            <rect x="525" y="25" width="45" height="175" fill="white" />
            <rect x="535" y="10" width="25" height="15" fill="white" />
            <rect x="580" y="60" width="40" height="140" fill="white" />
            <rect x="630" y="40" width="55" height="160" fill="white" />
            <rect x="695" y="70" width="35" height="130" fill="white" />
            <rect x="740" y="50" width="45" height="150" fill="white" />
          </svg>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full p-10 xl:p-14">
          {/* Logo */}
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

          {/* Hero text */}
          <div className="flex-1 flex flex-col justify-center">
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-4">
              Hong Kong Real Estate
              <span className="block text-[#F5C6CB]">Managed Precisely.</span>
            </h1>
            <p className="text-red-200 text-lg leading-relaxed max-w-md">
              Track 10,000+ properties, manage tenancies, auto-generate HK legal forms, and stay compliant with the Landlord and Tenant (Consolidation) Ordinance.
            </p>

            {/* Feature bullets */}
            <div className="mt-8 space-y-3">
              {[
                { icon: 'FileCheckIcon', text: 'Auto-generate CR109, AR1 & S&P forms' },
                { icon: 'KeyIcon', text: 'Full tenancy lifecycle management' },
                { icon: 'CalendarIcon', text: 'Viewing schedules & print-ready reports' },
                { icon: 'ShieldCheckIcon', text: 'Role-based access — Agents, Managers, Admins' },
              ].map((f) => (
                <div key={`feat-${f.icon}`} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Icon name={f.icon as Parameters<typeof Icon>[0]['name']} size={15} className="text-[#F5C6CB]" />
                  </div>
                  <p className="text-red-100 text-sm">{f.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Districts ticker */}
          <div className="mt-auto">
            <p className="text-red-300 text-xs mb-2">Active in all 18 HK Districts</p>
            <div className="flex flex-wrap gap-2">
              {hkDistricts.map((d) => (
                <span key={`district-${d}`} className="text-xs bg-white/10 text-red-200 px-2.5 py-1 rounded-full border border-white/10">
                  {d}
                </span>
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

          {mode === 'login' || mode === 'signup' ? (
            <>
              {/* Tab switcher */}
              <div className="flex rounded-xl border border-[hsl(214,20%,88%)] p-1 mb-8 bg-[hsl(210,20%,97%)]">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                    mode === 'login' ?'bg-white text-[#8B1A2B] shadow-sm' :'text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)]'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                    mode === 'signup' ?'bg-white text-[#8B1A2B] shadow-sm' :'text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)]'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              {mode === 'login' ? (
                <>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-[hsl(215,25%,18%)]">Sign in to PropTrack</h2>
                    <p className="text-sm text-[hsl(215,15%,52%)] mt-1.5">
                      Hong Kong Property Management Platform
                    </p>
                  </div>

                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" suppressHydrationWarning>
                    {/* Email */}
                    <div>
                      <label htmlFor="email" className="block text-sm font-semibold text-[hsl(215,25%,18%)] mb-1.5">
                        Email Address
                      </label>
                      {mounted ? (
                        <input
                          id="email"
                          type="email"
                          autoComplete="email"
                          placeholder="you@proptrack.hk"
                          className={`input-base ${errors.email ? 'border-red-400 focus:ring-red-300 focus:border-red-400' : ''}`}
                          {...register('email', {
                            required: 'Email address is required',
                            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' },
                          })}
                        />
                      ) : (
                        <div className="input-base h-10 bg-[hsl(210,20%,97%)]" />
                      )}
                      {errors.email && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <Icon name="AlertCircleIcon" size={12} />
                          {errors.email.message}
                        </p>
                      )}
                    </div>

                    {/* Password */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="password" className="block text-sm font-semibold text-[hsl(215,25%,18%)]">
                          Password
                        </label>
                        <button
                          type="button"
                          onClick={() => setMode('forgot')}
                          className="text-xs text-[#8B1A2B] hover:text-[#6E1522] font-medium transition-colors"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        {mounted ? (
                          <input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            placeholder="Enter your password"
                            className={`input-base pr-10 ${errors.password ? 'border-red-400 focus:ring-red-300 focus:border-red-400' : ''}`}
                            {...register('password', {
                              required: 'Password is required',
                              minLength: { value: 8, message: 'Password must be at least 8 characters' },
                            })}
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
                      {errors.password && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <Icon name="AlertCircleIcon" size={12} />
                          {errors.password.message}
                        </p>
                      )}
                    </div>

                    {/* Remember me */}
                    <div className="flex items-center gap-2.5">
                      {mounted ? (
                        <input
                          id="remember"
                          type="checkbox"
                          className="rounded border-[hsl(214,20%,88%)] accent-[#8B1A2B] w-4 h-4"
                          {...register('remember')}
                        />
                      ) : (
                        <div className="rounded border border-[hsl(214,20%,88%)] w-4 h-4 bg-[hsl(210,20%,97%)]" />
                      )}
                      <label htmlFor="remember" className="text-sm text-[hsl(215,25%,18%)] cursor-pointer select-none">
                        Keep me signed in for 30 days
                      </label>
                    </div>

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="btn-primary w-full justify-center py-2.5 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{ minHeight: '42px' }}
                    >
                      {isLoading ? (
                        <>
                          <Icon name="Loader2Icon" size={16} className="animate-spin" />
                          Signing in…
                        </>
                      ) : (
                        <>
                          <Icon name="LogInIcon" size={16} />
                          Sign In to PropTrack
                        </>
                      )}
                    </button>
                  </form>
                </>
              ) : (
                /* Sign Up Form */
                <>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-[hsl(215,25%,18%)]">Create your account</h2>
                    <p className="text-sm text-[hsl(215,15%,52%)] mt-1.5">
                      Join PropTrack HK — Property Management Platform
                    </p>
                  </div>

                  <form onSubmit={handleSubmitSignUp(onSignUp)} className="space-y-4" suppressHydrationWarning>
                    {/* Full Name */}
                    <div>
                      <label htmlFor="fullName" className="block text-sm font-semibold text-[hsl(215,25%,18%)] mb-1.5">
                        Full Name
                      </label>
                      {mounted ? (
                        <input
                          id="fullName"
                          type="text"
                          autoComplete="name"
                          placeholder="Your full name"
                          className={`input-base ${signUpErrors.fullName ? 'border-red-400 focus:ring-red-300 focus:border-red-400' : ''}`}
                          {...registerSignUp('fullName', {
                            required: 'Full name is required',
                            minLength: { value: 2, message: 'Name must be at least 2 characters' },
                          })}
                        />
                      ) : (
                        <div className="input-base h-10 bg-[hsl(210,20%,97%)]" />
                      )}
                      {signUpErrors.fullName && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <Icon name="AlertCircleIcon" size={12} />
                          {signUpErrors.fullName.message}
                        </p>
                      )}
                    </div>

                    {/* Email */}
                    <div>
                      <label htmlFor="signup-email" className="block text-sm font-semibold text-[hsl(215,25%,18%)] mb-1.5">
                        Email Address
                      </label>
                      {mounted ? (
                        <input
                          id="signup-email"
                          type="email"
                          autoComplete="email"
                          placeholder="you@example.com"
                          className={`input-base ${signUpErrors.email ? 'border-red-400 focus:ring-red-300 focus:border-red-400' : ''}`}
                          {...registerSignUp('email', {
                            required: 'Email address is required',
                            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' },
                          })}
                        />
                      ) : (
                        <div className="input-base h-10 bg-[hsl(210,20%,97%)]" />
                      )}
                      {signUpErrors.email && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <Icon name="AlertCircleIcon" size={12} />
                          {signUpErrors.email.message}
                        </p>
                      )}
                    </div>

                    {/* Password */}
                    <div>
                      <label htmlFor="signup-password" className="block text-sm font-semibold text-[hsl(215,25%,18%)] mb-1.5">
                        Password
                      </label>
                      <div className="relative">
                        {mounted ? (
                          <input
                            id="signup-password"
                            type={showSignUpPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            placeholder="Min. 8 characters"
                            className={`input-base pr-10 ${signUpErrors.password ? 'border-red-400 focus:ring-red-300 focus:border-red-400' : ''}`}
                            {...registerSignUp('password', {
                              required: 'Password is required',
                              minLength: { value: 8, message: 'Password must be at least 8 characters' },
                            })}
                          />
                        ) : (
                          <div className="input-base h-10 bg-[hsl(210,20%,97%)]" />
                        )}
                        <button
                          type="button"
                          onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)] transition-colors"
                          aria-label={showSignUpPassword ? 'Hide password' : 'Show password'}
                        >
                          <Icon name={showSignUpPassword ? 'EyeOffIcon' : 'EyeIcon'} size={16} />
                        </button>
                      </div>
                      {signUpErrors.password && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <Icon name="AlertCircleIcon" size={12} />
                          {signUpErrors.password.message}
                        </p>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-semibold text-[hsl(215,25%,18%)] mb-1.5">
                        Confirm Password
                      </label>
                      {mounted ? (
                        <input
                          id="confirmPassword"
                          type={showSignUpPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          placeholder="Re-enter your password"
                          className={`input-base ${signUpErrors.confirmPassword ? 'border-red-400 focus:ring-red-300 focus:border-red-400' : ''}`}
                          {...registerSignUp('confirmPassword', {
                            required: 'Please confirm your password',
                            validate: (val) => val === watchSignUp('password') || 'Passwords do not match',
                          })}
                        />
                      ) : (
                        <div className="input-base h-10 bg-[hsl(210,20%,97%)]" />
                      )}
                      {signUpErrors.confirmPassword && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <Icon name="AlertCircleIcon" size={12} />
                          {signUpErrors.confirmPassword.message}
                        </p>
                      )}
                    </div>

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="btn-primary w-full justify-center py-2.5 text-sm font-semibold"
                      style={{ minHeight: '42px' }}
                    >
                      {isLoading ? (
                        <>
                          <Icon name="Loader2Icon" size={16} className="animate-spin" />
                          Creating account…
                        </>
                      ) : (
                        <>
                          <Icon name="UserPlusIcon" size={16} />
                          Create Account
                        </>
                      )}
                    </button>
                  </form>

                  <div className="mt-4 p-3 bg-[hsl(210,20%,97%)] rounded-lg border border-[hsl(214,20%,88%)]">
                    <p className="text-xs text-[hsl(215,15%,52%)] leading-relaxed">
                      <strong className="text-[hsl(215,25%,18%)]">Note:</strong> After signing up, check your email to confirm your account before signing in.
                    </p>
                  </div>
                </>
              )}
            </>
          ) : (
            /* Forgot Password */
            <>
              <button
                onClick={() => { setMode('login'); setForgotSent(false); setForgotEmail(''); }}
                className="flex items-center gap-1.5 text-sm text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)] mb-6 transition-colors"
              >
                <Icon name="ArrowLeftIcon" size={14} />
                Back to sign in
              </button>
              <div className="mb-8">
                <div className="w-12 h-12 rounded-xl bg-[#8B1A2B]/10 flex items-center justify-center mb-4">
                  <Icon name="MailIcon" size={22} className="text-[#8B1A2B]" />
                </div>
                <h2 className="text-2xl font-bold text-[hsl(215,25%,18%)]">Reset Password</h2>
                <p className="text-sm text-[hsl(215,15%,52%)] mt-1.5">
                  Enter your email and we will send reset instructions.
                </p>
              </div>
              {forgotSent ? (
                <div className="text-center py-6">
                  <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                    <Icon name="CheckCircleIcon" size={28} className="text-green-600" />
                  </div>
                  <h3 className="text-lg font-bold text-[hsl(215,25%,18%)] mb-2">Check your inbox</h3>
                  <p className="text-sm text-[hsl(215,15%,52%)] leading-relaxed mb-6">
                    We sent a password reset link to <strong className="text-[hsl(215,25%,18%)]">{forgotEmail}</strong>. Click the link in the email to set a new password.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setForgotSent(false); setForgotEmail(''); }}
                    className="btn-primary justify-center py-2.5 text-sm font-semibold"
                  >
                    <Icon name="ArrowLeftIcon" size={16} />
                    Back to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label htmlFor="reset-email" className="block text-sm font-semibold text-[hsl(215,25%,18%)] mb-1.5">
                      Email Address
                    </label>
                    {mounted ? (
                      <input
                        id="reset-email"
                        type="email"
                        placeholder="you@proptrack.hk"
                        className="input-base"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        required
                        autoComplete="email"
                      />
                    ) : (
                      <div className="input-base h-10 bg-[hsl(210,20%,97%)]" />
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="btn-primary w-full justify-center py-2.5 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ minHeight: '42px' }}
                  >
                    {forgotLoading ? (
                      <>
                        <Icon name="Loader2Icon" size={16} className="animate-spin" />
                        Sending…
                      </>
                    ) : (
                      <>
                        <Icon name="SendIcon" size={16} />
                        Send Reset Instructions
                      </>
                    )}
                  </button>
                </form>
              )}
            </>
          )}

          {/* Footer */}
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