/**
 * Expense Service (Business Logic Layer - Day 8)
 * 
 * WHY A SERVICE LAYER?
 * - Separates core business rules, validation, and database operations from Express HTTP controllers.
 * - Framework-agnostic: This file does not know or care about Express `req` or `res` objects.
 * - Easy to unit-test with Jest / Node.js test runner.
 * - Enforces multi-layer validation: Positive amount, valid UTC Date, group existence,
 *   requester membership authorization, and payer membership in groups.
 */

import mongoose from 'mongoose';
import Expense from '../models/Expense.js';
import Group from '../models/Group.js';
import ActivityLog from '../models/ActivityLog.js';
import { calculateExpenseSplits } from './splitService.js';
import { createActivityLog } from './activityService.js';

export const VALID_CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Transportation',
  'Accommodation',
  'Entertainment',
  'Utilities',
  'Shopping',
  'General',
];

/**
 * Standardize monetary amounts to 2 decimal places.
 * Avoids floating-point precision drift (e.g. 0.1 + 0.2 = 0.30000000000000004).
 * 
 * @param {number|string} amount 
 * @returns {number} Clean rounded 2-decimal number
 */
export function formatMoney(amount) {
  const num = Number(amount);
  if (isNaN(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

// In-memory cache/store for fallback or offline testing
let inMemoryExpenses = [
  {
    _id: '507f1f77bcf86cd799439011',
    id: '507f1f77bcf86cd799439011',
    title: 'Team Welcome Lunch',
    amount: 120.00,
    currency: 'USD',
    category: 'Food & Dining',
    paidBy: 'Alice',
    payers: [{ name: 'Alice', amount: 120.00 }],
    splitType: 'EQUAL',
    splits: [
      { name: 'Alice', amountOwed: 40.00 },
      { name: 'Bob', amountOwed: 40.00 },
      { name: 'Charlie', amountOwed: 40.00 },
    ],
    participants: ['Alice', 'Bob', 'Charlie'],
    expenseDate: new Date(Date.now() - 3600000 * 24),
    createdAt: new Date(Date.now() - 3600000 * 24),
    updatedAt: new Date(Date.now() - 3600000 * 24),
  },
  {
    _id: '507f1f77bcf86cd799439012',
    id: '507f1f77bcf86cd799439012',
    title: 'Office Coffee & Snacks',
    amount: 45.50,
    currency: 'USD',
    category: 'Groceries',
    paidBy: 'Bob',
    payers: [{ name: 'Bob', amount: 45.50 }],
    splitType: 'EQUAL',
    splits: [
      { name: 'Alice', amountOwed: 15.17 },
      { name: 'Bob', amountOwed: 15.16 },
      { name: 'Charlie', amountOwed: 15.17 },
    ],
    participants: ['Alice', 'Bob', 'Charlie'],
    expenseDate: new Date(Date.now() - 3600000 * 12),
    createdAt: new Date(Date.now() - 3600000 * 12),
    updatedAt: new Date(Date.now() - 3600000 * 12),
  },
  {
    _id: '507f1f77bcf86cd799439013',
    id: '507f1f77bcf86cd799439013',
    title: 'Conference Cab Fare',
    amount: 35.00,
    currency: 'USD',
    category: 'Transportation',
    paidBy: 'Charlie',
    payers: [{ name: 'Charlie', amount: 35.00 }],
    splitType: 'EQUAL',
    splits: [
      { name: 'Alice', amountOwed: 11.67 },
      { name: 'Bob', amountOwed: 11.67 },
      { name: 'Charlie', amountOwed: 11.66 },
    ],
    participants: ['Alice', 'Bob', 'Charlie'],
    expenseDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }
];

/**
 * Check if active MongoDB connection is ready
 */
function isDbConnected() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

/**
 * Validate raw expense input data before persistence (Day 8: Multi-layer validation)
 */
export function validateExpenseInput(data, isUpdate = false) {
  const errors = [];

  // 1. Title validation
  if (!isUpdate || data.title !== undefined) {
    if (!data.title || typeof data.title !== 'string' || data.title.trim() === '') {
      errors.push('Title/description is required and must be a non-empty string.');
    } else if (data.title.trim().length > 120) {
      errors.push('Title cannot exceed 120 characters.');
    }
  }

  // 2. Amount validation: must be a finite positive number > 0
  if (!isUpdate || data.amount !== undefined) {
    const numAmount = Number(data.amount);
    if (isNaN(numAmount) || numAmount <= 0 || !isFinite(numAmount)) {
      errors.push('Amount must be a positive number greater than 0.');
    }
  }

  // 3. PaidBy (Payer) validation
  if (!isUpdate || data.paidBy !== undefined) {
    if (!data.paidBy || typeof data.paidBy !== 'string' || data.paidBy.trim() === '') {
      errors.push('PaidBy (primary payer name/identifier) is required.');
    }
  }

  // 4. Date validation: must parse to a valid Date object
  if (data.expenseDate !== undefined && data.expenseDate !== null) {
    const parsedDate = new Date(data.expenseDate);
    if (isNaN(parsedDate.getTime())) {
      errors.push('Invalid expense date provided. Must be a valid date.');
    }
  }

  // 5. Category validation
  if (data.category !== undefined && data.category !== null) {
    if (typeof data.category !== 'string' || !VALID_CATEGORIES.includes(data.category.trim())) {
      errors.push(`Category must be one of: ${VALID_CATEGORIES.join(', ')}.`);
    }
  }

  // 6. Currency validation
  if (data.currency !== undefined && data.currency !== null) {
    if (typeof data.currency !== 'string' || data.currency.trim().length !== 3) {
      errors.push('Currency must be a valid 3-letter currency code (e.g., USD, EUR, INR).');
    }
  }

  // 7. Payers array validation (if provided)
  if (data.payers !== undefined && data.payers !== null) {
    if (!Array.isArray(data.payers)) {
      errors.push('Payers must be an array of payer objects.');
    } else {
      for (const [idx, p] of data.payers.entries()) {
        if (!p.name || typeof p.name !== 'string' || p.name.trim() === '') {
          errors.push(`Payer at index ${idx} must have a valid non-empty name.`);
        }
        const pAmount = Number(p.amount);
        if (isNaN(pAmount) || pAmount <= 0) {
          errors.push(`Payer "${p.name || idx}" must have a positive paid amount greater than 0.`);
        }
      }
    }
  }

  if (errors.length > 0) {
    const err = new Error(errors.join(' '));
    err.statusCode = 400;
    throw err;
  }
}

/**
 * Validate group existence, requester membership authorization, and payer membership.
 */
async function validateGroupAndPayers(groupId, payerName, payers, requestingUser = null) {
  if (!groupId) return null;

  let groupDoc = null;
  const targetGroupId = String(groupId);

  if (isDbConnected()) {
    if (!mongoose.Types.ObjectId.isValid(targetGroupId)) {
      const err = new Error(`Invalid group ID format: ${targetGroupId}`);
      err.statusCode = 400;
      throw err;
    }
    groupDoc = await Group.findById(targetGroupId).lean();
  } else {
    // Check in-memory fallback
    try {
      const { getRawGroupById } = await import('./groupService.js');
      if (getRawGroupById) {
        groupDoc = await getRawGroupById(targetGroupId);
      }
    } catch {
      // In-memory fallback
    }
  }

  if (!groupDoc) {
    const err = new Error(`Group not found with ID: ${targetGroupId}`);
    err.statusCode = 400;
    throw err;
  }

  // 1. Authorization: Verify requester is an active member of this group
  if (requestingUser) {
    const reqUserId = String(requestingUser._id || requestingUser.id);
    const isMember = groupDoc.members && groupDoc.members.some(
      (m) =>
        String(m.userId) === reqUserId ||
        (requestingUser.email && m.email && m.email.toLowerCase() === requestingUser.email.toLowerCase())
    );

    if (!isMember) {
      const err = new Error(`Forbidden: You are not a member of the group "${groupDoc.name}".`);
      err.statusCode = 403;
      throw err;
    }
  }

  // 2. Verify primary payer is an active member of this group
  const memberNames = (groupDoc.members || []).map((m) => m.name.toLowerCase().trim());
  const memberUserIds = (groupDoc.members || []).map((m) => String(m.userId));

  if (payerName) {
    const isPayerInGroup = memberNames.includes(payerName.trim().toLowerCase());
    if (!isPayerInGroup) {
      const err = new Error(
        `Payer "${payerName}" is not a member of group "${groupDoc.name}". Only group members can pay for group expenses.`
      );
      err.statusCode = 400;
      throw err;
    }
  }

  // 3. Verify each payer in the payers array is an active member of this group
  if (Array.isArray(payers) && payers.length > 0) {
    for (const p of payers) {
      const pName = p.name ? p.name.trim().toLowerCase() : '';
      const pUser = p.user ? String(p.user) : null;
      const isPayerMember = memberNames.includes(pName) || (pUser && memberUserIds.includes(pUser));
      if (!isPayerMember) {
        const err = new Error(
          `Payer "${p.name}" is not a member of group "${groupDoc.name}". Only group members can pay for group expenses.`
        );
        err.statusCode = 400;
        throw err;
      }
    }
  }

  return groupDoc;
}

/**
 * Helper to record an activity log entry safely
 */
async function logActivitySafely(logData) {
  try {
    await createActivityLog(logData);
  } catch (err) {
    console.warn('[ActivityLog Warning] Failed to create log entry:', err.message);
  }
}

/**
 * Get all expenses with optional filters (group, category, search)
 * @param {Object} filter Query filter options
 * @param {Object|null} requestingUser Authenticated user
 * @returns {Promise<Array>} List of expense objects
 */
export async function getAllExpenses(filter = {}, requestingUser = null) {
  if (isDbConnected()) {
    const query = {};
    if (filter.group) {
      if (mongoose.Types.ObjectId.isValid(filter.group)) {
        query.group = filter.group;
      }
    }
    if (filter.category) {
      query.category = filter.category;
    }

    const list = await Expense.find(query).sort({ expenseDate: -1, createdAt: -1 }).lean();
    return list.map((item) => ({ ...item, id: item._id.toString() }));
  }

  // Fallback in-memory
  let result = [...inMemoryExpenses];
  if (filter.group) {
    result = result.filter((e) => String(e.group) === String(filter.group));
  }
  if (filter.category) {
    result = result.filter((e) => e.category === filter.category);
  }

  return result.sort((a, b) => new Date(b.expenseDate || b.createdAt) - new Date(a.expenseDate || a.createdAt));
}

/**
 * Get single expense by ID
 * @param {string} id Unique expense ID or ObjectId
 * @returns {Promise<Object|null>} Matching expense or null
 */
export async function getExpenseById(id) {
  if (isDbConnected()) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    const doc = await Expense.findById(id).lean();
    return doc ? { ...doc, id: doc._id.toString() } : null;
  }

  // Fallback in-memory
  const expense = inMemoryExpenses.find((item) => item.id === id || item._id === id);
  return expense ? { ...expense } : null;
}

/**
 * Create a new expense (Day 8: Full validation & authorization)
 * @param {Object} expenseData Raw payload
 * @param {Object|null} requestingUser Authenticated user creating the expense
 * @returns {Promise<Object>} The created expense document
 */
export async function createExpense(expenseData, requestingUser = null) {
  // 1. Validate incoming input format
  validateExpenseInput(expenseData, false);

  const roundedAmount = formatMoney(expenseData.amount);
  const payerName = expenseData.paidBy.trim();

  // 2. Validate group existence and payer membership if group is specified
  const targetGroupId = expenseData.group && String(expenseData.group).trim() !== ''
    ? expenseData.group
    : null;

  let groupDoc = null;
  if (targetGroupId) {
    groupDoc = await validateGroupAndPayers(targetGroupId, payerName, expenseData.payers, requestingUser);
  }

  // 3. Multi-payer validation: check sum equality
  if (Array.isArray(expenseData.payers) && expenseData.payers.length > 1) {
    const totalPayerSum = expenseData.payers.reduce((sum, p) => sum + formatMoney(p.amount || 0), 0);
    if (Math.abs(formatMoney(totalPayerSum) - roundedAmount) > 0.01) {
      const err = new Error(
        `Total payer amounts ($${totalPayerSum.toFixed(2)}) does not match total expense amount ($${roundedAmount.toFixed(2)}).`
      );
      err.statusCode = 400;
      throw err;
    }
  }

  const participants = Array.isArray(expenseData.participants) && expenseData.participants.length > 0
    ? expenseData.participants
    : (groupDoc && groupDoc.members ? groupDoc.members.map((m) => m.name) : [payerName]);

  // Day 9: Unified Framework-Independent Split Calculation
  const splitResult = calculateExpenseSplits({
    amount: roundedAmount,
    splitType: expenseData.splitType || 'EQUAL',
    participants,
    splits: expenseData.splits || [],
    payers: expenseData.payers || [],
    paidBy: payerName,
  });

  // Store dates as native UTC Date objects
  const expenseDate = expenseData.expenseDate ? new Date(expenseData.expenseDate) : new Date();

  const payload = {
    title: expenseData.title.trim(),
    amount: roundedAmount,
    currency: expenseData.currency ? expenseData.currency.toUpperCase().trim() : (groupDoc?.baseCurrency || 'USD'),
    category: expenseData.category?.trim() || 'General',
    paidBy: payerName,
    payers: splitResult.payers,
    splitType: splitResult.splitType,
    splits: splitResult.splits,
    participants: splitResult.splits.map((s) => s.name),
    group: targetGroupId && mongoose.Types.ObjectId.isValid(targetGroupId) ? targetGroupId : null,
    expenseDate,
    notes: expenseData.notes?.trim() || '',
    createdBy: requestingUser ? requestingUser._id || requestingUser.id : null,
  };

  if (isDbConnected()) {
    const created = await Expense.create(payload);
    const result = created.toObject();
    result.id = result._id.toString();

    // Record ActivityLog
    await logActivitySafely({
      group: result.group,
      user: requestingUser ? requestingUser._id || requestingUser.id : null,
      action: 'EXPENSE_CREATED',
      entityType: 'Expense',
      entityId: result._id,
      description: `Expense "${result.title}" for $${result.amount.toFixed(2)} was created by ${result.paidBy}`,
      metadata: { amount: result.amount, title: result.title, splitType: result.splitType, group: result.group },
    });

    return result;
  }

  // Fallback in-memory
  const newId = (expenseData.id && String(expenseData.id)) ||
    (expenseData._id && String(expenseData._id)) ||
    new mongoose.Types.ObjectId().toString();

  const now = new Date();
  const inMemItem = {
    _id: newId,
    id: newId,
    ...payload,
    createdAt: now,
    updatedAt: now,
  };
  inMemoryExpenses.unshift(inMemItem);

  await logActivitySafely({
    group: inMemItem.group,
    user: requestingUser ? requestingUser._id || requestingUser.id : null,
    action: 'EXPENSE_CREATED',
    entityType: 'Expense',
    entityId: inMemItem._id,
    description: `Expense "${inMemItem.title}" for $${inMemItem.amount.toFixed(2)} was created by ${inMemItem.paidBy}`,
    metadata: { amount: inMemItem.amount, title: inMemItem.title, splitType: inMemItem.splitType, group: inMemItem.group },
  });

  return { ...inMemItem };
}

/**
 * Update an existing expense by ID (Day 8: Full validation & authorization)
 * @param {string} id Expense ID
 * @param {Object} updateData Fields to update
 * @param {Object|null} requestingUser Authenticated user updating the expense
 * @returns {Promise<Object|null>} The updated expense or null
 */
export async function updateExpense(id, updateData, requestingUser = null) {
  // 1. Validate update payload
  validateExpenseInput(updateData, true);

  if (isDbConnected()) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }

    const existingDoc = await Expense.findById(id);
    if (!existingDoc) return null;

    // 2. If existing expense belongs to a group, check requester authorization
    const targetGroupId = updateData.group !== undefined ? updateData.group : existingDoc.group;
    const targetPayerName = updateData.paidBy !== undefined ? updateData.paidBy : existingDoc.paidBy;

    if (targetGroupId) {
      await validateGroupAndPayers(targetGroupId, targetPayerName, updateData.payers, requestingUser);
    }

    const updates = {};
    if (updateData.title !== undefined) updates.title = updateData.title.trim();
    if (updateData.amount !== undefined) updates.amount = formatMoney(updateData.amount);
    if (updateData.category !== undefined) updates.category = updateData.category.trim();
    if (updateData.currency !== undefined) updates.currency = updateData.currency.toUpperCase().trim();
    if (updateData.paidBy !== undefined) updates.paidBy = updateData.paidBy.trim();
    if (updateData.group !== undefined) {
      updates.group = updateData.group && mongoose.Types.ObjectId.isValid(updateData.group) ? updateData.group : null;
    }
    if (updateData.expenseDate !== undefined) updates.expenseDate = new Date(updateData.expenseDate);
    if (updateData.notes !== undefined) updates.notes = updateData.notes.trim();
    if (updateData.splitType !== undefined) updates.splitType = updateData.splitType;
    if (updateData.participants !== undefined) updates.participants = updateData.participants;
    if (updateData.payers !== undefined) updates.payers = updateData.payers;
    if (updateData.splits !== undefined) updates.splits = updateData.splits;

    const updatedDoc = await Expense.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedDoc) return null;

    const result = { ...updatedDoc, id: updatedDoc._id.toString() };

    // Record ActivityLog
    await logActivitySafely({
      group: result.group,
      user: requestingUser ? requestingUser._id || requestingUser.id : null,
      action: 'EXPENSE_UPDATED',
      entityType: 'Expense',
      entityId: result._id,
      description: `Expense "${result.title}" was updated`,
      metadata: updates,
    });

    return result;
  }

  // Fallback in-memory
  const index = inMemoryExpenses.findIndex((item) => item.id === id || item._id === id);
  if (index === -1) return null;

  const existing = inMemoryExpenses[index];
  const targetGroupId = updateData.group !== undefined ? updateData.group : existing.group;
  const targetPayerName = updateData.paidBy !== undefined ? updateData.paidBy : existing.paidBy;

  if (targetGroupId) {
    await validateGroupAndPayers(targetGroupId, targetPayerName, updateData.payers, requestingUser);
  }

  const now = new Date();
  const updated = {
    ...existing,
    ...(updateData.title !== undefined && { title: updateData.title.trim() }),
    ...(updateData.amount !== undefined && { amount: formatMoney(updateData.amount) }),
    ...(updateData.category !== undefined && { category: updateData.category.trim() }),
    ...(updateData.currency !== undefined && { currency: updateData.currency.toUpperCase().trim() }),
    ...(updateData.paidBy !== undefined && { paidBy: updateData.paidBy.trim() }),
    ...(updateData.group !== undefined && { group: updateData.group }),
    ...(updateData.splitType !== undefined && { splitType: updateData.splitType }),
    ...(updateData.participants !== undefined && { participants: updateData.participants }),
    ...(updateData.notes !== undefined && { notes: updateData.notes.trim() }),
    ...(updateData.expenseDate !== undefined && { expenseDate: new Date(updateData.expenseDate) }),
    ...(updateData.payers !== undefined && { payers: updateData.payers }),
    ...(updateData.splits !== undefined && { splits: updateData.splits }),
    updatedAt: now,
  };

  inMemoryExpenses[index] = updated;
  return { ...updated };
}

/**
 * Delete an expense by ID (Day 8)
 * @param {string} id Expense ID
 * @param {Object|null} requestingUser Authenticated user
 * @returns {Promise<Object|null>} Deleted expense or null
 */
export async function deleteExpense(id, requestingUser = null) {
  if (isDbConnected()) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }

    const existing = await Expense.findById(id);
    if (!existing) return null;

    // Authorization check for group expense
    if (existing.group && requestingUser) {
      await validateGroupAndPayers(existing.group, null, null, requestingUser);
    }

    const deletedDoc = await Expense.findByIdAndDelete(id).lean();
    if (!deletedDoc) return null;

    const result = { ...deletedDoc, id: deletedDoc._id.toString() };

    // Record ActivityLog
    await logActivitySafely({
      group: result.group,
      user: requestingUser ? requestingUser._id || requestingUser.id : null,
      action: 'EXPENSE_DELETED',
      entityType: 'Expense',
      entityId: result._id,
      description: `Expense "${result.title}" ($${result.amount.toFixed(2)}) was deleted`,
      metadata: { deletedExpenseId: result._id, title: result.title, amount: result.amount },
    });

    return result;
  }

  // Fallback in-memory
  const index = inMemoryExpenses.findIndex((item) => item.id === id || item._id === id);
  if (index === -1) return null;

  const existing = inMemoryExpenses[index];
  if (existing.group && requestingUser) {
    await validateGroupAndPayers(existing.group, null, null, requestingUser);
  }

  const deleted = inMemoryExpenses.splice(index, 1)[0];
  return deleted;
}

/**
 * Reset expenses state (clears in-memory store or MongoDB collection in tests)
 */
export async function resetExpenses() {
  if (isDbConnected()) {
    await Expense.deleteMany({});
    await ActivityLog.deleteMany({});
  }

  inMemoryExpenses = [
    {
      _id: '507f1f77bcf86cd799439011',
      id: '507f1f77bcf86cd799439011',
      title: 'Team Welcome Lunch',
      amount: 120.00,
      currency: 'USD',
      category: 'Food & Dining',
      paidBy: 'Alice',
      payers: [{ name: 'Alice', amount: 120.00 }],
      splitType: 'EQUAL',
      splits: [
        { name: 'Alice', amountOwed: 40.00 },
        { name: 'Bob', amountOwed: 40.00 },
        { name: 'Charlie', amountOwed: 40.00 },
      ],
      participants: ['Alice', 'Bob', 'Charlie'],
      expenseDate: new Date(Date.now() - 3600000 * 24),
      createdAt: new Date(Date.now() - 3600000 * 24),
      updatedAt: new Date(Date.now() - 3600000 * 24),
    }
  ];
}

