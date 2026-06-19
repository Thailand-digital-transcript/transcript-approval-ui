import { expect, test, vi } from 'vitest';

// The guard at the top of AuthProvider.tsx reads
// `import.meta.env.VITE_AUTH_DISABLED` and `import.meta.env.PROD` at
// module load and throws if both are truthy. Vitest's runtime
// `import.meta.env` is sourced from `test.env` in the project config
// (see vitest.config.prod-guard.ts), so this test relies on:
//
//   - `env.PROD === true`               (set in the config)
//   - `env.VITE_AUTH_DISABLED === 'true'` (set in the config)
//
// `vi.hoisted` is kept for belt-and-braces in case a future refactor
// moves the env stub out of the project config.
vi.hoisted(() => {
  vi.stubEnv('VITE_AUTH_DISABLED', 'true');
});

// Importing the module in production mode with VITE_AUTH_DISABLED=true
// must throw at module load. Use dynamic import so the env stubs above
// run first.
test('module throws when VITE_AUTH_DISABLED is set in production', async () => {
  await expect(import('./AuthProvider')).rejects.toThrow(
    /VITE_AUTH_DISABLED must not be set in production builds/,
  );
});
