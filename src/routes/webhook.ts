import { Router } from 'express';
import {
  registerWebhook,
  getWebhookEndpoints,
  updateWebhookEndpoint,
  deleteWebhookEndpoint,
  getWebhookHistory,
  getWebhookDelivery,
} from '../controllers/webhookController';
import { authenticateToken } from '../middleware/auth';
import rateLimit from 'express-rate-limit';

const router = Router();

const webhookRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs for webhook routes
});

// All webhook routes require authentication
router.use(authenticateToken);
router.use(webhookRateLimiter);

// Webhook endpoint management
router.post('/endpoints', registerWebhook);
router.get('/endpoints', getWebhookEndpoints);
router.patch('/endpoints/:id', updateWebhookEndpoint);
router.delete('/endpoints/:id', deleteWebhookEndpoint);

// Webhook delivery history
router.get('/deliveries', getWebhookHistory);
router.get('/deliveries/:id', getWebhookDelivery);

export default router;
