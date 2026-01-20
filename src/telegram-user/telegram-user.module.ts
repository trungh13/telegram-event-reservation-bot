import { Module } from '@nestjs/common';
import { TelegramUserService } from './telegram-user.service';

@Module({
  providers: [TelegramUserService],
  exports: [TelegramUserService],
})
export class TelegramUserModule {}
