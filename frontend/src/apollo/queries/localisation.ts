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
