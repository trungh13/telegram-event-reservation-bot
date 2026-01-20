import { Body, Controller, Post, Param, ForbiddenException } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Context, Telegraf } from 'telegraf';
import { ConfigService } from '@nestjs/config';

@Controller('webhook')
export class TelegramController {
  constructor(
    @InjectBot() private readonly bot: Telegraf<Context>,
    private readonly configService: ConfigService,
  ) {}

  @Post(':token')
  async onUpdate(@Param('token') token: string, @Body() update: any) {
    const secretToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (token !== secretToken) {
      throw new ForbiddenException('Invalid token');
    }
    
    await this.bot.handleUpdate(update);
    return { ok: true };
  }
}
