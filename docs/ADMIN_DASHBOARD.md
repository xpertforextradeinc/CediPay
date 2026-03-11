# Admin Dashboard Setup Guide

## Overview

The CediPay Admin Dashboard is a secure web interface for platform operators to manage merchants, review KYC submissions, monitor transactions, and handle payout requests.

## Features

### 🔐 Secure Authentication
- Admin-only access with JWT-based authentication
- Role-based authorization (ADMIN role required)
- Automatic session management

### 👥 Merchant Management
- View all registered merchants
- Filter by KYC status, role, or search by name/email
- View detailed merchant profiles
- Track transaction history per merchant

### ✅ KYC Review Tools
- Review pending KYC submissions
- Approve or reject KYC applications
- Add notes for approval/rejection decisions
- Track KYC verification dates

### 💳 Transaction Management
- Search and filter all transactions
- Filter by status, type, network, date range
- View detailed transaction information
- Monitor webhook delivery status

### 💰 Payout/Reconciliation
- View pending withdrawal requests
- Process payouts manually
- Update transaction statuses
- Track payout history

### 📊 Dashboard Metrics
- Total merchants count
- Total transactions volume
- Pending KYC submissions
- Recent activity (24h)
- Transaction statistics by status

### 📋 Audit Logs
- Track all admin actions
- Filter by action type, resource, or date
- View IP addresses and user agents
- Ensure accountability and compliance

## Setup Instructions

### 1. Create an Admin User

First, you need to create a user account with admin privileges. You can do this in two ways:

#### Option A: Using the API

```bash
# Register a new user
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@cedipay.com",
    "password": "SecurePassword123!",
    "firstName": "Admin",
    "lastName": "User"
  }'
```

Then manually update the database to set the role to ADMIN:

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'admin@cedipay.com';
```

#### Option B: Direct Database Insert

```sql
-- Using bcrypt hash for password "AdminPassword123!"
INSERT INTO users (id, email, password, "firstName", "lastName", role, "isVerified", "createdAt", "updatedAt", "kycStatus")
VALUES (
  'admin_001',
  'admin@cedipay.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5rZGQxwRqZE82', -- AdminPassword123!
  'Admin',
  'User',
  'ADMIN',
  true,
  NOW(),
  NOW(),
  'APPROVED'
);
```

### 2. Run Database Migration

Apply the Prisma schema changes to your database:

```bash
npx prisma migrate dev --name add_admin_dashboard_models
```

This will create the new fields and tables:
- `kycStatus`, `kycSubmittedAt`, `kycVerifiedAt`, `kycNotes`, `businessName`, `businessRegistration` fields in `users` table
- `audit_logs` table for tracking admin actions

### 3. Start the Server

```bash
npm run dev
```

### 4. Access the Dashboard

Open your browser and navigate to:

```
http://localhost:4000/admin-dashboard.html
```

Login with your admin credentials.

## API Endpoints

All admin endpoints require authentication with an ADMIN role.

### Dashboard Metrics
- `GET /api/admin/metrics` - Get platform metrics and statistics

### Merchant Management
- `GET /api/admin/merchants` - List all merchants with filtering
  - Query params: `page`, `limit`, `kycStatus`, `role`, `search`
- `GET /api/admin/merchants/:id` - Get merchant details

### KYC Management
- `PATCH /api/admin/merchants/:id/kyc` - Update KYC status
  - Body: `{ kycStatus: "APPROVED" | "REJECTED", kycNotes?: string }`

### Transaction Management
- `GET /api/admin/transactions` - List all transactions with filtering
  - Query params: `page`, `limit`, `status`, `type`, `userId`, `network`, `startDate`, `endDate`
- `GET /api/admin/transactions/:id` - Get transaction details
- `PATCH /api/admin/transactions/:id/status` - Update transaction status
  - Body: `{ status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED", notes?: string }`

### Payout Management
- `GET /api/admin/payouts/pending` - List pending payouts
  - Query params: `page`, `limit`

### Audit Logs
- `GET /api/admin/audit-logs` - List audit logs with filtering
  - Query params: `page`, `limit`, `userId`, `action`, `resourceType`, `startDate`, `endDate`

## Security Features

### Authentication & Authorization
- JWT-based authentication required for all endpoints
- Role-based access control (ADMIN role only)
- Automatic token validation and refresh

### XSS Protection
- All user input is HTML-escaped before rendering
- Content Security Policy configured
- No inline script execution from user data

### Audit Logging
- All admin actions are logged automatically
- Logs include: user ID, action type, resource affected, IP address, user agent
- Logs are immutable and timestamped

### Input Validation
- Zod schema validation on all inputs
- Type-safe API calls
- Error handling for invalid data

## Usage Examples

### Reviewing KYC Submissions

1. Navigate to "KYC Review" in the sidebar
2. See list of pending KYC submissions
3. Click "Approve" or "Reject"
4. Enter notes explaining your decision
5. The merchant receives the updated status

### Managing Transactions

1. Navigate to "Transactions" in the sidebar
2. Use filters to find specific transactions:
   - By status (PENDING, COMPLETED, FAILED)
   - By type (DEPOSIT, WITHDRAWAL)
   - By network (MTN, VODAFONE, AIRTELTIGO)
   - By date range
3. Click "View" to see transaction details
4. Click "Update Status" to manually change transaction status
5. Add notes for reconciliation

### Processing Payouts

1. Navigate to "Payouts" in the sidebar
2. See list of pending withdrawal requests
3. Review payout details (amount, merchant, mobile number)
4. Click "Complete" when payout is processed
5. Click "Fail" if payout cannot be processed
6. Add notes explaining the outcome

### Viewing Audit Logs

1. Navigate to "Audit Logs" in the sidebar
2. See all admin actions chronologically
3. Filter by:
   - Action type (e.g., KYC_APPROVED, TRANSACTION_STATUS_UPDATED)
   - Resource type (e.g., User, Transaction)
   - Date range
4. Track who did what and when

## Troubleshooting

### Cannot Login

**Error**: "Admin access required"
- **Solution**: Ensure your user account has `role = 'ADMIN'` in the database

**Error**: "Invalid token"
- **Solution**: Clear browser localStorage and login again

### No Merchants Showing

**Error**: Empty merchant list
- **Solution**: Check that users exist in the database. Register test merchants via `/api/auth/register`

### Filters Not Working

- **Solution**: Ensure you click "Apply Filters" button after changing filter values
- Check browser console for any JavaScript errors

### Database Errors

**Error**: Column does not exist
- **Solution**: Run `npx prisma migrate dev` to apply schema changes
- Restart the server after migration

## Production Deployment

### Environment Variables

Ensure these are set in production:

```env
DATABASE_URL=postgresql://...
JWT_SECRET=<secure-random-string>
NODE_ENV=production
PORT=4000
```

### Security Checklist

- [ ] Change default admin password
- [ ] Use HTTPS only (no HTTP)
- [ ] Enable rate limiting on admin endpoints
- [ ] Set strong JWT_SECRET (32+ characters)
- [ ] Configure CORS for specific domains only
- [ ] Enable database backups
- [ ] Set up monitoring and alerting
- [ ] Review audit logs regularly
- [ ] Implement IP whitelisting for admin access (optional)

### Database Backup

Regularly backup audit logs:

```bash
pg_dump -t audit_logs $DATABASE_URL > audit_logs_backup.sql
```

## Support

For issues or questions:
- Check the API logs: `npm run dev` output
- Review browser console for frontend errors
- Check Prisma database queries
- Review audit logs for admin action history

## Changelog

### v1.0.0 (Initial Release)
- Admin authentication and authorization
- Merchant management interface
- KYC review workflow
- Transaction search and filtering
- Payout management
- Dashboard metrics
- Audit logging system
- Responsive UI design
