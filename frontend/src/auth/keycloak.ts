import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL ?? 'http://localhost:8080',
  realm: import.meta.env.VITE_KEYCLOAK_REALM ?? 'flotte-management',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? 'flotte-frontend',
});

let _initPromise: Promise<boolean> | null = null;

export function initKeycloak(): Promise<boolean> {
  if (!_initPromise) {
    _initPromise = keycloak.init({
      onLoad: 'check-sso',
      silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
      pkceMethod: 'S256',
      checkLoginIframe: false,
    });
  }
  return _initPromise;
}

export default keycloak;
