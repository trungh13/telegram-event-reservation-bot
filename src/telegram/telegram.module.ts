import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegrafModule } from 'nestjs-telegraf';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegramController } from './telegram.controller';
import { AccountModule } from '../account/account.module';
import { EventModule } from '../event/event.module';
import { ParticipationModule } from '../participation/participation.module';
import { WizardHandler } from './wizard.handler';

@Module({
  imports: [
    AccountModule,
    EventModule,
    ParticipationModule,
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const token =
          configService.get<string>('TELEGRAM_BOT_TOKEN') || 'CHANGE_ME';
        if (token === 'CHANGE_ME') {
          console.warn('Telegram token not set, skipping bot launch.');
          return { token, options: {}, launchOptions: false };
        }
        return {
          token,
          launchOptions: {},
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [TelegramController],
  providers: [TelegramService, WizardHandler],
  exports: [TelegramService],
})
export class TelegramModule {}
