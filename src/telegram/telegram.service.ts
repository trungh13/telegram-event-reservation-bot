import { Injectable, Logger } from '@nestjs/common';
import { InjectBot, Update, Start, Help, On, Ctx, Command, Action } from 'nestjs-telegraf';
import { Context, Telegraf, Markup } from 'telegraf';
import { AccountService } from '../account/account.service';
import { EventService } from '../event/event.service';
import { ParticipationService } from '../participation/participation.service';
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
  ) {}

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
      `**Commands:**\n` +
      `• \`/start <key>\` - Bind your account (admins only)\n` +
      `• \`/create title=".." rrule=".." [group=".."]\` - Create event series\n` +
      `• \`/list\` - List active series\n` +
      `• \`/id\` - Get current chat/topic ID\n` +
      `• \`/announce\` - Post next event with voting buttons\n\n` +
      `**Example create:**\n` +
      `\`/create title="Yoga" rrule="FREQ=WEEKLY" group="-100123" date="25/01/2026 18:00"\`\n\n` +
      `**RRule Cheat Sheet:**\n` +
      `• \`FREQ\`: DAILY, WEEKLY, MONTHLY\n` +
      `• \`BYDAY\`: MO, TU, WE... (comma separated)\n` +
      `• \`INTERVAL\`: 2 (every 2nd week)\n` +
      `• \`COUNT\`: 10 (stop after 10 sessions)`;

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
        const target = anyS.chatId ? `(Target: ${anyS.chatId})` : '(No target)';
        return `ID: \`${s.id}\`\n- ${s.title} ${target}\n  ${s.recurrence}`;
    }).join('\n\n');
    await ctx.reply(`Active Event Series:\n${list}`, { parse_mode: 'Markdown' });
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
    
    // Try Key-Value parsing first
    let kv = this.parseKeyValueArgs(args);
    let title, recurrence, startDateStr, group, topic;

    if (Object.keys(kv).length > 0) {
      title = kv['title'];
      recurrence = kv['rrule'];
      startDateStr = kv['date'] || kv['start'];
      group = kv['group'] || kv['chat'];
      topic = kv['topic'];
    } else {
      // Fallback to positional quoted args
      const positional = this.parseQuotedArgs(text).slice(1);
      if (positional.length >= 2) {
         title = positional[0];
         recurrence = positional[1];
         startDateStr = positional[2];
         group = positional[3];
         topic = positional[4];
      }
    }

    if (!title || !recurrence) {
      await ctx.reply(
        'Usage (Named):\n`/create title="Weekly Yoga" rrule="FREQ=WEEKLY" date="20/01/2026 18:00"`\n\n' +
        'Usage (Positional):\n`/create "Title" "RRule" ["Date"]`',
        { parse_mode: 'Markdown' }
      );
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

    try {
      const series = await this.eventService.createSeries(account.id, {
        title,
        recurrence: recurrence,
        chatId: group ? BigInt(group) : undefined,
        topicId: topic,
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

    const activeSeries = await this.eventService.getActiveSeries(account.id);
    if (activeSeries.length === 0) {
      await ctx.reply('No active series found.');
      return;
    }

    const series = seriesId 
        ? activeSeries.find(s => s.id === seriesId)
        : activeSeries[0];

    if (!series) {
        await ctx.reply('Series not found or inactive.');
        return;
    }

    const instance = (series as any).instances?.[0];

    if (!instance) {
      await ctx.reply('No instances materialized yet.');
      return;
    }

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ JOIN', `JOIN:${instance.id}`),
        Markup.button.callback('➕ +1', `PLUS_ONE:${instance.id}`),
        Markup.button.callback('❌ LEAVE', `LEAVE:${instance.id}`),
      ]
    ]);

    await ctx.reply(`📅 ${series.title}\n⏰ ${instance.startTime.toLocaleString()}\n\nWho's in?`, keyboard);
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
    } catch (error) {
      this.logger.error(`Error recording vote: ${error.message}`);
      await ctx.answerCbQuery('Error recording vote.');
    }
  }
}
