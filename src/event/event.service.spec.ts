import { Test, TestingModule } from '@nestjs/testing';
import { EventService } from './event.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

const mockPrismaService = {
  account: {
    findUnique: jest.fn(),
  },
  eventSeries: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('EventService', () => {
  let service: EventService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<EventService>(EventService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSeries', () => {
    it('should create an event series if account exists', async () => {
      const mockAccount = { id: 'acc_123' };
      const mockSeries = { id: 'ser_123', accountId: 'acc_123', title: 'Weekly Jog' };

      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.eventSeries.create.mockResolvedValue(mockSeries);

      const result = await service.createSeries('acc_123', {
        title: 'Weekly Jog',
        recurrence: { freq: 'weekly' },
      });

      expect(result).toEqual(mockSeries);
      expect(mockPrismaService.account.findUnique).toHaveBeenCalledWith({
        where: { id: 'acc_123' },
      });
    });

    it('should throw NotFoundException if account does not exist', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(null);

      await expect(
        service.createSeries('acc_missing', { title: 'Test', recurrence: {} }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getActiveSeries', () => {
    it('should return many series for an account', async () => {
      const mockSeriesList = [{ id: 'ser_1' }, { id: 'ser_2' }];
      mockPrismaService.eventSeries.findMany.mockResolvedValue(mockSeriesList);

      const result = await service.getActiveSeries('acc_123');

      expect(result).toEqual(mockSeriesList);
      expect(mockPrismaService.eventSeries.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { accountId: 'acc_123', isActive: true },
        }),
      );
    });
  });
});
