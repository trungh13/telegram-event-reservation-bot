import { Module } from '@nestjs/common';
import { ParticipationService } from './participation.service';
import { TelegramUserModule } from '../telegram-user/telegram-user.module';

@Module({
  imports: [TelegramUserModule],
  providers: [ParticipationService],
  exports: [ParticipationService],
})
export class ParticipationModule {}
