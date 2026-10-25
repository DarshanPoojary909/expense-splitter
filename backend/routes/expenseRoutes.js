/**
 * Expense Routes (HTTP Routing Layer)
 * 
 * WHY A ROUTE LAYER?
 * - Connects HTTP endpoints (URLs + Methods like GET, POST, PUT, DELETE) to specific controller functions.
 * - Keeps server.js clean by isolating path declarations into modular mini-routers.
 */

import express from 'express';
import {
  getExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
} from '../controllers/expenseController.js';
import { optionalAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply optionalAuth so req.user is populated when Bearer token is provided
router.use(optionalAuth);

// Routes for collection-level operations (/api/expenses)
router
  .route('/')
  .get(getExpenses)      // GET /api/expenses -> Fetch all expenses
  .post(createExpense);  // POST /api/expenses -> Create a new expense

// Routes for item-level operations (/api/expenses/:id)
router
  .route('/:id')
  .get(getExpense)       // GET /api/expenses/:id -> Fetch single expense by ID
  .put(updateExpense)    // PUT /api/expenses/:id -> Update expense by ID
  .delete(deleteExpense);// DELETE /api/expenses/:id -> Delete expense by ID

export default router;
