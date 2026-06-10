'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';

// ─── Types ────────────────────────────────────────────────────────────────────

type InviteRole = 'agent' | 'manager';

interface InviteForm {
  fullName: string;
  email: string;
  role: InviteRole;
  tempPassword: string;
  personalNote: string;
}

interface InviteRecord {
  id: string;
  fullName: string;
  email: string;
  role: InviteRole;
  sentAt: string;
  status: 'sent' | 'error';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<InviteRole, { label: string; desc: string; color: string; icon: string }> = {
  agent: {
    label: 'Agent',
    desc: 'Can manage enquiries, clients, and viewings',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: 'UserIcon',
  },
  manager: {
    label: 'Manager',
    desc: 'Can manage agents, view all data, and run reports',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: 'BriefcaseIcon',
  },
};

const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';

function generatePassword(length = 12): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return result;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function FormattedTime({ iso }: { iso: string }) {
  const [label, setLabel] = React.useState('');
  React.useEffect(() => {
    const d = new Date(iso);
    setLabel(
      d.toLocaleTimeString('en-HK', { hour: '2-digit', minute: '2-digit' }) +
      ' · '+ d.toLocaleDateString('en-HK', { day: '2-digit', month: 'short' })
    );
  }, [iso]);
  return <>{label}</>;
}

// ─── Password Strength ────────────────────────────────────────────────────────

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ chars', pass: password.length >= 8 },
    { label: 'Uppercase', pass: /[A-Z]/.test(password) },
    { label: 'Number', pass: /[0-9]/.test(password) },
    { label: 'Symbol', pass: /[!@#$%^&*]/.test(password) },
  ];
  const score = checks.filter((c) => c.pass).length;
  const strengthLabel = score <= 1 ? 'Weak' : score === 2 ? 'Fair' : score === 3 ? 'Good' : 'Strong';
  const strengthColor = score <= 1 ? 'bg-red-400' : score === 2 ? 'bg-amber-400' : score === 3 ? 'bg-blue-400' : 'bg-emerald-500';

  if (!password) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i <= score ? strengthColor : 'bg-[hsl(214,20%,88%)]'}`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {checks.map((c) => (
            <span
              key={c.label}
              className={`text-xs flex items-center gap-0.5 ${c.pass ? 'text-emerald-600' : 'text-[hsl(215,15%,65%)]'}`}
            >
              <Icon name={c.pass ? 'CheckIcon' : 'XIcon'} size={10} />
              {c.label}
            </span>
          ))}
        </div>
        <span className={`text-xs font-semibold ${score <= 1 ? 'text-red-500' : score === 2 ? 'text-amber-500' : score === 3 ? 'text-blue-500' : 'text-emerald-600'}`}>
          {strengthLabel}
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InviteTeamClient() {
  const [form, setForm] = useState<InviteForm>({
    fullName: '',
    email: '',
    role: 'agent',
    tempPassword: '',
    personalNote: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [inviteHistory, setInviteHistory] = useState<InviteRecord[]>([]);
  const [copied, setCopied] = useState(false);

  const handleGenerate = useCallback(() => {
    setForm((f) => ({ ...f, tempPassword: generatePassword() }));
    setShowPassword(true);
  }, []);

  const handleCopyPassword = useCallback(() => {
    if (!form.tempPassword) return;
    navigator.clipboard.writeText(form.tempPassword).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [form.tempPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!form.fullName.trim()) { setError('Full name is required.'); return; }
    if (!form.email.trim()) { setError('Email address is required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError('Please enter a valid email address.'); return; }
    if (!form.tempPassword) { setError('A temporary password is required.'); return; }
    if (form.tempPassword.length < 8) { setError('Temporary password must be at least 8 characters.'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          fullName: form.fullName.trim(),
          role: form.role,
          tempPassword: form.tempPassword,
          personalNote: form.personalNote.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send invitation');

      // Add to local history
      setInviteHistory((prev) => [
        {
          id: data.userId,
          fullName: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          role: form.role,
          sentAt: new Date().toISOString(),
          status: 'sent',
        },
        ...prev,
      ]);

      setSuccessMsg(`Invitation sent to ${form.email.trim().toLowerCase()} — they'll receive login credentials by email.`);
      setForm({ fullName: '', email: '', role: 'agent', tempPassword: '', personalNote: '' });
      setShowPassword(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(210,20%,97%)]">
      {/* Page Header */}
      <div className="bg-white border-b border-[hsl(214,20%,88%)] px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#8B1A2B]/10 flex items-center justify-center">
              <Icon name="UserPlusIcon" size={20} className="text-[#8B1A2B]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[hsl(215,25%,18%)]">Invite Team Members</h1>
              <p className="text-sm text-[hsl(215,15%,52%)]">Onboard agents and managers with role assignment</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-[hsl(215,15%,52%)] bg-[hsl(210,15%,94%)] px-3 py-1.5 rounded-full">
            <Icon name="ShieldCheckIcon" size={12} className="text-emerald-500" />
            Credentials sent via email
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ── Invite Form ── */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl border border-[hsl(214,20%,88%)] shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-[hsl(214,20%,88%)] flex items-center gap-2">
                <Icon name="SendIcon" size={15} className="text-[#8B1A2B]" />
                <h2 className="text-sm font-bold text-[hsl(215,25%,18%)]">New Invitation</h2>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {/* Alerts */}
                {error && (
                  <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    <Icon name="AlertCircleIcon" size={15} className="flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
                {successMsg && (
                  <div className="flex items-start gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
                    <Icon name="CheckCircleIcon" size={15} className="flex-shrink-0 mt-0.5" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1.5">
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    placeholder="e.g. Sarah Wong"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[hsl(214,20%,88%)] text-sm text-[hsl(215,25%,18%)] placeholder-[hsl(215,15%,70%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B] transition-colors"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1.5">
                    Email Address <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="agent@homesrus.hk"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[hsl(214,20%,88%)] text-sm text-[hsl(215,25%,18%)] placeholder-[hsl(215,15%,70%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B] transition-colors"
                  />
                </div>

                {/* Role Selection */}
                <div>
                  <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-2">
                    Role <span className="text-red-400">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {(Object.keys(ROLE_CONFIG) as InviteRole[]).map((r) => {
                      const cfg = ROLE_CONFIG[r];
                      const selected = form.role === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, role: r }))}
                          className={`relative flex flex-col items-start gap-1.5 p-4 rounded-xl border-2 text-left transition-all ${
                            selected
                              ? 'border-[#8B1A2B] bg-[#8B1A2B]/5'
                              : 'border-[hsl(214,20%,88%)] bg-white hover:border-[hsl(214,20%,78%)]'
                          }`}
                        >
                          {selected && (
                            <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-[#8B1A2B] flex items-center justify-center">
                              <Icon name="CheckIcon" size={10} className="text-white" />
                            </div>
                          )}
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selected ? 'bg-[#8B1A2B]/10' : 'bg-[hsl(210,15%,94%)]'}`}>
                            <Icon name={cfg.icon as Parameters<typeof Icon>[0]['name']} size={15} className={selected ? 'text-[#8B1A2B]' : 'text-[hsl(215,15%,52%)]'} />
                          </div>
                          <div>
                            <p className={`text-sm font-bold ${selected ? 'text-[#8B1A2B]' : 'text-[hsl(215,25%,18%)]'}`}>{cfg.label}</p>
                            <p className="text-xs text-[hsl(215,15%,52%)] leading-tight mt-0.5">{cfg.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Temporary Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">
                      Temporary Password <span className="text-red-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerate}
                      className="flex items-center gap-1 text-xs font-semibold text-[#8B1A2B] hover:text-[#7a1726] transition-colors"
                    >
                      <Icon name="RefreshCwIcon" size={11} />
                      Auto-generate
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.tempPassword}
                      onChange={(e) => setForm((f) => ({ ...f, tempPassword: e.target.value }))}
                      placeholder="Min. 8 characters"
                      className="w-full px-3.5 py-2.5 pr-20 rounded-xl border border-[hsl(214,20%,88%)] text-sm text-[hsl(215,25%,18%)] placeholder-[hsl(215,15%,70%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B] transition-colors font-mono"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {form.tempPassword && (
                        <button
                          type="button"
                          onClick={handleCopyPassword}
                          className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors"
                          title="Copy password"
                        >
                          <Icon name={copied ? 'CheckIcon' : 'CopyIcon'} size={13} className={copied ? 'text-emerald-500' : 'text-[hsl(215,15%,52%)]'} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors"
                      >
                        <Icon name={showPassword ? 'EyeOffIcon' : 'EyeIcon'} size={13} className="text-[hsl(215,15%,52%)]" />
                      </button>
                    </div>
                  </div>
                  <PasswordStrength password={form.tempPassword} />
                  <p className="text-xs text-[hsl(215,15%,65%)] mt-1.5 flex items-center gap-1">
                    <Icon name="InfoIcon" size={11} />
                    The invitee will receive this password by email and should change it on first login.
                  </p>
                </div>

                {/* Personal Note (optional) */}
                <div>
                  <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1.5">
                    Personal Note <span className="text-[hsl(215,15%,70%)] font-normal normal-case">(optional)</span>
                  </label>
                  <textarea
                    value={form.personalNote}
                    onChange={(e) => setForm((f) => ({ ...f, personalNote: e.target.value }))}
                    placeholder="Add a welcome message included in the invitation email…"
                    rows={3}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[hsl(214,20%,88%)] text-sm text-[hsl(215,25%,18%)] placeholder-[hsl(215,15%,70%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B] transition-colors resize-none"
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#8B1A2B] text-white text-sm font-bold hover:bg-[#7a1726] disabled:opacity-60 transition-colors shadow-sm"
                >
                  {loading ? (
                    <><Icon name="LoaderIcon" size={15} className="animate-spin" /> Sending Invitation…</>
                  ) : (
                    <><Icon name="SendIcon" size={15} /> Send Invitation</>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* ── Right Panel ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Role Permissions Summary */}
            <div className="bg-white rounded-2xl border border-[hsl(214,20%,88%)] shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[hsl(214,20%,88%)] flex items-center gap-2">
                <Icon name="ShieldIcon" size={14} className="text-[hsl(215,15%,52%)]" />
                <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Role Permissions</h3>
              </div>
              <div className="p-5 space-y-4">
                {/* Agent */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                      <Icon name="UserIcon" size={10} /> Agent
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {['View & manage assigned enquiries', 'Add and update clients', 'Schedule viewings', 'Access property listings'].map((p) => (
                      <li key={p} className="flex items-center gap-2 text-xs text-[hsl(215,15%,45%)]">
                        <Icon name="CheckIcon" size={11} className="text-emerald-500 flex-shrink-0" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="border-t border-[hsl(214,20%,92%)]" />
                {/* Manager */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      <Icon name="BriefcaseIcon" size={10} /> Manager
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {['All agent permissions', 'View all enquiries & clients', 'Invite new agents', 'Access agent performance', 'View reports & analytics'].map((p) => (
                      <li key={p} className="flex items-center gap-2 text-xs text-[hsl(215,15%,45%)]">
                        <Icon name="CheckIcon" size={11} className="text-emerald-500 flex-shrink-0" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Invite History */}
            <div className="bg-white rounded-2xl border border-[hsl(214,20%,88%)] shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[hsl(214,20%,88%)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon name="ClockIcon" size={14} className="text-[hsl(215,15%,52%)]" />
                  <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Sent This Session</h3>
                </div>
                {inviteHistory.length > 0 && (
                  <span className="text-xs font-semibold text-[hsl(215,15%,52%)] bg-[hsl(210,15%,94%)] px-2 py-0.5 rounded-full">
                    {inviteHistory.length}
                  </span>
                )}
              </div>
              <div className="p-5">
                {inviteHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <div className="w-10 h-10 rounded-full bg-[hsl(210,15%,94%)] flex items-center justify-center mb-2">
                      <Icon name="InboxIcon" size={18} className="text-[hsl(215,15%,65%)]" />
                    </div>
                    <p className="text-xs text-[hsl(215,15%,65%)]">No invitations sent yet</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {inviteHistory.map((inv) => {
                      const cfg = ROLE_CONFIG[inv.role];
                      return (
                        <li key={inv.id} className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#1B4F8A] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {getInitials(inv.fullName)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-xs font-semibold text-[hsl(215,25%,18%)] truncate">{inv.fullName}</p>
                              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.color}`}>
                                {cfg.label}
                              </span>
                            </div>
                            <p className="text-xs text-[hsl(215,15%,60%)] truncate">{inv.email}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Icon name="CheckCircleIcon" size={10} className="text-emerald-500" />
                              <span className="text-[10px] text-[hsl(215,15%,65%)]"><FormattedTime iso={inv.sentAt} /></span>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* Quick Tip */}
            <div className="flex items-start gap-3 p-4 bg-[#8B1A2B]/5 border border-[#8B1A2B]/15 rounded-xl">
              <Icon name="LightbulbIcon" size={15} className="text-[#8B1A2B] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[hsl(215,25%,30%)] leading-relaxed">
                Invited members will receive an email with their login credentials. They should change their temporary password on first sign-in. You can manage all users in <strong>User Management</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
