import {
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  Plane,
  Settings2,
  Users,
} from 'lucide-react';
import { ROLES } from '@/lib/constants';

/** Navigation per role, mirroring spec §15. */
export const NAVIGATION = {
  [ROLES.ADMIN]: [
    {
      label: 'Overview',
      items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }],
    },
    {
      label: 'People',
      items: [
        { to: '/employees', label: 'Employee Management', icon: Users },
        { to: '/leave-management', label: 'Leave Management', icon: Plane, badge: 'pendingLeaves' },
        { to: '/daily-status', label: 'Daily Status', icon: ClipboardList },
        { to: '/calendar', label: 'Calendar Management', icon: CalendarDays },
      ],
    },
    {
      label: 'Sales',
      items: [
        { to: '/sales', label: 'Sales', icon: BriefcaseBusiness, end: true },
        { to: '/sales/configuration', label: 'Sales Configuration', icon: Settings2 },
      ],
    },
  ],
  [ROLES.EMPLOYEE]: [
    {
      label: 'Overview',
      items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }],
    },
    {
      label: 'My work',
      items: [
        { to: '/my-leave', label: 'My Leave', icon: Plane },
        { to: '/my-status', label: 'My Daily Status', icon: ClipboardList },
      ],
    },
    {
      label: 'Company',
      items: [
        { to: '/calendar', label: 'Calendar', icon: CalendarDays },
        { to: '/sales', label: 'Sales', icon: BriefcaseBusiness, end: true },
      ],
    },
  ],
};
