import { Test, TestingModule } from '@nestjs/testing';
import { TelegramService } from './telegram.service';
import { AccountService } from '../account/account.service';
import { EventService } from '../event/event.service';
import { ParticipationService } from '../participation/participation.service';
import { PrismaService } from '../prisma/prisma.service';
import { Context } from 'telegraf';
import { getBotToken } from 'nestjs-telegraf';

describe('TelegramService', () => {
  let service: TelegramService;
  let mockAccountService: any;
  let mockEventService: any;

  const mockBot = {
    telegram: {
      sendMessage: jest
        .fn()
        .mockResolvedValue({ message_id: 12345, chat: { id: -100123456 } }),
      getChatMember: jest.fn().mockResolvedValue({ status: 'member' }),
      editMessageText: jest.fn().mockResolvedValue(true),
    },
    botInfo: { id: 999 },
  };

  beforeEach(async () => {
    mockAccountService = {
      validateApiKey: jest.fn(),
      bindUserToAccount: jest.fn(),
      getAccountForUser: jest.fn(),
    };

    mockEventService = {
      createSeries: jest.fn(),
      getActiveSeries: jest.fn(),
      formatAttendanceMessage: jest.fn().mockResolvedValue('Formatted Message'),
    };

    const mockParticipationService = {
      recordParticipation: jest.fn(),
    };

    const mockPrismaService = {
      eventInstance: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      participationLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramService,
        { provide: AccountService, useValue: mockAccountService },
        { provide: EventService, useValue: mockEventService },
        { provide: ParticipationService, useValue: mockParticipationService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: getBotToken(), useValue: mockBot },
      ],
    }).compile();

    service = module.get<TelegramService>(TelegramService);
  });

  const createCtx = (text: string, fromId = 123) =>
    ({
      message: { text, message_id: 1 },
      reply: jest.fn(),
      from: { id: fromId },
      chat: { id: fromId, type: 'private' },
      botInfo: { id: 999 },
      telegram: mockBot.telegram,
    }) as unknown as Context;

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onCreate (/create)', () => {
    it('should require group parameter', async () => {
      const ctx = createCtx('/create title="Yoga" rrule="FREQ=DAILY"'); // missing group
      mockAccountService.getAccountForUser.mockResolvedValue({ id: 'acc_123' });

      await service.onCreate(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('`group` is required'),
        expect.anything(),
      );
    });

    it('should support named arguments with group', async () => {
      const ctx = createCtx(
        '/create title="Yoga" rrule="FREQ=DAILY" group="-100123"',
      );
      mockAccountService.getAccountForUser.mockResolvedValue({ id: 'acc_123' });
      mockEventService.createSeries.mockResolvedValue({
        id: '123',
        title: 'Yoga',
      });

      await service.onCreate(ctx);

      expect(mockEventService.createSeries).toHaveBeenCalledWith(
        'acc_123',
        expect.objectContaining({
          title: 'Yoga',
          recurrence: 'FREQ=DAILY',
        }),
      );
    });
  });

  describe('onId (/id)', () => {
    it('should return chat information', async () => {
      const ctx = createCtx('/id');
      await service.onId(ctx);
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Chat ID: `123`'),
        expect.anything(),
      );
    });
  });

  describe('onAnnounce (/announce)', () => {
    it('should send announcement to target group if series has chatId', async () => {
      const ctx = createCtx('/announce 123');
      mockAccountService.getAccountForUser.mockResolvedValue({ id: 'acc_123' });

      const mockSeries = {
        id: '123',
        title: 'Weekly Yoga',
        chatId: BigInt('-5193203978'),
        instances: [
          { id: 'inst_1', startTime: new Date('2026-01-21T13:00:00Z') },
        ],
      };

      mockEventService.getActiveSeries.mockResolvedValue([mockSeries]);

      await service.onAnnounce(ctx);

      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
        '-5193203978',
        'Formatted Message',
        expect.anything(),
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Announced to target group!'),
      );
    });
  });
});
