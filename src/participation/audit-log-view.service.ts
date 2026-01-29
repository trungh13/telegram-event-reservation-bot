import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogRecord {
  id: string;
  action: string;
  details: Record<string, any>;
  occurredAt: Date;
}

export interface AuditLogResult {
  logs: AuditLogRecord[];
  total: number;
  hasMore: boolean;
}

/**
 * Service for viewing and formatting audit logs for admins
 */
@Injectable()
export class AuditLogViewService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get audit logs for a specific event instance
   * Uses Prisma JSON query to find logs by instanceId in details
   *
   * @param instanceId Event instance ID
   * @param limit Number of logs to fetch (0 = all)
   * @returns Logs and metadata
   */
  async getInstanceAuditLogs(
    instanceId: string,
    limit: number = 10,
  ): Promise<AuditLogResult> {
    // Get total count
    const total = await this.prisma.auditLog.count({
      where: {
        details: {
          path: ['instanceId'],
          equals: instanceId,
        },
      },
    });

    // Get logs
    const logs = await this.prisma.auditLog.findMany({
      where: {
        details: {
          path: ['instanceId'],
          equals: instanceId,
        },
      },
      orderBy: { occurredAt: 'desc' },
      take: limit === 0 ? undefined : limit,
    });

    // Check if there are more logs
    const hasMore = limit > 0 && logs.length > 0 && total > limit;

    return {
      logs: logs as AuditLogRecord[],
      total,
      hasMore,
    };
  }

  /**
   * Format audit logs for Telegram display
   *
   * @param logs Audit logs to format
   * @param showing Number of logs shown
   * @param total Total number of logs
   * @returns Formatted message
   */
  formatAuditLogMessage(
    logs: AuditLogRecord[],
    showing: number,
    total: number,
  ): string {
    if (logs.length === 0) {
      return '📋 **Audit Log:**\n\nNo actions recorded yet.';
    }

    const actions = logs
      .map((log) => {
        const time = log.occurredAt.toLocaleString();
        const details = this.formatActionDetails(log);
        return `• ${time}\n  ${details}`;
      })
      .join('\n\n');

    const moreText =
      showing < total
        ? `\n\n*${total - showing} more actions available*`
        : '';

    return (
      `📋 **Audit Log** (${showing} of ${total}):\n\n` + actions + moreText
    );
  }

  /**
   * Format individual audit action for display
   */
  private formatActionDetails(log: AuditLogRecord): string {
    const details = log.details || {};
    const admin = details.adminUsername ? `@${details.adminUsername}` : 'System';

    switch (log.action) {
      case 'PARTICIPANT_ADDED':
        return `✅ User ${details.userId} added by ${admin}`;
      case 'PARTICIPANT_REMOVED':
        return `❌ User ${details.userId} removed by ${admin}`;
      case 'REGISTRATION_CLOSED':
        return `🔒 Registration closed by ${admin}`;
      case 'REGISTRATION_EXTENDED':
        return `🔓 Registration extended by ${admin}`;
      default:
        return `📝 ${log.action}`;
    }
  }

  /**
   * Get event instances with audit activity
   * Returns instances sorted by most recent activity
   */
  async getInstancesWithActivity(accountId: string): Promise<any[]> {
    const instances = await this.prisma.eventInstance.findMany({
      where: {
        series: {
          accountId,
          isActive: true,
        },
      },
      include: {
        series: {
          select: {
            title: true,
          },
        },
      },
      orderBy: {
        startTime: 'desc',
      },
      take: 20,
    });

    return instances;
  }
}
