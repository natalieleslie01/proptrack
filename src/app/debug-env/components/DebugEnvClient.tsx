'use client';

import React, { useEffect, useState } from 'react';
import RoleGuard from '@/components/RoleGuard';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

interface EnvVar {
  key: string;
  label: string;
  value: string | undefined;
  isPublic: boolean;
  required: boolean;
  hint?: string;
}

interface SupabaseStatus {
  connected: boolean;
  latencyMs: number | null;
  error: string | null;
  authReachable: boolean;
  authError: string | null;
  urlValid: boolean;
  keyPresent: boolean;
}

function getStatus(value: string | undefined): 'ok' | 'placeholder' | 'missing' {
  if (!value || value.trim() === '') return 'missing';
  const placeholders = [
    'your-', 'placeholder', 'xxx', 'changeme', 'your_', 'sk-test_', 'pk-test_',
  ];
  if (placeholders.some((p) => value.toLowerCase().startsWith(p))) return 'placeholder';
  return 'ok';
}

function StatusPill({ status }: { status: 'ok' | 'placeholder' | 'missing' }) {
  if (status === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        <Icon name="CheckCircleIcon" size={12} />
        Set
      </span>
    );
  }
  if (status === 'placeholder') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
        <Icon name="AlertTriangleIcon" size={12} />
        Placeholder
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
      <Icon name="XCircleIcon" size={12} />
      Missing
    </span>
  );
}

function maskValue(value: string | undefined): string {
  if (!value || value.trim() === '') return '—';
  if (value.length <= 8) return '••••••••';
  return value.slice(0, 6) + '••••••••' + value.slice(-4);
}

export default function DebugEnvClient() {
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const envVars: EnvVar[] = [
    {
      key: 'NEXT_PUBLIC_SUPABASE_URL',
      label: 'Supabase URL',
      value: process.env.NEXT_PUBLIC_SUPABASE_URL,
      isPublic: true,
      required: true,
      hint: 'Must start with https:// and end with .supabase.co',
    },
    {
      key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      label: 'Supabase Anon Key',
      value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      isPublic: true,
      required: true,
      hint: 'JWT token starting with eyJ',
    },
    {
      key: 'NEXT_PUBLIC_SITE_URL',
      label: 'Site URL',
      value: process.env.NEXT_PUBLIC_SITE_URL,
      isPublic: true,
      required: true,
      hint: 'Used for OAuth redirects and email links',
    },
    {
      key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
      label: 'Stripe Publishable Key',
      value: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      isPublic: true,
      required: false,
      hint: 'Starts with pk_live_ or pk_test_',
    },
    {
      key: 'NEXT_PUBLIC_GA_MEASUREMENT_ID',
      label: 'Google Analytics ID',
      value: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
      isPublic: true,
      required: false,
      hint: 'Format: G-XXXXXXXXXX',
    },
    {
      key: 'NEXT_PUBLIC_ADSENSE_ID',
      label: 'AdSense ID',
      value: process.env.NEXT_PUBLIC_ADSENSE_ID,
      isPublic: true,
      required: false,
      hint: 'Format: ca-pub-XXXXXXXXXX',
    },
    {
      key: 'OPENAI_API_KEY',
      label: 'OpenAI API Key',
      value: process.env.OPENAI_API_KEY,
      isPublic: false,
      required: false,
      hint: 'Server-side only — not visible in browser',
    },
    {
      key: 'GEMINI_API_KEY',
      label: 'Gemini API Key',
      value: process.env.GEMINI_API_KEY,
      isPublic: false,
      required: false,
      hint: 'Server-side only — not visible in browser',
    },
    {
      key: 'ANTHROPIC_API_KEY',
      label: 'Anthropic API Key',
      value: process.env.ANTHROPIC_API_KEY,
      isPublic: false,
      required: false,
      hint: 'Server-side only — not visible in browser',
    },
    {
      key: 'PERPLEXITY_API_KEY',
      label: 'Perplexity API Key',
      value: process.env.PERPLEXITY_API_KEY,
      isPublic: false,
      required: false,
      hint: 'Server-side only — not visible in browser',
    },
    {
      key: 'RESEND_API_KEY',
      label: 'Resend API Key',
      value: process.env.RESEND_API_KEY,
      isPublic: false,
      required: false,
      hint: 'Server-side only — not visible in browser',
    },
  ];

  const checkSupabase = async () => {
    setChecking(true);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\s+/g, '').replace(/\/+$/, '') || '';
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.replace(/\s+/g, '') || '';

    const urlValid = !!url && url.startsWith('https://') && url.includes('.supabase.co');
    const keyPresent = !!key && key.startsWith('eyJ');

    if (!urlValid || !keyPresent) {
      setSupabaseStatus({
        connected: false,
        latencyMs: null,
        error: !urlValid ? 'Supabase URL is missing or malformed' : 'Anon key is missing or malformed',
        authReachable: false,
        authError: null,
        urlValid,
        keyPresent,
      });
      setChecking(false);
      setCheckedAt(new Date().toISOString());
      return;
    }

    try {
      const supabase = createClient();
      const start = performance.now();
      const { error } = await supabase.from('user_profiles').select('id').limit(1);
      const latencyMs = Math.round(performance.now() - start);

      let authReachable = false;
      let authError: string | null = null;
      try {
        const { error: authErr } = await supabase.auth.getSession();
        authReachable = !authErr;
        authError = authErr?.message ?? null;
      } catch (e: any) {
        authError = e?.message ?? 'Auth check failed';
      }

      setSupabaseStatus({
        connected: !error,
        latencyMs,
        error: error?.message ?? null,
        authReachable,
        authError,
        urlValid,
        keyPresent,
      });
    } catch (e: any) {
      setSupabaseStatus({
        connected: false,
        latencyMs: null,
        error: e?.message ?? 'Unknown error',
        authReachable: false,
        authError: null,
        urlValid,
        keyPresent,
      });
    }

    setChecking(false);
    setCheckedAt(new Date().toISOString());
  };

  useEffect(() => {
    checkSupabase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const missingRequired = envVars.filter((v) => v.required && getStatus(v.value) !== 'ok');
  const placeholderVars = envVars.filter((v) => getStatus(v.value) === 'placeholder');

  return (
    <RoleGuard permission="canAccessAdminScreens">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-[#8B1A2B]/10 flex items-center justify-center">
                <Icon name="BugIcon" size={16} className="text-[#8B1A2B]" />
              </div>
              <h1 className="text-xl font-bold text-[hsl(215,25%,18%)]">Environment Debug</h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#8B1A2B]/10 text-[#8B1A2B] border border-[#8B1A2B]/20">
                Admin Only
              </span>
            </div>
            <p className="text-sm text-[hsl(215,15%,52%)]">
              Inspect environment variable status and Supabase connection health. Values are masked for security.
            </p>
          </div>
        </div>

        {/* Alert banner for issues */}
        {(missingRequired.length > 0 || placeholderVars.length > 0) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
            <Icon name="AlertTriangleIcon" size={18} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Configuration issues detected</p>
              <ul className="mt-1 space-y-0.5">
                {missingRequired.map((v) => (
                  <li key={v.key} className="text-xs text-amber-700">
                    • <strong>{v.key}</strong> is required but missing
                  </li>
                ))}
                {placeholderVars.map((v) => (
                  <li key={v.key} className="text-xs text-amber-700">
                    • <strong>{v.key}</strong> still has a placeholder value
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Supabase Connection Status */}
        <div className="rounded-xl border border-[hsl(215,25%,88%)] bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-[hsl(215,25%,92%)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="DatabaseIcon" size={16} className="text-[hsl(215,25%,40%)]" />
              <h2 className="text-sm font-semibold text-[hsl(215,25%,18%)]">Supabase Connection</h2>
            </div>
            <button
              onClick={checkSupabase}
              disabled={checking}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[hsl(215,25%,96%)] hover:bg-[hsl(215,25%,92%)] text-[hsl(215,25%,30%)] border border-[hsl(215,25%,88%)] transition-colors disabled:opacity-50"
            >
              <Icon name={checking ? 'LoaderIcon' : 'RefreshCwIcon'} size={12} className={checking ? 'animate-spin' : ''} />
              {checking ? 'Checking…' : 'Re-check'}
            </button>
          </div>

          <div className="p-5">
            {!supabaseStatus && checking ? (
              <div className="flex items-center gap-2 text-sm text-[hsl(215,15%,52%)]">
                <Icon name="LoaderIcon" size={16} className="animate-spin" />
                Running connection check…
              </div>
            ) : supabaseStatus ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* URL Valid */}
                <div className="rounded-lg border border-[hsl(215,25%,92%)] p-3 space-y-1">
                  <p className="text-xs text-[hsl(215,15%,52%)] font-medium">URL Format</p>
                  <div className="flex items-center gap-1.5">
                    <Icon
                      name={supabaseStatus.urlValid ? 'CheckCircleIcon' : 'XCircleIcon'}
                      size={16}
                      className={supabaseStatus.urlValid ? 'text-emerald-500' : 'text-red-500'}
                    />
                    <span className={`text-sm font-semibold ${supabaseStatus.urlValid ? 'text-emerald-700' : 'text-red-700'}`}>
                      {supabaseStatus.urlValid ? 'Valid' : 'Invalid'}
                    </span>
                  </div>
                </div>

                {/* Key Present */}
                <div className="rounded-lg border border-[hsl(215,25%,92%)] p-3 space-y-1">
                  <p className="text-xs text-[hsl(215,15%,52%)] font-medium">Anon Key</p>
                  <div className="flex items-center gap-1.5">
                    <Icon
                      name={supabaseStatus.keyPresent ? 'CheckCircleIcon' : 'XCircleIcon'}
                      size={16}
                      className={supabaseStatus.keyPresent ? 'text-emerald-500' : 'text-red-500'}
                    />
                    <span className={`text-sm font-semibold ${supabaseStatus.keyPresent ? 'text-emerald-700' : 'text-red-700'}`}>
                      {supabaseStatus.keyPresent ? 'Present' : 'Missing'}
                    </span>
                  </div>
                </div>

                {/* DB Connection */}
                <div className="rounded-lg border border-[hsl(215,25%,92%)] p-3 space-y-1">
                  <p className="text-xs text-[hsl(215,15%,52%)] font-medium">DB Query</p>
                  <div className="flex items-center gap-1.5">
                    <Icon
                      name={supabaseStatus.connected ? 'CheckCircleIcon' : 'XCircleIcon'}
                      size={16}
                      className={supabaseStatus.connected ? 'text-emerald-500' : 'text-red-500'}
                    />
                    <span className={`text-sm font-semibold ${supabaseStatus.connected ? 'text-emerald-700' : 'text-red-700'}`}>
                      {supabaseStatus.connected
                        ? `OK ${supabaseStatus.latencyMs !== null ? `(${supabaseStatus.latencyMs}ms)` : ''}`
                        : 'Failed'}
                    </span>
                  </div>
                  {supabaseStatus.error && (
                    <p className="text-xs text-red-600 mt-1 break-all">{supabaseStatus.error}</p>
                  )}
                </div>

                {/* Auth */}
                <div className="rounded-lg border border-[hsl(215,25%,92%)] p-3 space-y-1">
                  <p className="text-xs text-[hsl(215,15%,52%)] font-medium">Auth Service</p>
                  <div className="flex items-center gap-1.5">
                    <Icon
                      name={supabaseStatus.authReachable ? 'CheckCircleIcon' : 'XCircleIcon'}
                      size={16}
                      className={supabaseStatus.authReachable ? 'text-emerald-500' : 'text-red-500'}
                    />
                    <span className={`text-sm font-semibold ${supabaseStatus.authReachable ? 'text-emerald-700' : 'text-red-700'}`}>
                      {supabaseStatus.authReachable ? 'Reachable' : 'Unreachable'}
                    </span>
                  </div>
                  {supabaseStatus.authError && (
                    <p className="text-xs text-red-600 mt-1 break-all">{supabaseStatus.authError}</p>
                  )}
                </div>
              </div>
            ) : null}

            {checkedAt && (
              <p className="text-xs text-[hsl(215,15%,65%)] mt-3">
                Last checked: {checkedAt}
              </p>
            )}
          </div>
        </div>

        {/* Environment Variables Table */}
        <div className="rounded-xl border border-[hsl(215,25%,88%)] bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-[hsl(215,25%,92%)] flex items-center gap-2">
            <Icon name="KeyIcon" size={16} className="text-[hsl(215,25%,40%)]" />
            <h2 className="text-sm font-semibold text-[hsl(215,25%,18%)]">Environment Variables</h2>
            <span className="ml-auto text-xs text-[hsl(215,15%,52%)]">Values are masked for security</span>
          </div>

          <div className="divide-y divide-[hsl(215,25%,94%)]">
            {/* Public vars */}
            <div className="px-5 py-2 bg-[hsl(215,25%,97%)]">
              <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">
                Public (NEXT_PUBLIC_*)
              </p>
            </div>
            {envVars.filter((v) => v.isPublic).map((v) => {
              const status = getStatus(v.value);
              return (
                <div key={v.key} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-xs font-mono text-[hsl(215,25%,25%)] bg-[hsl(215,25%,96%)] px-1.5 py-0.5 rounded">
                        {v.key}
                      </code>
                      {v.required && (
                        <span className="text-xs text-[hsl(215,15%,52%)]">Required</span>
                      )}
                    </div>
                    {v.hint && (
                      <p className="text-xs text-[hsl(215,15%,60%)] mt-0.5">{v.hint}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <code className="text-xs font-mono text-[hsl(215,25%,45%)]">
                      {status === 'ok' ? maskValue(v.value) : (v.value || '—')}
                    </code>
                    <StatusPill status={status} />
                  </div>
                </div>
              );
            })}

            {/* Server-side vars */}
            <div className="px-5 py-2 bg-[hsl(215,25%,97%)]">
              <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">
                Server-side (not exposed to browser)
              </p>
            </div>
            {envVars.filter((v) => !v.isPublic).map((v) => {
              const status = getStatus(v.value);
              return (
                <div key={v.key} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-xs font-mono text-[hsl(215,25%,25%)] bg-[hsl(215,25%,96%)] px-1.5 py-0.5 rounded">
                        {v.key}
                      </code>
                    </div>
                    {v.hint && (
                      <p className="text-xs text-[hsl(215,15%,60%)] mt-0.5">{v.hint}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <code className="text-xs font-mono text-[hsl(215,25%,45%)]">
                      {status === 'ok' ? '(server-side — masked)' : (v.value || '—')}
                    </code>
                    <StatusPill status={status} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Note */}
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 flex gap-3">
          <Icon name="InfoIcon" size={16} className="text-blue-500 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700">
            Server-side variables (without <code className="font-mono">NEXT_PUBLIC_</code> prefix) are not accessible in the browser.
            Their status shown here reflects whether a value was detected at build time via Next.js static analysis.
            To verify server-side keys, check your hosting platform&apos;s environment variable dashboard.
          </p>
        </div>
      </div>
    </RoleGuard>
  );
}
