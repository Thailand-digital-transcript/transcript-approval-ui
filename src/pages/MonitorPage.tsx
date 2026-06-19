import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/useAuth';
import { listAll } from '@/api/batches';
import { ApiError } from '@/api/client';
import { QueueTable } from '@/components/QueueTable';
import { Button } from '@/components/ui/button';

/**
 * Fixed page size for the monitor view. The brief intentionally
 * does not expose a page-size selector — the orchestrator
 * `GET /batches?page=&size=` contract is what we have today, and
 * the "is this the last page?" heuristic below is calibrated to
 * `PAGE_SIZE`. Bump this constant if the backend ever ships a
 * count or total in the response, at which point the heuristic
 * can be replaced with a real total.
 */
const PAGE_SIZE = 20;

/**
 * Operations/monitoring view of every batch in the system — not
 * filtered to a single approver gate. Calls `listAll(token, page, size)`
 * (B3) → `GET /api/v1/batches?page=<p>&size=<s>` and renders the
 * returned `BatchSummary[]` through the same `QueueTable` used by
 * `QueuePage`, minus the per-row decision affordance (no role here
 * can decide; the only thing the operator can do is open the detail
 * page).
 *
 * Pagination:
 * - `Previous` is disabled on page 1.
 * - `Next` is disabled when the current response returned fewer
 *   than `PAGE_SIZE` rows, which is a simple "you're on the last
 *   page" heuristic. If the backend ever returns a count, swap this
 *   for a real total-derived check.
 *
 * The query key embeds the page so changing pages refetches:
 * `['batches', 'all', page]`.
 *
 * Role gating is intentionally deferred (B11 brief) — the page is
 * reachable by any authenticated user. The nav link in `AppNav.tsx`
 * carries a matching TODO comment for when the monitor role name
 * is known.
 */
export function MonitorPage() {
  const { token } = useAuth();
  const [page, setPage] = useState(0);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['batches', 'all', page],
    queryFn: () => listAll(token, page, PAGE_SIZE),
  });

  // `data` is `BatchSummary[]` (B3) — the orchestrator returns the
  // array directly, no envelope. We rely on its length both to drive
  // the table and to decide whether `Next` should remain enabled.
  const rows = data ?? [];
  // The "fewer than PAGE_SIZE" heuristic only carries information
  // AFTER page 0 — if the very first page has fewer than PAGE_SIZE
  // rows, the backend could just be returning its entire (small)
  // result set, not signalling the end of pagination. We only
  // conclude "this is the last page" once we've moved past page 0
  // and the response comes back short. (Brief: "if the backend ever
  // returns a count, switch to a real total".)
  const isLastPage = page > 0 && rows.length < PAGE_SIZE;
  const displayPage = page + 1; // 0-indexed data, 1-indexed display

  return (
    <div
      className="mx-auto max-w-7xl px-4 py-6 space-y-4"
      data-testid="monitor-page"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Monitor</h1>
        <span
          className="text-sm text-muted-foreground"
          data-testid="monitor-page-indicator"
        >
          Page {displayPage}
        </span>
      </div>

      <div aria-busy={isLoading}>
        {isLoading ? (
          <p
            className="text-muted-foreground text-sm"
            data-testid="monitor-loading"
          >
            Loading…
          </p>
        ) : isError ? (
          <p
            className="text-destructive text-sm"
            data-testid="monitor-error"
            role="alert"
          >
            {error instanceof ApiError
              ? `Failed to load monitor: ${error.message}`
              : 'Failed to load monitor.'}
          </p>
        ) : data ? (
          <QueueTable batches={data} />
        ) : null}
      </div>

      <div
        className="flex items-center justify-end gap-2"
        data-testid="monitor-pagination"
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          data-testid="monitor-prev"
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPage((p) => p + 1)}
          disabled={isLastPage}
          data-testid="monitor-next"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
