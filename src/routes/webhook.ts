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

const router = Router();

// All webhook routes require authentication
router.use(authenticateToken);

// Webhook endpoint management
router.post('/endpoints', registerWebhook);
router.get('/endpoints', getWebhookEndpoints);
router.patch('/endpoints/:id', updateWebhookEndpoint);
router.delete('/endpoints/:id', deleteWebhookEndpoint);

// Webhook delivery history
router.get('/deliveries', getWebhookHistory);
router.get('/deliveries/:id', getWebhookDelivery);

export default router;
