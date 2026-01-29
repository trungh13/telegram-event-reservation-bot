import { Test, TestingModule } from '@nestjs/testing';
import { ParticipantAdminService } from './participant-admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from './audit-log.service';

describe('ParticipantAdminService', () => {
  let service: ParticipantAdminService;
  const mockPrismaService = {
    participationLog: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    telegramUser: {
      upsert: jest.fn(),
    },
  };

  const mockAuditLogService = {
    logParticipantAdded: jest.fn(),
    logParticipantRemoved: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParticipantAdminService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    service = module.get<ParticipantAdminService>(ParticipantAdminService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getParticipants', () => {
    it('should return list of participants for instance', async () => {
      const mockLogs = [
        {
          id: 'p1',
          instanceId: 'inst_123',
          telegramUserId: BigInt('111'),
          action: 'JOIN',
          createdAt: new Date('2026-02-04T10:00:00Z'),
        },
        {
          id: 'p2',
          instanceId: 'inst_123',
          telegramUserId: BigInt('222'),
          action: 'JOIN',
          createdAt: new Date('2026-02-04T10:05:00Z'),
        },
        {
          id: 'p3',
          instanceId: 'inst_123',
          telegramUserId: BigInt('111'),
          action: 'LEAVE',
          createdAt: new Date('2026-02-04T10:10:00Z'),
        },
      ];

      mockPrismaService.participationLog.findMany.mockResolvedValue(mockLogs);

      const participants = await service.getParticipants('inst_123');

      // Should have 1 participant (user 111 left, so only 222 remains)
      expect(participants).toHaveLength(1);
      expect(participants[0].telegramUserId).toBe(BigInt('222'));
      expect(participants[0].action).toBe('JOIN');
    });

    it('should handle PLUS_ONE as valid participation', async () => {
      const mockLogs = [
        {
          id: 'p1',
          instanceId: 'inst_123',
          telegramUserId: BigInt('111'),
          action: 'PLUS_ONE',
          createdAt: new Date(),
        },
      ];

      mockPrismaService.participationLog.findMany.mockResolvedValue(mockLogs);

      const participants = await service.getParticipants('inst_123');

      expect(participants).toHaveLength(1);
      expect(participants[0].action).toBe('PLUS_ONE');
    });

    it('should return empty list when no participants', async () => {
      mockPrismaService.participationLog.findMany.mockResolvedValue([]);

      const participants = await service.getParticipants('inst_123');

      expect(participants).toEqual([]);
    });
  });

  describe('addParticipant', () => {
    it('should add participant and log action', async () => {
      mockPrismaService.telegramUser.upsert.mockResolvedValue({
        id: BigInt('111'),
        username: 'testuser',
      });

      mockPrismaService.participationLog.create.mockResolvedValue({
        id: 'p1',
      });

      await service.addParticipant(
        'inst_123',
        BigInt('111'),
        'testuser',
        'admin',
        'acc_123',
      );

      expect(mockPrismaService.telegramUser.upsert).toHaveBeenCalled();
      expect(mockPrismaService.participationLog.create).toHaveBeenCalledWith({
        data: {
          instanceId: 'inst_123',
          telegramUserId: BigInt('111'),
          action: 'JOIN',
        },
      });
      expect(mockAuditLogService.logParticipantAdded).toHaveBeenCalledWith(
        'inst_123',
        BigInt('111'),
        'admin',
        'acc_123',
      );
    });

    it('should not add if already joined', async () => {
      mockPrismaService.participationLog.findFirst.mockResolvedValue({
        id: 'p1',
        action: 'JOIN',
      });

      const result = await service.addParticipant(
        'inst_123',
        BigInt('111'),
        'testuser',
        'admin',
      );

      expect(result.error).toBe('already_joined');
      expect(mockPrismaService.participationLog.create).not.toHaveBeenCalled();
    });
  });

  describe('removeParticipant', () => {
    it('should remove participant and log action', async () => {
      mockPrismaService.participationLog.create.mockResolvedValue({
        id: 'p1',
      });

      await service.removeParticipant(
        'inst_123',
        BigInt('111'),
        'admin',
        'acc_123',
      );

      expect(mockPrismaService.participationLog.create).toHaveBeenCalledWith({
        data: {
          instanceId: 'inst_123',
          telegramUserId: BigInt('111'),
          action: 'LEAVE',
        },
      });
      expect(mockAuditLogService.logParticipantRemoved).toHaveBeenCalledWith(
        'inst_123',
        BigInt('111'),
        'admin',
        'acc_123',
      );
    });

    it('should work even if participant never joined', async () => {
      mockPrismaService.participationLog.create.mockResolvedValue({
        id: 'p1',
      });

      const result = await service.removeParticipant(
        'inst_123',
        BigInt('999'),
        'admin',
      );

      expect(result).toBeUndefined();
      expect(mockPrismaService.participationLog.create).toHaveBeenCalled();
    });
  });

  describe('formatParticipantList', () => {
    it('should format participant list for display', () => {
      const participants = [
        {
          telegramUserId: BigInt('111'),
          action: 'JOIN',
          username: 'alice',
        },
        {
          telegramUserId: BigInt('222'),
          action: 'PLUS_ONE',
          username: 'bob',
        },
      ];

      const formatted = service.formatParticipantList(participants as any);

      expect(formatted).toContain('alice');
      expect(formatted).toContain('bob');
      expect(formatted).toContain('(+1)');
    });

    it('should show count correctly', () => {
      const participants = [
        { telegramUserId: BigInt('111'), action: 'JOIN', username: 'alice' },
      ];

      const formatted = service.formatParticipantList(participants as any);

      expect(formatted).toContain('1 person');
    });

    it('should format plural correctly', () => {
      const participants = [
        { telegramUserId: BigInt('111'), action: 'JOIN', username: 'alice' },
        { telegramUserId: BigInt('222'), action: 'JOIN', username: 'bob' },
      ];

      const formatted = service.formatParticipantList(participants as any);

      expect(formatted).toContain('2 people');
    });
  });
});
