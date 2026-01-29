import { Body, Controller, Post, Param, Logger } from '@nestjs/common';
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
    if (this.isDevMode) {
      this.logger.log(
        `[Debug] Incoming Webhook - Token: ${token.substring(0, 5)}...`,
      );
      this.logger.debug(`[Debug] Body: ${JSON.stringify(update, null, 2)}`);
    }

    const secretToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');

    await this.bot.handleUpdate(update);
    return { ok: true };
  }
}
