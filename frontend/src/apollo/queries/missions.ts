import { gql } from '@apollo/client';

export const MISSIONS_QUERY = gql`
  query Missions($statut: StatutMission, $conducteurId: ID, $vehiculeId: ID, $page: Int, $limit: Int) {
    missions(statut: $statut, conducteurId: $conducteurId, vehiculeId: $vehiculeId, page: $page, limit: $limit) {
      id
      titre
      description
      statut
      vehiculeId
      conducteurId
      dateDebut
      dateFin
      dateCreation
      vehicule { id immatriculation marque }
      conducteur { id nom prenom }
    }
  }
`;

export const MISSION_QUERY = gql`
  query Mission($id: ID!) {
    mission(id: $id) {
      id
      titre
      description
      statut
      vehiculeId
      conducteurId
      dateDebut
      dateFin
      dateCreation
      dateModification
      vehicule { id immatriculation marque modele statut }
      conducteur { id nom prenom email statut }
    }
  }
`;

export const CREER_MISSION = gql`
  mutation CreerMission($input: CreateMissionInput!) {
    creerMission(input: $input) {
      id
      titre
      statut
    }
  }
`;

export const CHANGER_STATUT_MISSION = gql`
  mutation ChangerStatutMission($id: ID!, $input: ChangeStatutMissionInput!) {
    changerStatutMission(id: $id, input: $input) {
      id
      statut
    }
  }
`;

export const SUPPRIMER_MISSION = gql`
  mutation SupprimerMission($id: ID!) {
    supprimerMission(id: $id)
  }
`;

export const MISSION_EVENT_SUBSCRIPTION = gql`
  subscription MissionEvent($missionId: ID) {
    missionEvent(missionId: $missionId) {
      eventType
      missionId
      vehiculeId
      conducteurId
      timestamp
    }
  }
`;
