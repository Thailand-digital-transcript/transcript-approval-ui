import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/test-utils';
import { QueuePage } from './QueuePage';
import type { BatchSummary } from '@/types/batch';

const REGISTRAR_BATCHES: BatchSummary[] = [
  {
    id: 'batch-1',
    name: 'Spring 2026',
    institutionCode: 'CU',
    status: 'PENDING_REGISTRAR',
    itemCount: 12,
    createdBy: 'staff',
    createdAt: '2026-06-19T10:00:00Z',
  },
  {
    id: 'batch-2',
    name: 'Summer 2026',
    institutionCode: 'CU',
    status: 'PENDING_REGISTRAR',
    itemCount: 5,
    createdBy: 'staff',
    createdAt: '2026-06-19T11:00:00Z',
  },
];

const DEAN_BATCHES: BatchSummary[] = [
  {
    id: 'batch-3',
    name: 'Autumn 2026',
    institutionCode: 'CU',
    status: 'PENDING_DEAN',
    itemCount: 7,
    createdBy: 'staff',
    createdAt: '2026-06-19T12:00:00Z',
  },
];

describe('QueuePage', () => {
  it('lists batches returned for the registrar gate when the user is a registrar', async () => {
    let registrarHits = 0;
    server.use(
      http.get('/api/v1/batches', ({ request }) => {
        const status = new URL(request.url).searchParams.get('status');
        if (status === 'PENDING_REGISTRAR') {
          registrarHits += 1;
          return HttpResponse.json(REGISTRAR_BATCHES);
        }
        return HttpResponse.json([]);
      }),
    );

    renderWithProviders(<QueuePage />, {
      auth: { token: 'test-token', roles: ['registrar'] },
      initialEntries: ['/queue'],
    });

    await waitFor(() => expect(registrarHits).toBeGreaterThanOrEqual(1));
    expect(screen.getByText('Spring 2026')).toBeInTheDocument();
    expect(screen.getByText('Summer 2026')).toBeInTheDocument();
  });

  it('shows an empty-state row when the queue returns no batches', async () => {
    server.use(
      http.get('/api/v1/batches', () => HttpResponse.json([])),
    );

    renderWithProviders(<QueuePage />, {
      auth: { token: 'test-token', roles: ['dean'] },
      initialEntries: ['/queue'],
    });

    await waitFor(() =>
      expect(screen.getByText(/no batches in this queue/i)).toBeInTheDocument(),
    );
  });

  it('falls back to a "no approver role" message when the user has no approver role', () => {
    renderWithProviders(<QueuePage />, {
      auth: { token: 'test-token', roles: ['auditor'] },
      initialEntries: ['/queue'],
    });

    expect(screen.getByTestId('no-approver-role')).toBeInTheDocument();
    expect(screen.getByText(/no approver role/i)).toBeInTheDocument();
    // Must NOT trigger a fetch — if it did, the onUnhandledRequest:'error'
    // MSW guard would fail the test.
  });

  it('toggles between registrar and dean queues for a user with both roles', async () => {
    const hits: string[] = [];
    server.use(
      http.get('/api/v1/batches', ({ request }) => {
        const status = new URL(request.url).searchParams.get('status') ?? '';
        hits.push(status);
        if (status === 'PENDING_DEAN') {
          return HttpResponse.json(DEAN_BATCHES);
        }
        if (status === 'PENDING_REGISTRAR') {
          return HttpResponse.json(REGISTRAR_BATCHES);
        }
        return HttpResponse.json([]);
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<QueuePage />, {
      auth: { token: 'test-token', roles: ['registrar', 'dean'] },
      initialEntries: ['/queue'],
    });

    // Initial mount → registrar queue (per gateForRoles precedence)
    await waitFor(() =>
      expect(screen.getByText('Spring 2026')).toBeInTheDocument(),
    );
    expect(hits).toContain('PENDING_REGISTRAR');

    // Switch to dean queue → batch list changes
    await user.click(screen.getByTestId('gate-toggle-PENDING_DEAN'));

    await waitFor(() =>
      expect(screen.getByText('Autumn 2026')).toBeInTheDocument(),
    );
    expect(screen.queryByText('Spring 2026')).not.toBeInTheDocument();
    expect(hits.filter((h) => h === 'PENDING_DEAN').length).toBeGreaterThanOrEqual(1);
  });
});
