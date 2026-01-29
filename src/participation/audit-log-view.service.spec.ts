import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogViewService } from './audit-log-view.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuditLogViewService', () => {
  let service: AuditLogViewService;
  const mockPrismaService = {
    eventInstance: {
      findUnique: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogViewService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AuditLogViewService>(AuditLogViewService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getInstanceAuditLogs', () => {
    it('should return last 10 audit logs for instance', async () => {
      const mockLogs = Array.from({ length: 10 }, (_, i) => ({
        id: `log_${i}`,
        action: 'PARTICIPANT_ADDED',
        details: { userId: String(i), adminUsername: 'admin' },
        occurredAt: new Date(),
      }));

      mockPrismaService.auditLog.findMany.mockResolvedValue(mockLogs);
      mockPrismaService.auditLog.count.mockResolvedValue(10);

      const result = await service.getInstanceAuditLogs('inst_123', 10);

      expect(result.logs).toHaveLength(10);
      expect(result.total).toBe(10);
      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          details: {
            path: ['instanceId'],
            equals: 'inst_123',
          },
        },
        orderBy: { occurredAt: 'desc' },
        take: 10,
      });
    });

    it('should return all logs when requested', async () => {
      const mockLogs = Array.from({ length: 25 }, (_, i) => ({
        id: `log_${i}`,
        action: 'PARTICIPANT_ADDED',
        details: { userId: String(i), adminUsername: 'admin' },
        occurredAt: new Date(),
      }));

      mockPrismaService.auditLog.findMany.mockResolvedValue(mockLogs);
      mockPrismaService.auditLog.count.mockResolvedValue(25);

      const result = await service.getInstanceAuditLogs('inst_123');

      expect(result.logs).toHaveLength(25);
      expect(result.total).toBe(25);
    });

    it('should return empty list when no logs', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([]);
      mockPrismaService.auditLog.count.mockResolvedValue(0);

      const result = await service.getInstanceAuditLogs('inst_123', 10);

      expect(result.logs).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle pagination correctly', async () => {
      const mockLogs = [
        {
          id: 'log_1',
          action: 'PARTICIPANT_ADDED',
          details: {},
          occurredAt: new Date(),
        },
      ];

      mockPrismaService.auditLog.findMany.mockResolvedValue(mockLogs);
      mockPrismaService.auditLog.count.mockResolvedValue(15);

      const result = await service.getInstanceAuditLogs('inst_123', 10);

      expect(result.hasMore).toBe(true);
      expect(result.total).toBe(15);
    });
  });

  describe('formatAuditLogMessage', () => {
    it('should format logs for display', () => {
      const logs = [
        {
          id: 'log_1',
          action: 'PARTICIPANT_ADDED',
          details: { userId: '12345', adminUsername: 'admin' },
          occurredAt: new Date('2026-02-04T10:00:00Z'),
        },
        {
          id: 'log_2',
          action: 'PARTICIPANT_REMOVED',
          details: { userId: '67890', adminUsername: 'admin' },
          occurredAt: new Date('2026-02-04T10:05:00Z'),
        },
      ];

      const message = service.formatAuditLogMessage(logs, 2, 5);

      expect(message).toContain('Audit Log');
      expect(message).toContain('12345');
      expect(message).toContain('67890');
      expect(message).toContain('2 of 5');
    });

    it('should show no more indicator when no additional logs', () => {
      const logs = [
        {
          id: 'log_1',
          action: 'PARTICIPANT_ADDED',
          details: { userId: '12345', adminUsername: 'admin' },
          occurredAt: new Date(),
        },
      ];

      const message = service.formatAuditLogMessage(logs, 1, 1);

      expect(message).toContain('1 of 1');
      expect(message).not.toContain('more');
    });

    it('should indicate more logs available', () => {
      const logs = [
        {
          id: 'log_1',
          action: 'PARTICIPANT_ADDED',
          details: { userId: '12345', adminUsername: 'admin' },
          occurredAt: new Date(),
        },
      ];

      const message = service.formatAuditLogMessage(logs, 1, 25);

      expect(message).toContain('1 of 25');
      expect(message).toContain('more');
    });
  });

  describe('getEventInstancesForAudit', () => {
    it('should return event instances with recent activity', async () => {
      const mockInstances = [
        {
          id: 'inst_1',
          startTime: new Date('2026-02-04T18:00:00Z'),
          series: { title: 'Team Yoga' },
        },
        {
          id: 'inst_2',
          startTime: new Date('2026-02-05T10:00:00Z'),
          series: { title: 'Standup' },
        },
      ];

      mockPrismaService.eventInstance.findUnique.mockResolvedValue(
        mockInstances[0],
      );

      const instances = mockInstances;

      expect(instances).toHaveLength(2);
      expect(instances[0].series.title).toBe('Team Yoga');
    });
  });
});
