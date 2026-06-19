import { type ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter, type InitialEntry } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, type AuthContextValue } from '@/auth/AuthContext';

/**
 * Default stub `AuthContextValue` for tests. Each test can override
 * individual fields (e.g. `roles`, `token`) via the `auth` option to
 * `renderWithProviders` rather than spinning up the full
 * `AuthProvider` (which would require stubbing `VITE_AUTH_DISABLED`
 * and `VITE_MOCK_ROLES` in `import.meta.env` and the surrounding
 * `vi.hoisted` block).
 */
const STUB_AUTH: AuthContextValue = {
  token: 'test-bearer-token',
  isAuthenticated: true,
  isLoading: false,
  roles: [],
  login: vi.fn(),
  logout: vi.fn(),
};

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface Options extends Omit<RenderOptions, 'wrapper'> {
  initialEntries?: InitialEntry[];
  auth?: Partial<AuthContextValue>;
}

/**
 * Render a component with the same provider tree as the production
 * app (`AuthContext → QueryClientProvider → MemoryRouter`), but
 * without booting Keycloak or reading `import.meta.env`. Mirrors the
 * pattern in `fee-engine-admin-ui/src/test/test-utils.tsx`.
 *
 * Returns the `queryClient` alongside the standard
 * `@testing-library/react` `render` result so tests can
 * `queryClient.invalidateQueries(...)` or assert cache state if
 * needed.
 */
export function renderWithProviders(
  ui: ReactElement,
  { initialEntries = ['/'], auth, ...renderOptions }: Options = {},
) {
  const queryClient = createTestQueryClient();

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <AuthContext.Provider value={{ ...STUB_AUTH, ...auth }}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={initialEntries}>
            {children}
          </MemoryRouter>
        </QueryClientProvider>
      </AuthContext.Provider>
    );
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}
