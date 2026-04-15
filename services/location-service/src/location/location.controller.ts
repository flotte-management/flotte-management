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
} from '@nestjs/common';
import { AnalyseLocationQueryDto } from './dto/analyse-location-query.dto';
import { CreatePositionDto } from './dto/create-position.dto';
import { CreateZoneDto } from './dto/create-zone.dto';
import { GetAlertsQueryDto } from './dto/get-alerts-query.dto';
import { GetHistoryQueryDto } from './dto/get-history-query.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { LocationService } from './services/location.service';

@Controller('localisation')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Get(':id/position')
  getLatestPosition(@Param('id') vehiculeId: string) {
    return this.locationService.getLatestPosition(vehiculeId);
  }

  @Get(':id/historique')
  getHistory(
    @Param('id') vehiculeId: string,
    @Query() query: GetHistoryQueryDto,
  ) {
    return this.locationService.getHistory(vehiculeId, query);
  }

  @Post('positions')
  @HttpCode(HttpStatus.CREATED)
  ingestPosition(@Body() payload: CreatePositionDto) {
    return this.locationService.ingestPosition(payload);
  }

  @Get('zones')
  listZones() {
    return this.locationService.listZones();
  }

  @Post('zones')
  @HttpCode(HttpStatus.CREATED)
  createZone(@Body() payload: CreateZoneDto) {
    return this.locationService.createZone(payload);
  }

  @Put('zones/:id')
  updateZone(@Param('id') id: string, @Body() payload: UpdateZoneDto) {
    return this.locationService.updateZone(id, payload);
  }

  @Delete('zones/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteZone(@Param('id') id: string): Promise<void> {
    await this.locationService.deleteZone(id);
  }

  @Get('alertes')
  listAlerts(@Query() query: GetAlertsQueryDto) {
    return this.locationService.listAlerts(query);
  }

  @Get(':id/analyse')
  analyseVehicle(
    @Param('id') vehiculeId: string,
    @Query() query: AnalyseLocationQueryDto,
  ) {
    return this.locationService.analyseVehicle(vehiculeId, query);
  }
}
