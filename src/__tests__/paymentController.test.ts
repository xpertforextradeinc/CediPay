import request from 'supertest';
import express from 'express';
import paymentRoutes from '../routes/payment';
import prisma from '../prisma/client';
import { TransactionType, TransactionStatus } from '@prisma/client';

// Mock console.error to suppress error logs during tests
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

// Mock prisma
jest.mock('../prisma/client', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

// Create a test Express app
const app = express();
app.use(express.json());
app.use('/api/payments', paymentRoutes);

describe('Payment Controller', () => {
  const mockMerchant = {
    id: 'merchant-123',
    email: 'merchant@example.com',
    firstName: 'Test',
    lastName: 'Merchant',
    phoneNumber: '0541234567',
    isVerified: true,
    role: 'USER',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTransaction = {
    id: 'txn-123',
    userId: 'merchant-123',
    amount: 100,
    type: TransactionType.DEPOSIT,
    status: TransactionStatus.PENDING,
    network: 'MTN',
    mobileNumber: '0541234567',
    externalReference: null,
    details: JSON.stringify({
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      description: 'Test payment',
    }),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('POST /api/payments/initiate', () => {
    it('should initiate a payment successfully', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockMerchant);
      (prisma.transaction.create as jest.Mock).mockResolvedValue(mockTransaction);
      (prisma.transaction.update as jest.Mock).mockResolvedValue({
        ...mockTransaction,
        status: TransactionStatus.PROCESSING,
        externalReference: 'MOMO-REF-123',
      });

      const response = await request(app)
        .post('/api/payments/initiate')
        .send({
          amount: 100,
          mobileNumber: '0541234567',
          network: 'MTN',
          merchantId: 'merchant-123',
          customerName: 'John Doe',
          customerEmail: 'john@example.com',
          description: 'Test payment',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Payment initiated successfully');
      expect(response.body.data).toHaveProperty('transactionId');
      expect(response.body.data.status).toBe('PROCESSING');
    });

    it('should return 404 if merchant not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/payments/initiate')
        .send({
          amount: 100,
          mobileNumber: '0541234567',
          network: 'MTN',
          merchantId: 'non-existent-merchant',
          customerName: 'John Doe',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Merchant not found');
    });

    it('should return 400 for invalid amount', async () => {
      const response = await request(app)
        .post('/api/payments/initiate')
        .send({
          amount: 0,
          mobileNumber: '0541234567',
          network: 'MTN',
          merchantId: 'merchant-123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for invalid mobile number format', async () => {
      const response = await request(app)
        .post('/api/payments/initiate')
        .send({
          amount: 100,
          mobileNumber: '12345',
          network: 'MTN',
          merchantId: 'merchant-123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for invalid network', async () => {
      const response = await request(app)
        .post('/api/payments/initiate')
        .send({
          amount: 100,
          mobileNumber: '0541234567',
          network: 'INVALID_NETWORK',
          merchantId: 'merchant-123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should handle payment initiation errors', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockMerchant);
      (prisma.transaction.create as jest.Mock).mockResolvedValue(mockTransaction);
      (prisma.transaction.update as jest.Mock).mockRejectedValue(new Error('MoMo service unavailable'));

      const response = await request(app)
        .post('/api/payments/initiate')
        .send({
          amount: 100,
          mobileNumber: '0541234567',
          network: 'MTN',
          merchantId: 'merchant-123',
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to initiate payment');
    });
  });

  describe('GET /api/payments/status/:transactionId', () => {
    const completedTransaction = {
      id: 'txn-123',
      amount: 100,
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.COMPLETED,
      network: 'MTN',
      mobileNumber: '0541234567',
      externalReference: 'MOMO-REF-123',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return transaction status successfully', async () => {
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(completedTransaction);

      const response = await request(app).get('/api/payments/status/txn-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.transactionId).toBe('txn-123');
      expect(response.body.data.status).toBe('COMPLETED');
    });

    it('should return 404 if transaction not found', async () => {
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/api/payments/status/non-existent-txn');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Transaction not found');
    });

    it('should handle database errors', async () => {
      (prisma.transaction.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/payments/status/txn-123');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to check payment status');
    });
  });

  describe('POST /api/payments/webhook', () => {
    it('should process webhook successfully', async () => {
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(mockTransaction);
      (prisma.transaction.update as jest.Mock).mockResolvedValue({
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
      });

      const response = await request(app)
        .post('/api/payments/webhook')
        .send({
          transactionId: 'txn-123',
          status: 'COMPLETED',
          externalReference: 'MOMO-REF-123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Webhook processed successfully');
    });

    it('should return 400 if transaction ID missing', async () => {
      const response = await request(app)
        .post('/api/payments/webhook')
        .send({
          status: 'COMPLETED',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Transaction ID is required');
    });

    it('should return 404 if transaction not found', async () => {
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/payments/webhook')
        .send({
          transactionId: 'non-existent-txn',
          status: 'COMPLETED',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Transaction not found');
    });

    it('should handle webhook processing errors', async () => {
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(mockTransaction);
      (prisma.transaction.update as jest.Mock).mockRejectedValue(new Error('Update failed'));

      const response = await request(app)
        .post('/api/payments/webhook')
        .send({
          transactionId: 'txn-123',
          status: 'COMPLETED',
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to process webhook');
    });
  });
});
