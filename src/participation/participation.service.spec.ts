import { Test, TestingModule } from '@nestjs/testing';
import { ParticipationService } from './participation.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

const mockPrismaService = {
  eventInstance: {
    findUnique: jest.fn(),
  },
  telegramUser: {
    upsert: jest.fn(),
  },
  participationLog: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('ParticipationService', () => {
  let service: ParticipationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParticipationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ParticipationService>(ParticipationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordParticipation', () => {
    const telegramUser = { id: BigInt(123), username: 'testuser' };
    const instanceId = 'inst_123';

    it('should record participation if instance exists', async () => {
      mockPrismaService.eventInstance.findUnique.mockResolvedValue({ id: instanceId });
      mockPrismaService.telegramUser.upsert.mockResolvedValue(telegramUser);
      mockPrismaService.participationLog.create.mockResolvedValue({ id: 'log_123' });

      const result = await service.recordParticipation({
        instanceId,
        telegramUser,
        action: 'JOIN',
      });

      expect(mockPrismaService.eventInstance.findUnique).toHaveBeenCalledWith({
        where: { id: instanceId },
      });
      expect(mockPrismaService.telegramUser.upsert).toHaveBeenCalled();
      expect(mockPrismaService.participationLog.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if instance missing', async () => {
      mockPrismaService.eventInstance.findUnique.mockResolvedValue(null);

      await expect(
        service.recordParticipation({ instanceId: 'missing', telegramUser, action: 'JOIN' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
