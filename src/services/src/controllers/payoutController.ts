import { Request, Response } from 'express';
import { prisma } from '../lib/prisma'; // Assuming you have a prisma client instance here
import { sendMobileMoney } from '../services/fiatService';

export const initiateWithdrawal = async (req: Request, res: Response) => {
  try {
    const { amount, mobileNumber, network, userId } = req.body;

    // 1. RECORD THE TRANSACTION (Pending)
    // We save this BEFORE calling the API to ensure we have a record even if the API fails
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        amount,
        type: 'WITHDRAWAL',
        status: 'PENDING',
        details: `MoMo Withdrawal to ${network} - ${mobileNumber}`
      }
    });

    // 2. TRIGGER THE PAYOUT
    const payoutResult = await sendMobileMoney({ amount, mobileNumber, network });

    // 3. UPDATE STATUS IF SUCCESSFUL
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { 
        status: 'PROCESSING', // Processing usually means sent to bank, waiting for webhook
        externalReference: payoutResult.ref 
      }
    });

    res.status(200).json({ success: true, message: "Withdrawal initiated", txId: transaction.id });

  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
};
