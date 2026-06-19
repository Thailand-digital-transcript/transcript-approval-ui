import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthGuard } from './auth/AuthGuard';
import { ErrorToast } from './components/ErrorToast';
import { AppNav } from './components/AppNav';
import { QueuePage } from './pages/QueuePage';
import { BatchDetailPage } from './pages/BatchDetailPage';

/**
 * App shell — wires AuthGuard, the global toast surface, the top nav,
 * and the three Phase B routes:
 *
 * - `/queue`        → B9 (`QueuePage`)
 * - `/batches/:id`  → B10 (`BatchDetailPage`)
 * - `/monitor`      → B11 (`MonitorPage`, not yet implemented)
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
            <Route path="/queue" element={<QueuePage />} />
            <Route path="/batches/:id" element={<BatchDetailPage />} />
            <Route path="/monitor" element={<MonitorPlaceholder />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </AuthGuard>
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
