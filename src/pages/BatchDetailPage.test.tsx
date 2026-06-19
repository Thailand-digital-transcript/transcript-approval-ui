import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/test-utils';
import { ErrorToast } from '@/components/ErrorToast';
import { BatchDetailPage } from './BatchDetailPage';
import type {
  BatchDetail,
  DecisionResult,
  TranscriptItemSummary,
} from '@/types/batch';

const FIXTURE_XML = readFileSync(
  'src/test/fixtures/Transcript_v2.0.xml',
  'utf8',
);

const PENDING_ITEM: TranscriptItemSummary = {
  id: 'item-1',
  transcriptId: 'trans-1',
  documentId: 'doc-1',
  institutionCode: 'CU',
  transcriptType: 'OFFICIAL',
  status: 'PENDING',
  batchId: 'batch-1',
};

const PENDING_BATCH: BatchDetail = {
  id: 'batch-1',
  name: 'Spring 2026',
  institutionCode: 'CU',
  status: 'PENDING_REGISTRAR',
  itemCount: 1,
  createdBy: 'staff-1',
  createdAt: '2026-06-19T10:00:00Z',
  items: [PENDING_ITEM],
};

/**
 * Render the page through the same route the App uses, so `useParams()`
 * resolves the `:id` segment correctly in tests. `MemoryRouter` is
 * the test router; `ErrorToast` mirrors production so the 409 toast
 * is actually rendered to the DOM (sonner needs a `<Toaster />`
 * mounted to surface the toast li).
 */
function renderBatchDetailPage(
  initialEntries: string[] = ['/batches/batch-1'],
) {
  return renderWithProviders(
    <>
      <ErrorToast />
      <Routes>
        <Route path="/batches/:id" element={<BatchDetailPage />} />
        <Route path="/queue" element={<div data-testid="queue-stub" />} />
        <Route path="*" element={<div data-testid="unknown-stub" />} />
      </Routes>
    </>,
    { auth: { token: 'test-token' }, initialEntries },
  );
}

describe('BatchDetailPage', () => {
  it('renders the audit header + transcript for a PENDING_REGISTRAR batch', async () => {
    server.use(
      http.get('/api/v1/batches/:id', () =>
        HttpResponse.json(PENDING_BATCH),
      ),
      http.get('/api/v1/transcripts/:itemId/content', () =>
        new HttpResponse(FIXTURE_XML, {
          headers: { 'Content-Type': 'application/xml' },
        }),
      ),
    );

    renderBatchDetailPage();

    // Audit header: batch name, status badge label, created-by.
    expect(await screen.findByText('Spring 2026')).toBeInTheDocument();
    expect(screen.getByText('Pending Registrar')).toBeInTheDocument();
    expect(screen.getByText(/staff-1/)).toBeInTheDocument();

    // Per-item transcript: the fixture's EN name + a course title
    // surface through <TranscriptView xml=... />.
    expect(await screen.findByText(/Naksuksa/)).toBeInTheDocument();
    expect(screen.getByText(/Mahavittayalai/)).toBeInTheDocument();
    expect(screen.getByText(/Basic Computer/)).toBeInTheDocument();
  });

  it('submits an APPROVE decision and POSTs the decision payload', async () => {
    let captured:
      | { url: string; method: string; body: unknown }
      | undefined;
    server.use(
      http.get('/api/v1/batches/:id', () =>
        HttpResponse.json(PENDING_BATCH),
      ),
      http.get('/api/v1/transcripts/:itemId/content', () =>
        new HttpResponse(FIXTURE_XML, {
          headers: { 'Content-Type': 'application/xml' },
        }),
      ),
      http.post('/api/v1/batches/:id/decision', async ({ request }) => {
        captured = {
          url: request.url,
          method: request.method,
          body: await request.json(),
        };
        return HttpResponse.json(
          {
            batchId: 'batch-1',
            decisionId: 'd-1',
            status: 'REGISTRAR_SIGNING',
            accepted: true,
          } satisfies DecisionResult,
          { status: 202 },
        );
      }),
    );

    const user = userEvent.setup();
    renderBatchDetailPage();

    // Open the decision dialog via the page-level "Approve or reject" button.
    const decideBtn = await screen.findByRole('button', {
      name: /approve/i,
    });
    await user.click(decideBtn);

    // APPROVE is the dialog's default — submit it.
    const submitBtn = screen.getByRole('button', { name: /submit/i });
    await user.click(submitBtn);

    await waitFor(() => expect(captured).toBeDefined());
    expect(captured?.method).toBe('POST');
    expect(captured?.url).toContain(
      '/api/v1/batches/batch-1/decision',
    );
    const body = captured?.body as Record<string, unknown>;
    expect(body.decision).toBe('APPROVE');
    // The APPROVE payload must not carry a rejectionReason key
    // (B7 invariant: the dialog strips it on the APPROVE path).
    expect('rejectionReason' in body).toBe(false);
    // The current API contract requires rejectedDocumentIds even on APPROVE.
    expect(body.rejectedDocumentIds).toEqual([]);
  });

  it('shows the "already moved on" toast when POST returns 409', async () => {
    server.use(
      http.get('/api/v1/batches/:id', () =>
        HttpResponse.json(PENDING_BATCH),
      ),
      http.get('/api/v1/transcripts/:itemId/content', () =>
        new HttpResponse(FIXTURE_XML, {
          headers: { 'Content-Type': 'application/xml' },
        }),
      ),
      http.post('/api/v1/batches/:id/decision', () =>
        HttpResponse.json(
          { detail: 'Batch has already advanced past pending gate' },
          { status: 409 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderBatchDetailPage();

    const decideBtn = await screen.findByRole('button', {
      name: /approve/i,
    });
    await user.click(decideBtn);

    const submitBtn = screen.getByRole('button', { name: /submit/i });
    await user.click(submitBtn);

    // Sonner renders toasts in a portal; findByText polls for the
    // message to appear (the toast is enqueued in onError, which
    // fires asynchronously after the 409 response).
    expect(
      await screen.findByText(/This batch has already moved on/i),
    ).toBeInTheDocument();
  });
});
