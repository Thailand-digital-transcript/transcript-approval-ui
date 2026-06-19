import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/useAuth';
import { availableGates, gateForRoles } from '@/lib/roles';
import { listQueue } from '@/api/batches';
import { ApiError } from '@/api/client';
import { QueueTable } from '@/components/QueueTable';
import { cn } from '@/lib/utils';
import type { BatchStatus } from '@/types/batch';

/**
 * Human-readable label for the two queue gates. `availableGates()`
 * only ever yields `PENDING_REGISTRAR` / `PENDING_DEAN` (the two
 * approver-side gates), so we declare the map as
 * `Partial<Record<BatchStatus, string>>` and fall back to the raw
 * enum value if the helper ever expands to cover more statuses.
 */
const GATE_LABELS: Partial<Record<BatchStatus, string>> = {
  PENDING_REGISTRAR: 'Registrar queue',
  PENDING_DEAN: 'Dean queue',
};

/**
 * Landing page for the registrar / dean SPA.
 *
 * Resolves the user's role(s) to a single gate via `gateForRoles`
 * (with `availableGates` to know whether the user can act on both),
 * then queries `GET /api/v1/batches?status=<GATE>` through the B3
 * `listQueue` client and renders the returned `BatchSummary[]` via
 * the B8 `QueueTable`.
 *
 * Edge cases:
 * - User holds both `registrar` and `dean` → render a small
 *   segmented gate toggle. Switching it refetches because the
 *   query key is `['batches', 'queue', activeGate]`.
 * - User holds no approver role → show a "No approver role" fallback
 *   message rather than firing a request for `null` and rendering a
 *   broken empty table.
 * - Loading / error / empty states are handled inline so the page is
 *   self-describing.
 */
export function QueuePage() {
  const { token, roles } = useAuth();
  const gates = availableGates(roles);
  const primaryGate = gateForRoles(roles);

  // No approver role → show the fallback before opening a query.
  // We still read `availableGates` above because B8 routed every
  // authenticated user to `/queue`; the AuthGuard doesn't know
  // whether the role set is approver-shaped.
  if (primaryGate === null) {
    return (
      <div
        className="mx-auto max-w-7xl px-4 py-6"
        data-testid="no-approver-role"
      >
        <p className="text-muted-foreground text-sm">
          No approver role is assigned to your account. Contact your
          administrator to request registrar or dean access.
        </p>
      </div>
    );
  }

  return (
    <QueueView
      token={token}
      gates={gates}
      initialGate={primaryGate}
    />
  );
}

interface QueueViewProps {
  token: string | undefined;
  gates: BatchStatus[];
  initialGate: BatchStatus;
}

/**
 * The actual queue panel, mounted only when the user has at least
 * one approver role. Splitting it out keeps `QueuePage`'s
 * no-approver early return independent of the `useState` / `useQuery`
 * hooks below — otherwise React's rules of hooks would force a
 * re-order.
 */
function QueueView({ token, gates, initialGate }: QueueViewProps) {
  const [activeGate, setActiveGate] = useState<BatchStatus>(initialGate);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['batches', 'queue', activeGate],
    queryFn: () => listQueue(token, activeGate),
  });

  return (
    <div
      className="mx-auto max-w-7xl px-4 py-6 space-y-4"
      data-testid="queue-page"
    >
      <h1 className="text-xl font-semibold">Approval queue</h1>

      {gates.length > 1 ? (
        <div
          role="tablist"
          aria-label="Approval queue"
          className="inline-flex rounded-lg border bg-muted p-1"
          data-testid="gate-toggle"
        >
          {gates.map((g) => {
            const isActive = activeGate === g;
            return (
              <button
                key={g}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls="queue-panel"
                data-testid={`gate-toggle-${g}`}
                onClick={() => setActiveGate(g)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-background text-foreground shadow'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {GATE_LABELS[g] ?? g}
              </button>
            );
          })}
        </div>
      ) : null}

      <div id="queue-panel" aria-busy={isLoading}>
        {isLoading ? (
          <p
            className="text-muted-foreground text-sm"
            data-testid="queue-loading"
          >
            Loading…
          </p>
        ) : isError ? (
          <p
            className="text-destructive text-sm"
            data-testid="queue-error"
            role="alert"
          >
            {error instanceof ApiError
              ? `Failed to load queue: ${error.message}`
              : 'Failed to load queue.'}
          </p>
        ) : data ? (
          <QueueTable batches={data} />
        ) : null}
      </div>
    </div>
  );
}
