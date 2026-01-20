import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

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
