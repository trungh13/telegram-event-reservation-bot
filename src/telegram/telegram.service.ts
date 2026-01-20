import { Injectable, Logger } from '@nestjs/common';
import { InjectBot, Update, Start, Help, Ctx } from 'nestjs-telegraf';
import { Context, Telegraf } from 'telegraf';
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
  async onStart(@Ctx() ctx: Context) {
    const message = ctx.message as any;
    const text = message.text || '';
    const args = text.split(' ');
    const token = args.length > 1 ? args[1] : null;

    if (token) {
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
        await ctx.reply(`Invalid or expired token. Please check your link.`);
      }
    } else {
      await ctx.reply(
        'Welcome! This bot is for event scheduling.\n\n' +
        'If you are an admin, use the link provided when you created your account to bind your user.\n' +
        'If you are a participant, stay tuned for event announcements!'
      );
    }
  }

  @Help()
  async onHelp(@Ctx() ctx: Context) {
    await ctx.reply(
      'Available commands:\n' +
      '/start - Initialize or bind account\n' +
      '/help - Show this help\n' +
      '/list - List your active event series\n' +
      '/create <title> @ <rrule> - Create a new event series (Admins only)'
    );
  }

  @Start()
  async onList(@Ctx() ctx: Context) {
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

  // Handle /list via command decorator as well
  @On('text')
  async onMessage(@Ctx() ctx: Context) {
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

        // Simple parser: /create Weekly Yoga @ FREQ=WEEKLY;BYDAY=MO
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
  }
}
