import { Module } from '@nestjs/common';
import { ParticipationService } from './participation.service';

@Module({
  providers: [ParticipationService],
  exports: [ParticipationService],
})
export class ParticipationModule {}
