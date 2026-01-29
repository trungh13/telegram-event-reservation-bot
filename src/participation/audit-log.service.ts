import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type AuditAction =
  | 'PARTICIPANT_ADDED'
  | 'PARTICIPANT_REMOVED'
  | 'REGISTRATION_CLOSED'
  | 'REGISTRATION_EXTENDED';

export interface AuditLogRecord {
  id: string;
  action: AuditAction;
  telegramUserId?: bigint;
  adminUsername?: string;
  occurredAt: Date;
}

/**
 * Service for audit logging of admin actions on events
 * Uses existing AuditLog model with details JSON field
 */
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log when admin adds a participant
   */
  async logParticipantAdded(
    instanceId: string,
    userId: bigint,
    adminUsername: string,
    accountId?: string,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        accountId: accountId || 'system',
        action: 'PARTICIPANT_ADDED',
        details: {
          instanceId,
          userId: userId.toString(),
          adminUsername,
        },
      },
    });
  }

  /**
   * Log when admin removes a participant
   */
  async logParticipantRemoved(
    instanceId: string,
    userId: bigint,
    adminUsername: string,
    accountId?: string,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        accountId: accountId || 'system',
        action: 'PARTICIPANT_REMOVED',
        details: {
          instanceId,
          userId: userId.toString(),
          adminUsername,
        },
      },
    });
  }

  /**
   * Log when admin manually closes registration
   */
  async logRegistrationClosed(
    instanceId: string,
    adminUsername: string,
    accountId?: string,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        accountId: accountId || 'system',
        action: 'REGISTRATION_CLOSED',
        details: {
          instanceId,
          adminUsername,
        },
      },
    });
  }

  /**
   * Log when admin extends registration window
   */
  async logRegistrationExtended(
    instanceId: string,
    adminUsername: string,
    accountId?: string,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        accountId: accountId || 'system',
        action: 'REGISTRATION_EXTENDED',
        details: {
          instanceId,
          adminUsername,
        },
      },
    });
  }

  /**
   * Format audit action for display
   */
  formatAuditAction(action: AuditAction, details: any): string {
    const user = details.userId ? `User ${details.userId}` : '';
    const admin = details.adminUsername ? `by @${details.adminUsername}` : '';

    switch (action) {
      case 'PARTICIPANT_ADDED':
        return `✅ ${user} added ${admin}`;
      case 'PARTICIPANT_REMOVED':
        return `❌ ${user} removed ${admin}`;
      case 'REGISTRATION_CLOSED':
        return `🔒 Registration closed ${admin}`;
      case 'REGISTRATION_EXTENDED':
        return `🔓 Registration extended ${admin}`;
      default:
        return `📝 Unknown action`;
    }
  }
}
