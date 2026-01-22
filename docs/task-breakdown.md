# Task Breakdown

> Categorized development tasks for the Event Booking System.

This document breaks down work into **Docs**, **Development**, and **Feature** categories. Each task is small, testable, and atomic.

---

## Legend
- `[ ]` Not started
- `[/]` In progress
- `[x]` Completed
- **(P0)** Critical / High Priority
- **(P1)** Medium Priority
- **(P2)** Nice-to-have

---

## Docs Tasks

| ID | Task | Status | Notes |
| :--- | :--- | :--- | :--- |
| D-01 | Update `/help` command with detailed flag explanations | `[x]` | Includes RRule cheat sheet |
| D-02 | Create `prd.md` (Product Requirements Document) | `[x]` | Overview, features, milestones |
| D-03 | Create `task-breakdown.md` | `[x]` | This document |
| D-04 | Add inline code examples to `development-specs.md` | `[x]` | Flag table, aliases |
| D-05 | Document API key generation workflow | `[ ]` | |
| D-06 | Create onboarding guide for new admins | `[ ]` | |

---

## Development Tasks

### Infrastructure
| ID | Task | Status | Notes |
| :--- | :--- | :--- | :--- |
| DEV-01 | Scaffold NestJS project | `[x]` | |
| DEV-02 | Configure Prisma schema | `[x]` | |
| DEV-03 | Set up Docker Compose | `[x]` | PostgreSQL + App |
| DEV-04 | Implement Telegram webhook controller | `[x]` | |
| DEV-05 | Add @nestjs/schedule for cron jobs | `[x]` | |

### Core Services
| ID | Task | Status | Notes |
| :--- | :--- | :--- | :--- |
| DEV-10 | Implement AccountService | `[x]` | User binding, API keys |
| DEV-11 | Implement EventService | `[x]` | Series CRUD, formatting |
| DEV-12 | Implement SchedulerService | `[x]` | Materialization, auto-announce |
| DEV-13 | Implement ParticipationService | `[x]` | Vote logging |
| DEV-14 | Resolve circular dependencies (forwardRef) | `[x]` | Scheduler ↔ Event |

### Testing
| ID | Task | Status | Notes |
| :--- | :--- | :--- | :--- |
| DEV-20 | Unit tests for TelegramService | `[x]` | Parser, commands |
| DEV-21 | Unit tests for SchedulerService | `[x]` | Materialization, auto-announce |
| DEV-22 | E2E tests (webhook simulation) | `[ ]` | Curl-based or Postman |
| DEV-23 | Add test coverage reporting | `[ ]` | Jest coverage |

---

## Feature Tasks

### Phase 1: Core
| ID | Task | Status | Notes |
| :--- | :--- | :--- | :--- |
| F-01 | `/start <key>` account binding | `[x]` | |
| F-02 | `/create` with positional args | `[x]` | Legacy support |
| F-03 | `/create` with named args | `[x]` | `title="..."` syntax |
| F-04 | `/list` to show active series | `[x]` | |
| F-05 | `/id` to get chat info | `[x]` | |
| F-06 | `/announce <id>` manual posting | `[x]` | |

### Phase 2: Refinement
| ID | Task | Status | Notes |
| :--- | :--- | :--- | :--- |
| F-10 | Inline voting buttons | `[x]` | JOIN / LEAVE / +1 |
| F-11 | Live attendance list updates | `[x]` | editMessageText |
| F-12 | Capacity limits (`limit` flag) | `[x]` | |
| F-13 | Duplicate announcement prevention | `[x]` | Track messageId |
| F-14 | Auto-announcements by default | `[x]` | |
| F-15 | Admin/Owner notification fix | `[x]` | |

### Phase 3: Monetization (Planned)
| ID | Task | Status | Notes |
| :--- | :--- | :--- | :--- |
| F-20 | Stripe checkout integration | `[ ]` | (P1) |
| F-21 | Subscription plans | `[ ]` | (P1) |
| F-22 | Payment confirmation webhook | `[ ]` | (P1) |

---

## Testing Checklist

Each feature should be testable via:
1. **Unit Test**: Jest spec file.
2. **Manual Test**: Curl command or live bot interaction.
3. **Integration Test**: Full flow (create → announce → vote).

| Feature | Unit | Manual | Integration |
| :--- | :--- | :--- | :--- |
| /start | ✅ | ✅ | ✅ |
| /create | ✅ | ✅ | ✅ |
| /announce | ✅ | ✅ | ✅ |
| Voting | ✅ | ✅ | ⏳ |
| Capacity | ✅ | ✅ | ⏳ |
