import { ApolloClient, InMemoryCache, HttpLink, split } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { setContext } from '@apollo/client/link/context';
import { createClient } from 'graphql-ws';
import keycloak from '../auth/keycloak';

const GRAPHQL_URL = import.meta.env.VITE_GRAPHQL_URL ?? 'http://localhost:4000/graphql';
const GRAPHQL_WS_URL = import.meta.env.VITE_GRAPHQL_WS_URL ?? 'ws://localhost:4000/graphql';

const httpLink = new HttpLink({ uri: GRAPHQL_URL });

const authLink = setContext(async (_, { headers }) => {
  if (keycloak.isTokenExpired(30)) {
    try { await keycloak.updateToken(60); } catch { /* logout handled elsewhere */ }
  }
  const token = keycloak.token;
  return {
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
});

const wsLink = new GraphQLWsLink(
  createClient({
    url: GRAPHQL_WS_URL,
    connectionParams: async () => {
      if (keycloak.isTokenExpired(30)) {
        try { await keycloak.updateToken(60); } catch { /* ignore */ }
      }
      return keycloak.token ? { Authorization: `Bearer ${keycloak.token}` } : {};
    },
  }),
);

const splitLink = split(
  ({ query }) => {
    const def = getMainDefinition(query);
    return def.kind === 'OperationDefinition' && def.operation === 'subscription';
  },
  wsLink,
  authLink.concat(httpLink),
);

export const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: { errorPolicy: 'all' },
    query: { errorPolicy: 'all' },
  },
});
