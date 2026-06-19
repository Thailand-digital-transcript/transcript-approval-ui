import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthGuard } from './auth/AuthGuard';
import { ErrorToast } from './components/ErrorToast';
import { AppNav } from './components/AppNav';

/**
 * App shell — wires AuthGuard, the global toast surface, the top nav,
 * and the three B8 routes. The three pages are lightweight
 * placeholders for now; B9/B10/B11 replace them in turn:
 *
 * - `/queue`        → B9 (`QueuePage`)
 * - `/batches/:id`  → B10 (`BatchDetailPage`)
 * - `/monitor`      → B11 (`MonitorPage`)
 */
export function App() {
  return (
    <AuthGuard>
      <ErrorToast />
      <div className="min-h-screen bg-background">
        <AppNav />
        <main>
          <Routes>
            <Route path="/" element={<Navigate to="/queue" replace />} />
            <Route path="/queue" element={<QueuePlaceholder />} />
            <Route path="/batches/:id" element={<BatchDetailPlaceholder />} />
            <Route path="/monitor" element={<MonitorPlaceholder />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </AuthGuard>
  );
}

function QueuePlaceholder() {
  return (
    <div
      data-testid="queue-placeholder"
      className="flex h-64 items-center justify-center text-muted-foreground"
    >
      Queue (placeholder)
    </div>
  );
}

function BatchDetailPlaceholder() {
  const { id } = useParams<{ id: string }>();
  return (
    <div
      data-testid="batch-detail-placeholder"
      className="flex h-64 items-center justify-center text-muted-foreground"
    >
      Batch detail (placeholder){id ? ` — ${id}` : ''}
    </div>
  );
}

function MonitorPlaceholder() {
  return (
    <div
      data-testid="monitor-placeholder"
      className="flex h-64 items-center justify-center text-muted-foreground"
    >
      Monitor (placeholder)
    </div>
  );
}

function NotFound() {
  return (
    <div
      data-testid="not-found"
      className="flex h-64 items-center justify-center text-muted-foreground"
    >
      Page not found
    </div>
  );
}
