/**
 * Wizard State Manager
 * Tracks user progress through multi-step flows like /create
 */

export interface CreateWizardState {
  step:
    | 'title'
    | 'frequency'
    | 'day'
    | 'startDate'
    | 'time'
    | 'group'
    | 'limit'
    | 'confirm';
  title?: string;
  frequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ONCE';
  day?: string; // MO, TU, WE, TH, FR, SA, SU
  startDate?: Date;
  time?: string; // HH:mm format
  groupId?: string;
  groupName?: string;
  limit?: number;
  messageId?: number; // Bot's message to edit
  createdAt: number;
}

const WIZARD_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

class WizardStateManager {
  private states = new Map<string, CreateWizardState>();

  private getKey(userId: number): string {
    return `create:${userId}`;
  }

  start(userId: number, messageId: number): CreateWizardState {
    const state: CreateWizardState = {
      step: 'title',
      messageId,
      createdAt: Date.now(),
    };
    this.states.set(this.getKey(userId), state);
    return state;
  }

  get(userId: number): CreateWizardState | undefined {
    const state = this.states.get(this.getKey(userId));
    if (!state) return undefined;

    // Check timeout
    if (Date.now() - state.createdAt > WIZARD_TIMEOUT_MS) {
      this.clear(userId);
      return undefined;
    }

    return state;
  }

  update(
    userId: number,
    updates: Partial<CreateWizardState>,
  ): CreateWizardState | undefined {
    const state = this.get(userId);
    if (!state) return undefined;

    const updated = { ...state, ...updates };
    this.states.set(this.getKey(userId), updated);
    return updated;
  }

  clear(userId: number): void {
    this.states.delete(this.getKey(userId));
  }

  // Generate RRule from wizard state
  generateRRule(state: CreateWizardState): string {
    if (state.frequency === 'ONCE') {
      return 'FREQ=DAILY;COUNT=1';
    }

    let rrule = `FREQ=${state.frequency}`;

    if (state.frequency === 'WEEKLY' && state.day) {
      rrule += `;BYDAY=${state.day}`;
    }

    return rrule;
  }

  // Calculate next occurrence based on frequency and day
  calculateStartDate(state: CreateWizardState, baseDate: Date): Date {
    const result = new Date(baseDate);

    if (state.time) {
      const [hours, minutes] = state.time.split(':').map(Number);
      result.setHours(hours, minutes, 0, 0);
    }

    if (state.frequency === 'WEEKLY' && state.day) {
      const dayMap: Record<string, number> = {
        SU: 0,
        MO: 1,
        TU: 2,
        WE: 3,
        TH: 4,
        FR: 5,
        SA: 6,
      };
      const targetDay = dayMap[state.day];
      const currentDay = result.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0) daysUntil += 7;
      result.setDate(result.getDate() + daysUntil);
    }

    return result;
  }
}

export const wizardState = new WizardStateManager();
