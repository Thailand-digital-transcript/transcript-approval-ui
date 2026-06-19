import { Badge } from '@/components/ui/badge';
import type { BatchStatus } from '@/types/batch';

/**
 * Map a `BatchStatus` to a shadcn `Badge` variant. The status names are
 * derived from the orchestrator's saga step enum (B3); the visual mapping
 * follows the queue-page convention from the B10 design (green = done,
 * blue = registrar/ dean queue, amber = mid-saga, red = failed/cancelled).
 */
function variantFor(status: BatchStatus): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'COMPLETED':
      return 'default';
    case 'PENDING_REGISTRAR':
    case 'PENDING_DEAN':
      return 'secondary';
    case 'CANCELLED':
    case 'FAILED':
      return 'destructive';
    case 'DRAFT':
    case 'REGISTRAR_SIGNING':
    case 'DEAN_SIGNING':
    case 'SEALING':
    case 'PDF_GENERATION':
    case 'PDF_SIGNING':
      return 'outline';
    default:
      return 'outline';
  }
}

/** Human-readable label for a `BatchStatus` (e.g. `PENDING_REGISTRAR` → `Pending registrar`). */
function labelFor(status: BatchStatus): string {
  return status
    .toLowerCase()
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

export interface BatchStatusBadgeProps {
  status: BatchStatus;
  /** Optional className forwarded to the underlying Badge. */
  className?: string;
}

/**
 * Small companion to `TranscriptView` (B6). Renders a `BatchStatus` as a
 * shadcn `Badge` with a status-appropriate variant. Used by the queue page
 * (B7) and the batch detail page (B10).
 */
export function BatchStatusBadge({ status, className }: BatchStatusBadgeProps) {
  return (
    <Badge variant={variantFor(status)} className={className}>
      {labelFor(status)}
    </Badge>
  );
}
