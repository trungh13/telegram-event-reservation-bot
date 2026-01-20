import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RRule } from 'rrule';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron() {
    this.logger.log('Running materialization cron...');
    await this.materializeInstances();
  }

  async materializeInstances() {
    const activeSeries = await this.prisma.eventSeries.findMany({
      where: { isActive: true },
    });

    const now = new Date();
    const horizon = new Date();
    horizon.setDate(now.getDate() + 30); // 30 days window

    for (const series of activeSeries) {
      try {
        await this.processSeries(series, now, horizon);
      } catch (error) {
        this.logger.error(`Error processing series ${series.id}: ${error.message}`);
      }
    }
  }

  private async processSeries(series: any, start: Date, end: Date) {
    // Basic rrule integration. Expects series.recurrence to be an RRule string or options
    let rule: RRule;
    if (typeof series.recurrence === 'string') {
      rule = RRule.fromString(series.recurrence);
    } else {
      // Map JSON to RRule options if needed, or assume it's already compatible
      rule = new RRule({
        ...series.recurrence,
        dtstart: series.createdAt, // Fallback start date
      });
    }

    const dates = rule.between(start, end);

    for (const date of dates) {
      // Ensure idempotency: check if instance already exists at this time
      const existing = await this.prisma.eventInstance.findUnique({
        where: {
          seriesId_startTime: {
            seriesId: series.id,
            startTime: date,
          },
        },
      });

      if (!existing) {
        this.logger.log(`Materializing instance for series ${series.title} at ${date}`);
        await this.prisma.eventInstance.create({
          data: {
            seriesId: series.id,
            startTime: date,
            endTime: new Date(date.getTime() + 60 * 60 * 1000), // Default 1h duration
          },
        });
      }
    }
  }
}
