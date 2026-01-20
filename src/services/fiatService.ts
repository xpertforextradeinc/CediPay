import axios from 'axios';
import { z } from 'zod';

// 1. Define the Schema for a Payout (Strict Validation)
const PayoutSchema = z.object({
  amount: z.number().min(1, "Minimum payout is 1 GHS"),
  mobileNumber: z.string().length(10, "Invalid Ghana number"), // e.g., 054xxxxxxx
  network: z.enum(['MTN', 'VODAFONE', 'AIRTELTIGO']),
});

type PayoutRequest = z.infer<typeof PayoutSchema>;

export const sendMobileMoney = async (data: PayoutRequest) => {
  // Validate input first
  const cleanData = PayoutSchema.parse(data);

  try {
    // 2. Call the Payment Provider (e.g., Paystack/Flutterwave)
    // Replace URL with your actual provider endpoint
    const response = await axios.post(
      'https://api.paystack.co/transfer/initiate', 
      {
        source: "balance", 
        amount: cleanData.amount * 100, // Convert to pesewas
        recipient: cleanData.mobileNumber,
        reason: "CediPay Crypto Withdrawal"
      },
      {
        headers: {
          Authorization: `Bearer ${process.env['PAYSTACK_SECRET_KEY']}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return { success: true, ref: response.data.data.reference };

  } catch (error) {
    console.error("Payout Failed:", error);
    throw new Error("Mobile Money transfer failed");
  }
};
      
