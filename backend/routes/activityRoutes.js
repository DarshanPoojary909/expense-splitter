/**
 * Activity Routes (Router Layer - Day 13)
 * 
 * Defines endpoints for retrieving user and group activity logs.
 */

import express from 'express';
import {
  getUserActivityHandler,
  getGroupActivityHandler,
} from '../controllers/activityController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Both activity endpoints require authentication
router.route('/').get(protect, getUserActivityHandler);
router.route('/group/:groupId').get(protect, getGroupActivityHandler);

export default router;
