import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './config/db.js';
import { requestLogger } from './middleware/logger.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import expenseRoutes from './routes/expenseRoutes.js';
import authRoutes from './routes/authRoutes.js';
import groupRoutes from './routes/groupRoutes.js';
import settlementRoutes from './routes/settlementRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import reportRoutes from './routes/reportRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Load environment variables from .env file
dotenv.config();

// 2. Initialize Express application
const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// 3. Connect to MongoDB (skip or isolate during testing)
if (process.env.NODE_ENV !== 'test') {
  connectDB();
}

// 4. Global Middleware Setup
// Secure HTTP headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Enable CORS for local development (React dev server on port 5173)
app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  })
);

// Parse incoming JSON request bodies (Populates req.body)
app.use(express.json());

// Log incoming HTTP requests and response status
app.use(requestLogger);

// 5. API Routes
// Health-Check Endpoint (GET /api/health)
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  res.status(200).json({
    status: 'healthy',
    project: 'Expense Splitter with Settlement Optimization',
    version: '1.0.0',
    message: 'Expense Splitter API is running smoothly',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: dbStatusMap[dbState] || 'unknown',
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/reports', reportRoutes);

// Production Static Serving (Single Origin Deployment)
if (process.env.NODE_ENV === 'production') {
  const frontendDistPath = path.join(__dirname, '../frontend/dist');
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

// 6. 404 & Error Handling Middleware
app.use(notFound);      // Catches unmatched routes
app.use(errorHandler);  // Central error handler

// 7. Start the HTTP server (only if not running inside test runner)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[Server] Express server running at http://localhost:${PORT}`);
    console.log(`[Server] Health check available at http://localhost:${PORT}/api/health`);
    console.log(`[Server] Auth API available at http://localhost:${PORT}/api/auth`);
    console.log(`[Server] Expenses API available at http://localhost:${PORT}/api/expenses`);
    console.log(`[Server] Allowed CORS Origin: ${CLIENT_ORIGIN}`);
  });
}

export default app;
