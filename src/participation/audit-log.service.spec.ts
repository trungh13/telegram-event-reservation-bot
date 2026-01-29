import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from './audit-log.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuditLogService', () => {
  let service: AuditLogService;
  const mockPrismaService = {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('logParticipantAdded', () => {
    it('should create audit log for added participant', async () => {
      mockPrismaService.auditLog.create.mockResolvedValue({
        id: 'log_1',
      });

      await service.logParticipantAdded(
        'inst_123',
        BigInt('12345'),
        'admin_user',
        'acc_123',
      );

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          accountId: 'acc_123',
          action: 'PARTICIPANT_ADDED',
          details: {
            instanceId: 'inst_123',
            userId: '12345',
            adminUsername: 'admin_user',
          },
        },
      });
    });
  });

  describe('logParticipantRemoved', () => {
    it('should create audit log for removed participant', async () => {
      mockPrismaService.auditLog.create.mockResolvedValue({
        id: 'log_1',
      });

      await service.logParticipantRemoved(
        'inst_123',
        BigInt('12345'),
        'admin_user',
        'acc_123',
      );

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          accountId: 'acc_123',
          action: 'PARTICIPANT_REMOVED',
          details: {
            instanceId: 'inst_123',
            userId: '12345',
            adminUsername: 'admin_user',
          },
        },
      });
    });
  });

  describe('logRegistrationClosed', () => {
    it('should create audit log for registration closed', async () => {
      mockPrismaService.auditLog.create.mockResolvedValue({
        id: 'log_1',
      });

      await service.logRegistrationClosed('inst_123', 'admin_user', 'acc_123');

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          accountId: 'acc_123',
          action: 'REGISTRATION_CLOSED',
          details: {
            instanceId: 'inst_123',
            adminUsername: 'admin_user',
          },
        },
      });
    });
  });

  describe('logRegistrationExtended', () => {
    it('should create audit log for registration extended', async () => {
      mockPrismaService.auditLog.create.mockResolvedValue({
        id: 'log_1',
      });

      await service.logRegistrationExtended(
        'inst_123',
        'admin_user',
        'acc_123',
      );

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          accountId: 'acc_123',
          action: 'REGISTRATION_EXTENDED',
          details: {
            instanceId: 'inst_123',
            adminUsername: 'admin_user',
          },
        },
      });
    });
  });

  describe('formatAuditLog', () => {
    it('should format participant added action', () => {
      const formatted = service.formatAuditAction('PARTICIPANT_ADDED', {
        userId: '12345',
        adminUsername: 'admin_user',
      });

      expect(formatted).toContain('added');
      expect(formatted).toContain('12345');
    });

    it('should format participant removed action', () => {
      const formatted = service.formatAuditAction('PARTICIPANT_REMOVED', {
        userId: '12345',
        adminUsername: 'admin_user',
      });

      expect(formatted).toContain('removed');
      expect(formatted).toContain('12345');
    });

    it('should format registration closed action', () => {
      const formatted = service.formatAuditAction('REGISTRATION_CLOSED', {
        adminUsername: 'admin_user',
      });

      expect(formatted).toContain('closed');
    });

    it('should format registration extended action', () => {
      const formatted = service.formatAuditAction('REGISTRATION_EXTENDED', {
        adminUsername: 'admin_user',
      });

      expect(formatted).toContain('extended');
    });
  });
});
