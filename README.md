# CediPay

A crypto-to-fiat app for the Ghanaian market, allowing users to sell crypto for Cedis.

## 🚀 Tech Stack

- **Backend**: TypeScript, Node.js, Express
- **Database**: PostgreSQL with Prisma ORM  
- **Authentication**: JWT with bcrypt password hashing
- **Containerization**: Docker & Docker Compose
- **Testing**: Jest with TypeScript support
- **Code Quality**: ESLint, Prettier
- **CI/CD**: GitHub Actions

## 📋 Prerequisites

- Node.js 20.x or higher
- PostgreSQL 15 (or use Docker)
- npm or yarn

## 🛠️ Local Development Setup

### 1. Clone the Repository
```bash
git clone https://github.com/xpertforextradeinc/CediPay.git
cd CediPay
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
```bash
cp .env.example .env
```

Edit the `.env` file with your configuration:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/cedipay_dev?schema=public"
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
PORT=4000
NODE_ENV="development"
```

### 4. Database Setup
Make sure PostgreSQL is running, then:
```bash
# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate
```

### 5. Start Development Server
```bash
npm run dev
```

The API will be available at `http://localhost:4000`

### API Endpoints
- `GET /health` - Health check
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile (protected)

## 🐳 Docker Setup

### Using Docker Compose (Recommended)
```bash
# Start all services (app + PostgreSQL)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

This will:
- Start PostgreSQL on port 5432
- Start the CediPay API on port 4000
- Automatically run database migrations
- Set up persistent volumes for database data

### Building Docker Image Only
```bash
# Build the image
docker build -t cedipay-backend .

# Run with external database
docker run -p 4000:4000 -e DATABASE_URL="your-db-url" cedipay-backend
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

## 📝 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build production bundle
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run typecheck` - Run TypeScript type checking
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm test` - Run tests

## 🏗️ Project Structure

```
src/
├── controllers/     # Route controllers
├── middleware/      # Express middleware
├── prisma/          # Database client
├── routes/          # API routes
├── types/           # TypeScript type definitions
├── __tests__/       # Test files
├── app.ts          # Express app configuration
└── server.ts       # Server entry point

prisma/
└── schema.prisma   # Database schema

.github/
└── workflows/      # CI/CD workflows
```

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication:

1. **Register**: `POST /api/auth/register` with email, password, firstName, lastName
2. **Login**: `POST /api/auth/login` with email and password
3. **Protected Routes**: Include `Authorization: Bearer <token>` header

## 🚧 Development Roadmap

### Current Phase: MVP Backend ✅
- [x] TypeScript Node.js + Express setup
- [x] PostgreSQL with Prisma ORM
- [x] JWT Authentication
- [x] Docker support
- [x] CI/CD pipeline
- [x] Basic testing infrastructure

### Next Phase: Payment Integration 🔄
- [ ] Flutterwave payment gateway integration
- [ ] Transaction management
- [ ] Crypto price feeds
- [ ] Rate calculations

### Future Phases 📋
- [ ] Frontend application (React/Flutter)
- [ ] Real-time notifications
- [ ] Advanced security features
- [ ] Mobile app development

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For questions and support, please contact the development team or create an issue in the repository.
