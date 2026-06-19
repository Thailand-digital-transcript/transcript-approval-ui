import { vi } from 'vitest';

// Stub Vite env BEFORE AuthProvider module is imported. The module reads
// `import.meta.env.VITE_AUTH_DISABLED` and `VITE_MOCK_ROLES` at top level to
// build the initial mock state, so these must be set before the import.
vi.hoisted(() => {
  vi.stubEnv('VITE_AUTH_DISABLED', 'true');
  vi.stubEnv('VITE_MOCK_ROLES', 'registrar');
});

import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from './AuthProvider';
import { useAuth } from './useAuth';

function Probe() {
  const { isAuthenticated, roles } = useAuth();
  return <div>{isAuthenticated ? `in:${roles.join(',')}` : 'out'}</div>;
}

// With VITE_AUTH_DISABLED=true + VITE_MOCK_ROLES=registrar (set in test env),
// the provider authenticates with the mock role.
test('auth-disabled mode authenticates with mock roles', async () => {
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() =>
    expect(screen.getByText(/in:registrar/)).toBeInTheDocument(),
  );
});
