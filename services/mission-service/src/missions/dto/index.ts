import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { StatutEtape, StatutMission } from '../../common/enums';

export { CreateMissionDto } from './create-mission.dto';

// ─── Update Mission ───────────────────────────────────────────────────────────

export class UpdateMissionDto {
  @ApiPropertyOptional({ example: 'Livraison Express' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  titre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  vehiculeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  conducteurId?: string;

  @ApiPropertyOptional({ example: '2026-03-13T08:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dateDebutPrevue?: string;

  @ApiPropertyOptional({ example: '2026-03-13T11:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dateFinPrevue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  adresseOrigine?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  adresseDestination?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @IsPositive()
  distanceEstimeeKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// ─── Change Statut ────────────────────────────────────────────────────────────

export class ChangeStatutMissionDto {
  @ApiProperty({
    enum: StatutMission,
    example: StatutMission.EN_COURS,
    description: 'Nouveau statut de la mission',
  })
  @IsEnum(StatutMission)
  statut: StatutMission;

  @ApiPropertyOptional({ example: 'Mission annulée — véhicule en panne' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  motifAnnulation?: string;

  @ApiPropertyOptional({ example: 91.2, description: 'Distance réelle (km) — à la clôture' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  distanceReelleKm?: number;
}

// ─── Add Etape ────────────────────────────────────────────────────────────────

export class AddEtapeDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsPositive()
  ordre: number;

  @ApiProperty({ example: 'Zone industrielle de Petit-Quevilly, 76140', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  adresse: string;

  @ApiPropertyOptional({ example: 49.3976 })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: 1.0598 })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ example: '2026-03-13T09:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  heurePrevue?: string;
}

// ─── Patch Etape (marquer comme atteinte) ─────────────────────────────────────

export class PatchEtapeDto {
  @ApiProperty({ enum: StatutEtape, example: StatutEtape.ATTEINTE })
  @IsEnum(StatutEtape)
  statut: StatutEtape;

  @ApiPropertyOptional({ example: '2026-03-13T09:12:00.000Z' })
  @IsOptional()
  @IsDateString()
  heureArrivee?: string;
}

// ─── Query Filter ─────────────────────────────────────────────────────────────

export class MissionsFilterDto {
  @ApiPropertyOptional({ enum: StatutMission })
  @IsOptional()
  @IsEnum(StatutMission)
  statut?: StatutMission;

  @ApiPropertyOptional({ description: 'Filtrer par conducteurId (UUID)' })
  @IsOptional()
  @IsUUID()
  conducteurId?: string;

  @ApiPropertyOptional({ description: 'Filtrer par vehiculeId (UUID)' })
  @IsOptional()
  @IsUUID()
  vehiculeId?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsNumber()
  limit?: number = 20;
}
