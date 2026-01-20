import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventService {
  constructor(private readonly prisma: PrismaService) {}

  async createSeries(accountId: string, data: {
    title: string;
    description?: string;
    timezone?: string;
    recurrence: any;
  }) {
    // Verify account exists
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    return this.prisma.eventSeries.create({
      data: {
        accountId,
        title: data.title,
        description: data.description,
        timezone: data.timezone ?? 'Europe/Helsinki',
        recurrence: data.recurrence,
      },
    });
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
              gte: new Date(),
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
