import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { Role } from '../common/enums';
import { AnalyseLocationQueryDto } from './dto/analyse-location-query.dto';
import { CreatePositionDto } from './dto/create-position.dto';
import { CreateZoneDto } from './dto/create-zone.dto';
import { GetAlertsQueryDto } from './dto/get-alerts-query.dto';
import { GetHistoryQueryDto } from './dto/get-history-query.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { LocationService } from './services/location.service';

@ApiBearerAuth('JWT-Keycloak')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('localisation')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Get(':id/position')
  @Roles(Role.ADMIN, Role.MANAGER, Role.TECHNICIEN, Role.UTILISATEUR)
  getLatestPosition(@Param('id') vehiculeId: string) {
    return this.locationService.getLatestPosition(vehiculeId);
  }

  @Get(':id/historique')
  @Roles(Role.ADMIN, Role.MANAGER, Role.TECHNICIEN, Role.UTILISATEUR)
  getHistory(
    @Param('id') vehiculeId: string,
    @Query() query: GetHistoryQueryDto,
  ) {
    return this.locationService.getHistory(vehiculeId, query);
  }

  @Post('positions')
  @Roles(Role.ADMIN, Role.MANAGER, Role.TECHNICIEN)
  @HttpCode(HttpStatus.CREATED)
  ingestPosition(@Body() payload: CreatePositionDto) {
    return this.locationService.ingestPosition(payload);
  }

  @Get('zones')
  @Roles(Role.ADMIN, Role.MANAGER, Role.TECHNICIEN, Role.UTILISATEUR)
  listZones() {
    return this.locationService.listZones();
  }

  @Post('zones')
  @Roles(Role.ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  createZone(@Body() payload: CreateZoneDto) {
    return this.locationService.createZone(payload);
  }

  @Put('zones/:id')
  @Roles(Role.ADMIN, Role.MANAGER)
  updateZone(@Param('id') id: string, @Body() payload: UpdateZoneDto) {
    return this.locationService.updateZone(id, payload);
  }

  @Delete('zones/:id')
  @Roles(Role.ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteZone(@Param('id') id: string): Promise<void> {
    await this.locationService.deleteZone(id);
  }

  @Get('alertes')
  @Roles(Role.ADMIN, Role.MANAGER, Role.TECHNICIEN, Role.UTILISATEUR)
  listAlerts(@Query() query: GetAlertsQueryDto) {
    return this.locationService.listAlerts(query);
  }

  @Get(':id/analyse')
  @Roles(Role.ADMIN, Role.MANAGER, Role.TECHNICIEN, Role.UTILISATEUR)
  analyseVehicle(
    @Param('id') vehiculeId: string,
    @Query() query: AnalyseLocationQueryDto,
  ) {
    return this.locationService.analyseVehicle(vehiculeId, query);
  }
}
