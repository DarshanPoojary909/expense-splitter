/**
 * Authentication Routes
 * 
 * WHY A ROUTE MODULE?
 * - Declares the endpoint paths and associates them with HTTP verbs.
 * - Applies route-level middleware (`protect` for private routes).
 * - Directs incoming traffic to corresponding controller actions.
 */

import express from 'express';
import {
  register,
  login,
  getMe,
  logout,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);

// Protected routes (Requires valid JWT Bearer token)
router.get('/me', protect, getMe);

export default router;
