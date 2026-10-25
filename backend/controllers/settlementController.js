/**
 * Settlement Controller (HTTP Handler Layer - Day 12)
 * 
 * WHY A CONTROLLER LAYER?
 * - Handles Express HTTP requests (headers, query, params, body).
 * - Delegates business logic to settlementPaymentService, balanceService, and settlementService.
 * - Formats JSON responses with standard status codes (200, 201, 400, 403, 404, 500).
 */

import * as settlementPaymentService from '../services/settlementPaymentService.js';
import * as balanceService from '../services/balanceService.js';
import * as settlementService from '../services/settlementService.js';

/**
 * @desc   Record a new settlement payment (Full or Partial)
 * @route  POST /api/settlements
 * @access Authenticated / Optional
 */
export async function createSettlement(req, res, next) {
  try {
    const payment = await settlementPaymentService.recordSettlementPayment(req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'Settlement payment recorded successfully',
      data: payment,
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

/**
 * @desc   Get all recorded settlement payments for a group
 * @route  GET /api/settlements/group/:groupId
 * @access Authenticated / Optional
 */
export async function getGroupSettlements(req, res, next) {
  try {
    const { groupId } = req.params;
    const payments = await settlementPaymentService.getSettlementPayments(
      { group: groupId },
      req.user
    );
    res.status(200).json({
      success: true,
      count: payments.length,
      data: payments,
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

/**
 * @desc   Get net balances for a group
 * @route  GET /api/settlements/group/:groupId/balances
 * @access Authenticated / Optional
 */
export async function getGroupBalancesHandler(req, res, next) {
  try {
    const { groupId } = req.params;
    const balanceData = await balanceService.getGroupBalances(groupId, req.user);
    res.status(200).json({
      success: true,
      data: balanceData,
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

/**
 * @desc   Get suggested optimized settlement transactions for a group
 * @route  GET /api/settlements/group/:groupId/optimized
 * @access Authenticated / Optional
 */
export async function getOptimizedSettlements(req, res, next) {
  try {
    const { groupId } = req.params;
    const optimized = await settlementService.getGroupOptimizedSettlements(groupId, req.user);
    res.status(200).json({
      success: true,
      data: optimized,
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
