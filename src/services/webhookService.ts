import crypto from 'crypto';
import axios from 'axios';
import prisma from '../prisma/client';
import { TransactionStatus, WebhookDeliveryStatus } from '@prisma/client';

export interface WebhookPayload {
  event: string;
  transactionId: string;
  userId: string;
  status: TransactionStatus;
  amount: string;
  type: string;
  timestamp: string;
}

// Generate HMAC signature for webhook payload
export function generateSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

// Calculate next retry time with exponential backoff
export function calculateNextRetry(attempts: number): Date {
  // Exponential backoff: 1min, 5min, 15min, 1hr, 6hr
  const delays = [60, 300, 900, 3600, 21600]; // in seconds
  const delayIndex = Math.min(attempts, delays.length - 1);
  const delaySeconds = delays[delayIndex] ?? 60; // Default to 60 seconds if undefined
  
  return new Date(Date.now() + delaySeconds * 1000);
}

// Create a webhook delivery record
export async function createWebhookDelivery(
  transactionId: string,
  webhookEndpointId: string,
  event: string,
  payload: WebhookPayload
): Promise<string> {
  const delivery = await prisma.webhookDelivery.create({
    data: {
      transactionId,
      webhookEndpointId,
      event,
      payload: JSON.stringify(payload),
      status: WebhookDeliveryStatus.PENDING,
      nextRetryAt: new Date(), // Immediate first attempt
    },
  });

  return delivery.id;
}

// Send webhook to endpoint
export async function deliverWebhook(deliveryId: string): Promise<void> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      webhookEndpoint: true,
      transaction: true,
    },
  });

  if (!delivery || !delivery.webhookEndpoint.isActive) {
    return;
  }

  const endpoint = delivery.webhookEndpoint;
  const payloadString = delivery.payload;
  const signature = generateSignature(payloadString, endpoint.secret);

  try {
    const response = await axios.post(endpoint.url, JSON.parse(payloadString), {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': delivery.event,
      },
      timeout: 10000, // 10 second timeout
      validateStatus: () => true, // Don't throw on any status
    });

    const isSuccess = response.status >= 200 && response.status < 300;

    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        attempts: delivery.attempts + 1,
        lastAttemptAt: new Date(),
        status: isSuccess ? WebhookDeliveryStatus.SUCCESS : WebhookDeliveryStatus.FAILED,
        responseStatus: response.status,
        responseBody: JSON.stringify(response.data).substring(0, 1000), // Limit response body size
        nextRetryAt: isSuccess ? null : calculateNextRetry(delivery.attempts + 1),
        errorMessage: isSuccess ? null : `HTTP ${response.status}: ${response.statusText}`,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        attempts: delivery.attempts + 1,
        lastAttemptAt: new Date(),
        status: WebhookDeliveryStatus.FAILED,
        nextRetryAt: calculateNextRetry(delivery.attempts + 1),
        errorMessage: errorMessage.substring(0, 500),
      },
    });
  }
}

// Trigger webhook for transaction status change
export async function triggerWebhookForTransaction(
  transactionId: string,
  status: TransactionStatus
): Promise<void> {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      user: {
        include: {
          webhookEndpoints: {
            where: { isActive: true },
          },
        },
      },
    },
  });

  if (!transaction || transaction.user.webhookEndpoints.length === 0) {
    return;
  }

  // Map transaction status to webhook event
  const eventMap: Record<TransactionStatus, string> = {
    PENDING: 'payment.pending',
    PROCESSING: 'payment.processing',
    COMPLETED: 'payment.success',
    FAILED: 'payment.failed',
  };

  const event = eventMap[status];
  
  const payload: WebhookPayload = {
    event,
    transactionId: transaction.id,
    userId: transaction.userId,
    status: transaction.status,
    amount: transaction.amount.toString(),
    type: transaction.type,
    timestamp: new Date().toISOString(),
  };

  // Create webhook deliveries for all active endpoints
  for (const endpoint of transaction.user.webhookEndpoints) {
    const deliveryId = await createWebhookDelivery(
      transaction.id,
      endpoint.id,
      event,
      payload
    );
    
    // Trigger delivery asynchronously (don't await)
    deliverWebhook(deliveryId).catch((error) => {
      console.error(`Failed to deliver webhook ${deliveryId}:`, error);
    });
  }
}

// Retry failed webhooks
export async function retryFailedWebhooks(): Promise<void> {
  const now = new Date();
  
  const failedDeliveries = await prisma.webhookDelivery.findMany({
    where: {
      status: WebhookDeliveryStatus.FAILED,
      nextRetryAt: {
        lte: now,
      },
      attempts: {
        lt: 5, // Maximum 5 attempts
      },
    },
    take: 100, // Process in batches
  });

  for (const delivery of failedDeliveries) {
    // Update status to retrying
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: { status: WebhookDeliveryStatus.RETRYING },
    });

    // Attempt delivery
    await deliverWebhook(delivery.id);
  }
}
