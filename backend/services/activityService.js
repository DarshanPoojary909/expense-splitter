/**
 * Activity Log Service (Day 13: Audit Trail & History)
 * 
 * WHY A SEPARATE ACTIVITY LOG SERVICE?
 * - Manages the immutable, append-only chronological history of financial actions.
 * - Enforces group-level authorization: users can ONLY see activities for groups they belong to.
 * - Decouples logging and querying from controllers.
 * - Supports seamless operation in MongoDB and test environments.
 */

import mongoose from 'mongoose';
import ActivityLog from '../models/ActivityLog.js';
import Group from '../models/Group.js';
import { getRawGroupById, getMyGroups } from './groupService.js';

function isDbConnected() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

let inMemoryLogs = [];

export async function resetActivityLogs() {
  if (isDbConnected()) {
    await ActivityLog.deleteMany({});
  }
  inMemoryLogs = [];
}

/**
 * Record a new activity entry safely
 * 
 * @param {Object} logData 
 * @returns {Promise<Object>}
 */
export async function createActivityLog(logData) {
  if (isDbConnected()) {
    try {
      const created = await ActivityLog.create(logData);
      const result = created.toObject();
      result.id = result._id.toString();
      return result;
    } catch (err) {
      console.warn('[ActivityLog Warning] Error writing to MongoDB:', err.message);
    }
  }

  const newId = new mongoose.Types.ObjectId().toString();
  const entry = {
    _id: newId,
    id: newId,
    group: logData.group ? String(logData.group) : null,
    user: logData.user ? String(logData.user) : null,
    userName: logData.userName || 'User',
    action: logData.action,
    entityType: logData.entityType,
    entityId: logData.entityId ? String(logData.entityId) : null,
    description: logData.description || '',
    metadata: logData.metadata || {},
    createdAt: new Date(),
  };
  inMemoryLogs.unshift(entry);
  return entry;
}

/**
 * Retrieve activity history for a specific group with authorization guard.
 * 
 * @param {string} groupId 
 * @param {Object|null} requestingUser 
 * @param {number} limit 
 * @returns {Promise<Array>}
 */
export async function getGroupActivity(groupId, requestingUser = null, limit = 50) {
  const targetGroupId = String(groupId);

  let group = null;
  if (isDbConnected()) {
    if (!mongoose.Types.ObjectId.isValid(targetGroupId)) {
      const error = new Error(`Invalid group ID format: ${targetGroupId}`);
      error.statusCode = 400;
      throw error;
    }
    group = await Group.findById(targetGroupId).lean();
  } else {
    group = await getRawGroupById(targetGroupId);
  }

  if (!group) {
    const error = new Error('Group not found');
    error.statusCode = 404;
    throw error;
  }

  // Authorization Guard: User must be an active member of this group
  if (requestingUser) {
    const reqUserId = String(requestingUser._id || requestingUser.id);
    const isMember = group.members && group.members.some(
      (m) =>
        String(m.userId) === reqUserId ||
        (requestingUser.email && m.email && m.email.toLowerCase() === requestingUser.email.toLowerCase())
    );

    if (!isMember) {
      const error = new Error(`Forbidden: You are not a member of group "${group.name}".`);
      error.statusCode = 403;
      throw error;
    }
  }

  if (isDbConnected()) {
    const logs = await ActivityLog.find({ group: targetGroupId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return logs.map((log) => ({ ...log, id: log._id.toString() }));
  }

  // Fallback in-memory mode
  const filtered = inMemoryLogs.filter((l) => String(l.group) === targetGroupId);
  return filtered.slice(0, limit);
}

/**
 * Retrieve activity history for all groups the user is a member of.
 * 
 * @param {Object} requestingUser 
 * @param {number} limit 
 * @returns {Promise<Array>}
 */
export async function getUserActivity(requestingUser, limit = 50) {
  if (!requestingUser) {
    const error = new Error('Authentication required to retrieve activity log');
    error.statusCode = 401;
    throw error;
  }

  const reqUserId = String(requestingUser._id || requestingUser.id);

  if (isDbConnected()) {
    // Find all groups where the user is a member
    const userGroups = await Group.find({ 'members.userId': reqUserId }).select('_id').lean();
    const groupIds = userGroups.map((g) => g._id);

    const logs = await ActivityLog.find({
      $or: [{ group: { $in: groupIds } }, { user: reqUserId }],
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return logs.map((log) => ({ ...log, id: log._id.toString() }));
  }

  // Fallback in-memory mode
  const userGroups = await getMyGroups(reqUserId);
  const groupIds = userGroups.map((g) => String(g._id || g.id));

  const filtered = inMemoryLogs.filter(
    (l) => (l.group && groupIds.includes(String(l.group))) || String(l.user) === reqUserId
  );
  return filtered.slice(0, limit);
}
