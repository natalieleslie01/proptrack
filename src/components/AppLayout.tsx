'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Only apply padding after hydration to avoid server/client mismatch
  const mainPaddingLeft = isDesktop === null ? 0 : isDesktop ? (collapsed ? 64 : 240) : 0;

  return (
    <div className="min-h-screen bg-[hsl(210,20%,97%)]">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <Topbar
        sidebarCollapsed={collapsed}
        onMobileMenuOpen={() => setMobileOpen(true)}
      />
      <main
        className="transition-all duration-300 pt-16 min-h-screen"
        style={{ paddingLeft: mainPaddingLeft }}
        suppressHydrationWarning
      >
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-4 sm:py-6">
          {children}
        </div>
      </main>
    </div>
  );
}