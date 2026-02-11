import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client';
import { TransactionType, TransactionStatus } from '@prisma/client';

// Validation schema for payment initiation
const initiatePaymentSchema = z.object({
  amount: z.number().min(1, 'Minimum payment is 1 GHS'),
  mobileNumber: z.string().regex(/^0\d{9}$/, 'Invalid Ghana mobile number format (e.g., 0541234567)'),
  network: z.enum(['MTN', 'VODAFONE', 'AIRTELTIGO'], { errorMap: () => ({ message: 'Invalid network' }) }),
  merchantId: z.string().min(1, 'Merchant ID is required'),
  customerName: z.string().min(1, 'Customer name is required').optional(),
  customerEmail: z.string().email('Invalid email').optional(),
  description: z.string().optional(),
});

// Validation schema for payment status check
const checkPaymentStatusSchema = z.object({
  transactionId: z.string().min(1, 'Transaction ID is required'),
});

/**
 * Initiate a mobile money payment
 */
export const initiatePayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = initiatePaymentSchema.parse(req.body);
    const { amount, mobileNumber, network, merchantId, customerName, customerEmail, description } = validatedData;

    // Find the merchant user
    const merchant = await prisma.user.findUnique({
      where: { id: merchantId },
    });

    if (!merchant) {
      res.status(404).json({ error: 'Merchant not found' });
      return;
    }

    // Create transaction record
    const transaction = await prisma.transaction.create({
      data: {
        userId: merchantId,
        amount,
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.PENDING,
        network,
        mobileNumber,
        details: JSON.stringify({
          customerName,
          customerEmail,
          description,
        }),
      },
    });

    // Simulate MTN MoMo payment initiation
    // In production, this would call the actual MTN MoMo API
    try {
      // For demo purposes, we'll simulate the payment request
      // In production, replace this with actual MTN MoMo API call
      const momoResponse = await simulateMTNMoMoRequest({
        amount,
        mobileNumber,
        network,
        reference: transaction.id,
      });

      // Update transaction with external reference
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          externalReference: momoResponse.reference,
          status: TransactionStatus.PROCESSING,
        },
      });

      res.status(200).json({
        success: true,
        message: 'Payment initiated successfully',
        data: {
          transactionId: transaction.id,
          reference: momoResponse.reference,
          status: 'PROCESSING',
          amount,
          network,
        },
      });
    } catch (error) {
      // Update transaction status to failed
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: TransactionStatus.FAILED },
      });

      throw error;
    }
  } catch (error) {
    console.error('Initiate payment error:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    } else {
      res.status(500).json({
        error: 'Failed to initiate payment',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
};

/**
 * Check payment status
 */
export const checkPaymentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { transactionId } = checkPaymentStatusSchema.parse(req.params);

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        amount: true,
        type: true,
        status: true,
        network: true,
        mobileNumber: true,
        externalReference: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!transaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    // In production, you might want to query the actual payment provider
    // to get the latest status
    res.status(200).json({
      success: true,
      data: {
        transactionId: transaction.id,
        status: transaction.status,
        amount: transaction.amount,
        network: transaction.network,
        reference: transaction.externalReference,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
      },
    });
  } catch (error) {
    console.error('Check payment status error:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    } else {
      res.status(500).json({ error: 'Failed to check payment status' });
    }
  }
};

/**
 * Simulate MTN MoMo payment request
 * In production, replace this with actual MTN MoMo API integration
 */
async function simulateMTNMoMoRequest(data: {
  amount: number;
  mobileNumber: string;
  network: string;
  reference: string;
}): Promise<{ reference: string; status: string }> {
  // This is a simulation for demo purposes
  // In production, you would call the actual MTN MoMo API like:
  /*
  const response = await axios.post(
    process.env.MTN_MOMO_API_URL || 'https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay',
    {
      amount: data.amount.toString(),
      currency: 'GHS',
      externalId: data.reference,
      payer: {
        partyIdType: 'MSISDN',
        partyId: data.mobileNumber,
      },
      payerMessage: 'Payment for CediPay',
      payeeNote: 'CediPay transaction',
    },
    {
      headers: {
        'X-Reference-Id': data.reference,
        'X-Target-Environment': process.env.MTN_MOMO_ENV || 'sandbox',
        'Ocp-Apim-Subscription-Key': process.env.MTN_MOMO_SUBSCRIPTION_KEY,
        Authorization: `Bearer ${process.env.MTN_MOMO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );
  */

  // For now, simulate a successful response
  return {
    reference: `MOMO-${data.reference}-${Date.now()}`,
    status: 'PROCESSING',
  };
}

/**
 * Webhook endpoint to receive payment status updates from MTN MoMo
 * This would be called by MTN MoMo when payment status changes
 */
export const handlePaymentWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate webhook signature (implement based on MTN MoMo specs)
    // For now, we'll accept any request in demo mode

    const { transactionId, status, externalReference } = req.body;

    if (!transactionId) {
      res.status(400).json({ error: 'Transaction ID is required' });
      return;
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    // Update transaction status
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: status || TransactionStatus.COMPLETED,
        externalReference: externalReference || transaction.externalReference,
      },
    });

    // Trigger webhook deliveries to merchant's registered endpoints
    // (This would use the existing webhook service)

    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
    });
  } catch (error) {
    console.error('Handle payment webhook error:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
};
