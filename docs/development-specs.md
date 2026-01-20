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

#### Command: `/create title="..." rrule="..." [date="..."] [group="..."]`
- **Context**: Private (Admin DM) or Group.
- **Parsing**: Key-Value pairs (space separated, quoted values).
    - `title`: Event title (Required).
    - `rrule`: Recurrence rule (Required).
    - `date` (or `start`): Start date `dd/mm/yyyy HH:mm` (Optional).
    - `group` (or `chat`): Target Group ID (Optional, defaults to current chat if in group).
    - `topic`: Target Topic ID (Optional, defaults to current topic if in group).
- **Validation**:
    - Verify strict required keys.
    - Check bot membership if `group` is provided.
- **Example**:
    `/create title="Yoga" rrule="FREQ=WEEKLY" group="-100123"`

#### Command: `/announce <series_id>`
- **Context**: Private or Group.
- **Logic**:
    1.  Validate `series_id` belongs to Account.
    2.  Fetch `chatId` from Series.
    3.  Post event card to that `chatId`.

#### Command: `/list`
- **Output**:
    - ID: `series_id` (shortened?)
    - Title: `Yoga`
    - Recurrence: `Weekly`
    - Target: `Group Name (ID)` / `Link`

### 2. Recurrence Engine
- **Library**: `rrule` (Node.js).
- **Behavior**:
    - If `StartDate` is `20.01.2026` (Tuesday) and Rule is `BYDAY=MO`:
    - `rrule.all()` starts searching from `20.01`.
    - First match: `26.01.2026` (Monday).
    - This matches user expectation: "Target next possible BYDAY".
- **Combining Multiple Rules**:
    - **Multiple Days**: Use commas: `BYDAY=MO,WE,FR`.
    - **Multiple Schedules**: Provide a full iCal block with multiple `RRULE:` lines.
    - **Exclusions**: Use `EXRULE` or `EXDATE`.
    - **Logic**: `SchedulerService` uses `rrulestr` to parse these complex blocks into an `RRuleSet`.

### 3. Data Model Updates
- **EventSeries**: Add `chatId` (BigInt), `topicId` (String/Int).
- **EventInstance**: Inherit context from Series, but allow overrides if announced elsewhere.

### 4. Url Handling
- Telegram Links:
    - Group: `https://t.me/c/<chat_id>/<thread_id>`
    - Parsing: Extract IDs to verify bot permissions or linking.

## Validation Rules
- **Date Format**: `dd/mm/yyyy HH:mm` (e.g., `20/01/2026 18:00`).
- **Quotes**: Arguments can be quoted to support spaces.
