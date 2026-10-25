/**
 * Net Balance Calculation Service (Day 10: Pure Business Logic Layer)
 * 
 * WHY A FRAMEWORK-INDEPENDENT BALANCE SERVICE?
 * - Separates financial balance math from Express HTTP controllers and React UI state.
 * - Computes balances from actual MongoDB Expense splits and completed SettlementPayment records.
 * - Pure, deterministic, and easily tested with Jest / Node.js test runner.
 * 
 * Core Formula:
 *   Net Balance = Total Paid - Total Owed
 *   - Positive (> 0): User is a creditor (should receive money)
 *   - Negative (< 0): User is a debtor (owes money)
 *   - Zero (=== 0): User is fully settled
 */

import mongoose from 'mongoose';
import { formatMoney } from './splitService.js';
import Expense from '../models/Expense.js';
import SettlementPayment from '../models/SettlementPayment.js';
import Group from '../models/Group.js';

/**
 * Check if MongoDB connection is open
 */
function isDbConnected() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

/**
 * Calculate net balances across a given collection of expenses and completed settlement payments.
 * 
 * Framework-independent pure calculation function.
 * 
 * @param {Array<Object>} expenses - List of expense documents or objects
 * @param {Array<Object>} settlements - List of completed settlement payment documents or objects
 * @param {Array<Object|string>} members - List of group member definitions [{ name, userId }]
 * @returns {{ balances: Array<Object>, summary: Object }}
 */
export function calculateBalances(expenses = [], settlements = [], members = []) {
  // Map keyed by unique identifier: { name, userId, totalPaid, totalOwed, netBalance }
  const balanceMap = new Map();
  const nameToKeyMap = new Map();

  // Helper to initialize or retrieve a member entry
  function getOrCreate(name, userId = null) {
    const cleanName = (name || 'Anonymous').trim();
    const lowerName = cleanName.toLowerCase();
    const userStr = userId ? String(userId) : null;

    // Resolve existing key if known by name or userId
    let key = (userStr && balanceMap.has(userStr))
      ? userStr
      : (nameToKeyMap.get(lowerName) || userStr || lowerName);

    if (!balanceMap.has(key)) {
      balanceMap.set(key, {
        key,
        name: cleanName,
        userId: userStr,
        totalPaid: 0,
        totalOwed: 0,
        netBalance: 0,
      });
      nameToKeyMap.set(lowerName, key);
      if (userStr) {
        nameToKeyMap.set(userStr, key);
      }
    }

    const entry = balanceMap.get(key);
    if (userStr && !entry.userId) {
      entry.userId = userStr;
      nameToKeyMap.set(userStr, key);
    }
    return entry;
  }

  // 1. Seed known group members (if provided)
  for (const m of members) {
    if (typeof m === 'string') {
      getOrCreate(m);
    } else if (m && typeof m === 'object') {
      getOrCreate(m.name, m.userId || m._id);
    }
  }

  let totalGroupSpending = 0;

  // 2. Accumulate from Expenses
  for (const exp of expenses) {
    const expAmount = formatMoney(exp.amount || 0);
    totalGroupSpending = formatMoney(totalGroupSpending + expAmount);

    // Accumulate Payers (Who paid how much)
    if (Array.isArray(exp.payers) && exp.payers.length > 0) {
      for (const p of exp.payers) {
        const pName = p.name || exp.paidBy || 'Payer';
        const pAmount = formatMoney(p.amount || 0);
        const entry = getOrCreate(pName, p.user);
        entry.totalPaid = formatMoney(entry.totalPaid + pAmount);
      }
    } else if (exp.paidBy) {
      const entry = getOrCreate(exp.paidBy);
      entry.totalPaid = formatMoney(entry.totalPaid + expAmount);
    }

    // Accumulate Splits (Who owes how much)
    if (Array.isArray(exp.splits) && exp.splits.length > 0) {
      for (const s of exp.splits) {
        const sName = s.name;
        const sAmount = formatMoney(s.amountOwed || 0);
        const entry = getOrCreate(sName, s.user);
        entry.totalOwed = formatMoney(entry.totalOwed + sAmount);
      }
    }
  }

  let totalSettled = 0;

  // 3. Accumulate from completed Settlement Payments
  for (const st of settlements) {
    // Only completed or partial payments affect real balances
    if (st.status === 'completed' || st.status === 'partial') {
      const paidAmount = formatMoney(st.paidAmount || st.amount || 0);
      totalSettled = formatMoney(totalSettled + paidAmount);

      // Sender paid money -> increase sender's totalPaid
      const senderName = st.senderName || 'Sender';
      const senderEntry = getOrCreate(senderName, st.sender);
      senderEntry.totalPaid = formatMoney(senderEntry.totalPaid + paidAmount);

      // Receiver received money -> increase receiver's totalOwed (which offsets their credit)
      const receiverName = st.receiverName || 'Receiver';
      const receiverEntry = getOrCreate(receiverName, st.receiver);
      receiverEntry.totalOwed = formatMoney(receiverEntry.totalOwed + paidAmount);
    }
  }

  // 4. Compute Net Balance for each person
  const balances = [];
  for (const entry of balanceMap.values()) {
    entry.netBalance = formatMoney(entry.totalPaid - entry.totalOwed);
    balances.push(entry);
  }

  // Sort: Creditors (+ balance) first, then zero, then Debtors (- balance)
  balances.sort((a, b) => b.netBalance - a.netBalance);

  return {
    balances,
    summary: {
      totalGroupSpending,
      totalSettled,
      memberCount: balances.length,
      netCreditors: balances.filter((b) => b.netBalance > 0).length,
      netDebtors: balances.filter((b) => b.netBalance < 0).length,
      settledMembers: balances.filter((b) => Math.abs(b.netBalance) < 0.01).length,
    },
  };
}

/**
 * Get Net Balances for a specific Group from MongoDB
 * 
 * @param {string} groupId 
 * @param {Object|null} requestingUser 
 * @returns {Promise<Object>} Calculated balance result
 */
export async function getGroupBalances(groupId, requestingUser = null) {
  const targetId = String(groupId);

  if (isDbConnected()) {
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      const error = new Error(`Invalid group ID format: ${targetId}`);
      error.statusCode = 400;
      throw error;
    }

    const group = await Group.findById(targetId).lean();
    if (!group) {
      const error = new Error(`Group not found with ID: ${targetId}`);
      error.statusCode = 404;
      throw error;
    }

    // Check authorization: requesting user must be a member
    if (requestingUser) {
      const reqUserId = String(requestingUser._id || requestingUser.id);
      const isMember = group.members.some(
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

    // Fetch all expenses belonging to this group
    const expenses = await Expense.find({ group: targetId }).lean();

    // Fetch all completed / partial settlement payments for this group
    const settlements = await SettlementPayment.find({
      group: targetId,
      status: { $in: ['completed', 'partial'] },
    }).lean();

    const members = group.members || [];

    const balanceResult = calculateBalances(expenses, settlements, members);
    return {
      group: {
        id: group._id.toString(),
        name: group.name,
        baseCurrency: group.baseCurrency || 'USD',
      },
      ...balanceResult,
    };
  }

  // Fallback in-memory mode
  const { getAllExpenses } = await import('./expenseService.js');
  const { getRawGroupById } = await import('./groupService.js');

  const group = await getRawGroupById(targetId);
  if (!group) {
    const error = new Error(`Group not found with ID: ${targetId}`);
    error.statusCode = 404;
    throw error;
  }

  // Check authorization in in-memory fallback
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

  const allExpenses = await getAllExpenses({ group: targetId }, requestingUser);
  const balanceResult = calculateBalances(allExpenses, [], group.members || []);

  return {
    group: {
      id: targetId,
      name: group.name,
      baseCurrency: group.baseCurrency || 'USD',
    },
    ...balanceResult,
  };
}
