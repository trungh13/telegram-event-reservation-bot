import { Injectable } from '@nestjs/common';
import { EventInstance } from '@prisma/client';

export interface EventCardState {
  isFull: boolean;
  userJoined: boolean;
  registrationClosed: boolean;
  eventEnded: boolean;
}

/**
 * Determines dynamic button visibility for event cards based on state
 */
@Injectable()
export class EventCardService {
  /**
   * Compute card state from event instance and user participation
   *
   * @param instance Event instance
   * @param userAction Latest action by current user (null if not participated)
   * @param maxParticipants Max participants limit (0 = no limit)
   * @param currentParticipantCount Count of participants excluding current user
   * @param eventDurationMinutes How long event lasts (default 2h)
   * @returns EventCardState
   */
  computeCardState(
    instance: EventInstance,
    userAction: string | null,
    maxParticipants: number | null,
    currentParticipantCount: number,
    eventDurationMinutes: number = 120,
  ): EventCardState {
    const now = new Date();

    // Detect if full
    const isFull =
      maxParticipants != null && maxParticipants > 0
        ? currentParticipantCount >= maxParticipants
        : false;

    // Detect if user joined
    const userJoined = userAction === 'JOIN' || userAction === 'PLUS_ONE';

    // Detect if registration closed (25h before event start)
    const registrationClosesAt = new Date(
      instance.startTime.getTime() - 25 * 60 * 60 * 1000,
    );
    const registrationClosed = now >= registrationClosesAt;

    // Detect if event ended (2 hours after start by default)
    const eventEnd = new Date(
      instance.startTime.getTime() + eventDurationMinutes * 60 * 1000,
    );
    const eventEnded = now > eventEnd;

    return {
      isFull,
      userJoined,
      registrationClosed,
      eventEnded,
    };
  }

  /**
   * Determine which buttons to show based on card state
   */
  getButtonsToShow(state: EventCardState): {
    showJoin: boolean;
    showPlusOne: boolean;
    showLeave: boolean;
  } {
    // If event ended, no buttons
    if (state.eventEnded) {
      return { showJoin: false, showPlusOne: false, showLeave: false };
    }

    // If registration closed, no buttons
    if (state.registrationClosed) {
      return { showJoin: false, showPlusOne: false, showLeave: false };
    }

    // If user already joined
    if (state.userJoined) {
      return { showJoin: false, showPlusOne: true, showLeave: true };
    }

    // If full, only leave button (but user didn't join, so no leave)
    if (state.isFull) {
      return { showJoin: false, showPlusOne: false, showLeave: false };
    }

    // Normal case: not full, not joined, registration open
    return { showJoin: true, showPlusOne: true, showLeave: false };
  }

  /**
   * Get state display text for announcement
   */
  getStateDisplay(state: EventCardState, participantCount: number): string {
    if (state.eventEnded) {
      return '⏹ Event ended';
    }

    if (state.registrationClosed) {
      return '🔒 Registration closed';
    }

    return '';
  }
}
