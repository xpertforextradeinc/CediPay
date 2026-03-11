import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { Prisma, KYCStatus, Role, TransactionStatus, TransactionType } from '@prisma/client';
import { z } from 'zod';

// Helper function to create audit log
const createAuditLog = async (
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string | null,
  details: Record<string, unknown> | null,
  req: Request
) => {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      resourceType,
      resourceId,
      details: details ? JSON.stringify(details) : null,
      ipAddress: req.ip || null,
      userAgent: req.get('user-agent') || null,
    },
  });
};

// ==================== MERCHANT MANAGEMENT ====================

/**
 * Get list of all merchants with filtering and pagination
 */
export const getMerchants = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      page = '1', 
      limit = '20',
      kycStatus,
      role,
      search 
    } = req.query;

    // Parse and validate pagination parameters
    let pageNum = parseInt(page as string, 10);
    let limitNum = parseInt(limit as string, 10);

    if (!Number.isFinite(pageNum) || pageNum < 1) {
      pageNum = 1;
    }

    if (!Number.isFinite(limitNum) || limitNum < 1) {
      limitNum = 20;
    }

    const MAX_LIMIT = 100;
    if (limitNum > MAX_LIMIT) {
      limitNum = MAX_LIMIT;
    }

    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: Prisma.UserWhereInput = {};
    
    if (kycStatus) {
      const kycStatusValue = kycStatus as string;
      const isValidKycStatus = Object.values(KYCStatus).includes(kycStatusValue as KYCStatus);
      if (!isValidKycStatus) {
        res.status(400).json({ error: 'Invalid kycStatus value. Must be one of: PENDING, SUBMITTED, APPROVED, REJECTED' });
        return;
      }
      where.kycStatus = kycStatusValue as KYCStatus;
    }
    
    if (role) {
      const roleValue = role as string;
      const isValidRole = Object.values(Role).includes(roleValue as Role);
      if (!isValidRole) {
        res.status(400).json({ error: 'Invalid role value. Must be one of: USER, ADMIN' });
        return;
      }
      where.role = roleValue as Role;
    }
    
    if (search) {
      where.OR = [
        { email: { contains: search as string, mode: 'insensitive' } },
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { businessName: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [merchants, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          role: true,
          isVerified: true,
          kycStatus: true,
          kycSubmittedAt: true,
          kycVerifiedAt: true,
          businessName: true,
          businessRegistration: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              transactions: true,
              webhookEndpoints: true,
            },
          },
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    res.status(200).json({
      merchants,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching merchants:', error);
    res.status(500).json({ error: 'Failed to fetch merchants' });
  }
};

/**
 * Get a single merchant by ID with detailed information
 */
export const getMerchantById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'Merchant ID is required' });
      return;
    }

    const merchant = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        role: true,
        isVerified: true,
        kycStatus: true,
        kycSubmittedAt: true,
        kycVerifiedAt: true,
        kycNotes: true,
        businessName: true,
        businessRegistration: true,
        createdAt: true,
        updatedAt: true,
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            amount: true,
            type: true,
            status: true,
            network: true,
            createdAt: true,
          },
        },
        webhookEndpoints: {
          select: {
            id: true,
            url: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });

    if (!merchant) {
      res.status(404).json({ error: 'Merchant not found' });
      return;
    }

    res.status(200).json({ merchant });
  } catch (error) {
    console.error('Error fetching merchant:', error);
    res.status(500).json({ error: 'Failed to fetch merchant details' });
  }
};

// ==================== KYC MANAGEMENT ====================

const updateKYCSchema = z.object({
  kycStatus: z.enum(['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED']),
  kycNotes: z.string().optional(),
});

/**
 * Update KYC status for a merchant
 */
export const updateKYCStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({ error: 'Merchant ID is required' });
      return;
    }
    
    const validatedData = updateKYCSchema.parse(req.body);
    const { kycStatus, kycNotes } = validatedData;

    const merchant = await prisma.user.findUnique({
      where: { id },
    });

    if (!merchant) {
      res.status(404).json({ error: 'Merchant not found' });
      return;
    }

    const updateData: Prisma.UserUpdateInput = {
      kycStatus,
    };

    if (kycNotes !== undefined) {
      updateData.kycNotes = kycNotes;
    }

    if (kycStatus === 'APPROVED') {
      updateData.kycVerifiedAt = new Date();
    }

    const updatedMerchant = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        kycStatus: true,
        kycVerifiedAt: true,
        kycNotes: true,
      },
    });

    // Create audit log
    if (req.user) {
      await createAuditLog(
        req.user.id,
        'KYC_STATUS_UPDATED',
        'User',
        id,
        { kycStatus, kycNotes },
        req
      );
    }

    res.status(200).json({
      message: 'KYC status updated successfully',
      merchant: updatedMerchant,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    console.error('Error updating KYC status:', error);
    res.status(500).json({ error: 'Failed to update KYC status' });
  }
};

// ==================== TRANSACTION MANAGEMENT ====================

/**
 * Search and filter transactions
 */
export const getTransactions = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '50',
      status,
      type,
      userId,
      network,
      startDate,
      endDate,
    } = req.query;

    // Parse and validate pagination parameters
    let pageNum = parseInt(page as string, 10);
    let limitNum = parseInt(limit as string, 10);

    if (Number.isNaN(pageNum) || pageNum < 1) {
      pageNum = 1;
    }

    if (Number.isNaN(limitNum) || limitNum < 1) {
      limitNum = 50;
    }

    const MAX_LIMIT = 1000;
    if (limitNum > MAX_LIMIT) {
      limitNum = MAX_LIMIT;
    }

    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: Prisma.TransactionWhereInput = {};

    if (status) {
      const statusValue = status as string;
      const isValidStatus = Object.values(TransactionStatus).includes(statusValue as TransactionStatus);
      if (!isValidStatus) {
        res.status(400).json({ error: 'Invalid status value. Must be one of: PENDING, PROCESSING, COMPLETED, FAILED' });
        return;
      }
      where.status = statusValue as TransactionStatus;
    }

    if (type) {
      const typeValue = type as string;
      const isValidType = Object.values(TransactionType).includes(typeValue as TransactionType);
      if (!isValidType) {
        res.status(400).json({ error: 'Invalid type value. Must be one of: DEPOSIT, WITHDRAWAL' });
        return;
      }
      where.type = typeValue as TransactionType;
    }

    if (userId) {
      where.userId = userId as string;
    }

    if (network) {
      where.network = network as string;
    }

    if (startDate || endDate) {
      const parsedStartDate = typeof startDate === 'string' ? new Date(startDate) : undefined;
      const parsedEndDate = typeof endDate === 'string' ? new Date(endDate) : undefined;

      const hasValidStartDate = parsedStartDate instanceof Date && !isNaN(parsedStartDate.getTime());
      const hasValidEndDate = parsedEndDate instanceof Date && !isNaN(parsedEndDate.getTime());

      if (hasValidStartDate || hasValidEndDate) {
        where.createdAt = {};
        if (hasValidStartDate) {
          where.createdAt.gte = parsedStartDate!;
        }
        if (hasValidEndDate) {
          where.createdAt.lte = parsedEndDate!;
        }
      }
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              businessName: true,
            },
          },
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transaction.count({ where }),
    ]);

    // Calculate summary statistics
    const stats = await prisma.transaction.groupBy({
      by: ['status'],
      where,
      _sum: {
        amount: true,
      },
      _count: true,
    });

    res.status(200).json({
      transactions,
      stats,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
};

/**
 * Get a single transaction by ID
 */
export const getTransactionById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'Transaction ID is required' });
      return;
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            businessName: true,
          },
        },
        webhookDeliveries: {
          select: {
            id: true,
            event: true,
            status: true,
            attempts: true,
            lastAttemptAt: true,
            responseStatus: true,
            createdAt: true,
          },
        },
      },
    });

    if (!transaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    res.status(200).json({ transaction });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ error: 'Failed to fetch transaction details' });
  }
};

// ==================== METRICS & DASHBOARD ====================

/**
 * Get dashboard metrics
 */
export const getDashboardMetrics = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [
      totalMerchants,
      totalTransactions,
      pendingKYC,
      recentTransactions,
      transactionStats,
      merchantStats,
    ] = await Promise.all([
      // Total merchants
      prisma.user.count(),
      
      // Total transactions
      prisma.transaction.count(),
      
      // Pending KYC
      prisma.user.count({
        where: { kycStatus: 'SUBMITTED' },
      }),
      
      // Recent transactions (last 24 hours)
      prisma.transaction.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      
      // Transaction stats by status
      prisma.transaction.groupBy({
        by: ['status'],
        _sum: {
          amount: true,
        },
        _count: true,
      }),
      
      // Merchant stats by role
      prisma.user.groupBy({
        by: ['role'],
        _count: true,
      }),
    ]);

    res.status(200).json({
      metrics: {
        totalMerchants,
        totalTransactions,
        pendingKYC,
        recentTransactions,
      },
      transactionStats,
      merchantStats,
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
};

// ==================== AUDIT LOGS ====================

/**
 * Get audit logs with filtering
 */
export const getAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '50',
      userId,
      action,
      resourceType,
      startDate,
      endDate,
    } = req.query;

    // Parse and validate pagination parameters
    let pageNum = parseInt(page as string, 10);
    let limitNum = parseInt(limit as string, 10);

    if (Number.isNaN(pageNum) || pageNum < 1) {
      res.status(400).json({ error: 'Invalid page parameter. It must be a positive integer.' });
      return;
    }

    if (Number.isNaN(limitNum) || limitNum < 1) {
      res.status(400).json({ error: 'Invalid limit parameter. It must be a positive integer.' });
      return;
    }

    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: Prisma.AuditLogWhereInput = {};

    if (userId) {
      where.userId = userId as string;
    }

    if (action) {
      where.action = action as string;
    }

    if (resourceType) {
      where.resourceType = resourceType as string;
    }

    if (startDate || endDate) {
      const parsedStartDate = typeof startDate === 'string' ? new Date(startDate) : undefined;
      const parsedEndDate = typeof endDate === 'string' ? new Date(endDate) : undefined;

      const hasValidStartDate = parsedStartDate instanceof Date && !isNaN(parsedStartDate.getTime());
      const hasValidEndDate = parsedEndDate instanceof Date && !isNaN(parsedEndDate.getTime());

      if (hasValidStartDate || hasValidEndDate) {
        where.createdAt = {};
        if (hasValidStartDate) {
          where.createdAt.gte = parsedStartDate!;
        }
        if (hasValidEndDate) {
          where.createdAt.lte = parsedEndDate!;
        }
      }
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.status(200).json({
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
};

// ==================== PAYOUT & RECONCILIATION ====================

/**
 * Get pending payouts/withdrawals
 */
export const getPendingPayouts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20' } = req.query;

    // Parse and validate pagination parameters
    let pageNum = parseInt(page as string, 10);
    let limitNum = parseInt(limit as string, 10);

    if (Number.isNaN(pageNum) || pageNum < 1) {
      res.status(400).json({ error: 'Invalid page parameter. It must be a positive integer.' });
      return;
    }

    if (Number.isNaN(limitNum) || limitNum < 1) {
      res.status(400).json({ error: 'Invalid limit parameter. It must be a positive integer.' });
      return;
    }

    const skip = (pageNum - 1) * limitNum;

    const [payouts, total] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          type: 'WITHDRAWAL',
          status: { in: ['PENDING', 'PROCESSING'] },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              businessName: true,
            },
          },
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'asc' },
      }),
      prisma.transaction.count({
        where: {
          type: 'WITHDRAWAL',
          status: { in: ['PENDING', 'PROCESSING'] },
        },
      }),
    ]);

    res.status(200).json({
      payouts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching pending payouts:', error);
    res.status(500).json({ error: 'Failed to fetch pending payouts' });
  }
};

const updateTransactionStatusSchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']),
  notes: z.string().optional(),
});

/**
 * Update transaction status (for manual reconciliation)
 */
export const updateTransactionStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({ error: 'Transaction ID is required' });
      return;
    }
    
    const validatedData = updateTransactionStatusSchema.parse(req.body);
    const { status, notes } = validatedData;

    const transaction = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    const updatedTransaction = await prisma.transaction.update({
      where: { id },
      data: {
        status,
        details: notes ? 
          (transaction.details ? `${transaction.details}\n---\nAdmin note: ${notes}` : `Admin note: ${notes}`) 
          : transaction.details,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Create audit log
    if (req.user) {
      await createAuditLog(
        req.user.id,
        'TRANSACTION_STATUS_UPDATED',
        'Transaction',
        id,
        { oldStatus: transaction.status, newStatus: status, notes },
        req
      );
    }

    res.status(200).json({
      message: 'Transaction status updated successfully',
      transaction: updatedTransaction,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    console.error('Error updating transaction status:', error);
    res.status(500).json({ error: 'Failed to update transaction status' });
  }
};
