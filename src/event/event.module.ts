import { Module } from '@nestjs/common';
import { EventService } from './event.service';
import { SchedulerModule } from '../scheduler/scheduler.module';

@Module({
  imports: [SchedulerModule],
  providers: [EventService],
  exports: [EventService],
})
export class EventModule {}
