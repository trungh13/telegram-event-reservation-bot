# Product Requirements Document (PRD)

> **Event Booking System for Telegram**

## 1. Overview

A multi-tenant booking system that enables Telegram group administrators to manage recurring events (e.g., yoga classes, team stand-ups, weekly meetings) directly within Telegram. The bot handles event creation, automated announcements, participant voting, and capacity management.

---

## 2. Goals & Non-Goals

### Goals
- **Telegram-First Experience**: All user interactions occur within Telegram chats.
- **Flexible Scheduling**: Support complex recurrence patterns via iCal/RRule.
- **Automatic Announcements**: Events are auto-posted to groups 48h in advance.
- **Live Attendance Tracking**: Real-time participant counts and capacity limits.
- **Multi-Tenancy**: Multiple organizations (Accounts) can use the same bot instance.

### Non-Goals
- Mobile/Web app for booking (Telegram-only for MVP).
- Payment processing (planned for Phase 3).
- Multi-language support (English only for MVP).

---

## 3. User Personas

| Persona | Description |
| :--- | :--- |
| **Admin/Organizer** | Creates events, manages schedules, monitors attendance. |
| **Participant** | Joins/leaves events via inline buttons on announcement cards. |

---

## 4. Features

### 4.1 Account Binding (`/start <key>`)
- **What**: Links a Telegram user to an organizational Account.
- **Why**: Ensures only authorized users can create events.
- **How**: User sends `/start <api_key>` in a private chat. The bot validates the key and binds the user.

### 4.2 Event Creation (`/create`)
- **What**: Creates a new recurring event series with configurable flags.
- **Input**: Named arguments (`title`, `rrule`, `group`, `date`, `limit`, `topic`).
- **Behavior**: Validates inputs, stores series in DB, triggers immediate materialization.

### 4.3 Announcements (`/announce`)
- **What**: Posts an event card with voting buttons to the target group.
- **Modes**:
  - **Automatic**: Default. Bot posts as soon as an instance is materialized.
  - **Manual**: Use `/announce <series_id>` to post or re-post.

### 4.4 Voting (JOIN / LEAVE / +1)
- **What**: Participants click inline buttons to register attendance.
- **Behavior**: Updates are reflected live in the announcement message. +1 allows bringing a guest.

### 4.5 Capacity Management (`limit`)
- **What**: Optional maximum participant count per event.
- **Behavior**: Bot blocks sign-ups when full and displays a friendly alert.

### 4.6 Utilities
| Command | Description |
| :--- | :--- |
| `/list` | Shows all active event series for the user's Account. |
| `/id` | Returns the current chat's ID and topic ID (if any). |
| `/help` | Displays detailed command usage and examples. |

---

## 5. Technical Architecture

### 5.1 Stack
- **Runtime**: Node.js (NestJS)
- **Database**: PostgreSQL (Prisma ORM)
- **Bot Framework**: Telegraf (nestjs-telegraf)
- **Scheduling**: @nestjs/schedule (Cron jobs)
- **Recurrence**: rrule library

### 5.2 Data Models
| Model | Key Fields |
| :--- | :--- |
| `Account` | `id`, `name`, `apiKey` |
| `EventSeries` | `title`, `recurrence (JSON)`, `chatId`, `maxParticipants` |
| `EventInstance` | `seriesId`, `startTime`, `announcementMessageId` |
| `ParticipationLog` | `instanceId`, `telegramUserId`, `action` |

---

## 6. Milestones

| Phase | Description | Status |
| :--- | :--- | :--- |
| 0 | Foundation (Scaffolding, DB, Webhook) | ✅ Done |
| 1 | Core Implementation (Accounts, Recurrence, Cron) | ✅ Done |
| 2 | Hardening (Validation, UX, Testing) | ✅ Done |
| 2.5 | Advanced Recurrence (RRuleSet) | ✅ Done |
| 2.6 | Booking Refinement (Capacity, Live Lists) | ✅ Done |
| 2.7 | Auto-Announcements & Fixes | ✅ Done |
| 2.8 | Documentation & PRD | 🔄 In Progress |
| 3 | Monetization (Stripe Integration) | ⏳ Planned |

---

## 7. Success Metrics
- **Adoption**: Number of active Accounts using the bot.
- **Engagement**: Average participation rate per event.
- **Reliability**: Zero missed auto-announcements over a 30-day period.
