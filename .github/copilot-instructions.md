# Copilot Instructions for CediPay

This document provides guidelines for GitHub Copilot to generate code that aligns with CediPay's architecture, coding standards, and security policies.

## Project Overview

CediPay is a payment gateway supporting Ghana mobile money transactions (MTN, Vodafone, AirtelTigo) with webhook delivery and transaction management.

**Tech Stack:**
- **Runtime:** Node.js ≥20.0.0
- **Language:** TypeScript (ES2020, strict mode)
- **Framework:** Express 4.x
- **Database:** PostgreSQL via Prisma ORM 5.x
- **Authentication:** JWT (jsonwebtoken) + bcrypt
- **Validation:** Zod
- **Testing:** Jest + Supertest
- **Payment APIs:** Paystack, Flutterwave

## Architecture Patterns

### Controller/Service Separation

**Controllers** (`src/controllers/`):
- Handle HTTP request/response cycle
- Validate input using Zod schemas
- Call services for business logic
- Return consistent JSON responses
- NO database queries (use services/Prisma)

**Services** (`src/services/`):
- Contain pure business logic
- Handle external API calls
- Perform complex calculations
- Reusable across controllers
- Return data or throw errors

**Example:**
```typescript
// Controller validates and delegates
export const createPayment = async (req: Request, res: Response) => {
  const schema = z.object({ amount: z.number(), network: z.string() });
  const data = schema.parse(req.body);
  const result = await fiatService.initiateTransfer(data);
  res.json(result);
};

// Service implements business logic
export const initiateTransfer = async (data: PaymentData) => {
  const amountInPesewas = Math.round(data.amount * 100);
  return await paystackAPI.charge(amountInPesewas);
};
```

### Middleware Pattern

**Authentication Middleware** (`src/middleware/auth.ts`):
- Verify JWT from `Authorization: Bearer <token>` header
- Load user from database (exclude password)
- Attach to `req.user` (custom type extension)
- Return 403 for invalid/missing tokens

**Usage:**
```typescript
import { auth } from '../middleware/auth';
router.get('/profile', auth, profileController);
```

### Type Extensions

Extend Express types for type safety:
```typescript
// src/types/express.d.ts
declare global {
  namespace Express {
    interface Request {
      user?: UserWithoutPassword;
    }
  }
}
```

## TypeScript Standards

### Strict Typing

- **Enable strict mode** (no implicit any)
- **Avoid `any`** unless absolutely necessary (document why)
- **Use interfaces** for object shapes
- **Use type guards** for runtime checks
- **Prefer `unknown`** over `any` for unsafe values

```typescript
// ✅ Good
interface CreateUserData {
  email: string;
  password: string;
}

// ❌ Bad
function createUser(data: any) { ... }

// ✅ Good - justified any with comment
const config: any = require('./config.json'); // Dynamic config structure
```

### Type Safety with Prisma

```typescript
import { PrismaClient, User, Transaction } from '@prisma/client';

// Exclude sensitive fields
type UserWithoutPassword = Omit<User, 'password'>;

// Use Prisma's generated types
async function getTransaction(id: string): Promise<Transaction | null> {
  return prisma.transaction.findUnique({ where: { id } });
}
```

## Input Validation

### Use Zod for Request Validation

```typescript
import { z } from 'zod';

const paymentSchema = z.object({
  amount: z.number().positive(),
  phoneNumber: z.string().regex(/^0\d{9}$/),
  network: z.enum(['MTN', 'VODAFONE', 'AIRTELTIGO']),
  email: z.string().email().optional(),
});

try {
  const validData = paymentSchema.parse(req.body);
  // proceed with validData
} catch (error) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    });
  }
}
```

### Validation Rules

- **Phone numbers:** Ghana format `/^0\d{9}$/`
- **Networks:** Whitelist MTN, VODAFONE, AIRTELTIGO
- **Amounts:** Positive numbers, validate min/max limits
- **Emails:** Standard email validation
- **IDs:** UUID v4 validation
- **Passwords:** Minimum 8 characters

## Error Handling

### Consistent Error Responses

```typescript
// Validation errors → 400
res.status(400).json({ error: 'Validation failed', details: [...] });

// Authentication errors → 401
res.status(401).json({ error: 'Authentication required' });

// Authorization errors → 403
res.status(403).json({ error: 'Invalid or expired token' });

// Not found → 404
res.status(404).json({ error: 'Resource not found' });

// Server errors → 500
res.status(500).json({ error: 'Internal server error' });
```

### Try-Catch Blocks

```typescript
export const controller = async (req: Request, res: Response) => {
  try {
    // Validation
    const data = schema.parse(req.body);
    
    // Business logic
    const result = await service.process(data);
    
    // Success response
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Controller error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
```

## Security Requirements

### JWT Authentication

```typescript
import jwt from 'jsonwebtoken';

// Token generation (7-day expiry)
const token = jwt.sign(
  { userId: user.id },
  process.env['JWT_SECRET']!,
  { expiresIn: '7d' }
);

// Token verification in middleware
const decoded = jwt.verify(token, process.env['JWT_SECRET']!) as { userId: string };
```

### Password Handling

```typescript
import bcrypt from 'bcrypt';

// Hash passwords (12 rounds)
const hashedPassword = await bcrypt.hash(password, 12);

// Compare passwords
const isValid = await bcrypt.compare(inputPassword, user.password);

// NEVER return passwords in API responses
const { password: _, ...userWithoutPassword } = user;
```

### Environment Variables

- **ALWAYS use environment variables for secrets**
- **NEVER hardcode credentials, API keys, or secrets**
- **Validate required env vars at startup**

```typescript
// ✅ Good
const apiKey = process.env['PAYSTACK_SECRET_KEY'];
if (!apiKey) throw new Error('PAYSTACK_SECRET_KEY not configured');

// ❌ Bad
const apiKey = 'sk_test_abc123...';
```

### Payment Security Best Practices

#### Transaction Integrity

```typescript
// Use Math.round() to avoid floating-point precision errors
const amountInPesewas = Math.round(amount * 100);

// Validate rate consistency
if (transaction.rate !== rate) {
  throw new Error('Rate mismatch detected');
}

// Use Decimal(12,2) in database schema (Prisma)
```

#### Webhook Signature Verification

```typescript
import crypto from 'crypto';

// Generate HMAC-SHA256 signature
const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(JSON.stringify(payload))
  .digest('hex');

// Verify incoming webhook signature
const isValid = crypto.timingSafeEqual(
  Buffer.from(signature),
  Buffer.from(receivedSignature)
);
```

#### Webhook Delivery Security

- **10-second timeout** for webhook requests
- **Exponential backoff** retry strategy (1min → 6hr)
- **Max 5 attempts** before marking as failed
- **Include headers:** `X-Webhook-Signature`, `X-Webhook-Event`
- **Log all delivery attempts** in database

### Content Security Policy

```typescript
import helmet from 'helmet';

// Configure Helmet for widget support
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Required for widget
    },
  },
}));
```

## Database Operations

### Prisma Best Practices

```typescript
import { prisma } from '../prisma/client';

// Use transactions for atomic operations
await prisma.$transaction([
  prisma.transaction.create({ data: transactionData }),
  prisma.webhookDelivery.create({ data: deliveryData }),
]);

// Handle not found gracefully
const user = await prisma.user.findUnique({ where: { id } });
if (!user) {
  return res.status(404).json({ error: 'User not found' });
}

// Exclude sensitive fields
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, email: true, createdAt: true }, // No password
});
```

### Database Schema Patterns

- **UUIDs** for primary keys
- **Timestamps:** `createdAt`, `updatedAt` (auto-managed)
- **Enums** for fixed value sets (TransactionStatus, WebhookEvent)
- **Relations:** Explicit foreign keys with cascades
- **Decimal** for monetary values (avoid float)

## Testing Standards

### Unit Tests with Jest

```typescript
import { jest } from '@jest/globals';

describe('FiatService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should convert GHS to pesewas correctly', () => {
    // Test with edge cases that expose floating-point issues
    expect(Math.round(2.07 * 100)).toBe(207);
    expect(Math.round(3.29 * 100)).toBe(329);
  });

  it('should handle API errors gracefully', async () => {
    mockAPI.post.mockRejectedValue(new Error('Network error'));
    await expect(service.initiateTransfer(data)).rejects.toThrow();
  });
});
```

### Integration Tests with Supertest

```typescript
import request from 'supertest';
import { app } from '../app';
import { prisma } from '../prisma/client';

jest.mock('../prisma/client', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    transaction: { create: jest.fn() },
  },
}));

describe('POST /api/payments', () => {
  it('should create payment with valid data', async () => {
    const response = await request(app)
      .post('/api/payments')
      .send({ amount: 10, network: 'MTN' })
      .expect(200);
    
    expect(response.body).toHaveProperty('transactionId');
  });
});
```

### Testing Requirements

- **Write tests for new features** (unit + integration)
- **Mock Prisma client** in tests
- **Use Supertest** for HTTP endpoint testing
- **Test edge cases** (floating-point math, boundary values)
- **Suppress console logs** with `jest.spyOn(console, 'error')`
- **Aim for high coverage** (functions, branches, lines)

### Test Financial Calculations

```typescript
// Always test amounts that expose floating-point issues
const edgeCases = [2.07, 3.29, 10.99, 99.99];
edgeCases.forEach(amount => {
  it(`should handle ${amount} GHS correctly`, () => {
    const pesewas = Math.round(amount * 100);
    expect(pesewas).toBe(Math.floor(amount * 100 + 0.5));
  });
});
```

## Code Style

### ESLint Rules

- **No unused variables** (prefix with `_` to ignore)
- **Consistent imports** (group by external, internal, types)
- **Prefer const** over let when not reassigning
- **Use async/await** over raw promises

### Prettier Formatting

- **2 spaces** for indentation
- **Single quotes** for strings
- **80 characters** max line length (TypeScript/JavaScript code only)
- **Trailing commas** (ES5 style)
- **Semicolons** required

### Naming Conventions

```typescript
// Controllers: descriptive action names
export const createPayment = async (req, res) => { ... };

// Services: business domain names
export const initiateTransfer = async (data) => { ... };

// Interfaces: PascalCase with descriptive names
interface CreateTransactionData { ... }

// Enums: PascalCase, UPPER_CASE values
enum TransactionStatus { PENDING, COMPLETED, FAILED }

// Constants: UPPER_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 5;
```

## File Structure

```
src/
├── controllers/      # HTTP request handlers
│   ├── authController.ts
│   ├── paymentController.ts
│   └── webhookController.ts
├── services/        # Business logic
│   ├── webhookService.ts
│   └── fiatService.ts
├── middleware/      # Express middleware
│   └── auth.ts
├── routes/          # Route definitions
│   ├── auth.ts
│   ├── payment.ts
│   └── webhook.ts
├── types/           # TypeScript type extensions
│   └── express.d.ts
├── __tests__/       # Jest test files
│   ├── *.test.ts
│   └── integration/
├── prisma/          # Prisma client instance
│   └── client.ts
├── app.ts           # Express app setup
└── server.ts        # Entry point

prisma/
└── schema.prisma    # Database schema

public/              # Static widget files
```

### File Organization Rules

- **One controller per resource** (auth, payment, webhook)
- **Colocate related logic** in services
- **Test files** mirror source structure (`*.test.ts`)
- **Export named exports** (avoid default exports for testability)

## CI/CD Alignment

### NPM Scripts

```bash
npm run lint          # ESLint check
npm run format        # Prettier format
npm run build         # TypeScript compilation
npm test              # Jest tests
npm run dev           # Development server
npm start             # Production server
```

### Pre-Commit Checklist

- [ ] Code passes `npm run lint`
- [ ] Code passes `npm run format`
- [ ] TypeScript compiles (`npm run build`)
- [ ] All tests pass (`npm test`)
- [ ] New features include tests
- [ ] No secrets in code
- [ ] Environment variables documented

## Payment-Specific Guidelines

### Mobile Money Integration

```typescript
// Validate Ghana phone numbers
const phoneRegex = /^0\d{9}$/;
if (!phoneRegex.test(phoneNumber)) {
  throw new Error('Invalid Ghana phone number format');
}

// Whitelist networks
const ALLOWED_NETWORKS = ['MTN', 'VODAFONE', 'AIRTELTIGO'] as const;
if (!ALLOWED_NETWORKS.includes(network)) {
  throw new Error('Unsupported network');
}

// Always convert to smallest unit (pesewas)
const amountInPesewas = Math.round(amount * 100);
```

### Transaction Flow

1. **Validate input** (amount, phone, network)
2. **Convert amount** to pesewas (Math.round)
3. **Create transaction** record (status: PENDING)
4. **Call payment API** (Paystack/Flutterwave)
5. **Update transaction** with provider reference
6. **Handle webhooks** for status updates
7. **Trigger merchant webhooks** with signed payload

### Rate Limiting Considerations

- **Implement rate limits** on payment endpoints
- **Prevent duplicate transactions** (idempotency)
- **Queue webhook deliveries** to avoid overwhelming merchants
- **Log all payment attempts** for audit trail

## Additional Best Practices

- **Use path aliases** for cleaner imports (if configured)
- **Log errors** with context (not sensitive data)
- **Return promises** from async functions
- **Handle promise rejections** in async routes
- **Use helmet** for security headers
- **Enable CORS** with proper configuration
- **Serve static files** from `public/` for widget
- **Document complex algorithms** with comments
- **Keep functions small** (single responsibility)
- **Avoid deeply nested code** (early returns)

## Security Checklist

For any code touching:
- [ ] **Authentication:** Use JWT middleware, validate tokens
- [ ] **Passwords:** Hash with bcrypt (12 rounds), never log/return
- [ ] **Secrets:** Use environment variables, never hardcode
- [ ] **Input:** Validate with Zod, sanitize before use
- [ ] **Database:** Use Prisma parameterized queries (no raw SQL)
- [ ] **APIs:** Verify webhook signatures, timeout external calls
- [ ] **Errors:** Don't expose stack traces in production
- [ ] **Payments:** Validate amounts, use Math.round, check integrity

## Example: Complete Feature Implementation

When adding a new payment method:

1. **Update Prisma schema** (if needed)
2. **Create Zod validation schema**
3. **Implement service** with business logic
4. **Create controller** to handle HTTP
5. **Add route** with appropriate middleware
6. **Write unit tests** for service
7. **Write integration tests** for endpoint
8. **Update environment variables** documentation
9. **Run linter and tests**
10. **Document API** in README or OpenAPI spec

---

**Remember:** Security, type safety, and testability are paramount. When in doubt, follow existing patterns in the codebase.
