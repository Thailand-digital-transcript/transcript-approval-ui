import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { submitDecision, listQueue, listAll, getBatch } from './batches';
import type { BatchStatus, DecisionResult } from '../types/batch';

const TOKEN = 'test-jwt';

const mockResult: DecisionResult = {
  batchId: 'batch-123',
  decisionId: 'decision-456',
  status: 'PENDING_DEAN' as BatchStatus,
  accepted: true,
};

describe('submitDecision', () => {
  it('POSTs JSON and returns the DecisionResult', async () => {
    let captured: { url: string; method: string; contentType: string; body: unknown } | undefined;

    server.use(
      http.post('/api/v1/batches/:id/decision', async ({ request }) => {
        captured = {
          url: request.url,
          method: request.method,
          contentType: request.headers.get('content-type') ?? '',
          body: await request.json(),
        };
        return HttpResponse.json(mockResult, { status: 202 });
      }),
    );

    const result = await submitDecision(TOKEN, 'batch-123', {
      decision: 'APPROVE',
      rejectedDocumentIds: [],
    });

    expect(captured?.method).toBe('POST');
    expect(captured?.url).toContain('/api/v1/batches/batch-123/decision');
    expect(captured?.contentType).toBe('application/json');
    expect(captured?.body).toEqual({ decision: 'APPROVE', rejectedDocumentIds: [] });
    expect(result).toEqual(mockResult);
  });

  it('sends the Authorization header when a token is provided', async () => {
    let authHeader: string | null = null;

    server.use(
      http.post('/api/v1/batches/:id/decision', ({ request }) => {
        authHeader = request.headers.get('authorization');
        return HttpResponse.json(mockResult, { status: 202 });
      }),
    );

    await submitDecision(TOKEN, 'batch-123', { decision: 'REJECT', rejectedDocumentIds: ['doc-1'] });

    expect(authHeader).toBe(`Bearer ${TOKEN}`);
  });

  it('throws ApiError on a non-OK response', async () => {
    server.use(
      http.post('/api/v1/batches/:id/decision', () =>
        HttpResponse.json({ detail: 'Batch not found' }, { status: 404 }),
      ),
    );

    await expect(
      submitDecision(TOKEN, 'batch-123', { decision: 'APPROVE', rejectedDocumentIds: [] }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: 'Batch not found',
    });
  });
});

describe('listQueue / listAll / getBatch', () => {
  it('listQueue appends status query param', async () => {
    const captured = vi.fn();
    server.use(
      http.get('/api/v1/batches', ({ request }) => {
        captured(request.url);
        return HttpResponse.json([]);
      }),
    );

    await listQueue(TOKEN, 'PENDING_REGISTRAR');
    expect(captured).toHaveBeenCalled();
    expect(captured.mock.calls[0]![0]).toContain('status=PENDING_REGISTRAR');
  });

  it('listAll appends page and size query params', async () => {
    const captured = vi.fn();
    server.use(
      http.get('/api/v1/batches', ({ request }) => {
        captured(request.url);
        return HttpResponse.json([]);
      }),
    );

    await listAll(TOKEN, 2, 25);
    expect(captured.mock.calls[0]![0]).toContain('page=2');
    expect(captured.mock.calls[0]![0]).toContain('size=25');
  });

  it('getBatch hits the batch detail endpoint', async () => {
    const detail = {
      id: 'batch-123',
      name: 'Spring 2026',
      institutionCode: 'CU',
      status: 'PENDING_REGISTRAR' as BatchStatus,
      itemCount: 0,
      createdBy: 'staff',
      createdAt: '2026-06-19T00:00:00Z',
      items: [],
    };
    server.use(
      http.get('/api/v1/batches/:id', () => HttpResponse.json(detail)),
    );

    const result = await getBatch(TOKEN, 'batch-123');
    expect(result.id).toBe('batch-123');
  });
});
