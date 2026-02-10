import request from 'supertest';
import express from 'express';
import webhookRoutes from '../routes/webhook';
import prisma from '../prisma/client';
import jwt from 'jsonwebtoken';

// Mock console.error to suppress error logs during tests
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

// Mock prisma
jest.mock('../prisma/client', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
    webhookEndpoint: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    webhookDelivery: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
  },
}));

// Create a test Express app
const app = express();
app.use(express.json());
app.use('/api/webhooks', webhookRoutes);

describe('Webhook Controller', () => {
  let authToken: string;
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    phoneNumber: null,
    isVerified: true,
    role: 'USER',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(() => {
    // Generate a valid JWT token for testing
    authToken = jwt.sign({ userId: 'user-123' }, process.env['JWT_SECRET'] || 'test-secret');
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy.mockClear();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
  });

  describe('POST /api/webhooks/endpoints', () => {
    test('should register a new webhook endpoint', async () => {
      const mockEndpoint = {
        id: 'endpoint-123',
        userId: 'user-123',
        url: 'https://example.com/webhook',
        secret: 'generated-secret',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.webhookEndpoint.create as jest.Mock).mockResolvedValue(mockEndpoint);

      const response = await request(app)
        .post('/api/webhooks/endpoints')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ url: 'https://example.com/webhook' });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Webhook endpoint registered successfully');
      expect(response.body.endpoint.url).toBe('https://example.com/webhook');
      expect(response.body.endpoint.secret).toBeDefined();
    });

    test('should reject invalid URL', async () => {
      const response = await request(app)
        .post('/api/webhooks/endpoints')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ url: 'not-a-valid-url' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/webhooks/endpoints')
        .send({ url: 'https://example.com/webhook' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/webhooks/endpoints', () => {
    test('should return all webhook endpoints for user', async () => {
      const mockEndpoints = [
        {
          id: 'endpoint-1',
          url: 'https://example.com/webhook1',
          secret: 'secret-1',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'endpoint-2',
          url: 'https://example.com/webhook2',
          secret: 'secret-2',
          isActive: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.webhookEndpoint.findMany as jest.Mock).mockResolvedValue(mockEndpoints);

      const response = await request(app)
        .get('/api/webhooks/endpoints')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.endpoints).toHaveLength(2);
      expect(response.body.message).toBe('Webhook endpoints retrieved successfully');
    });

    test('should require authentication', async () => {
      const response = await request(app).get('/api/webhooks/endpoints');

      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /api/webhooks/endpoints/:id', () => {
    test('should update webhook endpoint URL', async () => {
      const mockEndpoint = {
        id: 'endpoint-123',
        userId: 'user-123',
        url: 'https://example.com/webhook',
        secret: 'secret',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.webhookEndpoint.findFirst as jest.Mock).mockResolvedValue(mockEndpoint);
      (prisma.webhookEndpoint.update as jest.Mock).mockResolvedValue({
        ...mockEndpoint,
        url: 'https://example.com/new-webhook',
      });

      const response = await request(app)
        .patch('/api/webhooks/endpoints/endpoint-123')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ url: 'https://example.com/new-webhook' });

      expect(response.status).toBe(200);
      expect(response.body.endpoint.url).toBe('https://example.com/new-webhook');
    });

    test('should toggle endpoint active status', async () => {
      const mockEndpoint = {
        id: 'endpoint-123',
        userId: 'user-123',
        url: 'https://example.com/webhook',
        secret: 'secret',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.webhookEndpoint.findFirst as jest.Mock).mockResolvedValue(mockEndpoint);
      (prisma.webhookEndpoint.update as jest.Mock).mockResolvedValue({
        ...mockEndpoint,
        isActive: false,
      });

      const response = await request(app)
        .patch('/api/webhooks/endpoints/endpoint-123')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ isActive: false });

      expect(response.status).toBe(200);
      expect(response.body.endpoint.isActive).toBe(false);
    });

    test('should return 404 for non-existent endpoint', async () => {
      (prisma.webhookEndpoint.findFirst as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .patch('/api/webhooks/endpoints/non-existent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ isActive: false });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/webhooks/endpoints/:id', () => {
    test('should delete webhook endpoint', async () => {
      const mockEndpoint = {
        id: 'endpoint-123',
        userId: 'user-123',
      };

      (prisma.webhookEndpoint.findFirst as jest.Mock).mockResolvedValue(mockEndpoint);
      (prisma.webhookEndpoint.delete as jest.Mock).mockResolvedValue(mockEndpoint);

      const response = await request(app)
        .delete('/api/webhooks/endpoints/endpoint-123')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Webhook endpoint deleted successfully');
    });

    test('should return 404 for non-existent endpoint', async () => {
      (prisma.webhookEndpoint.findFirst as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/webhooks/endpoints/non-existent')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/webhooks/deliveries', () => {
    test('should return webhook delivery history', async () => {
      const mockDeliveries = [
        {
          id: 'delivery-1',
          event: 'payment.success',
          payload: '{"test":"data"}',
          status: 'SUCCESS',
          attempts: 1,
          lastAttemptAt: new Date(),
          nextRetryAt: null,
          responseStatus: 200,
          responseBody: '{"received":true}',
          errorMessage: null,
          createdAt: new Date(),
          webhookEndpoint: {
            id: 'endpoint-1',
            url: 'https://example.com/webhook',
          },
          transaction: {
            id: 'tx-1',
            amount: '100.00',
            type: 'DEPOSIT',
            status: 'COMPLETED',
          },
        },
      ];

      (prisma.webhookDelivery.findMany as jest.Mock).mockResolvedValue(mockDeliveries);
      (prisma.webhookDelivery.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/webhooks/deliveries')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.deliveries).toHaveLength(1);
      expect(response.body.pagination.total).toBe(1);
    });

    test('should filter by endpoint ID', async () => {
      const mockEndpoint = { id: 'endpoint-123', userId: 'user-123' };
      
      (prisma.webhookEndpoint.findFirst as jest.Mock).mockResolvedValue(mockEndpoint);
      (prisma.webhookDelivery.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.webhookDelivery.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app)
        .get('/api/webhooks/deliveries?endpointId=endpoint-123')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(prisma.webhookDelivery.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            webhookEndpointId: 'endpoint-123',
          }),
        })
      );
    });

    test('should return 404 for non-existent endpoint', async () => {
      (prisma.webhookEndpoint.findFirst as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/webhooks/deliveries?endpointId=non-existent')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/webhooks/deliveries/:id', () => {
    test('should return specific webhook delivery', async () => {
      const mockDelivery = {
        id: 'delivery-123',
        event: 'payment.success',
        payload: '{"test":"data"}',
        status: 'SUCCESS',
        attempts: 1,
        lastAttemptAt: new Date(),
        nextRetryAt: null,
        responseStatus: 200,
        responseBody: '{"received":true}',
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        webhookEndpoint: {
          id: 'endpoint-1',
          url: 'https://example.com/webhook',
        },
        transaction: {
          id: 'tx-1',
          amount: '100.00',
          type: 'DEPOSIT',
          status: 'COMPLETED',
          createdAt: new Date(),
        },
      };

      (prisma.webhookDelivery.findFirst as jest.Mock).mockResolvedValue(mockDelivery);

      const response = await request(app)
        .get('/api/webhooks/deliveries/delivery-123')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.delivery.id).toBe('delivery-123');
    });

    test('should return 404 for non-existent delivery', async () => {
      (prisma.webhookDelivery.findFirst as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/webhooks/deliveries/non-existent')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });
});
