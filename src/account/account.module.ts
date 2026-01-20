import { AccountService } from './account.service';
import { TelegramUserModule } from '../telegram-user/telegram-user.module';

@Module({
  imports: [TelegramUserModule],
  providers: [AccountService],
  exports: [AccountService],
})
export class AccountModule {}
