'use client';

import React from 'react';
import { useRole } from '@/hooks/useRole';
import { ROLE_PERMISSIONS } from '@/hooks/useRole';
import Icon from '@/components/ui/AppIcon';

interface RoleGuardProps {
  /** Permission key from ROLE_PERMISSIONS */
  permission?: keyof typeof ROLE_PERMISSIONS;
  /** Or pass a direct boolean condition */
  allowed?: boolean;
  /** What to render when access is denied — defaults to AccessDenied banner */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function AccessDeniedBanner() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-16 h-16 rounded-2xl bg-[#8B1A2B]/10 flex items-center justify-center">
        <Icon name="ShieldOffIcon" size={32} className="text-[#8B1A2B]" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-bold text-[hsl(215,25%,18%)]">Access Restricted</h2>
        <p className="text-sm text-[hsl(215,15%,52%)] mt-1 max-w-sm">
          You don&apos;t have permission to view this page. Contact your administrator if you believe this is an error.
        </p>
      </div>
    </div>
  );
}

export default function RoleGuard({ permission, allowed, fallback, children }: RoleGuardProps) {
  const { can, loading } = useRole();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Icon name="LoaderIcon" size={24} className="animate-spin text-[hsl(215,15%,52%)]" />
      </div>
    );
  }

  const hasAccess = allowed !== undefined ? allowed : (permission ? can(permission) : true);

  if (!hasAccess) {
    return <>{fallback ?? <AccessDeniedBanner />}</>;
  }

  return <>{children}</>;
}
