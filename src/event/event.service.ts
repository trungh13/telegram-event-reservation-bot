import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { EventSeries, EventInstance, ParticipationLog } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SchedulerService } from '../scheduler/scheduler.service';

interface CreateSeriesInput {
  title: string;
  description?: string;
  timezone?: string;
  recurrence: string | Record<string, string | number | boolean | null>;
  chatId?: bigint;
  topicId?: string;
  maxParticipants?: number;
}

interface ParticipationLogWithUser extends ParticipationLog {
  telegramUser: {
    firstName: string | null;
    lastName: string | null;
  };
}

@Injectable()
export class EventService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => SchedulerService))
    private readonly schedulerService: SchedulerService,
  ) {}

  async createSeries(accountId: string, data: CreateSeriesInput): Promise<EventSeries> {
    // Verify account exists
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    const series = await this.prisma.eventSeries.create({
      data: {
        accountId,
        title: data.title,
        description: data.description,
        timezone: data.timezone ?? 'Europe/Helsinki',
        recurrence: data.recurrence,
        chatId: data.chatId,
        topicId: data.topicId,
        maxParticipants: data.maxParticipants,
      },
    });

    // Trigger immediate materialization
    await this.schedulerService.processSeries(series);

    return series;
  }

  async getActiveSeries(accountId: string) {
    return this.prisma.eventSeries.findMany({
      where: {
        accountId,
        isActive: true,
      },
      include: {
        instances: {
          where: {
            startTime: {
              gte: new Date(Date.now() - 5 * 60 * 1000), // 5 min buffer
            },
          },
          take: 5,
          orderBy: {
            startTime: 'asc',
          },
        },
      },
    });
  }

  async formatAttendanceMessage(
    series: EventSeries,
    instance: EventInstance,
  ): Promise<string> {
    const participants = await this.prisma.participationLog.findMany({
      where: { instanceId: instance.id },
      include: { telegramUser: true },
      orderBy: { createdAt: 'asc' },
    });

    const latestVotes = new Map<string, ParticipationLogWithUser>();
    for (const p of participants) {
      latestVotes.set(p.telegramUserId.toString(), p as ParticipationLogWithUser);
    }

    const attendees: string[] = [];
    let count = 0;

    for (const vote of Array.from(latestVotes.values())) {
      if (vote.action === 'JOIN' || vote.action === 'PLUS_ONE') {
        const user = vote.telegramUser;
        const name =
          (user.firstName || '') + (user.lastName ? ` ${user.lastName}` : '');
        const suffix = vote.action === 'PLUS_ONE' ? ' (+1)' : '';
        attendees.push(`• ${name}${suffix}`);
        count += vote.action === 'PLUS_ONE' ? 2 : 1;
      }
    }

    let msg = `📅 **${series.title}**\n`;
    msg += `⏰ \`${instance.startTime.toLocaleString()}\`\n`;

    if (series.maxParticipants) {
      msg += `👥 **Capacity:** ${count}/${series.maxParticipants}\n`;
    }

    msg += `\n**Who's in?**\n`;
    if (attendees.length > 0) {
      msg += attendees.join('\n') + '\n';
    } else {
      msg += `_No one yet_\n`;
    }

    return msg;
  }
}
