import { defineConfig } from 'vitest/config';

// A separate Vitest project that exercises the AuthProvider PROD guard
// throw path.
//
// Background: Vitest's runtime `import.meta.env` is controlled by
// `config.env` (see vitest setup-common → setupEnv). `mode: 'production'`
// and `define: { 'import.meta.env.PROD': 'true', ... }` do NOT work
// because Vitest's worker installs its own metaEnv object that
// overrides the transformed Vite values. The only reliable way to
// force `import.meta.env.PROD === true` and a specific
// `import.meta.env.VITE_AUTH_DISABLED` value is via `test.env`.
export default defineConfig({
  test: {
    name: 'prod-guard',
    environment: 'jsdom',
    env: {
      PROD: true,
      DEV: false,
      VITE_AUTH_DISABLED: 'true',
    },
    include: ['src/auth/AuthProvider.prod-guard.test.ts'],
    // No setupFiles: the prod-guard test does not need msw or jest-dom,
    // and importing the test/setup module would pull in additional
    // modules (e.g. AuthProvider's transitive imports) under PROD mode,
    // which is exactly the surface we are trying to assert against.
  },
});
