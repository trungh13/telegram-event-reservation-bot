import { Test, TestingModule } from '@nestjs/testing';
import { TelegramService } from './telegram.service';
import { AccountService } from '../account/account.service';
import { EventService } from '../event/event.service';
import { ParticipationService } from '../participation/participation.service';
import { Context } from 'telegraf';
import { getBotToken } from 'nestjs-telegraf';

describe('TelegramService', () => {
  let service: TelegramService;
  let mockAccountService: any;
  let mockEventService: any;

  const mockBot = {
    telegram: {
      sendMessage: jest.fn(),
      getChatMember: jest.fn(),
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
    };

    const mockParticipationService = {
      recordParticipation: jest.fn(),
    };

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
  });

  const createCtx = (text: string, fromId = 123) => ({
    message: { text, message_id: 1 },
    reply: jest.fn(),
    from: { id: fromId },
    chat: { id: fromId, type: 'private' },
    botInfo: { id: 999 },
    telegram: mockBot.telegram,
  } as unknown as Context);

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onCreate (/create)', () => {
    it('should validate invalid input', async () => {
      const ctx = createCtx('/create title="Yoga"'); // missing rrule
      mockAccountService.getAccountForUser.mockResolvedValue({ id: 1 });

      await service.onCreate(ctx);
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Usage (Named)'));
    });

    it('should support named arguments', async () => {
      const ctx = createCtx('/create title="Yoga Named" rrule="FREQ=DAILY"');
      mockAccountService.getAccountForUser.mockResolvedValue({ id: 'acc_123' });
      mockEventService.createSeries.mockResolvedValue({ id: '123', title: 'Yoga Named' });

      await service.onCreate(ctx);

      expect(mockEventService.createSeries).toHaveBeenCalledWith('acc_123', expect.objectContaining({
        title: 'Yoga Named',
        recurrence: 'FREQ=DAILY',
      }));
    });

    it('should support positional arguments', async () => {
      const ctx = createCtx('/create "Yoga Positional" "FREQ=WEEKLY"');
      mockAccountService.getAccountForUser.mockResolvedValue({ id: 'acc_456' });
      mockEventService.createSeries.mockResolvedValue({ id: '124', title: 'Yoga Positional' });

      await service.onCreate(ctx);

      expect(mockEventService.createSeries).toHaveBeenCalledWith('acc_456', expect.objectContaining({
        title: 'Yoga Positional',
        recurrence: 'FREQ=WEEKLY',
      }));
    });
  });

  describe('onId (/id)', () => {
    it('should return chat information', async () => {
      const ctx = createCtx('/id');
      await service.onId(ctx);
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Chat ID: `123`'),
        expect.anything()
      );
    });
  });
});
