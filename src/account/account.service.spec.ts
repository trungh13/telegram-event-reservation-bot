import { Test, TestingModule } from '@nestjs/testing';
import { AccountService } from './account.service';
import { PrismaService } from '../prisma/prisma.service';
import { UnauthorizedException } from '@nestjs/common';

const mockPrismaService = {
  account: {
    create: jest.fn(),
  },
  apiKey: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
};

describe('AccountService', () => {
  let service: AccountService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AccountService>(AccountService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAccount', () => {
    it('should create an account and an api key', async () => {
      const mockAccount = { id: 'acc_123', name: 'Test Account' };
      const mockApiKey = { id: 'key_123', key: 'sk_test_key', accountId: 'acc_123' };

      mockPrismaService.account.create.mockResolvedValue(mockAccount);
      mockPrismaService.apiKey.create.mockResolvedValue(mockApiKey);

      const result = await service.createAccount('Test Account');

      expect(result.account).toEqual(mockAccount);
      expect(result.apiKey).toBeDefined();
      expect(mockPrismaService.account.create).toHaveBeenCalledWith({
        data: { name: 'Test Account' },
      });
    });
  });

  describe('validateApiKey', () => {
    it('should return account if key is valid', async () => {
      const mockAccount = { id: 'acc_123', name: 'Test Account' };
      const mockApiKeyRecord = { 
        id: 'key_123', 
        key: 'sk_valid', 
        accountId: 'acc_123',
        account: mockAccount 
      };

      mockPrismaService.apiKey.findUnique.mockResolvedValue(mockApiKeyRecord);

      const result = await service.validateApiKey('sk_valid');

      expect(result).toEqual(mockAccount);
    });

    it('should throw UnauthorizedException if key is invalid', async () => {
      mockPrismaService.apiKey.findUnique.mockResolvedValue(null);

      await expect(service.validateApiKey('sk_invalid')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
