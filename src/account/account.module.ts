import { Module } from '@nestjs/common';
import { AccountService } from './account.service';
import { GroupService } from './group.service';
import { TelegramUserModule } from '../telegram-user/telegram-user.module';

@Module({
  imports: [TelegramUserModule],
  providers: [AccountService, GroupService],
  exports: [AccountService, GroupService],
})
export class AccountModule {}
