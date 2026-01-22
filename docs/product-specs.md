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
- **Auto-Announce**: By default, the system posts upcoming events to the target group 48h in advance.
- **Capacity Control**: Optional limits to prevent over-booking.

## User Journeys

### Admin / Organizer
1.  **Binding**: Direct messages the bot (`/start <key>`) to become an Admin/Owner for an Account.
2.  **Creation**: Uses `/create` with named parameters for clarity.
    *   *Input*: `title="..." rrule="..." group="..." limit="10"`
    *   *Helper*: Can use `/id` in a group to get its ID first.
3.  **Management**: Uses `/list` to see all active Series, IDs, and linked Groups.
4.  **Announcements**:
    *   **Automatic**: Bot posts to groups by default.
    *   **Manual**: Use `/announce <series_id>` to re-post or trigger an immediate card.

### Participant
1.  **Voting**: Clicks interactive buttons (✅ JOIN, ❌ LEAVE, ➕ +1) on event cards.
2.  **Live Updates**: The message dynamically updates to show the attendee list and capacity status in real-time.
3.  **Enforcement**: Once a capacity limit is reached, the bot blocks further sign-ups with a friendly alert.
