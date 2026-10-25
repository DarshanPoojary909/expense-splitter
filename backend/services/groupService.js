/**
 * Group Service (Business Logic Layer)
 * 
 * WHY A SERVICE LAYER?
 * - Decouples group business rules, member array operations, and Mongoose queries from Express controllers.
 * - Framework-agnostic: does not depend on Express `req` or `res` objects.
 * - Makes group creation, member updates, and permission queries testable in isolation.
 * - Supports embedded `members` subdocuments on the Group document.
 */

import mongoose from 'mongoose';
import Group from '../models/Group.js';
import User from '../models/User.js';
import ActivityLog from '../models/ActivityLog.js';
import { createActivityLog } from './activityService.js';

/**
 * Check if active MongoDB connection is ready
 */
function isDbConnected() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

// In-memory group storage for offline testing and fallback
let inMemoryGroups = [];

/**
 * Reset groups state (used in test setup)
 */
export async function resetGroups() {
  if (isDbConnected()) {
    await Group.deleteMany({});
  }
  inMemoryGroups = [];
}

/**
 * Helper to record activity log entries safely
 */
async function logActivitySafely(logData) {
  try {
    await createActivityLog(logData);
  } catch (err) {
    console.warn('[ActivityLog Warning] Failed to log group activity:', err.message);
  }
}

/**
 * Retrieve raw group by ID (used by middleware and internal service calls)
 * 
 * @param {string} groupId 
 * @returns {Promise<Object|null>}
 */
export async function getRawGroupById(groupId) {
  const targetId = String(groupId);

  if (isDbConnected()) {
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return null;
    }
    const doc = await Group.findById(targetId);
    return doc;
  }

  // Fallback in-memory mode
  const group = inMemoryGroups.find((g) => String(g._id) === targetId || String(g.id) === targetId);
  return group || null;
}

/**
 * Create a new Group with the creator automatically embedded as the first admin member.
 * 
 * @param {Object} groupData - { name, description, groupType, baseCurrency, simplifyDebts }
 * @param {Object} creatorUser - Authenticated user creating the group
 * @returns {Promise<Object>} Created group
 */
export async function createGroup(groupData, creatorUser) {
  if (!groupData.name || typeof groupData.name !== 'string' || groupData.name.trim().length < 2) {
    const error = new Error('Group name is required and must be at least 2 characters long');
    error.statusCode = 400;
    throw error;
  }

  if (groupData.name.trim().length > 80) {
    const error = new Error('Group name cannot exceed 80 characters');
    error.statusCode = 400;
    throw error;
  }

  const validGroupTypes = ['Trip', 'Home', 'Couple', 'Project', 'Other'];
  const groupType = groupData.groupType && validGroupTypes.includes(groupData.groupType)
    ? groupData.groupType
    : 'Other';

  const baseCurrency = groupData.baseCurrency ? String(groupData.baseCurrency).toUpperCase().trim() : 'USD';
  const simplifyDebts = groupData.simplifyDebts !== undefined ? Boolean(groupData.simplifyDebts) : true;

  const creatorUserId = creatorUser._id || creatorUser.id;
  const creatorMemberId = new mongoose.Types.ObjectId();

  // The creator is automatically the first embedded member with 'admin' role
  const initialMembers = [
    {
      _id: creatorMemberId,
      userId: creatorUserId,
      name: creatorUser.name,
      email: creatorUser.email || '',
      role: 'admin',
      joinedAt: new Date(),
    },
  ];

  if (isDbConnected()) {
    const newGroup = await Group.create({
      name: groupData.name.trim(),
      description: groupData.description?.trim() || '',
      groupType,
      baseCurrency,
      simplifyDebts,
      createdBy: creatorUserId,
      members: initialMembers,
    });

    const result = newGroup.toObject();
    result.id = result._id.toString();

    // Log Activity
    await logActivitySafely({
      group: result._id,
      user: creatorUserId,
      action: 'GROUP_CREATED',
      entityType: 'Group',
      entityId: result._id,
      description: `${creatorUser.name} created group "${result.name}" (${result.groupType})`,
      metadata: { groupType, baseCurrency, simplifyDebts },
    });

    return result;
  }

  // Fallback in-memory mode
  const newId = new mongoose.Types.ObjectId().toString();
  const now = new Date();
  const memoryGroup = {
    _id: newId,
    id: newId,
    name: groupData.name.trim(),
    description: groupData.description?.trim() || '',
    groupType,
    baseCurrency,
    simplifyDebts,
    createdBy: creatorUserId,
    members: initialMembers.map(m => ({
      ...m,
      _id: String(m._id),
      userId: String(m.userId),
    })),
    createdAt: now,
    updatedAt: now,
  };

  inMemoryGroups.unshift(memoryGroup);

  await logActivitySafely({
    group: memoryGroup._id,
    user: creatorUserId,
    action: 'GROUP_CREATED',
    entityType: 'Group',
    entityId: memoryGroup._id,
    description: `${creatorUser.name} created group "${memoryGroup.name}" (${memoryGroup.groupType})`,
    metadata: { groupType, baseCurrency, simplifyDebts },
  });

  return { ...memoryGroup };
}

/**
 * Get all groups that the specified user belongs to.
 * 
 * Mongoose Query: Group.find({ 'members.userId': userId })
 * Searches inside the embedded array for any member element matching the user's ObjectId.
 * 
 * @param {string|mongoose.Types.ObjectId} userId 
 * @returns {Promise<Array>} List of groups
 */
export async function getMyGroups(userId) {
  const targetUserId = String(userId);

  if (isDbConnected()) {
    const groups = await Group.find({
      'members.userId': targetUserId,
    })
      .sort({ updatedAt: -1 })
      .lean();

    return groups.map((g) => ({
      ...g,
      id: g._id.toString(),
      memberCount: g.members ? g.members.length : 0,
    }));
  }

  // Fallback in-memory
  const matched = inMemoryGroups.filter((g) =>
    g.members.some((m) => String(m.userId) === targetUserId)
  );

  return matched.map((g) => ({
    ...g,
    memberCount: g.members.length,
  }));
}

/**
 * Get detailed information for a single group by ID.
 * 
 * @param {string} groupId 
 * @param {string} userId 
 * @returns {Promise<Object|null>}
 */
export async function getGroupById(groupId, userId) {
  const group = await getRawGroupById(groupId);
  if (!group) return null;

  if (typeof group.toObject === 'function') {
    const obj = group.toObject();
    return { ...obj, id: obj._id.toString(), memberCount: obj.members.length };
  }

  return { ...group, id: String(group._id || group.id), memberCount: group.members.length };
}

/**
 * Update group settings (Name, Description, Group Type, Base Currency, Simplify Debts)
 * 
 * @param {string} groupId 
 * @param {Object} updateData 
 * @param {Object} requestingUser 
 * @returns {Promise<Object>} Updated group
 */
export async function updateGroup(groupId, updateData, requestingUser) {
  const validGroupTypes = ['Trip', 'Home', 'Couple', 'Project', 'Other'];
  const updates = {};

  if (updateData.name !== undefined) {
    if (typeof updateData.name !== 'string' || updateData.name.trim().length < 2) {
      const error = new Error('Group name must be at least 2 characters long');
      error.statusCode = 400;
      throw error;
    }
    updates.name = updateData.name.trim();
  }

  if (updateData.description !== undefined) {
    updates.description = String(updateData.description).trim();
  }

  if (updateData.groupType !== undefined) {
    if (!validGroupTypes.includes(updateData.groupType)) {
      const error = new Error(`Group type must be one of: ${validGroupTypes.join(', ')}`);
      error.statusCode = 400;
      throw error;
    }
    updates.groupType = updateData.groupType;
  }

  if (updateData.baseCurrency !== undefined) {
    updates.baseCurrency = String(updateData.baseCurrency).toUpperCase().trim();
  }

  if (updateData.simplifyDebts !== undefined) {
    updates.simplifyDebts = Boolean(updateData.simplifyDebts);
  }

  if (isDbConnected()) {
    const updated = await Group.findByIdAndUpdate(
      groupId,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      const error = new Error('Group not found');
      error.statusCode = 404;
      throw error;
    }

    const result = { ...updated, id: updated._id.toString(), memberCount: updated.members.length };

    await logActivitySafely({
      group: result._id,
      user: requestingUser._id || requestingUser.id,
      action: 'GROUP_UPDATED',
      entityType: 'Group',
      entityId: result._id,
      description: `${requestingUser.name} updated group settings`,
      metadata: updates,
    });

    return result;
  }

  // Fallback in-memory
  const index = inMemoryGroups.findIndex((g) => String(g._id) === String(groupId) || String(g.id) === String(groupId));
  if (index === -1) {
    const error = new Error('Group not found');
    error.statusCode = 404;
    throw error;
  }

  const existing = inMemoryGroups[index];
  const updatedMem = {
    ...existing,
    ...updates,
    updatedAt: new Date(),
  };

  inMemoryGroups[index] = updatedMem;
  return { ...updatedMem, memberCount: updatedMem.members.length };
}

/**
 * Add a new member to the embedded `group.members` array.
 * 
 * @param {string} groupId 
 * @param {Object} memberData - { email, name, userId, role }
 * @param {Object} requestingUser 
 * @returns {Promise<Object>} Updated group with new member
 */
export async function addMemberToGroup(groupId, memberData, requestingUser) {
  const { email, name, userId, role } = memberData;

  if (!email && !userId && !name) {
    const error = new Error('Please provide user email, user ID, or member name');
    error.statusCode = 400;
    throw error;
  }

  let targetUserId = userId;
  let targetName = name;
  let targetEmail = email ? email.trim().toLowerCase() : '';

  // 1. Look up registered user by email or ID if available in MongoDB
  if (isDbConnected()) {
    if (targetEmail) {
      const foundUser = await User.findOne({ email: targetEmail });
      if (foundUser) {
        targetUserId = foundUser._id;
        targetName = targetName || foundUser.name;
        targetEmail = foundUser.email;
      }
    } else if (targetUserId && mongoose.Types.ObjectId.isValid(targetUserId)) {
      const foundUser = await User.findById(targetUserId);
      if (foundUser) {
        targetName = targetName || foundUser.name;
        targetEmail = targetEmail || foundUser.email;
      }
    }

    if (!targetUserId) {
      targetUserId = new mongoose.Types.ObjectId();
    }
    if (!targetName) {
      targetName = targetEmail ? targetEmail.split('@')[0] : 'New Member';
    }

    const group = await Group.findById(groupId);
    if (!group) {
      const error = new Error('Group not found');
      error.statusCode = 404;
      throw error;
    }

    // 2. Check for duplicate membership
    const isAlreadyMember = group.members.some(
      (m) =>
        (m.userId && String(m.userId) === String(targetUserId)) ||
        (targetEmail && m.email && m.email.toLowerCase() === targetEmail)
    );

    if (isAlreadyMember) {
      const error = new Error('This user is already a member of the group');
      error.statusCode = 400;
      throw error;
    }

    // 3. Push to embedded members subdocument array
    const newMember = {
      _id: new mongoose.Types.ObjectId(),
      userId: targetUserId,
      name: targetName,
      email: targetEmail,
      role: role === 'admin' ? 'admin' : 'member',
      joinedAt: new Date(),
    };

    group.members.push(newMember);
    await group.save();

    const result = group.toObject();
    result.id = result._id.toString();

    await logActivitySafely({
      group: group._id,
      user: requestingUser._id || requestingUser.id,
      action: 'MEMBER_ADDED',
      entityType: 'Group',
      entityId: group._id,
      description: `${requestingUser.name} added ${targetName} to the group`,
      metadata: { newMemberId: newMember._id, memberName: targetName },
    });

    return result;
  }

  // Fallback in-memory
  const groupIndex = inMemoryGroups.findIndex((g) => String(g._id) === String(groupId) || String(g.id) === String(groupId));
  if (groupIndex === -1) {
    const error = new Error('Group not found');
    error.statusCode = 404;
    throw error;
  }

  const group = inMemoryGroups[groupIndex];
  if (!targetUserId) {
    targetUserId = new mongoose.Types.ObjectId().toString();
  }
  if (!targetName) {
    targetName = targetEmail ? targetEmail.split('@')[0] : 'New Member';
  }

  const isAlreadyMember = group.members.some(
    (m) =>
      String(m.userId) === String(targetUserId) ||
      (targetEmail && m.email && m.email.toLowerCase() === targetEmail)
  );

  if (isAlreadyMember) {
    const error = new Error('This user is already a member of the group');
    error.statusCode = 400;
    throw error;
  }

  const newMemberId = new mongoose.Types.ObjectId().toString();
  const newMember = {
    _id: newMemberId,
    id: newMemberId,
    userId: String(targetUserId),
    name: targetName,
    email: targetEmail,
    role: role === 'admin' ? 'admin' : 'member',
    joinedAt: new Date(),
  };

  group.members.push(newMember);
  group.updatedAt = new Date();

  await logActivitySafely({
    group: group._id || group.id,
    user: requestingUser._id || requestingUser.id,
    action: 'MEMBER_ADDED',
    entityType: 'Group',
    entityId: group._id || group.id,
    description: `${requestingUser.name} added ${targetName} to the group`,
    metadata: { newMemberId: newMember._id, memberName: targetName },
  });

  return { ...group, memberCount: group.members.length };
}

/**
 * Remove a member from the embedded `group.members` array.
 * 
 * @param {string} groupId 
 * @param {string} memberIdOrUserId - Member subdocument _id or user's userId
 * @param {Object} requestingUser 
 * @returns {Promise<Object>} Updated group
 */
export async function removeMemberFromGroup(groupId, memberIdOrUserId, requestingUser) {
  const targetIdStr = String(memberIdOrUserId);

  if (isDbConnected()) {
    const group = await Group.findById(groupId);
    if (!group) {
      const error = new Error('Group not found');
      error.statusCode = 404;
      throw error;
    }

    // Must retain at least one member in group
    if (group.members.length <= 1) {
      const error = new Error('Cannot remove the only remaining member. A group must have at least one member.');
      error.statusCode = 400;
      throw error;
    }

    const memberIndex = group.members.findIndex(
      (m) => String(m._id) === targetIdStr || String(m.userId) === targetIdStr
    );

    if (memberIndex === -1) {
      const error = new Error('Member not found in this group');
      error.statusCode = 404;
      throw error;
    }

    const removedMember = group.members[memberIndex];
    group.members.splice(memberIndex, 1);
    await group.save();

    const result = group.toObject();
    result.id = result._id.toString();

    await logActivitySafely({
      group: group._id,
      user: requestingUser._id || requestingUser.id,
      action: 'MEMBER_REMOVED',
      entityType: 'Group',
      entityId: group._id,
      description: `${requestingUser.name} removed ${removedMember.name} from the group`,
      metadata: { removedMemberId: removedMember._id, memberName: removedMember.name },
    });

    return result;
  }

  // Fallback in-memory
  const groupIndex = inMemoryGroups.findIndex((g) => String(g._id) === String(groupId) || String(g.id) === String(groupId));
  if (groupIndex === -1) {
    const error = new Error('Group not found');
    error.statusCode = 404;
    throw error;
  }

  const group = inMemoryGroups[groupIndex];
  if (group.members.length <= 1) {
    const error = new Error('Cannot remove the only remaining member. A group must have at least one member.');
    error.statusCode = 400;
    throw error;
  }

  const memberIndex = group.members.findIndex(
    (m) => String(m._id) === targetIdStr || String(m.userId) === targetIdStr
  );

  if (memberIndex === -1) {
    const error = new Error('Member not found in this group');
    error.statusCode = 404;
    throw error;
  }

  group.members.splice(memberIndex, 1);
  group.updatedAt = new Date();

  return { ...group, memberCount: group.members.length };
}

/**
 * Get list of members in a group
 * 
 * @param {string} groupId 
 * @returns {Promise<Array>}
 */
export async function getGroupMembers(groupId) {
  const group = await getRawGroupById(groupId);
  if (!group) {
    const error = new Error('Group not found');
    error.statusCode = 404;
    throw error;
  }

  return group.members;
}
