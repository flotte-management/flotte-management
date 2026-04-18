import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateMissionDto {
  @ApiProperty({ example: 'Livraison Rouen → Le Havre', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  titre: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  vehiculeId: string;

  @ApiProperty({ example: 'f1e2d3c4-b5a6-9870-fedc-ba9876543210' })
  @IsUUID()
  conducteurId: string;

  @ApiProperty({ example: '2026-03-13T08:00:00.000Z' })
  @IsDateString()
  dateDebutPrevue: string;

  @ApiProperty({ example: '2026-03-13T11:00:00.000Z' })
  @IsDateString()
  dateFinPrevue: string;

  @ApiProperty({ example: '15 Rue de la République, 76000 Rouen', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  adresseOrigine: string;

  @ApiProperty({ example: 'Port du Havre, 76600 Le Havre', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  adresseDestination: string;

  @ApiPropertyOptional({ example: 87.4, description: 'Distance estimée en km' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  distanceEstimeeKm?: number;

  @ApiPropertyOptional({ example: 'Livraison urgente — priorité haute' })
  @IsOptional()
  @IsString()
  notes?: string;
}
