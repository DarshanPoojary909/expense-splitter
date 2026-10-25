/**
 * Group Controller (HTTP Request Handler)
 * 
 * WHY A CONTROLLER LAYER?
 * - Extracts HTTP request parameters (`req.body`, `req.params`, `req.user`, `req.group`).
 * - Invokes business logic functions from `groupService`.
 * - Formats standardized JSON responses (200 OK, 201 Created) and delegates errors to Express error handler.
 */

import * as groupService from '../services/groupService.js';

/**
 * @desc    Create a new Group
 * @route   POST /api/groups
 * @access  Private (Authenticated users)
 */
export async function createGroup(req, res, next) {
  try {
    const newGroup = await groupService.createGroup(req.body, req.user);

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      data: newGroup,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Get all groups that the logged-in user is a member of
 * @route   GET /api/groups
 * @access  Private (Authenticated users)
 */
export async function getMyGroups(req, res, next) {
  try {
    const userId = req.user._id || req.user.id;
    const groups = await groupService.getMyGroups(userId);

    res.status(200).json({
      success: true,
      count: groups.length,
      data: groups,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Get group details by ID (Open group)
 * @route   GET /api/groups/:id
 * @access  Private (Group members only)
 */
export async function getGroupById(req, res, next) {
  try {
    const userId = req.user._id || req.user.id;
    const group = await groupService.getGroupById(req.params.id, userId);

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found',
      });
    }

    res.status(200).json({
      success: true,
      data: group,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Update group settings (Name, Description, Group Type, Base Currency, Simplify Debts)
 * @route   PUT /api/groups/:id
 * @access  Private (Group Admin only)
 */
export async function updateGroup(req, res, next) {
  try {
    const updated = await groupService.updateGroup(req.params.id, req.body, req.user);

    res.status(200).json({
      success: true,
      message: 'Group settings updated successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    View all members in a group
 * @route   GET /api/groups/:id/members
 * @access  Private (Group members only)
 */
export async function getGroupMembers(req, res, next) {
  try {
    const members = await groupService.getGroupMembers(req.params.id);

    res.status(200).json({
      success: true,
      count: members.length,
      data: members,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Add a new member to the group's embedded members array
 * @route   POST /api/groups/:id/members
 * @access  Private (Group Admin only)
 */
export async function addMember(req, res, next) {
  try {
    const updatedGroup = await groupService.addMemberToGroup(req.params.id, req.body, req.user);

    res.status(201).json({
      success: true,
      message: 'Member added to group successfully',
      data: updatedGroup,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Remove a member from the group's embedded members array
 * @route   DELETE /api/groups/:id/members/:memberId
 * @access  Private (Group Admin or Member self-removal)
 */
export async function removeMember(req, res, next) {
  try {
    const currentUserId = String(req.user._id || req.user.id);
    const targetMemberId = String(req.params.memberId);

    // Permission check: Admin or Member leaving on their own
    const isAdmin = req.currentMember.role === 'admin' || String(req.group.createdBy) === currentUserId;
    const isSelf = currentUserId === targetMemberId || String(req.currentMember._id) === targetMemberId;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You can only remove yourself or must be a group admin',
      });
    }

    const updatedGroup = await groupService.removeMemberFromGroup(req.params.id, targetMemberId, req.user);

    res.status(200).json({
      success: true,
      message: 'Member removed from group successfully',
      data: updatedGroup,
    });
  } catch (error) {
    next(error);
  }
}
