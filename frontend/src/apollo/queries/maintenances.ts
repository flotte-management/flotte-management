import { gql } from '@apollo/client';

export const MAINTENANCES_QUERY = gql`
  query Maintenances($vehiculeId: ID, $statut: StatutMaintenance, $page: Int, $limit: Int) {
    maintenances(vehiculeId: $vehiculeId, statut: $statut, page: $page, limit: $limit) {
      id
      vehiculeId
      typeMaintenance
      statut
      description
      dateDebut
      dateFin
      cout
      technicien
      dateCreation
    }
  }
`;

export const MAINTENANCE_QUERY = gql`
  query Maintenance($id: ID!) {
    maintenance(id: $id) {
      id
      vehiculeId
      typeMaintenance
      statut
      description
      dateDebut
      dateFin
      kilometrageIntervention
      cout
      technicien
      notes
      dateCreation
      dateModification
    }
  }
`;

export const CREER_MAINTENANCE = gql`
  mutation CreerMaintenance($input: CreateMaintenanceInput!) {
    creerMaintenance(input: $input) {
      id
      typeMaintenance
      statut
    }
  }
`;

export const MODIFIER_MAINTENANCE = gql`
  mutation ModifierMaintenance($id: ID!, $input: UpdateMaintenanceInput!) {
    modifierMaintenance(id: $id, input: $input) {
      id
      statut
    }
  }
`;

export const CHANGER_STATUT_MAINTENANCE = gql`
  mutation ChangerStatutMaintenance($id: ID!, $statut: StatutMaintenance!) {
    changerStatutMaintenance(id: $id, statut: $statut) {
      id
      statut
    }
  }
`;

export const SUPPRIMER_MAINTENANCE = gql`
  mutation SupprimerMaintenance($id: ID!) {
    supprimerMaintenance(id: $id)
  }
`;
