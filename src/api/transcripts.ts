import { ApiError } from './client';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

// Mirrors apiFetch's error handling but returns text/xml (the /content endpoint is
// application/xml, not JSON). On non-OK it throws ApiError so the global ErrorToast
// fires and BatchDetailPage can tell a 404/403 apart from a parse failure (spec §7).
export async function getTranscriptXml(token: string | undefined, itemId: string): Promise<string> {
  const res = await fetch(`${BASE}/api/v1/transcripts/${itemId}/content`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    let detail: unknown = {};
    try { detail = await res.json(); } catch { /* non-JSON error body */ }
    throw new ApiError(res.status, res.statusText, detail);
  }
  return res.text();
}
