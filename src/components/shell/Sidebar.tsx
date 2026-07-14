// ============================================================================
// Sidebar — the Nexus / Cyber-Ops primary navigation.
//
// The app navigated with a row of horizontal tabs. The reference design puts
// navigation in a vertical rail: a section header, the nav list, a prominent
// primary action pinned above a small footer group. That is not decoration — a
// rail scales (the tab row was already two levels deep and about to grow a
// third), it keeps the primary action always reachable, and it gives the page
// heading the full width the display type was designed for.
//
// It renders TWICE, from one definition: a static rail from `lg` up, and a
// drawer below it. The rail alone would have been a regression — the old tab
// bars worked at every width, and a rail that is merely `hidden` on a phone
// takes the whole of navigation with it, "New Request" included.
//
// Every item is a route. There is no navigation state left in a useState.
// ============================================================================

import { useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useFocusTrap, isTopmostTrap } from '../../hooks/useFocusTrap';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Cpu,
  BarChart3,
  ShieldCheck,
  FilePlus2,
  Inbox,
  Plus,
  User,
  Terminal,
  LifeBuoy,
  X,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
  /** Match child routes too (e.g. /admin/devices/allocation). */
  nested?: boolean;
  children?: { to: string; label: string }[];
}

const ADMIN_NAV: NavItem[] = [
  { to: '/admin/tickets', label: 'Ticket Queue', Icon: LayoutDashboard },
  {
    to: '/admin/devices',
    label: 'Device Inventory',
    Icon: Cpu,
    nested: true,
    children: [
      { to: '/admin/devices', label: 'Inventory' },
      { to: '/admin/devices/allocation', label: 'Allocation Queue' },
      { to: '/admin/devices/reports', label: 'Reports' },
    ],
  },
  { to: '/admin/reports', label: 'Reports & Trends', Icon: BarChart3 },
  { to: '/admin/approval', label: 'Approval', Icon: ShieldCheck },
];

const USER_NAV: NavItem[] = [
  { to: '/requests/new', label: 'New Request', Icon: FilePlus2 },
  { to: '/requests', label: 'My Requests', Icon: Inbox },
];

const itemClass = (active: boolean) =>
  [
    'flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition-colors',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
    active
      ? // The reference marks the active item with a solid primary pill.
        'bg-violet-700 text-white shadow-sm dark:bg-violet-600'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white',
  ].join(' ');

interface SidebarProps {
  isAdminView: boolean;
  isITSupport: boolean;
  onSwitchView: (to: 'user' | 'admin') => void;
  /** Drawer state, for widths below `lg`. Ignored by the static rail. */
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

function SidebarContent({
  isAdminView,
  isITSupport,
  onSwitchView,
  onNavigate,
}: Omit<SidebarProps, 'mobileOpen' | 'onCloseMobile'> & { onNavigate: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const nav = isAdminView ? ADMIN_NAV : USER_NAV;

  return (
    <>
      {/* Section header — who you are and where you are. */}
      <div className="mb-6 flex items-start gap-3 px-1">
        <div className="mt-0.5 rounded-lg bg-violet-700/10 p-1.5 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300">
          {isAdminView ? <ShieldCheck className="h-5 w-5" /> : <User className="h-5 w-5" />}
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold leading-tight text-violet-800 dark:text-violet-300">
            {isAdminView ? 'Operations Center' : 'Employee Portal'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isAdminView ? 'IT Support & Assets' : 'Service Requests'}
          </p>
        </div>
      </div>

      {/* Primary action, always reachable. */}
      <button
        type="button"
        onClick={() => {
          navigate('/requests/new');
          onNavigate();
        }}
        className="mb-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition-colors hover:bg-violet-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 dark:bg-violet-600 dark:hover:bg-violet-500"
      >
        <Plus className="h-4 w-4" />
        New Request
      </button>

      <nav className="flex-1 space-y-1" aria-label="Primary">
        {nav.map(({ to, label, Icon, nested, children }) => (
          <div key={to}>
            <NavLink
              to={to}
              end={!nested}
              onClick={onNavigate}
              className={({ isActive }) => itemClass(isActive)}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {label}
            </NavLink>

            {/* Sub-navigation appears only while its section is open — the rail
                stays short instead of showing every leaf at all times. */}
            {children && location.pathname.startsWith(to) && (
              <div className="ml-5 mt-1 space-y-0.5 border-l border-slate-200 pl-3 dark:border-slate-800">
                {children.map((c) => (
                  <NavLink
                    key={c.to}
                    to={c.to}
                    end
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      [
                        'block rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
                        isActive
                          ? 'bg-violet-50 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-200',
                      ].join(' ')
                    }
                  >
                    {c.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Footer group — the role switch lives here, out of the way of the work. */}
      <div className="mt-6 space-y-1 border-t border-slate-200 pt-4 dark:border-slate-800">
        {isITSupport && (
          <button
            type="button"
            onClick={() => {
              onSwitchView(isAdminView ? 'user' : 'admin');
              onNavigate();
            }}
            className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <Terminal className="h-[18px] w-[18px]" />
            {isAdminView ? 'Employee Portal' : 'IT Admin Workspace'}
          </button>
        )}
        <p className="hidden items-center gap-3 px-3.5 py-2 text-xs text-slate-400 lg:flex dark:text-slate-600">
          <LifeBuoy className="h-[18px] w-[18px]" />
          Press{' '}
          <kbd className="rounded-sm border border-slate-200 px-1 font-mono dark:border-slate-700">
            Ctrl K
          </kbd>{' '}
          to search
        </p>
      </div>
    </>
  );
}

export default function Sidebar(props: SidebarProps) {
  const { mobileOpen, onCloseMobile } = props;
  const location = useLocation();
  const drawerRef = useRef<HTMLElement>(null);
  const openerRef = useRef<Element | null>(null);
  const trapId = useRef(Symbol('nav-drawer')).current;

  // The drawer says `aria-modal="true"`, which promises assistive tech that the
  // rest of the page is inert. Tab used to walk straight out of it and into the
  // search box behind the backdrop, so the promise was a lie. Now it is not.
  useFocusTrap(drawerRef, mobileOpen, trapId);

  // A drawer left open across a navigation would cover the page you just asked
  // for. Close it whenever the route changes, however the change was made.
  // `onCloseMobile` is stable (useCallback in App), so listing it changes nothing
  // at runtime and costs us no suppression comment.
  useEffect(() => {
    onCloseMobile();
  }, [location.pathname, onCloseMobile]);

  // Widen past `lg` with the drawer open and it becomes a ghost: still mounted,
  // still holding the focus trap and the scroll lock, but invisible — and the
  // hamburger that would close it is `lg:hidden` too, so there is nothing left to
  // click. Close it at the breakpoint instead of leaving it stranded.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) onCloseMobile();
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [onCloseMobile]);

  useEffect(() => {
    if (!mobileOpen) {
      // Hand focus back to whatever opened the drawer, rather than dropping the
      // keyboard user at the top of the document.
      if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
      openerRef.current = null;
      return;
    }
    openerRef.current = document.activeElement;
    drawerRef.current?.focus();

    // Escape closes only the topmost overlay. With the command bar opened on top
    // of the drawer (Ctrl+K works from inside it), one Escape used to collapse
    // both — so the drawer vanished when the user only meant to dismiss search.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTopmostTrap(trapId)) onCloseMobile();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen, onCloseMobile, trapId]);

  return (
    <>
      {/* The rail, from lg up. */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-6 lg:flex dark:border-slate-800 dark:bg-slate-900">
        <SidebarContent {...props} onNavigate={() => {}} />
      </aside>

      {/* The same navigation as a drawer, below lg. */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
            onClick={onCloseMobile}
            role="presentation"
          />
          <aside
            ref={drawerRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-slate-200 bg-white px-4 py-6 shadow-2xl focus:outline-none dark:border-slate-800 dark:bg-slate-900"
            aria-label="Primary navigation"
          >
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close navigation"
              className="absolute right-3 top-3 cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent {...props} onNavigate={onCloseMobile} />
          </aside>
        </div>
      )}
    </>
  );
}
