import { Toaster } from '@/components/ui/sonner';

/**
 * Mounts the global sonner toast surface.
 *
 * In B8 this is just the `<Toaster />` shell — the full query/mutation
 * error pipeline (the `useApiErrorToast` hook in the reference) lands
 * with the first page that surfaces API errors (B9 for the queue, B10
 * for the detail page). The `Toaster` is mounted at the SPA root so
 * any feature can `toast.error(...)` from `@/api` callers without
 * having to render its own surface.
 */
export function ErrorToast() {
  return <Toaster richColors position="top-right" />;
}
