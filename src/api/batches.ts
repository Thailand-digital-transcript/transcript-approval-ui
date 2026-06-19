import { apiFetch } from './client';
import type { BatchSummary, BatchDetail, BatchStatus, Decision, DecisionResult } from '../types/batch';

export const listQueue = (token: string | undefined, gate: BatchStatus) =>
  apiFetch<BatchSummary[]>(`/api/v1/batches?status=${gate}`, token);

export const listAll = (token: string | undefined, page: number, size: number) =>
  apiFetch<BatchSummary[]>(`/api/v1/batches?page=${page}&size=${size}`, token);

export const getBatch = (token: string | undefined, id: string) =>
  apiFetch<BatchDetail>(`/api/v1/batches/${id}`, token);

export const submitDecision = (
  token: string | undefined, id: string,
  body: { decision: Decision; rejectedDocumentIds: string[]; rejectionReason?: string },
) => apiFetch<DecisionResult>(`/api/v1/batches/${id}/decision`, token, {
  method: 'POST', body: JSON.stringify(body),
});
