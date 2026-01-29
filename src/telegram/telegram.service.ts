import { Injectable, Logger } from '@nestjs/common';
import {
  InjectBot,
  Update,
  Start,
  Help,
  On,
  Ctx,
  Command,
  Action,
} from 'nestjs-telegraf';
import { Context, Telegraf, Markup } from 'telegraf';
import { EventSeries, EventInstance } from '@prisma/client';
import { AccountService } from '../account/account.service';
import { EventService } from '../event/event.service';
import { ParticipationService } from '../participation/participation.service';
import { PrismaService } from '../prisma/prisma.service';
import { BindAccountSchema, CreateEventSeriesSchema } from './telegram.dto';
import { WizardHandler } from './wizard.handler';
import { wizardState } from './wizard.state';
import { Keyboards } from './keyboards';

interface TelegramMessage {
  text?: string;
  message_thread_id?: number;
}

interface SeriesWithInstances extends EventSeries {
  instances: EventInstance[];
}

@Update()
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    @InjectBot() private readonly bot: Telegraf<Context>,
    private readonly accountService: AccountService,
    private readonly eventService: EventService,
    private readonly participationService: ParticipationService,
    private readonly prisma: PrismaService,
    private readonly wizardHandler: WizardHandler,
  ) {}

  private get isDevMode(): boolean {
    return process.env.ENV === 'dev';
  }

  private debug(message: string, ...args: unknown[]): void {
    if (this.isDevMode) {
      this.logger.debug(`[Debug] ${message}`, ...args);
    }
  }

  @Start()
  async onStart(@Ctx() ctx: Context): Promise<void> {
    const message = (ctx.message as TelegramMessage) || {};
    const text = message.text || '';
    const args = text.split(' ');
    const token = args.length > 1 ? args[1] : null;

    if (token) {
      await this.bindUserHelper(ctx, token);
      return;
    }

    await this.sendHelpMessage(ctx, 'Welcome to the Event Booking System! 📅');
  }

  @Help()
  async onHelp(@Ctx() ctx: Context): Promise<void> {
    await this.sendHelpMessage(ctx, 'Event Booking System Help 📖');
  }

  private async sendHelpMessage(ctx: Context, title: string) {
    const helpText =
      `${title}\n\n` +
      `**🔑 Getting Started**\n` +
      `/start <key> - Link your Telegram to an organization\n` +
      `  • Contact @trungh13 to get your API key\n\n` +
      `**📋 Events**\n` +
      `/create - Create a new event (step-by-step wizard)\n` +
      `/list - View and manage your events\n` +
      `/announce <id> - Manually post an event\n` +
      `/remove <id> - Remove an event series\n\n` +
      `**🔧 Utilities**\n` +
      `/id - Get the current chat's ID (use in groups)\n` +
      `/help - Show this message\n\n` +
      `**💡 Tips**\n` +
      `• Add me to your group first, then use /id there\n` +
      `• Events are announced ~5-10 minutes before start\n` +
      `• Participants can join/leave via buttons\n\n` +
      `☕️ **Support the project**\n` +
      `[Buy Me a Coffee](https://buymeacoffee.com/trungh13)`;

    await ctx.reply(helpText, { parse_mode: 'Markdown' });
  }

  private parseQuotedArgs(text: string): string[] {
    const regex = /"([^"]*)"|(\S+)/g;
    const args: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      args.push(match[1] || match[2]);
    }
    return args;
  }

  private parseKeyValueArgs(text: string): Record<string, string> {
    const args: Record<string, string> = {};
    // Matches key="value" or key=value
    const regex = /(\w+)=(?:"([^"]*)"|(\S+))/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const key = match[1].toLowerCase();
      const value = match[2] || match[3];
      args[key] = value;
    }
    return args;
  }

  private async bindUserHelper(ctx: Context, token: string) {
    const from = ctx.from;
    this.logger.log(
      `Binding attempt: User ${from?.id} (@${from?.username}) with token ${token}`,
    );

    const validation = BindAccountSchema.safeParse({ token });
    if (!validation.success) {
      const errorMsg = validation.error.issues[0].message;
      return ctx.reply(`❌ ${errorMsg}`);
    }

    try {
      const account = await this.accountService.validateApiKey(token);
      await this.accountService.bindUserToAccount(account.id, {
        id: BigInt(ctx.from!.id),
        username: ctx.from!.username,
        firstName: ctx.from!.first_name,
        lastName: ctx.from!.last_name,
      });

      await ctx.reply(
        `Successfully bound to account: ${account.name}! You are now an admin.`,
      );
    } catch (error) {
      this.logger.error(`Failed to bind user: ${error.message}`);
      await ctx.reply(`Invalid or expired token.`);
    }
  }

  @Command('list')
  async onList(@Ctx() ctx: Context): Promise<void> {
    const account = await this.accountService.getAccountForUser(
      BigInt(ctx.from!.id),
    );
    if (!account) {
      await ctx.reply('❌ Please link your account first with /start <key>');
      return;
    }

    const series = await this.eventService.getActiveSeries(account.id);
    if (series.length === 0) {
      await ctx.reply(
        "📋 **Your Events:**\n\nYou don't have any active events yet.",
        {
          parse_mode: 'Markdown',
          ...Keyboards.createEvent(),
        },
      );
      return;
    }

    // Send header
    await ctx.reply('📋 **Your Events:**', { parse_mode: 'Markdown' });

    // Send each event as a card with action buttons
    for (const s of series) {
      const recurrenceStr = String(s.recurrence || '');
      const freqMatch = recurrenceStr.match(/FREQ=(\w+)/);
      const freq = freqMatch ? freqMatch[1].toLowerCase() : 'custom';
      const freqDisplay = freq.charAt(0).toUpperCase() + freq.slice(1);

      const timeMatch = recurrenceStr.match(/(\d{2}):(\d{2})/);
      const timeDisplay = timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : '';

      const groupDisplay = s.chatId
        ? `Group ${s.chatId.toString().slice(-6)}`
        : 'No group';

      const card = `📌 **${s.title}**\n${freqDisplay}${timeDisplay ? ` · ${timeDisplay}` : ''} · ${groupDisplay}`;

      await ctx.reply(card, {
        parse_mode: 'Markdown',
        ...Keyboards.eventActions(s.id),
      });
    }

    await ctx.reply('💡 Use /create to add a new event');
  }

  @Command('id')
  async onId(@Ctx() ctx: Context): Promise<void> {
    const chat = ctx.chat;
    const threadId = ctx.message?.message_thread_id;

    let msg = `Chat ID: \`${chat?.id}\`\nType: ${chat?.type}`;
    if (threadId) {
      msg += `\nTopic ID: \`${threadId}\``;
    }

    await ctx.reply(msg, { parse_mode: 'Markdown' });
  }

  @Command('create')
  async onCreate(@Ctx() ctx: Context): Promise<void> {
    // Start the button-driven wizard flow
    await this.wizardHandler.startWizard(ctx);
  }

  @Command('announce')
  async onAnnounce(@Ctx() ctx: Context): Promise<void> {
    const account = await this.accountService.getAccountForUser(
      BigInt(ctx.from!.id),
    );
    if (!account) {
      await ctx.reply('Admin only.');
      return;
    }

    const message = (ctx.message as TelegramMessage) || {};
    const text = message.text || '';
    const args = this.parseQuotedArgs(text).slice(1);
    const seriesId = args[0];

    if (!seriesId) {
      await ctx.reply(
        '⚠️ **Series ID is required.**\n\nPlease use `/announce <ID>`.\nYou can find the ID in `/list`.',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    const activeSeries = await this.eventService.getActiveSeries(account.id);
    const series = activeSeries.find((s) => s.id === seriesId) as
      | SeriesWithInstances
      | undefined;

    if (!series) {
      await ctx.reply('Series not found or inactive.');
      return;
    }

    const instance = series.instances?.[0];
    this.debug(
      `onAnnounce - Found series: ${series.title}, Instances count: ${series.instances?.length}`,
    );

    if (!instance) {
      await ctx.reply('No instances materialized yet.');
      return;
    }

    if (instance.announcementMessageId) {
      await ctx.reply(
        '⚠️ **Already Announced**\n\nThis event has already been posted to the group.',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    const announcement = await this.eventService.formatAttendanceMessage(
      series,
      instance,
    );
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ JOIN', `JOIN:${instance.id}`),
        Markup.button.callback('➕ +1', `PLUS_ONE:${instance.id}`),
        Markup.button.callback('❌ LEAVE', `LEAVE:${instance.id}`),
      ],
    ]);

    const targetChat = series.chatId?.toString();
    const targetTopic = series.topicId;

    if (targetChat) {
      this.debug(
        `onAnnounce - Posting to target: ${targetChat}, topic: ${targetTopic}`,
      );
      const sentMsg = await ctx.telegram.sendMessage(targetChat, announcement, {
        ...keyboard,
        message_thread_id: targetTopic ? parseInt(targetTopic) : undefined,
        parse_mode: 'Markdown',
      });

      await this.prisma.eventInstance.update({
        where: { id: instance.id },
        data: {
          announcementMessageId: BigInt(sentMsg.message_id),
          announcementChatId: BigInt(sentMsg.chat.id),
        },
      });

      await ctx.reply(`✅ Announced to target group!`);
    } else {
      await ctx.reply(announcement, { ...keyboard, parse_mode: 'Markdown' });
    }
  }

  @Command('remove')
  async onRemove(@Ctx() ctx: Context): Promise<void> {
    const account = await this.accountService.getAccountForUser(
      BigInt(ctx.from!.id),
    );
    if (!account) {
      await ctx.reply('Admin only. Link your account first.');
      return;
    }

    const message = (ctx.message as TelegramMessage) || {};
    const text = message.text || '';
    const args = this.parseQuotedArgs(text).slice(1);
    const seriesId = args[0];

    if (!seriesId) {
      await ctx.reply(
        '⚠️ **Series ID is required.**\n\nUsage: `/remove <ID>`\nYou can find the ID in `/list`.',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    // Find the series and verify it belongs to this account
    const series = await this.prisma.eventSeries.findFirst({
      where: {
        id: seriesId,
        accountId: account.id,
      },
    });

    if (!series) {
      await ctx.reply(
        "❌ Series not found or you don't have permission to remove it.",
      );
      return;
    }

    // Soft delete - set isActive to false
    await this.prisma.eventSeries.update({
      where: { id: seriesId },
      data: { isActive: false },
    });

    await ctx.reply(
      `✅ **Series Removed**\n\n` +
        `"${series.title}" has been deactivated.\n` +
        `Future instances will not be created or announced.`,
      { parse_mode: 'Markdown' },
    );
  }

  @On('text')
  async onMessage(@Ctx() ctx: Context): Promise<void> {
    const message = (ctx.message as TelegramMessage) || {};
    const text = message.text || '';

    // Skip commands
    if (text.startsWith('/')) {
      return;
    }

    // Check if user is in wizard flow - handle title input
    if (await this.wizardHandler.handleTextInput(ctx, text)) {
      return;
    }

    // Check if user is entering a group ID manually
    if (text.startsWith('-')) {
      if (await this.wizardHandler.handleGroupIdInput(ctx, text)) {
        return;
      }
    }

    this.debug(`Received message: ${text}`);
  }

  @Action(/JOIN:(.+)/)
  async onJoin(@Ctx() ctx: Context): Promise<void> {
    const match = (ctx as any).match as RegExpExecArray;
    const instanceId = match[1];
    await this.recordVote(ctx, instanceId, 'JOIN');
  }

  @Action(/PLUS_ONE:(.+)/)
  async onPlusOne(@Ctx() ctx: Context): Promise<void> {
    const match = (ctx as any).match as RegExpExecArray;
    const instanceId = match[1];
    await this.recordVote(ctx, instanceId, 'PLUS_ONE');
  }

  @Action(/LEAVE:(.+)/)
  async onLeave(@Ctx() ctx: Context): Promise<void> {
    const match = (ctx as any).match as RegExpExecArray;
    const instanceId = match[1];
    await this.recordVote(ctx, instanceId, 'LEAVE');
  }

  // Wizard action handlers
  @Action('wizard:start')
  async onWizardStart(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    await this.wizardHandler.startWizard(ctx);
  }

  @Action(/wizard:freq:(.+)/)
  async onWizardFrequency(@Ctx() ctx: Context): Promise<void> {
    const match = (ctx as any).match as RegExpExecArray;
    const frequency = match[1];
    await this.wizardHandler.handleFrequency(ctx, frequency);
  }

  @Action(/wizard:day:(.+)/)
  async onWizardDay(@Ctx() ctx: Context): Promise<void> {
    const match = (ctx as any).match as RegExpExecArray;
    const day = match[1];
    await this.wizardHandler.handleDay(ctx, day);
  }

  @Action(/wizard:time:(.+)/)
  async onWizardTime(@Ctx() ctx: Context): Promise<void> {
    const match = (ctx as any).match as RegExpExecArray;
    const time = match[1];
    await this.wizardHandler.handleTime(ctx, time);
  }

  @Action(/wizard:group:(.+):(.+)/)
  async onWizardGroup(@Ctx() ctx: Context): Promise<void> {
    const match = (ctx as any).match as RegExpExecArray;
    const groupId = match[1];
    const groupName = match[2];
    await this.wizardHandler.handleGroup(ctx, groupId, groupName);
  }

  @Action(/wizard:limit:(.+)/)
  async onWizardLimit(@Ctx() ctx: Context): Promise<void> {
    const match = (ctx as any).match as RegExpExecArray;
    const limit = match[1];
    await this.wizardHandler.handleLimit(ctx, limit);
  }

  @Action(/wizard:confirm:(.+)/)
  async onWizardConfirm(@Ctx() ctx: Context): Promise<void> {
    const match = (ctx as any).match as RegExpExecArray;
    const confirmed = match[1] === 'yes';
    await this.wizardHandler.handleConfirm(ctx, confirmed);
  }

  @Action('wizard:cancel')
  async onWizardCancel(@Ctx() ctx: Context): Promise<void> {
    await this.wizardHandler.handleCancel(ctx);
  }

  // List event action handlers
  @Action(/list:announce:(.+)/)
  async onListAnnounce(@Ctx() ctx: Context): Promise<void> {
    const match = (ctx as any).match as RegExpExecArray;
    const seriesId = match[1];
    await ctx.answerCbQuery();
    // Reuse announce logic
    await this.announceSeriesById(ctx, seriesId);
  }

  @Action(/list:remove:confirm:(.+)/)
  async onListRemoveConfirm(@Ctx() ctx: Context): Promise<void> {
    const match = (ctx as any).match as RegExpExecArray;
    const seriesId = match[1];
    await ctx.answerCbQuery();
    await this.removeSeriesById(ctx, seriesId);
  }

  @Action('list:remove:cancel')
  async onListRemoveCancel(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery('Cancelled');
    await ctx.reply('Removal cancelled.');
  }

  @Action(/list:remove:(.+)/)
  async onListRemove(@Ctx() ctx: Context): Promise<void> {
    const match = (ctx as any).match as RegExpExecArray;
    const seriesId = match[1];
    await ctx.answerCbQuery();

    const series = await this.prisma.eventSeries.findUnique({
      where: { id: seriesId },
    });

    if (!series) {
      await ctx.reply('❌ Series not found.');
      return;
    }

    await ctx.reply(
      `🗑 Remove "${series.title}"?\n\nThis will stop future announcements.`,
      Keyboards.confirmRemove(seriesId),
    );
  }

  @Action(/list:edit:(.+)/)
  async onListEdit(@Ctx() ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    await ctx.reply('✏️ Edit feature coming soon!');
  }

  private async announceSeriesById(
    ctx: Context,
    seriesId: string,
  ): Promise<void> {
    const account = await this.accountService.getAccountForUser(
      BigInt(ctx.from!.id),
    );
    if (!account) {
      await ctx.reply('❌ Account not found.');
      return;
    }

    const activeSeries = await this.eventService.getActiveSeries(account.id);
    const series = activeSeries.find((s) => s.id === seriesId) as
      | SeriesWithInstances
      | undefined;

    if (!series) {
      await ctx.reply('❌ Series not found or inactive.');
      return;
    }

    const instance = series.instances?.[0];
    if (!instance) {
      await ctx.reply('❌ No instances materialized yet.');
      return;
    }

    if (instance.announcementMessageId) {
      await ctx.reply('⚠️ Already announced.');
      return;
    }

    const announcement = await this.eventService.formatAttendanceMessage(
      series,
      instance,
    );
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ JOIN', `JOIN:${instance.id}`),
        Markup.button.callback('➕ +1', `PLUS_ONE:${instance.id}`),
        Markup.button.callback('❌ LEAVE', `LEAVE:${instance.id}`),
      ],
    ]);

    const targetChat = series.chatId?.toString();
    const targetTopic = series.topicId;

    if (targetChat) {
      const sentMsg = await ctx.telegram.sendMessage(targetChat, announcement, {
        ...keyboard,
        message_thread_id: targetTopic ? parseInt(targetTopic) : undefined,
        parse_mode: 'Markdown',
      });

      await this.prisma.eventInstance.update({
        where: { id: instance.id },
        data: {
          announcementMessageId: BigInt(sentMsg.message_id),
          announcementChatId: BigInt(sentMsg.chat.id),
        },
      });

      await ctx.reply('✅ Announced!');
    } else {
      await ctx.reply(announcement, { ...keyboard, parse_mode: 'Markdown' });
    }
  }

  private async removeSeriesById(
    ctx: Context,
    seriesId: string,
  ): Promise<void> {
    const account = await this.accountService.getAccountForUser(
      BigInt(ctx.from!.id),
    );
    if (!account) {
      await ctx.reply('❌ Account not found.');
      return;
    }

    const series = await this.prisma.eventSeries.findFirst({
      where: {
        id: seriesId,
        accountId: account.id,
      },
    });

    if (!series) {
      await ctx.reply('❌ Series not found or no permission.');
      return;
    }

    await this.prisma.eventSeries.update({
      where: { id: seriesId },
      data: { isActive: false },
    });

    await ctx.reply(`✅ "${series.title}" has been removed.`);
  }

  private async recordVote(
    ctx: Context,
    instanceId: string,
    action: string,
  ): Promise<void> {
    try {
      const instance = await this.prisma.eventInstance.findUnique({
        where: { id: instanceId },
        include: { series: true },
      });

      if (!instance) {
        await ctx.answerCbQuery('Instance not found.');
        return;
      }

      // Capacity Check
      if (action === 'JOIN' || action === 'PLUS_ONE') {
        const participants = await this.prisma.participationLog.findMany({
          where: { instanceId: instance.id },
        });
        const latestVotes = new Map<string, string>();
        for (const p of participants) {
          latestVotes.set(p.telegramUserId.toString(), p.action);
        }

        let currentCount = 0;
        for (const [uid, act] of Array.from(latestVotes.entries())) {
          // Exclude current user from count to calculate potential new total
          if (uid === ctx.from!.id.toString()) continue;
          if (act === 'JOIN') currentCount += 1;
          if (act === 'PLUS_ONE') currentCount += 2;
        }

        const added = action === 'PLUS_ONE' ? 2 : 1;
        if (
          instance.series.maxParticipants &&
          currentCount + added > instance.series.maxParticipants
        ) {
          await ctx.answerCbQuery(
            `⚠️ Sorry, only ${instance.series.maxParticipants - currentCount} slots left!`,
            { show_alert: true },
          );
          return;
        }
      }

      await this.participationService.recordParticipation({
        instanceId,
        telegramUser: {
          id: BigInt(ctx.from!.id),
          username: ctx.from!.username,
          firstName: ctx.from!.first_name,
          lastName: ctx.from!.last_name,
        },
        action,
      });

      await ctx.answerCbQuery(`You ${action === 'LEAVE' ? 'left' : 'joined'}!`);

      // Live Update
      if (instance.announcementMessageId && instance.announcementChatId) {
        const updatedText = await this.eventService.formatAttendanceMessage(
          instance.series,
          instance,
        );
        const keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ JOIN', `JOIN:${instance.id}`),
            Markup.button.callback('➕ +1', `PLUS_ONE:${instance.id}`),
            Markup.button.callback('❌ LEAVE', `LEAVE:${instance.id}`),
          ],
        ]);

        try {
          await ctx.telegram.editMessageText(
            instance.announcementChatId.toString(),
            Number(instance.announcementMessageId),
            undefined,
            updatedText,
            { ...keyboard, parse_mode: 'Markdown' },
          );
        } catch (e) {
          this.logger.error(`Failed to edit message: ${(e as Error).message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error recording vote: ${(error as Error).message}`);
      await ctx.answerCbQuery('Error recording vote.');
    }
  }
}
