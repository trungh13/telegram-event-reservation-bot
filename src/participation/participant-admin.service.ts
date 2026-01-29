import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from './audit-log.service';

export interface Participant {
  telegramUserId: bigint;
  action: string;
  username?: string;
}

/**
 * Service for admin management of participants in events
 */
@Injectable()
export class ParticipantAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Get all current participants for an event instance
   * (latest action per user wins)
   */
  async getParticipants(instanceId: string): Promise<Participant[]> {
    const allLogs = await this.prisma.participationLog.findMany({
      where: { instanceId },
    });

    // Build map of latest action per user
    const latestByUser = new Map<string, Participant>();

    for (const log of allLogs) {
      const userId = log.telegramUserId.toString();
      latestByUser.set(userId, {
        telegramUserId: log.telegramUserId,
        action: log.action,
      });
    }

    // Filter to only those who joined (not left)
    return Array.from(latestByUser.values()).filter(
      (p) => p.action === 'JOIN' || p.action === 'PLUS_ONE',
    );
  }

  /**
   * Admin adds a participant
   * Returns { error } if already joined
   */
  async addParticipant(
    instanceId: string,
    userId: bigint,
    username: string,
    adminUsername: string,
    accountId?: string,
  ): Promise<{ error?: string }> {
    // Check if already joined
    const existing = await this.prisma.participationLog.findFirst({
      where: {
        instanceId,
        telegramUserId: userId,
        action: 'JOIN',
      },
    });

    if (existing) {
      return { error: 'already_joined' };
    }

    // Upsert user
    await this.prisma.telegramUser.upsert({
      where: { id: userId },
      update: { username },
      create: {
        id: userId,
        username,
        firstName: '',
      },
    });

    // Add participation
    await this.prisma.participationLog.create({
      data: {
        instanceId,
        telegramUserId: userId,
        action: 'JOIN',
      },
    });

    // Log audit
    await this.auditLog.logParticipantAdded(
      instanceId,
      userId,
      adminUsername,
      accountId,
    );

    return {};
  }

  /**
   * Admin removes a participant
   */
  async removeParticipant(
    instanceId: string,
    userId: bigint,
    adminUsername: string,
    accountId?: string,
  ): Promise<void> {
    // Add LEAVE action
    await this.prisma.participationLog.create({
      data: {
        instanceId,
        telegramUserId: userId,
        action: 'LEAVE',
      },
    });

    // Log audit
    await this.auditLog.logParticipantRemoved(
      instanceId,
      userId,
      adminUsername,
      accountId,
    );
  }

  /**
   * Format participant list for Telegram message
   */
  formatParticipantList(participants: Participant[]): string {
    if (participants.length === 0) {
      return '✅ Participants (0): None yet';
    }

    const count = participants.length;
    const countText = count === 1 ? '1 person' : `${count} people`;

    const list = participants
      .map((p) => {
        const badge = p.action === 'PLUS_ONE' ? ' (+1)' : '';
        const name = p.username ? `@${p.username}` : `User ${p.telegramUserId}`;
        return `• ${name}${badge}`;
      })
      .join('\n');

    return `✅ Participants (${countText}):\n${list}`;
  }
}
