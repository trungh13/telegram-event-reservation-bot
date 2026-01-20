import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TelegramUserService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureUser(data: {
    id: bigint;
    username?: string;
    firstName?: string;
    lastName?: string;
  }) {
    return this.prisma.telegramUser.upsert({
      where: { id: data.id },
      create: {
        id: data.id,
        username: data.username,
        firstName: data.firstName,
        lastName: data.lastName,
      },
      update: {
        username: data.username,
        firstName: data.firstName,
        lastName: data.lastName,
      },
    });
  }
}
