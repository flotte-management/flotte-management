import { gql } from '@apollo/client';

export const DASHBOARD_QUERY = gql`
  query Dashboard {
    dashboardFlotte {
      totalVehicules
      vehiculesDisponibles
      vehiculesEnMission
      vehiculesEnMaintenance
      vehiculesHorsService
      totalConducteurs
      conducteursActifs
      conducteursEnMission
      missionsEnCours
      maintenancesEnCours
    }
  }
`;

export const NOUVELLE_ALERTE_SUBSCRIPTION = gql`
  subscription NouvelleAlerte {
    nouvelleAlerte {
      type
      vehiculeId
      zoneNom
      message
      timestamp
    }
  }
`;
