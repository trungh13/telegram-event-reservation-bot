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
> To obtain an API key for your organization, please contact **[@trungh13](https://t.me/Newbie131)** on Telegram.

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

### Docker Deployment (Production / Raspberry Pi / Server)

This project is fully containerized and follows production-grade patterns.

```bash
# Start all services (DB → Migrations → App)
docker-compose up -d --build
```

**Startup Flow:**
1. PostgreSQL starts and becomes healthy.
2. Migration service runs `prisma migrate deploy` (one-shot, exits on completion).
3. Application starts only after migrations succeed.

**Optional: Database Admin UI**
```bash
# Start Adminer temporarily for debugging
docker-compose --profile debug up adminer

# Stop when done
docker-compose --profile debug stop adminer
```

> [!TIP]
> Ensure your `.env` file has the correct `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_NAME` before starting.

> [!IMPORTANT]
> **Recommended**: Use a VM (not LXC) for production. Access only via Cloudflare Tunnel or ngrok for HTTPS.

---

## Support the Project

☕ **[Buy Me a Coffee](https://buymeacoffee.com/trungh13)** - If this project helps you, consider supporting its development!

💳 **Stripe Payments** - Coming soon in Phase 3 for subscription-based features.

---

## License

MIT © 2026
