import { NavLink } from 'react-router';
import { useAuth } from '@/features/auth/useAuth';
import { useNavCounts } from '@/features/dashboard/api';
import { cn } from '@/lib/utils';
import { Logo } from './Logo';
import { NAVIGATION } from './navigation';

export function SidebarContent({ onNavigate }) {
  const { user, isAdmin } = useAuth();
  const sections = NAVIGATION[user.role] ?? [];
  const counts = useNavCounts(isAdmin);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Logo />
      </div>

      <nav className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Main navigation">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{section.label}</p>
            <ul className="space-y-0.5">
              {section.items.map(({ to, label, icon: Icon, end, badge }) => {
                const count = badge ? counts[badge] : 0;
                return (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={end}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors',
                          isActive
                            ? 'bg-brand-50 text-brand-700'
                            : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span className="absolute inset-y-1.5 -left-3 w-1 rounded-r-full bg-brand-600" aria-hidden />
                          )}
                          <Icon
                            size={18}
                            className={cn('shrink-0', isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600')}
                            aria-hidden
                          />
                          <span className="flex-1 truncate">{label}</span>
                          {count > 0 && (
                            <span className="rounded-full bg-amber-100 px-1.5 py-px text-[11px] font-semibold text-amber-800 tabular">
                              {count}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-100 p-4">
        <div className="rounded-xl bg-gradient-to-br from-brand-50 to-sky-50 p-3.5 ring-1 ring-brand-100">
          <p className="text-xs font-semibold text-brand-900">{isAdmin ? 'Administrator' : 'Employee'} workspace</p>
          <p className="mt-0.5 text-[11px] leading-snug text-brand-800/70">
            {isAdmin ? 'You can see organisation-wide data.' : 'Your leave and status reports are private to you.'}
          </p>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200/80 bg-white lg:block">
      <SidebarContent />
    </aside>
  );
}
