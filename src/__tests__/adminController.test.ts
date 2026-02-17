import request from 'supertest';
import app from '../app';
import prisma from '../prisma/client';
import jwt from 'jsonwebtoken';

// Mock Prisma
jest.mock('../prisma/client', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
    },
    transaction: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

describe('Admin Middleware', () => {
  let adminToken: string;
  let userToken: string;
  const adminUser = {
    id: 'admin123',
    email: 'admin@cedipay.com',
    firstName: 'Admin',
    lastName: 'User',
    phoneNumber: null,
    isVerified: true,
    role: 'ADMIN',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const regularUser = {
    id: 'user123',
    email: 'user@cedipay.com',
    firstName: 'Regular',
    lastName: 'User',
    phoneNumber: null,
    isVerified: true,
    role: 'USER',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(() => {
    if (!process.env['JWT_SECRET']) {
      process.env['JWT_SECRET'] = 'test-secret-key';
    }
    adminToken = jwt.sign({ userId: adminUser.id }, process.env['JWT_SECRET']);
    userToken = jwt.sign({ userId: regularUser.id }, process.env['JWT_SECRET']);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/metrics', () => {
    it('should return metrics for admin user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(adminUser);
      (prisma.user.count as jest.Mock).mockResolvedValueOnce(10).mockResolvedValueOnce(2);
      (prisma.transaction.count as jest.Mock).mockResolvedValueOnce(100).mockResolvedValueOnce(5);
      (prisma.transaction.groupBy as jest.Mock).mockResolvedValue([
        { status: 'COMPLETED', _count: 50, _sum: { amount: 5000 } },
        { status: 'PENDING', _count: 30, _sum: { amount: 3000 } },
      ]);
      (prisma.user.groupBy as jest.Mock).mockResolvedValue([
        { role: 'USER', _count: 8 },
        { role: 'ADMIN', _count: 2 },
      ]);

      const response = await request(app)
        .get('/api/admin/metrics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.metrics).toBeDefined();
      expect(response.body.metrics.totalMerchants).toBe(10);
      expect(response.body.transactionStats).toBeDefined();
    });

    it('should reject non-admin user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(regularUser);

      const response = await request(app)
        .get('/api/admin/metrics')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Admin access required');
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app).get('/api/admin/metrics');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });
  });

  describe('GET /api/admin/merchants', () => {
    it('should return list of merchants for admin', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(adminUser);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'merchant1',
          email: 'merchant1@test.com',
          firstName: 'Merchant',
          lastName: 'One',
          role: 'USER',
          kycStatus: 'APPROVED',
          createdAt: new Date(),
          _count: { transactions: 10, webhookEndpoints: 1 },
        },
      ]);
      (prisma.user.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/admin/merchants')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.merchants).toHaveLength(1);
      expect(response.body.pagination).toBeDefined();
    });

    it('should filter merchants by KYC status', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(adminUser);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .get('/api/admin/merchants?kycStatus=SUBMITTED')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ kycStatus: 'SUBMITTED' }),
        })
      );
    });
  });

  describe('GET /api/admin/merchants/:id', () => {
    it('should return merchant details', async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(adminUser)
        .mockResolvedValueOnce({
          id: 'merchant1',
          email: 'merchant1@test.com',
          firstName: 'Merchant',
          lastName: 'One',
          role: 'USER',
          kycStatus: 'APPROVED',
          transactions: [],
          webhookEndpoints: [],
        });

      const response = await request(app)
        .get('/api/admin/merchants/merchant1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.merchant).toBeDefined();
      expect(response.body.merchant.email).toBe('merchant1@test.com');
    });

    it('should return 404 for non-existent merchant', async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(adminUser)
        .mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/admin/merchants/nonexistent')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Merchant not found');
    });
  });

  describe('PATCH /api/admin/merchants/:id/kyc', () => {
    it('should update KYC status', async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(adminUser)
        .mockResolvedValueOnce({ id: 'merchant1', kycStatus: 'SUBMITTED' });
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: 'merchant1',
        email: 'merchant1@test.com',
        firstName: 'Merchant',
        lastName: 'One',
        kycStatus: 'APPROVED',
        kycVerifiedAt: new Date(),
      });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .patch('/api/admin/merchants/merchant1/kyc')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ kycStatus: 'APPROVED', kycNotes: 'All documents verified' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('KYC status updated successfully');
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'KYC_STATUS_UPDATED',
          }),
        })
      );
    });

    it('should reject invalid KYC status', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(adminUser);

      const response = await request(app)
        .patch('/api/admin/merchants/merchant1/kyc')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ kycStatus: 'INVALID_STATUS' });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/admin/transactions', () => {
    it('should return list of transactions', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(adminUser);
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'tx1',
          amount: 100,
          status: 'COMPLETED',
          type: 'DEPOSIT',
          user: { email: 'user@test.com' },
        },
      ]);
      (prisma.transaction.count as jest.Mock).mockResolvedValue(1);
      (prisma.transaction.groupBy as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/admin/transactions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.transactions).toHaveLength(1);
      expect(response.body.stats).toBeDefined();
    });

    it('should filter transactions by status', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(adminUser);
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.transaction.count as jest.Mock).mockResolvedValue(0);
      (prisma.transaction.groupBy as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/admin/transactions?status=PENDING')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING' }),
        })
      );
    });
  });

  describe('PATCH /api/admin/transactions/:id/status', () => {
    it('should update transaction status', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(adminUser);
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue({
        id: 'tx1',
        status: 'PENDING',
      });
      (prisma.transaction.update as jest.Mock).mockResolvedValue({
        id: 'tx1',
        status: 'COMPLETED',
        user: { email: 'user@test.com' },
      });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .patch('/api/admin/transactions/tx1/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'COMPLETED', notes: 'Manually verified' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Transaction status updated successfully');
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('GET /api/admin/payouts/pending', () => {
    it('should return pending payouts', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(adminUser);
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'payout1',
          amount: 500,
          type: 'WITHDRAWAL',
          status: 'PENDING',
          user: { email: 'merchant@test.com' },
        },
      ]);
      (prisma.transaction.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/admin/payouts/pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.payouts).toHaveLength(1);
      expect(response.body.payouts[0].type).toBe('WITHDRAWAL');
    });
  });

  describe('GET /api/admin/audit-logs', () => {
    it('should return audit logs', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(adminUser);
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'log1',
          action: 'KYC_STATUS_UPDATED',
          resourceType: 'User',
          user: { email: 'admin@test.com' },
          createdAt: new Date(),
        },
      ]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.logs).toHaveLength(1);
      expect(response.body.logs[0].action).toBe('KYC_STATUS_UPDATED');
    });

    it('should filter audit logs by action', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(adminUser);
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .get('/api/admin/audit-logs?action=KYC_APPROVED')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ action: 'KYC_APPROVED' }),
        })
      );
    });
  });
});
