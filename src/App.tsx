import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthGuard } from './auth/AuthGuard';
import { ErrorToast } from './components/ErrorToast';
import { AppNav } from './components/AppNav';
import { QueuePage } from './pages/QueuePage';
import { BatchDetailPage } from './pages/BatchDetailPage';
import { MonitorPage } from './pages/MonitorPage';

/**
 * App shell — wires AuthGuard, the global toast surface, the top nav,
 * and the Phase B routes:
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
            <Route path="/queue" element={<QueuePage />} />
            <Route path="/batches/:id" element={<BatchDetailPage />} />
            <Route path="/monitor" element={<MonitorPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </AuthGuard>
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
