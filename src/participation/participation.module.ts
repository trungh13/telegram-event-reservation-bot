import { Module } from '@nestjs/common';
import { ParticipationService } from './participation.service';
import { AuditLogService } from './audit-log.service';
import { ParticipantAdminService } from './participant-admin.service';
import { AuditLogViewService } from './audit-log-view.service';
import { TelegramUserModule } from '../telegram-user/telegram-user.module';

@Module({
  imports: [TelegramUserModule],
  providers: [
    ParticipationService,
    AuditLogService,
    ParticipantAdminService,
    AuditLogViewService,
  ],
  exports: [
    ParticipationService,
    AuditLogService,
    ParticipantAdminService,
    AuditLogViewService,
  ],
})
export class ParticipationModule {}
