import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface GroupInfo {
  id: string;
  eventCount: number;
}

/**
 * Service for managing groups linked to accounts via event series
 */
@Injectable()
export class GroupService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all groups for an account (derived from chatId in event series)
   *
   * @param accountId Account to query
   * @returns List of unique groups with event counts
   */
  async getGroupsForAccount(accountId: string): Promise<GroupInfo[]> {
    const events = await this.prisma.eventSeries.findMany({
      where: {
        accountId,
        isActive: true,
      },
      select: {
        id: true,
        title: true,
        chatId: true,
      },
    });

    // Group by chatId and count
    const groupMap = new Map<string, number>();

    for (const event of events) {
      if (!event.chatId) continue; // Skip events without group
      const groupId = event.chatId.toString();
      groupMap.set(groupId, (groupMap.get(groupId) || 0) + 1);
    }

    // Convert to sorted list
    return Array.from(groupMap.entries())
      .map(([id, eventCount]) => ({ id, eventCount }))
      .sort((a, b) => b.eventCount - a.eventCount); // Most events first
  }

  /**
   * Get a specific group by ID for an account
   *
   * @param accountId Account to query
   * @param groupId Group ID (Telegram chat ID)
   * @returns Group info or null if not found
   */
  async getGroupById(
    accountId: string,
    groupId: string,
  ): Promise<GroupInfo | null> {
    const groups = await this.getGroupsForAccount(accountId);
    return groups.find((g) => g.id === groupId) || null;
  }

  /**
   * Format groups list for Telegram message
   */
  formatGroupsMessage(groups: GroupInfo[]): string {
    if (groups.length === 0) {
      return (
        '📍 **Groups linked to your account:**\n\n' +
        'No groups yet. Add me to a Telegram group and create an event there!'
      );
    }

    const groupLines = groups
      .map(
        (g) =>
          `• Group \`${g.id}\` (${g.eventCount} event${g.eventCount === 1 ? '' : 's'})`,
      )
      .join('\n');

    return (
      '📍 **Groups linked to your account:**\n\n' +
      groupLines +
      '\n\n💡 Add me to more groups to create events there'
    );
  }
}
