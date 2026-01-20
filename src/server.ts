import dotenv from 'dotenv';
import app from './app';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env['PORT'] || '5000', 10);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 CediPay API server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});