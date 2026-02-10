import {
  generateSignature,
  calculateNextRetry,
  createWebhookDelivery,
  deliverWebhook,
  triggerWebhookForTransaction,
} from '../services/webhookService';
import prisma from '../prisma/client';
import axios from 'axios';
import { TransactionStatus, WebhookDeliveryStatus } from '@prisma/client';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock prisma
jest.mock('../prisma/client', () => ({
  __esModule: true,
  default: {
    webhookDelivery: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    transaction: {
      findUnique: jest.fn(),
    },
    webhookEndpoint: {
      findFirst: jest.fn(),
    },
  },
}));

describe('Webhook Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateSignature', () => {
    test('should generate a valid HMAC signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const secret = 'test-secret';
      
      const signature = generateSignature(payload, secret);
      
      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);
    });

    test('should generate consistent signatures for same input', () => {
      const payload = JSON.stringify({ test: 'data' });
      const secret = 'test-secret';
      
      const signature1 = generateSignature(payload, secret);
      const signature2 = generateSignature(payload, secret);
      
      expect(signature1).toBe(signature2);
    });

    test('should generate different signatures for different secrets', () => {
      const payload = JSON.stringify({ test: 'data' });
      
      const signature1 = generateSignature(payload, 'secret1');
      const signature2 = generateSignature(payload, 'secret2');
      
      expect(signature1).not.toBe(signature2);
    });
  });

  describe('calculateNextRetry', () => {
    test('should return a future date', () => {
      const now = Date.now();
      const nextRetry = calculateNextRetry(0);
      
      expect(nextRetry.getTime()).toBeGreaterThan(now);
    });

    test('should use exponential backoff', () => {
      const retry0 = calculateNextRetry(0);
      const retry1 = calculateNextRetry(1);
      const retry2 = calculateNextRetry(2);
      
      // Each retry should be further in the future
      expect(retry1.getTime()).toBeGreaterThan(retry0.getTime());
      expect(retry2.getTime()).toBeGreaterThan(retry1.getTime());
    });

    test('should cap at maximum delay for high attempt counts', () => {
      const retry5 = calculateNextRetry(5);
      const retry10 = calculateNextRetry(10);
      
      // Should use the same max delay
      const timeDiff = Math.abs(retry10.getTime() - retry5.getTime());
      expect(timeDiff).toBeLessThan(1000); // Within 1 second due to timing
    });
  });

  describe('createWebhookDelivery', () => {
    test('should create a webhook delivery record', async () => {
      const mockDelivery = {
        id: 'delivery-123',
        transactionId: 'tx-123',
        webhookEndpointId: 'endpoint-123',
        event: 'payment.success',
        payload: '{"test":"data"}',
        status: WebhookDeliveryStatus.PENDING,
      };

      (prisma.webhookDelivery.create as jest.Mock).mockResolvedValue(mockDelivery);

      const payload = {
        event: 'payment.success',
        transactionId: 'tx-123',
        userId: 'user-123',
        status: TransactionStatus.COMPLETED,
        amount: '100.00',
        type: 'DEPOSIT',
        timestamp: new Date().toISOString(),
      };

      const deliveryId = await createWebhookDelivery(
        'tx-123',
        'endpoint-123',
        'payment.success',
        payload
      );

      expect(deliveryId).toBe('delivery-123');
      expect(prisma.webhookDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            transactionId: 'tx-123',
            webhookEndpointId: 'endpoint-123',
            event: 'payment.success',
          }),
        })
      );
    });
  });

  describe('deliverWebhook', () => {
    test('should successfully deliver webhook on 200 response', async () => {
      const mockDelivery = {
        id: 'delivery-123',
        payload: JSON.stringify({ test: 'data' }),
        event: 'payment.success',
        attempts: 0,
        webhookEndpoint: {
          id: 'endpoint-123',
          url: 'https://example.com/webhook',
          secret: 'test-secret',
          isActive: true,
        },
      };

      (prisma.webhookDelivery.findUnique as jest.Mock).mockResolvedValue(mockDelivery);
      (prisma.webhookDelivery.update as jest.Mock).mockResolvedValue({});
      
      mockedAxios.post.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        data: { received: true },
      });

      await deliverWebhook('delivery-123');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://example.com/webhook',
        { test: 'data' },
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Webhook-Event': 'payment.success',
          }),
        })
      );

      expect(prisma.webhookDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'delivery-123' },
          data: expect.objectContaining({
            status: WebhookDeliveryStatus.SUCCESS,
            attempts: 1,
          }),
        })
      );
    });

    test('should mark delivery as failed on non-2xx response', async () => {
      const mockDelivery = {
        id: 'delivery-123',
        payload: JSON.stringify({ test: 'data' }),
        event: 'payment.success',
        attempts: 0,
        webhookEndpoint: {
          id: 'endpoint-123',
          url: 'https://example.com/webhook',
          secret: 'test-secret',
          isActive: true,
        },
      };

      (prisma.webhookDelivery.findUnique as jest.Mock).mockResolvedValue(mockDelivery);
      (prisma.webhookDelivery.update as jest.Mock).mockResolvedValue({});
      
      mockedAxios.post.mockResolvedValue({
        status: 500,
        statusText: 'Internal Server Error',
        data: { error: 'Server error' },
      });

      await deliverWebhook('delivery-123');

      expect(prisma.webhookDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'delivery-123' },
          data: expect.objectContaining({
            status: WebhookDeliveryStatus.FAILED,
            responseStatus: 500,
          }),
        })
      );
    });

    test('should not deliver to inactive endpoint', async () => {
      const mockDelivery = {
        id: 'delivery-123',
        webhookEndpoint: {
          isActive: false,
        },
      };

      (prisma.webhookDelivery.findUnique as jest.Mock).mockResolvedValue(mockDelivery);

      await deliverWebhook('delivery-123');

      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    test('should handle network errors gracefully', async () => {
      const mockDelivery = {
        id: 'delivery-123',
        payload: JSON.stringify({ test: 'data' }),
        event: 'payment.success',
        attempts: 0,
        webhookEndpoint: {
          id: 'endpoint-123',
          url: 'https://example.com/webhook',
          secret: 'test-secret',
          isActive: true,
        },
      };

      (prisma.webhookDelivery.findUnique as jest.Mock).mockResolvedValue(mockDelivery);
      (prisma.webhookDelivery.update as jest.Mock).mockResolvedValue({});
      
      mockedAxios.post.mockRejectedValue(new Error('Network error'));

      await deliverWebhook('delivery-123');

      expect(prisma.webhookDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'delivery-123' },
          data: expect.objectContaining({
            status: WebhookDeliveryStatus.FAILED,
            errorMessage: 'Network error',
          }),
        })
      );
    });
  });

  describe('triggerWebhookForTransaction', () => {
    test('should create webhooks for all active endpoints', async () => {
      const mockTransaction = {
        id: 'tx-123',
        userId: 'user-123',
        amount: { toString: () => '100.00' },
        type: 'DEPOSIT',
        status: TransactionStatus.COMPLETED,
        user: {
          webhookEndpoints: [
            { id: 'endpoint-1', isActive: true },
            { id: 'endpoint-2', isActive: true },
          ],
        },
      };

      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(mockTransaction);
      (prisma.webhookDelivery.create as jest.Mock).mockResolvedValue({ id: 'delivery-123' });
      (prisma.webhookDelivery.findUnique as jest.Mock).mockResolvedValue(null);

      await triggerWebhookForTransaction('tx-123', TransactionStatus.COMPLETED);

      expect(prisma.webhookDelivery.create).toHaveBeenCalledTimes(2);
    });

    test('should not create webhooks if no endpoints', async () => {
      const mockTransaction = {
        id: 'tx-123',
        userId: 'user-123',
        user: {
          webhookEndpoints: [],
        },
      };

      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(mockTransaction);

      await triggerWebhookForTransaction('tx-123', TransactionStatus.COMPLETED);

      expect(prisma.webhookDelivery.create).not.toHaveBeenCalled();
    });

    test('should map transaction status to correct event', async () => {
      const mockTransaction = {
        id: 'tx-123',
        userId: 'user-123',
        amount: { toString: () => '100.00' },
        type: 'DEPOSIT',
        status: TransactionStatus.FAILED,
        user: {
          webhookEndpoints: [{ id: 'endpoint-1', isActive: true }],
        },
      };

      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(mockTransaction);
      (prisma.webhookDelivery.create as jest.Mock).mockResolvedValue({ id: 'delivery-123' });

      await triggerWebhookForTransaction('tx-123', TransactionStatus.FAILED);

      expect(prisma.webhookDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event: 'payment.failed',
          }),
        })
      );
    });
  });
});
