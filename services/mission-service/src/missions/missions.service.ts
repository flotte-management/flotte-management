import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mission } from './entities/mission.entity';
import { EtapeMission } from './entities/etape-mission.entity';
import {
  AddEtapeDto,
  ChangeStatutMissionDto,
  CreateMissionDto,
  MissionsFilterDto,
  PatchEtapeDto,
  UpdateMissionDto,
} from './dto';
import { KafkaService } from '../kafka/kafka.service';
import { Role, StatutEtape, StatutMission } from '../common/enums';
import { JwtPayload } from '../common/decorators/current-user.decorator';

// Transitions de statut autorisées
const TRANSITIONS: Record<StatutMission, StatutMission[]> = {
  [StatutMission.PLANIFIEE]: [StatutMission.EN_COURS, StatutMission.ANNULEE],
  [StatutMission.EN_COURS]: [StatutMission.TERMINEE, StatutMission.ANNULEE],
  [StatutMission.TERMINEE]: [],
  [StatutMission.ANNULEE]: [],
};

@Injectable()
export class MissionsService {
  private readonly logger = new Logger(MissionsService.name);

  constructor(
    @InjectRepository(Mission)
    private readonly missionRepo: Repository<Mission>,
    @InjectRepository(EtapeMission)
    private readonly etapeRepo: Repository<EtapeMission>,
    private readonly kafkaService: KafkaService,
  ) {}

  // ─── Lister ───────────────────────────────────────────────────────────────

  async findAll(filters: MissionsFilterDto, currentUser: JwtPayload) {
    const roles: string[] = currentUser.realm_access?.roles ?? [];
    const isPrivileged =
      roles.includes(Role.ADMIN) || roles.includes(Role.MANAGER);

    const qb = this.missionRepo.createQueryBuilder('m');

    // Un conducteur (UTILISATEUR) ne voit que ses propres missions
    if (!isPrivileged) {
      qb.andWhere('m.conducteurId = :conducteurId', {
        conducteurId: currentUser.sub,
      });
    } else if (filters.conducteurId) {
      qb.andWhere('m.conducteurId = :conducteurId', {
        conducteurId: filters.conducteurId,
      });
    }

    if (filters.statut) {
      qb.andWhere('m.statut = :statut', { statut: filters.statut });
    }
    if (filters.vehiculeId) {
      qb.andWhere('m.vehiculeId = :vehiculeId', {
        vehiculeId: filters.vehiculeId,
      });
    }

    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));

    qb.orderBy('m.dateDebutPrevue', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── Détail ───────────────────────────────────────────────────────────────

  async findOne(id: string, currentUser: JwtPayload): Promise<Mission> {
    const mission = await this.missionRepo.findOne({
      where: { id },
      relations: ['etapes'],
    });
    if (!mission) throw new NotFoundException(`Mission ${id} introuvable`);

    const roles: string[] = currentUser.realm_access?.roles ?? [];
    const isPrivileged =
      roles.includes(Role.ADMIN) || roles.includes(Role.MANAGER);

    // Un UTILISATEUR ne peut voir que ses propres missions
    if (!isPrivileged && mission.conducteurId !== currentUser.sub) {
      throw new ForbiddenException('Accès refusé à cette mission');
    }

    return mission;
  }

  // ─── Créer ────────────────────────────────────────────────────────────────

  async create(dto: CreateMissionDto, currentUser: JwtPayload): Promise<Mission> {
    if (new Date(dto.dateFinPrevue) <= new Date(dto.dateDebutPrevue)) {
      throw new BadRequestException(
        'dateFinPrevue doit être postérieure à dateDebutPrevue',
      );
    }

    const mission = this.missionRepo.create({
      ...dto,
      dateDebutPrevue: new Date(dto.dateDebutPrevue),
      dateFinPrevue: new Date(dto.dateFinPrevue),
      statut: StatutMission.PLANIFIEE,
      creePar: currentUser.sub,
    }) as Mission;

    const saved = await this.missionRepo.save(mission);

    // Publication Kafka (best-effort — ne bloque pas la réponse)
    this.kafkaService
      .publishMissionCreated({
        missionId: saved.id,
        titre: saved.titre,
        vehiculeId: saved.vehiculeId,
        conducteurId: saved.conducteurId,
        statut: saved.statut,
        dateDebutPrevue: saved.dateDebutPrevue.toISOString(),
        dateFinPrevue: saved.dateFinPrevue.toISOString(),
        adresseOrigine: saved.adresseOrigine,
        adresseDestination: saved.adresseDestination,
        distanceEstimeeKm: saved.distanceEstimeeKm,
        creePar: saved.creePar,
      })
      .catch((err) =>
        this.logger.error(`Kafka mission.created échoué: ${err.message}`),
      );

    return saved;
  }

  // ─── Modifier ─────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateMissionDto, currentUser: JwtPayload): Promise<Mission> {
    const mission = await this.findOne(id, currentUser);

    if (mission.statut !== StatutMission.PLANIFIEE) {
      throw new BadRequestException(
        'Seules les missions à l\'état PLANIFIEE peuvent être modifiées',
      );
    }

    if (dto.dateDebutPrevue || dto.dateFinPrevue) {
      const debut = dto.dateDebutPrevue
        ? new Date(dto.dateDebutPrevue)
        : mission.dateDebutPrevue;
      const fin = dto.dateFinPrevue
        ? new Date(dto.dateFinPrevue)
        : mission.dateFinPrevue;
      if (fin <= debut) {
        throw new BadRequestException(
          'dateFinPrevue doit être postérieure à dateDebutPrevue',
        );
      }
    }

    const updated = this.missionRepo.merge(mission, {
      ...dto,
      dateDebutPrevue: dto.dateDebutPrevue ? new Date(dto.dateDebutPrevue) : mission.dateDebutPrevue,
      dateFinPrevue: dto.dateFinPrevue ? new Date(dto.dateFinPrevue) : mission.dateFinPrevue,
    });

    return this.missionRepo.save(updated);
  }

  // ─── Changer le statut ────────────────────────────────────────────────────

  async changeStatut(
    id: string,
    dto: ChangeStatutMissionDto,
    currentUser: JwtPayload,
  ): Promise<Mission> {
    const mission = await this.findOne(id, currentUser);
    const allowed = TRANSITIONS[mission.statut];

    if (!allowed.includes(dto.statut)) {
      throw new BadRequestException(
        `Transition ${mission.statut} → ${dto.statut} non autorisée. ` +
          `Transitions valides : ${allowed.join(', ') || 'aucune'}`,
      );
    }

    const now = new Date();

    switch (dto.statut) {
      case StatutMission.EN_COURS:
        mission.dateDebutReelle = now;
        break;

      case StatutMission.TERMINEE:
        mission.dateFinReelle = now;
        if (dto.distanceReelleKm !== undefined) {
          mission.distanceReelleKm = dto.distanceReelleKm;
        }
        break;

      case StatutMission.ANNULEE:
        mission.motifAnnulation = dto.motifAnnulation ?? null;
        break;
    }

    mission.statut = dto.statut;
    const saved = await this.missionRepo.save(mission);

    // Publication Kafka par événement
    this.publishStatutEvent(saved, currentUser.sub).catch((err) =>
      this.logger.error(`Kafka statut event échoué: ${err.message}`),
    );

    return saved;
  }

  private async publishStatutEvent(mission: Mission, userId: string) {
    switch (mission.statut) {
      case StatutMission.EN_COURS:
        await this.kafkaService.publishMissionStarted({
          missionId: mission.id,
          vehiculeId: mission.vehiculeId,
          conducteurId: mission.conducteurId,
          dateDebutReelle: mission.dateDebutReelle!.toISOString(),
        });
        break;

      case StatutMission.TERMINEE: {
        const duree = mission.dateDebutReelle && mission.dateFinReelle
          ? Math.round(
              (mission.dateFinReelle.getTime() - mission.dateDebutReelle.getTime()) / 60000,
            )
          : null;
        await this.kafkaService.publishMissionCompleted({
          missionId: mission.id,
          vehiculeId: mission.vehiculeId,
          conducteurId: mission.conducteurId,
          dateDebutReelle: mission.dateDebutReelle?.toISOString() ?? '',
          dateFinReelle: mission.dateFinReelle!.toISOString(),
          distanceReelleKm: mission.distanceReelleKm,
          dureeReelleMin: duree,
        });
        break;
      }

      case StatutMission.ANNULEE:
        await this.kafkaService.publishMissionCancelled({
          missionId: mission.id,
          vehiculeId: mission.vehiculeId,
          conducteurId: mission.conducteurId,
          motifAnnulation: mission.motifAnnulation,
          annulePar: userId,
        });
        break;
    }
  }

  // ─── Supprimer / Annuler ──────────────────────────────────────────────────

  async remove(id: string, currentUser: JwtPayload): Promise<void> {
    const mission = await this.findOne(id, currentUser);

    if (
      mission.statut === StatutMission.TERMINEE ||
      mission.statut === StatutMission.ANNULEE
    ) {
      throw new BadRequestException(
        'Impossible de supprimer une mission déjà terminée ou annulée',
      );
    }

    // Forcer passage à ANNULEE puis supprimer logiquement (on garde la trace)
    mission.statut = StatutMission.ANNULEE;
    mission.motifAnnulation = 'Suppression manuelle';
    await this.missionRepo.save(mission);

    this.kafkaService
      .publishMissionCancelled({
        missionId: mission.id,
        vehiculeId: mission.vehiculeId,
        conducteurId: mission.conducteurId,
        motifAnnulation: 'Suppression manuelle',
        annulePar: currentUser.sub,
      })
      .catch((err) =>
        this.logger.error(`Kafka mission.cancelled échoué: ${err.message}`),
      );
  }

  // ─── Étapes ───────────────────────────────────────────────────────────────

  async getEtapes(missionId: string, currentUser: JwtPayload): Promise<EtapeMission[]> {
    // Vérification accès à la mission
    await this.findOne(missionId, currentUser);

    return this.etapeRepo.find({
      where: { missionId },
      order: { ordre: 'ASC' },
    });
  }

  async addEtape(
    missionId: string,
    dto: AddEtapeDto,
    currentUser: JwtPayload,
  ): Promise<EtapeMission> {
    const mission = await this.findOne(missionId, currentUser);

    if (mission.statut === StatutMission.TERMINEE || mission.statut === StatutMission.ANNULEE) {
      throw new BadRequestException(
        'Impossible d\'ajouter une étape à une mission terminée ou annulée',
      );
    }

    // Vérifie l'unicité de l'ordre
    const existing = await this.etapeRepo.findOne({
      where: { missionId, ordre: dto.ordre },
    });
    if (existing) {
      throw new BadRequestException(
        `Une étape avec l'ordre ${dto.ordre} existe déjà pour cette mission`,
      );
    }

    const etape = this.etapeRepo.create({
      missionId,
      ordre: dto.ordre,
      adresse: dto.adresse,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      heurePrevue: dto.heurePrevue ? new Date(dto.heurePrevue) : null,
      statut: StatutEtape.EN_ATTENTE,
    });

    return this.etapeRepo.save(etape);
  }

  async patchEtape(
    missionId: string,
    etapeId: string,
    dto: PatchEtapeDto,
    currentUser: JwtPayload,
  ): Promise<EtapeMission> {
    // Vérification accès à la mission
    await this.findOne(missionId, currentUser);

    const etape = await this.etapeRepo.findOne({
      where: { id: etapeId, missionId },
    });
    if (!etape) {
      throw new NotFoundException(`Étape ${etapeId} introuvable dans la mission ${missionId}`);
    }

    etape.statut = dto.statut;
    if (dto.heureArrivee) {
      etape.heureArrivee = new Date(dto.heureArrivee);
    } else if (dto.statut === StatutEtape.ATTEINTE) {
      etape.heureArrivee = new Date();
    }

    return this.etapeRepo.save(etape);
  }
}
