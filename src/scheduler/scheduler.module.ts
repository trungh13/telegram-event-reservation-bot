import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { ScheduleModule } from '@nestjs/schedule';
import { TelegrafModule } from 'nestjs-telegraf';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TelegrafModule,
  ],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
