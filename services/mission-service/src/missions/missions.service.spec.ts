import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MissionsService } from './missions.service';
import { Mission } from './entities/mission.entity';
import { EtapeMission } from './entities/etape-mission.entity';
import {
  AddEtapeDto,
  ChangeStatutMissionDto,
  CreateMissionDto,
  PatchEtapeDto,
  UpdateMissionDto,
} from './dto';
import { Role, StatutEtape, StatutMission } from '../common/enums';
import { JwtPayload } from '../common/decorators/current-user.decorator';
import { KafkaService } from '../kafka/kafka.service';
import * as metrics from '../metrics/mission.metrics';

jest.mock('../metrics/mission.metrics', () => ({
  recordMissionCreated: jest.fn(),
  recordMissionDeleted: jest.fn(),
  recordMissionStatusChanged: jest.fn(),
  recordMissionStarted: jest.fn(),
  recordMissionCompleted: jest.fn(),
  recordMissionCancelled: jest.fn(),
  recordEtapeAdded: jest.fn(),
  recordEtapeUpdated: jest.fn(),
}));

const baseUser: JwtPayload = {
  sub: 'user-1',
  realm_access: { roles: [Role.ADMIN] },
};

const makeMission = (overrides: Partial<Mission> = {}): Mission => {
  return {
    id: 'mission-1',
    titre: 'Livraison Rouen',
    vehiculeId: 'vehicule-1',
    conducteurId: 'driver-1',
    statut: StatutMission.PLANIFIEE,
    dateDebutPrevue: new Date('2026-03-13T08:00:00.000Z'),
    dateFinPrevue: new Date('2026-03-13T11:00:00.000Z'),
    dateDebutReelle: null,
    dateFinReelle: null,
    adresseOrigine: 'Rouen',
    adresseDestination: 'Le Havre',
    distanceEstimeeKm: 87.4,
    distanceReelleKm: null,
    notes: null,
    motifAnnulation: null,
    creePar: 'user-1',
    createdAt: new Date('2026-03-01T10:00:00.000Z'),
    updatedAt: new Date('2026-03-02T10:00:00.000Z'),
    etapes: [],
    ...overrides,
  } as Mission;
};

const makeService = () => {
  const missionRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    merge: jest.fn(),
  };
  const etapeRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const kafkaService: Partial<KafkaService> = {
    publishMissionCreated: jest.fn().mockResolvedValue([]),
    publishMissionStarted: jest.fn().mockResolvedValue([]),
    publishMissionCompleted: jest.fn().mockResolvedValue([]),
    publishMissionCancelled: jest.fn().mockResolvedValue([]),
  };

  const service = new MissionsService(
    missionRepo as any,
    etapeRepo as any,
    kafkaService as KafkaService,
  );

  return { service, missionRepo, etapeRepo, kafkaService };
};

const createDto: CreateMissionDto = {
  titre: 'Livraison Rouen',
  vehiculeId: 'vehicule-1',
  conducteurId: 'driver-1',
  dateDebutPrevue: '2026-03-13T08:00:00.000Z',
  dateFinPrevue: '2026-03-13T11:00:00.000Z',
  adresseOrigine: 'Rouen',
  adresseDestination: 'Le Havre',
  distanceEstimeeKm: 87.4,
  notes: 'Urgent',
};

describe('MissionsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refuse la creation si dateFinPrevue <= dateDebutPrevue', async () => {
    const { service } = makeService();
    const dto: CreateMissionDto = {
      ...createDto,
      dateFinPrevue: '2026-03-13T07:00:00.000Z',
    };

    await expect(service.create(dto, baseUser)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('cree une mission et publie un evenement', async () => {
    const { service, missionRepo, kafkaService } = makeService();
    const mission = makeMission();

    missionRepo.create.mockReturnValue(mission);
    missionRepo.save.mockResolvedValue({ ...mission, id: 'mission-123' });

    const result = await service.create(createDto, baseUser);

    expect(result.id).toBe('mission-123');
    expect(metrics.recordMissionCreated).toHaveBeenCalledTimes(1);
    expect(kafkaService.publishMissionCreated).toHaveBeenCalledTimes(1);
  });

  it('interdit un utilisateur non proprietaire de consulter la mission', async () => {
    const { service, missionRepo } = makeService();
    const mission = makeMission({ conducteurId: 'driver-2' });
    const user: JwtPayload = { sub: 'driver-1', realm_access: { roles: [Role.UTILISATEUR] } };

    missionRepo.findOne.mockResolvedValue(mission);

    await expect(service.findOne('mission-1', user)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuse une mise a jour si mission non PLANIFIEE', async () => {
    const { service, missionRepo } = makeService();
    const mission = makeMission({ statut: StatutMission.EN_COURS });
    missionRepo.findOne.mockResolvedValue(mission);

    const dto: UpdateMissionDto = { titre: 'Maj' };

    await expect(service.update('mission-1', dto, baseUser)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuse une transition de statut non autorisee', async () => {
    const { service, missionRepo } = makeService();
    const mission = makeMission({ statut: StatutMission.EN_COURS });
    missionRepo.findOne.mockResolvedValue(mission);

    const dto: ChangeStatutMissionDto = { statut: StatutMission.PLANIFIEE };

    await expect(service.changeStatut('mission-1', dto, baseUser)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('change le statut en EN_COURS et publie les metrics', async () => {
    const { service, missionRepo } = makeService();
    const mission = makeMission({ statut: StatutMission.PLANIFIEE });
    missionRepo.findOne.mockResolvedValue(mission);
    missionRepo.save.mockImplementation(async (value: Mission) => value);

    const dto: ChangeStatutMissionDto = { statut: StatutMission.EN_COURS };
    const result = await service.changeStatut('mission-1', dto, baseUser);

    expect(result.statut).toBe(StatutMission.EN_COURS);
    expect(metrics.recordMissionStatusChanged).toHaveBeenCalledWith(StatutMission.EN_COURS);
    expect(metrics.recordMissionStarted).toHaveBeenCalledTimes(1);
  });

  it('refuse la suppression d une mission terminee', async () => {
    const { service, missionRepo } = makeService();
    const mission = makeMission({ statut: StatutMission.TERMINEE });
    missionRepo.findOne.mockResolvedValue(mission);

    await expect(service.remove('mission-1', baseUser)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('annule puis supprime logiquement la mission', async () => {
    const { service, missionRepo, kafkaService } = makeService();
    const mission = makeMission({ statut: StatutMission.EN_COURS });
    missionRepo.findOne.mockResolvedValue(mission);
    missionRepo.save.mockResolvedValue(mission);

    await service.remove('mission-1', baseUser);

    expect(metrics.recordMissionCancelled).toHaveBeenCalledTimes(1);
    expect(metrics.recordMissionDeleted).toHaveBeenCalledTimes(1);
    expect(kafkaService.publishMissionCancelled).toHaveBeenCalledTimes(1);
  });

  it('refuse l ajout d etape si ordre deja utilise', async () => {
    const { service, missionRepo, etapeRepo } = makeService();
    const mission = makeMission();
    missionRepo.findOne.mockResolvedValue(mission);
    etapeRepo.findOne.mockResolvedValue({ id: 'etape-1' } as EtapeMission);

    const dto: AddEtapeDto = {
      ordre: 1,
      adresse: 'Zone industrielle',
    };

    await expect(service.addEtape('mission-1', dto, baseUser)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('remonte une erreur si etape introuvable au patch', async () => {
    const { service, missionRepo, etapeRepo } = makeService();
    const mission = makeMission();
    missionRepo.findOne.mockResolvedValue(mission);
    etapeRepo.findOne.mockResolvedValue(null);

    const dto: PatchEtapeDto = { statut: StatutEtape.ATTEINTE };

    await expect(service.patchEtape('mission-1', 'etape-1', dto, baseUser)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

