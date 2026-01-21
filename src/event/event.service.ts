import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SchedulerService } from '../scheduler/scheduler.service';

@Injectable()
export class EventService {
  constructor(
    private readonly prisma: PrismaService,
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
}
