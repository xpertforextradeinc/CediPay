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

## Recent Changes

- 2026-01-20: Initial Replit setup and configuration
  - Configured server to bind to 0.0.0.0:5000
  - Set up PostgreSQL database with Prisma
  - Fixed TypeScript type declarations for Express Request.user
