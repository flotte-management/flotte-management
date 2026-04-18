import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MissionsService } from './missions.service';
import {
  AddEtapeDto,
  ChangeStatutMissionDto,
  CreateMissionDto,
  MissionsFilterDto,
  PatchEtapeDto,
  UpdateMissionDto,
} from './dto';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums';

const UUID_PIPE = new ParseUUIDPipe({ version: '4' });

@ApiTags('Missions')
@ApiBearerAuth('JWT-Keycloak')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/missions')
export class MissionsController {
  constructor(private readonly missionsService: MissionsService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/v1/missions
  // ─────────────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'Lister les missions',
    description:
      'Un conducteur (UTILISATEUR) ne voit que ses propres missions. ' +
      'ADMIN / MANAGER voient toutes les missions avec filtres optionnels.',
  })
  @ApiResponse({ status: 200, description: 'Liste paginée des missions' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  findAll(
    @Query() filters: MissionsFilterDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.missionsService.findAll(filters, user);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/v1/missions
  // ─────────────────────────────────────────────────────────────────────────

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Créer une nouvelle mission' })
  @ApiResponse({ status: 201, description: 'Mission créée + événement Kafka publié' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 403, description: 'Rôle insuffisant' })
  create(
    @Body() dto: CreateMissionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.missionsService.create(dto, user);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/v1/missions/:id
  // ─────────────────────────────────────────────────────────────────────────

  @Get(':id')
  @Roles(Role.ADMIN, Role.MANAGER, Role.UTILISATEUR)
  @ApiOperation({ summary: 'Obtenir le détail d\'une mission' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Détail de la mission' })
  @ApiResponse({ status: 404, description: 'Mission introuvable' })
  findOne(
    @Param('id', UUID_PIPE) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.missionsService.findOne(id, user);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUT /api/v1/missions/:id
  // ─────────────────────────────────────────────────────────────────────────

  @Put(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({
    summary: 'Modifier une mission (état PLANIFIEE uniquement)',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Mission mise à jour' })
  @ApiResponse({ status: 400, description: 'Mission non modifiable dans cet état' })
  update(
    @Param('id', UUID_PIPE) id: string,
    @Body() dto: UpdateMissionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.missionsService.update(id, dto, user);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE /api/v1/missions/:id
  // ─────────────────────────────────────────────────────────────────────────

  @Delete(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Annuler et supprimer une mission' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Mission annulée' })
  @ApiResponse({ status: 400, description: 'Mission déjà terminée ou annulée' })
  remove(
    @Param('id', UUID_PIPE) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.missionsService.remove(id, user);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PATCH /api/v1/missions/:id/statut
  // ─────────────────────────────────────────────────────────────────────────

  @Patch(':id/statut')
  @Roles(Role.ADMIN, Role.MANAGER, Role.UTILISATEUR)
  @ApiOperation({
    summary: 'Changer le statut d\'une mission',
    description: `
Transitions autorisées :
- PLANIFIEE → EN_COURS | ANNULEE
- EN_COURS  → TERMINEE | ANNULEE
    `,
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Statut mis à jour + événement Kafka publié' })
  @ApiResponse({ status: 400, description: 'Transition non autorisée' })
  changeStatut(
    @Param('id', UUID_PIPE) id: string,
    @Body() dto: ChangeStatutMissionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.missionsService.changeStatut(id, dto, user);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/v1/missions/:id/etapes
  // ─────────────────────────────────────────────────────────────────────────

  @Get(':id/etapes')
  @ApiOperation({ summary: 'Lister les étapes d\'une mission (ordonnées)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Liste des étapes' })
  getEtapes(
    @Param('id', UUID_PIPE) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.missionsService.getEtapes(id, user);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/v1/missions/:id/etapes
  // ─────────────────────────────────────────────────────────────────────────

  @Post(':id/etapes')
  @Roles(Role.ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Ajouter une étape à une mission' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Étape créée' })
  addEtape(
    @Param('id', UUID_PIPE) id: string,
    @Body() dto: AddEtapeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.missionsService.addEtape(id, dto, user);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PATCH /api/v1/missions/:id/etapes/:eid
  // ─────────────────────────────────────────────────────────────────────────

  @Patch(':id/etapes/:eid')
  @Roles(Role.ADMIN, Role.MANAGER, Role.UTILISATEUR)
  @ApiOperation({ summary: 'Mettre à jour une étape (atteinte / ignorée)' })
  @ApiParam({ name: 'id', description: 'ID de la mission', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'eid', description: 'ID de l\'étape', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Étape mise à jour' })
  @ApiResponse({ status: 404, description: 'Étape introuvable' })
  patchEtape(
    @Param('id', UUID_PIPE) id: string,
    @Param('eid', UUID_PIPE) eid: string,
    @Body() dto: PatchEtapeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.missionsService.patchEtape(id, eid, dto, user);
  }
}
