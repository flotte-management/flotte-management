export type StatutVehicule = 'DISPONIBLE' | 'EN_MISSION' | 'EN_MAINTENANCE' | 'HORS_SERVICE' | 'RETIRE';
export type StatutConducteur = 'ACTIF' | 'EN_MISSION' | 'EN_CONGE' | 'SUSPENDU' | 'INACTIF';
export type StatutMission = 'PLANIFIEE' | 'EN_COURS' | 'TERMINEE' | 'ANNULEE' | 'EN_PAUSE' | 'SUSPENDUE';
export type StatutMaintenance = 'PLANIFIEE' | 'EN_COURS' | 'TERMINEE' | 'ANNULEE';
export type TypeMaintenance = 'PREVENTIVE' | 'CORRECTIVE' | 'CURATIVE' | 'URGENCE' | 'REVISION' | 'CONTROLE_TECHNIQUE' | 'AUTRE';
export type TypeAlerte = 'GEOFENCE' | 'MAINTENANCE' | 'VEHICULE' | 'MISSION' | 'SYSTEME';

export interface Vehicule {
  id: string;
  immatriculation: string;
  marque?: string;
  modele?: string;
  annee?: number;
  typeVehicule?: string;
  statut: StatutVehicule;
  kilometrage?: number;
  capaciteCharge?: number;
  consommationMoyenne?: number;
  notes?: string;
  dateCreation?: string;
  dateModification?: string;
  conducteurActuel?: Conducteur | null;
  missionEnCours?: Mission | null;
  maintenances?: Maintenance[];
}

export interface Conducteur {
  id: string;
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  statut: StatutConducteur;
  dateEmbauche?: string;
  dateCreation?: string;
  dateModification?: string;
}

export interface Mission {
  id: string;
  titre: string;
  description?: string;
  statut: StatutMission;
  vehiculeId?: string;
  conducteurId?: string;
  adresseDepart?: string;
  adresseDestination?: string;
  dateDebut?: string;
  dateFin?: string;
  dateCreation?: string;
  dateModification?: string;
  vehicule?: Vehicule | null;
  conducteur?: Conducteur | null;
}

export interface Maintenance {
  id: string;
  vehiculeId: string;
  typeMaintenance: TypeMaintenance;
  statut: StatutMaintenance;
  description?: string;
  dateDebut?: string;
  dateFin?: string;
  kilometrageIntervention?: number;
  cout?: number;
  technicien?: string;
  prestataire?: string;
  notes?: string;
  dateCreation?: string;
  dateModification?: string;
}

export interface Position {
  vehiculeId: string;
  latitude: number;
  longitude: number;
  vitesse?: number;
  cap?: number;
  precision?: number;
  time: string;
}

export interface DashboardStats {
  totalVehicules: number;
  vehiculesDisponibles: number;
  vehiculesEnMission: number;
  vehiculesEnMaintenance: number;
  vehiculesHorsService: number;
  totalConducteurs: number;
  conducteursActifs: number;
  conducteursEnMission: number;
  missionsEnCours: number;
  maintenancesEnCours: number;
}

export interface AlerteEvent {
  type: TypeAlerte;
  vehiculeId?: string;
  zoneId?: string;
  zoneNom?: string;
  typeAlerte?: string;
  message: string;
  timestamp?: string;
}

export type UserRole = 'ADMIN' | 'MANAGER' | 'TECHNICIEN' | 'UTILISATEUR' | 'CONDUCTEUR';
