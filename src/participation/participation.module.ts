import { Module } from '@nestjs/common';
import { ParticipationService } from './participation.service';
import { AuditLogService } from './audit-log.service';
import { ParticipantAdminService } from './participant-admin.service';
import { TelegramUserModule } from '../telegram-user/telegram-user.module';

@Module({
  imports: [TelegramUserModule],
  providers: [ParticipationService, AuditLogService, ParticipantAdminService],
  exports: [ParticipationService, AuditLogService, ParticipantAdminService],
})
export class ParticipationModule {}
