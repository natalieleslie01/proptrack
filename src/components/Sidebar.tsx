'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { ROLE_LABELS } from '@/hooks/useRole';
import type { UserRole } from '@/contexts/AuthContext';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  href: string;
  badge?: number;
  group: string;
  /** Minimum role required: 'agent' = all, 'manager' = manager+admin, 'admin' = admin only */
  minRole?: UserRole;
}

const navItems: NavItem[] = [
  { id: 'nav-dashboard', label: 'Dashboard', icon: 'Squares2X2Icon', href: '/dashboard', group: 'main' },
  { id: 'nav-alerts', label: 'Action Alerts', icon: 'BellAlertIcon', href: '/dashboard', badge: 27, group: 'main' },
  { id: 'nav-properties', label: 'Properties', icon: 'BuildingOffice2Icon', href: '/property-management', badge: 3, group: 'main' },
  { id: 'nav-clients', label: 'Clients', icon: 'UsersIcon', href: '/clients', group: 'main' },
  { id: 'nav-matching', label: 'Property Matching', icon: 'MagnifyingGlassIcon', href: '/property-matching', group: 'main' },
  { id: 'nav-enquiries', label: 'Enquiries', icon: 'InboxIcon', href: '/enquiries', group: 'main' },
  { id: 'nav-tenants', label: 'Tenants', icon: 'UserGroupIcon', href: '/tenants', group: 'main' },
  { id: 'nav-tenancies', label: 'Tenancies', icon: 'KeyIcon', href: '/active-tenancies', badge: 7, group: 'main' },
  { id: 'nav-tenancy-records', label: 'Tenancy Records', icon: 'ClipboardDocumentListIcon', href: '/tenancy-records', group: 'main' },
  { id: 'nav-key-inventory', label: 'Key Inventory', icon: 'LockClosedIcon', href: '/key-inventory', group: 'main' },
  { id: 'nav-renewals', label: 'Lease Renewals', icon: 'ArrowPathIcon', href: '/lease-renewals', badge: 6, group: 'main' },
  { id: 'nav-handover', label: 'Tenancy Handover', icon: 'ArrowRightOnRectangleIcon', href: '/tenancy-handover', group: 'main' },
  { id: 'nav-archive', label: 'Archived Tenancies', icon: 'ArchiveBoxIcon', href: '/archived-tenancies', group: 'main' },
  { id: 'nav-sales-workflow', label: 'Sales Workflow', icon: 'HomeIcon', href: '/sales-workflow', group: 'main' },
  { id: 'nav-maintenance', label: 'Maintenance', icon: 'WrenchScrewdriverIcon', href: '/maintenance', badge: 3, group: 'main' },
  { id: 'nav-viewings', label: 'Viewings', icon: 'EyeIcon', href: '/agent-viewings', badge: 4, group: 'main' },
  { id: 'nav-calendar', label: 'Calendar', icon: 'CalendarDaysIcon', href: '/calendar', group: 'main' },
  { id: 'nav-contacts', label: 'Contacts', icon: 'IdentificationIcon', href: '/contacts', group: 'main' },
  { id: 'nav-landlords', label: 'Landlords', icon: 'UserIcon', href: '/landlords', group: 'main' },
  { id: 'nav-transactions', label: 'Transactions', icon: 'ArrowsRightLeftIcon', href: '/transactions', group: 'main' },
  { id: 'nav-forms', label: 'HK Forms', icon: 'DocumentTextIcon', href: '/property-management', badge: 5, group: 'compliance' },
  { id: 'nav-commission', label: 'Commission', icon: 'BanknotesIcon', href: '/commission', group: 'compliance', minRole: 'manager' },
  { id: 'nav-reports', label: 'Reports', icon: 'ChartBarIcon', href: '/reports', group: 'compliance', minRole: 'manager' },
  { id: 'nav-data-import', label: 'Data Import / Export', icon: 'ArrowsUpDownIcon', href: '/data-import-export', group: 'compliance' },
  { id: 'nav-csv-upload', label: 'CSV Upload', icon: 'CloudArrowUpIcon', href: '/csv-upload', group: 'compliance' },
  { id: 'nav-property-field-import', label: 'Property Field Import', icon: 'CircleStackIcon', href: '/property-field-import', group: 'compliance' },
  { id: 'nav-csv-diff', label: 'CSV Row Diff', icon: 'DocumentMagnifyingGlassIcon', href: '/csv-diff', group: 'compliance' },
  { id: 'nav-import-batches', label: 'Import Batches', icon: 'RectangleStackIcon', href: '/import-batches', group: 'compliance', minRole: 'manager' },
  { id: 'nav-import-history', label: 'Import History', icon: 'ClockIcon', href: '/import-history', group: 'compliance', minRole: 'manager' },
  { id: 'nav-import-verification', label: 'Import Verification', icon: 'ShieldCheckIcon', href: '/import-verification', group: 'compliance', minRole: 'manager' },
  { id: 'nav-bulk-data-editor', label: 'Bulk Data Editor', icon: 'TableCellsIcon', href: '/bulk-data-editor', group: 'compliance', minRole: 'manager' },
  { id: 'nav-building-codes', label: 'Building Code Mapper', icon: 'BuildingOfficeIcon', href: '/building-codes', group: 'compliance', minRole: 'manager' },
  { id: 'nav-data-validation', label: 'Data Validation', icon: 'ShieldCheckIcon', href: '/data-validation', group: 'compliance', minRole: 'manager' },
  { id: 'nav-import-quality', label: 'Import Quality', icon: 'ClipboardDocumentCheckIcon', href: '/import-quality', group: 'compliance', minRole: 'manager' },
  { id: 'nav-failed-rows', label: 'Failed Import Rows', icon: 'ExclamationCircleIcon', href: '/failed-rows', group: 'compliance', minRole: 'manager' },
  { id: 'nav-flagged-row-review', label: 'Flagged Row Review', icon: 'FlagIcon', href: '/flagged-row-review', group: 'compliance', minRole: 'manager' },
  { id: 'nav-batch-export-fix', label: 'Batch Export & Fix', icon: 'DocumentArrowDownIcon', href: '/batch-export-fix', group: 'compliance', minRole: 'manager' },
  { id: 'nav-workflow-summary', label: 'Workflow Summary', icon: 'DocumentCheckIcon', href: '/workflow-summary', group: 'compliance', minRole: 'manager' },
  { id: 'nav-admin-panel', label: 'Admin Panel', icon: 'ShieldCheckIcon', href: '/admin-panel', group: 'admin', minRole: 'admin' },
  { id: 'nav-users', label: 'User Management', icon: 'UsersIcon', href: '/user-management', group: 'admin', minRole: 'admin' },
  { id: 'nav-invite', label: 'Invite Team', icon: 'UserPlusIcon', href: '/invite-team', group: 'admin', minRole: 'admin' },
  { id: 'nav-team', label: 'Team Management', icon: 'ShieldCheckIcon', href: '/team-management', group: 'admin', minRole: 'manager' },
  { id: 'nav-admin-logs', label: 'Admin Logs', icon: 'ShieldCheckIcon', href: '/admin-logs', group: 'admin', minRole: 'admin' },
  { id: 'nav-debug-env', label: 'Debug: Env & Supabase', icon: 'BugAntIcon', href: '/debug-env', group: 'admin', minRole: 'admin' },
  { id: 'nav-pipeline-test', label: 'Pipeline Test', icon: 'BeakerIcon', href: '/pipeline-test', group: 'admin', minRole: 'admin' },
  { id: 'nav-activity-log', label: 'Activity Log', icon: 'ListBulletIcon', href: '/activity-log', group: 'admin', minRole: 'manager' },
  { id: 'nav-settings', label: 'Settings', icon: 'Cog6ToothIcon', href: '/dashboard', group: 'admin', minRole: 'manager' },
  { id: 'nav-agent-metrics', label: 'Agent Performance', icon: 'ChartBarIcon', href: '/agent-metrics', group: 'admin', minRole: 'manager' },
];

const groups = [
  { id: 'main', label: 'Portfolio' },
  { id: 'compliance', label: 'Compliance & Reports' },
  { id: 'admin', label: 'Administration' },
];

const ACTIVE_ROUTES: Record<string, string> = {
  'nav-dashboard': '/dashboard',
  'nav-properties': '/property-management',
  'nav-clients': '/clients',
  'nav-matching': '/property-matching',
  'nav-enquiries': '/enquiries',
  'nav-agent-metrics': '/agent-metrics',
  'nav-admin-panel': '/admin-panel',
  'nav-users': '/user-management',
  'nav-invite': '/invite-team',
  'nav-team': '/team-management',
  'nav-admin-logs': '/admin-logs',
  'nav-activity-log': '/activity-log',
  'nav-viewings': '/agent-viewings',
  'nav-tenants': '/tenants',
  'nav-tenancies': '/active-tenancies',
  'nav-tenancy-records': '/tenancy-records',
  'nav-key-inventory': '/key-inventory',
  'nav-handover': '/tenancy-handover',
  'nav-archive': '/archived-tenancies',
  'nav-renewals': '/lease-renewals',
  'nav-maintenance': '/maintenance',
  'nav-calendar': '/calendar',
  'nav-commission': '/commission',
  'nav-reports': '/reports',
  'nav-data-import': '/data-import-export',
  'nav-csv-upload': '/csv-upload',
'nav-property-field-import': '/property-field-import',
  'nav-csv-diff': '/csv-diff',
  'nav-import-batches': '/import-batches',
  'nav-import-history': '/import-history',
  'nav-import-verification': '/import-verification',
  'nav-bulk-data-editor': '/bulk-data-editor',
  'nav-building-codes': '/building-codes',
  'nav-data-validation': '/data-validation',
  'nav-import-quality': '/import-quality',
  'nav-failed-rows': '/failed-rows',
  'nav-flagged-row-review': '/flagged-row-review',
  'nav-batch-export-fix': '/batch-export-fix',
  'nav-sales-workflow': '/sales-workflow',
  'nav-workflow-summary': '/workflow-summary',
  'nav-landlords': '/landlords',
  'nav-contacts': '/contacts',
  'nav-transactions': '/transactions',
};

function roleAllowed(itemMinRole: UserRole | undefined, userRole: UserRole | null): boolean {
  if (!itemMinRole) return true; // no restriction
  if (!userRole) return false;
  const hierarchy: Record<UserRole, number> = { agent: 1, manager: 2, admin: 3 };
  return hierarchy[userRole] >= hierarchy[itemMinRole];
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { role } = useRole();

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = getInitials(displayName);
  const roleLabel = role ? ROLE_LABELS[role] : '';

  const filteredGroups = groups.map((group) => ({
    ...group,
    items: navItems.filter((n) => n.group === group.id && roleAllowed(n.minRole, role)),
  })).filter((g) => g.items.length > 0);

  const sidebarContent = (
    <aside
      className={`h-full bg-white border-r border-[hsl(214,20%,88%)] flex flex-col transition-all duration-300 ease-in-out ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center h-16 border-b border-[hsl(214,20%,88%)] px-3 flex-shrink-0 ${collapsed ? 'justify-center' : 'gap-2.5'}`}>
        <AppLogo size={32} />
        {!collapsed && (
          <span className="font-bold text-[#8B1A2B] text-base tracking-tight whitespace-nowrap">
            PropTrack<span className="text-[#2C2C2C]"> HK</span>
          </span>
        )}
        {onMobileClose && !collapsed && (
          <button onClick={onMobileClose} className="ml-auto p-1 rounded-lg hover:bg-[hsl(210,15%,94%)] lg:hidden">
            <Icon name="XIcon" size={16} className="text-[hsl(215,15%,52%)]" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-4 px-2">
        {filteredGroups.map((group) => (
          <div key={`group-${group.id}`} className="mb-4">
            {!collapsed && (
              <p className="section-label px-3 mb-1.5">{group.label}</p>
            )}
            {group.items.map((item) => {
              const active = ACTIVE_ROUTES[item.id] === pathname;
              return (
                <Link key={item.id} href={item.href} onClick={onMobileClose}>
                  <div
                    className={`sidebar-nav-item ${
                      active ? 'sidebar-nav-item-active' : 'sidebar-nav-item-inactive'
                    } ${collapsed ? 'justify-center px-0' : ''}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon
                      name={item.icon as Parameters<typeof Icon>[0]['name']}
                      size={18}
                      className={active ? 'text-[#8B1A2B]' : ''}
                    />
                    {!collapsed && (
                      <span className="flex-1 truncate">{item.label}</span>
                    )}
                    {!collapsed && item.badge && (
                      <span className="ml-auto bg-[#8B1A2B]/10 text-[#8B1A2B] text-xs font-semibold px-1.5 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User + collapse */}
      <div className="border-t border-[hsl(214,20%,88%)] p-2 flex-shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[hsl(210,15%,94%)] cursor-pointer transition-colors mb-1">
            <div className="w-8 h-8 rounded-full bg-[#8B1A2B] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[hsl(215,25%,18%)] truncate">{displayName}</p>
              <p className="text-xs text-[hsl(215,15%,52%)] truncate">{roleLabel}</p>
            </div>
            <Icon name="ChevronUpIcon" size={14} className="text-[hsl(215,15%,52%)]" />
          </div>
        )}
        <button
          onClick={onToggle}
          className="w-full hidden lg:flex items-center justify-center p-2 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Icon name={collapsed ? 'ChevronRightIcon' : 'ChevronLeftIcon'} size={16} className="text-[hsl(215,15%,52%)]" />
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block fixed left-0 top-0 h-full z-30">
        {sidebarContent}
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/50" onClick={onMobileClose} />
          <div className="relative z-50 h-full">
            <aside className="h-full bg-white border-r border-[hsl(214,20%,88%)] flex flex-col w-64">
              {/* Logo */}
              <div className="flex items-center h-16 border-b border-[hsl(214,20%,88%)] px-3 gap-2.5 flex-shrink-0">
                <AppLogo size={32} />
                <span className="font-bold text-[#8B1A2B] text-base tracking-tight whitespace-nowrap">
                  PropTrack<span className="text-[#2C2C2C]"> HK</span>
                </span>
                <button onClick={onMobileClose} className="ml-auto p-1 rounded-lg hover:bg-[hsl(210,15%,94%)]">
                  <Icon name="XIcon" size={16} className="text-[hsl(215,15%,52%)]" />
                </button>
              </div>
              {/* Nav */}
              <nav className="flex-1 overflow-y-auto py-4 px-2">
                {filteredGroups.map((group) => (
                  <div key={`mob-group-${group.id}`} className="mb-4">
                    <p className="section-label px-3 mb-1.5">{group.label}</p>
                    {group.items.map((item) => {
                      const active = ACTIVE_ROUTES[item.id] === pathname;
                      return (
                        <Link key={item.id} href={item.href} onClick={onMobileClose}>
                          <div className={`sidebar-nav-item ${active ? 'sidebar-nav-item-active' : 'sidebar-nav-item-inactive'}`}>
                            <Icon name={item.icon as Parameters<typeof Icon>[0]['name']} size={18} className={active ? 'text-[#8B1A2B]' : ''} />
                            <span className="flex-1 truncate">{item.label}</span>
                            {item.badge && (
                              <span className="ml-auto bg-[#8B1A2B]/10 text-[#8B1A2B] text-xs font-semibold px-1.5 py-0.5 rounded-full">{item.badge}</span>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </nav>
              <div className="border-t border-[hsl(214,20%,88%)] p-2 flex-shrink-0">
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[hsl(210,15%,94%)] cursor-pointer transition-colors">
                  <div className="w-8 h-8 rounded-full bg-[#8B1A2B] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{initials}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[hsl(215,25%,18%)] truncate">{displayName}</p>
                    <p className="text-xs text-[hsl(215,15%,52%)] truncate">{roleLabel}</p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}
    </>
  );
}