import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/test-utils';
import { MonitorPage } from './MonitorPage';
import type { BatchSummary } from '@/types/batch';

const PAGE0_BATCHES: BatchSummary[] = [
  {
    id: 'batch-1',
    name: 'Spring 2026',
    institutionCode: 'CU',
    status: 'PENDING_REGISTRAR',
    itemCount: 12,
    createdBy: 'staff-1',
    createdAt: '2026-06-19T10:00:00Z',
  },
  {
    id: 'batch-2',
    name: 'Summer 2026',
    institutionCode: 'CU',
    status: 'PENDING_DEAN',
    itemCount: 5,
    createdBy: 'staff-1',
    createdAt: '2026-06-19T11:00:00Z',
  },
];

const PAGE1_BATCH: BatchSummary[] = [
  {
    id: 'batch-3',
    name: 'Autumn 2026',
    institutionCode: 'CU',
    status: 'COMPLETED',
    itemCount: 7,
    createdBy: 'staff-1',
    createdAt: '2026-06-19T12:00:00Z',
  },
];

/**
 * MSW handler that echoes the query string and returns the fixture for
 * the requested page. Records every hit so the test can assert which
 * page was requested.
 */
function makePaginatedHandler() {
  const hits: { page: string; size: string }[] = [];
  const handler = http.get('/api/v1/batches', ({ request }) => {
    const url = new URL(request.url);
    const page = url.searchParams.get('page') ?? '';
    const size = url.searchParams.get('size') ?? '';
    // The monitor endpoint uses `page` + `size`; the queue endpoint
    // uses `status`. Only count requests that look like monitor calls
    // (no status param) so other handlers don't pollute the hit list.
    if (url.searchParams.has('status')) {
      return HttpResponse.json([]);
    }
    hits.push({ page, size });
    if (page === '1') return HttpResponse.json(PAGE1_BATCH);
    return HttpResponse.json(PAGE0_BATCHES);
  });
  return { hits, handler };
}

describe('MonitorPage', () => {
  it('renders both pages of results and advances via the Next button', async () => {
    const { hits, handler } = makePaginatedHandler();
    server.use(handler);

    const user = userEvent.setup();
    renderWithProviders(<MonitorPage />, {
      auth: { token: 'test-token' },
      initialEntries: ['/monitor'],
    });

    // Initial page renders both fixtures, Previous is disabled,
    // Next is enabled (we got a full page of results).
    expect(await screen.findByText('Spring 2026')).toBeInTheDocument();
    expect(screen.getByText('Summer 2026')).toBeInTheDocument();
    expect(screen.getByTestId('monitor-prev')).toBeDisabled();
    expect(screen.getByTestId('monitor-next')).toBeEnabled();

    // The indicator shows page 1 (1-indexed display, 0-indexed data).
    expect(screen.getByTestId('monitor-page-indicator')).toHaveTextContent(
      /page 1/i,
    );

    // Sanity: the initial query was for page=0 with size=20.
    await waitFor(() =>
      expect(hits.some((h) => h.page === '0' && h.size === '20')).toBe(true),
    );

    // Advance to page 2 → only one row, so Next becomes disabled.
    await user.click(screen.getByTestId('monitor-next'));

    expect(await screen.findByText('Autumn 2026')).toBeInTheDocument();
    expect(screen.queryByText('Spring 2026')).not.toBeInTheDocument();
    expect(screen.getByTestId('monitor-prev')).toBeEnabled();
    expect(screen.getByTestId('monitor-next')).toBeDisabled();
    expect(screen.getByTestId('monitor-page-indicator')).toHaveTextContent(
      /page 2/i,
    );

    // A new query fired with page=1, size=20.
    await waitFor(() =>
      expect(hits.some((h) => h.page === '1' && h.size === '20')).toBe(true),
    );
  });

  it('goes back via the Previous button and re-disables it on page 1', async () => {
    const { hits, handler } = makePaginatedHandler();
    server.use(handler);

    const user = userEvent.setup();
    renderWithProviders(<MonitorPage />, {
      auth: { token: 'test-token' },
      initialEntries: ['/monitor'],
    });

    expect(await screen.findByText('Spring 2026')).toBeInTheDocument();

    // Advance once → page 2.
    await user.click(screen.getByTestId('monitor-next'));
    expect(await screen.findByText('Autumn 2026')).toBeInTheDocument();
    expect(screen.getByTestId('monitor-prev')).toBeEnabled();

    // Go back → page 1 again, Previous re-disabled.
    await user.click(screen.getByTestId('monitor-prev'));
    expect(await screen.findByText('Spring 2026')).toBeInTheDocument();
    expect(screen.getByTestId('monitor-prev')).toBeDisabled();
    expect(screen.getByTestId('monitor-next')).toBeEnabled();

    // Confirm both pages were queried at least once each.
    await waitFor(() =>
      expect(hits.filter((h) => h.page === '0').length).toBeGreaterThanOrEqual(2),
    );
    expect(hits.filter((h) => h.page === '1').length).toBeGreaterThanOrEqual(1);
  });

  it('shows a loading indicator while the page query is in flight', () => {
    // A handler that never resolves — the page should sit in its
    // loading state forever (we assert on the initial render).
    server.use(
      http.get('/api/v1/batches', () => new Promise(() => {})),
    );

    renderWithProviders(<MonitorPage />, {
      auth: { token: 'test-token' },
      initialEntries: ['/monitor'],
    });

    expect(screen.getByTestId('monitor-loading')).toBeInTheDocument();
  });

  it('shows an empty-state row when the backend returns no batches', async () => {
    server.use(http.get('/api/v1/batches', () => HttpResponse.json([])));

    renderWithProviders(<MonitorPage />, {
      auth: { token: 'test-token' },
      initialEntries: ['/monitor'],
    });

    await waitFor(() =>
      expect(screen.getByText(/no batches in this queue/i)).toBeInTheDocument(),
    );
  });

  it('surfaces an error message when the backend returns 5xx', async () => {
    server.use(
      http.get('/api/v1/batches', () =>
        HttpResponse.json({ detail: 'boom' }, { status: 500 }),
      ),
    );

    renderWithProviders(<MonitorPage />, {
      auth: { token: 'test-token' },
      initialEntries: ['/monitor'],
    });

    expect(
      await screen.findByTestId('monitor-error'),
    ).toBeInTheDocument();
    expect(screen.getByText(/failed to load monitor/i)).toBeInTheDocument();
  });
});
