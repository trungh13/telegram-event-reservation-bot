import { Module, forwardRef } from '@nestjs/common';
import { EventService } from './event.service';
import { EventCardService } from './event-card.service';
import { SchedulerModule } from '../scheduler/scheduler.module';

@Module({
  imports: [forwardRef(() => SchedulerModule)],
  providers: [EventService, EventCardService],
  exports: [EventService, EventCardService],
})
export class EventModule {}
