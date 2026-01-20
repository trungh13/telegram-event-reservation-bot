import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import { TelegramUserService } from '../telegram-user/telegram-user.service';

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramUser: TelegramUserService,
  ) {}

  async bindUserToAccount(accountId: string, tgUser: {
    id: bigint;
    username?: string;
    firstName?: string;
    lastName?: string;
  }) {
    // 1. Ensure user exists
    await this.telegramUser.ensureUser(tgUser);

    // 2. Create binding
    return this.prisma.accountUserBinding.upsert({
      where: {
        accountId_telegramUserId: {
          accountId,
          telegramUserId: tgUser.id,
        },
      },
      create: {
        accountId,
        telegramUserId: tgUser.id,
        role: 'OWNER', // Default to OWNER for deep-link binding for now
      },
      update: {
        role: 'OWNER',
      },
    });
  }

  async createAccount(name: string) {
    const account = await this.prisma.account.create({
      data: { name },
    });

    const apiKey = await this.generateApiKey(account.id);

    return {
      account,
      apiKey: apiKey.key,
    };
  }

  async generateApiKey(accountId: string) {
    const key = `sk_${crypto.randomBytes(24).toString('hex')}`;
    return this.prisma.apiKey.create({
      data: {
        key,
        accountId,
      },
    });
  }

  async validateApiKey(key: string) {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { key },
      include: { account: true },
    });

    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    return apiKey.account;
  }
}
