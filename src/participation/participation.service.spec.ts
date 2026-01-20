import { Test, TestingModule } from '@nestjs/testing';
import { ParticipationService } from './participation.service';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramUserService } from '../telegram-user/telegram-user.service';
import { NotFoundException } from '@nestjs/common';

const mockPrismaService = {
  eventInstance: {
    findUnique: jest.fn(),
  },
  participationLog: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockTelegramUserService = {
  ensureUser: jest.fn(),
};

describe('ParticipationService', () => {
  let service: ParticipationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParticipationService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: TelegramUserService, useValue: mockTelegramUserService },
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
      // mockTelegramUserService.ensureUser returns void or user, doesn't matter much for this test unless relied upon
      mockTelegramUserService.ensureUser.mockResolvedValue(telegramUser);
      mockPrismaService.participationLog.create.mockResolvedValue({ id: 'log_123' });

      const result = await service.recordParticipation({
        instanceId,
        telegramUser,
        action: 'JOIN',
      });

      expect(mockPrismaService.eventInstance.findUnique).toHaveBeenCalledWith({
        where: { id: instanceId },
      });
      expect(mockTelegramUserService.ensureUser).toHaveBeenCalledWith(telegramUser);
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
