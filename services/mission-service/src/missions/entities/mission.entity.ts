import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Check,
} from 'typeorm';
import { StatutMission } from '../../common/enums';
import { EtapeMission } from './etape-mission.entity';

@Entity('missions')
@Check('"date_fin_prevue" > "date_debut_prevue"')
export class Mission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  titre: string;

  @Column({ name: 'vehicule_id', type: 'uuid' })
  vehiculeId: string;

  @Column({ name: 'conducteur_id', type: 'uuid' })
  conducteurId: string;

  @Column({
    type: 'enum',
    enum: StatutMission,
    default: StatutMission.PLANIFIEE,
  })
  statut: StatutMission;

  @Column({ name: 'date_debut_prevue', type: 'timestamptz' })
  dateDebutPrevue: Date;

  @Column({ name: 'date_fin_prevue', type: 'timestamptz' })
  dateFinPrevue: Date;

  @Column({ name: 'date_debut_reelle', type: 'timestamptz', nullable: true })
  dateDebutReelle: Date | null;

  @Column({ name: 'date_fin_reelle', type: 'timestamptz', nullable: true })
  dateFinReelle: Date | null;

  @Column({ name: 'adresse_origine', length: 200 })
  adresseOrigine: string;

  @Column({ name: 'adresse_destination', length: 200 })
  adresseDestination: string;

  @Column({
    name: 'distance_estimee_km',
    type: 'numeric',
    precision: 8,
    scale: 2,
    nullable: true,
  })
  distanceEstimeeKm: number | null;

  @Column({
    name: 'distance_reelle_km',
    type: 'numeric',
    precision: 8,
    scale: 2,
    nullable: true,
  })
  distanceReelleKm: number | null;

  @Column({ nullable: true, type: 'text' })
  notes: string | null;

  @Column({ name: 'motif_annulation', length: 255, nullable: true })
  motifAnnulation: string | null;

  @Column({ name: 'cree_par', type: 'uuid' })
  creePar: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => EtapeMission, (etape) => etape.mission, {
    cascade: true,
    eager: false,
  })
  etapes: EtapeMission[];
}
