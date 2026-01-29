import { Test, TestingModule } from '@nestjs/testing';
import { GroupService } from './group.service';
import { PrismaService } from '../prisma/prisma.service';

describe('GroupService', () => {
  let service: GroupService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    eventSeries: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<GroupService>(GroupService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getGroupsForAccount', () => {
    it('should return empty list when account has no events', async () => {
      mockPrismaService.eventSeries.findMany.mockResolvedValue([]);

      const groups = await service.getGroupsForAccount('acc_123');

      expect(groups).toEqual([]);
    });

    it('should return unique groups with event count', async () => {
      const mockEvents = [
        {
          id: 's1',
          title: 'Event 1',
          chatId: BigInt('-100111'),
          accountId: 'acc_123',
        },
        {
          id: 's2',
          title: 'Event 2',
          chatId: BigInt('-100111'),
          accountId: 'acc_123',
        },
        {
          id: 's3',
          title: 'Event 3',
          chatId: BigInt('-100222'),
          accountId: 'acc_123',
        },
      ];

      mockPrismaService.eventSeries.findMany.mockResolvedValue(mockEvents);

      const groups = await service.getGroupsForAccount('acc_123');

      expect(groups).toHaveLength(2);
      expect(groups[0].id).toBe('-100111');
      expect(groups[0].eventCount).toBe(2);
      expect(groups[1].id).toBe('-100222');
      expect(groups[1].eventCount).toBe(1);
    });

    it('should exclude events with null chatId', async () => {
      const mockEvents = [
        {
          id: 's1',
          title: 'Event 1',
          chatId: BigInt('-100111'),
          accountId: 'acc_123',
        },
        { id: 's2', title: 'Event 2', chatId: null, accountId: 'acc_123' },
      ];

      mockPrismaService.eventSeries.findMany.mockResolvedValue(mockEvents);

      const groups = await service.getGroupsForAccount('acc_123');

      expect(groups).toHaveLength(1);
      expect(groups[0].id).toBe('-100111');
    });

    it('should only return events for specified account', async () => {
      const mockEvents = [
        {
          id: 's1',
          title: 'Event 1',
          chatId: BigInt('-100111'),
          accountId: 'acc_123',
        },
      ];

      mockPrismaService.eventSeries.findMany.mockResolvedValue(mockEvents);

      await service.getGroupsForAccount('acc_123');

      expect(mockPrismaService.eventSeries.findMany).toHaveBeenCalledWith({
        where: {
          accountId: 'acc_123',
          isActive: true,
        },
        select: {
          id: true,
          title: true,
          chatId: true,
        },
      });
    });

    it('should return only active events', async () => {
      const mockEvents = [
        {
          id: 's1',
          title: 'Event 1',
          chatId: BigInt('-100111'),
          accountId: 'acc_123',
        },
      ];

      mockPrismaService.eventSeries.findMany.mockResolvedValue(mockEvents);

      await service.getGroupsForAccount('acc_123');

      const callArgs = mockPrismaService.eventSeries.findMany.mock.calls[0][0];
      expect(callArgs.where.isActive).toBe(true);
    });
  });

  describe('getGroupById', () => {
    it('should return formatted group info', async () => {
      const mockEvents = [
        {
          id: 's1',
          title: 'Event 1',
          chatId: BigInt('-100111'),
          accountId: 'acc_123',
        },
        {
          id: 's2',
          title: 'Event 2',
          chatId: BigInt('-100111'),
          accountId: 'acc_123',
        },
      ];

      mockPrismaService.eventSeries.findMany.mockResolvedValue(mockEvents);

      const group = await service.getGroupById('acc_123', '-100111');

      expect(group?.eventCount).toBe(2);
      expect(group?.id).toBe('-100111');
    });

    it('should return null for group with no events', async () => {
      mockPrismaService.eventSeries.findMany.mockResolvedValue([
        {
          id: 's1',
          title: 'Event 1',
          chatId: BigInt('-100222'),
          accountId: 'acc_123',
        },
      ]);

      const group = await service.getGroupById('acc_123', '-100111');

      expect(group).toBeNull();
    });
  });

  describe('formatGroupsMessage', () => {
    it('should format empty groups list', () => {
      const message = service.formatGroupsMessage([]);

      expect(message).toContain('No groups');
    });

    it('should format groups with event counts', () => {
      const groups = [
        { id: '-100111', eventCount: 3 },
        { id: '-100222', eventCount: 1 },
      ];

      const message = service.formatGroupsMessage(groups);

      expect(message).toContain('-100111');
      expect(message).toContain('3 events');
      expect(message).toContain('-100222');
      expect(message).toContain('1 event');
    });
  });
});
