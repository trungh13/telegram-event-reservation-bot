import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegrafModule } from 'nestjs-telegraf';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegramController } from './telegram.controller';

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const token = configService.get<string>('TELEGRAM_BOT_TOKEN') || 'CHANGE_ME';
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
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
