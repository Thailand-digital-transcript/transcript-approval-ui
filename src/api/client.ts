export class ApiError extends Error {
  readonly status: number;
  readonly problemDetail: unknown;

  constructor(status: number, message: string, problemDetail: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.problemDetail = problemDetail;
  }
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export async function apiFetch<T>(
  path: string,
  token: string | undefined,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let detail: unknown = {};
    try { detail = await res.json(); } catch { /* non-JSON error body */ }
    const message =
      typeof detail === 'object' && detail !== null && 'detail' in detail
        ? String((detail as { detail: unknown }).detail)
        : res.statusText;
    throw new ApiError(res.status, message, detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
