import { useNavigate } from 'react-router-dom';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { BatchStatusBadge } from '@/components/BatchStatusBadge';
import type { BatchSummary } from '@/types/batch';

export interface QueueTableProps {
  /** Batches to render. Empty array renders an empty body (no rows). */
  batches: BatchSummary[];
  /** Optional className forwarded to the root table element. */
  className?: string;
}

/**
 * Render the registrar/dean queue. Each row is keyboard- and
 * click-navigable to `/batches/:id`. Uses shadcn `Table` primitives
 * (B1) and the `BatchStatusBadge` (B6) for the status column.
 *
 * The row's `role="button"` + `tabIndex={0}` + `onKeyDown` pair makes
 * each row reachable via Tab and activatable with Enter/Space — same
 * a11y contract as a `<button>` without nesting interactive elements
 * inside `<tr>` (which is invalid HTML).
 */
export function QueueTable({ batches, className }: QueueTableProps) {
  const navigate = useNavigate();

  const openBatch = (id: string) => {
    navigate(`/batches/${id}`);
  };

  const handleRowKey = (e: React.KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openBatch(id);
    }
  };

  if (batches.length === 0) {
    return (
      <Table className={className}>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Items</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
              No batches in this queue.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }

  return (
    <Table className={className}>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Items</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {batches.map((b) => (
          <TableRow
            key={b.id}
            role="button"
            tabIndex={0}
            onClick={() => openBatch(b.id)}
            onKeyDown={(e) => handleRowKey(e, b.id)}
            aria-label={`Open batch ${b.name}`}
            className="cursor-pointer"
          >
            <TableCell className="font-medium">{b.name}</TableCell>
            <TableCell>
              <BatchStatusBadge status={b.status} />
            </TableCell>
            <TableCell className="text-right tabular-nums">{b.itemCount}</TableCell>
            <TableCell>{formatCreatedAt(b.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * Format an ISO 8601 timestamp as a short, locale-aware string.
 * Returns the input unchanged when it cannot be parsed so we never
 * crash the table on a malformed backend payload.
 */
function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}
