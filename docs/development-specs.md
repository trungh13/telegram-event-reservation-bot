# Development Specifications

## Feature Specs

### 1. Command System & Group Support
The bot must distinguish between Private and Group contexts.
- **Private Chat**: Used for sensitive admin actions (`/start <key>`) and account management.
- **Group/Topic**: Used for creating and announcing events. The bot must capture and store:
    - `chat_id`: The ID of the group.
    - `message_thread_id`: The ID of the Topic (if valid).

#### Command: `/id` or `/info`
- **Context**: Any (Group or Private).
- **Logic**: Returns the `chat_id` and `message_thread_id` (if applicable) of the current context.
- **Utility**: Helps admins easily find the ID to use in `/create`.

#### Command: `/create title="..." rrule="..." [flags]`
- **Context**: Private (Admin DM) or Group.
- **Parsing**: Supports both `key="value"` (Named) and positional arguments.
- **Flag Reference**:

| Flag | Aliases | Required | Description |
| :--- | :--- | :--- | :--- |
| `title` | | Yes | Event name shown on the card. |
| `rrule` | | Yes | iCal recurrence rule (e.g. `FREQ=WEEKLY`). |
| `group` | `chat` | Yes* | Target Telegram Group ID. Required for auto-announce. |
| `date` | `start` | No | Start date & time in `dd/mm/yyyy HH:mm` format. |
| `limit` | | No | Max participants allowed. |
| `topic` | | No | Target Topic Thread ID (for forum groups). |

- **Syntax Rules**:
    - Use `key="value"` for named parameters (space separated).
    - If no keys are present, falls back to positional: `[title] [rrule] [date] [group] [topic] [limit]`.
    - Quoted strings are required if values contain spaces.
- **Validation**:
    - Ensures `title` and `rrule` are present.
    - Verified bot membership in specific `group` BEFORE series creation.

#### Command: `/announce <series_id>`
- **Behavior**:
    1.  Validate `series_id` belongs to Account.
    2.  Post event card to the configured `chatId/topicId`.
    3.  **Constraint**: Prevents double-posting the same instance.

### 2. Automation & UI Updates
- **Auto-Announce**:
    - `SchedulerService` automatically posts event cards to groups 48h before the start time.
    - Both `OWNER` and `ADMIN` roles receive private notifications on materialization.
- **Live Attendance**:
    - Message formatting logic is centralized in `EventService.formatAttendanceMessage`.
    - `TelegramService` triggers a re-render and edits the original message via `editMessageText` on every vote.
    - Shows names, `+1` count, and `current/limit` capacity status.

### 3. Data Model Updates
- **EventSeries**: `chatId` (BigInt), `topicId` (String), `maxParticipants` (Int).
- **EventInstance**: `announcementMessageId` (BigInt), `announcementChatId` (BigInt).

## Validation Rules
- **Date Format**: `dd/mm/yyyy HH:mm` (e.g., `20/01/2026 18:00`).
- **Quotes**: Arguments can be quoted to support spaces.
- **Capacity**: JOIN/PLUS_ONE is blocked if `(current_votes + new_votes) > maxParticipants`.
