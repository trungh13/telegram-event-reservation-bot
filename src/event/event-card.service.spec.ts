import { Test, TestingModule } from '@nestjs/testing';
import { EventCardService } from './event-card.service';
import { EventInstance } from '@prisma/client';

describe('EventCardService', () => {
  let service: EventCardService;
  const mockInstance = (startTime: Date = new Date()): EventInstance => ({
    id: 'inst_1',
    seriesId: 'series_1',
    startTime,
    createdAt: new Date(),
    announcementMessageId: null,
    announcementChatId: null,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventCardService],
    }).compile();

    service = module.get<EventCardService>(EventCardService);
  });

  describe('computeCardState', () => {
    it('should detect full capacity', () => {
      const instance = mockInstance();
      const state = service.computeCardState(
        instance,
        null, // not joined
        12, // max participants
        12, // current count
      );

      expect(state.isFull).toBe(true);
      expect(state.userJoined).toBe(false);
    });

    it('should detect not full', () => {
      const instance = mockInstance();
      const state = service.computeCardState(instance, null, 12, 10);

      expect(state.isFull).toBe(false);
    });

    it('should not be full when no limit', () => {
      const instance = mockInstance();
      const state = service.computeCardState(instance, null, 0, 100);

      expect(state.isFull).toBe(false);
    });

    it('should detect user joined with JOIN action', () => {
      const instance = mockInstance();
      const state = service.computeCardState(instance, 'JOIN', 12, 1);

      expect(state.userJoined).toBe(true);
    });

    it('should detect user joined with PLUS_ONE action', () => {
      const instance = mockInstance();
      const state = service.computeCardState(instance, 'PLUS_ONE', 12, 1);

      expect(state.userJoined).toBe(true);
    });

    it('should detect user not joined with LEAVE action', () => {
      const instance = mockInstance();
      const state = service.computeCardState(instance, 'LEAVE', 12, 0);

      expect(state.userJoined).toBe(false);
    });

    it('should detect registration closed when past 25h before', () => {
      const eventStart = new Date('2026-02-04T10:00:00Z');
      const now = new Date('2026-02-04T11:00:00Z'); // 24h before event
      // Manually set time for this test
      jest.useFakeTimers();
      jest.setSystemTime(now);

      const instance = mockInstance(eventStart);
      const state = service.computeCardState(instance, null, 0, 0);

      expect(state.registrationClosed).toBe(true);

      jest.useRealTimers();
    });

    it('should detect registration open when before 25h', () => {
      const eventStart = new Date();
      const futureTime = new Date(
        eventStart.getTime() + 26 * 60 * 60 * 1000, // 26h after now
      );

      jest.useFakeTimers();
      jest.setSystemTime(eventStart);

      const instance = mockInstance(futureTime);
      const state = service.computeCardState(instance, null, 0, 0);

      expect(state.registrationClosed).toBe(false);

      jest.useRealTimers();
    });

    it('should detect event ended when past start + duration', () => {
      const eventStart = new Date('2026-02-04T18:00:00Z');
      const eventEnded = new Date('2026-02-04T21:00:00Z'); // 3h after start

      jest.useFakeTimers();
      jest.setSystemTime(eventEnded);

      const instance = mockInstance(eventStart);
      const state = service.computeCardState(instance, null, 0, 0, 120);

      expect(state.eventEnded).toBe(true);

      jest.useRealTimers();
    });

    it('should detect event not ended when still within duration', () => {
      const eventStart = new Date('2026-02-04T18:00:00Z');
      const eventOngoing = new Date('2026-02-04T18:30:00Z');

      jest.useFakeTimers();
      jest.setSystemTime(eventOngoing);

      const instance = mockInstance(eventStart);
      const state = service.computeCardState(instance, null, 0, 0, 120);

      expect(state.eventEnded).toBe(false);

      jest.useRealTimers();
    });
  });

  describe('getButtonsToShow', () => {
    it('should show JOIN and +1 when open and not joined and not full', () => {
      const state = {
        isFull: false,
        userJoined: false,
        registrationClosed: false,
        eventEnded: false,
      };

      const buttons = service.getButtonsToShow(state);

      expect(buttons.showJoin).toBe(true);
      expect(buttons.showPlusOne).toBe(true);
      expect(buttons.showLeave).toBe(false);
    });

    it('should show +1 and LEAVE when user joined', () => {
      const state = {
        isFull: false,
        userJoined: true,
        registrationClosed: false,
        eventEnded: false,
      };

      const buttons = service.getButtonsToShow(state);

      expect(buttons.showJoin).toBe(false);
      expect(buttons.showPlusOne).toBe(true);
      expect(buttons.showLeave).toBe(true);
    });

    it('should show no buttons when full', () => {
      const state = {
        isFull: true,
        userJoined: false,
        registrationClosed: false,
        eventEnded: false,
      };

      const buttons = service.getButtonsToShow(state);

      expect(buttons.showJoin).toBe(false);
      expect(buttons.showPlusOne).toBe(false);
      expect(buttons.showLeave).toBe(false);
    });

    it('should show no buttons when registration closed', () => {
      const state = {
        isFull: false,
        userJoined: false,
        registrationClosed: true,
        eventEnded: false,
      };

      const buttons = service.getButtonsToShow(state);

      expect(buttons.showJoin).toBe(false);
      expect(buttons.showPlusOne).toBe(false);
      expect(buttons.showLeave).toBe(false);
    });

    it('should show no buttons when event ended', () => {
      const state = {
        isFull: false,
        userJoined: false,
        registrationClosed: false,
        eventEnded: true,
      };

      const buttons = service.getButtonsToShow(state);

      expect(buttons.showJoin).toBe(false);
      expect(buttons.showPlusOne).toBe(false);
      expect(buttons.showLeave).toBe(false);
    });

    it('should show LEAVE only when full and user joined', () => {
      const state = {
        isFull: true,
        userJoined: true,
        registrationClosed: false,
        eventEnded: false,
      };

      const buttons = service.getButtonsToShow(state);

      expect(buttons.showLeave).toBe(true);
      expect(buttons.showJoin).toBe(false);
      expect(buttons.showPlusOne).toBe(true);
    });
  });

  describe('getStateDisplay', () => {
    it('should show ended text when event ended', () => {
      const state = {
        isFull: false,
        userJoined: false,
        registrationClosed: false,
        eventEnded: true,
      };

      const display = service.getStateDisplay(state, 10);

      expect(display).toContain('⏹');
      expect(display).toContain('ended');
    });

    it('should show registration closed when closed', () => {
      const state = {
        isFull: false,
        userJoined: false,
        registrationClosed: true,
        eventEnded: false,
      };

      const display = service.getStateDisplay(state, 10);

      expect(display).toContain('🔒');
      expect(display).toContain('closed');
    });

    it('should show empty string when open', () => {
      const state = {
        isFull: false,
        userJoined: false,
        registrationClosed: false,
        eventEnded: false,
      };

      const display = service.getStateDisplay(state, 10);

      expect(display).toBe('');
    });
  });
});
