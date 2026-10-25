/**
 * Settlement Routes (Router Layer - Day 12)
 * 
 * Defines endpoints for recording payments, retrieving group balance breakdowns,
 * and fetching optimized settlement transactions.
 */

import express from 'express';
import {
  createSettlement,
  getGroupSettlements,
  getGroupBalancesHandler,
  getOptimizedSettlements,
} from '../controllers/settlementController.js';
import { optionalAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// Attach user context if JWT token provided
router.use(optionalAuth);

// 1. Record new settlement payment
router.route('/').post(createSettlement);

// 2. Group balances endpoint
router.route('/group/:groupId/balances').get(getGroupBalancesHandler);

// 3. Group optimized settlement plan endpoint
router.route('/group/:groupId/optimized').get(getOptimizedSettlements);

// 4. Group settlement payment history
router.route('/group/:groupId').get(getGroupSettlements);

export default router;
