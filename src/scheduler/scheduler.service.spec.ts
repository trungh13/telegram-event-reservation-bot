import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerService } from './scheduler.service';
import { PrismaService } from '../prisma/prisma.service';
import { Frequency } from 'rrule';
import { getBotToken } from 'nestjs-telegraf';

const mockPrismaService = {
  eventSeries: {
    findMany: jest.fn(),
  },
  eventInstance: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  accountUserBinding: {
    findMany: jest.fn().mockResolvedValue([]),
  },
};

const mockBot = {
  telegram: {
    sendMessage: jest.fn(),
  },
};

describe('SchedulerService', () => {
  let service: SchedulerService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: getBotToken(),
          useValue: mockBot,
        },
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('materializeInstances', () => {
    it('should create instances for active series', async () => {
      const seriesCreatedAt = new Date('2026-01-01T10:00:00Z');
      const mockSeries = {
        id: 'ser_1',
        title: 'Weekly Yoga',
        isActive: true,
        createdAt: seriesCreatedAt,
        recurrence: {
          freq: Frequency.WEEKLY,
          dtstart: seriesCreatedAt,
        },
      };

      mockPrismaService.eventSeries.findMany.mockResolvedValue([mockSeries]);
      mockPrismaService.eventInstance.findUnique.mockResolvedValue(null);
      mockPrismaService.eventInstance.create.mockResolvedValue({ id: 'inst_1' });

      await service.materializeInstances();

      expect(mockPrismaService.eventSeries.findMany).toHaveBeenCalled();
      // It should attempt to create at least 4 instances for 30 days weekly
      expect(mockPrismaService.eventInstance.create).toHaveBeenCalled();
    });

    it('should not create duplicate instances', async () => {
      const seriesCreatedAt = new Date('2026-01-01T10:00:00Z');
      const mockSeries = {
        id: 'ser_1',
        title: 'Weekly Yoga',
        isActive: true,
        createdAt: seriesCreatedAt,
        recurrence: {
          freq: Frequency.WEEKLY,
          dtstart: seriesCreatedAt,
        },
      };

      mockPrismaService.eventSeries.findMany.mockResolvedValue([mockSeries]);
      mockPrismaService.eventInstance.findUnique.mockResolvedValue({ id: 'exists' });

      await service.materializeInstances();

      expect(mockPrismaService.eventInstance.create).not.toHaveBeenCalled();
    });
  });
});
