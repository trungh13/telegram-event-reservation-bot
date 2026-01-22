import { Module, forwardRef } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { ScheduleModule } from '@nestjs/schedule';
import { TelegrafModule } from 'nestjs-telegraf';
import { EventModule } from '../event/event.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TelegrafModule,
    forwardRef(() => EventModule),
  ],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
