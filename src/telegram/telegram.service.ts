import { Injectable, Logger } from '@nestjs/common';
import { InjectBot, Update, Start, Help, On, Ctx } from 'nestjs-telegraf';
import { Context, Telegraf } from 'telegraf';

@Update()
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(@InjectBot() private readonly bot: Telegraf<Context>) {}

  @Start()
  async onStart(@Ctx() ctx: Context) {
    await ctx.reply('Welcome to the Event Booking System!');
  }

  @Help()
  async onHelp(@Ctx() ctx: Context) {
    await ctx.reply('Send me a message for help.');
  }

  @On('text')
  async onMessage(@Ctx() ctx: Context) {
    if ('text' in ctx.message!) {
        const text = ctx.message.text;
        this.logger.log(`Received message: ${text}`);
         // TODO: Implement command handling logic here or dispatch to other services
    }
  }
}
