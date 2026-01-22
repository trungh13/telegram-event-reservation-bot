# Documentation

> Event Booking System for Telegram

## Quick Navigation

| Document | Audience | Description |
| :--- | :--- | :--- |
| [PRD](./prd.md) | Product & Dev | **Core document** - Features, tickets, acceptance criteria |
| [Technical Specs](./technical-specs.md) | Developers | Architecture, API, data models |
| [Roadmap](./roadmap.md) | All | Future features and milestones |
| [Tasks](./tasks.md) | Developers | Current sprint task checklist |

---

## Project Overview

A Telegram-first event booking system that enables group administrators to:
- Create recurring events with flexible scheduling (RRule)
- Automatically announce events to target groups
- Manage participant attendance with capacity limits
- Track real-time attendance via live-updating messages

---

## Getting Started

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your TELEGRAM_BOT_TOKEN and DATABASE_URL

# Generate Prisma client
pnpm prisma generate

# Run migrations
pnpm prisma migrate dev

# Start development server
pnpm start:dev
```

---

## Support the Project

☕ **[Buy Me a Coffee](https://buymeacoffee.com/trungh13)** - If this project helps you, consider supporting its development!

💳 **Stripe Payments** - Coming soon in Phase 3 for subscription-based features.

---

## License

MIT © 2026
