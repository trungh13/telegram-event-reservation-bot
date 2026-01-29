# UX Redesign: Button-Driven Event Creation

**Date:** 2026-01-29
**Status:** Approved
**Goal:** Replace complex command syntax with user-friendly button interactions

---

## Problem Statement

Current `/create` command requires users to understand:
- Key-value syntax with quotes (`title="..."`)
- iCal RRule format (`FREQ=WEEKLY;BYDAY=TU`)
- Negative Telegram group IDs (`-1001234567890`)
- Date format (`dd/mm/yyyy HH:mm`)

This is too complex for casual organizers (yoga instructors, team leads, sports coordinators).

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Interaction model | Inline buttons | Less noisy than conversational wizard |
| RRule exposure | Hidden | Keep internally, show friendly options |
| Group selection | Account-scoped | Only show groups linked to user's account |
| Date/time input | Relative shortcuts + buttons | No manual date typing |
| Confirmation | Summary with Create/Edit/Cancel | Prevents mistakes |
| Error style | Brief with emoji | Clean, not overwhelming |
| Registration window | 25 hours before event | Auto-close, admin can override |

---

## New `/create` Flow

### Step 1: Event Name
```
📋 Create New Event

What's the event name?
```
User types event name.

### Step 2: Frequency
```
How often does "Team Yoga" repeat?

[📅 Daily] [📆 Weekly] [🗓 Monthly] [Once]
```

### Step 3: Day (for weekly)
```
Which day of the week?

[Mon] [Tue] [Wed] [Thu] [Fri] [Sat] [Sun]
```

### Step 4: Start Date
```
When should it start?

[Today] [Tomorrow] [Next Tuesday] [Pick date...]
```

### Step 5: Time
```
What time?

[09:00] [12:00] [18:00] [Custom...]
```

### Step 6: Group
```
Which group should I post to?

[🧘 Yoga Group] [👥 Team Alpha]
```
Only shows groups linked to user's Account.

### Step 7: Limit (optional)
```
Max participants? (optional)

[No limit] [6] [10] [12] [Custom...]
```

### Step 8: Confirmation
```
📋 Ready to create:

Title: Team Yoga
Frequency: Weekly on Tuesday
Time: 18:00
Starts: Next Tuesday (Feb 4)
Group: 🧘 Yoga Group
Limit: 12 people

[✅ Create] [✏️ Edit] [❌ Cancel]
```

---

## Event Card (Announcement Message)

### Active Event
```
🧘 Team Yoga
📅 Tuesday, Feb 4 at 18:00

✅ Participants (4/12):
• @alice
• @bob (+1)
• @charlie

[✅ JOIN] [➕ +1] [❌ LEAVE]
```

### When Full (12/12)
```
🧘 Team Yoga
📅 Tuesday, Feb 4 at 18:00

✅ Participants (12/12) - FULL:
• @alice
• @bob (+1)
...

[❌ LEAVE]
```
JOIN and +1 buttons removed when full.

### After User Joined
```
[➕ Add +1] [❌ LEAVE]
```
Instead of showing JOIN.

### Registration Closed (25h before)
```
🧘 Team Yoga
📅 Tuesday, Feb 4 at 18:00

🔒 Registration closed

✅ Participants (8/12):
• @alice
...

Final list locked.
```
No buttons shown.

### Event Ended
```
🧘 Team Yoga
📅 Tuesday, Feb 4 at 18:00
⏹ Event ended

Final attendance: 4 people
```

---

## `/list` Command

### With Events
```
📋 Your Events:

🧘 Team Yoga
Weekly · Tuesday 18:00 · Yoga Group
[📢 Announce] [✏️ Edit] [🗑 Remove]

📅 Daily Standup
Daily · 09:00 · Team Alpha
[📢 Announce] [✏️ Edit] [🗑 Remove]

💡 Use /create to add a new event
```

### No Events
```
📋 Your Events:

You don't have any active events yet.

[➕ Create Event]
```

---

## Admin Manual Management

When admin taps `✏️ Edit` on an event:

```
✏️ Manage "Team Yoga" (Feb 4)

✅ Participants (4/12):
• @alice [❌]
• @bob (+1) [❌]
• @charlie [❌]

[➕ Add participant] [🔒 Close early] [🔓 Extend registration]
```

### Adding Participant
```
Admin taps: [➕ Add participant]
Bot: Type the username (e.g. @username)
Admin: @david
Bot: ✅ Added @david to "Team Yoga"
     (Updated announcement in "Yoga Group")
```

### Removing Participant
```
Admin taps: [❌] next to @bob
Bot: Remove @bob (+1) from "Team Yoga"?
     [Yes] [Cancel]
Bot: ✅ Removed @bob from "Team Yoga"
     (Updated announcement in "Yoga Group")
```

---

## `/groups` Command

```
📍 Groups linked to your account:

• 🧘 Yoga Group (3 events)
• 👥 Team Alpha (1 event)

💡 Add me to more groups to create events there
```

---

## Error Messages

| Situation | Message |
|-----------|---------|
| Not bound to account | `❌ Please link your account first with /start <key>` |
| Group not found | `❌ Group not found. Make sure I'm a member.` |
| Already joined | `ℹ️ You've already joined this event.` |
| No events | `ℹ️ No active events. Use /create to make one.` |
| Invalid input | `❌ Didn't catch that. Please try again.` |
| Timeout (5 min) | `⏰ Creation cancelled - took too long. Start over with /create` |

---

## Audit Logging

All attendance changes logged:
```
[2026-02-03 14:30] JOIN: @alice joined via button
[2026-02-03 14:32] PLUS_ONE: @bob joined with +1 via button
[2026-02-03 14:35] ADMIN_ADD: @david added by @admin_user
[2026-02-03 14:40] ADMIN_REMOVE: @bob removed by @admin_user
[2026-02-03 14:45] LEAVE: @charlie left via button
```

---

## Implementation Phases

### Phase 1: Button-Driven /create
- Implement step-by-step wizard with inline buttons
- Keep old command syntax as fallback (deprecated)
- Convert button selections to RRule internally

### Phase 2: Improved Event Cards
- Update announcement format
- Dynamic buttons based on state (joined, full, closed)
- Show `@user (+1)` format

### Phase 3: /list Improvements
- Card format with action buttons
- Inline event management

### Phase 4: Admin Features
- Manual add/remove participants
- Registration window controls
- Audit logging

### Phase 5: Cleanup
- Remove deprecated command syntax
- Update /help text
- Update documentation

---

## Technical Notes

- Use Telegraf callback queries for button handling
- Store wizard state in memory (Map by chat ID) with 5-min TTL
- RRule generation happens in backend, never exposed to user
- Registration window stored as `registrationClosesAt` on EventInstance
