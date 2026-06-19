import { NavLink } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/auth/useAuth';

/**
 * Top navigation. Shows the app brand on the left, a `NavLink` to the
 * queue + a `NavLink` to the monitor, and a logout button on the right.
 *
 * Per B8 brief: no role gating yet — the `/monitor` link is always
 * shown. B9 will gate the queue's contents by `gateForRoles(roles)`,
 * and a later task may hide the monitor link for non-monitor roles.
 */
const LINKS = [
  { to: '/queue', label: 'Queue' },
  // TODO: gate on monitor role when role name is known. For now the
  // link is shown to every authenticated user (B11 brief: role-gating
  // intentionally deferred).
  { to: '/monitor', label: 'Monitor' },
];

export function AppNav() {
  const { logout } = useAuth();

  return (
    <header className="bg-sidebar text-sidebar-foreground">
      <nav className="flex h-12 items-center px-4">
        <div className="mr-6 flex items-center gap-2 shrink-0">
          <span className="font-semibold text-sm text-white">
            Transcript Approval
          </span>
        </div>
        {LINKS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex h-full items-center px-3 text-sm transition-colors',
                isActive
                  ? 'border-b-2 border-primary font-medium text-white'
                  : 'text-sidebar-foreground/70 hover:text-white',
              )
            }
          >
            {label}
          </NavLink>
        ))}
        <div className="ml-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-sidebar-foreground/80 hover:text-white hover:bg-sidebar-accent"
          >
            <LogOut className="h-4 w-4 mr-1" />
            Logout
          </Button>
        </div>
      </nav>
    </header>
  );
}
