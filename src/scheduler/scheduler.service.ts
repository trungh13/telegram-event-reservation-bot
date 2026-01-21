import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf, Context } from 'telegraf';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectBot() private readonly bot: Telegraf<Context>,
  ) {}

  @Cron('0 0 * * *')
  async handleCron() {
    this.logger.log('Running materialization cron at midnight...');
    await this.materializeInstances();
  }

  async materializeInstances() {
    const activeSeries = await this.prisma.eventSeries.findMany({
      where: { isActive: true },
    });

    const now = new Date();
    const horizon = new Date();
    horizon.setDate(now.getDate() + 2); // 48h / approx next day window

    for (const series of activeSeries) {
      try {
        await this.processSeries(series, now, horizon);
      } catch (error) {
        this.logger.error(`Error processing series ${series.id}: ${error.message}`);
      }
    }
  }

  private get isDevMode(): boolean {
    return process.env.ENV === 'dev';
  }

  private debug(message: string, ...args: unknown[]): void {
    if (this.isDevMode) {
      this.logger.debug(`[Debug] ${message}`, ...args);
    }
  }

  public async processSeries(series: any, start: Date = new Date(), end?: Date) {
    const horizon = end || new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    const { rrulestr, RRule } = require('rrule');
    let rule: any;
    
    this.debug(`processSeries - Series: ${series.title} (${series.id})`);
    this.debug(`processSeries - Recurrence: ${JSON.stringify(series.recurrence)}`);
    
    const recurrence = series.recurrence;
    if (typeof recurrence === 'string') {
      try {
        const hasDtStart = recurrence.includes('DTSTART');
        this.debug(`processSeries - Using rrulestr, hasDtStart: ${hasDtStart}`);
        rule = rrulestr(recurrence, hasDtStart ? {} : { dtstart: series.createdAt });
      } catch (e) {
        this.debug(`processSeries - rrulestr failed, falling back to RRule.fromString: ${e.message}`);
        rule = RRule.fromString(recurrence);
      }
    } else {
      this.debug(`processSeries - Using new RRule(object)`);
      rule = new RRule({
        ...recurrence,
        dtstart: series.createdAt,
      });
    }

    const dates = rule.between(start, horizon, true);
    this.debug(`processSeries - Generated dates count: ${dates.length}`);
    if (dates.length > 0) {
        this.debug(`processSeries - First date: ${dates[0].toISOString()}`);
    }

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
        const instance = await this.prisma.eventInstance.create({
          data: {
            seriesId: series.id,
            startTime: date,
            endTime: new Date(date.getTime() + 60 * 60 * 1000), // Default 1h duration
          },
        });

        await this.notifyAdmins(series, instance);
      }
    }
  }

  private async notifyAdmins(series: any, instance: any) {
    const admins = await this.prisma.accountUserBinding.findMany({
      where: {
        accountId: series.accountId,
        role: 'ADMIN',
      },
      include: {
        telegramUser: true,
      },
    });

    for (const admin of admins) {
      try {
        const message = `🔔 **New Instance Materialized**\n\n` +
          `Series: **${series.title}**\n` +
          `Time: \`${instance.startTime.toLocaleString()}\`\n\n` +
          `You can now announce this using:\n` +
          `\`/announce ${series.id}\``;
          
        await this.bot.telegram.sendMessage(admin.telegramUserId.toString(), message, { parse_mode: 'Markdown' });
      } catch (e) {
        this.logger.error(`Failed to notify admin ${admin.telegramUserId}: ${e.message}`);
      }
    }
  }
}
