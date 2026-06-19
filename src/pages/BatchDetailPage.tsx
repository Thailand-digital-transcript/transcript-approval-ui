import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/auth/useAuth';
import { getBatch, submitDecision } from '@/api/batches';
import { getTranscriptXml } from '@/api/transcripts';
import { ApiError } from '@/api/client';
import { TranscriptView } from '@/components/TranscriptView';
import { BatchStatusBadge } from '@/components/BatchStatusBadge';
import { DecisionDialog } from '@/components/DecisionDialog';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type {
  BatchDetail,
  BatchStatus,
  TranscriptItemSummary,
} from '@/types/batch';

/**
 * The two approver-side gates. Polling continues while the batch
 * remains in either of these; on transition to any other status
 * (signing, sealing, completed, failed) the page navigates back
 * to the queue so the user is not stuck watching a batch they
 * can no longer act on.
 */
const PENDING_GATES: ReadonlySet<BatchStatus> = new Set<BatchStatus>([
  'PENDING_REGISTRAR',
  'PENDING_DEAN',
]);

function isPendingGate(status: BatchStatus | undefined): boolean {
  return status !== undefined && PENDING_GATES.has(status);
}

/**
 * Per-batch page for the registrar / dean.
 *
 * Data flow:
 * - `useQuery(['batch', id])` fetches the batch detail. After a
 *   successful decision POST, the local `submitted` flag is set
 *   and `refetchInterval` becomes 2 000 ms, so TanStack Query
 *   polls the batch endpoint until the status leaves the
 *   pending gate (an effect below detects the transition and
 *   navigates to `/queue`).
 * - Per item, `useQuery(['xml', itemId])` fetches the transcript
 *   XML and feeds it to `<TranscriptView xml={...} />` from B6.
 *   A parse failure inside `TranscriptView` is rendered as its
 *   own fallback panel — we deliberately do not turn it into a
 *   5xx here, because the user can still inspect the raw XML
 *   via the fallback's "Download raw XML" link.
 *
 * Error handling:
 * - 404 from the initial `getBatch` shows a terminal "Batch not
 *   found" page (no retry button — the id is in the URL, so the
 *   only way to fix a bad id is to re-paste it).
 * - 409 from `submitDecision` means the saga has already advanced
 *   the batch past the gate. We show a sonner toast and
 *   invalidate the queue cache so the next visit to `/queue`
 *   reflects the change; the user can navigate manually.
 * - All other `ApiError`s surface as a destructive toast and
 *   leave the dialog in its current state so the user can retry.
 */
export function BatchDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [decisionOpen, setDecisionOpen] = useState(false);
  // Tracks whether a decision was just submitted in this mount of
  // the page. While true, the batch query polls every 2 s and the
  // navigate-on-leave-pending-gate effect is armed. Reset to false
  // on unmount (the next mount starts fresh) — React's local state
  // gives us that for free.
  const [submitted, setSubmitted] = useState(false);

  const {
    data: batch,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['batch', id],
    queryFn: () => {
      // `enabled: Boolean(id)` already gates the query, but TS
      // can't narrow on that flag, so re-check at call time.
      if (!id) throw new Error('BatchDetailPage: missing :id');
      return getBatch(token, id);
    },
    enabled: Boolean(id),
    // Poll only after a decision has been submitted AND the batch
    // is still in a pending gate. The function form reads the
    // current data from the Query instance so we don't have to
    // self-reference `batch` inside its own useQuery options.
    // When `submitted` flips or the polled status leaves the
    // gate, the next observer tick sees the new value and
    // either arms or disarms the 2 s timer automatically.
    refetchInterval: (query) => {
      if (!submitted) return false;
      const status = query.state.data?.status;
      return isPendingGate(status) ? 2000 : false;
    },
  });

  const decisionMutation = useMutation({
    mutationFn: (payload: {
      decision: 'APPROVE' | 'REJECT';
      rejectionReason?: string;
    }) =>
      submitDecision(token, id!, {
        decision: payload.decision,
        // Whole-batch decisions have no per-document rejection set;
        // the API still requires the key to be present (empty
        // array is the agreed contract).
        rejectedDocumentIds: [],
        rejectionReason: payload.rejectionReason,
      }),
    onSuccess: () => {
      // Arm polling. Whether the POST itself returned a pending
      // or non-pending status, the invalidated refetch + the
      // navigate-on-leave-pending-gate effect handle the rest:
      //   - non-pending response: refetch → effect navigates.
      //   - pending response: poll continues until status changes.
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['batch', id] });
      setDecisionOpen(false);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        // The batch has already moved on — the user can no longer
        // act on it. Surface a toast, invalidate the queue cache so
        // the next visit shows the up-to-date state, and close the
        // dialog. We do NOT arm polling: the 409 itself means
        // the saga has already settled past our gate.
        toast.error('This batch has already moved on');
        queryClient.invalidateQueries({ queryKey: ['batches'] });
        setDecisionOpen(false);
        return;
      }
      if (err instanceof ApiError) {
        toast.error(`Failed to submit decision: ${err.message}`);
      } else {
        toast.error('Failed to submit decision');
      }
    },
  });

  // When a decision was submitted and the polled status has left
  // the pending gate, navigate back to the queue. The polling
  // interval is derived from the same `submitted` + `batch.status`
  // combination, so it switches off naturally on this same render.
  useEffect(() => {
    if (submitted && batch && !isPendingGate(batch.status)) {
      navigate('/queue');
    }
  }, [submitted, batch, navigate]);

  // 404: terminal "not found" page (no retry — the id is in the URL).
  if (
    isError &&
    error instanceof ApiError &&
    error.status === 404
  ) {
    return (
      <div
        className="mx-auto max-w-3xl px-4 py-6"
        data-testid="batch-not-found"
      >
        <h1 className="text-xl font-semibold">Batch not found</h1>
        <p className="text-muted-foreground text-sm">
          The batch you are looking for does not exist or has been
          removed.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="mx-auto max-w-3xl px-4 py-6"
        data-testid="batch-loading"
      >
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="mx-auto max-w-3xl px-4 py-6"
        data-testid="batch-error"
      >
        <p
          className="text-destructive text-sm"
          role="alert"
          data-testid="batch-error-message"
        >
          {error instanceof ApiError
            ? `Failed to load batch: ${error.message}`
            : 'Failed to load batch.'}
        </p>
      </div>
    );
  }

  if (!batch) {
    return null;
  }

  const canDecide = isPendingGate(batch.status);

  return (
    <div
      className="mx-auto max-w-5xl px-4 py-6 space-y-4"
      data-testid="batch-detail-page"
    >
      <AuditHeader batch={batch} />

      <div className="flex items-center gap-2">
        {canDecide ? (
          <Button
            type="button"
            onClick={() => setDecisionOpen(true)}
            data-testid="open-decision-dialog"
          >
            Approve or reject
          </Button>
        ) : null}
      </div>

      <div className="space-y-4">
        {batch.items.map((item) => (
          <BatchItem key={item.id} item={item} token={token} />
        ))}
      </div>

      {decisionOpen ? (
        <DecisionDialog
          onSubmit={(payload) => decisionMutation.mutate(payload)}
          pending={decisionMutation.isPending}
        />
      ) : null}
    </div>
  );
}

function AuditHeader({ batch }: { batch: BatchDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-3">
          <span>{batch.name}</span>
          <BatchStatusBadge status={batch.status} />
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
        <Field label="Created by" value={batch.createdBy} />
        <Field label="Created at" value={formatTimestamp(batch.createdAt)} />
        {batch.registrarApprovedBy ? (
          <Field
            label="Registrar approved by"
            value={formatApprover(
              batch.registrarApprovedBy,
              batch.registrarApprovedAt,
            )}
          />
        ) : null}
        {batch.deanApprovedBy ? (
          <Field
            label="Dean approved by"
            value={formatApprover(
              batch.deanApprovedBy,
              batch.deanApprovedAt,
            )}
          />
        ) : null}
        {batch.completedAt ? (
          <Field
            label="Completed at"
            value={formatTimestamp(batch.completedAt)}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function BatchItem({
  item,
  token,
}: {
  item: TranscriptItemSummary;
  token: string | undefined;
}) {
  const { data: xml, isLoading, isError } = useQuery({
    queryKey: ['xml', item.id],
    queryFn: () => getTranscriptXml(token, item.id),
    enabled: Boolean(item.id),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Transcript {item.id}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p
            className="text-muted-foreground text-sm"
            data-testid="transcript-loading"
          >
            Loading transcript…
          </p>
        ) : isError ? (
          <p
            className="text-destructive text-sm"
            role="alert"
            data-testid="transcript-error"
          >
            Failed to load transcript.
          </p>
        ) : xml !== undefined ? (
          <TranscriptView xml={xml} />
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Format an ISO 8601 timestamp as a short, locale-aware string. */
function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

/** Render an approver as `"name · timestamp"` when both are set. */
function formatApprover(name: string, at?: string): string {
  if (!at) return name;
  return `${name} · ${formatTimestamp(at)}`;
}
