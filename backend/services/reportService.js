/**
 * Financial Reports & CSV Export Service (Day 14: Analytics Layer)
 * 
 * WHY A REPORT SERVICE?
 * - Uses MongoDB Aggregation pipelines ($match, $group, $sort) to aggregate category metrics.
 * - Integrates balanceService, settlementService, and expense data to produce a single source of truth.
 * - Formats compliant CSV data matching report numbers exactly (CSV totals === Report totals === Dashboard totals).
 * - Enforces group-level authorization: non-members cannot generate reports for private groups.
 */

import mongoose from 'mongoose';
import Expense from '../models/Expense.js';
import Group from '../models/Group.js';
import SettlementPayment from '../models/SettlementPayment.js';
import { formatMoney } from './splitService.js';
import { getGroupBalances } from './balanceService.js';
import { optimizeSettlements } from './settlementService.js';
import { getAllExpenses } from './expenseService.js';

function isDbConnected() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

/**
 * Generate a comprehensive financial report for a group.
 * 
 * @param {string} groupId 
 * @param {Object|null} requestingUser 
 * @returns {Promise<Object>} Comprehensive financial report
 */
export async function generateGroupReport(groupId, requestingUser = null) {
  const targetGroupId = String(groupId);

  // 1. Get Group details and Net Balances (includes membership authorization check)
  const balanceData = await getGroupBalances(targetGroupId, requestingUser);
  const group = balanceData.group;

  // 2. Fetch all expenses for itemized breakdown
  const expenses = await getAllExpenses({ group: targetGroupId }, requestingUser);

  // 3. Category Breakdown (via Aggregation when MongoDB is ready, or JS reduce)
  let categoryBreakdown = [];

  if (isDbConnected()) {
    const pipeline = [
      { $match: { group: new mongoose.Types.ObjectId(targetGroupId) } },
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } },
    ];

    const aggResults = await Expense.aggregate(pipeline);
    const totalGroupSpent = balanceData.summary.totalGroupSpending || 1; // avoid division by 0

    categoryBreakdown = aggResults.map((cat) => {
      const catAmount = formatMoney(cat.totalAmount);
      return {
        category: cat._id || 'General',
        totalAmount: catAmount,
        count: cat.count,
        percentage: formatMoney((catAmount / totalGroupSpent) * 100),
      };
    });
  } else {
    // In-memory category aggregation
    const catMap = new Map();
    for (const exp of expenses) {
      const cat = exp.category || 'General';
      const amt = formatMoney(exp.amount || 0);
      if (!catMap.has(cat)) {
        catMap.set(cat, { category: cat, totalAmount: 0, count: 0 });
      }
      const entry = catMap.get(cat);
      entry.totalAmount = formatMoney(entry.totalAmount + amt);
      entry.count += 1;
    }

    const totalGroupSpent = balanceData.summary.totalGroupSpending || 1;
    categoryBreakdown = Array.from(catMap.values())
      .map((cat) => ({
        ...cat,
        percentage: formatMoney((cat.totalAmount / totalGroupSpent) * 100),
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }

  // 4. Optimized Settlement Plan
  const suggestedTransactions = optimizeSettlements(balanceData.balances);

  // 5. Itemized Expenses Summary
  const itemizedExpenses = expenses.map((exp) => ({
    id: exp.id || exp._id,
    title: exp.title,
    amount: formatMoney(exp.amount),
    category: exp.category || 'General',
    paidBy: exp.paidBy,
    splitType: exp.splitType || 'EQUAL',
    participantCount: exp.splits?.length || exp.participants?.length || 1,
    expenseDate: exp.expenseDate || exp.createdAt,
  }));

  // 6. Member Breakdown
  const memberBreakdown = balanceData.balances.map((b) => ({
    name: b.name,
    userId: b.userId,
    totalPaid: b.totalPaid,
    totalOwed: b.totalOwed,
    netBalance: b.netBalance,
    status: b.netBalance > 0.005 ? 'Creditor (Gets Paid)' : b.netBalance < -0.005 ? 'Debtor (Owes)' : 'Settled',
  }));

  return {
    group: {
      id: group.id,
      name: group.name,
      baseCurrency: group.baseCurrency || 'USD',
      generatedAt: new Date().toISOString(),
    },
    summary: {
      totalSpending: balanceData.summary.totalGroupSpending,
      totalSettled: balanceData.summary.totalSettled,
      expenseCount: expenses.length,
      memberCount: memberBreakdown.length,
      settledMembers: balanceData.summary.settledMembers,
      unsettledMembers: memberBreakdown.length - balanceData.summary.settledMembers,
      optimizedTransactionCount: suggestedTransactions.length,
    },
    categoryBreakdown,
    memberBreakdown,
    itemizedExpenses,
    suggestedTransactions,
  };
}

/**
 * Escape field value for CSV compliance (RFC 4180)
 * 
 * @param {string|number|null|undefined} value 
 * @returns {string} Clean escaped CSV cell
 */
function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  // If string contains comma, quote, or newline, escape double quotes and wrap in quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

/**
 * Generate CSV formatted report text for a group
 * 
 * @param {string} groupId 
 * @param {Object|null} requestingUser 
 * @returns {Promise<{ csvText: string, filename: string }>}
 */
export async function generateGroupReportCSV(groupId, requestingUser = null) {
  const report = await generateGroupReport(groupId, requestingUser);

  const lines = [];

  // --- SECTION 1: HEADER & OVERVIEW ---
  lines.push(`EXPENSE SPLITTER FINANCIAL REPORT`);
  lines.push(`Group Name,${escapeCsvCell(report.group.name)}`);
  lines.push(`Base Currency,${escapeCsvCell(report.group.baseCurrency)}`);
  lines.push(`Total Group Spending,$${report.summary.totalSpending.toFixed(2)}`);
  lines.push(`Total Settled Volume,$${report.summary.totalSettled.toFixed(2)}`);
  lines.push(`Total Recorded Expenses,${report.summary.expenseCount}`);
  lines.push(`Group Member Count,${report.summary.memberCount}`);
  lines.push(`Generated At,${escapeCsvCell(new Date(report.group.generatedAt).toLocaleString())}`);
  lines.push(''); // Empty line

  // --- SECTION 2: CATEGORY BREAKDOWN ---
  lines.push(`--- CATEGORY SPENDING BREAKDOWN ---`);
  lines.push(`Category,Total Amount ($),Count,Percentage (%)`);
  for (const cat of report.categoryBreakdown) {
    lines.push(
      `${escapeCsvCell(cat.category)},${cat.totalAmount.toFixed(2)},${cat.count},${cat.percentage.toFixed(1)}%`
    );
  }
  lines.push(''); // Empty line

  // --- SECTION 3: MEMBER BALANCES ---
  lines.push(`--- MEMBER FINANCIAL BALANCES ---`);
  lines.push(`Member Name,Total Paid ($),Total Owed ($),Net Balance ($),Status`);
  for (const m of report.memberBreakdown) {
    const sign = m.netBalance >= 0 ? '+' : '';
    lines.push(
      `${escapeCsvCell(m.name)},${m.totalPaid.toFixed(2)},${m.totalOwed.toFixed(2)},${sign}${m.netBalance.toFixed(2)},${escapeCsvCell(m.status)}`
    );
  }
  lines.push(''); // Empty line

  // --- SECTION 4: ITEMIZED EXPENSES ---
  lines.push(`--- ITEMIZED EXPENSE DETAILS ---`);
  lines.push(`Date,Title,Category,Paid By,Split Type,Amount ($)`);
  for (const exp of report.itemizedExpenses) {
    const dateFormatted = exp.expenseDate
      ? new Date(exp.expenseDate).toISOString().split('T')[0]
      : '';
    lines.push(
      `${escapeCsvCell(dateFormatted)},${escapeCsvCell(exp.title)},${escapeCsvCell(exp.category)},${escapeCsvCell(exp.paidBy)},${escapeCsvCell(exp.splitType)},${exp.amount.toFixed(2)}`
    );
  }
  lines.push(''); // Empty line

  // --- SECTION 5: OPTIMIZED SETTLEMENT TRANSACTIONS ---
  lines.push(`--- OPTIMIZED SETTLEMENT TRANSACTIONS (MIN-CASH-FLOW) ---`);
  lines.push(`From (Debtor),To (Creditor),Amount ($)`);
  if (report.suggestedTransactions.length === 0) {
    lines.push(`Group is fully settled! No payments needed.,,`);
  } else {
    for (const tx of report.suggestedTransactions) {
      lines.push(`${escapeCsvCell(tx.from)},${escapeCsvCell(tx.to)},${tx.amount.toFixed(2)}`);
    }
  }

  const csvText = lines.join('\r\n');
  const safeGroupName = report.group.name.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase();
  const filename = `expense_report_${safeGroupName}_${new Date().toISOString().split('T')[0]}.csv`;

  return {
    csvText,
    filename,
    report,
  };
}
