import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ParticipationService {
  constructor(private readonly prisma: PrismaService) {}

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

    // 2. Upsert telegram user
    await this.prisma.telegramUser.upsert({
      where: { id: data.telegramUser.id },
      create: {
        id: data.telegramUser.id,
        username: data.telegramUser.username,
        firstName: data.telegramUser.firstName,
        lastName: data.telegramUser.lastName,
      },
      update: {
        username: data.telegramUser.username,
        firstName: data.telegramUser.firstName,
        lastName: data.telegramUser.lastName,
      },
    });

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
