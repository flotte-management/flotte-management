import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ZonePointDto } from './zone-point.dto';

export class CreateZoneDto {
  @IsString()
  @IsNotEmpty()
  nom!: string;

  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  actif?: boolean;

  @IsArray()
  @ArrayMinSize(3)
  @ValidateNested({ each: true })
  @Type(() => ZonePointDto)
  coordinates!: ZonePointDto[];
}
