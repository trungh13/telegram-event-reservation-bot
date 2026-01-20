import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramUserService } from '../telegram-user/telegram-user.service';

@Injectable()
export class ParticipationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramUser: TelegramUserService,
  ) {}

  async recordParticipation(data: {
    instanceId: string;
    telegramUser: {
      id: bigint;
      username?: string;
      firstName?: string;
      lastName?: string;
    };
    action: string;
    payload?: any;
  }) {
    // 1. Ensure instance exists
    const instance = await this.prisma.eventInstance.findUnique({
      where: { id: data.instanceId },
    });

    if (!instance) {
      throw new NotFoundException(`Event instance ${data.instanceId} not found`);
    }

    // 2. Ensure Telegram user exists
    await this.telegramUser.ensureUser(data.telegramUser);

    // 3. Create participation log entry
    return this.prisma.participationLog.create({
      data: {
        instanceId: data.instanceId,
        telegramUserId: data.telegramUser.id,
        action: data.action,
        payload: data.payload,
      },
    });
  }

  async getCurrentParticipation(instanceId: string) {
    // This will derive the current state from the append-only log in the future.
    // For now, return all logs.
    return this.prisma.participationLog.findMany({
      where: { instanceId },
      orderBy: { createdAt: 'desc' },
      include: {
        telegramUser: true,
      },
    });
  }
}
