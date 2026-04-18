import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { StatutEtape } from '../../common/enums';
import { Mission } from './mission.entity';

@Entity('etapes_mission')
@Unique(['missionId', 'ordre'])
export class EtapeMission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'mission_id', type: 'uuid' })
  missionId: string;

  @ManyToOne(() => Mission, (mission) => mission.etapes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'mission_id' })
  mission: Mission;

  @Column({ type: 'smallint' })
  ordre: number;

  @Column({ length: 200 })
  adresse: string;

  @Column({ type: 'double precision', nullable: true })
  latitude: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude: number | null;

  @Column({ name: 'heure_prevue', type: 'timestamptz', nullable: true })
  heurePrevue: Date | null;

  @Column({ name: 'heure_arrivee', type: 'timestamptz', nullable: true })
  heureArrivee: Date | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: StatutEtape.EN_ATTENTE,
  })
  statut: StatutEtape;
}
