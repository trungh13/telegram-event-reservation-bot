import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegrafModule } from 'nestjs-telegraf';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        token: configService.get<string>('TELEGRAM_BOT_TOKEN') || 'CHANGE_ME',
        launchOptions: {
           // We will use webhook later, but for dev polling is fine if token is set.
           // For now, let's stick to default/polling unless webhook is explicitly requested in plan to start immediately.
           // The plan said "Telegram Webhook Integration".
           // So we should configure webhook.
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
