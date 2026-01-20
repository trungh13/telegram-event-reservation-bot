import { Test, TestingModule } from '@nestjs/testing';
import { TelegramUserService } from './telegram-user.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaService = {
  telegramUser: {
    upsert: jest.fn(),
  },
};

describe('TelegramUserService', () => {
  let service: TelegramUserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramUserService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<TelegramUserService>(TelegramUserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
