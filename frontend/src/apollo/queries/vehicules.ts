import { gql } from '@apollo/client';

export const VEHICULES_QUERY = gql`
  query Vehicules($statut: StatutVehicule, $page: Int, $limit: Int) {
    vehicules(statut: $statut, page: $page, limit: $limit) {
      id
      immatriculation
      marque
      modele
      annee
      typeVehicule
      statut
      kilometrage
      dateCreation
      conducteurActuel { id nom prenom }
      missionEnCours { id titre statut }
    }
  }
`;

export const VEHICULE_QUERY = gql`
  query Vehicule($id: ID!) {
    vehicule(id: $id) {
      id
      immatriculation
      marque
      modele
      annee
      typeVehicule
      statut
      kilometrage
      capaciteCharge
      consommationMoyenne
      notes
      dateCreation
      dateModification
      conducteurActuel { id nom prenom email statut }
      missionEnCours { id titre statut dateDebut dateFin }
      maintenances { id typeMaintenance statut dateDebut dateFin cout }
    }
  }
`;

export const HISTORIQUE_STATUT_QUERY = gql`
  query HistoriqueStatut($id: ID!) {
    historiqueStatutVehicule(id: $id) {
      id
      statutAvant
      statutApres
      motif
      dateChangement
    }
  }
`;

export const CREER_VEHICULE = gql`
  mutation CreerVehicule($input: CreateVehiculeInput!) {
    creerVehicule(input: $input) {
      id
      immatriculation
      marque
      statut
    }
  }
`;

export const MODIFIER_VEHICULE = gql`
  mutation ModifierVehicule($id: ID!, $input: UpdateVehiculeInput!) {
    modifierVehicule(id: $id, input: $input) {
      id
      immatriculation
      marque
      modele
      statut
    }
  }
`;

export const CHANGER_STATUT_VEHICULE = gql`
  mutation ChangerStatutVehicule($id: ID!, $input: ChangeStatutVehiculeInput!) {
    changerStatutVehicule(id: $id, input: $input) {
      id
      statut
    }
  }
`;

export const SUPPRIMER_VEHICULE = gql`
  mutation SupprimerVehicule($id: ID!) {
    supprimerVehicule(id: $id)
  }
`;

export const ASSIGNER_VEHICULE = gql`
  mutation AssignerVehicule($conducteurId: ID!, $vehiculeId: ID!) {
    assignerVehicule(conducteurId: $conducteurId, vehiculeId: $vehiculeId)
  }
`;

export const LIBERER_VEHICULE = gql`
  mutation LibererVehicule($conducteurId: ID!) {
    libererVehicule(conducteurId: $conducteurId)
  }
`;

export const POSITION_VEHICULE_SUBSCRIPTION = gql`
  subscription PositionVehicule($vehiculeId: ID!) {
    positionVehicule(vehiculeId: $vehiculeId) {
      vehiculeId
      latitude
      longitude
      vitesse
      cap
      time
    }
  }
`;

export const VEHICULE_STATUT_SUBSCRIPTION = gql`
  subscription VehiculeStatutChange($vehiculeId: ID) {
    vehiculeStatutChange(vehiculeId: $vehiculeId) {
      vehiculeId
      statutAvant
      statutApres
      motif
      timestamp
    }
  }
`;
