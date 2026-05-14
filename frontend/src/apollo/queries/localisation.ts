import { gql } from '@apollo/client';

export const POSITION_ACTUELLE_QUERY = gql`
  query PositionActuelle($vehiculeId: ID!) {
    positionActuelle(vehiculeId: $vehiculeId) {
      vehiculeId
      latitude
      longitude
      vitesse
      cap
      time
    }
  }
`;

export const HISTORIQUE_POSITIONS_QUERY = gql`
  query HistoriquePositions($vehiculeId: ID!, $debut: String, $fin: String, $limit: Int) {
    historiquePositions(vehiculeId: $vehiculeId, debut: $debut, fin: $fin, limit: $limit) {
      vehiculeId
      latitude
      longitude
      vitesse
      time
    }
  }
`;

export const INGEST_POSITION_MUTATION = gql`
  mutation IngestPosition($input: IngestPositionInput!) {
    ingestPosition(input: $input) {
      vehiculeId
      latitude
      longitude
      vitesse
      cap
      precision
      time
    }
  }
`;
