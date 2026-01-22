# Tasks

> Current Sprint Checklist

This file tracks active development tasks. For detailed ticket breakdown, see [PRD](./prd.md).

---

## Completed ✅

### Phase 0: Foundation
- [x] Project scaffolding (NestJS, TypeScript)
- [x] Database schema (Prisma, PostgreSQL)
- [x] Telegram webhook integration

### Phase 1: Core
- [x] Account & API key system
- [x] Event series creation
- [x] Instance materialization (cron)
- [x] Bot commands (`/create`, `/list`, `/announce`)

### Phase 2: Hardening
- [x] Named argument parser
- [x] Group/topic targeting
- [x] Inline voting buttons
- [x] Live attendance updates
- [x] Capacity limits
- [x] Auto-announcements
- [x] Admin notifications

### Phase 2.8: Documentation
- [x] Enhanced `/help` command
- [x] AGENTS.md
- [x] Comprehensive PRD

---

## In Progress 🔄

### Documentation Refactor
- [x] Create docs/README.md
- [x] Create technical-specs.md
- [x] Create roadmap.md
- [x] Consolidate task files

---

## Next Up 📋

### Phase 3: Monetization
- [ ] **PAY-001**: Stripe checkout integration
- [ ] **PAY-002**: Subscription plans
- [ ] **PAY-003**: Payment webhook handler

See [PRD](./prd.md) for detailed acceptance criteria.

---

## Quick Reference

| Command | Description |
| :--- | :--- |
| `pnpm start:dev` | Start dev server |
| `pnpm test` | Run unit tests |
| `pnpm prisma generate` | Regenerate Prisma client |
| `pnpm create-account "Name"` | Create new account |
