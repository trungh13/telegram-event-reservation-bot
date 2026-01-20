import { Injectable, Logger } from '@nestjs/common';
import { InjectBot, Update, Start, Help, On, Ctx, Command, Action } from 'nestjs-telegraf';
import { Context, Telegraf, Markup } from 'telegraf';
import { AccountService } from '../account/account.service';
import { EventService } from '../event/event.service';
import { ParticipationService } from '../participation/participation.service';

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
  async onStart(@Ctx() ctx: Context): Promise<any> {
    const message = ctx.message as any;
    const text = message.text || '';
    const args = text.split(' ');
    const token = args.length > 1 ? args[1] : null;

    if (token) {
      return this.bindUserHelper(ctx, token);
    }

    await ctx.reply(
      'Welcome to the Event Booking System!\n\n' +
      'To bind your account, use /token <api_key> or click your invite link.\n' +
      'If you are a participant, stay tuned for event announcements!'
    );
  }

  @Command('token')
  async onToken(@Ctx() ctx: Context): Promise<any> {
    const message = ctx.message as any;
    const text = message.text || '';
    const args = text.split(' ');
    const token = args.length > 1 ? args[1] : null;

    if (!token) {
      return ctx.reply('Usage: /token <api_key>');
    }

    return this.bindUserHelper(ctx, token);
  }

  @Help()
  async onHelp(@Ctx() ctx: Context): Promise<any> {
    await ctx.reply(
      'Available commands:\n' +
      '/start - Welcome message\n' +
      '/token <key> - Bind your account (or use deep link)\n' +
      '/help - Show this help\n' +
      '/list - List your active event series\n' +
      '/create <title> @ <rrule> - Create a new event series (Admins only)\n' +
      '/announce - Post the next upcoming event (Admins only)'
    );
  }

  private async bindUserHelper(ctx: Context, token: string) {
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
      await ctx.reply(`Invalid or expired token. Please check your link or copy the key correctly.`);
    }
  }

  @Command('list')
  async onList(@Ctx() ctx: Context): Promise<any> {
    const account = await this.accountService.getAccountForUser(BigInt(ctx.from!.id));
    if (!account) {
      return ctx.reply('You are not bound to any account. Use /start <token> first.');
    }

    const series = await this.eventService.getActiveSeries(account.id);
    if (series.length === 0) {
      return ctx.reply('No active event series found.');
    }

    const list = series.map(s => `- ${s.title} (${s.recurrence})`).join('\n');
    await ctx.reply(`Active Event Series:\n${list}`);
  }

  @On('text')
  async onMessage(@Ctx() ctx: Context): Promise<any> {
    const message = ctx.message as any;
    const text = message.text || '';

    if (text.startsWith('/list')) {
        return this.onList(ctx);
    }

    if (text.startsWith('/create')) {
        const account = await this.accountService.getAccountForUser(BigInt(ctx.from!.id));
        if (!account) {
          return ctx.reply('Admin only. Link your account first.');
        }

        const content = text.replace('/create', '').trim();
        const [title, recurrence] = content.split('@').map(s => s.trim());

        if (!title || !recurrence) {
          return ctx.reply('Usage: /create <title> @ <rrule>\nExample: /create Yoga @ FREQ=WEEKLY;BYDAY=MO');
        }

        try {
          const series = await this.eventService.createSeries(account.id, {
            title,
            recurrence: recurrence,
          });
          await ctx.reply(`Created series: ${series.title}`);
        } catch (error) {
          await ctx.reply(`Error creating series: ${error.message}`);
        }
    }

    if (text.startsWith('/announce')) {
        const account = await this.accountService.getAccountForUser(BigInt(ctx.from!.id));
        if (!account) return ctx.reply('Admin only.');

        const activeSeries = await this.eventService.getActiveSeries(account.id);
        if (activeSeries.length === 0) return ctx.reply('No active series to announce.');

        const series = activeSeries[0];
        const instance = (series as any).instances?.[0];

        if (!instance) return ctx.reply('No instances materialized yet.');

        const keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ JOIN', `JOIN:${instance.id}`),
            Markup.button.callback('➕ +1', `PLUS_ONE:${instance.id}`),
            Markup.button.callback('❌ LEAVE', `LEAVE:${instance.id}`),
          ]
        ]);

        await ctx.reply(`📅 ${series.title}\n⏰ ${instance.startTime.toLocaleString()}\n\nWho's in?`, keyboard);
    }
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
