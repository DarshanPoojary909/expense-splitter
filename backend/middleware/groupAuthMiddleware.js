/**
 * Group Authorization Middleware (Permission Guard)
 * 
 * WHY GROUP AUTHORIZATION MIDDLEWARE?
 * - Authentication (protect middleware) confirms WHO the user is.
 * - Group Authorization confirms WHAT the user is allowed to do within a specific group.
 * - Prevents User B from viewing, modifying, or adding members to User A's private group.
 * - Operates directly on the embedded `members` array within the Group document.
 */

import * as groupService from '../services/groupService.js';

/**
 * Middleware: Verify that the authenticated user is an active member of the target group.
 * 
 * Data Flow:
 * 1. Reads `req.params.id` or `req.params.groupId`.
 * 2. Fetches the Group document.
 * 3. Inspects the embedded `group.members` array.
 * 4. If userId is found, attaches `req.group` and `req.currentMember` to the request pipeline.
 * 5. If userId is NOT found, terminates the request with HTTP 403 Forbidden.
 */
export async function requireGroupMember(req, res, next) {
  try {
    const groupId = req.params.id || req.params.groupId;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        error: 'Group ID parameter is required',
      });
    }

    const group = await groupService.getRawGroupById(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found',
      });
    }

    const currentUserId = String(req.user._id || req.user.id);

    // Check membership in the embedded members array
    const member = group.members.find(
      (m) => String(m.userId) === currentUserId
    );

    if (!member) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You are not a member of this private group',
        groupName: group.name,
      });
    }

    // Attach group and current member context for downstream middleware/controllers
    req.group = group;
    req.currentMember = member;

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Error evaluating group authorization',
      details: error.message,
    });
  }
}

/**
 * Middleware: Verify that the authenticated user has 'admin' role in the target group.
 * (Assumes `requireGroupMember` ran first and attached `req.group` and `req.currentMember`).
 */
export function requireGroupAdmin(req, res, next) {
  if (!req.group || !req.currentMember) {
    return res.status(500).json({
      success: false,
      error: 'requireGroupAdmin must be preceded by requireGroupMember in route definition',
    });
  }

  const currentUserId = String(req.user._id || req.user.id);
  const isCreator = String(req.group.createdBy) === currentUserId;
  const isAdmin = req.currentMember.role === 'admin';

  if (!isAdmin && !isCreator) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Group admin role required to perform this action',
    });
  }

  next();
}
