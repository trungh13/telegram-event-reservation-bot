import { Injectable, Logger } from '@nestjs/common';
import { InjectBot, Update, Start, Help, On, Ctx, Command, Action } from 'nestjs-telegraf';
import { Context, Telegraf, Markup } from 'telegraf';
import { AccountService } from '../account/account.service';
import { EventService } from '../event/event.service';
import { ParticipationService } from '../participation/participation.service';
import { PrismaService } from '../prisma/prisma.service';
import { BindAccountSchema, CreateEventSeriesSchema } from './telegram.dto';

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
    const message = (ctx.message as any) || {};
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
    const helpText = `${title}\n\n` +
      `**🔑 Account Binding**\n` +
      `\`/start <key>\` - Link this Telegram account to an organization.\n` +
      `  • *Example:* \`/start abc123xyz\`\n\n` +

      `**📋 Event Creation (\`/create\`)**\n` +
      `Create recurring events with named flags:\n` +
      `\`/create title="..." rrule="..." group="..." [options]\`\n\n` +
      `  **Required Flags:**\n` +
      `  • \`title\` - Event name (e.g., \`title="Team Yoga"\`)\n` +
      `  • \`rrule\` - Recurrence rule (e.g., \`rrule="FREQ=WEEKLY"\`)\n` +
      `  • \`group\` - Target group ID (use \`/id\` to find)\n\n` +
      `  **Optional Flags:**\n` +
      `  • \`date\` or \`start\` - First occurrence (\`dd/mm/yyyy HH:mm\`)\n` +
      `  • \`limit\` - Max participants (\`limit="12"\`)\n` +
      `  • \`topic\` - Forum topic ID\n\n` +
      `  **Common Examples:**\n` +
      `  • Weekly event:\n` +
      `    \`/create title="Yoga" rrule="FREQ=WEEKLY;BYDAY=TU" group="-100123"\`\n` +
      `  • Daily with a limit:\n` +
      `    \`/create title="Standup" rrule="FREQ=DAILY" group="-100123" limit="10"\`\n` +
      `  • Every 2 weeks:\n` +
      `    \`/create title="Retro" rrule="FREQ=WEEKLY;INTERVAL=2" group="-100123"\`\n\n` +

      `**📢 Announcements**\n` +
      `\`/announce <series_id>\` - Manually post an event to its group.\n` +
      `  • Events are auto-announced by default if a \`group\` was set.\n` +
      `  • Use this to re-post or when testing.\n\n` +

      `**🔧 Utilities**\n` +
      `• \`/list\` - Show all your active event series.\n` +
      `• \`/id\` - Get the current chat's ID (use in a group).\n\n` +

      `**📖 RRule Cheat Sheet**\n` +
      `• \`FREQ\`: DAILY, WEEKLY, MONTHLY, YEARLY\n` +
      `• \`BYDAY\`: MO, TU, WE, TH, FR, SA, SU (comma separated)\n` +
      `• \`INTERVAL\`: e.g., \`2\` for every other week\n` +
      `• \`COUNT\`: e.g., \`10\` to stop after 10 occurrences\n` +
      `• \`BYMONTHDAY\`: e.g., \`1,15\` for 1st and 15th`;

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
    this.logger.log(`Binding attempt: User ${from?.id} (@${from?.username}) with token ${token}`);

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

      await ctx.reply(`Successfully bound to account: ${account.name}! You are now an admin.`);
    } catch (error) {
      this.logger.error(`Failed to bind user: ${error.message}`);
      await ctx.reply(`Invalid or expired token.`);
    }
  }

  @Command('list')
  async onList(@Ctx() ctx: Context): Promise<void> {
    const account = await this.accountService.getAccountForUser(BigInt(ctx.from!.id));
    if (!account) {
      await ctx.reply('You are not bound to any account. Use /start <token> first.');
      return;
    }

    const series = await this.eventService.getActiveSeries(account.id);
    if (series.length === 0) {
      await ctx.reply('No active event series found.');
      return;
    }

    const list = series.map(s => {
        const anyS = s as any;
        const target = anyS.chatId ? `🎯 Target: \`${anyS.chatId}\`` : '⚠️ No target';
        return `📌 **${s.title}**\n` +
               `ID: \`${s.id}\`\n` +
               `${target}\n` +
               `🔁 \`${s.recurrence}\``;
    }).join('\n\n---\n\n');

    await ctx.reply(`**Active Event Series:**\n\n${list}\n\n💡 _Tip: Use \`/announce <ID>\` to post a specific series._`, { parse_mode: 'Markdown' });
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
    const account = await this.accountService.getAccountForUser(BigInt(ctx.from!.id));
    if (!account) {
      await ctx.reply('Admin only. Link your account first.');
      return;
    }

    const message = ctx.message as any;
    const text = message.text || '';
    const args = text.replace('/create', '').trim();
    this.debug(`onCreate - args: "${args}"`);
    
    // Try Key-Value parsing first
    let kv = this.parseKeyValueArgs(args);
    this.debug(`onCreate - Parsed KV: ${JSON.stringify(kv)}`);
    let title, recurrence, startDateStr, group, topic, maxParticipants;

    if (Object.keys(kv).length > 0) {
      title = kv['title'];
      recurrence = kv['rrule'];
      startDateStr = kv['date'] || kv['start'];
      group = kv['group'] || kv['chat'];
      topic = kv['topic'];
      const limit = kv['limit'];
      maxParticipants = limit ? parseInt(limit) : undefined;
    } else {
      // Fallback to positional quoted args
      const positional = this.parseQuotedArgs(text).slice(1);
      if (positional.length >= 2) {
         title = positional[0];
         recurrence = positional[1];
         startDateStr = positional[2];
         group = positional[3];
         topic = positional[4];
         const limit = positional[5];
         maxParticipants = limit ? parseInt(limit) : undefined;
      }
    }

    if (!title || !recurrence) {
      this.debug(`Missing required fields: title=${title}, recurrence=${recurrence}`);
      await ctx.reply(
        'Usage (Named):\n`/create title="Weekly Yoga" rrule="FREQ=WEEKLY" group="-100..." date="20/01/2026 18:00"`\n\n' +
        '⚠️ `group` is required! Use `/id` in a group to get its ID.',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    if (!group) {
      this.debug(`Missing group parameter for: ${title}`);
      await ctx.reply('❌ `group` is required. Use `/id` in a group to get its ID, then pass it as `group="-100..."`', { parse_mode: 'Markdown' });
      return;
    }

    const validation = CreateEventSeriesSchema.safeParse({ title, recurrence, chatId: group, topicId: topic });
    if (!validation.success) {
      await ctx.reply(`❌ Validation Error:\n${validation.error.issues.map(e => `- ${e.message}`).join('\n')}`);
      return;
    }

    let explicitStartTime: Date | undefined = undefined;
    if (startDateStr) {
        // Parse dd/mm/yyyy HH:mm
        const [datePart, timePart] = startDateStr.split(' ');
        if (datePart && timePart) {
            const [d, m, y] = datePart.split('/').map(Number);
            const [h, mm] = timePart.split(':').map(Number);
            explicitStartTime = new Date(y, m - 1, d, h, mm);
        }
        
        if (!explicitStartTime || isNaN(explicitStartTime.getTime())) {
            await ctx.reply('❌ Invalid date format. Use "dd/mm/yyyy HH:mm"');
            return;
        }
    }

    // Verify Group Membership if targeted
    if (group) {
        try {
            await ctx.telegram.getChatMember(group, ctx.botInfo.id);
        } catch (e) {
             await ctx.reply(`❌ I cannot access the group \`${group}\`. Please add me safely first!`, { parse_mode: 'Markdown'});
             return;
        }
    }

    let finalRecurrence = recurrence;
    if (explicitStartTime) {
        // Format to iCal format: 20260120T180000Z
        const iso = explicitStartTime.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        finalRecurrence = `DTSTART:${iso}\n${recurrence}`;
    }

    try {
      const series = await this.eventService.createSeries(account.id, {
        title,
        recurrence: finalRecurrence,
        chatId: group ? BigInt(group) : undefined,
        topicId: topic,
        maxParticipants,
      });
      
      let reply = `Created series: ${series.title}`;
      if (group) reply += `\nTarget Group: ${group}`;
      if (explicitStartTime) reply += `\nStart Date: ${explicitStartTime.toLocaleString()}`;

      await ctx.reply(reply);
    } catch (error) {
      await ctx.reply(`Error creating series: ${error.message}`);
    }
  }

  @Command('announce')
  async onAnnounce(@Ctx() ctx: Context): Promise<void> {
    const account = await this.accountService.getAccountForUser(BigInt(ctx.from!.id));
    if (!account) {
      await ctx.reply('Admin only.');
      return;
    }

    const message = ctx.message as any;
    const text = message.text || '';
    const args = this.parseQuotedArgs(text).slice(1);
    const seriesId = args[0];

    if (!seriesId) {
        await ctx.reply('⚠️ **Series ID is required.**\n\nPlease use `/announce <ID>`.\nYou can find the ID in `/list`.', { parse_mode: 'Markdown' });
        return;
    }

    const activeSeries = await this.eventService.getActiveSeries(account.id);
    const series = activeSeries.find(s => s.id === seriesId);

    if (!series) {
        await ctx.reply('Series not found or inactive.');
        return;
    }

    const instance = (series as any).instances?.[0];
    this.debug(`onAnnounce - Found series: ${series.title}, Instances count: ${(series as any).instances?.length}`);

    if (!instance) {
      await ctx.reply('No instances materialized yet.');
      return;
    }

    if ((instance as any).announcementMessageId) {
        await ctx.reply('⚠️ **Already Announced**\n\nThis event has already been posted to the group.', { parse_mode: 'Markdown' });
        return;
    }

    const announcement = await this.eventService.formatAttendanceMessage(series, instance);
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ JOIN', `JOIN:${instance.id}`),
        Markup.button.callback('➕ +1', `PLUS_ONE:${instance.id}`),
        Markup.button.callback('❌ LEAVE', `LEAVE:${instance.id}`),
      ]
    ]);

    const targetChat = (series as any).chatId?.toString();
    const targetTopic = (series as any).topicId;

    if (targetChat) {
        this.debug(`onAnnounce - Posting to target: ${targetChat}, topic: ${targetTopic}`);
        const sentMsg = await ctx.telegram.sendMessage(targetChat, announcement, {
            ...keyboard,
            message_thread_id: targetTopic ? parseInt(targetTopic) : undefined,
            parse_mode: 'Markdown',
        });
        
        await (this.prisma.eventInstance as any).update({
            where: { id: instance.id },
            data: {
                announcementMessageId: BigInt(sentMsg.message_id),
                announcementChatId: BigInt(sentMsg.chat.id),
            }
        });

        await ctx.reply(`✅ Announced to target group!`);
    } else {
        await ctx.reply(announcement, { ...keyboard, parse_mode: 'Markdown' });
    }
  }


  @On('text')
  async onMessage(@Ctx() ctx: Context): Promise<void> {
    // Catch-all for other text messages
    const message = ctx.message as any;
    const text = message.text || '';
    
    // If it's a command that didn't match anything above, we can ignore or log
    if (text.startsWith('/')) {
        return;
    }

    this.logger.log(`Received message: ${text}`);
  }

  @Action(/JOIN:(.+)/)
  async onJoin(@Ctx() ctx: Context): Promise<any> {
    const instanceId = (ctx as any).match[1];
    await this.recordVote(ctx, instanceId, 'JOIN');
  }

  @Action(/PLUS_ONE:(.+)/)
  async onPlusOne(@Ctx() ctx: Context): Promise<any> {
    const instanceId = (ctx as any).match[1];
    await this.recordVote(ctx, instanceId, 'PLUS_ONE');
  }

  @Action(/LEAVE:(.+)/)
  async onLeave(@Ctx() ctx: Context): Promise<any> {
    const instanceId = (ctx as any).match[1];
    await this.recordVote(ctx, instanceId, 'LEAVE');
  }

  private async recordVote(ctx: Context, instanceId: string, action: string) {
    try {
      const instance = await this.prisma.eventInstance.findUnique({
        where: { id: instanceId },
        include: { series: true }
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
          if ((instance.series as any).maxParticipants && (currentCount + added > (instance.series as any).maxParticipants)) {
              await ctx.answerCbQuery(`⚠️ Sorry, only ${(instance.series as any).maxParticipants - currentCount} slots left!`, { show_alert: true });
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
      if ((instance as any).announcementMessageId && (instance as any).announcementChatId) {
          const updatedText = await this.eventService.formatAttendanceMessage(instance.series, instance);
          const keyboard = Markup.inlineKeyboard([
            [
              Markup.button.callback('✅ JOIN', `JOIN:${instance.id}`),
              Markup.button.callback('➕ +1', `PLUS_ONE:${instance.id}`),
              Markup.button.callback('❌ LEAVE', `LEAVE:${instance.id}`),
            ]
          ]);

          try {
              await ctx.telegram.editMessageText(
                  (instance as any).announcementChatId.toString(),
                  Number((instance as any).announcementMessageId),
                  undefined,
                  updatedText,
                  { ...keyboard, parse_mode: 'Markdown' }
              );
          } catch (e) {
              this.logger.error(`Failed to edit message: ${e.message}`);
          }
      }

    } catch (error) {
      this.logger.error(`Error recording vote: ${error.message}`);
      await ctx.answerCbQuery('Error recording vote.');
    }
  }
}
