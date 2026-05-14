import Keycloak from 'keycloak-js';

const fallbackKeycloakUrl = window.location.hostname.endsWith('fleet.local')
  ? 'http://keycloak.fleet.local'
  : 'http://localhost:8080';

const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL ?? fallbackKeycloakUrl,
  realm: import.meta.env.VITE_KEYCLOAK_REALM ?? 'flotte-management',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? 'flotte-frontend',
});

let _initPromise: Promise<boolean> | null = null;

export function initKeycloak(): Promise<boolean> {
  if (!_initPromise) {
    _initPromise = keycloak.init({
      // Evite les iframes silent-check-sso et PKCE en HTTP.
      onLoad: 'login-required',
      //silentCheckSsoRedirectUri: undefined,
      pkceMethod: "S256",
      checkLoginIframe: false,
    });
  }
  return _initPromise;
}

export default keycloak;
