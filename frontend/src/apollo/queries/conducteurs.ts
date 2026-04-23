import { gql } from '@apollo/client';

export const CONDUCTEURS_QUERY = gql`
  query Conducteurs($statut: StatutConducteur, $page: Int, $limit: Int) {
    conducteurs(statut: $statut, page: $page, limit: $limit) {
      id
      nom
      prenom
      email
      telephone
      statut
      dateEmbauche
    }
  }
`;

export const CONDUCTEUR_QUERY = gql`
  query Conducteur($id: ID!) {
    conducteur(id: $id) {
      id
      nom
      prenom
      email
      telephone
      statut
      dateEmbauche
      dateCreation
      dateModification
    }
  }
`;

export const CREER_CONDUCTEUR = gql`
  mutation CreerConducteur($input: CreateConducteurInput!) {
    creerConducteur(input: $input) {
      id
      nom
      prenom
      statut
    }
  }
`;

export const MODIFIER_CONDUCTEUR = gql`
  mutation ModifierConducteur($id: ID!, $input: UpdateConducteurInput!) {
    modifierConducteur(id: $id, input: $input) {
      id
      nom
      prenom
      email
      telephone
    }
  }
`;

export const CHANGER_STATUT_CONDUCTEUR = gql`
  mutation ChangerStatutConducteur($id: ID!, $statut: StatutConducteur!) {
    changerStatutConducteur(id: $id, statut: $statut) {
      id
      statut
    }
  }
`;

export const SUPPRIMER_CONDUCTEUR = gql`
  mutation SupprimerConducteur($id: ID!) {
    supprimerConducteur(id: $id)
  }
`;
