import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerService } from './scheduler.service';
import { PrismaService } from '../prisma/prisma.service';
import { Frequency } from 'rrule';
import { getBotToken } from 'nestjs-telegraf';
import { EventService } from '../event/event.service';

const mockPrismaService = {
  eventSeries: {
    findMany: jest.fn(),
  },
  eventInstance: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  accountUserBinding: {
    findMany: jest.fn().mockResolvedValue([]),
  },
};

const mockBot = {
  telegram: {
    sendMessage: jest.fn().mockResolvedValue({ message_id: 999, chat: { id: -1001 } }),
  },
};

const mockEventService = {
  formatAttendanceMessage: jest.fn().mockResolvedValue('Mock Message'),
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
          provide: EventService,
          useValue: mockEventService,
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
      const now = new Date();
      const mockSeries = {
        id: 'ser_1',
        title: 'Weekly Yoga',
        isActive: true,
        createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
        recurrence: {
          freq: Frequency.DAILY, // Daily to ensure one hits the next 48h
          dtstart: now,
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
      const now = new Date();
      const mockSeries = {
        id: 'ser_1',
        title: 'Weekly Yoga',
        isActive: true,
        createdAt: now,
        recurrence: {
          freq: Frequency.DAILY,
          dtstart: now,
        },
      };

      mockPrismaService.eventSeries.findMany.mockResolvedValue([mockSeries]);
      mockPrismaService.eventInstance.findUnique.mockResolvedValue({ id: 'exists' });

      await service.materializeInstances();

      expect(mockPrismaService.eventInstance.create).not.toHaveBeenCalled();
    });

    it('should trigger auto-announcement if chatId is present', async () => {
      const seriesCreatedAt = new Date('2026-01-01T10:00:00Z');
      const mockSeries = {
        id: 'ser_1',
        title: 'Yoga',
        chatId: BigInt(-100123),
        recurrence: { freq: Frequency.DAILY, dtstart: seriesCreatedAt },
      };

      mockPrismaService.eventSeries.findMany.mockResolvedValue([mockSeries]);
      mockPrismaService.eventInstance.findUnique.mockResolvedValue(null);
      mockPrismaService.eventInstance.create.mockResolvedValue({ id: 'inst_new', startTime: new Date() });
      mockPrismaService.eventInstance.update = jest.fn().mockResolvedValue({});

      await service.materializeInstances();

      expect(mockEventService.formatAttendanceMessage).toHaveBeenCalled();
      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith('-100123', expect.any(String), expect.anything());
    });
  });
});
