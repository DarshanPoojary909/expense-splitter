/**
 * Settlement Optimization Service (Day 11: Pure Business Logic Layer)
 * 
 * WHY SETTLEMENT OPTIMIZATION (MIN-CASH-FLOW ALGORITHM)?
 * - In group expenses, pairwise debts can create complex cycles (e.g. A owes B, B owes C, C owes A).
 * - Standard Splitwise-style Debt Simplification collapses pairwise debts into Net Balances.
 * - The Greedy Min-Cash-Flow algorithm pairs the biggest debtor with the biggest creditor,
 *   settling all group debts in at most (N - 1) transactions (where N is the number of unsettled participants).
 * - Framework-independent: pure algorithmic logic, testable in isolation.
 */

import { formatMoney } from './splitService.js';
import { calculateBalances, getGroupBalances } from './balanceService.js';

/**
 * Optimize debt transactions using the Greedy Min-Cash-Flow algorithm.
 * 
 * @param {Array<Object>} balances - Array of balance objects [{ name, userId, netBalance }]
 * @returns {Array<Object>} List of suggested optimized transactions:
 *   [{ from: string, fromUserId: string|null, to: string, toUserId: string|null, amount: number }]
 */
export function optimizeSettlements(balances = []) {
  if (!Array.isArray(balances) || balances.length === 0) {
    return [];
  }

  // 1. Separate debtors (netBalance < 0) and creditors (netBalance > 0)
  // Working clone of participants with non-zero balances
  const debtors = [];
  const creditors = [];

  for (const b of balances) {
    const net = formatMoney(b.netBalance || 0);
    if (net < -0.005) {
      debtors.push({
        name: (b.name || 'Debtor').trim(),
        userId: b.userId ? String(b.userId) : null,
        debt: formatMoney(Math.abs(net)),
      });
    } else if (net > 0.005) {
      creditors.push({
        name: (b.name || 'Creditor').trim(),
        userId: b.userId ? String(b.userId) : null,
        credit: formatMoney(net),
      });
    }
  }

  const transactions = [];

  // 2. Greedy Matching Loop
  // Continue until either all debts or credits are fully settled
  while (debtors.length > 0 && creditors.length > 0) {
    // Sort debtors descending by debt amount (largest debt first)
    debtors.sort((a, b) => b.debt - a.debt);
    // Sort creditors descending by credit amount (largest credit first)
    creditors.sort((a, b) => b.credit - a.credit);

    const debtor = debtors[0];
    const creditor = creditors[0];

    // Transaction amount is the minimum of debtor's debt and creditor's credit
    const settlementAmount = formatMoney(Math.min(debtor.debt, creditor.credit));

    if (settlementAmount > 0.005) {
      transactions.push({
        from: debtor.name,
        fromUserId: debtor.userId || null,
        to: creditor.name,
        toUserId: creditor.userId || null,
        amount: settlementAmount,
        currency: 'USD',
      });

      // Update remaining amounts
      debtor.debt = formatMoney(debtor.debt - settlementAmount);
      creditor.credit = formatMoney(creditor.credit - settlementAmount);
    }

    // Remove debtor if fully settled (debt <= 0)
    if (debtor.debt <= 0.005) {
      debtors.shift();
    }

    // Remove creditor if fully settled (credit <= 0)
    if (creditor.credit <= 0.005) {
      creditors.shift();
    }
  }

  return transactions;
}

/**
 * Get optimized settlement plan for a specific group from database
 * 
 * @param {string} groupId 
 * @param {Object|null} requestingUser 
 * @returns {Promise<Object>} Optimized settlement result with summary
 */
export async function getGroupOptimizedSettlements(groupId, requestingUser = null) {
  const balanceData = await getGroupBalances(groupId, requestingUser);
  const transactions = optimizeSettlements(balanceData.balances);

  // Calculate total settlement transfer volume
  const totalTransferVolume = transactions.reduce(
    (sum, tx) => formatMoney(sum + tx.amount),
    0
  );

  return {
    group: balanceData.group,
    balances: balanceData.balances,
    suggestedTransactions: transactions,
    summary: {
      transactionCount: transactions.length,
      totalTransferVolume,
      currency: balanceData.group.baseCurrency || 'USD',
      isFullySettled: transactions.length === 0,
    },
  };
}
