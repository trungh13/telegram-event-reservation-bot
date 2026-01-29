/**
 * Keyboard layouts for Telegram inline buttons
 */

import { Markup } from 'telegraf';

export const Keyboards: any = {
  // Step 2: Frequency selection
  frequency: () =>
    Markup.inlineKeyboard([
      [
        Markup.button.callback('📅 Daily', 'wizard:freq:DAILY'),
        Markup.button.callback('📆 Weekly', 'wizard:freq:WEEKLY'),
      ],
      [
        Markup.button.callback('🗓 Monthly', 'wizard:freq:MONTHLY'),
        Markup.button.callback('Once', 'wizard:freq:ONCE'),
      ],
      [Markup.button.callback('❌ Cancel', 'wizard:cancel')],
    ]),

  // Step 3: Day selection (for weekly)
  day: () =>
    Markup.inlineKeyboard([
      [
        Markup.button.callback('Mon', 'wizard:day:MO'),
        Markup.button.callback('Tue', 'wizard:day:TU'),
        Markup.button.callback('Wed', 'wizard:day:WE'),
        Markup.button.callback('Thu', 'wizard:day:TH'),
      ],
      [
        Markup.button.callback('Fri', 'wizard:day:FR'),
        Markup.button.callback('Sat', 'wizard:day:SA'),
        Markup.button.callback('Sun', 'wizard:day:SU'),
      ],
      [Markup.button.callback('❌ Cancel', 'wizard:cancel')],
    ]),

  // Step 4: Start date selection
  startDate: (nextDayName?: string) => {
    const buttons = [
      [
        Markup.button.callback('Today', 'wizard:start:today'),
        Markup.button.callback('Tomorrow', 'wizard:start:tomorrow'),
      ],
    ];
    if (nextDayName) {
      buttons.push([
        Markup.button.callback(`Next ${nextDayName}`, 'wizard:start:next'),
      ]);
    }
    buttons.push([Markup.button.callback('❌ Cancel', 'wizard:cancel')]);
    return Markup.inlineKeyboard(buttons);
  },

  // Step 5: Time selection
  time: () =>
    Markup.inlineKeyboard([
      [
        Markup.button.callback('09:00', 'wizard:time:09:00'),
        Markup.button.callback('12:00', 'wizard:time:12:00'),
        Markup.button.callback('15:00', 'wizard:time:15:00'),
      ],
      [
        Markup.button.callback('17:00', 'wizard:time:17:00'),
        Markup.button.callback('18:00', 'wizard:time:18:00'),
        Markup.button.callback('19:00', 'wizard:time:19:00'),
      ],
      [Markup.button.callback('❌ Cancel', 'wizard:cancel')],
    ]),

  // Step 6: Group selection (dynamic)
  groups: (groups: Array<{ id: string; name: string }>) => {
    const buttons = groups.map((g) => [
      Markup.button.callback(g.name, `wizard:group:${g.id}:${g.name}`),
    ]);
    buttons.push([Markup.button.callback('❌ Cancel', 'wizard:cancel')]);
    return Markup.inlineKeyboard(buttons);
  },

  // Step 7: Limit selection
  limit: () =>
    Markup.inlineKeyboard([
      [
        Markup.button.callback('No limit', 'wizard:limit:0'),
        Markup.button.callback('6', 'wizard:limit:6'),
        Markup.button.callback('10', 'wizard:limit:10'),
      ],
      [
        Markup.button.callback('12', 'wizard:limit:12'),
        Markup.button.callback('15', 'wizard:limit:15'),
        Markup.button.callback('20', 'wizard:limit:20'),
      ],
      [Markup.button.callback('❌ Cancel', 'wizard:cancel')],
    ]),

  // Step 8: Confirmation
  confirm: () =>
    Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Create', 'wizard:confirm:yes'),
        Markup.button.callback('❌ Cancel', 'wizard:confirm:no'),
      ],
    ]),

  // Event card buttons - dynamic based on card state
  eventCardDynamic: (
    instanceId: string,
    buttonConfig: {
      showJoin: boolean;
      showPlusOne: boolean;
      showLeave: boolean;
    },
  ) => {
    const buttons: ReturnType<typeof Markup.button.callback>[] = [];

    if (buttonConfig.showJoin) {
      buttons.push(Markup.button.callback('✅ JOIN', `JOIN:${instanceId}`));
    }
    if (buttonConfig.showPlusOne) {
      buttons.push(Markup.button.callback('➕ +1', `PLUS_ONE:${instanceId}`));
    }
    if (buttonConfig.showLeave) {
      buttons.push(Markup.button.callback('❌ LEAVE', `LEAVE:${instanceId}`));
    }

    // No buttons means no keyboard
    if (buttons.length === 0) {
      return {};
    }

    return Markup.inlineKeyboard([buttons]);
  },

  // Legacy event card buttons - kept for compatibility
  eventCard: (instanceId: string, userJoined: boolean, isFull: boolean) => {
    if (isFull) {
      return Markup.inlineKeyboard([
        [Markup.button.callback('❌ LEAVE', `LEAVE:${instanceId}`)],
      ]);
    }

    if (userJoined) {
      return Markup.inlineKeyboard([
        [
          Markup.button.callback('➕ Add +1', `PLUS_ONE:${instanceId}`),
          Markup.button.callback('❌ LEAVE', `LEAVE:${instanceId}`),
        ],
      ]);
    }

    return Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ JOIN', `JOIN:${instanceId}`),
        Markup.button.callback('➕ +1', `PLUS_ONE:${instanceId}`),
        Markup.button.callback('❌ LEAVE', `LEAVE:${instanceId}`),
      ],
    ]);
  },

  // List event actions
  eventActions: (seriesId: string) =>
    Markup.inlineKeyboard([
      [
        Markup.button.callback('📢 Announce', `list:announce:${seriesId}`),
        Markup.button.callback('✏️ Edit', `list:edit:${seriesId}`),
        Markup.button.callback('🗑 Remove', `list:remove:${seriesId}`),
      ],
    ]),

  // Confirm remove
  confirmRemove: (seriesId: string) =>
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          'Yes, remove',
          `list:remove:confirm:${seriesId}`,
        ),
        Markup.button.callback('Cancel', `list:remove:cancel`),
      ],
    ]),

  // No events - create button
  createEvent: () =>
    Markup.inlineKeyboard([
      [Markup.button.callback('➕ Create Event', 'wizard:start')],
    ]),

  // Audit logs - instance selection
  auditLogInstances: (instances: Array<{ id: string; title: string }>) => {
    const buttons = instances.map((inst) => [
      Markup.button.callback(inst.title, `audit:view:${inst.id}`),
    ]);
    buttons.push([Markup.button.callback('❌ Close', 'audit:close')]);
    return Markup.inlineKeyboard(buttons);
  },

  // Audit logs - view with pagination
  auditLogView: (instanceId: string, hasMore: boolean) => {
    const buttons: ReturnType<typeof Markup.button.callback>[] = [];

    if (hasMore) {
      buttons.push(
        Markup.button.callback('📋 Show All', `audit:all:${instanceId}`),
      );
    }

    buttons.push(Markup.button.callback('⬅️ Back', 'audit:back'));

    return Markup.inlineKeyboard([buttons]);
  },

  // Audit logs - back button
  auditLogBack: () =>
    Markup.inlineKeyboard([
      [Markup.button.callback('⬅️ Back', 'audit:back')],
    ]),
};
