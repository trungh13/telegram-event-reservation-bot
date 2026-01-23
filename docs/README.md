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

> [!NOTE]
> To obtain an API key for your organization, please contact **[@Newbie131](https://t.me/Newbie131)** on Telegram.

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

### Docker Deployment (Raspberry Pi / Server)

This project is fully containerized and compatible with ARM/x86 architectures.

```bash
# Start all services (App, DB, Adminer)
docker-compose up -d --build
```

The app will:
1. Start a PostgreSQL 15 database.
2. Run database migrations automatically.
3. Start the NestJS application on port 3000.
4. Launch Adminer on port 8080 for database management.

> [!TIP]
> Ensure your `.env` file has the correct `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_NAME` before starting.

---

## Support the Project

☕ **[Buy Me a Coffee](https://buymeacoffee.com/trungh13)** - If this project helps you, consider supporting its development!

💳 **Stripe Payments** - Coming soon in Phase 3 for subscription-based features.

---

## License

MIT © 2026
