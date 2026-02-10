import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import './types/express';
import authRoutes from './routes/auth';
import webhookRoutes from './routes/webhook';
import paymentRoutes from './routes/payment';

const app = express();

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for demo page
}));
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files (widget SDK and demo)
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'OK', message: 'CediPay API is running' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/payments', paymentRoutes);

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;