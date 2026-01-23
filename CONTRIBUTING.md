# Contributing Guide

Thank you for your interest in contributing to the Event Booking System! This guide will help you get started.

---

## Code of Conduct

- Be respectful and inclusive
- Welcome all contributors and perspectives
- Help others and share knowledge
- Report issues promptly and constructively

---

## Getting Started

1. **Read the documentation**:
   - [SETUP_GUIDE.md](docs/SETUP_GUIDE.md) - Local development setup
   - [AGENTS.md](AGENTS.md) - Architecture overview
   - [DATABASE.md](docs/DATABASE.md) - Data model reference

2. **Get the project running**:
   ```bash
   git clone <repo>
   cd booking-system
   cp .env.example .env
   # Edit .env with your Telegram bot token
   docker-compose up -d
   pnpm install
   pnpm prisma migrate dev
   pnpm start:dev
   ```

3. **Verify tests pass**:
   ```bash
   pnpm test
   ```

---

## Development Workflow

### 1. Create a Branch

Use descriptive branch names:

```bash
# Feature: new /subscribe command
git checkout -b feature/subscribe-command

# Bug fix: fix capacity checking
git checkout -b fix/capacity-validation

# Documentation: add API guide
git checkout -b docs/api-guide

# Refactor: simplify event service
git checkout -b refactor/event-service-cleanup
```

**Format**: `<type>/<description>`
- `feature/` - New functionality
- `fix/` - Bug fixes
- `docs/` - Documentation only
- `refactor/` - Code improvements (no behavior change)
- `test/` - Test additions
- `chore/` - Dependencies, config, tooling

### 2. Make Changes

Follow these principles:

#### Code Style
```bash
# Format code
pnpm format

# Fix linting issues
pnpm lint --fix

# Type check
npx tsc --noEmit
```

#### Type Safety
- Avoid `any` types (use proper TypeScript types)
- If necessary, add comment explaining why: `// any: Telegraf context type not exported`
- Use strict mode: `strict: true` in tsconfig.json

#### Naming Conventions
- Variables: `camelCase` (min 3 chars unless obvious)
- Functions: `camelCase`, descriptive verbs
- Classes/Interfaces: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Private methods/properties: `_privateMethod()`

**Good**:
```typescript
async recordUserVote(userId: bigint, action: string): Promise<void> {
  // Clear, descriptive names
}
```

**Bad**:
```typescript
async rv(u: any, a: any): void {
  // Unclear abbreviations, weak typing
}
```

#### Comments
- Write self-documenting code (best choice)
- Add comments for **why**, not **what**
- Comment complex algorithms or business rules

```typescript
// ❌ Obvious - don't comment
const count = 5; // Set count to 5

// ✅ Helpful - explains reasoning
// Use 48h window to materialize instances for next 2 days
// (provides sufficient notice for admins)
const horizonHours = 48;
```

### 3. Write/Update Tests

**TDD approach** (recommended):
1. Write failing test
2. Implement feature
3. Test passes

**Testing requirements**:
- New services: 80%+ unit test coverage
- Bug fixes: Add test that reproduces issue
- Changes to public API: Update/add integration tests

**Run tests**:
```bash
pnpm test              # All tests
pnpm test:watch       # Watch mode
pnpm test:cov        # Coverage report
```

**Example test**:
```typescript
describe('EventService', () => {
  let service: EventService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [EventService, {
        provide: PrismaService,
        useValue: mockPrisma,
      }],
    }).compile();

    service = module.get(EventService);
  });

  it('should create series with valid data', async () => {
    const input = {
      title: 'Weekly Yoga',
      recurrence: 'FREQ=WEEKLY;BYDAY=TU',
      accountId: 'acc-1',
    };

    const result = await service.createSeries('acc-1', input);

    expect(result.title).toBe('Weekly Yoga');
    expect(result.isActive).toBe(true);
  });

  it('should throw NotFoundException for missing account', async () => {
    const input = { title: 'Event', recurrence: 'FREQ=DAILY', accountId: 'invalid' };

    await expect(
      service.createSeries('invalid', input)
    ).rejects.toThrow(NotFoundException);
  });
});
```

### 4. Commit Changes

Use clear, descriptive commit messages:

**Format**: `<type>: <description>`

```
feat: add /subscribe command with Stripe integration
fix: correct capacity limit check in participation service
docs: add database schema documentation
refactor: simplify RRule parsing logic
test: add tests for event materialization edge cases
```

**Good commits**:
- Atomic (one logical change per commit)
- Clear description of what changed and why
- Reference issue: `fix: resolve #42 - bot not responding`

**Bad commits**:
- `update` - Vague
- `fix things` - Unclear
- Multiple unrelated changes together

**Write commit messages**:
```bash
git commit -m "feat: add /subscribe command

- Implement /subscribe command with Stripe checkout
- Add Subscription model to database schema
- Create payment webhook handler
- Update technical specs with monetization details

Closes #123"
```

### 5. Update Documentation

If your changes affect functionality or architecture:

- **New command**: Update `/help` text and `technical-specs.md`
- **New model**: Update `DATABASE.md` and `AGENTS.md`
- **Bug fix**: Update relevant docs if it clarifies behavior
- **API change**: Update `technical-specs.md` and `ERROR_HANDLING.md` (when created)

### 6. Create Pull Request

```bash
git push origin feature/your-feature

# Then open PR on GitHub
```

**PR Title Format**: Same as commits
```
feat: add /subscribe command with Stripe integration
```

**PR Description**:
```markdown
## Summary
Adds Stripe checkout integration for subscription management (Phase 3).

## Changes
- New `/subscribe` command triggers checkout flow
- Subscription model added to schema
- Webhook handler processes payment events
- Admins can view active subscriptions

## Testing
- [ ] Unit tests pass: `pnpm test`
- [ ] No type errors: `npx tsc --noEmit`
- [ ] Code formatted: `pnpm format && pnpm lint`
- [ ] Manual testing: [describe test steps]

## Related Issues
Closes #123 (Phase 3: Monetization)

## Checklist
- [x] Code follows style guide
- [x] Tests added/updated
- [x] Documentation updated
- [x] No breaking changes (or documented)
```

### 7. Code Review

Address feedback:
- Respond to comments
- Make requested changes
- Push additional commits (don't rebase unless asked)
- Request re-review when ready

---

## Common Tasks

### Adding a New Command

**Steps**:
1. Add handler in `src/telegram/telegram.service.ts`
2. Add validation schema in `src/telegram/telegram.dto.ts`
3. Add tests in `src/telegram/telegram.service.spec.ts`
4. Update `/help` message in telegram.service.ts
5. Document in `docs/technical-specs.md`

**Example**:
```typescript
// src/telegram/telegram.service.ts

@Command('subscribe')
async onSubscribe(@Ctx() ctx: Context): Promise<void> {
  const account = await this.accountService.getAccountForUser(BigInt(ctx.from!.id));
  if (!account) {
    await ctx.reply('You must be bound to an account first. Use /start');
    return;
  }

  // Implement subscription logic
  const checkoutUrl = await this.stripeService.createCheckout(account.id);
  await ctx.reply(`Subscribe here: ${checkoutUrl}`);
}
```

### Adding a Database Model

**Steps**:
1. Add model to `prisma/schema.prisma`
2. Create migration: `pnpm prisma migrate dev --name add_feature`
3. Update services that interact with it
4. Add tests for queries
5. Document in `docs/DATABASE.md`

**Example**:
```prisma
model Subscription {
  id        String   @id @default(uuid())
  accountId String
  account   Account  @relation(fields: [accountId], references: [id])
  status    String   @default("ACTIVE")  // ACTIVE, CANCELLED, EXPIRED
  tier      String                        // FREE, PRO, ENTERPRISE
  createdAt DateTime @default(now())
  expiresAt DateTime

  @@map("subscriptions")
}
```

### Fixing a Bug

**Steps**:
1. Write test that reproduces bug
2. Verify test fails
3. Fix the bug
4. Verify test passes
5. Check no other tests broken: `pnpm test`
6. Document fix in PR description

---

## Running Tests

```bash
# All tests
pnpm test

# Watch mode (re-run on file changes)
pnpm test:watch

# Coverage report
pnpm test:cov

# Single test file
pnpm test event.service.spec.ts

# Match pattern
pnpm test --testNamePattern="should create"
```

**Coverage goals**:
- Services: 80%+
- Utilities: 90%+
- Controllers: 70%+
- Overall: 75%+

---

## Documentation Standards

### New Files
- Use Markdown (.md)
- Add to table of contents in parent README
- Include examples where helpful
- Link to related docs

### Code Comments
```typescript
// Single-line comment for simple explanations

/**
 * Multi-line comment for complex logic
 * explaining the reasoning and approach
 *
 * Example:
 * const result = calculateAttendance(instance);
 */

// TODO: Implement feature X in phase Y
// FIXME: Address edge case with large datasets
```

---

## Pull Request Review Checklist

Before requesting review, ensure:

- [ ] Code follows style guide
- [ ] No `any` types (unless documented)
- [ ] Tests pass: `pnpm test`
- [ ] Type check passes: `npx tsc --noEmit`
- [ ] Linting passes: `pnpm lint`
- [ ] Code formatted: `pnpm format`
- [ ] Related docs updated
- [ ] No console.log or debug code
- [ ] Commit messages clear
- [ ] Branch up to date with main

---

## Architecture Guidelines

### Modules
- One feature per module
- Clear exports/imports
- Dependency injection via constructor
- Mark global modules with `@Global()`

### Services
- Single responsibility
- Thin controllers, fat services
- Use Prisma for database
- Throw specific exceptions

### Error Handling
- Use NestJS exceptions (NotFoundException, BadRequestException)
- Provide helpful error messages
- Log errors appropriately

### Testing
- Isolate units under test
- Mock external dependencies
- Test happy path and error cases
- Aim for 80%+ coverage

---

## Git Workflow

```bash
# Before starting
git pull origin main

# Create feature branch
git checkout -b feature/my-feature

# Make changes, test, commit
pnpm test
git add src/
git commit -m "feat: add my-feature"

# Push and create PR
git push origin feature/my-feature

# After review, keep commits clean
# (Maintainers will squash/merge)
```

---

## Project Structure

```
booking-system/
├── src/
│   ├── account/           # Account & API key management
│   ├── event/             # Event series & instances
│   ├── participation/     # Voting & attendance
│   ├── scheduler/         # Cron jobs & materialization
│   ├── telegram/          # Bot commands & handlers
│   ├── telegram-user/     # User profile management
│   ├── prisma/            # Database service
│   └── app.module.ts      # Main app module
├── docs/                  # Documentation
├── test/                  # E2E tests
├── prisma/
│   └── schema.prisma      # Database schema
├── CONTRIBUTING.md        # This file
├── AGENTS.md              # Architecture guide
└── README.md              # Project overview
```

---

## Getting Help

- **Documentation**: Check [AGENTS.md](AGENTS.md), [SETUP_GUIDE.md](docs/SETUP_GUIDE.md)
- **Architecture questions**: Review [DATABASE.md](docs/DATABASE.md)
- **Testing**: See [TESTING.md](docs/TESTING.md) (when created)
- **Issues**: Search existing issues first, then open new one
- **Discussions**: Start discussion thread for questions

---

## Code Review Standards

We look for:

### Functionality
- Feature works as intended
- No breaking changes (or documented)
- Edge cases handled
- Error handling appropriate

### Code Quality
- Follows style guide
- No `any` types without comment
- Clear variable names
- DRY (Don't Repeat Yourself)
- SOLID principles respected

### Testing
- Tests added/updated
- Tests pass
- Coverage adequate
- Edge cases tested

### Documentation
- Code comments where needed
- User-facing docs updated
- Commit messages clear
- PR description complete

---

## Feedback and Questions

Open an issue for:
- Bug reports (with reproduction steps)
- Feature requests (with use case)
- Documentation improvements
- Questions about architecture

Label appropriately:
- `bug` - Something broken
- `enhancement` - Feature request
- `documentation` - Docs improvement
- `question` - Question about functionality

---

Thank you for contributing! 🎉

