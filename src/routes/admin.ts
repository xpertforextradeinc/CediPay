import { Router } from 'express';
import {
  getMerchants,
  getMerchantById,
  updateKYCStatus,
  getTransactions,
  getTransactionById,
  getDashboardMetrics,
  getAuditLogs,
  getPendingPayouts,
  updateTransactionStatus,
} from '../controllers/adminController';
import { authenticateToken } from '../middleware/auth';
import { requireAdmin } from '../middleware/adminAuth';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// Dashboard metrics
router.get('/metrics', getDashboardMetrics);

// Merchant management
router.get('/merchants', getMerchants);
router.get('/merchants/:id', getMerchantById);

// KYC management
router.patch('/merchants/:id/kyc', updateKYCStatus);

// Transaction management
router.get('/transactions', getTransactions);
router.get('/transactions/:id', getTransactionById);
router.patch('/transactions/:id/status', updateTransactionStatus);

// Payout/reconciliation management
router.get('/payouts/pending', getPendingPayouts);

// Audit logs
router.get('/audit-logs', getAuditLogs);

export default router;
