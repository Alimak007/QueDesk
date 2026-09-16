import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { useAuth } from '@/features/auth/useAuth';
import { useNavCounts } from '@/features/dashboard/api';
import { cn } from '@/lib/utils';
import { Logo } from './Logo';
import { visibleNavigation } from './navigation';

const STORAGE_KEY = 'quedesk.sidebar.collapsed';

function readCollapsed() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

function NavItem({ item, count = 0, onNavigate, nested = false }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      title={item.label}
      className={({ isActive }) =>
        cn(
          'group relative flex h-9 items-center gap-2.5 rounded-lg pr-2.5 text-[13.5px] font-medium transition-colors',
          nested ? 'pl-9' : 'pl-3',
          isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute inset-y-1.5 -left-3 w-1 rounded-r-full bg-brand-600" aria-hidden />}
          <Icon
            size={17}
            className={cn('shrink-0', isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600')}
            aria-hidden
          />
          <span className="flex-1 truncate">{item.label}</span>
          {count > 0 && (
            <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-px text-[11px] font-semibold text-amber-800 tabular">
              {count}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export function SidebarContent({ onNavigate }) {
  const { user, isAdmin } = useAuth();
  const { pathname } = useLocation();
  const sections = visibleNavigation(user, isAdmin);
  const counts = useNavCounts(user);
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggle = (label) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        /* storage may be unavailable; collapsing still works for this session */
      }
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Logo />
      </div>

      <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto px-3 py-3" aria-label="Main navigation">
        {sections.map((section) => {
          if (section.type === 'item') {
            return <NavItem key={section.to} item={section} count={counts[section.badge] ?? 0} onNavigate={onNavigate} />;
          }

          const hasActiveChild = section.items.some((item) => pathname.startsWith(item.to));
          const isOpen = !collapsed.has(section.label) || hasActiveChild;
          const GroupIcon = section.icon;
          const groupCount = section.items.reduce((sum, item) => sum + (counts[item.badge] ?? 0), 0);

          return (
            <div key={section.label} className="pt-1.5">
              <button
                type="button"
                onClick={() => toggle(section.label)}
                aria-expanded={isOpen}
                className="flex h-8 w-full items-center gap-2.5 rounded-lg px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 transition-colors hover:text-slate-600"
              >
                <GroupIcon size={14} className="shrink-0" aria-hidden />
                <span className="flex-1 truncate text-left">{section.label}</span>
                {!isOpen && groupCount > 0 && (
                  <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800 tabular">{groupCount}</span>
                )}
                <ChevronRight size={14} className={cn('shrink-0 transition-transform', isOpen && 'rotate-90')} aria-hidden />
              </button>
              {isOpen && (
                <ul className="mt-0.5 space-y-0.5 border-l border-slate-200/70 pl-0" style={{ marginLeft: '1.05rem' }}>
                  {section.items.map((item) => (
                    <li key={item.to} className="-ml-px">
                      <NavItem item={item} count={counts[item.badge] ?? 0} onNavigate={onNavigate} nested />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
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
