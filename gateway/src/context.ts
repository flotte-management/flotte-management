import { JwtPayload } from './auth.js';
import { Loaders } from './dataloaders.js';

export interface GatewayContext {
  /** Raw Bearer token forwarded to upstream services */
  token?: string;
  /** Decoded Keycloak JWT (null if unauthenticated) */
  user: JwtPayload | null;
  /** Per-request DataLoaders */
  loaders: Loaders;
}
