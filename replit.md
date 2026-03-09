# CediPay Backend API

TypeScript Node.js backend for CediPay - a crypto-to-fiat application for the Ghanaian market.

## Overview

This is a REST API built with Express.js and TypeScript, using Prisma as the ORM with PostgreSQL database.

## Project Structure

```
src/
├── app.ts              # Express application setup with middleware
├── server.ts           # Server entry point
├── controllers/        # Route controllers
│   └── authController.ts
├── middleware/         # Express middleware
│   └── auth.ts         # JWT authentication middleware
├── prisma/
│   └── client.ts       # Prisma client instance
├── routes/
│   └── auth.ts         # Authentication routes
├── services/
│   └── fiatService.ts  # Business logic services
├── types/
│   └── express.ts      # Express type augmentations
└── __tests__/          # Test files
```

## Key Technologies

- **Runtime**: Node.js 20+
- **Language**: TypeScript 5.3
- **Framework**: Express.js 4.x
- **ORM**: Prisma 5.6
- **Database**: PostgreSQL
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcrypt
- **Validation**: Zod

## API Endpoints

### Health Check
- `GET /health` - Server health check

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get current user profile (protected)

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string (auto-configured by Replit)
- `JWT_SECRET` - Secret key for JWT token signing
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (defaults to 5000)

## Development

The server runs on port 5000 with hot reload via nodemon.

## Database Schema

- **User**: Core user model with email/password authentication
- **Transaction**: Financial transaction records with status tracking

## Security Scanning

Semgrep is configured for security scanning with Node.js/TypeScript/Express-focused rulesets.

### Scan Commands
- `npm run security:scan` - Standard scan with default + TypeScript rulesets and custom CediPay rules
- `npm run security:scan:quick` - Fast scan with custom CediPay rules only
- `npm run security:scan:full` - Comprehensive scan with all rulesets (default, TypeScript, Express, JWT)

### Custom Rules (.semgrep.yml)
CediPay-specific security rules covering:
- Hardcoded JWT secrets and credentials
- SQL injection via string interpolation and Prisma raw queries
- Weak bcrypt salt rounds (must be >= 12)
- eval() usage prevention
- Password/sensitive data in logs or API responses
- Disabled TLS verification
- JWT 'none' algorithm attacks
- Overly permissive CORS configuration

### Registry Rulesets Used
- `p/default` - OWASP Top 10 coverage for Express, NestJS, Hapi, Koa
- `p/typescript` - TypeScript-specific security rules
- `p/express` - Express framework rules (full scan only)
- `p/jwt` - JWT security rules (full scan only)

## Recent Changes

- 2026-02-10: Added Semgrep security scanning
  - Installed Python 3.11 and Semgrep
  - Created .semgrep.yml with 12 custom CediPay security rules
  - Added npm scripts for quick, standard, and full security scans
- 2026-01-20: Initial Replit setup and configuration
  - Configured server to bind to 0.0.0.0:5000
  - Set up PostgreSQL database with Prisma
  - Fixed TypeScript type declarations for Express Request.user
