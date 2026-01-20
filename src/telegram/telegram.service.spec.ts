import { Test, TestingModule } from '@nestjs/testing';
import { TelegramService } from './telegram.service';
import { AccountService } from '../account/account.service';
import { EventService } from '../event/event.service';
import { ParticipationService } from '../participation/participation.service';
import { Context } from 'telegraf';
import { getBotToken } from 'nestjs-telegraf';

describe('TelegramService', () => {
  let service: TelegramService;
  let accountService: AccountService;
  let eventService: EventService;

  const mockBot = {
    telegram: {
      sendMessage: jest.fn(),
    },
  };

  const mockAccountService = {
    validateApiKey: jest.fn(),
    bindUserToAccount: jest.fn(),
    getAccountForUser: jest.fn(),
  };

  const mockEventService = {
    createSeries: jest.fn(),
    getActiveSeries: jest.fn(),
  };

  const mockParticipationService = {
    recordParticipation: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramService,
        { provide: AccountService, useValue: mockAccountService },
        { provide: EventService, useValue: mockEventService },
        { provide: ParticipationService, useValue: mockParticipationService },
        { provide: getBotToken(), useValue: mockBot },
      ],
    }).compile();

    service = module.get<TelegramService>(TelegramService);
    accountService = module.get<AccountService>(AccountService);
    eventService = module.get<EventService>(EventService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onList (/list)', () => {
    it('should validate invalid account', async () => {
      const ctx = {
        from: { id: 123 },
        reply: jest.fn(),
      } as unknown as Context;

      mockAccountService.getAccountForUser.mockResolvedValue(null);
      await service.onList(ctx);
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Use /start <token> first'));
    });
  });

  describe('onCreate (/create)', () => {
    it('should validate invalid input', async () => {
      const ctx = {
        message: { text: '/create "Yoga"' },
        reply: jest.fn(),
        from: { id: 123 },
      } as unknown as Context;

      mockAccountService.getAccountForUser.mockResolvedValue({ id: 1 });

      await service.onCreate(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Usage: /create'));
    });

    it('should validate invalid rrule via Zod', async () => {
      const ctx = {
        message: { text: '/create "Yoga" "INVALID_RRULE"' },
        reply: jest.fn(),
        from: { id: 123 },
      } as unknown as Context;

      mockAccountService.getAccountForUser.mockResolvedValue({ id: 1 });

      await service.onCreate(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Validation Error'));
    });

    it('should validate invalid date format', async () => {
      const ctx = {
        message: { text: '/create "Yoga" "FREQ=DAILY" "bad-date"' },
        reply: jest.fn(),
        from: { id: 123 },
      } as unknown as Context;

      mockAccountService.getAccountForUser.mockResolvedValue({ id: 1 });

      await service.onCreate(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Invalid date format'));
    });
  });

  describe('bindUserHelper (/start)', () => {
    it('should validate invalid token format', async () => {
      const ctx = {
        from: { id: 123, username: 'test' },
        reply: jest.fn(),
      } as unknown as Context;

      await (service as any).bindUserHelper(ctx, 'invalid_token');

      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('❌ Invalid token format'));
    });

    it('should proceed with valid token format', async () => {
      const ctx = {
        from: { id: 123, username: 'test' },
        reply: jest.fn(),
      } as unknown as Context;

      const validToken = 'sk_123456789012345678901234567890';
      mockAccountService.validateApiKey.mockResolvedValue({ id: 1, name: 'Test' });

      await (service as any).bindUserHelper(ctx, validToken);

      expect(mockAccountService.validateApiKey).toHaveBeenCalledWith(validToken);
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Successfully bound'));
    });
  });
});
