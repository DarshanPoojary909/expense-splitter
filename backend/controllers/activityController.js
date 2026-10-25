/**
 * Activity Controller (HTTP Handler Layer - Day 13)
 * 
 * Handles HTTP requests for activity logs and delegates to activityService.
 */

import * as activityService from '../services/activityService.js';

/**
 * @desc   Get activity logs across all groups for the authenticated user
 * @route  GET /api/activity
 * @access Authenticated
 */
export async function getUserActivityHandler(req, res, next) {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const logs = await activityService.getUserActivity(req.user, limit);
    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs,
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
 * @desc   Get activity logs for a specific group (with authorization guard)
 * @route  GET /api/activity/group/:groupId
 * @access Authenticated
 */
export async function getGroupActivityHandler(req, res, next) {
  try {
    const { groupId } = req.params;
    const limit = parseInt(req.query.limit, 10) || 50;
    const logs = await activityService.getGroupActivity(groupId, req.user, limit);
    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs,
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
