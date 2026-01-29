/**
 * Wizard Handler - Manages the step-by-step /create flow
 */

import { Injectable, Logger } from '@nestjs/common';
import { Context, Markup } from 'telegraf';
import { wizardState, CreateWizardState } from './wizard.state';
import { Keyboards } from './keyboards';
import { PrismaService } from '../prisma/prisma.service';
import { EventService } from '../event/event.service';
import { AccountService } from '../account/account.service';

@Injectable()
export class WizardHandler {
  private readonly logger = new Logger(WizardHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventService,
    private readonly accountService: AccountService,
  ) {}

  // Step 1: Start wizard - ask for title
  async startWizard(ctx: Context): Promise<void> {
    const account = await this.accountService.getAccountForUser(BigInt(ctx.from!.id));
    if (!account) {
      await ctx.reply('❌ Please link your account first with /start <key>');
      return;
    }

    const msg = await ctx.reply('📋 **Create New Event**\n\nWhat\'s the event name?', {
      parse_mode: 'Markdown',
    });

    wizardState.start(ctx.from!.id, msg.message_id);
  }

  // Handle text input (for title)
  async handleTextInput(ctx: Context, text: string): Promise<boolean> {
    const state = wizardState.get(ctx.from!.id);
    if (!state) return false;

    if (state.step === 'title') {
      wizardState.update(ctx.from!.id, { title: text, step: 'frequency' });
      await this.showFrequencyStep(ctx, text);
      return true;
    }

    return false;
  }

  // Step 2: Show frequency options
  private async showFrequencyStep(ctx: Context, title: string): Promise<void> {
    await ctx.reply(
      `How often does "${title}" repeat?`,
      Keyboards.frequency(),
    );
  }

  // Handle frequency selection
  async handleFrequency(ctx: Context, frequency: string): Promise<void> {
    const state = wizardState.get(ctx.from!.id);
    if (!state) {
      await ctx.answerCbQuery('⏰ Session expired. Start over with /create');
      return;
    }

    wizardState.update(ctx.from!.id, {
      frequency: frequency as CreateWizardState['frequency'],
      step: frequency === 'WEEKLY' ? 'day' : 'time',
    });

    await ctx.answerCbQuery();

    if (frequency === 'WEEKLY') {
      await ctx.reply('Which day of the week?', Keyboards.day());
    } else {
      await this.showTimeStep(ctx);
    }
  }

  // Handle day selection (for weekly)
  async handleDay(ctx: Context, day: string): Promise<void> {
    const state = wizardState.get(ctx.from!.id);
    if (!state) {
      await ctx.answerCbQuery('⏰ Session expired. Start over with /create');
      return;
    }

    wizardState.update(ctx.from!.id, { day, step: 'time' });
    await ctx.answerCbQuery();
    await this.showTimeStep(ctx);
  }

  // Step 5: Show time options
  private async showTimeStep(ctx: Context): Promise<void> {
    await ctx.reply('What time?', Keyboards.time());
  }

  // Handle time selection
  async handleTime(ctx: Context, time: string): Promise<void> {
    const state = wizardState.get(ctx.from!.id);
    if (!state) {
      await ctx.answerCbQuery('⏰ Session expired. Start over with /create');
      return;
    }

    wizardState.update(ctx.from!.id, { time, step: 'group' });
    await ctx.answerCbQuery();
    await this.showGroupStep(ctx);
  }

  // Step 6: Show group selection
  private async showGroupStep(ctx: Context): Promise<void> {
    const account = await this.accountService.getAccountForUser(BigInt(ctx.from!.id));
    if (!account) {
      await ctx.reply('❌ Account not found.');
      wizardState.clear(ctx.from!.id);
      return;
    }

    // Get groups linked to this account (groups where events have been created)
    const groups = await this.prisma.eventSeries.findMany({
      where: {
        accountId: account.id,
        chatId: { not: null },
      },
      select: { chatId: true },
      distinct: ['chatId'],
    });

    if (groups.length === 0) {
      await ctx.reply(
        '📍 **No groups linked yet.**\n\n' +
        'To link a group:\n' +
        '1. Add me to your Telegram group\n' +
        '2. Run `/id` in that group to get the ID\n' +
        '3. Reply here with the group ID (e.g., `-1001234567890`)',
        { parse_mode: 'Markdown' },
      );
      wizardState.update(ctx.from!.id, { step: 'group' });
      return;
    }

    // For now, show chat IDs - in future could fetch group names
    const groupButtons = groups.map((g) => ({
      id: g.chatId!.toString(),
      name: `Group ${g.chatId!.toString().slice(-6)}`,
    }));

    await ctx.reply('Which group should I post to?', Keyboards.groups(groupButtons));
  }

  // Handle group selection
  async handleGroup(ctx: Context, groupId: string, groupName: string): Promise<void> {
    const state = wizardState.get(ctx.from!.id);
    if (!state) {
      await ctx.answerCbQuery('⏰ Session expired. Start over with /create');
      return;
    }

    wizardState.update(ctx.from!.id, { groupId, groupName, step: 'limit' });
    await ctx.answerCbQuery();
    await ctx.reply('Max participants? (optional)', Keyboards.limit());
  }

  // Handle group ID text input (for new groups)
  async handleGroupIdInput(ctx: Context, groupId: string): Promise<boolean> {
    const state = wizardState.get(ctx.from!.id);
    if (!state || state.step !== 'group') return false;

    // Validate it's a negative number
    try {
      const id = BigInt(groupId);
      if (id > 0) {
        await ctx.reply('❌ Group IDs are negative (e.g., `-1001234567890`). Try again.');
        return true;
      }

      // Verify bot is in the group
      try {
        await ctx.telegram.getChat(groupId);
      } catch {
        await ctx.reply('❌ I cannot access that group. Make sure I\'m a member.');
        return true;
      }

      wizardState.update(ctx.from!.id, {
        groupId,
        groupName: `Group ${groupId.slice(-6)}`,
        step: 'limit',
      });
      await ctx.reply('Max participants? (optional)', Keyboards.limit());
      return true;
    } catch {
      await ctx.reply('❌ Invalid group ID. Use format like `-1001234567890`');
      return true;
    }
  }

  // Handle limit selection
  async handleLimit(ctx: Context, limit: string): Promise<void> {
    const state = wizardState.get(ctx.from!.id);
    if (!state) {
      await ctx.answerCbQuery('⏰ Session expired. Start over with /create');
      return;
    }

    const limitNum = parseInt(limit) || undefined;
    wizardState.update(ctx.from!.id, { limit: limitNum, step: 'confirm' });
    await ctx.answerCbQuery();
    await this.showConfirmation(ctx);
  }

  // Step 8: Show confirmation
  private async showConfirmation(ctx: Context): Promise<void> {
    const state = wizardState.get(ctx.from!.id);
    if (!state) return;

    const dayNames: Record<string, string> = {
      MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday',
      FR: 'Friday', SA: 'Saturday', SU: 'Sunday',
    };

    const freqDisplay = state.frequency === 'WEEKLY' && state.day
      ? `Weekly on ${dayNames[state.day]}`
      : state.frequency === 'ONCE' ? 'Once' : state.frequency;

    const limitDisplay = state.limit ? `${state.limit} people` : 'No limit';

    const summary =
      `📋 **Ready to create:**\n\n` +
      `**Title:** ${state.title}\n` +
      `**Frequency:** ${freqDisplay}\n` +
      `**Time:** ${state.time}\n` +
      `**Group:** ${state.groupName}\n` +
      `**Limit:** ${limitDisplay}`;

    await ctx.reply(summary, {
      parse_mode: 'Markdown',
      ...Keyboards.confirm(),
    });
  }

  // Handle confirmation
  async handleConfirm(ctx: Context, confirmed: boolean): Promise<void> {
    const state = wizardState.get(ctx.from!.id);
    if (!state) {
      await ctx.answerCbQuery('⏰ Session expired. Start over with /create');
      return;
    }

    await ctx.answerCbQuery();

    if (!confirmed) {
      wizardState.clear(ctx.from!.id);
      await ctx.reply('❌ Event creation cancelled.');
      return;
    }

    // Create the event
    const account = await this.accountService.getAccountForUser(BigInt(ctx.from!.id));
    if (!account) {
      await ctx.reply('❌ Account not found.');
      wizardState.clear(ctx.from!.id);
      return;
    }

    try {
      const rrule = wizardState.generateRRule(state);

      // Calculate start time
      const now = new Date();
      const startDate = wizardState.calculateStartDate(state, now);

      // Add DTSTART to rrule
      const iso = startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const finalRrule = `DTSTART:${iso}\n${rrule}`;

      const series = await this.eventService.createSeries(account.id, {
        title: state.title!,
        recurrence: finalRrule,
        chatId: state.groupId ? BigInt(state.groupId) : undefined,
        maxParticipants: state.limit,
      });

      wizardState.clear(ctx.from!.id);

      await ctx.reply(
        `✅ **Event Created!**\n\n` +
        `"${series.title}" has been created.\n` +
        `It will be announced ~5-10 minutes before each occurrence.`,
        { parse_mode: 'Markdown' },
      );
    } catch (error) {
      this.logger.error(`Failed to create event: ${(error as Error).message}`);
      await ctx.reply(`❌ Failed to create event: ${(error as Error).message}`);
      wizardState.clear(ctx.from!.id);
    }
  }

  // Handle cancel
  async handleCancel(ctx: Context): Promise<void> {
    wizardState.clear(ctx.from!.id);
    await ctx.answerCbQuery('Cancelled');
    await ctx.reply('❌ Event creation cancelled.');
  }
}
