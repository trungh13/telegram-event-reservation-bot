import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventSeries, EventInstance } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf, Context, Markup } from 'telegraf';
import { EventService } from '../event/event.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectBot() private readonly bot: Telegraf<Context>,
    @Inject(forwardRef(() => EventService))
    private readonly eventService: EventService,
  ) {}

  @Cron('* * * * *') // Run every minute
  async handleCron() {
    this.debug('Running materialization cron...');
    await this.materializeInstances();
  }

  async materializeInstances() {
    const activeSeries = await this.prisma.eventSeries.findMany({
      where: { isActive: true },
    });

    const now = new Date();
    const horizon = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes ahead

    for (const series of activeSeries) {
      try {
        await this.processSeries(series, now, horizon);
      } catch (error) {
        this.logger.error(
          `Error processing series ${series.id}: ${error.message}`,
        );
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

  public async processSeries(
    series: EventSeries,
    start: Date = new Date(),
    end?: Date,
  ): Promise<void> {
    // Default to 10 minutes ahead (just-in-time materialization)
    const horizon = end || new Date(start.getTime() + 10 * 60 * 1000);

    const { rrulestr, RRule } = require('rrule');
    let rule: { between: (start: Date, end: Date, inc: boolean) => Date[] };

    this.debug(`processSeries - Series: ${series.title} (${series.id})`);
    this.debug(
      `processSeries - Recurrence: ${JSON.stringify(series.recurrence)}`,
    );

    const recurrence = series.recurrence;
    if (typeof recurrence === 'string') {
      try {
        const hasDtStart = recurrence.includes('DTSTART');
        this.debug(`processSeries - Using rrulestr, hasDtStart: ${hasDtStart}`);
        rule = rrulestr(
          recurrence,
          hasDtStart ? {} : { dtstart: series.createdAt },
        );
      } catch (e) {
        this.debug(
          `processSeries - rrulestr failed, falling back to RRule.fromString: ${(e as Error).message}`,
        );
        rule = RRule.fromString(recurrence);
      }
    } else {
      this.debug(`processSeries - Using new RRule(object)`);
      rule = new RRule({
        ...(recurrence as Record<string, unknown>),
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
        this.logger.log(
          `Materializing instance for series ${series.title} at ${date}`,
        );
        const instance = await this.prisma.eventInstance.create({
          data: {
            seriesId: series.id,
            startTime: date,
            endTime: new Date(date.getTime() + 60 * 60 * 1000), // Default 1h duration
          },
        });

        // Auto-Announce if target group is set
        await this.autoAnnounce(series, instance);
        await this.notifyAdmins(series, instance);
      }
    }
  }

  private async autoAnnounce(
    series: EventSeries,
    instance: EventInstance,
  ): Promise<void> {
    if (!series.chatId) return;

    try {
      const text = await this.eventService.formatAttendanceMessage(
        series,
        instance,
      );
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ JOIN', `JOIN:${instance.id}`),
          Markup.button.callback('➕ +1', `PLUS_ONE:${instance.id}`),
          Markup.button.callback('❌ LEAVE', `LEAVE:${instance.id}`),
        ],
      ]);

      const sentMsg = await this.bot.telegram.sendMessage(
        series.chatId.toString(),
        text,
        {
          ...keyboard,
          message_thread_id: series.topicId
            ? parseInt(series.topicId)
            : undefined,
          parse_mode: 'Markdown',
        },
      );

      await this.prisma.eventInstance.update({
        where: { id: instance.id },
        data: {
          announcementMessageId: BigInt(sentMsg.message_id),
          announcementChatId: BigInt(sentMsg.chat.id),
        },
      });

      this.logger.log(
        `Auto-announced instance ${instance.id} to chat ${series.chatId}`,
      );
    } catch (e) {
      this.logger.error(
        `Failed to auto-announce instance ${instance.id}: ${(e as Error).message}`,
      );
    }
  }

  private async notifyAdmins(
    series: EventSeries,
    instance: EventInstance,
  ): Promise<void> {
    const admins = await this.prisma.accountUserBinding.findMany({
      where: {
        accountId: series.accountId,
        role: { in: ['ADMIN', 'OWNER'] },
      },
      include: {
        telegramUser: true,
      },
    });

    for (const admin of admins) {
      try {
        const message =
          `🔔 **Instance Materialized**\n\n` +
          `Series: **${series.title}**\n` +
          `Time: \`${instance.startTime.toLocaleString()}\`\n\n` +
          (series.chatId
            ? `✅ Automatically announced to group.`
            : `You can announce this using:\n\`/announce ${series.id}\``);

        await this.bot.telegram.sendMessage(
          admin.telegramUserId.toString(),
          message,
          { parse_mode: 'Markdown' },
        );
      } catch (e) {
        this.logger.error(
          `Failed to notify admin ${admin.telegramUserId}: ${e.message}`,
        );
      }
    }
  }
}
