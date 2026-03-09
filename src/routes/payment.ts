import express from 'express';
import { initiatePayment, checkPaymentStatus, handlePaymentWebhook } from '../controllers/paymentController';

const router = express.Router();

// Public routes (no authentication required for widget usage)
router.post('/initiate', initiatePayment);
router.get('/status/:transactionId', checkPaymentStatus);
router.post('/webhook', handlePaymentWebhook);

export default router;
