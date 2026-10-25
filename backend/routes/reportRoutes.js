/**
 * Report Routes (Router Layer - Day 14)
 * 
 * Defines endpoints for group reports and CSV exports.
 */

import express from 'express';
import {
  getGroupReportHandler,
  getGroupReportCsvHandler,
} from '../controllers/reportController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Report routes require authentication
router.route('/group/:groupId').get(protect, getGroupReportHandler);
router.route('/group/:groupId/csv').get(protect, getGroupReportCsvHandler);

export default router;
