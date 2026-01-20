import { Body, Controller, Post, Param, ForbiddenException, Logger } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Context, Telegraf } from 'telegraf';
import { ConfigService } from '@nestjs/config';

@Controller('webhook')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(
    @InjectBot() private readonly bot: Telegraf<Context>,
    private readonly configService: ConfigService,
  ) {}

  private get isDevMode(): boolean {
    return process.env.ENV === 'dev';
  }

  @Post(':token')
  async onUpdate(@Param('token') token: string, @Body() update: any) {
    const secretToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (token !== secretToken) {
      this.logger.warn('Invalid webhook token attempt');
      throw new ForbiddenException('Invalid token');
    }
    
    if (this.isDevMode) {
      this.logger.debug(`[Debug] Webhook received: ${JSON.stringify(update, null, 2)}`);
    }

    await this.bot.handleUpdate(update);
    return { ok: true };
  }
}
