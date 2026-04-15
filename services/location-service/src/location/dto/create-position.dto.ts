import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreatePositionDto {
  @IsString()
  @IsNotEmpty()
  vehiculeId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  vitesse?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(360)
  cap?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precision?: number;

  @IsOptional()
  @IsISO8601()
  time?: string;

  @IsOptional()
  @IsString()
  correlationId?: string;
}
