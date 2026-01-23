# Error Handling Guide

Complete reference for error codes, exception types, and error handling patterns in the Event Booking System.

---

## Error Response Format

All errors follow a consistent structure:

```json
{
  "statusCode": 400,
  "message": "Human-readable error message",
  "error": "ERROR_CODE"
}
```

### Telegram Bot Errors

Bot responses use emoji and markdown formatting:

```
❌ Error message explaining what went wrong
```

---

## HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| `200` | OK | Request successful |
| `400` | Bad Request | Validation error in input |
| `401` | Unauthorized | Invalid/missing credentials |
| `403` | Forbidden | User lacks permissions |
| `404` | Not Found | Resource doesn't exist |
| `409` | Conflict | Business logic violation |
| `500` | Server Error | Unexpected error |

---

## Error Categories & Codes

### Authentication Errors (401)

#### INVALID_TOKEN
- **Cause**: API key doesn't exist or is malformed
- **User message**: `❌ Invalid or expired token.`
- **Action**: Verify token format and validity

```typescript
if (!apiKey) {
  throw new UnauthorizedException('Invalid API key');
}
```

**Telegram**: User runs `/start sk_invalid_key`
```
❌ Invalid token format.
Token must start with 'sk_' and be at least 30 characters.
```

#### TOKEN_FORMAT_INVALID
- **Cause**: Token doesn't match expected format (`sk_<hex>`)
- **User message**: `❌ Invalid token format.`
- **Details**: Must start with 'sk_' and be 40-60 characters

```typescript
export const BindAccountSchema = z.object({
  token: z
    .string()
    .startsWith('sk_', 'Invalid token format.')
    .min(30, 'Token is too short'),
});
```

---

### Validation Errors (400)

#### TITLE_REQUIRED
- **Cause**: Event title missing in /create command
- **Message**: `❌ Title cannot be empty`

```typescript
title: z.string().min(1, 'Title cannot be empty')
```

#### TITLE_TOO_LONG
- **Cause**: Event title exceeds maximum length
- **Message**: `❌ Title is too long (max 100 characters)`

```typescript
title: z.string().max(100, 'Title is too long')
```

#### RRULE_INVALID
- **Cause**: Recurrence rule format incorrect
- **Message**: `❌ Invalid recurrence rule. Must start with FREQ=`
- **Example invalid**: `INVALID=WEEKLY`, `FREQ:DAILY` (wrong separator)
- **Example valid**: `FREQ=WEEKLY;BYDAY=MO,WE`, `FREQ=DAILY;COUNT=10`

```typescript
recurrence: z
  .string()
  .regex(/^FREQ=/i, 'Invalid recurrence rule. Must start with FREQ=')
```

#### GROUP_REQUIRED
- **Cause**: /create used without `group` flag
- **Message**: `❌ group is required. Use /id in a group to get its ID`
- **Fix**: Run `/id` in target group to get ID, then use `group="-100..."`

```typescript
if (!group) {
  return ctx.reply(
    '❌ `group` is required. Use `/id` in a group to get its ID'
  );
}
```

#### GROUP_INVALID
- **Cause**: Group ID format invalid
- **Message**: `❌ Invalid group ID format`
- **Valid format**: Negative BigInt (e.g., `-100123456789`)

```typescript
try {
  await ctx.telegram.getChatMember(group, ctx.botInfo.id);
} catch (e) {
  return ctx.reply(
    `❌ I cannot access the group \`${group}\`. Please add me first!`
  );
}
```

#### DATE_FORMAT_INVALID
- **Cause**: Date doesn't match required format
- **Message**: `❌ Invalid date format. Use "dd/mm/yyyy HH:mm"`
- **Valid format**: `dd/mm/yyyy HH:mm` (e.g., `25/01/2026 18:00`)
- **Invalid examples**: `2026-01-25`, `25-01-2026 6:00 PM`

```typescript
if (startDateStr) {
  const [datePart, timePart] = startDateStr.split(' ');
  const [d, m, y] = datePart.split('/').map(Number);
  const [h, mm] = timePart.split(':').map(Number);
  const date = new Date(y, m - 1, d, h, mm);

  if (isNaN(date.getTime())) {
    return ctx.reply('❌ Invalid date format. Use "dd/mm/yyyy HH:mm"');
  }
}
```

#### DATE_IN_PAST
- **Cause**: Specified date is before current time
- **Message**: `❌ Cannot create event in the past`
- **Fix**: Use future date

---

### Resource Not Found (404)

#### ACCOUNT_NOT_FOUND
- **Cause**: Account doesn't exist (internal error)
- **Message**: `Account <id> not found`
- **When**: Invalid accountId passed to service

```typescript
const account = await this.prisma.account.findUnique({
  where: { id: accountId },
});
if (!account) {
  throw new NotFoundException(`Account ${accountId} not found`);
}
```

#### USER_NOT_BOUND
- **Cause**: User running command but not bound to any account
- **Message**: `❌ You are not bound to any account. Use /start <token> first.`
- **Fix**: Run `/start` with valid API key

```typescript
const account = await this.accountService.getAccountForUser(
  BigInt(ctx.from!.id)
);
if (!account) {
  return ctx.reply(
    'You are not bound to any account. Use /start <token> first.'
  );
}
```

#### SERIES_NOT_FOUND
- **Cause**: Event series doesn't exist or user doesn't have access
- **Message**: `❌ Series not found or inactive.`
- **Fix**: Run `/list` to see your series IDs

```typescript
const series = activeSeries.find(s => s.id === seriesId);
if (!series) {
  return ctx.reply('Series not found or inactive.');
}
```

#### INSTANCE_NOT_FOUND
- **Cause**: Event instance doesn't exist (internal error)
- **Message**: `Instance <id> not found`
- **When**: Invalid instanceId passed to service

```typescript
const instance = await this.prisma.eventInstance.findUnique({
  where: { id: instanceId },
});
if (!instance) {
  throw new NotFoundException(`Event instance ${instanceId} not found`);
}
```

---

### Business Logic Errors (409)

#### BOT_NOT_IN_GROUP
- **Cause**: Bot doesn't have access to target group
- **Message**: `❌ I cannot access the group \`<id>\`. Please add me safely first!`
- **Fix**: Add bot to group with admin permissions for posting

```typescript
try {
  await ctx.telegram.getChatMember(group, ctx.botInfo.id);
} catch (e) {
  return ctx.reply(
    `❌ I cannot access the group \`${group}\`. Please add me safely first!`
  );
}
```

#### CAPACITY_EXCEEDED
- **Cause**: Event at maximum participants
- **Message**: `⚠️ Sorry, only <N> slots left!` (show alert)
- **What happens**: JOIN and PLUS_ONE buttons disabled
- **Fix**: Wait for someone to leave or increase capacity

```typescript
if (
  instance.series.maxParticipants &&
  currentCount + added > instance.series.maxParticipants
) {
  return ctx.answerCbQuery(
    `⚠️ Sorry, only ${instance.series.maxParticipants - currentCount} slots left!`,
    { show_alert: true }
  );
}
```

#### ALREADY_ANNOUNCED
- **Cause**: Event already announced to group
- **Message**: `⚠️ This event has already been posted to the group.`
- **Fix**: Use `/announce` only once per instance
- **Re-announce**: Can be done if original message deleted

```typescript
if (instance.announcementMessageId) {
  return ctx.reply(
    '⚠️ This event has already been posted to the group.'
  );
}
```

#### INSTANCES_NOT_MATERIALIZED
- **Cause**: No instances created yet (too early)
- **Message**: `❌ No instances materialized yet.`
- **When**: Series just created, cron hasn't run
- **Fix**: Wait for daily cron (runs at midnight) or use `/announce` after

```typescript
if (!instance) {
  return ctx.reply('No instances materialized yet.');
}
```

---

### Server Errors (500)

#### INTERNAL_SERVER_ERROR
- **Cause**: Unexpected error in processing
- **Message**: `Error creating series: <error message>`
- **Logging**: Full stack trace logged, user gets generic message

```typescript
try {
  // Business logic
} catch (error) {
  logger.error(`Unexpected error: ${error.message}`, error.stack);
  return ctx.reply('❌ An unexpected error occurred. Please try again.');
}
```

---

## Common Error Scenarios

### Scenario: User runs /start without token

```
User: /start
Bot: Welcome to the Event Booking System! 📅

[Full help message displayed]
```

**Error**: None - this is expected behavior

### Scenario: User uses invalid API key

```
User: /start sk_invalid
Bot: ❌ Invalid token format.
     Token must start with 'sk_' and be at least 30 characters.
```

**Error Type**: INVALID_TOKEN (401)
**Handler**: BindAccountSchema validation

### Scenario: User creates event without group

```
User: /create title="Yoga" rrule="FREQ=WEEKLY"
Bot: ❌ group is required. Use /id in a group to get its ID,
     then pass it as group="-100..."
```

**Error Type**: GROUP_REQUIRED (400)
**Handler**: onCreate validation

### Scenario: Bot can't post to group

```
User: /create title="Yoga" rrule="FREQ=WEEKLY" group="-100123"
Bot: ❌ I cannot access the group `-100123`.
     Please add me safely first!
```

**Error Type**: BOT_NOT_IN_GROUP (409)
**Handler**: getChatMember check

### Scenario: Capacity exceeded

```
User: [Clicks JOIN button when at capacity]
Bot: [Alert popup] ⚠️ Sorry, only 0 slots left!
```

**Error Type**: CAPACITY_EXCEEDED (409)
**Handler**: Capacity check in recordVote

---

## Error Handling Patterns

### In Services

```typescript
import { NotFoundException, BadRequestException } from '@nestjs/common';

export class EventService {
  async createSeries(accountId: string, data: any) {
    // Validate account exists
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    // Validate data
    if (!data.title) {
      throw new BadRequestException('Title is required');
    }

    // Business logic
    return this.prisma.eventSeries.create({ data: { ...data, accountId } });
  }
}
```

### In Controllers/Handlers

```typescript
@Command('create')
async onCreate(@Ctx() ctx: Context): Promise<void> {
  try {
    // Get user's account
    const account = await this.accountService.getAccountForUser(
      BigInt(ctx.from!.id)
    );

    if (!account) {
      await ctx.reply(
        'You are not bound to any account. Use /start <token> first.'
      );
      return;
    }

    // Validate input
    const validation = CreateEventSeriesSchema.safeParse(input);
    if (!validation.success) {
      const errors = validation.error.issues
        .map(e => `- ${e.message}`)
        .join('\n');
      await ctx.reply(`❌ Validation Error:\n${errors}`);
      return;
    }

    // Create series
    const series = await this.eventService.createSeries(account.id, input);
    await ctx.reply(`✅ Created: ${series.title}`);
  } catch (error) {
    this.logger.error(`Error in onCreate: ${error.message}`);
    await ctx.reply('❌ An unexpected error occurred. Please try again.');
  }
}
```

### In Callbacks

```typescript
@Action(/JOIN:(.+)/)
async onJoin(@Ctx() ctx: Context): Promise<void> {
  const instanceId = (ctx as any).match[1];

  try {
    // Validate instance
    const instance = await this.prisma.eventInstance.findUnique({
      where: { id: instanceId },
    });

    if (!instance) {
      await ctx.answerCbQuery('Instance not found.');
      return;
    }

    // Check capacity
    if (instance.series.maxParticipants > 0) {
      const count = await this.participationService.countAttending(instanceId);
      if (count >= instance.series.maxParticipants) {
        await ctx.answerCbQuery(
          `⚠️ Event is full! ${instance.series.maxParticipants}/${instance.series.maxParticipants}`,
          { show_alert: true }
        );
        return;
      }
    }

    // Record vote
    await this.participationService.recordParticipation({
      instanceId,
      telegramUser: { id: BigInt(ctx.from!.id), ... },
      action: 'JOIN',
    });

    await ctx.answerCbQuery('✅ You joined!');
  } catch (error) {
    this.logger.error(`Error recording vote: ${error.message}`);
    await ctx.answerCbQuery('Error recording vote.');
  }
}
```

---

## Testing Errors

### Unit Test Example

```typescript
describe('EventService', () => {
  it('should throw NotFoundException for missing account', async () => {
    const mockPrisma = {
      account: { findUnique: jest.fn().mockResolvedValue(null) },
    };

    const service = new EventService(mockPrisma as any);

    await expect(
      service.createSeries('invalid-id', { title: 'Test' })
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException for empty title', async () => {
    const input = { title: '', recurrence: 'FREQ=DAILY' };
    const validation = CreateEventSeriesSchema.safeParse(input);

    expect(validation.success).toBe(false);
    expect(validation.error.issues[0].message).toBe('Title cannot be empty');
  });
});
```

### Integration Test Example

```typescript
it('should return 400 for invalid create parameters', async () => {
  const response = await request(app.getHttpServer()).post('/webhook/token').send({
    message: { text: '/create invalid' },
  });

  expect(response.status).toBe(400);
  expect(response.body.error).toBe('RRULE_INVALID');
});
```

---

## Logging and Debugging

### Enable Debug Logging

```bash
ENV=dev pnpm start:dev
```

Shows:
- Parsed command arguments
- Series materialization details
- RRule generation
- Vote calculations

### Common Debug Patterns

```typescript
private debug(message: string, ...args: unknown[]): void {
  if (this.isDevMode) {
    this.logger.debug(`[Debug] ${message}`, ...args);
  }
}

// Usage
this.debug(`onCreate - args: "${args}"`);
this.debug(`Parsed KV: ${JSON.stringify(kv)}`);
```

### Check Error with Prisma Studio

```bash
pnpm prisma studio
# Open http://localhost:5555

# Inspect data causing errors
SELECT * FROM event_instances WHERE id = 'inst-1';
```

---

## Summary

| Error Type | HTTP Code | When | Message |
|-----------|-----------|------|---------|
| Invalid token | 401 | Bad API key format | `Invalid token format` |
| Missing required field | 400 | /create without title | `Title cannot be empty` |
| Invalid RRule | 400 | Bad recurrence syntax | `Invalid recurrence rule` |
| User not bound | 401 | No /start done | `Use /start <token>` |
| Series not found | 404 | Invalid series ID | `Series not found` |
| Bot not in group | 409 | Bot kicked from group | `I cannot access` |
| Capacity exceeded | 409 | Group at max | `Only X slots left` |
| Server error | 500 | Unexpected crash | `Unexpected error` |

