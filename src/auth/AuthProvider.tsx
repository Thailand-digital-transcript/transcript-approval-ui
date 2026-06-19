// PROD guard: a misconfigured production build must hard-fail at module load,
// not silently bypass auth. This must run before any other module code, so
// keep it at the top of the file (no hoisted imports above it).
if (
  import.meta.env.VITE_AUTH_DISABLED === 'true' &&
  import.meta.env.PROD
) {
  throw new Error('VITE_AUTH_DISABLED must not be set in production builds');
}

import { useEffect, useRef, useState } from 'react';
import Keycloak from 'keycloak-js';
import { AuthContext, type AuthContextValue } from './AuthContext';

const authDisabled = import.meta.env.VITE_AUTH_DISABLED === 'true';

const keycloak = !authDisabled
  ? new Keycloak({
      url: import.meta.env.VITE_KEYCLOAK_URL,
      realm: import.meta.env.VITE_KEYCLOAK_REALM,
      clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
    })
  : null;

const mockRoles = (import.meta.env.VITE_MOCK_ROLES ?? '')
  .split(',')
  .map((r: string) => r.trim())
  .filter(Boolean);

const mockInstitution = import.meta.env.VITE_MOCK_INSTITUTION || undefined;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<
    Omit<AuthContextValue, 'login' | 'logout'>
  >({
    token: authDisabled ? 'dev-mock-token' : undefined,
    isAuthenticated: authDisabled,
    isLoading: !authDisabled,
    roles: authDisabled ? mockRoles : [],
    institutionCode: authDisabled ? mockInstitution : undefined,
  });
  const initialised = useRef(false);

  useEffect(() => {
    if (authDisabled || initialised.current) return;
    initialised.current = true;

    keycloak!
      .init({
        onLoad: 'check-sso',
        silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
        pkceMethod: 'S256',
      })
      .then((authenticated) => {
        const tokenParsed = keycloak!.tokenParsed;
        setState({
          token: keycloak!.token,
          isAuthenticated: authenticated,
          isLoading: false,
          roles: tokenParsed?.realm_access?.roles ?? [],
          institutionCode: tokenParsed?.institution_code,
        });
      })
      .catch(() => {
        setState({
          token: undefined,
          isAuthenticated: false,
          isLoading: false,
          roles: [],
          institutionCode: undefined,
        });
      });

    keycloak!.onTokenExpired = () => {
      keycloak!.updateToken(30)
        .then(() =>
          setState((prev) => ({ ...prev, token: keycloak!.token })),
        )
        .catch(() =>
          setState({
            token: undefined,
            isAuthenticated: false,
            isLoading: false,
            roles: [],
            institutionCode: undefined,
          }),
        );
    };
  }, []);

  const value: AuthContextValue = {
    ...state,
    login: () => (authDisabled ? undefined : keycloak!.login()),
    logout: () => (authDisabled ? undefined : keycloak!.logout()),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
