/**
 * Expense Controller (HTTP Request Handler Layer)
 * 
 * WHY A CONTROLLER LAYER?
 * - Handles Express-specific HTTP logic: parsing request headers, params, body, query strings.
 * - Delegates actual business logic and database queries to the Service layer (`expenseService`).
 * - Formats and sends HTTP responses with appropriate HTTP status codes (200, 201, 400, 404, 500).
 * - Forwards unexpected exceptions to Express error handling middleware via `next(err)`.
 */

import * as expenseService from '../services/expenseService.js';

/**
 * @desc   Get all expenses
 * @route  GET /api/expenses
 * @access Public
 */
export async function getExpenses(req, res, next) {
  try {
    const { group, category } = req.query;
    const filter = {};
    if (group) filter.group = group;
    if (category) filter.category = category;

    const expenses = await expenseService.getAllExpenses(filter, req.user);
    res.status(200).json({
      success: true,
      count: expenses.length,
      data: expenses,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc   Get single expense by ID
 * @route  GET /api/expenses/:id
 * @access Public
 */
export async function getExpense(req, res, next) {
  try {
    const { id } = req.params;
    const expense = await expenseService.getExpenseById(id, req.user);

    if (!expense) {
      return res.status(404).json({
        success: false,
        error: `Expense not found with ID: ${id}`,
      });
    }

    res.status(200).json({
      success: true,
      data: expense,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc   Create a new expense
 * @route  POST /api/expenses
 * @access Public / Authenticated
 */
export async function createExpense(req, res, next) {
  try {
    const newExpense = await expenseService.createExpense(req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'Expense created successfully',
      data: newExpense,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        error: messages.join(', '),
      });
    }
    next(error);
  }
}

/**
 * @desc   Update an existing expense
 * @route  PUT /api/expenses/:id
 * @access Public / Authenticated
 */
export async function updateExpense(req, res, next) {
  try {
    const { id } = req.params;
    const updated = await expenseService.updateExpense(id, req.body, req.user);

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: `Expense not found with ID: ${id}`,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Expense updated successfully',
      data: updated,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        error: messages.join(', '),
      });
    }
    next(error);
  }
}

/**
 * @desc   Delete an expense
 * @route  DELETE /api/expenses/:id
 * @access Public / Authenticated
 */
export async function deleteExpense(req, res, next) {
  try {
    const { id } = req.params;
    const deleted = await expenseService.deleteExpense(id, req.user);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: `Expense not found with ID: ${id}`,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Expense deleted successfully',
      data: deleted,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
}
