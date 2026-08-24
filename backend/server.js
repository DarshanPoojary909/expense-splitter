import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import mongoose from 'mongoose';
import connectDB from './config/db.js';

// 1. Load environment variables from .env file
dotenv.config();

// 2. Initialize Express application
const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// 3. Connect to MongoDB
connectDB();

// 4. Middleware Setup
// Enable CORS for local development (React dev server on port 5173)
app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  })
);

// Parse incoming JSON request bodies
app.use(express.json());

// 5. Health-Check Endpoint (GET /api/health)
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

// 6. Start the HTTP server
app.listen(PORT, () => {
  console.log(`[Server] Express server running at http://localhost:${PORT}`);
  console.log(`[Server] Health check available at http://localhost:${PORT}/api/health`);
  console.log(`[Server] Allowed CORS Origin: ${CLIENT_ORIGIN}`);
});

export default app;
