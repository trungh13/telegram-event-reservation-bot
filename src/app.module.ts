import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { TelegramModule } from './telegram/telegram.module';
import { AccountModule } from './account/account.module';
import { EventModule } from './event/event.module';
import { ParticipationModule } from './participation/participation.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { TelegramUserModule } from './telegram-user/telegram-user.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    TelegramModule,
    AccountModule,
    EventModule,
    ParticipationModule,
    SchedulerModule,
    TelegramUserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
