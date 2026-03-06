import { Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import prisma from '../prisma/client';

// Validation schemas
const registerWebhookSchema = z.object({
  url: z.string().url('Invalid URL format'),
});

// Register a new webhook endpoint
export const registerWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const validatedData = registerWebhookSchema.parse(req.body);
    const { url } = validatedData;

    // Generate a unique secret for HMAC signing
    const secret = crypto.randomBytes(32).toString('hex');

    const webhookEndpoint = await prisma.webhookEndpoint.create({
      data: {
        userId: req.user.id,
        url,
        secret,
        isActive: true,
      },
      select: {
        id: true,
        url: true,
        secret: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(201).json({
      message: 'Webhook endpoint registered successfully',
      endpoint: webhookEndpoint,
    });
  } catch (error) {
    console.error('Register webhook error:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    } else {
      res.status(500).json({ error: 'Failed to register webhook endpoint' });
    }
  }
};

// Get all webhook endpoints for the current user
export const getWebhookEndpoints = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { userId: req.user.id },
      select: {
        id: true,
        url: true,
        secret: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      message: 'Webhook endpoints retrieved successfully',
      endpoints,
    });
  } catch (error) {
    console.error('Get webhook endpoints error:', error);
    res.status(500).json({ error: 'Failed to retrieve webhook endpoints' });
  }
};

// Update webhook endpoint (activate/deactivate or change URL)
export const updateWebhookEndpoint = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const id = req.params['id'] as string;
    const { url, isActive } = req.body;

    // Verify endpoint belongs to user
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: {
        id,
        userId: req.user.id,
      },
    });

    if (!endpoint) {
      res.status(404).json({ error: 'Webhook endpoint not found' });
      return;
    }

    const updateData: { url?: string; isActive?: boolean } = {};
    
    if (url !== undefined) {
      const validatedUrl = z.string().url().parse(url);
      updateData.url = validatedUrl;
    }
    
    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }

    const updatedEndpoint = await prisma.webhookEndpoint.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        url: true,
        secret: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(200).json({
      message: 'Webhook endpoint updated successfully',
      endpoint: updatedEndpoint,
    });
  } catch (error) {
    console.error('Update webhook endpoint error:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    } else {
      res.status(500).json({ error: 'Failed to update webhook endpoint' });
    }
  }
};

// Delete webhook endpoint
export const deleteWebhookEndpoint = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const id = req.params['id'] as string;

    // Verify endpoint belongs to user
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: {
        id,
        userId: req.user.id,
      },
    });

    if (!endpoint) {
      res.status(404).json({ error: 'Webhook endpoint not found' });
      return;
    }

    await prisma.webhookEndpoint.delete({
      where: { id },
    });

    res.status(200).json({
      message: 'Webhook endpoint deleted successfully',
    });
  } catch (error) {
    console.error('Delete webhook endpoint error:', error);
    res.status(500).json({ error: 'Failed to delete webhook endpoint' });
  }
};

// Get webhook delivery history
export const getWebhookHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { endpointId, status, limit = '50', offset = '0' } = req.query;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {
      webhookEndpoint: { userId: req.user.id },
    };

    if (endpointId && typeof endpointId === 'string') {
      // Verify endpoint belongs to user
      const endpoint = await prisma.webhookEndpoint.findFirst({
        where: {
          id: endpointId,
          userId: req.user.id,
        },
      });

      if (!endpoint) {
        res.status(404).json({ error: 'Webhook endpoint not found' });
        return;
      }

      whereClause.webhookEndpointId = endpointId;
    }

    if (status && typeof status === 'string') {
      whereClause.status = status;
    }

    const deliveries = await prisma.webhookDelivery.findMany({
      where: whereClause,
      select: {
        id: true,
        event: true,
        payload: true,
        status: true,
        attempts: true,
        lastAttemptAt: true,
        nextRetryAt: true,
        responseStatus: true,
        responseBody: true,
        errorMessage: true,
        createdAt: true,
        webhookEndpoint: {
          select: {
            id: true,
            url: true,
          },
        },
        transaction: {
          select: {
            id: true,
            amount: true,
            type: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(limit as string, 10), 100),
      skip: parseInt(offset as string, 10),
    });

    const totalCount = await prisma.webhookDelivery.count({
      where: whereClause,
    });

    res.status(200).json({
      message: 'Webhook history retrieved successfully',
      deliveries,
      pagination: {
        total: totalCount,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10),
      },
    });
  } catch (error) {
    console.error('Get webhook history error:', error);
    res.status(500).json({ error: 'Failed to retrieve webhook history' });
  }
};

// Get specific webhook delivery details
export const getWebhookDelivery = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const id = req.params['id'] as string;

    const delivery = await prisma.webhookDelivery.findFirst({
      where: {
        id,
        webhookEndpoint: { userId: req.user.id },
      },
      select: {
        id: true,
        event: true,
        payload: true,
        status: true,
        attempts: true,
        lastAttemptAt: true,
        nextRetryAt: true,
        responseStatus: true,
        responseBody: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
        webhookEndpoint: {
          select: {
            id: true,
            url: true,
          },
        },
        transaction: {
          select: {
            id: true,
            amount: true,
            type: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!delivery) {
      res.status(404).json({ error: 'Webhook delivery not found' });
      return;
    }

    res.status(200).json({
      message: 'Webhook delivery retrieved successfully',
      delivery,
    });
  } catch (error) {
    console.error('Get webhook delivery error:', error);
    res.status(500).json({ error: 'Failed to retrieve webhook delivery' });
  }
};
