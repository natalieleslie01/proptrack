'use client';

import React, { useState, useRef, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import NotificationCenter from '@/components/NotificationCenter';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { ROLE_LABELS } from '@/hooks/useRole';
import { useRouter } from 'next/navigation';

interface TopbarProps {
  sidebarCollapsed: boolean;
  onMobileMenuOpen?: () => void;
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function Topbar({ sidebarCollapsed, onMobileMenuOpen }: TopbarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const { user, signOut } = useAuth();
  const { role } = useRole();
  const router = useRouter();
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = getInitials(displayName);
  const roleLabel = role ? ROLE_LABELS[role] : '';

  // Sidebar widths: expanded = 240px (w-60), collapsed = 64px (w-16)
  const leftOffset = isDesktop === null ? 0 : isDesktop ? (sidebarCollapsed ? 64 : 240) : 0;

  return (
    <header
      className="fixed top-0 right-0 h-16 bg-white border-b border-[hsl(214,20%,88%)] flex items-center justify-between px-4 lg:px-6 z-20 transition-all duration-300"
      style={{ left: leftOffset }}
      suppressHydrationWarning
    >
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenuOpen}
          className="p-2 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors lg:hidden"
          aria-label="Open menu"
        >
          <Icon name="MenuIcon" size={20} className="text-[hsl(215,15%,52%)]" />
        </button>

        <div className="relative hidden sm:block">
          <Icon name="SearchIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(215,15%,52%)]" />
          <input
            type="text"
            placeholder="Search properties, landlords, tenants…"
            className="pl-9 pr-4 py-2 bg-[hsl(210,20%,97%)] border border-[hsl(214,20%,88%)] rounded-lg text-sm w-48 md:w-64 lg:w-72 focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30 focus:border-[#1B4F8A] transition-all"
          />
        </div>

        <button
          onClick={() => setSearchOpen(!searchOpen)}
          className="p-2 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors sm:hidden"
        >
          <Icon name="SearchIcon" size={18} className="text-[hsl(215,15%,52%)]" />
        </button>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1 sm:gap-2">
        <span className="text-xs text-[hsl(215,15%,52%)] font-mono hidden lg:block">
          Updated 16:14 HKT
        </span>

        <NotificationCenter />

        <button className="p-2 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors hidden md:block" title="Print viewing schedule">
          <Icon name="PrinterIcon" size={18} className="text-[hsl(215,15%,52%)]" />
        </button>

        <button className="p-2 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors hidden md:block">
          <Icon name="HelpCircleIcon" size={18} className="text-[hsl(215,15%,52%)]" />
        </button>

        <div className="w-px h-6 bg-[hsl(214,20%,88%)] mx-1 hidden sm:block" />

        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((prev) => !prev)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-[#1B4F8A] flex items-center justify-center text-white text-xs font-bold">
              {initials}
            </div>
            <div className="text-left hidden md:block">
              <p className="text-xs font-semibold text-[hsl(215,25%,18%)]">{displayName}</p>
              <p className="text-[10px] text-[hsl(215,15%,52%)]">{roleLabel}</p>
            </div>
            <Icon name="ChevronDownIcon" size={14} className="text-[hsl(215,15%,52%)] hidden md:block" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-lg border border-[hsl(214,20%,88%)] shadow-lg py-1 z-50">
              <div className="px-3 py-2 border-b border-[hsl(214,20%,88%)]">
                <p className="text-sm font-semibold text-[hsl(215,25%,18%)] truncate">{displayName}</p>
                <p className="text-xs text-[hsl(215,15%,52%)] truncate">{user?.email}</p>
              </div>
              <button
                onClick={async () => {
                  setProfileOpen(false);
                  await signOut();
                  router.push('/sign-up-login');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <Icon name="LogOutIcon" size={16} />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}