import { Test, TestingModule } from '@nestjs/testing';
import { TelegramUserService } from './telegram-user.service';

describe('TelegramUserService', () => {
  let service: TelegramUserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TelegramUserService],
    }).compile();

    service = module.get<TelegramUserService>(TelegramUserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
