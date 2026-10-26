import {
  BarChart3,
  Boxes,
  CalendarCheck,
  CalendarDays,
  CreditCard,
  FolderTree,
  LayoutDashboard,
  type LucideIcon,
  MapPin,
  Menu,
  Moon,
  Package,
  ScrollText,
  Settings,
  Shield,
  Sun,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { Suspense, useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { type ApiStatus, useApiHealth } from '@/api/use-api-health';
import { useAuth } from '@/auth/auth-context';
import { StepUpHost } from '@/features/account/mfa';
import { Loading } from '@/components/page';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

export function ApiStatusBadge() {
  const { status } = useApiHealth();
  const styles: Record<ApiStatus, string> = {
    ok: 'bg-success/15 text-success',
    down: 'bg-destructive/15 text-destructive',
    checking: 'bg-muted text-muted-foreground',
  };
  return (
    <div
      role="status"
      aria-label="API status"
      className={cn('hidden rounded-full px-3 py-1 text-xs font-medium sm:block', styles[status])}
    >
      API: {status}
    </div>
  );
}

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Shown only to administrators holding this permission. */
  permission?: string;
  end?: boolean;
}

interface NavGroup {
  title: string;
  items: ReadonlyArray<NavItem>;
}

const GROUPS: ReadonlyArray<NavGroup> = [
  {
    title: 'Operations',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/bookings', label: 'Bookings', icon: CalendarCheck, permission: 'bookings:read' },
      { to: '/schedule', label: 'Schedule', icon: CalendarDays, permission: 'bookings:read' },
      { to: '/customers', label: 'Customers', icon: Users, permission: 'users:read' },
    ],
  },
  {
    title: 'Catalogue',
    items: [
      {
        to: '/inventory/categories',
        label: 'Categories',
        icon: FolderTree,
        permission: 'inventory:read',
      },
      { to: '/inventory/models', label: 'Item models', icon: Boxes, permission: 'inventory:read' },
      { to: '/inventory/assets', label: 'Assets', icon: Package, permission: 'assets:read' },
      { to: '/drawers', label: 'Drawers', icon: MapPin, permission: 'drawers:read' },
    ],
  },
  {
    title: 'Team',
    items: [
      { to: '/staff', label: 'Staff', icon: UserCog, permission: 'admins:read' },
      { to: '/roles', label: 'Roles', icon: Shield, permission: 'roles:read' },
    ],
  },
  {
    title: 'Insights',
    items: [
      { to: '/reports', label: 'Reports', icon: BarChart3, permission: 'reports:read' },
      { to: '/payments', label: 'Payments', icon: CreditCard, permission: 'reports:read' },
      { to: '/audit', label: 'Audit log', icon: ScrollText, permission: 'audit:read' },
      { to: '/settings', label: 'Settings', icon: Settings, permission: 'settings:read' },
    ],
  },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/logo-512.png"
        alt=""
        aria-hidden="true"
        width={32}
        height={32}
        className="size-8 rounded-[10px] shadow-sm"
      />
      <h1 className="hidden text-base font-semibold tracking-tight whitespace-nowrap min-[420px]:block">
        Rento Admin
      </h1>
    </div>
  );
}

export function AppLayout() {
  const { me, can, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const groups = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => item.permission === undefined || can(item.permission)),
  })).filter((g) => g.items.length > 0);
  const name = me?.user.displayName ?? me?.user.email ?? '';

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b bg-background/80 px-3 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
          <Brand />
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <ApiStatusBadge />
          <Button
            variant="ghost"
            size="sm"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <NavLink
            to="/account"
            data-testid="signed-in-as"
            className="flex items-center gap-2 rounded-full py-1 pr-1 text-sm hover:bg-accent sm:pr-3"
          >
            <span className="sr-only">My account: </span>
            <Avatar name={name} src={me?.user.avatarUrl} size={28} />
            <span className="hidden text-muted-foreground sm:inline">
              {me?.user.displayName ?? me?.user.email}
            </span>
          </NavLink>
          <Button variant="outline" size="sm" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </header>

      <div className="flex flex-1">
        <nav
          aria-label="Main"
          className={cn(
            'fixed inset-y-16 left-0 z-20 w-64 shrink-0 overflow-y-auto border-r bg-card p-3 transition-transform lg:static lg:inset-auto lg:translate-x-0',
            menuOpen ? 'translate-x-0 shadow-card' : '-translate-x-full',
          )}
        >
          {groups.map((group) => (
            <div key={group.title} className="mb-4">
              <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {group.title}
              </p>
              <ul className="flex flex-col gap-0.5 text-sm">
                {group.items.map(({ to, label, icon: Icon, end }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={end ?? false}
                      onClick={() => setMenuOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
                          isActive
                            ? 'bg-accent font-medium text-accent-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )
                      }
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      {label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        {menuOpen && (
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 top-16 z-10 bg-black/30 lg:hidden"
            onClick={() => setMenuOpen(false)}
          />
        )}

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <Suspense fallback={<Loading />}>
            <Outlet />
          </Suspense>
          <StepUpHost />
        </main>
      </div>
    </div>
  );
}
