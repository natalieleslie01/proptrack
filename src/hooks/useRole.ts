import { useAuth, UserRole } from '@/contexts/AuthContext';

// ─── Permission Matrix ────────────────────────────────────────────────────────
// Defines what each role can access and do

export const ROLE_PERMISSIONS = {
  // Navigation / Screen access
  canAccessAdminScreens: (role: UserRole | null) => role === 'admin',
  canAccessManagerScreens: (role: UserRole | null) => role === 'admin' || role === 'manager',
  canAccessAgentScreens: (role: UserRole | null) => !!role, // all roles

  // User management
  canManageUsers: (role: UserRole | null) => role === 'admin',
  canInviteTeam: (role: UserRole | null) => role === 'admin',
  canViewTeamManagement: (role: UserRole | null) => role === 'admin' || role === 'manager',
  canViewAdminLogs: (role: UserRole | null) => role === 'admin',

  // Financial / Reports
  canViewCommission: (role: UserRole | null) => role === 'admin' || role === 'manager',
  canEditCommission: (role: UserRole | null) => role === 'admin' || role === 'manager',
  canViewReports: (role: UserRole | null) => role === 'admin' || role === 'manager',
  canViewAgentMetrics: (role: UserRole | null) => role === 'admin' || role === 'manager',

  // Property management
  canAddProperty: (role: UserRole | null) => role === 'admin' || role === 'manager',
  canEditProperty: (role: UserRole | null) => role === 'admin' || role === 'manager',
  canDeleteProperty: (role: UserRole | null) => role === 'admin',
  canViewAllProperties: (role: UserRole | null) => !!role,

  // Enquiries
  canAssignEnquiries: (role: UserRole | null) => role === 'admin' || role === 'manager',
  canViewAllEnquiries: (role: UserRole | null) => role === 'admin' || role === 'manager',
  canViewOwnEnquiries: (role: UserRole | null) => !!role,

  // Tenancies
  canManageTenancies: (role: UserRole | null) => role === 'admin' || role === 'manager',
  canViewTenancies: (role: UserRole | null) => !!role,

  // Maintenance
  canManageMaintenance: (role: UserRole | null) => role === 'admin' || role === 'manager',
  canViewMaintenance: (role: UserRole | null) => !!role,

  // Lease renewals
  canManageLeaseRenewals: (role: UserRole | null) => role === 'admin' || role === 'manager',
  canViewLeaseRenewals: (role: UserRole | null) => !!role,

  // Clients
  canAddClient: (role: UserRole | null) => !!role,
  canEditClient: (role: UserRole | null) => role === 'admin' || role === 'manager',
  canDeleteClient: (role: UserRole | null) => role === 'admin',

  // Viewings
  canScheduleViewings: (role: UserRole | null) => !!role,
  canEditViewings: (role: UserRole | null) => role === 'admin' || role === 'manager',
} as const;

// ─── Role Labels & Colors ─────────────────────────────────────────────────────

export const ROLE_LABELS: Record<UserRole, string> = {
  agent: 'Agent',
  manager: 'Manager',
  admin: 'Admin',
};

export const ROLE_BADGE_COLORS: Record<UserRole, string> = {
  agent: 'bg-blue-50 text-blue-700 border border-blue-200',
  manager: 'bg-amber-50 text-amber-700 border border-amber-200',
  admin: 'bg-[#8B1A2B]/10 text-[#8B1A2B] border border-[#8B1A2B]/20',
};

// ─── useRole Hook ─────────────────────────────────────────────────────────────

export function useRole() {
  const { role, user, loading, profileLoading } = useAuth();

  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const isAgent = role === 'agent';
  const isAdminOrManager = role === 'admin' || role === 'manager';

  const can = (permission: keyof typeof ROLE_PERMISSIONS): boolean => {
    const fn = ROLE_PERMISSIONS[permission] as (r: UserRole | null) => boolean;
    return fn(role);
  };

  return {
    role,
    isAdmin,
    isManager,
    isAgent,
    isAdminOrManager,
    can,
    loading: loading || profileLoading,
  };
}
