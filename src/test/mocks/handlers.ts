import { http, HttpResponse } from 'msw';

// Default handlers: empty. Individual tests register their own via `server.use(...)`
// so each test is self-contained and does not depend on shared fixture state.
export const handlers: ReturnType<typeof http.get>[] = [];

// Re-export common MSW building blocks so test files can build per-test handlers
// without a second `msw` import.
export { http, HttpResponse };
