import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SchedulerService } from '../scheduler/scheduler.service';

@Injectable()
export class EventService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => SchedulerService))
    private readonly schedulerService: SchedulerService,
  ) {}

  async createSeries(accountId: string, data: {
    title: string;
    description?: string;
    timezone?: string;
    recurrence: any;
    chatId?: bigint;
    topicId?: string;
    maxParticipants?: number;
  }) {
    // Verify account exists
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    const series = await (this.prisma.eventSeries as any).create({
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

  async formatAttendanceMessage(series: any, instance: any): Promise<string> {
    const participants = await this.prisma.participationLog.findMany({
        where: { instanceId: instance.id },
        include: { telegramUser: true },
        orderBy: { createdAt: 'asc' }
    });

    const latestVotes = new Map<string, any>();
    for (const p of participants) {
        latestVotes.set(p.telegramUserId.toString(), p);
    }

    const attendees: string[] = [];
    let count = 0;

    for (const vote of Array.from(latestVotes.values())) {
        if (vote.action === 'JOIN' || vote.action === 'PLUS_ONE') {
            const user = vote.telegramUser;
            const name = user.firstName + (user.lastName ? ` ${user.lastName}` : '');
            const suffix = vote.action === 'PLUS_ONE' ? ' (+1)' : '';
            attendees.push(`• ${name}${suffix}`);
            count += (vote.action === 'PLUS_ONE' ? 2 : 1);
        }
    }

    let msg = `📅 **${series.title}**\n`;
    msg += `⏰ \`${instance.startTime.toLocaleString()}\`\n`;
    
    if ((series as any).maxParticipants) {
        msg += `👥 **Capacity:** ${count}/${(series as any).maxParticipants}\n`;
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
