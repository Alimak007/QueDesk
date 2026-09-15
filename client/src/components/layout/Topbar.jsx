import { ChevronDown, LogOut, Menu as MenuIcon, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Avatar, Button, Menu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui';
import { useAuth } from '@/features/auth/useAuth';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { formatDate, todayDateOnly } from '@/lib/dates';
import { fullName } from '@/lib/utils';
import { LogoMark } from './Logo';

export function Topbar({ onMenuClick }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('You have been signed out');
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick} aria-label="Open navigation">
          <MenuIcon size={20} />
        </Button>
        <LogoMark className="size-7 lg:hidden" />

        <p className="hidden text-sm text-slate-500 sm:block">{formatDate(todayDateOnly(), 'EEEE, d MMMM yyyy')}</p>

        <div className="ml-auto flex items-center gap-1.5">
          <NotificationBell />

          <div className="mx-1.5 h-6 w-px bg-slate-200" aria-hidden />

          <Menu
            trigger={
              <button
                type="button"
                className="flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-2 transition-colors hover:bg-slate-100 data-[state=open]:bg-slate-100"
              >
                <Avatar user={user} size="sm" />
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block max-w-40 truncate text-sm font-medium text-slate-900">{fullName(user)}</span>
                  <span className="block text-xs text-slate-500">{isAdmin ? 'Administrator' : user.designation || 'Employee'}</span>
                </span>
                <ChevronDown size={15} className="hidden text-slate-400 sm:block" />
              </button>
            }
          >
            <MenuLabel>
              <span className="block truncate text-slate-900">{fullName(user)}</span>
              <span className="block truncate font-normal">{user.email}</span>
            </MenuLabel>
            <MenuSeparator />
            <MenuItem icon={UserRound} onSelect={() => navigate('/profile')}>
              My profile
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={LogOut} tone="danger" onSelect={handleLogout}>
              Sign out
            </MenuItem>
          </Menu>
        </div>
      </div>
    </header>
  );
}
