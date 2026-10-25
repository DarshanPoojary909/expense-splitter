/**
 * Settlement Payment Service (Day 12: Business Logic Layer)
 * 
 * WHY A SETTLEMENT PAYMENT SERVICE?
 * - Separates real-world settlement transaction handling from Express controllers.
 * - Handles both Full and Partial settlements according to a single consistent business rule.
 * - Records ActivityLog entries to maintain an immutable financial audit trail.
 * - Framework-independent, testable in isolation with Jest / Node.js test runner.
 */

import mongoose from 'mongoose';
import SettlementPayment from '../models/SettlementPayment.js';
import Group from '../models/Group.js';
import User from '../models/User.js';
import ActivityLog from '../models/ActivityLog.js';
import { formatMoney } from './splitService.js';
import { createActivityLog } from './activityService.js';

function isDbConnected() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

let inMemorySettlements = [];

export async function resetSettlements() {
  if (isDbConnected()) {
    await SettlementPayment.deleteMany({});
  }
  inMemorySettlements = [];
}

async function logActivitySafely(logData) {
  try {
    await createActivityLog(logData);
  } catch (err) {
    console.warn('[ActivityLog Warning] Failed to log settlement activity:', err.message);
  }
}

/**
 * Record a new settlement payment between two group members.
 * 
 * @param {Object} data - { groupId, sender, senderName, receiver, receiverName, amount, currency, paymentMethod, paymentDate, notes, originalAmount }
 * @param {Object|null} requestingUser - Authenticated user recording the payment
 * @returns {Promise<Object>} Created settlement payment record
 */
export async function recordSettlementPayment(data, requestingUser = null) {
  const amount = formatMoney(data.amount);
  if (amount <= 0) {
    const error = new Error('Settlement payment amount must be greater than 0');
    error.statusCode = 400;
    throw error;
  }

  const groupId = data.group || data.groupId;
  if (!groupId) {
    const error = new Error('Group ID is required to record a settlement payment');
    error.statusCode = 400;
    throw error;
  }

  const senderName = (data.senderName || data.sender || '').trim();
  const receiverName = (data.receiverName || data.receiver || '').trim();

  if (!senderName || !receiverName) {
    const error = new Error('Both sender (debtor) and receiver (creditor) names are required');
    error.statusCode = 400;
    throw error;
  }

  if (senderName.toLowerCase() === receiverName.toLowerCase()) {
    const error = new Error('Sender and receiver cannot be the same person');
    error.statusCode = 400;
    throw error;
  }

  // Partial Settlement Calculation Rule
  // If originalAmount is provided and is greater than amount paid -> Partial payment
  const rawOriginalAmount = data.originalAmount !== undefined && data.originalAmount !== null
    ? formatMoney(data.originalAmount)
    : amount;

  const originalAmount = rawOriginalAmount >= amount ? rawOriginalAmount : amount;
  const isPartial = originalAmount > amount;
  const status = isPartial ? 'partial' : 'completed';
  const remainingAmount = isPartial ? formatMoney(originalAmount - amount) : 0;
  const paidAmount = amount;

  const paymentDate = data.paymentDate ? new Date(data.paymentDate) : new Date();
  if (isNaN(paymentDate.getTime())) {
    const error = new Error('Invalid payment date provided');
    error.statusCode = 400;
    throw error;
  }

  const currency = (data.currency || 'USD').toUpperCase().trim();
  const paymentMethod = data.paymentMethod || 'Cash';
  const notes = (data.notes || '').trim();

  if (isDbConnected()) {
    const targetGroupId = String(groupId);
    if (!mongoose.Types.ObjectId.isValid(targetGroupId)) {
      const error = new Error(`Invalid group ID format: ${targetGroupId}`);
      error.statusCode = 400;
      throw error;
    }

    const group = await Group.findById(targetGroupId);
    if (!group) {
      const error = new Error('Group not found');
      error.statusCode = 404;
      throw error;
    }

    // Resolve sender and receiver user ObjectIds if possible
    let senderUserId = data.senderId || (mongoose.Types.ObjectId.isValid(data.sender) ? data.sender : null);
    let receiverUserId = data.receiverId || (mongoose.Types.ObjectId.isValid(data.receiver) ? data.receiver : null);

    if (!senderUserId && group.members) {
      const found = group.members.find((m) => m.name.toLowerCase() === senderName.toLowerCase());
      if (found) senderUserId = found.userId;
    }
    if (!receiverUserId && group.members) {
      const found = group.members.find((m) => m.name.toLowerCase() === receiverName.toLowerCase());
      if (found) receiverUserId = found.userId;
    }

    // Default to generated ObjectId if user is an unregistered group member
    if (!senderUserId) senderUserId = new mongoose.Types.ObjectId();
    if (!receiverUserId) receiverUserId = new mongoose.Types.ObjectId();

    const createdPayment = await SettlementPayment.create({
      group: group._id,
      sender: senderUserId,
      senderName,
      receiver: receiverUserId,
      receiverName,
      amount,
      originalAmount,
      paidAmount,
      remainingAmount,
      currency,
      paymentDate,
      status,
      paymentMethod,
      notes,
      recordedBy: requestingUser ? requestingUser._id || requestingUser.id : null,
    });

    const result = createdPayment.toObject();
    result.id = result._id.toString();

    // Record ActivityLog
    const partialText = isPartial ? ` (Partial payment: $${remainingAmount.toFixed(2)} remaining of $${originalAmount.toFixed(2)})` : '';
    await logActivitySafely({
      group: group._id,
      user: requestingUser ? requestingUser._id || requestingUser.id : null,
      action: 'SETTLEMENT_RECORDED',
      entityType: 'SettlementPayment',
      entityId: result._id,
      description: `${senderName} paid ${receiverName} $${amount.toFixed(2)} via ${paymentMethod}${partialText}`,
      metadata: {
        amount,
        originalAmount,
        remainingAmount,
        status,
        senderName,
        receiverName,
        paymentMethod,
      },
    });

    return result;
  }

  // Fallback in-memory
  const newId = new mongoose.Types.ObjectId().toString();
  const paymentRecord = {
    _id: newId,
    id: newId,
    group: String(groupId),
    sender: data.sender || new mongoose.Types.ObjectId().toString(),
    senderName,
    receiver: data.receiver || new mongoose.Types.ObjectId().toString(),
    receiverName,
    amount,
    originalAmount,
    paidAmount,
    remainingAmount,
    currency,
    paymentDate,
    status,
    paymentMethod,
    notes,
    recordedBy: requestingUser ? requestingUser._id || requestingUser.id : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  inMemorySettlements.unshift(paymentRecord);

  const partialText = isPartial ? ` (Partial payment: $${remainingAmount.toFixed(2)} remaining of $${originalAmount.toFixed(2)})` : '';
  await logActivitySafely({
    group: paymentRecord.group,
    user: requestingUser ? requestingUser._id || requestingUser.id : null,
    action: 'SETTLEMENT_RECORDED',
    entityType: 'SettlementPayment',
    entityId: paymentRecord._id,
    description: `${senderName} paid ${receiverName} $${amount.toFixed(2)} via ${paymentMethod}${partialText}`,
    metadata: {
      amount,
      originalAmount,
      remainingAmount,
      status,
      senderName,
      receiverName,
      paymentMethod,
    },
  });

  return { ...paymentRecord };
}

/**
 * Get all settlement payments for a group
 * 
 * @param {Object} filter - { group, status }
 * @param {Object|null} requestingUser
 * @returns {Promise<Array>} List of settlement payments
 */
export async function getSettlementPayments(filter = {}, requestingUser = null) {
  if (isDbConnected()) {
    const query = {};
    if (filter.group) {
      if (mongoose.Types.ObjectId.isValid(filter.group)) {
        query.group = filter.group;
      }
    }
    if (filter.status) {
      query.status = filter.status;
    }

    const list = await SettlementPayment.find(query)
      .sort({ paymentDate: -1, createdAt: -1 })
      .lean();

    return list.map((item) => ({ ...item, id: item._id.toString() }));
  }

  // Fallback in-memory
  let result = [...inMemorySettlements];
  if (filter.group) {
    result = result.filter((s) => String(s.group) === String(filter.group));
  }
  if (filter.status) {
    result = result.filter((s) => s.status === filter.status);
  }

  return result.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
}
