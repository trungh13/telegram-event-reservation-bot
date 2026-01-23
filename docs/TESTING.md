# Testing Guide

Comprehensive testing strategy for the Event Booking System.

---

## Overview

We use multiple testing layers to ensure reliability:

| Layer | Tool | Scope | Coverage |
|-------|------|-------|----------|
| **Unit** | Jest | Individual services/functions | 80%+ |
| **Integration** | Supertest | API endpoints | In progress |
| **E2E** | Custom | Full user flows | Planned |

---

## Running Tests

### All Tests
```bash
# Run once
pnpm test

# Watch mode (re-runs on file changes)
pnpm test:watch

# Coverage report
pnpm test:cov

# Specific file
pnpm test event.service.spec.ts

# Match pattern
pnpm test --testNamePattern="should create"
```

### Coverage Goals

| Type | Target |
|------|--------|
| Services | 80%+ |
| Utilities | 90%+ |
| Controllers | 70%+ |
| **Overall** | **75%+** |

**View coverage**:
```bash
pnpm test:cov
# Opens coverage/index.html in browser
```

---

## Test Structure

Each module has corresponding `.spec.ts` file:

```
src/
├── event/
│   ├── event.service.ts
│   └── event.service.spec.ts    ← Tests for EventService
├── telegram/
│   ├── telegram.service.ts
│   └── telegram.service.spec.ts ← Tests for TelegramService
└── ...
```

---

## Writing Tests

### Basic Service Test

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { EventService } from './event.service';
import { PrismaService } from '../prisma/prisma.service';
import { SchedulerService } from '../scheduler/scheduler.service';

describe('EventService', () => {
  let service: EventService;
  let prisma: PrismaService;

  beforeEach(async () => {
    // Create test module
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventService,
        {
          provide: PrismaService,
          useValue: {
            account: { findUnique: jest.fn() },
            eventSeries: { create: jest.fn() },
            // Mock other methods as needed
          },
        },
        {
          provide: SchedulerService,
          useValue: { processSeries: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<EventService>(EventService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('createSeries', () => {
    it('should create event series successfully', async () => {
      // Arrange
      const accountId = 'acc-123';
      const input = {
        title: 'Weekly Yoga',
        description: 'Relaxing yoga session',
        timezone: 'Europe/Helsinki',
        recurrence: 'FREQ=WEEKLY;BYDAY=TU',
        chatId: BigInt('-100123'),
        maxParticipants: 20,
      };

      jest.spyOn(prisma.account, 'findUnique').mockResolvedValue({
        id: accountId,
        name: 'Test Org',
      } as any);

      jest.spyOn(prisma.eventSeries, 'create').mockResolvedValue({
        id: 'series-1',
        ...input,
        accountId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      // Act
      const result = await service.createSeries(accountId, input);

      // Assert
      expect(result.title).toBe('Weekly Yoga');
      expect(result.isActive).toBe(true);
      expect(prisma.eventSeries.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: 'Weekly Yoga' }),
        })
      );
    });

    it('should throw NotFoundException for missing account', async () => {
      // Arrange
      jest.spyOn(prisma.account, 'findUnique').mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.createSeries('invalid-id', {
          title: 'Test',
          recurrence: 'FREQ=DAILY',
        })
      ).rejects.toThrow('Account invalid-id not found');
    });

    it('should handle null timezone by using default', async () => {
      // Arrange
      jest.spyOn(prisma.account, 'findUnique').mockResolvedValue({
        id: 'acc-1',
      } as any);

      jest.spyOn(prisma.eventSeries, 'create').mockResolvedValue({
        id: 'series-1',
        timezone: 'Europe/Helsinki', // Default
      } as any);

      // Act
      const result = await service.createSeries('acc-1', {
        title: 'Event',
        recurrence: 'FREQ=DAILY',
      });

      // Assert
      expect(prisma.eventSeries.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            timezone: 'Europe/Helsinki',
          }),
        })
      );
    });
  });

  describe('formatAttendanceMessage', () => {
    it('should format message with attendees', async () => {
      // Arrange
      const series = {
        title: 'Yoga',
        maxParticipants: 20,
      };

      const instance = {
        id: 'inst-1',
        startTime: new Date('2026-01-25T18:00:00Z'),
      };

      jest.spyOn(prisma.participationLog, 'findMany').mockResolvedValue([
        {
          telegramUserId: BigInt(123),
          action: 'JOIN',
          telegramUser: {
            firstName: 'John',
            lastName: 'Doe',
          },
        } as any,
      ]);

      // Act
      const message = await service.formatAttendanceMessage(series, instance);

      // Assert
      expect(message).toContain('📅 **Yoga**');
      expect(message).toContain('John Doe');
      expect(message).toContain('1/20');
    });

    it('should show "No one yet" when no attendees', async () => {
      // Arrange
      const series = { title: 'Event', maxParticipants: null };
      const instance = { id: 'inst-1', startTime: new Date() };

      jest.spyOn(prisma.participationLog, 'findMany').mockResolvedValue([]);

      // Act
      const message = await service.formatAttendanceMessage(series, instance);

      // Assert
      expect(message).toContain('No one yet');
    });

    it('should count PLUS_ONE as 2 participants', async () => {
      // Arrange
      const series = { title: 'Event', maxParticipants: 50 };
      const instance = { id: 'inst-1', startTime: new Date() };

      jest.spyOn(prisma.participationLog, 'findMany').mockResolvedValue([
        {
          telegramUserId: BigInt(123),
          action: 'PLUS_ONE',
          telegramUser: { firstName: 'Jane', lastName: 'Smith' },
        } as any,
      ]);

      // Act
      const message = await service.formatAttendanceMessage(series, instance);

      // Assert
      expect(message).toContain('2/50');
      expect(message).toContain('Jane Smith (+1)');
    });
  });
});
```

### Test Best Practices

#### 1. **Arrange-Act-Assert Pattern**
```typescript
it('should create series', async () => {
  // Arrange - setup data and mocks
  const input = { title: 'Test' };
  jest.spyOn(prisma.account, 'findUnique').mockResolvedValue({ id: 'a1' });

  // Act - execute the code under test
  const result = await service.createSeries('a1', input);

  // Assert - verify the result
  expect(result.title).toBe('Test');
});
```

#### 2. **One Assertion Per Test** (when possible)
```typescript
// ✅ Good - focused test
it('should set isActive to true', async () => {
  const result = await service.createSeries('a1', input);
  expect(result.isActive).toBe(true);
});

// ❌ Avoid - testing multiple things
it('should create series correctly', async () => {
  const result = await service.createSeries('a1', input);
  expect(result.title).toBe('Test');
  expect(result.isActive).toBe(true);
  expect(result.createdAt).toBeDefined();
});
```

#### 3. **Clear Test Names**
```typescript
// ✅ Good - describes behavior
it('should throw NotFoundException when account not found')
it('should format message with attendee count and capacity')
it('should exclude LEAVE votes from attendance count')

// ❌ Bad - vague
it('handles account error')
it('formats correctly')
it('processes votes')
```

#### 4. **Mock External Dependencies**
```typescript
// ✅ Good - isolated unit test
const module = await Test.createTestingModule({
  providers: [
    ServiceUnderTest,
    {
      provide: PrismaService,
      useValue: { /* mocked methods */ },
    },
  ],
}).compile();

// ❌ Bad - uses real database
const service = new ServiceUnderTest(realPrismaService);
```

#### 5. **Test Error Cases**
```typescript
describe('error cases', () => {
  it('should throw NotFoundException for missing account', async () => {
    jest.spyOn(prisma.account, 'findUnique').mockResolvedValue(null);

    await expect(
      service.createSeries('invalid', input)
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException for empty title', async () => {
    const validation = CreateEventSeriesSchema.safeParse({
      title: '',
      recurrence: 'FREQ=DAILY',
    });

    expect(validation.success).toBe(false);
  });
});
```

---

## Testing Services

### ParticipationService Example

```typescript
describe('ParticipationService', () => {
  let service: ParticipationService;
  let prisma: PrismaService;
  let telegramUserService: TelegramUserService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ParticipationService,
        { provide: PrismaService, useValue: mockPrisma() },
        { provide: TelegramUserService, useValue: mockTelegramUserService() },
      ],
    }).compile();

    service = module.get(ParticipationService);
    prisma = module.get(PrismaService);
    telegramUserService = module.get(TelegramUserService);
  });

  describe('recordParticipation', () => {
    it('should record JOIN action', async () => {
      const input = {
        instanceId: 'inst-1',
        telegramUser: { id: BigInt(123), username: 'john' },
        action: 'JOIN',
      };

      jest.spyOn(prisma.eventInstance, 'findUnique').mockResolvedValue({
        id: 'inst-1',
      } as any);

      jest.spyOn(telegramUserService, 'ensureUser').mockResolvedValue(null);

      jest
        .spyOn(prisma.participationLog, 'create')
        .mockResolvedValue({ id: 'log-1', ...input } as any);

      const result = await service.recordParticipation(input);

      expect(result.action).toBe('JOIN');
      expect(telegramUserService.ensureUser).toHaveBeenCalled();
    });

    it('should throw NotFoundException for missing instance', async () => {
      jest.spyOn(prisma.eventInstance, 'findUnique').mockResolvedValue(null);

      await expect(
        service.recordParticipation({
          instanceId: 'invalid',
          telegramUser: { id: BigInt(123) },
          action: 'JOIN',
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('should support PLUS_ONE action', async () => {
      const input = {
        instanceId: 'inst-1',
        telegramUser: { id: BigInt(123) },
        action: 'PLUS_ONE',
      };

      jest.spyOn(prisma.eventInstance, 'findUnique').mockResolvedValue({
        id: 'inst-1',
      } as any);

      jest.spyOn(telegramUserService, 'ensureUser').mockResolvedValue(null);

      jest
        .spyOn(prisma.participationLog, 'create')
        .mockResolvedValue({ id: 'log-1', ...input } as any);

      const result = await service.recordParticipation(input);

      expect(result.action).toBe('PLUS_ONE');
    });
  });

  describe('getCurrentParticipation', () => {
    it('should return participation logs ordered by created desc', async () => {
      const logs = [
        {
          id: '1',
          action: 'JOIN',
          createdAt: new Date('2026-01-25T15:00:00'),
          telegramUser: { firstName: 'Alice' },
        },
        {
          id: '2',
          action: 'LEAVE',
          createdAt: new Date('2026-01-25T14:00:00'),
          telegramUser: { firstName: 'Bob' },
        },
      ];

      jest.spyOn(prisma.participationLog, 'findMany').mockResolvedValue(logs as any);

      const result = await service.getCurrentParticipation('inst-1');

      expect(result).toHaveLength(2);
      expect(result[0].action).toBe('JOIN'); // Most recent first
    });
  });
});
```

---

## Testing Validation

### Schema Validation Tests

```typescript
describe('Zod Schemas', () => {
  describe('CreateEventSeriesSchema', () => {
    it('should accept valid input', () => {
      const input = {
        title: 'Weekly Yoga',
        recurrence: 'FREQ=WEEKLY;BYDAY=TU',
        chatId: '-100123456789',
      };

      const result = CreateEventSeriesSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it('should reject empty title', () => {
      const input = {
        title: '',
        recurrence: 'FREQ=WEEKLY',
      };

      const result = CreateEventSeriesSchema.safeParse(input);

      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toBe('Title cannot be empty');
    });

    it('should reject title > 100 chars', () => {
      const input = {
        title: 'a'.repeat(101),
        recurrence: 'FREQ=WEEKLY',
      };

      const result = CreateEventSeriesSchema.safeParse(input);

      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('too long');
    });

    it('should reject rrule without FREQ', () => {
      const input = {
        title: 'Event',
        recurrence: 'INTERVAL=2',
      };

      const result = CreateEventSeriesSchema.safeParse(input);

      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('FREQ=');
    });

    it('should accept optional chatId', () => {
      const input = {
        title: 'Event',
        recurrence: 'FREQ=DAILY',
      };

      const result = CreateEventSeriesSchema.safeParse(input);

      expect(result.success).toBe(true);
    });
  });

  describe('BindAccountSchema', () => {
    it('should accept valid token', () => {
      const result = BindAccountSchema.safeParse({
        token: 'sk_' + 'a'.repeat(50),
      });

      expect(result.success).toBe(true);
    });

    it('should reject token without sk_ prefix', () => {
      const result = BindAccountSchema.safeParse({
        token: 'invalid_token_123',
      });

      expect(result.success).toBe(false);
    });

    it('should reject token < 30 chars', () => {
      const result = BindAccountSchema.safeParse({
        token: 'sk_short',
      });

      expect(result.success).toBe(false);
    });
  });
});
```

---

## Mocking Patterns

### Mock Prisma Service

```typescript
const mockPrisma = () => ({
  account: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  eventSeries: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
  eventInstance: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
  participationLog: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  telegramUser: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
  },
  accountUserBinding: {
    findFirst: jest.fn(),
    upsert: jest.fn(),
  },
  apiKey: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
});
```

### Mock Telegraf Context

```typescript
const mockContext = () => ({
  from: {
    id: 123456789,
    username: 'testuser',
    first_name: 'Test',
    last_name: 'User',
  },
  chat: {
    id: 123456789,
    type: 'private',
  },
  message: {
    text: '/start sk_test',
    message_id: 1,
  },
  reply: jest.fn(),
  answerCbQuery: jest.fn(),
  telegram: {
    sendMessage: jest.fn(),
    getChatMember: jest.fn(),
    editMessageText: jest.fn(),
  },
  botInfo: {
    id: 987654321,
  },
});
```

---

## Coverage Checklist

When adding new code, test:

- ✅ Happy path (everything works)
- ✅ Missing required fields
- ✅ Invalid input formats
- ✅ Missing resources (NotFound)
- ✅ Unauthorized access
- ✅ Capacity/limit exceeded
- ✅ Edge cases (empty lists, boundary values)
- ✅ Null/undefined handling
- ✅ Error propagation

---

## Debugging Tests

### Run Single Test
```bash
pnpm test --testNamePattern="should create series"
```

### Debug Mode
```bash
node --inspect-brk -r tsconfig-paths/register -r ts-node/register \
  node_modules/.bin/jest --runInBand
```

### View Mocks
```typescript
console.log(prisma.account.findUnique.mock.calls);
// Shows all calls to the mock
```

---

## CI/CD Integration

Tests should run automatically:
```yaml
# .github/workflows/test.yml (example)
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: pnpm/action-setup@v2
      - name: Install dependencies
        run: pnpm install
      - name: Run tests
        run: pnpm test:cov
      - name: Upload coverage
        run: npx codecov
```

---

## Next Steps

1. ✅ Understand test structure
2. ✅ Read example tests
3. 📝 Write tests for your changes
4. 🧪 Run `pnpm test` before committing
5. 📊 Check coverage: `pnpm test:cov`

