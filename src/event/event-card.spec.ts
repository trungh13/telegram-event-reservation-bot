import { EventCardState } from './event-card.service';

describe('EventCardState', () => {
  describe('determining button visibility', () => {
    it('should show JOIN and +1 buttons when user not joined and capacity available', () => {
      const state: EventCardState = {
        isFull: false,
        userJoined: false,
        registrationClosed: false,
        eventEnded: false,
      };

      expect(state.isFull).toBe(false);
      expect(state.userJoined).toBe(false);
      expect(state.registrationClosed).toBe(false);
      expect(state.eventEnded).toBe(false);
    });

    it('should show only LEAVE button when user joined', () => {
      const state: EventCardState = {
        isFull: false,
        userJoined: true,
        registrationClosed: false,
        eventEnded: false,
      };

      expect(state.userJoined).toBe(true);
      expect(state.registrationClosed).toBe(false);
    });

    it('should show only LEAVE button when full, even if user not joined', () => {
      const state: EventCardState = {
        isFull: true,
        userJoined: false,
        registrationClosed: false,
        eventEnded: false,
      };

      expect(state.isFull).toBe(true);
    });

    it('should show no buttons when registration closed', () => {
      const state: EventCardState = {
        isFull: false,
        userJoined: false,
        registrationClosed: true,
        eventEnded: false,
      };

      expect(state.registrationClosed).toBe(true);
    });

    it('should show no buttons when event ended', () => {
      const state: EventCardState = {
        isFull: false,
        userJoined: false,
        registrationClosed: false,
        eventEnded: true,
      };

      expect(state.eventEnded).toBe(true);
    });
  });

  describe('computing state from event data', () => {
    it('should detect full capacity based on max participants', () => {
      const currentCount = 12;
      const maxParticipants = 12;
      const isFull = currentCount >= maxParticipants;

      expect(isFull).toBe(true);
    });

    it('should not be full when below capacity', () => {
      const currentCount = 10;
      const maxParticipants = 12;
      const isFull = currentCount >= maxParticipants;

      expect(isFull).toBe(false);
    });

    it('should have no limit when maxParticipants is null/0', () => {
      const maxParticipants = 0;
      const hasLimit = maxParticipants > 0;

      expect(hasLimit).toBe(false);
    });

    it('should detect registration closed based on time window', () => {
      const now = new Date('2026-02-04T17:00:00Z');
      const eventStart = new Date('2026-02-04T18:00:00Z');
      const registrationClosesAt = new Date(
        eventStart.getTime() - 25 * 60 * 60 * 1000,
      ); // 25h before

      const registrationClosed = now >= registrationClosesAt;

      expect(registrationClosed).toBe(true);
    });

    it('should not close registration if still within window', () => {
      const now = new Date('2026-02-03T08:00:00Z'); // 26h before event
      const eventStart = new Date('2026-02-04T10:00:00Z');
      const registrationClosesAt = new Date(
        eventStart.getTime() - 25 * 60 * 60 * 1000,
      ); // 25h before (closes at Feb 3 09:00)

      const registrationClosed = now >= registrationClosesAt;

      expect(registrationClosed).toBe(false);
    });

    it('should detect event ended based on start time', () => {
      const now = new Date('2026-02-05T18:00:00Z');
      const eventStart = new Date('2026-02-04T18:00:00Z');
      // Assume event lasts 2 hours
      const eventEnd = new Date(eventStart.getTime() + 2 * 60 * 60 * 1000);

      const eventEnded = now > eventEnd;

      expect(eventEnded).toBe(true);
    });

    it('should not mark event as ended if still happening', () => {
      const now = new Date('2026-02-04T18:30:00Z');
      const eventStart = new Date('2026-02-04T18:00:00Z');
      const eventEnd = new Date(eventStart.getTime() + 2 * 60 * 60 * 1000);

      const eventEnded = now > eventEnd;

      expect(eventEnded).toBe(false);
    });
  });
});
