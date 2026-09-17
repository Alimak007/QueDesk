import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Plane,
  ReceiptText,
  Settings2,
  ShieldCheck,
  Users,
  UsersRound,
} from 'lucide-react';
import { canAccessModule } from '@/lib/permissions';

/**
 * The QueDesk navigation (brief §32). Companies is deliberately absent: the
 * module lives on inside Settings and powers invoices and payslips.
 *
 * `visible(user)` decides whether an item shows; groups hide when empty.
 */
export const NAVIGATION = [
  { type: 'item', to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  {
    type: 'group',
    label: 'CRM',
    icon: Building2,
    items: [
      { to: '/leads', label: 'Leads', icon: BriefcaseBusiness, module: 'leads' },
      { to: '/customers', label: 'Customers', icon: UsersRound, module: 'customers' },
    ],
  },
  {
    type: 'group',
    label: 'HR',
    icon: Users,
    items: [
      { to: '/employees', label: 'Employees', icon: Users, module: 'employees' },
      { to: '/leave', label: 'Leave', icon: Plane, module: 'leave', badge: 'pendingLeaves' },
      { to: '/daily-status', label: 'Daily Status', icon: ClipboardList, module: 'dailyStatus' },
      { to: '/payslips', label: 'Payslips', icon: FileText, module: 'payslips' },
    ],
  },
  {
    type: 'group',
    label: 'Finance',
    icon: ReceiptText,
    items: [{ to: '/invoices', label: 'Invoices', icon: ReceiptText, module: 'invoices' }],
  },
  { type: 'item', to: '/calendar', label: 'Calendar', icon: CalendarDays, module: 'calendar' },
  {
    type: 'group',
    label: 'Administration',
    icon: ShieldCheck,
    adminOnly: true,
    items: [
      { to: '/permissions', label: 'Permissions', icon: ShieldCheck, adminOnly: true },
      { to: '/settings', label: 'Settings', icon: Settings2, adminOnly: true },
    ],
  },
];

const itemVisible = (item, user, isAdmin) => {
  if (item.adminOnly) return isAdmin;
  if (!item.module) return true;
  return canAccessModule(user, item.module);
};

/** The navigation tree filtered down to what this user may actually open. */
export function visibleNavigation(user, isAdmin) {
  return NAVIGATION.map((entry) => {
    if (entry.type === 'item') return itemVisible(entry, user, isAdmin) ? entry : null;
    const items = entry.items.filter((item) => itemVisible(item, user, isAdmin));
    return items.length ? { ...entry, items } : null;
  }).filter(Boolean);
}
