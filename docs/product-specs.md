# Product Specifications

## Vision
A Telegram-first Event Booking System designed for managing recurring group activities (e.g., sports, classes, meetings) directly within Telegram groups. It emphasizes minimal friction, standard calendar patterns, and robust multi-tenancy.

## Core Pillars

### 1. Telegram-First Experience
- **Interface**: interactions happen via a Telegram Bot.
- **Deep Linking**: Account binding and invitations happen via `t.me` links.
- **Group Context**: The bot lives in group chats and respects Topics (Threads).

### 2. Multi-Tenancy & Security
- **Accounts**: "Accounts" (Tenants) are distinct from Telegram Groups. One Account can manage multiple Series across different chats.
- **Security**: Append-only logs for participation; API Key-based administrative access.

### 3. Flexible Event Scheduling
- **Recurrence**: Uses industry-standard iCal/RRule (Frequency, ByDay, Intervals).
- **Materialization**: Events are not just "rules" but concrete "instances" that can be voted on individually.
- **Timezone Aware**: Explicit timezone handling (default: Europe/Helsinki).

## User Journeys

### Admin / Organizer
1.  **Binding**: Direct messages the bot (`/start <key>`) to become an Admin for an Account.
2.  **Creation**: Uses `/create` with named parameters for clarity.
    *   *Input*: `title="..." rrule="..." group="..."`
    *   *Helper*: Can use `/id` in a group to get its ID first.
    *   *Flexible*: Order doesn't matter.
3.  **Management**: Uses `/list` to see all active Series, their IDs, and linked Groups.
4.  **Announcements**: Uses `/announce <series_id>` to manually trigger an event in the target Group.

### Participant
1.  **Voting**: Clicks interactive buttons (✅ JOIN, ❌ LEAVE, ➕ +1) on event cards.
2.  **Feedback**: Receives immediate confirmation; the event card updates to reflect the roster.
