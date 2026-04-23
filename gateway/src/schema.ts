import { gql } from 'graphql-tag';

export const typeDefs = gql`
  # ── Scalars ────────────────────────────────────────────────────────────────

  scalar JSON

  # ── Enums ──────────────────────────────────────────────────────────────────

  enum StatutVehicule {
    DISPONIBLE
    EN_MISSION
    EN_MAINTENANCE
    HORS_SERVICE
    RETIRE
  }

  enum StatutConducteur {
    ACTIF
    EN_MISSION
    EN_CONGE
    SUSPENDU
    INACTIF
  }

  enum StatutMission {
    PLANIFIEE
    EN_COURS
    TERMINEE
    ANNULEE
    EN_PAUSE
  }

  enum StatutMaintenance {
    PLANIFIEE
    EN_COURS
    TERMINEE
    ANNULEE
  }

  enum TypeCarburant {
    ESSENCE
    DIESEL
    ELECTRIQUE
    HYBRIDE
    GPL
  }

  enum TypeMaintenance {
    PREVENTIVE
    CORRECTIVE
    URGENCE
    REVISION
  }

  enum TypeAlerte {
    GEOFENCE
    MAINTENANCE
    VEHICULE
    MISSION
    SYSTEME
  }

  # ── Vehicle types ──────────────────────────────────────────────────────────

  type Vehicule {
    id: ID!
    immatriculation: String!
    marque: String
    modele: String
    annee: Int
    typeVehicule: String
    typeCarburant: TypeCarburant
    statut: StatutVehicule!
    kilometrage: Float
    capaciteCharge: Float
    consommationMoyenne: Float
    notes: String
    dateCreation: String
    dateModification: String
    # Resolved cross-service
    conducteurActuel: Conducteur
    missionEnCours: Mission
    maintenances: [Maintenance]
  }

  type HistoriqueStatut {
    id: ID!
    vehiculeId: ID!
    statutAvant: StatutVehicule
    statutApres: StatutVehicule!
    motif: String
    modifiePar: ID
    dateChangement: String!
  }

  # ── Driver types ───────────────────────────────────────────────────────────

  type Conducteur {
    id: ID!
    nom: String!
    prenom: String!
    email: String
    telephone: String
    statut: StatutConducteur!
    dateEmbauche: String
    dateCreation: String
    dateModification: String
  }

  # ── Mission types ──────────────────────────────────────────────────────────

  type Mission {
    id: ID!
    titre: String!
    description: String
    statut: StatutMission!
    vehiculeId: ID
    conducteurId: ID
    dateDebut: String
    dateFin: String
    adresseDepart: String
    adresseDestination: String
    dateCreation: String
    dateModification: String
    # Resolved fields
    vehicule: Vehicule
    conducteur: Conducteur
  }

  # ── Maintenance types ──────────────────────────────────────────────────────

  type Maintenance {
    id: ID!
    vehiculeId: ID!
    typeMaintenance: TypeMaintenance!
    statut: StatutMaintenance!
    description: String
    dateDebut: String
    dateFin: String
    kilometrageIntervention: Float
    cout: Float
    technicien: String
    notes: String
    dateCreation: String
    dateModification: String
  }

  # ── Position types ─────────────────────────────────────────────────────────

  type Position {
    vehiculeId: ID!
    latitude: Float!
    longitude: Float!
    vitesse: Float
    cap: Float
    precision: Float
    time: String!
  }

  # ── Dashboard types ────────────────────────────────────────────────────────

  type DashboardStats {
    totalVehicules: Int!
    vehiculesDisponibles: Int!
    vehiculesEnMission: Int!
    vehiculesEnMaintenance: Int!
    vehiculesHorsService: Int!
    totalConducteurs: Int!
    conducteursActifs: Int!
    conducteursEnMission: Int!
    missionsEnCours: Int!
    maintenancesEnCours: Int!
  }

  # ── Input types ────────────────────────────────────────────────────────────

  input CreateVehiculeInput {
    immatriculation: String!
    marque: String!
    modele: String!
    annee: Int!
    typeCarburant: TypeCarburant!
    typeVehicule: String
    kilometrage: Float
    capaciteCharge: Float
    consommationMoyenne: Float
    notes: String
  }

  input UpdateVehiculeInput {
    marque: String
    modele: String
    annee: Int
    typeVehicule: String
    kilometrage: Float
    capaciteCharge: Float
    consommationMoyenne: Float
    notes: String
  }

  input ChangeStatutVehiculeInput {
    statut: StatutVehicule!
    motif: String
  }

  input CreateConducteurInput {
    nom: String!
    prenom: String!
    email: String
    telephone: String
    dateEmbauche: String
  }

  input UpdateConducteurInput {
    nom: String
    prenom: String
    email: String
    telephone: String
    dateEmbauche: String
  }

  input CreateMissionInput {
    titre: String!
    description: String
    vehiculeId: ID!
    conducteurId: ID!
    dateDebut: String!
    dateFin: String!
    adresseDepart: String!
    adresseDestination: String!
    distanceEstimeeKm: Float
    notes: String
  }

  input ChangeStatutMissionInput {
    statut: StatutMission!
    motif: String
  }

  input CreateMaintenanceInput {
    vehiculeId: ID!
    typeMaintenance: TypeMaintenance!
    description: String
    dateDebut: String
    dateFin: String
    kilometrageIntervention: Float
    cout: Float
    technicien: String
    notes: String
  }

  input UpdateMaintenanceInput {
    typeMaintenance: TypeMaintenance
    description: String
    dateDebut: String
    dateFin: String
    kilometrageIntervention: Float
    cout: Float
    technicien: String
    notes: String
  }

  input IngestPositionInput {
    vehiculeId: ID!
    latitude: Float!
    longitude: Float!
    vitesse: Float
    cap: Float
    precision: Float
    correlationId: String
  }

  # ── Subscription event types ───────────────────────────────────────────────

  type VehiculeStatutChangeEvent {
    vehiculeId: ID!
    statutAvant: StatutVehicule
    statutApres: StatutVehicule!
    motif: String
    timestamp: String
  }

  type PositionVehiculeEvent {
    vehiculeId: ID!
    latitude: Float!
    longitude: Float!
    vitesse: Float
    cap: Float
    time: String
  }

  type AlerteEvent {
    type: TypeAlerte!
    vehiculeId: ID
    zoneId: String
    zoneNom: String
    typeAlerte: String
    message: String!
    timestamp: String
  }

  type MissionEventPayload {
    eventType: String!
    missionId: ID
    vehiculeId: ID
    conducteurId: ID
    timestamp: String
  }

  # ── Root types ─────────────────────────────────────────────────────────────

  type Query {
    # Vehicles
    vehicules(statut: StatutVehicule, page: Int, limit: Int): [Vehicule!]!
    vehicule(id: ID!): Vehicule
    historiqueStatutVehicule(id: ID!): [HistoriqueStatut!]!

    # Drivers
    conducteurs(statut: StatutConducteur, page: Int, limit: Int): [Conducteur!]!
    conducteur(id: ID!): Conducteur

    # Missions
    missions(statut: StatutMission, vehiculeId: ID, conducteurId: ID, page: Int, limit: Int): [Mission!]!
    mission(id: ID!): Mission

    # Maintenance
    maintenances(vehiculeId: ID, statut: StatutMaintenance, page: Int, limit: Int): [Maintenance!]!
    maintenance(id: ID!): Maintenance
    maintenancesVehicule(vehiculeId: ID!): [Maintenance!]!

    # Location
    positionActuelle(vehiculeId: ID!): Position
    historiquePositions(vehiculeId: ID!, debut: String, fin: String, limit: Int): [Position!]!

    # Dashboard
    dashboardFlotte: DashboardStats!
  }

  type Mutation {
    # Vehicles
    creerVehicule(input: CreateVehiculeInput!): Vehicule!
    modifierVehicule(id: ID!, input: UpdateVehiculeInput!): Vehicule!
    changerStatutVehicule(id: ID!, input: ChangeStatutVehiculeInput!): Vehicule!
    supprimerVehicule(id: ID!): Boolean!

    # Drivers
    creerConducteur(input: CreateConducteurInput!): Conducteur!
    modifierConducteur(id: ID!, input: UpdateConducteurInput!): Conducteur!
    changerStatutConducteur(id: ID!, statut: StatutConducteur!): Conducteur!
    supprimerConducteur(id: ID!): Boolean!
    assignerVehicule(conducteurId: ID!, vehiculeId: ID!): Boolean!
    libererVehicule(conducteurId: ID!): Boolean!

    # Missions
    creerMission(input: CreateMissionInput!): Mission!
    changerStatutMission(id: ID!, input: ChangeStatutMissionInput!): Mission!
    supprimerMission(id: ID!): Boolean!

    # Maintenance
    creerMaintenance(input: CreateMaintenanceInput!): Maintenance!
    modifierMaintenance(id: ID!, input: UpdateMaintenanceInput!): Maintenance!
    changerStatutMaintenance(id: ID!, statut: StatutMaintenance!): Maintenance!
    supprimerMaintenance(id: ID!): Boolean!

    # Location
    ingestPosition(input: IngestPositionInput!): Position!
  }

  type Subscription {
    """ Real-time vehicle status changes (Saga events included) """
    vehiculeStatutChange(vehiculeId: ID): VehiculeStatutChangeEvent!

    """ Real-time GPS position updates for a vehicle """
    positionVehicule(vehiculeId: ID!): PositionVehiculeEvent!

    """ All alerts: geofence, maintenance, system """
    nouvelleAlerte(vehiculeId: ID): AlerteEvent!

    """ Mission lifecycle events """
    missionEvent(missionId: ID): MissionEventPayload!
  }
`;
